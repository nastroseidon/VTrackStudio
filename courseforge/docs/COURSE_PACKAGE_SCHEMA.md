# Course Package Schema

CourseForge should export a neutral CoursePackage so the course-builder is not tightly coupled to Unreal project internals.

## Proposed package shape

```text
CoursePackage/
  course.json
  scorecard.json
  holes.geojson
  terrain/
    heightmap.r16
  surface-masks/
    fairway.png
    green.png
    rough.png
    bunker.png
    water.png
    trees.png
  metadata/
    source-report.json
```

The neutral format lets CourseForge focus on course authoring, validation, and export while Unreal handles simulation-specific import through `CourseForgeImporter`.

## Example course.json

```json
{
  "schemaVersion": "0.1.0",
  "course": {
    "name": "Example Golf Club",
    "origin": {
      "latitude": 39.7684,
      "longitude": -86.1581,
      "elevationMeters": 220.0
    }
  },
  "holes": [
    {
      "number": 1,
      "par": 4,
      "teePositions": [
        {
          "name": "Back",
          "latitude": 39.7681,
          "longitude": -86.1585,
          "elevationMeters": 221.0
        }
      ],
      "centerlinePoints": [
        {
          "latitude": 39.7681,
          "longitude": -86.1585
        },
        {
          "latitude": 39.7688,
          "longitude": -86.1579
        }
      ],
      "greenPolygon": {
        "type": "Polygon",
        "coordinates": [
          [
            [-86.1578, 39.7689],
            [-86.1577, 39.7689],
            [-86.1577, 39.7688],
            [-86.1578, 39.7688],
            [-86.1578, 39.7689]
          ]
        ]
      }
    }
  ]
}
```

This schema is an initial proposal and will evolve as the MVP web app and importer requirements become clearer.
