# LowPolyWorks research checkpoint — 25 October 2026

This is research, not an MDLxL implementation. All downloads, extracted textures, captures and image plates remain under `D:/Codex/sd-research/`; Git contains scripts, numbers, coordinates, labels and prose. The current checkpoint deliberately stops before the whole collection has detailed semantic review. No further HD/DE study is included in this lane.

## Exact scope and coverage

- Downloaded all five public JSON files, 130 model files, 130 published thumbnails, 42 unique download packs, 5,991 globally mapped texture URLs and 48 additional model-specific texture URLs. The download ledger records zero failures and 330,694,051 downloaded bytes. Pack textures are extracted by hash; duplicate model copies stay inside their archives.
- Parsed and measured all 130 models. All 26 UnsanctionedMagic models have direct fitted-component review: 3,078 of 3,078 connected components. A connected component can still be an armour-and-arm assembly; these are not automatically isolated anatomical parts.
- Across the whole collection: 8,264 components; 3,281 direct labels, 364 explicitly inferred signature candidates, and 4,619 still unreviewed. Direct labels comprise the owner 3,078, 127 selected components of four custom-painted models, and all 76 components of Spear Skink and Dwarf Cannon. Candidates are not promoted to direct review.
- Owner models reference 206 actual logical native texture paths, resolving to 205 byte files and 202 distinct decoded RGBA images. This distinguishes path counts from paint identities and from the catalogue's per-geoset list. The animated eye frames do not constitute dozens of independent materials.
- All 42 distinct Gluma/HerrDave custom images received direct sheet review. This is a sheet-level painting survey; it does not imply that every model component using those sheets has been visually named.
- 6,639 component/texture records carry native-resolution pixel-centre UV coverage and full alpha histograms. There are 73 selected source/part/carrier comparison plates. Ten army profiles cover the actual collection, including its limited Dwarf artillery and Bretonnian commoner samples.

## Start here

The main chapters are `docs/SD-RESEARCH/subjects/lpw-native-reuse-observations.md`, `lpw-small-paint-large-effect.md`, `lpw-construction-families.md`, `lpw-controlled-variants.md`, `lpw-custom-painting-survey.md` and `lpw-skink-cannon-construction.md`. The vampire construction chapter is `subjects/families/vampire-native-reuse.md`. Exact model names accompany component references and picture links.

The most useful pictures are in `D:/Codex/sd-research/pictures/owner-reuse/`: `g25-c1.jpg` (inventory cover to Graveguard shield), `lpw-slaanesh-axe-g35-c2.jpg` (editor gem to axe gem), `lpw-khorne-flail-g34-c1.jpg` (interface metal to chain), `lpw-warrior-of-khorne-cleaver-g19-c1.jpg` (lava terrain to blade edge), `lpw-nurgle-standard-g32-c1.jpg` (pale skull paint made green by tint), and `lpw-blood-dragon-g28-c1.jpg` (inventory art to wooden-looking shaft).

## Datasets and evidence boundaries

`data/lpw-manifest.json` is the external 130-model manifest. `data/parts/lpw-*.json` contains measured components and exact UV triangles. Components use stable IDs such as `lpw-graveguard:g25:c1`; geosets and components are 1-based, face indices are 0-based. Captures and fitted part views are in `captures/models/<modelId>/`.

Git datasets in `docs/SD-RESEARCH/data/` include `lpw-semantic-owner-parts.json`, `lpw-selective-parts.json`, `custom-painting-parts.json`, `lpw-all-semantic-coverage.json`, `lpw-semantic-signature-candidates.json`, `lpw-owner-material-sheets.json`, `lpw-custom-paint-observations.json`, `lpw-region-pixel-measurements.json`, `lpw-authored-colours.json`, `lpw-credit-provenance.json`, `lpw-reuse-owner-parts.json`, and `lpw-owner-picture-evidence.json`.

