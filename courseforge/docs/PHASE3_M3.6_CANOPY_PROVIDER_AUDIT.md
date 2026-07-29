# M3.6 Canopy Provider Audit (pre-gate)

Diligence for the two approval gates M3.6 carries per `PHASE3_LANDCOVER_SPLAT_DESIGN.md` §7:
a **`LIVE`** gate for canopy data and a **`SCHEMA`** gate for foliage instances.

This document is research only. **No provider request of any kind has been made** — not a
`GET`, not a `HEAD`, not a bucket listing. §10.4 places the HEAD verification *at* the gate,
so it is listed here as the first action after approval, not performed ahead of it.

Prepared 2026-07-27 against `main` @ `4caccd8`.

## 1. Scope finding: M3.6 is smaller than the roadmap sentence implies

`ROADMAP.md` and design §7 describe M3.6 as "tree-cover class + Meta/WRI canopy → foliage
instances". The first half **is already shipped**:

- `lib/surfaces/composite-surfaces.ts:43` maps WorldCover class `10` (tree cover) → `trees`.
- Line 52 additionally maps class `95` (mangroves) → `trees`.
- `trees` is one of the eight signed-off layers (§10.1) and is already encoded, composited,
  and exported.

Nothing in the tree-cover *class* path needs work. M3.6's actual remaining scope is one thing:
**canopy height data → discrete foliage instances**, plus the schema to carry them. That is a
different kind of output from everything in Phase 3 so far — Phase 3 emits rasters, and
foliage instances are vector point data.

## 2. Candidate provider

**High Resolution Canopy Height Maps** — Data for Good at Meta, with WRI. The only realistic
candidate: global, sub-metre, open-licensed, and already named in the signed-off design.

Two releases exist.

| | v1 | v2 (CHMv2) |
|---|---|---|
| S3 prefix | `s3://dataforgood-fb-data/forests/v1/alsgedi_global_v6_float/` | `s3://dataforgood-fb-data/forests/v2/global/dinov3_global_chm_v2_ml3/` |
| Region | `us-east-1` | `us-east-1` |
| Imagery | Maxar | Vantor |
| Format | GeoTIFF + GeoJSON (observation dates) | COG GeoTIFF (~213,109 files, ~22.65 TB) |
| Registry `License` | `https://creativecommons.org/licenses/by/4.0/` | `https://creativecommons.org/licenses/by/4.0/` |

Regional v1 subsets also exist (California, São Paulo, Sub-Saharan Africa) and are not useful
here — courses are global.

## 3. Licence: qualifies, with one unresolved conflict

The project constraint is free + attribution-only (CC-BY, CC0, ODbL, public domain), no paid
APIs or paid asset licensing.

The AWS Open Data registry records **CC-BY 4.0 for both v1 and v2**, read verbatim from
`awslabs/open-data-registry`. On that basis the dataset qualifies on the same footing as ESA
WorldCover, which is already in use under CC-BY 4.0.

**⚠ Unresolved:** secondary write-ups of CHMv2 describe it as released "under the DINOv3
licence" — Meta's model licence, which is *not* attribution-only and carries acceptable-use
terms. The v2 S3 prefix (`dinov3_global_chm_v2_ml3`) is consistent with a DINOv3-derived
model. The most likely reading is that the **model weights** are DINOv3-licensed while the
**data** is CC-BY 4.0, which is how v1 was structured (model weights sit under their own
prefix). That reading is unconfirmed.

This must be settled before v2 is used. It does not block v1, whose CC-BY 4.0 status is not
in dispute.

**Recommendation: pin v1.** It matches the §10.2 precedent — pin an explicit version, record
it in `sources`, never resolve "latest" — and it sidesteps the licence question entirely.
v2 can be a later parameter change once the licence is confirmed.

## 4. Attribution obligation

CC-BY 4.0 attribution is a licence condition, not a courtesy, and must be carried on export
alongside the three strings already in force. Proposed provenance token and string, following
the `esa_worldcover_v200` pattern:

- `sources` token: `meta_wri_canopy_v1`
- attribution: `Canopy height © Meta / World Resources Institute, CC-BY 4.0`

Exact wording should be confirmed against the provider's own attribution guidance at the gate.

## 5. Open questions the gate must answer

Unanswerable from documentation; all require a request, so all belong after approval:

1. **Anonymous access.** Is the bucket readable keyless, or requester-pays? The registry entry
   does not state `RequesterPays` either way. Requester-pays would mean an AWS account and
   billing — which the no-paid-services rule forbids, and would end the milestone.
2. **Key convention.** The v1 tile naming and grid are undocumented in the registry. GLO-30 and
   WorldCover both required empirical verification of the real key shape; assume the same here.
3. **`Accept-Ranges`.** Required for windowed COG reads. Without it, a 22 TB dataset is
   unusable at course scale — this is the single highest-risk unknown.
4. **Grid alignment.** Canopy tiles will not share the heightmap/splat grid. Resampling or
   point-sampling strategy needs deciding.
5. **Attribution wording.** Confirm the provider's preferred string.

## 6. Schema implications (the second gate)

Foliage instances are **not** a splat layer and must not be forced into one. `CourseSplatMap`
describes a raster: `format: "png-8"`, `width`/`height`, per-layer PNG artifacts. Tree
positions are a point set.

The additive, rollback-safe shape consistent with §9 is a **separate optional field** on
`CoursePackage` — e.g. `foliage?: CourseFoliageSet` — carrying instances with position, height,
and a source token, artifact-referenced by path + `sha256` + `byteLength` if the count is large
enough to warrant a sidecar file rather than inline JSON. Absent `foliage` leaves all existing
behaviour untouched, exactly as absent `surfaces` does today.

Instance *density* at course scale is unknown and worth bounding before committing to inline
JSON: a wooded 18-hole course could plausibly carry tens of thousands of trees.

## 7. Recommended gate sequence

If both gates are approved, in order:

1. `HEAD` one v1 tile. Confirm anonymous access, the real key convention, and `Accept-Ranges`.
   **Stop and report if any of the three fails** — items 1 and 3 in §5 are milestone-ending.
2. Fix the schema shape and land it additively behind the `SCHEMA` gate, fixture-tested offline.
3. Build decode → instance extraction as pure functions against fixtures, mirroring the M3.2/M3.4
   pattern: pure first, thin live wrapper behind the gate, `fetchImpl` injection.
4. Live smoke last, against already-tested code — the M3.3 discipline.

## 8. Council summary

Provider is available, global, and open-licensed; the tree-cover half of M3.6 is already done;
the licence question is confined to v2 and is avoided by pinning v1. The material risks are
`Accept-Ranges` and requester-pays, both cheap to falsify with a single `HEAD` as the first
action after the gate opens.

Recommended: approve the `LIVE` gate for **v1 only**, pinned, with the §7 sequence and an
explicit stop condition at step 1.
