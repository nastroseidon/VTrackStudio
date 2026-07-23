"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { CourseMap } from "../components/CourseMap";
import { CourseSearchPanel } from "../components/CourseSearchPanel";
import { MapEditingTray } from "../components/MapEditingTray";
import { ProjectStatusMeter } from "../components/ProjectStatusMeter";
import { ProjectStatusRail } from "../components/ProjectStatusRail";
import {
  buildCoursePackage,
  validateCoursePackageReadiness
} from "../lib/course-package/build-course-package";
import type { CourseMetadata } from "../lib/course-data/types";
import {
  markElevationModelStale
} from "../lib/elevation/elevation-service";
import { generateBasicCourseGeometry } from "../lib/geometry/generate-basic-hole-geometry";
import {
  approveHoleTrace,
  findAdjacentSavedTrace,
  findNextTraceNeedingReview,
  findReviewStartHole,
  getHoleTraceProgress
} from "../lib/hole-trace-review";
import type {
  CourseBoundary,
  CourseElevationModel,
  DraftHole,
  CourseProject,
  CourseProjectStatus,
  DraftHoleTrace,
  DraftHolePlan
} from "../../../packages/course-schema/src";

const saveVersion = "0.1.0";
const localSaveKey = "courseforge.projectSave.v0";

type CourseForgeProjectSave = {
  saveVersion: typeof saveVersion;
  savedAt: string;
  project: CourseProject;
  selectedCourseId: string;
  selectedImportedCourseMetadata: CourseMetadata | null;
  autoBuilderOpen: boolean;
  draftHolePlan: DraftHolePlan | null;
  activeTracingHoleNumber: number | null;
  currentTraceDraft: DraftHoleTrace;
  traceStep: "tee" | "centerline" | "green" | "review";
  boundaryDraftPoints: Array<{ latitude: number; longitude: number }>;
  generatedGeometryVisible: boolean;
  generatedGeometryStale: boolean;
};

const mockCourses: CourseProject[] = [
  {
    id: "cherry-hill-fort-wayne",
    name: "Cherry Hill Golf Club",
    city: "Fort Wayne",
    region: "IN",
    location: {
      latitude: 41.1942,
      longitude: -85.0477,
      elevationMeters: 250
    },
    confidence: 0.88,
    status: {
      courseConfirmed: false,
      locationConfirmed: false,
      boundaryConfirmed: false,
      scorecardConfirmed: false,
      holesTraced: false,
      elevationGenerated: false,
      packageExported: false
    }
  },
  {
    id: "sycamore-hills-fort-wayne",
    name: "Sycamore Hills Golf Club",
    city: "Fort Wayne",
    region: "IN",
    location: {
      latitude: 41.068,
      longitude: -85.3114,
      elevationMeters: 245
    },
    confidence: 0.82,
    status: {
      courseConfirmed: false,
      locationConfirmed: false,
      boundaryConfirmed: false,
      scorecardConfirmed: false,
      holesTraced: false,
      elevationGenerated: false,
      packageExported: false
    }
  },
  {
    id: "bridgewater-auburn",
    name: "Bridgewater Golf Club",
    city: "Auburn",
    region: "IN",
    location: {
      latitude: 41.3378,
      longitude: -85.0465,
      elevationMeters: 265
    },
    confidence: 0.76,
    status: {
      courseConfirmed: false,
      locationConfirmed: false,
      boundaryConfirmed: false,
      scorecardConfirmed: false,
      holesTraced: false,
      elevationGenerated: false,
      packageExported: false
    }
  }
];

const initialStatus: CourseProjectStatus = {
  courseConfirmed: false,
  locationConfirmed: false,
  boundaryConfirmed: false,
  scorecardConfirmed: false,
  holesTraced: false,
  elevationGenerated: false,
  packageExported: false
};

function createMockBoundary(course: CourseProject): CourseBoundary {
  const offset = 0.006;
  const { latitude, longitude } = course.location;

  return {
    type: "Polygon",
    source: "auto",
    confidence: 0.65,
    coordinates: [
      [
        [longitude - offset, latitude - offset],
        [longitude + offset, latitude - offset],
        [longitude + offset, latitude + offset],
        [longitude - offset, latitude + offset],
        [longitude - offset, latitude - offset]
      ]
    ]
  };
}

function createManualBoundary(points: Array<{ latitude: number; longitude: number }>): CourseBoundary {
  const coordinateRing = points.map((point) => [point.longitude, point.latitude] as [
    longitude: number,
    latitude: number
  ]);
  const firstPoint = coordinateRing[0];
  const lastPoint = coordinateRing[coordinateRing.length - 1];
  const isClosed = firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1];

  return {
    type: "Polygon",
    source: "manual",
    confidence: 1,
    coordinates: [isClosed ? coordinateRing : [...coordinateRing, firstPoint]]
  };
}

function createEmptyTrace(): DraftHoleTrace {
  return {
    centerlinePoints: [],
    source: "manual",
    confidence: 0.35
  };
}

function hasSavedOrApprovedTrace(hole: DraftHole) {
  return Boolean(hole.trace && (hole.status === "trace saved" || hole.status === "approved" || hole.status === "needs review"));
}

function isCourseForgeProjectSave(value: unknown): value is CourseForgeProjectSave {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CourseForgeProjectSave>;

  return candidate.saveVersion === saveVersion && Boolean(candidate.project?.id && candidate.project.name);
}

function readLocalProjectSave() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSave = window.localStorage.getItem(localSaveKey);

  if (!rawSave) {
    return null;
  }

  try {
    const parsedSave: unknown = JSON.parse(rawSave);

    return isCourseForgeProjectSave(parsedSave) ? parsedSave : null;
  } catch {
    return null;
  }
}