The 398 parsed credit clauses remain author testimony or unresolved clauses; they do not prove geometry identity. UV overlap proves shared paint coordinates only after texture identity is established. Normalized point-set/UV signature transfers are semantic candidates, not historical provenance. Geometry matching is a separate parent-owned dataset. Whole-sheet material tags are not safe-rectangle recommendations. Rendered part colours must be distinguished from source paint, geoset tint and team colour.

Canonical plate percentages use native pixel centres inside the union of actual UV triangles. Graveguard front is 8,507/131,072 pixels (6.49%), back 23,722/32,768 (72.39%), and mail skirt 2,878/65,536 (4.39%). The all-corpus UV library's 64-by-64 features are approximate search/ranking measurements, not interchangeable with these fractions. Clamped UVs outside the sheet have their edge footprint omitted and flagged. Alpha below a threshold and mean 1-alpha are source-pixel measurements, not actual rendered team-colour contribution.

## Regeneration

Use the existing snapshot and hashes before changing any source version. Curated visual labels are supplied seeds: scripts regenerate their measurements and tables, not a new human vision review of changed assets. Node is `D:/Claude/tools/node/node.exe`; Python is `C:/Users/PC/AppData/Local/Programs/Python/Python312/python.exe` with NumPy and Pillow. Python can be read from C; all outputs and working directories remain on D. The project dependency junction supplies `war3-model`.

From `D:/Codex/sd-research/repo`, run these script groups in order:

1. `lpw-corpus.mjs --offline` validates/reuses the downloaded snapshot. Without `--offline`, it downloads public source metadata/assets with a SHA-256 ledger. `lpw-study.py` inventories packs, extracts texture members by hash and parses credits.
2. Parent-owned `measure-models.mjs` produces `data/parts/`. `lpw-decode.mjs` and `lpw-custom-decode.mjs` decode paint correctly; do not replace these with Pillow's JPEG-BLP decode, which lost alpha on the Saurus sheet. `lpw-colours.mjs` records sampled RGB tint with animated BGR tracks converted properly.
3. `lpw-texture-review.py`, `lpw-material-inventory.py`, `lpw-comparisons.py`, `lpw-factions.py` and `lpw-custom-survey.py` regenerate sheet inventories, comparisons, profiles and painting contact sheets from measured data and curated observations.
4. Before rebuilding semantic records from a fresh workspace, generate fitted component captures with the parent-owned hidden `render-study.mjs` (`--sources lowpolyworks --tiers sd --parts yes`); the semantic generators resolve their evidence filenames from `capture.json`. `lpw-semantics.py`, corpus-owned `vampire-observations.py` and `aspiring-observations.py`, then `lpw-owner-semantics.py` regenerate all owner labels. `lpw-selective-semantics.py` regenerates the Skink/Cannon direct labels. `custom-painting-study.py` invokes `decode-custom-painting.mjs` and regenerates the 127 selected custom-painting labels; `write-custom-painting-study.py` regenerates their detailed chapter. `lpw-semantic-expansion.py` joins direct review and produces explicitly inferred candidates and coverage.
5. `lpw-paint-coverage.py` regenerates all 6,639 native pixel-centre records. Parent-owned hidden renderer `render-study.mjs` and `render-gallery.mjs` regenerate captures and contact sheets. LPW entries omit tier and are treated as SD. Preserve corrected animated colour, emitter suppression for isolated parts, and billboard-camera handling; full carrier views retain authored effects.
6. `lpw-reuse-pictures.py` regenerates the 73 plates from the canonical coverage data. `lpw-write-study.py` regenerates three main chapters and refreshes numeric cells in the curated small-paint chapter. `uv-library.py` regenerates all-corpus search records with source-pixel and rendered-appearance scopes kept separate.
7. Run the parent-owned export/gallery steps, then `sanitize-permitted-references.py --apply` after all source-derived metadata regeneration. This sanitizes derived references only; raw downloaded JSON stays intact outside Git.

All scripts are under `scripts/sd-research/`. No app code, runtime profile, package build or user asset was changed by this lane. No owned background process remains running. Warcraft III gameplay acceptance was not tested; the study concerns measured assets and offline visual evidence.
