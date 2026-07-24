#pragma once

#include "CoreMinimal.h"

/** A referenced artifact in a neutral CourseForge bundle. */
struct FCourseForgeArtifact
{
    FString Path;
    int64 ByteLength = 0;
    FString Sha256;
};

/** Course-centred metric placement metadata supplied by the neutral package. */
struct FCourseForgeLocalGrid
{
    double OriginLat = 0.0;
    double OriginLng = 0.0;
    double WidthMeters = 0.0;
    double HeightMeters = 0.0;
    double MetersPerPixelX = 0.0;
    double MetersPerPixelY = 0.0;
};

/** Neutral heightmap metadata and its extracted 16-bit grayscale PNG bytes. */
struct FCourseForgeHeightmap
{
    int32 Width = 0;
    int32 Height = 0;
    double MetersPerPixel = 0.0;
    double MinElevationMeters = 0.0;
    double MaxElevationMeters = 0.0;
    FCourseForgeArtifact Artifact;
    TOptional<FCourseForgeLocalGrid> LocalGrid;
    TArray<uint8> PngBytes;
};

/** Neutral 8-bit grayscale Landscape-layer input and its extracted PNG bytes. */
struct FCourseForgeSurfaceLayer
{
    FString Name;
    FCourseForgeArtifact Artifact;
    TArray<uint8> PngBytes;
};

/**
 * Parsed, engine-neutral data from a CourseForge ZIP bundle.
 *
 * This type deliberately contains no UObject or Landscape state. A later,
 * separately approved import step owns translation into generated Unreal assets.
 */
struct FCourseForgePackage
{
    FString PackageVersion;
    FString CourseName;
    TOptional<FCourseForgeHeightmap> Heightmap;
    TArray<FCourseForgeSurfaceLayer> SurfaceLayers;
};

/**
 * Reads CourseForge bundles created with the ZIP store method. The reader
 * validates the manifest, referenced artifact sizes, and PNG header shape;
 * it never creates, modifies, or imports Unreal assets.
 */
class COURSEFORGEIMPORTER_API FCourseForgePackageReader
{
public:
    static bool ReadBundle(const FString& BundlePath, FCourseForgePackage& OutPackage, FString& OutError);
};