function safeProjectFileName(projectName: string) {
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function formatSavedAt(savedAt: string) {
  return `Last saved ${new Date(savedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

export default function Home() {
  const [selectedCourseId, setSelectedCourseId] = useState(mockCourses[0].id);
  const [currentProject, setCurrentProject] = useState<CourseProject | null>(null);
  const [isAdjustingLocation, setIsAdjustingLocation] = useState(false);
  const [isDrawingBoundary, setIsDrawingBoundary] = useState(false);
  const [boundaryDraftPoints, setBoundaryDraftPoints] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [selectedImportedCourseMetadata, setSelectedImportedCourseMetadata] =
    useState<CourseMetadata | null>(null);
  const [autoBuilderOpen, setAutoBuilderOpen] = useState(false);
  const [draftHolePlan, setDraftHolePlan] = useState<DraftHolePlan | null>(null);
  const [activeTracingHoleNumber, setActiveTracingHoleNumber] = useState<number | null>(null);
  const [tracingModeActive, setTracingModeActive] = useState(false);
  const [traceStep, setTraceStep] = useState<"tee" | "centerline" | "green" | "review">("tee");
  const [currentTraceDraft, setCurrentTraceDraft] = useState<DraftHoleTrace>(createEmptyTrace);
  const [draftMessage, setDraftMessage] = useState("");
  const [clientSaveReady, setClientSaveReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("Not saved yet");
  const [savedProjectExists, setSavedProjectExists] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [importError, setImportError] = useState("");
  const [generatedGeometryVisible, setGeneratedGeometryVisible] = useState(true);
  const [elevationSamplesVisible, setElevationSamplesVisible] = useState(false);
  const [generatedGeometryStale, setGeneratedGeometryStale] = useState(false);
  const [holeTraceReviewMode, setHoleTraceReviewMode] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const selectedMockCourse = useMemo(
    () => mockCourses.find((course) => course.id === selectedCourseId) ?? mockCourses[0],
    [selectedCourseId]
  );
  const activeCourse = currentProject ?? selectedMockCourse;

  const projectStatus = currentProject?.status ?? initialStatus;
  const focusedTracingMode = Boolean(autoBuilderOpen && draftHolePlan);
  const traceProgress = getHoleTraceProgress(draftHolePlan);
  const tracedHoleCount = traceProgress.traced;
  const approvedHoleCount = traceProgress.approved;
  const remainingHoleCount = traceProgress.remaining;
  const activeHoleStatus =
    draftHolePlan?.holes.find((hole) => hole.holeNumber === activeTracingHoleNumber)?.status ?? "none";
  const allHolesTraced = Boolean(draftHolePlan?.holes.length && tracedHoleCount === draftHolePlan.holes.length);
  const generatedGeometryHoleCount = currentProject?.generatedGeometry?.holes.length ?? 0;
  const generatedGeometryExists = generatedGeometryHoleCount > 0;
  const coursePackageReadiness = validateCoursePackageReadiness(
    currentProject,
    draftHolePlan,
    generatedGeometryStale
  );
  const elevationSamplesCanDisplay =
    currentProject?.elevationModel !== undefined &&
    currentProject.elevationModel.status !== "stale" &&
    elevationSamplesVisible;

  const buildProjectSave = (savedAt = new Date().toISOString()): CourseForgeProjectSave | null => {
    if (!currentProject) {
      return null;
    }

    return {
      saveVersion,
      savedAt,
      project: currentProject,
      selectedCourseId,
      selectedImportedCourseMetadata,
      autoBuilderOpen,
      draftHolePlan,
      activeTracingHoleNumber,
      currentTraceDraft,
      traceStep,
      boundaryDraftPoints,
      generatedGeometryVisible,
      generatedGeometryStale
    };
  };

  const applyProjectSave = (save: CourseForgeProjectSave) => {
    setCurrentProject(save.project);
    setSelectedCourseId(save.selectedCourseId || mockCourses[0].id);
    setSelectedImportedCourseMetadata(save.selectedImportedCourseMetadata);
    setAutoBuilderOpen(save.autoBuilderOpen);
    setDraftHolePlan(save.draftHolePlan);
    setActiveTracingHoleNumber(save.activeTracingHoleNumber);
    setCurrentTraceDraft(save.currentTraceDraft ?? createEmptyTrace());
    setTraceStep(save.traceStep ?? "tee");
    setBoundaryDraftPoints(save.boundaryDraftPoints ?? []);
    setGeneratedGeometryVisible(save.generatedGeometryVisible ?? true);
    setGeneratedGeometryStale(save.generatedGeometryStale ?? false);
    setIsAdjustingLocation(false);
    setIsDrawingBoundary(false);
    setTracingModeActive(false);
    setDraftMessage("Saved project restored.");
    setLastSavedAt(save.savedAt);
    setSaveStatus(formatSavedAt(save.savedAt));
  };

  const persistProjectSave = (save: CourseForgeProjectSave) => {
    localStorage.setItem(localSaveKey, JSON.stringify(save));
    setLastSavedAt(save.savedAt);
    setSavedProjectExists(true);
    setSaveStatus(formatSavedAt(save.savedAt));
  };

  const handleManualSaveProject = () => {
    const save = buildProjectSave();

    if (!save) {
      return;
    }

    setSaveStatus("Saving...");
    persistProjectSave(save);
  };

  const handleResumeSavedProject = () => {
    const rawSave = localStorage.getItem(localSaveKey);

    if (!rawSave) {
      setShowResumePrompt(false);
      setSavedProjectExists(false);
      return;
    }

    try {
      const parsedSave: unknown = JSON.parse(rawSave);

      if (isCourseForgeProjectSave(parsedSave)) {
        applyProjectSave(parsedSave);
        setShowResumePrompt(false);
        setSavedProjectExists(true);
        return;
      }
    } catch {
      // Fall through to a friendly reset state below.
    }

    localStorage.removeItem(localSaveKey);
    setShowResumePrompt(false);
    setSavedProjectExists(false);
    setImportError("Saved project could not be read, so it was cleared.");
  };

  const handleStartNewProject = () => {
    localStorage.removeItem(localSaveKey);
    setCurrentProject(null);
    setSelectedCourseId(mockCourses[0].id);
    setSelectedImportedCourseMetadata(null);
    setIsAdjustingLocation(false);
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setActiveTracingHoleNumber(null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setDraftMessage("");
    setLastSavedAt(null);
    setSavedProjectExists(false);
    setShowResumePrompt(false);
    setSaveStatus("Not saved yet");
    setGeneratedGeometryVisible(true);
    setGeneratedGeometryStale(false);
  };

  const handleExportProject = () => {
    const save = buildProjectSave();

    if (!save) {
      return;
    }

    const projectSlug = safeProjectFileName(save.project.name) || "project";
    const dateSlug = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(save, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `courseforge-${projectSlug}-${dateSlug}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCoursePackage = () => {
    if (!currentProject || !coursePackageReadiness.canExport) {
      return;
    }

    const exportedAt = new Date().toISOString();
    const coursePackage = buildCoursePackage(
      currentProject,
      draftHolePlan,
      generatedGeometryStale,
      exportedAt
    );
    const projectSlug = safeProjectFileName(currentProject.name) || "project";
    const dateSlug = exportedAt.slice(0, 10);
    const blob = new Blob([JSON.stringify(coursePackage, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `courseforge-package-${projectSlug}-${dateSlug}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setCurrentProject({
      ...currentProject,
      status: {
        ...currentProject.status,
        packageExported: true
      }
    });
    setDraftMessage("Preview JSON exported. This is a neutral preview artifact, not simulator-ready output or an Unreal import.");
  };

  const handleImportProject = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsedSave: unknown = JSON.parse(String(reader.result));

        if (!isCourseForgeProjectSave(parsedSave)) {
          setImportError("This does not look like a CourseForge project file.");
          return;
        }

        applyProjectSave(parsedSave);
        persistProjectSave({
          ...parsedSave,
          savedAt: new Date().toISOString()
        });
        setShowResumePrompt(false);
        setImportError("");
      } catch {
        setImportError("This does not look like a CourseForge project file.");
      }
    };

    reader.readAsText(file);
  };

  const selectReviewHole = (hole: DraftHole) => {
    setActiveTracingHoleNumber(hole.holeNumber);
    setCurrentTraceDraft(hole.trace ?? createEmptyTrace());
    setTracingModeActive(false);
    setTraceStep("review");
  };

  const handleReviewHoleTraces = () => {
    if (!draftHolePlan) {
      setDraftMessage("Create a draft hole plan and save a trace before starting review.");
      return;
    }

    const reviewHole = findReviewStartHole(draftHolePlan, activeTracingHoleNumber);

    if (!reviewHole) {
      setHoleTraceReviewMode(false);
      setDraftMessage("No saved hole traces are available to review yet.");
      return;
    }

    selectReviewHole(reviewHole);
    setHoleTraceReviewMode(true);
    setDraftMessage(`Reviewing hole ${reviewHole.holeNumber}. Approve it or reopen it for editing.`);
  };

  const handleExitHoleTraceReview = () => {
    setHoleTraceReviewMode(false);
    setDraftMessage("Hole trace review closed.");
  };

  const handleMoveSavedTrace = (direction: "previous" | "next") => {
    if (!draftHolePlan) {
      return;
    }

    const reviewHole = findAdjacentSavedTrace(draftHolePlan, activeTracingHoleNumber, direction);

    if (!reviewHole) {
      setDraftMessage(`No ${direction} saved trace is available.`);
      return;
    }

    selectReviewHole(reviewHole);
    setDraftMessage(`Reviewing hole ${reviewHole.holeNumber}.`);
  };

  const handleNextTraceNeedingReview = () => {
    if (!draftHolePlan) {
      return;
    }

    const reviewHole = findNextTraceNeedingReview(draftHolePlan, activeTracingHoleNumber);

    if (!reviewHole) {
      setDraftMessage("Every saved hole trace is approved.");
      return;
    }

    selectReviewHole(reviewHole);
    setDraftMessage(`Hole ${reviewHole.holeNumber} is the next trace needing review.`);
  };

  const handleGenerateBasicGeometry = () => {
    if (!currentProject || !draftHolePlan) {
      return;
    }

    const generatedGeometry = generateBasicCourseGeometry(draftHolePlan);

    if (generatedGeometry.holes.length === 0) {
      setDraftMessage("Trace and save at least one hole before generating geometry.");
      return;
    }

    setCurrentProject({
      ...currentProject,
      generatedGeometry
    });
    setGeneratedGeometryVisible(true);
    setGeneratedGeometryStale(false);
    setDraftMessage(
      generatedGeometry.holes.length === draftHolePlan.holes.length
        ? "Basic geometry preview generated from traces. Review visually before future course package export."
        : `Generated geometry for ${generatedGeometry.holes.length} of ${draftHolePlan.holes.length} holes.`
    );
  };

  const handleGenerateElevationProfile = async (source: "mock" | "google_elevation" | "copernicus_glo30") => {
    if (!currentProject) {
      setDraftMessage("Confirm a course before generating elevation.");
      return;
    }

    if (source === "copernicus_glo30") {
      setDraftMessage("Fetching Copernicus GLO-30 terrain… this can take a moment.");
    }

    try {
      const response = await fetch("/api/elevation/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project: currentProject,
          draftHolePlan,
          source
        })
      });
      const data = (await response.json()) as CourseElevationModel | { error?: string };
      const errorMessage = "error" in data ? data.error : undefined;

      if (!response.ok || errorMessage) {
        setDraftMessage(errorMessage ?? "Elevation profile could not be generated.");
        return;
      }

      setCurrentProject({
        ...currentProject,
        elevationModel: data as CourseElevationModel,
        status: {
          ...currentProject.status,
          elevationGenerated: true
        }
      });
      setDraftMessage(
        source === "google_elevation"
          ? "Google Elevation samples generated. No terrain heightmap is generated yet."
          : source === "copernicus_glo30"
            ? "Copernicus GLO-30 heightmap generated from open DEM data (© Copernicus/ESA)."
            : "Mock elevation profile generated. This is sample data only, not real terrain/topology."
      );
    } catch {
      setDraftMessage("Elevation profile could not be generated right now.");
    }
  };

  const handleGenerateMockElevationProfile = () => {
    void handleGenerateElevationProfile("mock");
  };

  const handleGenerateGoogleElevationProfile = () => {
    void handleGenerateElevationProfile("google_elevation");
  };

  const handleGenerateCopernicusElevationProfile = () => {
    void handleGenerateElevationProfile("copernicus_glo30");
  };

  const handleToggleGeneratedGeometry = () => {
    setGeneratedGeometryVisible((visible) => !visible);
  };

  const handleToggleElevationSamples = () => {
    setElevationSamplesVisible((visible) => !visible);
  };

  const markGeneratedGeometryStale = () => {
    if (!currentProject?.generatedGeometry && !currentProject?.elevationModel) {
      return;
    }

    setGeneratedGeometryStale(true);
    setCurrentProject((project) => (project ? markElevationModelStale(project) : project));
  };

  useEffect(() => {
    const loadSavedProject = window.setTimeout(() => {
      const savedProject = readLocalProjectSave();

      if (savedProject) {
        setLastSavedAt(savedProject.savedAt);
        setSaveStatus(formatSavedAt(savedProject.savedAt));
        setSavedProjectExists(true);
        setShowResumePrompt(true);
      }

      setClientSaveReady(true);
    }, 0);

    return () => {
      window.clearTimeout(loadSavedProject);
    };
  }, []);

  useEffect(() => {
    if (!clientSaveReady || !currentProject) {
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const save: CourseForgeProjectSave = {
        saveVersion,
        savedAt,
        project: currentProject,
        selectedCourseId,
        selectedImportedCourseMetadata,
        autoBuilderOpen,
        draftHolePlan,
        activeTracingHoleNumber,
        currentTraceDraft,
        traceStep,
        boundaryDraftPoints,
        generatedGeometryVisible,
        generatedGeometryStale
      };

      setSaveStatus("Saving...");
      localStorage.setItem(localSaveKey, JSON.stringify(save));
      setLastSavedAt(save.savedAt);
      setSavedProjectExists(true);
      setSaveStatus(formatSavedAt(save.savedAt));
    }, 350);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    activeTracingHoleNumber,
    autoBuilderOpen,
    boundaryDraftPoints,
    clientSaveReady,
    currentProject,
    currentTraceDraft,
    draftHolePlan,
    generatedGeometryStale,
    generatedGeometryVisible,
    selectedCourseId,
    selectedImportedCourseMetadata,
    traceStep
  ]);

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setIsAdjustingLocation(false);
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setActiveTracingHoleNumber(null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setDraftMessage("");

    setCurrentProject((project) => {
      if (!project || project.status.boundaryConfirmed) {
        return project;
      }

      return {
        ...project,
        boundary: undefined,
        status: {
          ...project.status,
          boundaryConfirmed: false
        }
      };
    });
  };

  const handleUseCourse = () => {
    setCurrentProject({
      ...selectedMockCourse,
      source: "mock-map-selection",
      originalLocation: selectedMockCourse.location,
      locationSource: "mock",
      status: {
        ...initialStatus,
        courseConfirmed: true
      },
      boundary: undefined
    });
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setActiveTracingHoleNumber(null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setGeneratedGeometryVisible(true);
    setGeneratedGeometryStale(false);
    setDraftMessage("");
  };

  const handleUseImportedCourse = (metadata: CourseMetadata) => {
    const importedCourseId = `${metadata.providerId}:${metadata.providerCourseId}`;

    setCurrentProject((project) => {
      const canKeepBoundary =
        project?.id === importedCourseId && project.status.boundaryConfirmed && project.boundary;

      return {
        id: importedCourseId,
        name: metadata.name,
        city: metadata.address?.city ?? "Unknown city",
        region: metadata.address?.state ?? metadata.address?.country ?? "Unknown region",
        location: {
          latitude: metadata.location?.lat ?? project?.location.latitude ?? selectedMockCourse.location.latitude,
          longitude: metadata.location?.lng ?? project?.location.longitude ?? selectedMockCourse.location.longitude
        },
        originalLocation: metadata.location
          ? {
              latitude: metadata.location.lat,
              longitude: metadata.location.lng
            }
          : project?.originalLocation,
        locationSource: metadata.location ? "provider" : project?.locationSource ?? "mock",
        confidence: 1,
        source: "provider-import",
        providerId: metadata.providerId,
        providerCourseId: metadata.providerCourseId,
        importedMetadata: metadata,
        scorecard: metadata.scorecard,
        geometryStatus: metadata.geometryStatus,
        holesCount: metadata.holesCount,
        status: {
          ...initialStatus,
          courseConfirmed: true,
          locationConfirmed: false,
          scorecardConfirmed: Boolean(project?.id === importedCourseId && project.status.scorecardConfirmed),
          boundaryConfirmed: Boolean(canKeepBoundary)
        },
        boundary: canKeepBoundary ? project.boundary : undefined
      };
    });
    setSelectedImportedCourseMetadata(metadata);
    setIsAdjustingLocation(false);
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setActiveTracingHoleNumber(null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setGeneratedGeometryVisible(true);
    setGeneratedGeometryStale(false);
    setDraftMessage(metadata.location ? "" : "Imported course has no map location yet, so the map stayed near the current course.");
  };

  const handleAutoBoundary = () => {
    if (!currentProject?.status.courseConfirmed) {
      return;
    }

    if (!currentProject.status.locationConfirmed) {
      setDraftMessage("Confirm the course marker before using Auto Boundary.");
      return;
    }

    setCurrentProject(markElevationModelStale({
      ...currentProject,
      boundary: createMockBoundary(currentProject),
      status: {
        ...currentProject.status,
        boundaryConfirmed: true
      }
    }));
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setActiveTracingHoleNumber(null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setGeneratedGeometryStale(false);
    setDraftMessage("");
  };

  const handleStartManualBoundary = () => {
    if (!currentProject?.status.courseConfirmed || currentProject.id !== activeCourse.id) {
      return;
    }

    if (!currentProject.status.locationConfirmed) {
      setDraftMessage("Confirm the course marker before drawing the boundary.");
      return;
    }

    setIsAdjustingLocation(false);
    setTracingModeActive(false);
    setIsDrawingBoundary(true);
    setBoundaryDraftPoints([]);
    setDraftMessage("");
  };

  const handleConfirmLocation = () => {
    if (!currentProject) {
      return;
    }

    setCurrentProject({
      ...currentProject,
      status: {
        ...currentProject.status,
        locationConfirmed: true
      }
    });
    setIsAdjustingLocation(false);
    setBoundaryDraftPoints([]);
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setDraftMessage("");
  };

  const handleStartAdjustLocation = () => {
    if (!currentProject?.status.courseConfirmed) {
      return;
    }

    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setTracingModeActive(false);
    setIsAdjustingLocation(true);
    setDraftMessage("");
  };

  const handleAdjustLocation = (point: { latitude: number; longitude: number }) => {
    if (!isAdjustingLocation || !currentProject) {
      return;
    }

    const hadBoundary = Boolean(currentProject.boundary);

    setCurrentProject({
      ...currentProject,
      location: {
        ...currentProject.location,
        latitude: point.latitude,
        longitude: point.longitude
      },
      locationSource: "user_adjusted",
      boundary: undefined,
      elevationModel: undefined,
      status: {
        ...currentProject.status,
        locationConfirmed: false,
        boundaryConfirmed: false,
        elevationGenerated: false
      }
    });
    setIsAdjustingLocation(false);
    setBoundaryDraftPoints([]);
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setActiveTracingHoleNumber(null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setDraftMessage(
      hadBoundary
        ? "Location updated. The previous boundary was cleared so it can be redrawn around the corrected marker."
        : "Location updated. Confirm the marker when it looks right."
    );
  };

  const handleAddBoundaryPoint = (point: { latitude: number; longitude: number }) => {
    if (!isDrawingBoundary || !currentProject || currentProject.id !== activeCourse.id) {
      return;
    }

    setBoundaryDraftPoints((points) => [...points, point]);
  };

  const handleMoveBoundaryDraftPoint = (index: number, point: { latitude: number; longitude: number }) => {
    setBoundaryDraftPoints((points) =>
      points.map((existingPoint, pointIndex) => (pointIndex === index ? point : existingPoint))
    );
  };

  const handleMoveSavedBoundaryPoint = (index: number, point: { latitude: number; longitude: number }) => {
    setCurrentProject((project) => {
      if (!project?.boundary) {
        return project;
      }

      const ring = project.boundary.coordinates[0].slice();
      ring[index] = [point.longitude, point.latitude];

      if (index === 0 || index === ring.length - 1) {
        ring[0] = [point.longitude, point.latitude];
        ring[ring.length - 1] = [point.longitude, point.latitude];
      } else {
        ring[ring.length - 1] = ring[0];
      }

      return {
        ...markElevationModelStale(project),
        boundary: {
          ...project.boundary,
          coordinates: [ring]
        }
      };
    });
  };

  const handleConfirmBoundary = () => {
    if (!currentProject || boundaryDraftPoints.length < 3) {
      return;
    }

    setCurrentProject(markElevationModelStale({
      ...currentProject,
      boundary: createManualBoundary(boundaryDraftPoints),
      status: {
        ...currentProject.status,
        boundaryConfirmed: true
      }
    }));
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setActiveTracingHoleNumber(null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setDraftMessage("");
  };

  const handleClearBoundary = () => {
    setBoundaryDraftPoints([]);
    setDraftMessage("");
    setCurrentProject((project) => {
      if (!project) {
        return project;
      }

      return {
        ...project,
        boundary: undefined,
        elevationModel: undefined,
        status: {
          ...project.status,
          boundaryConfirmed: false,
          elevationGenerated: false
        }
      };
    });
    setAutoBuilderOpen(false);
    setDraftHolePlan(null);
    setActiveTracingHoleNumber(null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setGeneratedGeometryStale(false);
  };

  const handleCancelDrawing = () => {
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setDraftMessage("");
  };

  const handleConfirmScorecard = () => {
    if (!currentProject?.scorecard) {
      return;
    }

    setCurrentProject({
      ...currentProject,
      status: {
        ...currentProject.status,
        scorecardConfirmed: true
      }
    });
    setDraftMessage("");
  };

  const handleClearScorecardConfirmation = () => {
    if (!currentProject) {
      return;
    }

    setCurrentProject({
      ...currentProject,
      status: {
        ...currentProject.status,
        scorecardConfirmed: false
      }
    });
    setDraftMessage("Scorecard marked for review. Verified scorecards will improve the next draft course generation step.");
  };

  const handleOpenAutoBuilder = () => {
    if (!currentProject?.status.courseConfirmed) {
      setDraftMessage("Confirm a course before opening Satellite Auto-Builder.");
      return;
    }

    if (!currentProject.status.locationConfirmed) {
      setDraftMessage("Confirm the course marker before opening Satellite Auto-Builder.");
      return;
    }

    if (!currentProject.status.boundaryConfirmed) {
      setDraftMessage("Confirm or draw a boundary before opening Satellite Auto-Builder.");
      return;
    }

    setAutoBuilderOpen(true);
    setDraftMessage("");
  };

  const handleGenerateDraftHolePlan = () => {
    if (!currentProject) {
      return;
    }

    const scorecardHoles = currentProject.scorecard?.holes;
    const placeholderCount = currentProject.scorecard?.holes.length || currentProject.holesCount || 18;
    const holes =
      scorecardHoles?.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        yardagesByTee: hole.yardagesByTee,
        status: "needs tracing" as const,
        confidence: "low" as const
      })) ??
      Array.from({ length: placeholderCount }, (_, index) => ({
        holeNumber: index + 1,
        status: "needs tracing" as const,
        confidence: "low" as const
      }));

    setDraftHolePlan({
      generatedAt: new Date().toISOString(),
      source: scorecardHoles ? "scorecard" : "placeholder",
      holes
    });
    setActiveTracingHoleNumber(holes[0]?.holeNumber ?? null);
    setTracingModeActive(false);
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    setDraftMessage("Draft hole plan created. These are planning rows only, not traced geometry.");
  };

  const handleSelectDraftHole = (holeNumber: number) => {
    const selectedHole = draftHolePlan?.holes.find((hole) => hole.holeNumber === holeNumber);

    if (holeTraceReviewMode && !selectedHole?.trace) {
      setDraftMessage(`Hole ${holeNumber} has no saved trace to review.`);
      return;
    }

    setActiveTracingHoleNumber(holeNumber);
    const savedTrace = selectedHole?.trace;
    setCurrentTraceDraft(savedTrace ?? createEmptyTrace());
    setTracingModeActive(false);
    setTraceStep(savedTrace?.greenPoint ? "review" : "tee");
    setDraftMessage("");
  };

  const handleStartHoleTrace = (holeNumber: number) => {
    const savedTrace = draftHolePlan?.holes.find((hole) => hole.holeNumber === holeNumber)?.trace;
    setActiveTracingHoleNumber(holeNumber);
    setCurrentTraceDraft(savedTrace ?? createEmptyTrace());
    setTracingModeActive(true);
    setTraceStep(savedTrace?.greenPoint ? "review" : "tee");
    setIsAdjustingLocation(false);
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setDraftMessage("Click the tee, add any bend points, then mark the green.");
    if (savedTrace) {
      markGeneratedGeometryStale();
    }
    setDraftHolePlan((plan) =>
      {
        if (!plan) {
          return plan;
        }

        const holes = plan.holes.map((hole) =>
          hole.holeNumber === holeNumber ? { ...hole, status: hole.trace ? "needs review" as const : "tracing" as const } : hole
        );

        updateHolesTracedStatus(holes);

        return {
          ...plan,
          holes
        };
      }
    );
  };

  const updateHolesTracedStatus = (holes: DraftHole[]) => {
    const allSavedOrApproved = Boolean(holes.length && holes.every(hasSavedOrApprovedTrace));

    setCurrentProject((project) =>
      project
        ? {
            ...project,
            status: {
              ...project.status,
              holesTraced: allSavedOrApproved
            }
          }
        : project
    );

    return allSavedOrApproved;
  };

  const handleApproveTrace = () => {
    if (!activeTracingHoleNumber) {
      return;
    }

    let approvedAllHoles = false;

    setDraftHolePlan((plan) => {
      if (!plan) {
        return plan;
      }

      const activeHole = plan.holes.find((hole) => hole.holeNumber === activeTracingHoleNumber);

      if (!activeHole?.trace) {
        return plan;
      }

      const updatedPlan = approveHoleTrace(plan, activeTracingHoleNumber);
      const holes = updatedPlan.holes;

      approvedAllHoles = updateHolesTracedStatus(holes);

      return updatedPlan;
    });
    setTracingModeActive(false);
    setTraceStep("review");
    setDraftMessage(
      approvedAllHoles
        ? "All holes have traces. Continue review until each saved trace is approved."
        : `Hole ${activeTracingHoleNumber} trace approved.`
    );
  };

  const handleEditTrace = () => {
    if (!activeTracingHoleNumber) {
      return;
    }

    const savedTrace = draftHolePlan?.holes.find((hole) => hole.holeNumber === activeTracingHoleNumber)?.trace;

    if (!savedTrace) {
      handleStartHoleTrace(activeTracingHoleNumber);
      return;
    }

    setCurrentTraceDraft(savedTrace);
    setHoleTraceReviewMode(false);
    markGeneratedGeometryStale();
    setTracingModeActive(true);
    setTraceStep(savedTrace.greenPoint ? "review" : savedTrace.teePoint ? "centerline" : "tee");
    setIsAdjustingLocation(false);
    setIsDrawingBoundary(false);
    setBoundaryDraftPoints([]);
    setDraftHolePlan((plan) =>
      {
        if (!plan) {
          return plan;
        }

        const holes = plan.holes.map((hole) =>
          hole.holeNumber === activeTracingHoleNumber ? { ...hole, status: "needs review" as const } : hole
        );

        updateHolesTracedStatus(holes);

        return {
          ...plan,
          holes
        };
      }
    );
    setDraftMessage(`Editing hole ${activeTracingHoleNumber}. Save the trace again when it looks right.`);
  };

  const handleClearHoleTrace = () => {
    if (!activeTracingHoleNumber) {
      return;
    }

    setDraftHolePlan((plan) => {
      if (!plan) {
        return plan;
      }

      const holes = plan.holes.map((hole) =>
        hole.holeNumber === activeTracingHoleNumber
          ? {
              ...hole,
              status: "needs tracing" as const,
              trace: undefined
            }
          : hole
      );

      updateHolesTracedStatus(holes);

      return {
        ...plan,
        holes
      };
    });
    setCurrentTraceDraft(createEmptyTrace());
    setTracingModeActive(false);
    setTraceStep("tee");
    setDraftMessage(`Hole ${activeTracingHoleNumber} trace cleared.`);
    markGeneratedGeometryStale();
  };

  const handleNextUntracedHole = () => {
    if (!draftHolePlan?.holes.length) {
      return;
    }

    const activeIndex = Math.max(
      draftHolePlan.holes.findIndex((hole) => hole.holeNumber === activeTracingHoleNumber),
      0
    );
    const orderedHoles = [
      ...draftHolePlan.holes.slice(activeIndex + 1),
      ...draftHolePlan.holes.slice(0, activeIndex + 1)
    ];
    const nextHole = orderedHoles.find((hole) => !hasSavedOrApprovedTrace(hole));

    if (!nextHole) {
      setDraftMessage("All holes have traces. Next: review traces, then generate basic course geometry.");
      return;
    }

    handleSelectDraftHole(nextHole.holeNumber);
  };

  const handleSetTraceGreenStep = () => {
    if (!currentTraceDraft.teePoint) {
      setDraftMessage("Place the tee point first, then set the green.");
      return;
    }

    setTraceStep("green");
    setDraftMessage("Next map click will mark the green.");
  };

  const handleAddTracePoint = (point: { latitude: number; longitude: number }) => {
    if (!tracingModeActive || !activeTracingHoleNumber) {
      return;
    }

    if (traceStep === "tee") {
      setCurrentTraceDraft({
        ...currentTraceDraft,
        teePoint: point
      });
      markGeneratedGeometryStale();
      setTraceStep("centerline");
      setDraftMessage("Tee set. Add bend points, or choose Set Next Click as Green.");
      return;
    }

    if (traceStep === "green") {
      setCurrentTraceDraft({
        ...currentTraceDraft,
        greenPoint: point
      });
      markGeneratedGeometryStale();
      setTraceStep("review");
      setDraftMessage("Green set. Save the hole trace when it looks right.");
      return;
    }

    if (traceStep === "centerline") {
      if (currentTraceDraft.centerlinePoints.length >= 6) {
        setDraftMessage("Maximum 6 bend points reached.");
        return;
      }

      setCurrentTraceDraft({
        ...currentTraceDraft,
        centerlinePoints: [...currentTraceDraft.centerlinePoints, point]
      });
      markGeneratedGeometryStale();
    }
  };

  const handleMoveTracePoint = (
    pointType: "tee" | "centerline" | "green",
    point: { latitude: number; longitude: number },
    index?: number
  ) => {
    if (pointType === "tee") {
      setCurrentTraceDraft((trace) => ({
        ...trace,
        teePoint: point
      }));
      markGeneratedGeometryStale();
      return;
    }

    if (pointType === "green") {
      setCurrentTraceDraft((trace) => ({
        ...trace,
        greenPoint: point
      }));
      markGeneratedGeometryStale();
      return;
    }

    setCurrentTraceDraft((trace) => ({
      ...trace,
      centerlinePoints: trace.centerlinePoints.map((existingPoint, pointIndex) =>
        pointIndex === index ? point : existingPoint
      )
    }));
    markGeneratedGeometryStale();
  };

  const handleClearCurrentTrace = () => {
    setCurrentTraceDraft(createEmptyTrace());
    setTraceStep("tee");
    markGeneratedGeometryStale();
    setDraftMessage("Current trace cleared. Click the tee to start again.");
  };

  const handleCancelHoleTracing = () => {
    const savedTrace = draftHolePlan?.holes.find((hole) => hole.holeNumber === activeTracingHoleNumber)?.trace;
    setTracingModeActive(false);
    setCurrentTraceDraft(savedTrace ?? createEmptyTrace());
    setTraceStep(savedTrace?.greenPoint ? "review" : "tee");
    setDraftMessage("");
  };

  const handleSaveHoleTrace = () => {
    if (!activeTracingHoleNumber || !currentTraceDraft.teePoint || !currentTraceDraft.greenPoint) {
      return;
    }

    setDraftHolePlan((plan) =>
      plan
        ? {
            ...plan,
            holes: plan.holes.map((hole) =>
              hole.holeNumber === activeTracingHoleNumber
                ? {
                    ...hole,
                    status: "trace saved",
                    trace: currentTraceDraft
                  }
                : hole
            )
          }
        : plan
    );
    const updatedHoles =
      draftHolePlan?.holes.map((hole) =>
        hole.holeNumber === activeTracingHoleNumber
          ? {
              ...hole,
              status: "trace saved" as const,
              trace: currentTraceDraft
            }
          : hole
      ) ?? [];
    const nextAllHolesTraced = Boolean(updatedHoles.length && updatedHoles.every((hole) => hole.trace));

    if (nextAllHolesTraced) {
      setCurrentProject((project) =>
        project
          ? {
              ...project,
              status: {
                ...project.status,
                holesTraced: true
              }
            }
          : project
      );
    }

    setTracingModeActive(false);
    setTraceStep("review");
    markGeneratedGeometryStale();
    setDraftMessage(
      nextAllHolesTraced
        ? "All holes have traces. Next: review traces, then generate basic course geometry."
        : `Hole ${activeTracingHoleNumber} trace saved. Select the next hole when ready.`
    );
  };

  return (
    <main className={`app-shell ${focusedTracingMode ? "is-focused-tracing" : ""}`}>
      <CourseSearchPanel
        courses={mockCourses}
        currentProject={currentProject}
        draftMessage={draftMessage}
        focusedTracingMode={focusedTracingMode}
        isDrawingBoundary={isDrawingBoundary}
        isAdjustingLocation={isAdjustingLocation}
        onConfirmScorecard={handleConfirmScorecard}
        onClearScorecardConfirmation={handleClearScorecardConfirmation}
        onSelectedImportedCourseChange={setSelectedImportedCourseMetadata}
        onSelectCourse={handleSelectCourse}
        onUseImportedCourse={handleUseImportedCourse}
        onUseCourse={handleUseCourse}
        selectedCourse={activeCourse}
        selectedImportedCourseMetadata={selectedImportedCourseMetadata}
      />
      <section className="map-workspace" aria-label="Map editing workspace">
        <ProjectStatusMeter currentProject={currentProject} status={projectStatus} />
        <CourseMap
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
          boundaryDraftPoints={boundaryDraftPoints}
          currentProject={currentProject}
          courses={mockCourses}
          elevationSamplesVisible={elevationSamplesCanDisplay}
          activeElevationHoleNumber={activeTracingHoleNumber}
          generatedGeometry={currentProject?.generatedGeometry}
          generatedGeometryVisible={generatedGeometryVisible}
          isAdjustingLocation={isAdjustingLocation}
          isDrawingBoundary={isDrawingBoundary}
          tracingModeActive={tracingModeActive}
          onAddBoundaryPoint={handleAddBoundaryPoint}
          onAdjustLocation={handleAdjustLocation}
          onAddTracePoint={handleAddTracePoint}
          onMoveBoundaryDraftPoint={handleMoveBoundaryDraftPoint}
          onMoveSavedBoundaryPoint={handleMoveSavedBoundaryPoint}
          onMoveTracePoint={handleMoveTracePoint}
          onSelectCourse={handleSelectCourse}
          selectedCourse={activeCourse}
          traceDraft={currentTraceDraft}
        />
        <MapEditingTray
          activeTracingHoleNumber={activeTracingHoleNumber}
          allHolesTraced={allHolesTraced}
          autoBuilderOpen={autoBuilderOpen}
          approvedHoleCount={approvedHoleCount}
          boundaryDraftPointCount={boundaryDraftPoints.length}
          currentProject={currentProject}
          currentTraceDraft={currentTraceDraft}
          draftHolePlan={draftHolePlan}
          draftMessage={draftMessage}
          generatedGeometryExists={generatedGeometryExists}
          generatedGeometryHoleCount={generatedGeometryHoleCount}
          generatedGeometryStale={generatedGeometryStale}
          generatedGeometryVisible={generatedGeometryVisible}
          holeTraceReviewMode={holeTraceReviewMode}
          isAdjustingLocation={isAdjustingLocation}
          isDrawingBoundary={isDrawingBoundary}
          onApproveTrace={handleApproveTrace}
          onAutoBoundary={handleAutoBoundary}
          onCancelDrawing={handleCancelDrawing}
          onCancelHoleTracing={handleCancelHoleTracing}
          onClearHoleTrace={handleClearHoleTrace}
          onClearBoundary={handleClearBoundary}
          onClearCurrentTrace={handleClearCurrentTrace}
          onConfirmBoundary={handleConfirmBoundary}
          onConfirmLocation={handleConfirmLocation}
          onGenerateBasicGeometry={handleGenerateBasicGeometry}
          onGenerateDraftHolePlan={handleGenerateDraftHolePlan}
          onExitHoleTraceReview={handleExitHoleTraceReview}
          onOpenAutoBuilder={handleOpenAutoBuilder}
          onSaveHoleTrace={handleSaveHoleTrace}
          onSelectDraftHole={handleSelectDraftHole}
          onEditTrace={handleEditTrace}
          onNextUntracedHole={handleNextUntracedHole}
          onMoveSavedTrace={handleMoveSavedTrace}
          onNextTraceNeedingReview={handleNextTraceNeedingReview}
          onSetTraceGreenStep={handleSetTraceGreenStep}
          onStartAdjustLocation={handleStartAdjustLocation}
          onStartHoleTrace={handleStartHoleTrace}
          onStartManualBoundary={handleStartManualBoundary}
          onToggleGeneratedGeometry={handleToggleGeneratedGeometry}
          remainingHoleCount={remainingHoleCount}
          traceStep={traceStep}
          tracedHoleCount={tracedHoleCount}
          tracingModeActive={tracingModeActive}
        />
      </section>
      <ProjectStatusRail
        allHolesTraced={allHolesTraced}
        boundaryDraftPointCount={boundaryDraftPoints.length}
        autoBuilderOpen={autoBuilderOpen}
        currentProject={currentProject}
        coursePackageReadiness={coursePackageReadiness}
        draftHolePlanCount={draftHolePlan?.holes.length ?? 0}
        generatedGeometryExists={generatedGeometryExists}
        generatedGeometryGeneratedAt={currentProject?.generatedGeometry?.generatedAt ?? null}
        generatedGeometryHoleCount={generatedGeometryHoleCount}
        generatedGeometrySource={currentProject?.generatedGeometry?.source ?? "none"}
        generatedGeometryVisible={generatedGeometryVisible}
        generatedGeometryStale={generatedGeometryStale}
        elevationSamplesVisible={elevationSamplesCanDisplay}
        approvedHoleCount={approvedHoleCount}
        importError={importError}
        activeTracingHoleNumber={activeTracingHoleNumber}
        activeHoleStatus={activeHoleStatus}
        currentTracePointCount={
          (currentTraceDraft.teePoint ? 1 : 0) +
          currentTraceDraft.centerlinePoints.length +
          (currentTraceDraft.greenPoint ? 1 : 0)
        }
        isAdjustingLocation={isAdjustingLocation}
        isDrawingBoundary={isDrawingBoundary}
        lastSavedAt={lastSavedAt}
        clientSaveReady={clientSaveReady}
        onExportProject={handleExportProject}
        onExportCoursePackage={handleExportCoursePackage}
        onGenerateMockElevationProfile={handleGenerateMockElevationProfile}
        onGenerateGoogleElevationProfile={handleGenerateGoogleElevationProfile}
        onGenerateCopernicusElevationProfile={handleGenerateCopernicusElevationProfile}
        onGenerateBasicGeometry={handleGenerateBasicGeometry}
        onToggleElevationSamples={handleToggleElevationSamples}
        onImportProject={handleImportProject}
        onReviewHoleTraces={handleReviewHoleTraces}
        onResumeSavedProject={handleResumeSavedProject}
        onSaveProject={handleManualSaveProject}
        onStartNewProject={handleStartNewProject}
        savedProjectExists={savedProjectExists}
        saveStatus={saveStatus}
        saveVersion={saveVersion}
        showResumePrompt={showResumePrompt}
        remainingHoleCount={remainingHoleCount}
        tracedHoleCount={tracedHoleCount}
        tracingModeActive={tracingModeActive}
        selectedCourse={activeCourse}
        status={projectStatus}
      />
    </main>
  );
}
