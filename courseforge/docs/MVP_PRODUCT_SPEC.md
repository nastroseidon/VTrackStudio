# MVP Product Spec

The MVP goal is to make it very easy for a non-technical user to create a simulator-ready golf course package.

## Core flow

1. Search course.
2. Show course on map.
3. User verifies correct course.
4. Auto-detect or manually draw course boundary.
5. Detect or import hole layout.
6. Number holes.
7. Find and verify scorecard and course info.
8. Use elevation and topology data.
9. Generate simulator-ready course package.

## Product principles

CourseForge should make automated help visible but correctable. Every inferred result should carry a confidence level, especially course identity, boundary detection, hole routing, scorecard data, tee positions, green shapes, and elevation-derived features.

Manual correction is part of the core experience, not an edge case. The MVP should let users fix uncertain or incorrect data before generating a package.

This first milestone does not implement the web app, map integrations, scorecard AI, Earth Engine processing, or course export logic.
