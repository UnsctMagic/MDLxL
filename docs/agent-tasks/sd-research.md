# SD modelling research — first volume and continuation

Status: active research; first volume prepared for review as a draft PR
Owner / consolidator: Codex, with corpus, LowPolyWorks and visual research delegates
Updated: 25 October 2026

## Goal and completion criteria

Study the craft in the installed Warcraft III assets, the complete LowPolyWorks collection, and the frozen permitted Hive collection. Deliver measured parts, observed construction families, exact UV evidence, texture reuse and provenance, painting and faction studies, category norms and browsable pictures. Build no MDLxL feature or application change.

The current session delivers a usable first volume, **not completion of the whole research mission**. The owner explicitly accepted continuation in several sessions and requested about 8% account quota remain for small tasks. Scope is now **SD artwork, including SD assets in MDX version 1800**. Earlier HD/DE findings are retained locally, with no further study of those tiers. Leave PR #299 untouched. This research PR must remain draft; no merge was authorized.

## Revision and local state

- Branch: `codex/sd-research`, based on main `2d6ca1e807640cc4dc6f4bccbbce46ddb021957e`.
- Working checkout during the study: `D:/Codex/sd-research/repo`. After the pushed checkpoint, the temporary checkout is removed; obtain the branch into this same D: path to continue. Inspect Git status before using an existing checkout.
- Repository: `UnsctMagic/MDLxL`. All changes are research scripts, derived knowledge and this task-note index.
- Durable entry point: `D:/Codex/sd-research/START-HERE.html`.
- Standalone illustrated volume and data: `D:/Codex/sd-research/study/`. It works after the checkout is removed.
- Raw inputs and manifests: `native/`, `lowpolyworks/`, `hive/`, `data/` under `D:/Codex/sd-research/`.
- Captures and browsable comparisons: `captures/` and `pictures/` under that root. Never place source texture pixels, captures or model geometry in Git.
- A copy of the research scripts and task notes is retained in `D:/Codex/sd-research/source-snapshot/`; the pushed branch is authoritative for source history.
- Game input: `D:/Warcraft III`, read only through the existing `electron/casc.cjs`. The acquisition build-metadata SHA-256 is `d8c9d777bcfdbfa48c8424e7b2f1d51562cd630c7ec64e53c06e45a7e55b41c5`. Changed source hashes require fresh visual validation; do not silently reuse old labels.
- Dependency junction during work: `repo/node_modules` points to the existing `D:/Claude/MDLxL/node_modules`; dependencies are not copied. Remove the junction as a link before worktree cleanup.

## What is already useful

All 3,448 base-namespace native models, 130 LowPolyWorks models and 646 permitted Hive models have structural measurements. Seventeen reviewed native namespace exceptions (eleven modern high-detail assets and six uncertain dense bridges) remain preserved outside the active SD study, leaving 3,431 active native models and 4,207 active models overall. See `base-namespace-art-exceptions.json`. The old native index has no missing entries against the current named CASC model enumeration. The original measured inventory contains 161,222 connected components: 84,293 native, 8,264 LowPolyWorks and 68,665 Hive. The active export contains 155,441 components: 78,512 native, 8,264 LowPolyWorks and 68,665 Hive. The 5,781 components of the seventeen namespace exceptions remain preserved separately. Exact current counts are in `checkpoint-coverage.json`. Content counts and path aliases are separate; 11,920 distinct native SD texture contents cover 16,312 named texture paths.

The owner subset is the most developed part: all 26 models and all 3,078 connected components have direct fitted-component interpretation. Across LowPolyWorks there are 3,281 direct labels, 364 separate signature candidates and 4,619 unreviewed components. Native direct review covers 673 components in 40 models, with 158 strict transferred labels kept distinct. **Hive semantic naming is not done.** A connected component may remain a compound body or one surface of an assembly; this is not fine anatomical completion.

The custom-paint survey directly inspected all 42 supplied distinct images associated with Gluma/HerrDave models. There are 6,639 native-resolution pixel-centre region measurements, 73 selected owner source/part/carrier plates, ten LowPolyWorks army profiles, native family comparisons, Warcraft race/creep profiles and category studies. Their individual source memberships and limitations are in the subject chapters.

The active UV library has 187,000 region records, 4,314 with reviewed labels; 15 model/image pairs remain unresolved. The picture browser has 19,314 source-sheet pages, including native copies and custom images; this is an ID count, not a count of unique painted images.

