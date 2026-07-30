# Phase 6 — Course Style Profile Design

**Status:** Proposal only. No code, CoursePackage schema change, provider activation, asset download, or generated terrain is authorized by this note.
**Date:** 2026-07-23
**Objective:** Derive a defensible, confidence-scored description of a course's visual setting from free, attribution-compatible structured data. The output guides original VTrack vegetation and backdrop choices; it does not reproduce a photographed course.

## 1. Decision

Build a `CourseStyleProfile` from layered, explicitly attributed evidence:

1. OSM supplies course-local, human-mapped vegetation facts when present.
2. ESA WorldCover supplies a global 10 m biome/land-cover signal.
3. Köppen–Geiger supplies a global climate-zone prior.
4. Latitude, elevation, and **only eligible** GBIF occurrences can suggest a candidate species palette.
5. A separately curated CC0 or CC BY mesh catalog maps a verified species/genus/broadleaf signal to original VTrack-ready vegetation assets.

This is a visual-style aid, not a botanical survey. CourseForge remains engine-neutral; any Unreal foliage translation stays in the importer/runtime layer.

## 2. Sources, licenses, and permitted use

| Source | What it contributes | License/obligation | Decision |
|---|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Local vegetation geometry and tags | ODbL; preserve attribution and provenance | Accept |
| [ESA WorldCover 2021 v200](https://esa-worldcover.org/en/data-access) | Tree cover, shrubland, grassland, wetland, water, bare and built biome signals at 10 m | CC BY 4.0; use ESA's required acknowledgement | Accept; v200 is explicit, never implicit “latest” |
| [Köppen–Geiger V3](https://www.gloh2o.org/koppen/) / Beck et al. (2023) | 1 km historical and projected climate classification | CC BY 4.0; attribute/cite Beck et al. (2023) | Accept |
| [GBIF](https://www.gbif.org/terms) occurrence data | Candidate native/observed taxa near a location | Per-dataset license and citation/DOI govern reuse | Accept only records/datasets licensed CC0 or CC BY; filter out CC BY-NC |
| [Poly Haven](https://polyhaven.com/license) | Some CC0 3D assets/textures/HDRIs | CC0; attribution optional | Accept after technical review |
| [Quaternius Texture Fantasy Nature Pack](https://quaternius.com/packs/texturedfantasynature.html) | CC0 stylized tree, bush, flower and mushroom assets | CC0 | Accept only for stylized/prototype palettes, not as evidence of a real species |
| [Sketchfab CC assets](https://sketchfab.com/blogs/community/refine-downloadable-model-searches-with-new-license-filters/) | Potential individual downloadable tree meshes | Asset-by-asset license and author attribution | Conditional: accept only downloadable CC0 or CC BY assets with captured attribution |

Reject paid APIs, paid libraries, imagery whose redistribution rights are unclear, and all CC BY-NC, CC BY-ND, CC BY-SA, proprietary, “free for personal use”, or unlabelled meshes. The user’s policy is CC0/CC BY/ODbL/public-domain only.

## 3. OSM vegetation evidence

Relevant tags include:

- `leaf_type=broadleaved|needleleaved|mixed` — foliage form, not a species.
- `species=*` and `genus=*` — optional taxonomic hints; retain the literal source value before any normalization.
- `natural=wood|scrub|heath` and `landuse=forest` — structural vegetation/biome geometry.

### Illustrative keyless Overpass samples

Queries used a 1 km radius around each named course coordinate, requested only elements carrying one of the tags above, and used a descriptive User-Agent. The denominator is **matching vegetation-tagged elements**, not every OSM object or the precise golf-course boundary; these are presence samples, not a global completeness statistic.

| Sample | Matching elements | `natural=wood|scrub|heath` | `landuse=forest` | `leaf_type` | `species` | `genus` |
|---|---:|---:|---:|---:|---:|---:|
| St Andrews, Scotland (56.343, -2.803) | 76 | 55 | 6 | 22 | 1 | 3 |
| Pinehurst, North Carolina (35.195, -79.469) | 27 | 27 | 0 | 0 | 0 | 0 |
| Royal Melbourne, Australia (-37.974, 145.036) | 69 | 14 | 55 | 0 | 0 | 0 |

**Finding:** broad structural tags are often available; exact taxonomic tags are not reliable enough to require. A profile must lower confidence when it falls back from `species` to `genus`, `leaf_type`, or broad biome. It must never infer a named species merely because a climate zone makes it plausible.

## 4. WorldCover and climate signals

WorldCover v200 is a useful global setting signal: tree cover, shrubland, grassland, herbaceous wetland, permanent water, bare/sparse vegetation, and built-up classes describe the surrounding landscape. It cannot distinguish a fairway from rough; CourseForge's OSM-derived playing-surface geometry remains authoritative within the course boundary.

The WorldCover source is CC BY 4.0, distributed as COGs in EPSG:4326; its attribution is:

> © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium

Köppen–Geiger V3 provides global 1 km maps, including the 1991–2020 historical period, under CC BY 4.0. Use the current historical period as a biome prior—not a weather or microclimate prediction. Elevation can refine the confidence downward where local relief differs from the coarse climate grid.

## 5. Candidate palette method

1. Read exact OSM `species` first, then `genus`, then `leaf_type`, then WorldCover/Köppen–Geiger.
2. Normalize only a supplied taxon against a taxonomic authority; retain the raw OSM tag and the authority identifier.
3. For an exact or genus-level candidate, query GBIF only within a bounded region and only retain CC0/CC BY sources with their dataset key, DOI/citation, license, and query date.
4. Rank candidates by evidence tier rather than occurrence count alone: exact on-course OSM species > OSM genus + eligible nearby GBIF > leaf type + WorldCover/climate > WorldCover/climate alone.
5. Map the selected taxon or broad form to a **curated mesh catalog**, not a live marketplace search. The catalog records mesh ID, author, URL, version/hash, license, required credit, LODs, material limits, and permitted taxonomy labels.
6. If no evidence reaches the threshold, select a generic regional broadleaf/conifer/shrub mix and mark it low confidence. Do not show a species name.

## 6. Proposed engine-neutral JSON shape

```ts
type Evidence<T> = {
  value: T;
  confidence: number; // 0..1; evidence quality, not visual quality
  provenance: Array<{
    source: "osm" | "esa_worldcover_v200" | "koppen_geiger_v3" | "gbif" | "manual";
    retrievedAt: string;
    license: string;
    reference: string; // OSM id, dataset key/DOI, raster version, or manual note
  }>;
};

type CourseStyleProfile = {
  profileVersion: "0.1.0";
  generatedAt: string;
  courseId: string;
  biome: Evidence<"tree_cover" | "shrubland" | "grassland" | "wetland" | "mixed" | "unknown">;
  climate: Evidence<{ classification: string; period: "1991-2020"; elevationMeters?: number }>;
  vegetationStructure: Evidence<{
    wood: boolean;
    scrub: boolean;
    heath: boolean;
    forest: boolean;
    leafTypes: Array<"broadleaved" | "needleleaved" | "mixed">;
  }>;
  palette: Array<Evidence<{
    taxon?: { raw: string; rank: "species" | "genus" };
    form: "broadleaf_tree" | "conifer_tree" | "shrub" | "heath" | "grass";
    role: "dominant" | "accent" | "understory";
  }>>;
  meshCandidates: Array<Evidence<{
    catalogId: string;
    supportedTaxaOrForms: string[];
    license: "CC0" | "CC-BY-4.0";
    attribution?: string;
  }>>;
  limitations: string[];
};
```

The profile is proposed as a future neutral artifact. This note does **not** add it to the CoursePackage schema.

### Confidence policy

- `0.90–1.00`: explicit on-course species/genus evidence with valid provenance and a vetted mesh match.
- `0.65–0.89`: multiple compatible OSM/WorldCover/climate signals; no exact taxon claim.
- `0.35–0.64`: climate/land-cover prior only; generic form palette.
- `<0.35`: insufficient or conflicting evidence; use neutral defaults and show no botanical assertion.

## 7. Mesh catalog policy

Mesh identity must not be fabricated from a scientific name. A curator verifies geometry quality, LODs, collision suitability, materials, mobile/desktop performance, license, attribution, and source permanence before a mesh is offered to the importer.

| Evidence level | Allowed mapping |
|---|---|
| Exact species + verified compatible mesh | Exact species label and mesh candidate |
| Genus only + verified compatible mesh | Genus-level candidate, no species claim |
| `leaf_type` / biome only | Generic broadleaf, conifer, shrub, heath, or grass family |
| No eligible mesh | No asset selection; retain style evidence only |

Poly Haven and Quaternius demonstrate viable CC0 sources, but their availability does not prove species fidelity. Sketchfab proves that individually downloadable CC BY tree models exist; every adopted model still needs a captured author, URL, license, and attribution line. No bulk scrape or marketplace automation is proposed.

## 8. Why image-to-3D is rejected for terrain

Image-to-3D is not a terrain source. It produces prop-grade appearance, not a measurable playable surface: it cannot reliably supply georeferenced elevation, holes, collision, cup/tee placement, drainage, physical materials, or reproducible regeneration. It also introduces source-image and generated-output licensing ambiguity. VTrack should derive playable terrain from licensed structured geometry, DEMs, and surface masks instead.

Generated imagery can be legitimate only as non-authoritative scenery: a skybox or distant backdrop, with clear generation/source rights, no implication that it reconstructs the course, and no use for collision, gameplay, navigation, or terrain elevation.

## 9. Phased, gated follow-up

1. **Offline design/fixtures:** implement pure confidence aggregation against synthetic OSM, WorldCover, climate, GBIF, and catalog evidence.
2. **Schema decision:** separately assess whether `CourseStyleProfile` belongs in a neutral package or authoring-only metadata.
3. **Live-data gate:** authorize bounded WorldCover/GBIF retrieval only after endpoint, rate, license, attribution, and cache policy review.
4. **Asset gate:** curate individual CC0/CC BY meshes and validate them in Unreal before any bulk foliage import.
5. **Importer/runtime gate:** translate accepted style evidence into Unreal foliage only after the CourseForgeImporter design and asset-import controls are implemented.

## 10. Council decision

**Recommendation:** proceed with the proposal and future deterministic, fixture-first confidence logic; do not activate a new provider or acquire assets yet.

**Score: 90/100.** Evidence/correctness 22/25; safety, privacy, and licensing 20/20; testability 14/15; rollback 10/10; VTrack/CourseForge fit 10/10; scope discipline 10/10; maintainability 3/5; execution simplicity 1/5.

The main residual risks are OSM completeness, occurrence-observation bias, data-license filtering, species-to-mesh overclaiming, and source availability. The confidence/provenance model makes these visible rather than hiding them.
