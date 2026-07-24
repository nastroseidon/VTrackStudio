# CourseForgeImporter

UE 5.8 Editor-only plugin groundwork for importing neutral CourseForge bundles.

Current capability: `FCourseForgePackageReader` reads an uncompressed CourseForge ZIP bundle, parses `course-package.json`, extracts the optional 16-bit heightmap and 8-bit surface-layer PNGs, and validates their declared dimensions and byte lengths. It does not create, modify, or import Unreal assets.

CourseForge remains engine-neutral. Landscape creation, material-layer mapping, generated-content ownership, and live Editor imports are separate, approval-gated work.
