# Dataset guide

The complete measurement corpus and the completed semantic study are different things. Every active model is measured: 4,207 models, comprising 3,431 native SD, 130 LowPolyWorks and 646 permitted Hive. The 17 recorded base-namespace art exceptions are preserved outside these active exports. Only the explicitly counted reviewed subset has semantic labels. All IDs are stable within the recorded source bytes; a changed source model requires renewed annotation checks.

| Dataset | What it contains | What it does not establish |
|---|---|---|
| `models-sd.jsonl.gz` | One record per active model: source identity, SHA-256, sequences, durations, attachments, sheets, bounds, category and picture path | That every pose or game interaction was reviewed |
| `parts-sd.jsonl.gz` | Every measured physical component, counts, shape statistics, bounds, bone evidence, texture paths and explicit semantic status | That a connected component equals one semantic object |
| `part-families.json` | Named component memberships and observed construction measurements | Universal recommended triangle ranges |
| `uv-regions-sd.jsonl.gz` | Actual component UV triangles, coordinate set, resolved image, approximate source-pixel features, destination appearance tags and material context | That destination colour is source pigment, or that logical aliases have identical pixels |
| `uv-repurposing-candidates.jsonl.gz` | Owner regions compared with native model UV occupancy on corresponding sheets | Historical geometry provenance; overlap is only paint evidence |
| `lpw-semantic-owner-parts.json` | All 3,078 visually named connected pieces in the 26 owner models | Fine semantic subdivision of every connected body |
| `lpw-reuse-owner-parts.json` | Native paint reuse with UV coordinates, part names, observed appearance and source paths | A native geometry copy merely because native paint is used |
| `lpw-region-pixel-measurements.json` | Full-resolution pixel-centre UV union, alpha histograms and actual material layers | Exact rendered team-colour contribution after all blending/lighting |
| `lpw-owner-material-sheets.json` | Whole-sheet visual inventory for 206 declared owner-used paths, resolving to 202 decoded images | A uniform material label for every pixel on a mixed atlas |
| `lpw-custom-paint-observations.json` | Direct observations of all 42 distinct supplied Gluma/HerrDave custom images | Independent proof of which individual painted every stroke |
| `lpw-credit-provenance.json` | Parsed part/source attributions from the catalogue, with unresolved status retained | An exact mesh match |
| `owner-variant-provenance.json` | Exact comparisons of raw face-corner positions, normals, named weights and UVs for ten selected parts across two Von Carstein models | Historical chronology |
| `native-reviewed-parts.json` / `native-transferred-parts.json` | Direct visual native observations and separately recorded strict transfers | Direct review of transferred targets |
| `category-models.json` / `category-norms.json` | Official usage, model-state counts, sequences, attachment and scale evidence | A performance limit or automatic repair rule |
| `warcraft-faction-profiles.json` / `lpw-faction-profiles.json` | Visual source samples and separately retained category/race/army memberships | Uniform style across every member of a race |
| `effect-atlases-sd.jsonl.gz` | Particle-emitter grids, cell coordinates, blend modes, tint, size and timing | Authored mesh triangles or a complete simulation of every effect system |
| `base-namespace-art-exceptions.json` | Seventeen preserved modern or uncertain art exceptions, plus one retained SD-style effect with a cross-tier texture reference | That a storage namespace or file-format version establishes art style |
| `checkpoint-coverage.json` | Exact measured, directly reviewed, transferred and pending totals | Semantic completion of the whole corpus |

`D:/Codex/sd-research/data/research.sqlite` contains searchable `models` and `parts` tables. `D:/Codex/sd-research/data/uv-library.sqlite` contains `regions`, indexed by sheet and label. Their `payload` columns retain the detailed numeric record. The offline material browser provides a non-programming way to search sheets and inspect their part uses.

Each `.jsonl.gz` file is gzip-compressed UTF-8 JSON Lines: one independent JSON object per line. The scripts regenerate these from the raw measurements and reviewed annotation sources. Git exports omit native vertex-position arrays, triangle-index meshes and texture pixels. Exact UV coordinates, numerical measurements, labels and findings are retained as requested.

The much larger local `data/parts/` records include face indexes needed to regenerate isolated captures. They remain local with the source models. All supplied originals and downloaded archives are preserved.
