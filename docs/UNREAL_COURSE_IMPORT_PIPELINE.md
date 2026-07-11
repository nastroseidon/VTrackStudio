# Unreal Course Import Pipeline

The CourseForge import pipeline is designed around a neutral CoursePackage export.

## Pipeline

1. CourseForge exports a CoursePackage.
2. `CourseForgeImporter` reads the package inside Unreal.
3. Unreal generates or imports simulator assets from the package contents.

## Imported course elements

The importer is expected to handle:

- Terrain and elevation data
- Surface masks
- Holes
- Tees
- Greens
- Pins
- Water
- Bunkers
- Tree zones

## Version safety

The importer should remain version-safe between Unreal Engine 5.5.4 and the planned Unreal Engine 5.8.0 migration. Engine-specific APIs should be isolated behind a small Unreal-side layer when possible, so CoursePackage data stays stable while Unreal integration details evolve.

This document describes the intended pipeline only. The importer does not exist as a working integration yet.