The key starting routes are `docs/SD-RESEARCH/FINDINGS.md`, `README.md`, `DATASETS.md` and `METHOD.md`. See [LowPolyWorks handoff](sd-research-lpw-handoff.md) for its exact evidence and script dependencies. `data/checkpoint-coverage.json`, `capture-coverage.json`, `uv-library-coverage.json` and `material-gallery-coverage.json` in the study are the numerical authority; do not replace them with an overall completion percentage.

## Findings and evidence boundaries

- Graveguard's 42-triangle shield front selects the undead inventory cover; its canonical pixel-centre footprint is 6.49%. The Slaanesh axe uses the editor active gem; Khorne's cleaver edge uses dungeon lava. The exact selected UV triangles are retained.
- Source RGB is not rendered colour. Nurgle skull paint is multiplied by authored green tint; a Khorne crossguard instead gains red through a team-colour layer. Animated geoset BGR tracks were explicitly converted to RGB.
- Chains need separate construction families: seven 48-triangle Khorne closed links versus six four-triangle Nurgle surfaces, and native painted-alpha chain strips. A wide single triangle range loses this distinction.
- Raw model-space size, sampled visible geometry, stored file triangles and object-editor scaling are distinct. Footman height 1 uses the documented 98.257613-unit sampled body height, not in-game scaled height.
- UV overlap is candidate paint reuse, not geometry provenance. A credit is author testimony. Strict position/normal/weight matching proves only its stated equality, not the historical direction of copying. The ten Von Carstein/Dread Knight part matches are stronger than loose affine candidates.
- Texture path aliases do not automatically prove identical paint. Preserve the byte or decoded-RGBA hash evidence. Material tags describe the reviewed rendered part; pixel statistics describe the source image.
- The all-corpus UV search uses approximate 64-by-64 masks. Selected owner painting records use native-resolution pixel centres. Neither is a guessed safe rectangle. Outside clamp-edge footprints are omitted and flagged.
- Captures are research renders. Unsupported popcorn/legacy effect systems, unresolved texture references, missing object-context replaceables, and zero-surface utility files remain explicit in the capture report. A picture file existing is not visual acceptance of every state.

## Regeneration and verification

Use Node from the existing D: tool installation, Python 3.12 with NumPy, SciPy and Pillow, and the existing project dependency junction. Read-only bundled dependencies provide Playwright, Sharp and Marked at `C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`; no output may go there. The pipeline sets task TEMP/TMP on D:. All browser work is headless. Do not use Electron or native desktop input.

The stage runner is `scripts/sd-research/regenerate.ps1`. Its default is `-Stage Export`, which rebuilds joined datasets, the material browser and the standalone handbook from already acquired evidence. It does not download or render again. The retained downloads, measurements and fitted captures are inputs to continuation; do not run Acquire merely to resume. Stages are independently selected, not a fresh-workspace bootstrap sequence. Labels needs the existing fitted `capture.json` component records and Measure-produced decoded LPW images. If specific fitted evidence is missing, first run a bounded `render-study.mjs --tiers sd --match <model-id> --parts yes --isolate yes` for that model, then rebuild its labels. Capture refreshes full views and preserves previously selected component isolation; its final comparison plates require the retained or rebuilt Labels measurements. Use explicit stages only when required:

