# What the research captures show

The active picture collection has 4,207 models: 3,431 installed SD candidates, 130 LowPolyWorks models and 646 permitted Hive models. It includes SD art stored in MDX format 1800. Seventeen base-namespace models are preserved as supplementary art-tier exceptions, not counted as active SD comparisons. Previously captured HD material is preserved separately at `D:/Codex/sd-research/pictures/prior-research.html`; it is outside the active study.

Open `D:/Codex/sd-research/pictures/index.html` for models, `pictures/contacts/index.html` for family/category/faction picture sheets, and `pictures/textures/native-sd/index.html` for all installed SD texture sheets. Each model page links four views, a wireframe and its actual UV triangles. Some labelled contact groups are broad assembly buckets: for example, `helmet-shell` also contains explicitly labelled rim and arrow ornaments. Read the exact part label; do not treat that whole bucket as one homogeneous construction family or derive a single triangle target from it. Exact coverage and exceptions are regenerated in `docs/SD-RESEARCH/data/capture-coverage.json`. The final capture audit has all four views and the wireframe for every active model, no missing recorded image files and no texture-decoding failures. Twelve models retain missing texture references. All 11,920 installed SD texture masters are present.

## Source and presentation

Blizzard models and textures come from the installed CASC through `electron/casc.cjs`, read only. LowPolyWorks models use their downloaded custom and native sheets; permitted Hive models resolve custom sheets inside their own permitted resource. Identical texture copies in that resource are one content candidate. Distinct same-name images are not guessed. Native captures do not substitute the website's copies of Blizzard textures.

Texture resolution records retain the requested name, resolved native path, content hash and source tier. An exact logical texture path resolved from another game tier is identified as a cross-tier reference; this does not make that texture SD artwork. Missing textures remain listed. Replaceable tree sheets require an official object binding; the study records the chosen object because several seasons can share one tree model.

The four yaw angles are -45°, 45°, 135° and 225°. Elevation is 56°, corresponding to installed `UI/MiscData.txt` camera AOA 304. The inspection field of view is 30°, and each model is fitted independently. These pictures do not establish relative size or reproduce every game camera configuration; use the measured dimensions for comparisons.

The renderer uses the project's existing billboard camera correction. Models render LOD 0. UV pictures include every stored geoset and LOD, which is deliberately broader than the sampled visible surface. Animated texture IDs are included. UV triangles are clipped to the sheet and repeat only on the texture's authored wrap axes. Particle atlas cells are separate records in `effect-atlases-sd.jsonl.gz`.

## Animation and diagnostic parts

The initial pose is the first Stand variant, otherwise the first sequence, at 20% of its interval. Refreshed captures replay supported particle effects from the sequence start, capped at the preceding 5 seconds; the metadata records truncation. The frozen audit contains 4,152 records with chronological-history metadata and 55 retained older records with fixed-pose warm-up metadata; these are distinguished per model. When this sample has no visible foreground, the optional visible-phase search tries recorded authored phases and sequences, retaining every attempt and the chosen reason. A successful alternate sample is not evidence that the original sample was broken. A further bounded retry replays authored looping effects when a single clip cycle is shorter than the emission interval. `loopWarmupMilliseconds` records this explicitly. Ribbon visibility is sampled within the current sequence with the authored default of one when that sequence has no keys; Death-only zero keys do not hide the Stand sample. Some utility files have no visible surface at all.

Emitter-only pictures are fitted to the sampled particles' actual positions, sizes and tail lengths. Ribbons contribute their sampled vertices. This prevents empty authored bounds from cropping an otherwise visible effect. Particle placement is illustrative and is not a deterministic gameplay simulation.

Isolated components and geosets use diagnostic visibility, two-sided faces and unshaded colour so hidden/back-facing geometry can be examined. Authored sampled material-layer alpha remains intact whenever a layer is visible. If every layer is invisible, the selected diffuse layer is explicitly marked as diagnostic. Refreshed isolated mesh captures suppress unrelated particle and ribbon draws. Six retained isolated-model records lack that explicit suppression metadata, and the coverage file lists their IDs. Selected mesh glow cards remain. Full-model pictures retain the authored effects.

Animated MDX geoset colours are converted from their stored BGR track representation with the same codec used by the document-open boundary; static RGB colours remain unchanged. SD shader types 0 and 2 use diffuse layering. Type 2 is `shader_sd_fixedfunction` in the owning format map. A rigid one-bone classic geoset inside a modern weighted model can use the exactly equivalent 100% bone weight in the render clone. Large active bone indices use the sampled node matrices to skin the capture without truncating the indices. These adaptations never rewrite source model files.

## Limits that remain visible

These are renderer captures, not Warcraft III runtime acceptance. Legacy particle emitters, popcorn systems and light-node behavior are not reproduced. Event-triggered child models are not assembled into the scene. External attachment models are not automatically loaded. Any such references remain measurable in the source data. A blank diagnostic includes its source structure and sampled phases; it is not silently counted as an inspected visible object. The foreground detector counts pixels whose summed RGB distance from the background exceeds 35; this is a visibility threshold, not a proof that every pixel is identical. The final 94 blank samples comprise 55 unsupported effect-system files, 36 camera/light/attachment/event or other non-surface utilities, and three unresolved renderable cases: `AIOBSpecialArt`, `BlightDoodad` and `Smoke1_Green`. The first two carry atlas endpoints beyond their declared cell count. That source anomaly is recorded without guessing how the game interprets it. Full paths, primitive counts and all sampled phases are in `capture-blank-diagnosis.json` and the offline blank-diagnosis page.

Some installed base-module cinematic scenes contain modern dense geometry. Their presence in the base namespace does not make them a useful normal-unit comparison. The category datasets preserve that distinction.

## Regenerate on D:

Run from `D:/Codex/sd-research/repo` with the existing Node runtime and linked dependencies. No application build or Electron window is used.

```powershell
node scripts/sd-research/render-study.mjs --sources all --tiers sd --find-visible yes
node scripts/sd-research/render-study.mjs --sources all --tiers sd --mode textures
node scripts/sd-research/render-gallery.mjs
node scripts/sd-research/render-browse-contacts.mjs
node scripts/sd-research/render-texture-contact.mjs
node scripts/sd-research/render-blank-diagnosis.mjs
node scripts/sd-research/render-coverage.mjs
```

Existing captures are skipped. To refresh their existing part/geoset diagnostic selection, add `--overwrite yes --refresh-corrections yes`. Use `--ids-file data/example-ids.json` for an explicit model-ID list. `--shard-count N --shard-index I` splits independent models; each worker is headless. All raw pixels, local HTML and logs stay under `D:/Codex/sd-research/`.
