"use client";

import { useEffect, useMemo, useState } from "react";
import type { CourseDataProviderStatus } from "../lib/course-data/provider-status";
import type { CourseMetadata, CourseSearchResult } from "../lib/course-data/types";

type LoadState = "idle" | "loading" | "error";

function formatLocation(course: CourseMetadata | CourseSearchResult) {
  const isMetadata = "geometryStatus" in course;
  const city = isMetadata ? course.address?.city : course.city;
  const state = isMetadata ? course.address?.state : course.state;
  const country = isMetadata ? course.address?.country : course.country;

  return [city, state, country].filter(Boolean).join(", ") || "Location unknown";
}

function geometryLabel(status: CourseMetadata["geometryStatus"]) {
  if (status === "available") {
    return "Geometry available";
  }

  if (status === "partial") {
    return "Partial geometry";
  }

  return "Geometry missing";
}

type CourseImportPanelProps = {
  onSelectedMetadataChange: (metadata: CourseMetadata | null) => void;
  onUseImportedCourse: (metadata: CourseMetadata) => void;
  selectedMetadata: CourseMetadata | null;
};

export function CourseImportPanel({
  onSelectedMetadataChange,
  onUseImportedCourse,
  selectedMetadata
}: CourseImportPanelProps) {
  const [query, setQuery] = useState("Fort Wayne golf");
  const [results, setResults] = useState<CourseSearchResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [providerStatuses, setProviderStatuses] = useState<CourseDataProviderStatus[]>([]);
  const [searchState, setSearchState] = useState<LoadState>("idle");
  const [metadataState, setMetadataState] = useState<LoadState>("idle");

  const selectedTeeSummary = useMemo(
    () => selectedMetadata?.scorecard?.tees ?? [],
    [selectedMetadata?.scorecard?.tees]
  );
  const providerSummary = useMemo(() => {
    if (providerStatuses.length === 0) {
      return "status loading";
    }

    const mockActive = providerStatuses.some((provider) => provider.id === "mock" && provider.enabled);
    const liveProvidersNeedingKeys = providerStatuses.filter(
      (provider) => provider.id !== "mock" && provider.id !== "osm-overpass" && !provider.enabled
    ).length;
    const osmProvider = providerStatuses.find((provider) => provider.id === "osm-overpass");

    return [
      `Mock ${mockActive ? "active" : "inactive"}`,
      `${liveProvidersNeedingKeys} live providers need keys`,
      osmProvider ? "OSM stub" : null
    ]
      .filter(Boolean)
      .join(" · ");
  }, [providerStatuses]);

  useEffect(() => {
    let active = true;

    async function loadProviderStatuses() {
      try {
        const response = await fetch("/api/courses/providers/status");

        if (!response.ok) {
          throw new Error("Provider status unavailable");
        }

        const statuses = (await response.json()) as CourseDataProviderStatus[];

        if (active) {
          setProviderStatuses(statuses);
        }
      } catch {
        if (active) {
          setProviderStatuses([]);
        }
      }
    }

    loadProviderStatuses();

    return () => {
      active = false;
    };
  }, []);

  const runSearch = async () => {
    setSearchState("loading");
    onSelectedMetadataChange(null);
    setSelectedResultId("");

    try {
      const response = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = (await response.json()) as CourseSearchResult[];
      setResults(data);
      setSearchState("idle");
    } catch {
      setResults([]);
      setSearchState("error");
    }
  };

  const loadMetadata = async (result: CourseSearchResult) => {
    setMetadataState("loading");
    setSelectedResultId(`${result.providerId}:${result.providerCourseId}`);

    try {
      const response = await fetch(
        `/api/courses/${encodeURIComponent(result.providerId)}/${encodeURIComponent(
          result.providerCourseId
        )}`
      );

      if (!response.ok) {
        throw new Error("Metadata failed");
      }

      const data = (await response.json()) as CourseMetadata;
      onSelectedMetadataChange(data);
      setMetadataState("idle");
    } catch {
      onSelectedMetadataChange(null);
      setMetadataState("error");
    }
  };

  return (
    <section className="import-panel" aria-label="Course data provider search">
      <span className="section-label">Course data import</span>
      <p>
        Search normalized provider data. Mock course data is active for this build, and manual
        tracing can continue without live lookup.
      </p>
      <p className="provider-message">
        Live scorecard lookup is not connected yet. GolfCourseAPI and RapidAPI need server-side
        environment variables named GOLFCOURSEAPI_KEY and RAPIDAPI_KEY before they can be enabled;
        keys stay on the server and are never shown in the browser.
      </p>

      <details className="provider-status-details">
        <summary>{`Providers: ${providerSummary}`}</summary>
        <div className="provider-status-list" aria-label="Provider status">
          {providerStatuses.length > 0 ? (
            providerStatuses.map((provider) => (
              <div className="provider-status-row" key={provider.id}>
                <span>
                  <strong>{provider.name}</strong>
                  <small>{provider.capabilities.join(", ")}</small>
                </span>
                <span className={`status-chip ${provider.enabled ? "done" : "pending"}`}>
                  {provider.enabled ? "Active" : provider.reason ?? "Disabled"}
                </span>
              </div>
            ))
          ) : (
            <p className="soft-status">Provider integration ready. Add server-side API configuration to enable live results.</p>
          )}
        </div>
      </details>

      <div className="import-search-row">
        <input
          className="search-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search provider courses"
          type="search"
          value={query}
        />
        <button className="secondary-action compact-action" onClick={runSearch} type="button">
          Search
        </button>
      </div>

      {searchState === "error" ? (
        <p className="inline-message">Provider search is unavailable right now.</p>
      ) : null}

      <div className="provider-results" aria-label="Provider search results">
        {results.map((result) => {
          const resultId = `${result.providerId}:${result.providerCourseId}`;

          return (
            <button
              className={`result-button ${selectedResultId === resultId ? "is-selected" : ""}`}
              key={resultId}
              onClick={() => loadMetadata(result)}
              type="button"
            >
              <span className="result-title-row">
                <span className="result-name">{result.name}</span>
                <span className="confidence-badge medium">{Math.round(result.confidence * 100)}%</span>
              </span>
              <span className="result-location">{formatLocation(result)}</span>
            </button>
          );
        })}
      </div>

      {results.length === 0 && searchState === "idle" ? (
        <p className="soft-status">Run a search to load normalized course metadata.</p>
      ) : null}
      {searchState === "loading" ? <p className="soft-status">Searching providers...</p> : null}
      {metadataState === "loading" ? <p className="soft-status">Loading course metadata...</p> : null}

      {selectedMetadata ? (
        <section className="metadata-card" aria-label="Selected imported course details">
          <div className="summary-row">
            <span className="summary-label">Course</span>
            <span className="summary-value">{selectedMetadata.name}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Location</span>
            <span className="summary-value">{formatLocation(selectedMetadata)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Holes</span>
            <span className="summary-value">{selectedMetadata.holesCount ?? "Unknown"}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Geometry</span>
            <span className={`geometry-chip ${selectedMetadata.geometryStatus}`}>
              {geometryLabel(selectedMetadata.geometryStatus)}
            </span>
          </div>

          {selectedTeeSummary.length > 0 ? (
            <div className="tee-summary">
              <span className="section-label">Tee sets</span>
              {selectedTeeSummary.map((tee) => (
                <div className="tee-row" key={tee.id}>
                  <strong>{tee.name}</strong>
                  <span>{tee.totalYardage ? `${tee.totalYardage} yd` : "Yardage unknown"}</span>
                  <span>
                    {tee.courseRating ? `Rating ${tee.courseRating}` : "Rating n/a"}
                    {tee.slopeRating ? ` / Slope ${tee.slopeRating}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {!selectedMetadata.scorecard ? (
            <p className="inline-message">
              No live scorecard is connected for this provider result yet. You can still verify
              the location, draw the boundary, and trace holes manually.
            </p>
          ) : null}

          {selectedMetadata.geometryStatus === "missing" ? (
            <button className="secondary-action" disabled type="button">
              Open Satellite Auto-Builder
            </button>
          ) : null}
          <button className="primary-action" onClick={() => onUseImportedCourse(selectedMetadata)} type="button">
            Use Imported Course
          </button>
        </section>
      ) : null}
    </section>
  );
}