1. **Acquire:** `native-corpus.mjs`, `world-editor-corpus.mjs`, `world-editor-replaceables.mjs`, `lpw-corpus.mjs`, `lpw-study.py`, `hive-corpus.mjs`. The Hive script reads exactly the earlier retained 90-resource/646-model arrays; it is not a new crawl. Use `lpw-corpus.mjs --offline` to reuse and verify existing downloads. Source snapshot changes must be intentional.
2. **Measure:** `measure-models.mjs native lpw hive` (default SD, including records with no explicit tier), `enrich-uv-sets.mjs`, `category-norms.mjs`, `lpw-colours.mjs`, `lpw-decode.mjs`, `lpw-custom-decode.mjs`, `study-effect-atlases.mjs --tier sd`. The two decode steps supply the native-resolution owner/custom source images and custom decode manifest consumed by `lpw-paint-coverage.py`. Existing matching measured files are reused unless `--force` is explicitly supplied. Regenerate alternate UV sets after a force run.
3. **Labels:** the seed/native humanoid/undead/repurposed/environment/creature scripts, `reviewed-native-parts.mjs`, custom painting and LPW semantic scripts. Run `write-environment-study.py` immediately after `environment-observations.py`: the first records curated descriptions, while the writer creates the actual environment annotation records that `reviewed-native-parts.mjs` loads. These reproduce curated observations; they do not replace visual judgment on new or changed assets. For a new reviewed part, preserve its exact model hash, 1-based geoset/component ID and evidence views.
4. **Capture:** `render-study.mjs --mode textures --tiers sd`, then `render-study.mjs --tiers sd --refresh-corrections yes`. Use `--match`, `--ids-file` or shards for bounded work. Directly studied models additionally need `--parts yes --isolate yes`; the automatic baseline does not manufacture detailed semantic review. The source-specific resolver must use CASC for native models and model/resource-scoped custom overrides for custom models. Keep camera correction, chronological particle history and isolated-component emitter suppression.
5. **Pictures and prose:** `render-gallery.mjs`, `render-browse-contacts.mjs`, `lpw-reuse-pictures.py`; `warcraft-profile-sheets.py` and `lpw-custom-survey.py` regenerate their specific sheets. Subject writer scripts regenerate their corresponding tables/chapters; read their curated inputs first and preserve later editorial corrections. The study contains hand-authored source-specific interpretations as well as generated tables.
6. **Export:** `export-study.py`, `uv-library.py`, `sanitize-permitted-references.py --apply`, `texture-region-gallery.py`, `render-handbook.mjs`. Run sanitization after every source-derived metadata rebuild; raw local downloads remain untouched. `study/` is the portable local snapshot, including HTML and numerical datasets.
7. **Verify:** `checkpoint-audit.py` checks source hashes, triangle conservation, stable annotation/export membership, script syntax and documentation targets. `verify-gallery.mjs` exercises sheet search, an exact Graveguard UV selection and image dimensions headlessly. `verify-handbook.mjs` checks the standalone volume links, illustrated findings and a model comparison table. `render-coverage.mjs` reports missing images and known rendering limitations. These are research checks; no MDLxL application build or gameplay acceptance is implied.

Local query databases are `data/research.sqlite` (models/parts) and `data/uv-library.sqlite` (regions). The compressed JSONL exports have the same stable IDs. `provenance-fit.*` is an experimental inconclusive affine search; its raw input remains local. `reuse-identical-models.mjs`, `write-tier-study.py` and compressed earlier tier data are preserved history, not active SD-stage work.

## First-volume validation result

The final audit reconciled all 4,207 active source hashes and 155,441 measured components, checked triangle conservation and annotation/export membership, and found no consistency issue. Every linked local target in the research Markdown and standalone handbook resolves. Headless browser checks loaded all findings images, opened a model comparison table, searched the material library and selected the exact Graveguard shield UV region without a page error. The game build-metadata hash still matches acquisition.

The final capture ledger has no missing recorded image files and no texture decode errors. Twelve models retain missing texture references; 94 blank samples are explicitly diagnosed or unresolved. This is offline research verification, not proof that all animated states render correctly or that assets were accepted by Warcraft III. Local evidence is `data/checkpoint-audit.json`, `gallery-qa.json`, `handbook-qa.json`, `capture-coverage.json` and `capture-blank-diagnosis.json`.

## Next research volume

Continue direct interpretation rather than reacquisition. The highest-value next chunk is to explain the native origins of the owner's 202 distinct decoded source sheets, then expand a bounded family with complete part/UV/source comparisons. There are 217 joined semantic family labels, but only the written subject chapters constitute interpreted families; the label count is not 217 finished studies.

Priority order:

1. Use `uv-repurposing-candidates.jsonl.gz` to choose unreviewed native source regions actually reused by the owner; inspect the source model and exact paint before naming its original purpose.
2. Split mixed connected bodies where anatomy or equipment cannot be identified at component level. Save reviewed face-subset labels locally and derived measurements without committing reconstructable mesh geometry.
3. Study permitted Hive examples as a clearly bounded family and then broaden non-owner LowPolyWorks review. Preserve candidate/direct distinctions.
4. Extend proven geometry provenance from credited sources, explicitly distinguishing reshape, re-UV, retexture, rerig and unavailable source. Do not report nearest-neighbour similarity as exact provenance.
5. Improve unresolved capture mechanisms only where they block the selected research; keep unsupported cases explicit rather than spending the session on rendering infrastructure.

The whole-corpus study remains unfinished. This first volume can be read and used immediately, and the next session should build on its sources, annotations and open questions.
