# Audit 06 — Model-domain core and the features built on it

Scope: `src/` model core (`editor-document`, `editor-commands`, `geoset-operations`, `classic-mesh`, `mesh-tools`, `bone-tools`, `animation`, `animation-tracks`, `sequence-editor`, `movement`, `record-preservation`, `history-store`, codecs, `save-target`, `part-bones`, `pose-ik`, `app/model-save.js`, `app/sequence-actions.js`) and the feature modules on top (`anim-xl`, `auto-corpse`, `corpse-geometry`, `sort-my-mess`, `glow-up`, `attachemator`, `normals-rebuild`, `optimizexl*`, `bits-and-parts`, `forge-*`, `mesh-density`, `particle-recipes`, `motion-*`, `sd-kit`, `paint-*`, `uv-tools`, `texture-library-art`, `world-editor-catalog`).
Checkout: `D:\Claude\MDLxL\.claude\worktrees\codebase-audit`, origin/main `fe46a534`. Read-only; nothing in the repository was edited.
Method: `rg`/`grep` sweeps for each helper family, then reading every instance that looked like a copy and comparing behaviour. Line numbers are at `fe46a534`.

OptimizeXL rule: per `docs/OPTIMIZEXL_TEACHING.md`, this report does **not** propose moving any OptimizeXL rule (detection or repair ownership). Where OptimizeXL files show up below, the proposal only swaps in a shared *primitive*, such as "is this a global track", "keys inside an interval" or "remove geosets and remap their references". The rule bodies stay in their `optimizexl-*` owner.

Severity key: **High** = repeated domain rule whose copies already disagree on real models, or large repeated plumbing. **Medium** = repeated helper with edge-case divergence or a competing implementation of one rule. **Low** = identical copies, or pure tidiness.

---

## Summary table

| # | Finding | Sev. | Copies | Behaviour |
|---|---|---|---|---|
| 1 | Cross-model resource import (nodes/textures/materials/texture anims/global seqs) | High | 4 | Divergent reuse and validity rules |
| 2 | "Bones a vertex hangs on" (classic group or HD weights) | High | ~19 | Divergent weight thresholds and HD detection; two existing shared owners go unused |
| 3 | Node lookup / parent-chain / depth / root / descendant walks | High | ~45 | Three cycle strategies, three "no parent" sentinels; `byId` map rebuilt 30× |
| 4 | Inherited-parent matrix + world-matrix composition | Medium | 4 | Identical; `pose-ik` refuses the flags with a stale reason |
| 5 | "Is this a global track" predicate | Medium | ~50 | Four different semantics |
| 6 | Sequence classification (Stand / Death / Decay / Portrait / name normaliser) | Medium | ~20 | Divergent; `portraitSequenceIndices` reimplemented |
| 7 | Remove geosets and remap their references | Medium | 4 | Divergent Glider/count handling |
| 8 | Value identity: `canonical` / `signature` / typed `json` / material keys | Medium | 13 | 3 identical, 3 variants, 7 typed-json; two material-key copies diverge |
| 9 | Bounds / extents and "one extent per sequence" fill | Medium | 6 + 8 | Divergent empty-geoset and radius definitions |
| 10 | Append a new sequence | Medium | 4 | Divergent gap, template and `Geosets[].Anims` policy |
| 11 | Find-or-create a geoset's GeosetAnim | Medium | 6 | Divergent duplicate handling |
| 12 | Whole-model track walkers | Medium | 9 | Divergent skip lists and cycle handling |
| 13 | Two "recalculate normals" algorithms | Medium | 2 | Competing rule (area-weighted vs unit-sum) |
| 14 | Vertex-selection validation and per-vertex stream gathering | Medium | 4 + 4 | Divergent strictness |
| 15 | Name vocabularies: weapon / side / body-part | Medium | 5 + 3 + 3 | Divergent; known false positives (`Elbow`, `Balance`) |
| 16 | Node collection key lists | Low | 7 | Mostly identical |
| 17 | Per-property transform defaults + "sample node property" | Low | 11 | Identical |
| 18 | Pivot lookup `node.PivotPoint ‖ model.PivotPoints[id] ‖ 0` | Low | 33 | Identical (2 reverse the order) |
| 19 | Unique-name generation | Low | 8 | Eight suffix schemes |
| 20 | Texture slot list, texture-ID remap, team-colour/glow predicates, texture labels | Low–Med | 11 + 6 + 5 + 3 | Divergent glow predicate |
| 21 | "Keys inside an interval" filter | Low | 27 | Identical |
| 22 | vec3 helpers and `faceNormal` | Low | 10 + 2 | `faceNormal` degenerate fallback differs |
| 23 | `createRigNode` repeats `createNode`'s bind-pose extension | Low | 2 | Equal on consistent files |
| 24 | Shallow "preview model" copies | Low | 2 | `withTracks` leaves `Nodes` stale |
| 25 | Inspector edits bypass `setSequenceName` / `setSequenceInterval` | Low–Med | 1 | Skips validation |
| 26 | `apply(label, sections, …)`: `sections` is advisory | Low–Med | — | One App side effect relies on it |
| L1 | `src/` → `app/` imports | Medium | 2 | Layering |
| L2 | Pure model logic living in `app/` | Low–Med | 4 files | Layering |

Counts: **26 findings + 2 layering findings**. By severity: 3 High, 15 Medium (incl. L1 and the Low–Med items 20, 25, 26, L2 counted Medium), 10 Low. About **300 duplicated call sites** in total. **15 findings have copies that behave differently** (1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20). **Two existing shared owners nobody else calls**: `partBones` / `geosetBoneIds` (finding 2) and `portraitSequenceIndices` (finding 6).

---

## 1. Cross-model resource import — High

Each "bring things from model B into model A" feature carries its own dependency closure and remap for nodes, textures, materials, texture animations and global sequences.

| Instance | Snippet |
|---|---|
| `src/editor-document.js:1018-1160` `importGeosets` | `function requireNode(id) { … if (visiting.has(id)) throw new Error('Source hierarchy contains a cycle.') …` (1029); `const globalRef = (value) => { … if (value.GlobalSeqId != null && value.GlobalSeqId !== -1)` (1046); `textureRef … existing = target.Textures.findIndex((t) => fingerprint(t) === fingerprint(sourceTexture))` (1055-1058) |
| `src/particle-recipes.js:19-110` `placeParticleRecipe` | `function requireNode(id) { … throw Error('Effect hierarchy contains a cycle.')` (26-32); `function tracks(value) { … if (value.GlobalSeqId != null && value.GlobalSeqId !== -1)` (36-38); `// Filename equality is not evidence of content equality. Preserve distinct resources.` → always `target.Textures.push(clone(...))` (62-63) |
| `src/node-clipboard.js:20-45` | `const reuse = (collection, value) => { const key = fingerprint(value), index = collection.findIndex(...) }` (26); `remapGlobals … if (Number.isInteger(value.GlobalSeqId) && value.GlobalSeqId >= 0)` (27-29) |
| `src/bits-and-parts.js:140-180` | the same `reuse`/`remapGlobals` pair (144-153); `textureRef … partTextureKey(existing) === partTextureKey(texture)` (154-162); material slot loop (167-174) |

**Behaviour: divergent.**
- *Texture reuse.* `importGeosets` and `node-clipboard` reuse a target texture with an identical full fingerprint. `bits-and-parts` reuses by `partTextureKey`. `particle-recipes` never reuses, and its comment rejects reuse on principle.
- *Global-sequence reuse.* `importGeosets` and `particle-recipes` always append a new global sequence. `node-clipboard` and `bits-and-parts` reuse a target global sequence with the same duration (as does `glow-up.js:191` `globalSequence`).
- *Validity checks for a source global id.* `importGeosets` uses `=== undefined`. `particle-recipes` uses `!Number.isFinite || < 0`, so it accepts 0. `node-clipboard` uses `!Number.isInteger || <= 0`. `bits-and-parts` uses `!isFinite || <= 0`.
- *Texture-ID tracks.* `particle-recipes` and `bits-and-parts` rebuild the key arrays as `Int32Array`. `importGeosets` keeps the source array type.

**Proposed shared owner:** a new `src/model-import.js` exporting `createResourceImporter(source, target, { reuseTextures: 'fingerprint'|'partKey'|'never', reuseGlobals: boolean })`. It would return `{ requireNode, globalRef, textureRef, materialRef, textureAnimRef, maps }`, moved verbatim out of `importGeosets`. Each caller passes its current policy, so its output does not change. `importGeosets`, `placeParticleRecipe`, the node-clipboard paste and the bits-and-parts import switch over one at a time.
**Risk:** High. These paths write saved files. **Tests:** `test/editor-document.test.js`, `test/clipboard-paste.test.js`, `test/node-clipboard.test.js`, `test/mesh-clipboard.test.js`, `test/bits-and-parts.test.js`, `test/bit-replacement.test.js`, `test/particle-prototype.test.js`, `tests/editor-roundtrip.test.js`, `tests/lossless-roundtrip.test.js`.

---

## 2. "Bones a vertex hangs on" — High

There are already two exported owners: `src/part-bones.js:3` `partBones(model, geosetIndex, vertex)` and `src/resource-relations.js:5` `geosetBoneIds(geoset, vertices)`. Almost nobody uses them. Each copy below reimplements the classic matrix group or HD 4-weight read:

| Instance | Weight test | HD test |
|---|---|---|
| `src/animation.js:109,128,160` (`skinGeoset` and friends; weights used) | `weight` > 0 | `skin.length >= (v+1)*8` |
| `src/part-bones.js:7` | `> 0` | `>= (v+1)*8` |
| `src/resource-relations.js:10-12` | truthy | `>= (v+1)*8` |
| `src/binding-inspection.js:11-15` | `> 0` | `=== count*8` |
| `src/bone-tools.js:182-184`, `:203` | `> 0` | `=== count*8` |
| `src/movement-selection.js:12-13`, `:39` (classic only at 39) | `> 0` | — |
| `src/portrait-model-control.js:17-18` | `> 0` | `=== count*8` |
| `src/rig-node-order.js:117-118` | `> 0` | `=== count*8` |
| `src/attachemator.js:75-76` (with weights) | `> 0` | `hd` flag |
| `src/particle-ribbon-fit.js:13` | `> 0` | `>= (v+1)*8` |
| `src/anim-xl.js:1160` `skinnedBoneIds` | `> 0` | `=== count*8` |
| `src/anim-xl.js:985` `boneRadii` | **`> 127`** | `=== count*8` |
| `src/glow-up.js:29-31` `bindingsOf` | **`>= 128`** | `>= (v+1)*8` |
| `src/corpse-geometry.js:38-40` `influences` | **`>= 32`** | `>= (v+1)*8` |
| `src/optimizexl-effect-visibility.js:6` `bones` | classic only | — (OXL refuses HD) |
| `src/optimizexl-checker-repairs.js:81-89` `boneUsage` | classic only | — |
| `src/mesh-density.js:439`, `src/normals-rebuild.js:75-82` (grouping keys) | classic or raw | `=== count*8` |
| `app/AnimXL.jsx:110-111` `weaponTip` | `> 0` | `=== count*8` |
| `src/editor-document.js:1041` (dependency closure) | truthy | stride loop |

**Behaviour: divergent.** The weight thresholds differ: >0 in most copies, ≥32 in Auto Corpse, ≥128 in Glow Up and in AnimXL's bone sizing. The thresholds look deliberate per feature, but nothing names them. The "is this HD" test also differs. `>= (v+1)*8` treats a truncated weight array as HD for its first vertices, while `=== count*8` treats it as classic everywhere. The two tests agree on valid files.

**Proposed shared owner:** `src/part-bones.js` exporting `vertexBones(geoset, vertex, { minWeight = 1 } = {})` and `vertexBoneWeights(geoset, vertex)`, with a single HD test `isHdSkinned(geoset)` = `SkinWeights?.length === count*8`. `partBones` and `geosetBoneIds` become one-line wrappers. Callers that need a threshold say so: Glow Up `{minWeight:128}`, Corpse `{minWeight:32}`, AnimXL radii `{minWeight:128}`. The first pass should switch the `> 0` copies: `binding-inspection`, `bone-tools`, `movement-selection`, `portrait-model-control`, `rig-node-order`, `particle-ribbon-fit`, `anim-xl.skinnedBoneIds` and `AnimXL.jsx weaponTip`.
**Risk:** Low for the `>0` group. Medium for the thresholded ones, so keep their numbers exactly. **Tests:** `test/part-bones.test.js`, `test/bone-tools.test.js`, `test/glow-up.test.js`, `test/auto-corpse.test.js`, `test/anim-xl.test.js`, `test/rig-node-order.test.js`, `test/portrait-movement.test.js`, `test/normals-rebuild.test.js`, `test/animation.test.js`.

---

## 3. Node lookup, parent chains, depth, root and descendants — High

`allNodes` (`src/animation.js:56`) is shared well. But `new Map(allNodes(model).map(n => [n.ObjectId, n]))` is rebuilt **30 times**: pose-ik ×6, movement ×5, anim-xl ×5, AnimXL.jsx ×3, portrait-model-control ×2, and one each in optimizexl-exclusions, optimizexl-endpoints, motion-inspector, animation-tracks, ai-sampling, portrait-camera-edit, portrait-background, PoseControls and GamePreview. Every walk over that map is also written inline:

| Helper | Instances (file:line, snippet) |
|---|---|
| depth | `anim-xl.js:132` `while (byId.has(p) && d < 64)`; `anim-xl.js:282` `depthOf … !seen.has(p)`; `anim-xl.js:775` (within a set); `anim-xl.js:1134` `d < 64`; `movement.js:428-431` seen-set; `pose-ik.js:182` `depthOf` seen-set; `rig-node-order.js:142` seen-set |
| root / top | `anim-xl.js:768` `topOf … guard < 64`; `attachemator.js:234` `root` seen-set; `pose-ik.js:157` `rootOf` seen-set; `pose-recognition.js:80` `rootOf` seen-set; `optimizexl.js:109` `root` |
| is-ancestor / descends | `anim-xl.js:885` `descendsFrom … guard < 64`; `attachemator.js:91` seen-set; `optimizexl-motion-context.js:185` `ancestor` seen-set; `pose-ik.js:618` `descendantOf` (used at 44, 295) |
| ancestor list / chain | `corpse-geometry.js:63` `ancestors`; `motion-inspector.js:16-17` `chain`; `optimizexl-skin-collapse.js:25` `chain` (`!ids.includes`); `optimizexl-exclusions.js:19`; `optimizexl-snaps.js:19`; `optimizexl.js:68`; `pose-ik.js:52-57`, `:69-82`, `:103-107`, `:592-596`, `:606-609`, `:619-623`, `:668`, `:674-677`, `:711`, `:909-917` |
| name up the chain | `glow-up.js:80` `gripOf … guard++ < 64` over `model.Nodes[...]`; `glow-up.js:106` `guard++ < 4`; `anim-xl.js:1100` `underHead … guard < 64` |
| children map | `node-hierarchy.js:6`, `:40`; `attachemator.js:65-66`; `pose-ik.js:100-101`, `:155-156`; `pose-recognition.js:8-10`; `rig-node-order.js:132-133`; `anim-xl.js:772-773`, `:1091-1092` |
| parent via `model.Nodes[]` index | `bone-tools.js:52`, `:153`; `glow-up.js:80,106`; `optimizexl-motion.js:60` `model.Nodes?.[current.Parent] \|\| nodes.find(...)` |

**Behaviour: divergent, in three ways.**
- *Cycle handling.* Some copies use a `seen` Set and stop exactly at the cycle. Others use an iteration cap (`guard < 64` in anim-xl and glow-up, `< 4` in glow-up's held test). A cap stops, but returns depth 64 or a wrong "top" on a cyclic rig. A few walks have no guard at all and rely on `validateModel`: `pose-ik.js:69-82` loops while the names match, and `glow-up.js:106` is bounded only by its cap of 4. Note that `validateModel` (`editor-document.js:692-697`) only blocks *new* cycle errors, so a cyclic file that is opened stays cyclic.
- *"No parent" sentinel.* `editor-document.js:692`, `particle-recipes.js:31` and `optimizexl-checker-repairs.js:157` treat `-1` as none. `pose-ik.js:29` treats `< 0` as none. `node-hierarchy.js:8,42` also treats a self-parent as none. The rest rely on `byId.has(p)` being false, which happens to cover all of these.
- *Lookup source.* `model.Nodes[id]` exists only after `normalizeModel`; `allNodes` works on raw models. `glow-up` and `bone-tools` would break on an unnormalised model, which tests sometimes pass.

**Proposed shared owner:** extend `src/node-hierarchy.js`, which already owns `nodeHierarchyRows` and `downstreamBoneIds`, with `nodeIndex(model)` → `{ byId, children, parentOf(id), ancestors(id), depth(id), root(id), isAncestor(id, anc) }`. It would use a single cycle rule (a seen-Set) and a single sentinel rule (`null`, `-1`, self or missing all mean root). Start with the plain copies that match it already: `motion-inspector`, `corpse-geometry`, `attachemator`, `pose-recognition`, `rig-node-order`, `movement`. Then move anim-xl and glow-up, whose depth on cyclic rigs would change from "64" to the true depth, which is a fix. Do not touch the OptimizeXL rule bodies, only their walk helpers.
**Risk:** Medium (pose-ik and anim-xl rely on these heavily). **Tests:** `test/node-hierarchy-chain.test.js`, `test/pose-ik.test.js`, `test/anim-xl.test.js`, `test/attachemator.test.js`, `test/auto-corpse.test.js`, `test/glow-up.test.js`, `test/movement.test.js`, `test/motion-inspector.test.js`, `test/rig-node-order.test.js`, `test/bone-tools.test.js`, `test/optimizexl-exclusions.test.js`, `test/optimizexl-snaps.test.js`.

---

## 4. Inherited-parent matrix and world-matrix composition — Medium

| Instance | Snippet |
|---|---|
| `src/animation.js:84-94` inside `sampleNodeMatrices` | `if (node.Flags & 7) { … parent.decompose(p, q, s); if (node.Flags & 1) p.set(0, 0, 0); if (node.Flags & 2) q.identity(); if (node.Flags & 4) s.set(1, 1, 1); parent = new Matrix4().compose(p, q, s); }` |
| `src/anim-xl.js:606-631` `worldMatrices` | the whole `resolve` (pivot compose + the same Flags block, lines 617-627) duplicated. The dupscan flagged `anim-xl.js:617-625 <-> animation.js:84-92` |
| `src/movement.js:222-231` `movementParentMatrix` (exported) | same Flags block |
| `app/preview-pose.js:13-18` `inherited` | same Flags block |

**Behaviour: identical.** One stale policy goes with it: `pose-ik.js:27` throws *"POSE cannot use non-default inherited transforms: this preview renderer does not reproduce those flags"*. `sampleNodeMatrices`, the renderer's own sampler, does reproduce them. The refusal may still be intended for the IK maths, but the reason it gives is out of date.

**Proposed shared owner:** in `src/animation.js`, export `inheritedParentMatrix(parent, flags)` and `composeNodeMatrices(model, ids, localTRS)`, where `localTRS(node)` returns `{t, r, s}`. `sampleNodeMatrices` becomes `composeNodeMatrices` with track sampling. `anim-xl.worldMatrices` becomes `composeNodeMatrices` with its sample callbacks. `movementParentMatrix` and `preview-pose.inherited` call `inheritedParentMatrix`. Correct the pose-ik message, or the rule, separately and with the owner's say.
**Risk:** Low (pure maths, identical). **Tests:** `test/animation.test.js`, `test/anim-xl.test.js`, `test/movement.test.js`, `test/pose-ik.test.js`, `test/particle-sweep.test.js`, `test/portrait-movement.test.js`.

---

## 5. "Is this a global-sequence track" — Medium

| Semantics | Instances |
|---|---|
| A. `Number.isInteger(id) && id >= 0` | `sequence-editor.js:113,126,161,208,278,286,332,338,359,366`; `movement.js:210,282,345`; `animation-tracks.js:139,162,227,318`; `motion-inspector.js:11`; `auto-corpse.js:14`; `bits-and-parts.js:30,83,147,191,203`; `classic-keyframes.js:6`; `keyframe-timeline.js:8`; `emitter-timing.js:7`; `animation-speed.js:18`; `sort-my-mess.js:31`; `node-clipboard.js:29`; `geoset-extras.js:20`; `particle-sweep.js:30,43`; `optimizexl-motion.js:6`; `optimizexl-snaps.js:5`; `optimizexl-motion-context.js:109`; `app/AnimationController.jsx:102,257`; `app/ParticleTimingTool.jsx:6` |
| B. local iff `id == null \|\| -1 \|\| 0xffffffff` | `optimizexl-checker-repairs.js:13`, `optimizexl-effect-visibility.js:4`, `optimizexl-endpoints.js:5`, `optimizexl-format.js:4`, `optimizexl-opening-tracks.js:3`, `optimizexl-redundant-tracks.js:4`, `optimizexl-spline-tracks.js:26`, `optimizexl-unused-tracks.js:3`, `optimizexl.js:42`, `optimizexl-animation.js:76` |
| C. A plus `GlobalSequences[id] > 0` (the same test `sampleTrack` uses, `animation.js:11`) | `anim-xl.js:23` `isGlobal` |
| D. global iff `!= null && !== -1` | `editor-document.js:751,768,1014,1048`, `particle-recipes.js:38`, `clipboard-paste.js:100`, `app/particle-preview-adapter.js:198` |
| E. `!= null` only | `portrait-model-control.js:82`, `pose-ik.js:260`, `app/portrait-view.js:131`, `app/ParticleKeyTrack.jsx:10` |

**Behaviour: divergent on invalid data only.** The war3-model parser maps `-1` to `null`, and `validateModel` errors on dangling ids (`:768`) and on non-positive durations (`:750`). Valid documents therefore agree. They do not agree on files opened with existing errors, which `apply` tolerates. For a zero-length or dangling global id, `sampleTrack` and AnimXL treat the track as local while A, B, D and E treat it as global. For the value `0xffffffff`, B treats it as local while A treats it as global.
**Proposed shared owner:** `src/animation.js` exporting `globalSequenceId(track, model?)`, which returns an id or `null` using C's rule (the same one `sampleTrack` uses), plus `isGlobalTrack(track, model?)`. Callers swap in one line each, and OptimizeXL's `local` helpers become `t => !isGlobalTrack(t, m)`.
**Risk:** Low on valid files. Divergence is only on already-invalid files. **Tests:** `test/sequence-editor.test.js`, `test/sequence-reorder.test.js`, `test/global-sequence-preview.test.js`, `test/animation-tracks.test.js`, `test/classic-keyframes.test.js`, `test/optimizexl-*.test.js`, `test/animation-speed.test.js`.

---

## 6. Sequence classification — Medium

| Rule | Instances |
|---|---|
| **Stand** pick | `attachemator.js:42-51` `attachematorStandSequence` (plainest `Stand`, `Stand - N`, excludes `portrait\|alternate\|channel\|work\|…`, else first non-death); `paint-view.js:8` `/^Stand(?:$\|[ -])/i`; `warcraft-dnc.js:68` `Math.max(0, findIndex(/^stand/i))` (falls back to 0); `app/GameFileBrowser.jsx:181` `/^stand\b/i`; `app/ParticleEditor.jsx:227` `/^stand$/i` on trimmed name; `app/portrait-view.js:25` `/^stand(?:\s\|$)/i` |
| **Death** | `auto-corpse.js:17` `/(?:^\|\s)death(?:\s\|$)/i`; `optimizexl-endpoints.js:10` `^death( \|$)` on a normalised name; `optimizexl-checker-repairs.js:324` `sequenceWord` (first word before `-`, skips `alternate`); `app/showcase-effects.js:9` `\bdeath\b` after non-letters → space; `glow-up.js:17` `HIDDEN = /death\|decay\|dissipate/i` (substring); `attachemator.js:50`, `pose-ik.js:223,314` (node names) |
| **Decay** | `auto-corpse.js:18`; `glow-up.js:17`; `app/showcase-effects.js:18` |
| **Portrait** | `sequence-editor.js:143` `portraitSequenceIndices`. Re-inlined identically at `portrait-extents.js:7`, and again as `/portrait/i` in `sort-my-mess.js:331`, `app/portrait-background.js:32`, `app/portrait-view.js:23-24,122`, `app/PortraitToolbar.jsx:63`, `app/ShowcaseWorkspace.jsx:38`, `app/showcase-timeline.js:37` |
| Name normaliser | `optimizexl.js:94` `seqName` ≡ `optimizexl-endpoints.js:9` `name` (identical); `app/showcase-effects.js:9` (variant) |

**Behaviour: divergent.** Different features pick different "Stand" clips on the same model. For example, with `Stand Ready` listed before `Stand`, `paint-view` picks `Stand Ready`, ParticleEditor picks `Stand`, and Attachemator picks `Stand`. "Death" also differs: `Death Alternate` is a Death for auto-corpse, showcase and `sequenceWord`, but for `optimizexl-endpoints` only if the name begins with `death`. `glow-up` treats any name containing "death" as hidden.
**Proposed shared owner:** `src/sequence-editor.js` (which already has `portraitSequenceIndices`) exporting `sequenceWords(name)`, `isDeathSequence`, `isDecaySequence`, `isPortraitSequence` and `standSequenceIndex(model)`. `standSequenceIndex` would move `attachematorStandSequence` as is, keeping that name as an alias. Switch the *identical* copies first: `portrait-extents.js:7` → `portraitSequenceIndices`, and `optimizexl-endpoints.js:9` → OXL's own `seqName` or the shared normaliser. Switching the divergent Stand and Death pickers changes visible behaviour, so each needs the owner's agreement.
**Risk:** Medium; user-visible. **Tests:** `test/attachemator.test.js`, `test/auto-corpse.test.js`, `test/glow-up.test.js`, `test/portrait-extents.test.js`, `test/sequence-editor.test.js`, `test/optimizexl-checker-repairs.test.js`, `test/showcase-export.test.js`.

---

## 7. Remove geosets and remap references — Medium

| Instance | Gliders | Bone.GeosetId / GeosetAnimId | Counts | Merge redirect |
|---|---|---|---|---|
| `editor-document.js:862-879` `deleteGeoset` (one index) | filtered + shifted | yes / yes | `updateCounts` | no |
| `optimizexl-checker-repairs.js:65-79` `removeGeosets` / `removeGeosetAnims` | **not updated** | yes / yes | relies on `normalizeModel` | no |
| `sort-my-mess.js:443-465` `removeGeosets` | filtered + mapped | yes / redirected to the target's anim | `Info.Num*` | yes (`removed` Map → target) |
| `geoset-operations.js:440-468` inside `mergeSimilarGeosets` | mapped to the leader | yes / yes | `Info.Num*` | yes (leader) |

Callers that loop `deleteGeoset` (descending order is required): `geoset-operations.js:375`, `auto-corpse.js:103`, `bits-and-parts.js:264`, `app/App.jsx:1176`, `app/GameFileBrowser.jsx:220`, `app/ResourceEditors.jsx:49`.

**Behaviour: divergent.** OptimizeXL's copy leaves `Gliders[].GeosetId` stale. This is **latent**: `optimizexl.js:57` `supported()` refuses models with Gliders, so it cannot happen today.
**Proposed shared owner:** `src/editor-document.js` exporting `removeGeosets(model, removed /* Set or Map old→target|null */)` → `oldToNew`, built from `sort-my-mess.removeGeosets`, the most complete of the four. `deleteGeoset(model, i)` becomes `removeGeosets(model, new Set([i]))`. The OptimizeXL checker repair and Sort My Mess call it, and so can `mergeSimilarGeosets` for its remap tail. This shares the primitive only; the OXL "empty geosets" rule stays where it is.
**Risk:** Medium. **Tests:** `test/editor-document.test.js`, `test/geoset-operations.test.js`, `test/sort-my-mess.test.js`, `test/optimizexl-checker-repairs.test.js`, `test/auto-corpse.test.js`, `test/bits-and-parts.test.js`.

---

## 8. Value identity: `canonical`, `signature`, typed `json`, material keys — Medium

| Helper | Instances | Behaviour |
|---|---|---|
| key-sorted, drop `undefined`, typed arrays → arrays | `sort-my-mess.js:24-29` `canonical`+`keyOf`; `geoset-operations.js:7-13` `signature`+`keyOf`; `bits-and-parts.js:13` `canonical` | **identical** ×3 |
| same, minus `PivotPoint` | `node-clipboard.js:8` | variant |
| `fround` numbers, `-0`, drops `Nodes`/`PivotPoint`/`Info.Num*` | `model-optimizer.js:18-24` | variant (deliberate) |
| `toFixed(6)`, quaternion sign-normalised | `motion-decisions.js:12-22` | variant (deliberate) |
| typed-array JSON, *not* key-sorted (`NaN` → `null`) | `optimizexl-checker-repairs.js:11`, `optimizexl-effect-visibility.js:3`, `optimizexl-opening-tracks.js:1`, `optimizexl-redundant-tracks.js:3`, `optimizexl-skin-collapse.js:11`, `optimizexl-unused-tracks.js:1`, `geoset-animation-repair.js:6` | identical ×7 |
| typed-array JSON with type name and non-finite numbers | `editor-document.js:49` `fingerprint`, `record-preservation.js:7` `fingerprint` (also drops alias keys) | variants |
| **Material identity with textures resolved by content** | `sort-my-mess.js:72-85` `resolvedMaterialKey`; `geoset-operations.js:15-34` `materialKey` | **divergent**: missing material → `'missing'` (Sort My Mess groups all such geosets) vs `null` (Merge Similar refuses). Texture id `-1`/`null` → `{missing:-1}` (Sort My Mess) vs kept as is (geoset-operations). Slot presence: `typeof === 'number'` vs `!== undefined` |

Sort My Mess and *Merge similar geosets* are competing implementations of the same rule: these geosets look the same, so merge them. They already share `appendGeosetGeometry` and `unionAnimatedExtents`, which is good. They do not share the identity key or the removal step (finding 7).
**Proposed shared owner:** `src/value-key.js` with `canonicalValue(value, { omit = [] })`, `stableKey(value, opts)` and `typedJson(value)`. The three identical copies and the seven typed-json copies switch with no behaviour change. Move `materialKey(model, id, { missing })` into `geoset-operations.js` as an export, with an option for each caller's missing-material policy, and have Sort My Mess call it. Leave `model-optimizer` and `motion-decisions` as deliberate variants.
**Risk:** Low for the identical swaps. Medium for the material key, because Sort My Mess groupings could change. **Tests:** `test/sort-my-mess.test.js`, `test/geoset-operations.test.js`, `test/bits-and-parts.test.js`, `test/node-clipboard.test.js`, `test/optimizexl-*.test.js`, `test/geoset-animation-repair.test.js`.

---

## 9. Bounds, extents and the per-sequence extent fill — Medium

| Instance | Empty geoset | Radius | Other |
|---|---|---|---|
| `editor-document.js:899-906` `bounds` (private; used by `recalculateExtents`) | zeros | max vertex distance from box centre | — |
| `classic-mesh.js:31-39` `bounds` (private) | ±Infinity extents | same | throws on `fround` overflow |
| `mesh-tools.js:31-38` `updateBounds` (exported; auto-corpse, corpse-geometry, bits-and-parts, geoset-operations) | ±Infinity extents | same | — |
| `optimizexl-bounds.js:24-30` `box`/`include`/`finish` | zeros | **half box diagonal** + 1e-5 pad | throws on non-finite |
| `optimizexl-effect-visibility.js:8-12` `bounds` | ±Infinity | none | OXL internal |
| `glow-up.js:301`, `app/portrait-background.js:245`, `geoset-operations.js:403` (Info/union radius) | — | **half diagonal** | — |

"One extent per sequence" fill (`g.Anims = model.Sequences.map(() => copy of geoset extents)`) is repeated at `bits-and-parts.js:47`, `:86`, `:235`, `forge.js:257`, `glow-up.js:232`, `app/portrait-background.js:242`, `auto-corpse.js:177`, `:180`, and with different padding rules at `geoset-operations.js:218` and `sequence-editor.js:85`.

**Behaviour: divergent.** An empty geoset gets zero extents from `recalculateExtents` but Infinity extents from `updateBounds` or `classic-mesh`. The bounds radius means the farthest vertex in some places and half the box diagonal in others; the half diagonal is never smaller.
**Proposed shared owner:** export `geosetBounds(vertices)` from `editor-document.js`, taking the current private `bounds` and adding classic-mesh's overflow check. `mesh-tools.updateBounds` becomes `Object.assign(g, geosetBounds(g.Vertices))`, which changes the empty-geoset result to zeros, matching `recalculateExtents`. Add `fillSequenceExtents(model, geoset, { onlyIfPresent })` in `sequence-editor.js`. Leave OptimizeXL's padded half-diagonal as a deliberate variant inside `optimizexl-bounds`.
**Risk:** Low to Medium. Saved bytes change only for empty geosets. **Tests:** `test/classic-mesh.test.js`, `test/mesh-tools.test.js`, `test/optimizexl-bounds.test.js`, `test/glow-up.test.js`, `test/auto-corpse.test.js`, `test/bits-and-parts.test.js`, `test/portrait-background.test.js`, `tests/lossless-roundtrip.test.js`.

---

## 10. Append a new sequence — Medium

| Instance | Gap after last | Template | `Geosets[].Anims` |
|---|---|---|---|
| `sequence-editor.js:66-87` `createSequence` (used by `bits-and-parts`, `app/sequence-actions.js`) | +1000 | fresh, extents from `Info` | **always** appends one per geoset |
| `optimizexl-checker-repairs.js:221-226` (Stand/Death repair) | +100, rounded to 100 | `structuredClone(Sequences[0])` (copies SyncPoint and other fields) | only if non-empty, copies `Anims[0]` |
| `auto-corpse.js:60-63` `ensureSequence` | +1000, 60 s long | clone of the Death sequence | padded later only where non-empty (`:180`) |
| `app/ResourceEditors.jsx:162` (Add sequence) | +100 | fresh `Stand` | **never** touched, which leaves a mismatched extent table that `optimizexl-bounds.boundsProposals` then flags |

**Behaviour: divergent.** **Proposed shared owner:** extend `sequence-editor.createSequence(model, duration, { name, gap, template, nonLooping, extents: 'always'|'ifPresent' })`. Point `ResourceEditors` at it first; it is the one that leaves extent tables inconsistent. The OptimizeXL repair keeps its rule and only calls the primitive.
**Risk:** Low for ResourceEditors. **Tests:** `test/sequence-editor.test.js`, `test/auto-corpse.test.js`, `test/optimizexl-checker-repairs.test.js`, `test/optimizexl-bounds.test.js`.

---

## 11. Find-or-create a geoset's GeosetAnim — Medium

| Instance | Duplicate records | Creation |
|---|---|---|
| `animation-tracks.js:41-55` `assertSingleGeosetOwner` + `resolveTarget` | throws when writing | `createVisibilityGeosetAnimation` + `NumGeosetAnims` |
| `sort-my-mess.js:351-358` `ensureAnim` | throws | `createVisibilityGeosetAnimation` |
| `auto-corpse.js:41-46` `visibility` | throws | `createVisibilityGeosetAnimation` |
| `app/portrait-background.js:267-268` | silently takes the first | `createVisibilityGeosetAnimation` |
| `optimizexl.js:90` `hideGeoset` | silently takes the first | inline object (same fields as `createVisibilityGeosetAnimation`) |
| `app/ResourceEditors.jsx:156` | — | own |

Read-only "first GeosetAnim for geoset i" is inline 17×. Examples: `animation.js:196`, `normals-rebuild.js:69`, `optimizexl-effect-visibility.js:5`, `optimizexl.js:92,98`, `keyframe-timeline.js:105,136`.
**Behaviour: divergent** in how duplicates are handled. **Proposed shared owner:** `src/geoset-animation-defaults.js` exporting `geosetAnimationOf(model, id)` and `ensureGeosetAnimation(model, id, { refuseDuplicates = true })`. `assertSingleGeosetOwner` stays where it is and `ensureGeosetAnimation` calls it.
**Risk:** Low. **Tests:** `test/animation-tracks.test.js`, `test/sort-my-mess.test.js`, `test/auto-corpse.test.js`, `test/portrait-background.test.js`, `test/optimizexl.test.js`.

---

## 12. Whole-model track walkers — Medium

`editor-document.js:173-185` `normalizeTracks` (visited Set); `sequence-editor.js:191-206` `visitModel` (seen Set, skips `Keys/EventTrack/Interval/Anims`); `classic-keyframes.js:26-35` (WeakSet); `animation-speed.js:33-45` (seen, skips `Nodes`/private keys); `global-sequence-preview.js:5-16` (seen); `optimizexl.js:78` `tracks` (skips `Nodes`, no seen set, `x.Keys` truthy); `optimizexl-checker-repairs.js:25-33` `trackEntries` (skips `Nodes`/`_MdxDefaults`, no seen); `editor-document.js:1044-1050` `globalRef`, `particle-recipes.js:36-56` `tracks`, `node-clipboard.js:27-34`, `bits-and-parts.js:145-152` `remapGlobals` (these four walk sub-records).
**Behaviour: divergent but harmless today.** The no-seen-set copies only avoid the double visit because they skip `Nodes`; the seen-Set copies dedupe the `Nodes`/`Bones` alias instead. Paths differ: some include array indices, some do not.
**Proposed shared owner:** `src/animation.js` (or `src/model-walk.js`) exporting `visitTracks(model, visit /* (track, {owner, property, path}) */, { skip })` with a seen set. Switch `classic-keyframes`, `global-sequence-preview` and `animation-speed` first, then OXL's `tracks` and `trackEntries` (primitive only).
**Risk:** Low to Medium (OptimizeXL path order feeds its finding ids). **Tests:** `test/classic-keyframes.test.js`, `test/global-sequence-preview.test.js`, `test/animation-speed.test.js`, `test/optimizexl-checker-repairs.test.js`, `test/sequence-reorder.test.js`.

---

## 13. Two "recalculate normals" algorithms — Medium (competing rule)

- `src/editor-document.js:881-897` `recalculateNormals`: sums **unnormalised** face normals, so it is area-weighted. It has no welding by position, a 1e-12 epsilon, and falls back to +Z. Used by the **Inspector "Recalculate normals" button** (`app/Inspectors.jsx:37`), `forge.js:194`, `shaping.js:79`, `editor-document.js:1178` and `app/ResourceEditors.jsx:160`.
- `src/normals-rebuild.js:95-140` (NormalsXL): sums **unit** face normals, so it is unweighted like the SD models (the owner's recorded finding). It welds by position, skin and visibility, has a smoothing angle and a relative degenerate threshold `diagonal² × 2e-12`.

**Behaviour: divergent.** The same app offers two "recalculate" results. **Proposed:** no code change without the owner. Option A: the Inspector button calls `planNormalRebuild` / `applyNormalRebuild` with default settings (90°), and Forge/shaping keep the fast path. Option B: rename the Inspector action so users can tell the two apart. Either way, make `editor-document.recalculateNormals` document that it is the quick area-weighted version for generated geometry.
**Risk:** user-visible. **Tests:** `test/normals-rebuild.test.js`, `test/editor-document.test.js`, `test/forge-contract.test.js`.

---

## 14. Vertex-selection validation and stream gathering — Medium

Validators:
- `editor-commands.js:16-23` `selectedIndices`: lenient, with an `allowEmpty` option.
- `bone-tools.js:72-79` `selectedIndices`: message "Select valid vertices first.", and checks VertexGroup and SkinWeights lengths.
- `classic-mesh.js:5-21` `checkedSelection`: allows empty `Faces`, skips empty Tangents/SkinWeights.
- `mesh-tools.js:9-28` `validate`: **rejects** empty `Faces`, and rejects a present-but-empty Tangents array.

Gatherers:
- `classic-mesh.js:41-50` `gather` copies only the streams that are present.
- `mesh-tools.js:41-54` `gather` assumes Normals and VertexGroup exist and throws on a geoset without normals.
- `editor-commands.js:69` inline in `deleteVertices` handles empty arrays.
- `mesh-density.js:493` uses `flatMap` and `Array.from`, which gives the same result but is O(n) in allocations.

**Behaviour: divergent.** The same selection can be valid for one MDLVis command and invalid for the next. **Proposed shared owner:** `src/mesh-tools.js` exporting `checkedVertexSelection(geoset, indices, { requireFaces, allowEmpty })` and a single `gatherStreams(geoset, indices)` (the classic-mesh version). The other copies call them, keeping their current flags.
**Risk:** Low to Medium (error messages are tested). **Tests:** `test/editor-commands.test.js`, `test/classic-mesh.test.js`, `test/mesh-tools.test.js`, `test/bone-tools.test.js`, `test/mesh-density.test.js`.

---

## 15. Name vocabularies: weapon, side, body part — Medium

- **Weapon names**: `glow-up.js:15` `WEAPON_NAME`, `attachemator.js:38` `WEAPON`, `anim-xl.js:1108` `weaponName` (two variants), `corpse-geometry.js:11` `accessory`, `pose-recognition.js:47` `excluded`. These were checked against bone names:
  - `glow-up`'s regex matches **`Bone_Elbow_R`** through `bow`, and `Elbow` contains no `arm`, so the −5 penalty never applies.
  - It also matches `Bone_Balance` through `lance` and `Bone_Begun` through `gun`.
  - `attachemator`'s `bow(?!l)` still matches `Elbow`.
  - None of these regexes use word boundaries.
- **Side**: `attachemator.js:219-225` `nameSide` checks the `left` substring first, then `l`/`r` tokens. `rig-node-order.js:30-34` `nameSide` checks right first, with `handr`-style suffixes. `glow-up.js:16` `SIDE` is a third form.
- **Body part**: `pose-ik.js:131-146` `poseNodeRole` is the shared owner and is used well. `rig-node-order.js:20-28` (`nameRegion`) and the `anim-xl.js:122-129` name fallback are parallel vocabularies.

**Behaviour: divergent.** **Proposed shared owner:** a small `src/rig-names.js` holding the token-based (word-boundary) vocabularies, `WEAPON_WORDS`, `nameSide(name)` and `nameTokens(name)`. Each feature keeps its extra words. Fixing `Elbow` and `Balance` changes Glow Up and Attachemator rankings, so it needs owner approval.
**Risk:** Medium (ranking changes). **Tests:** `test/glow-up.test.js`, `test/attachemator.test.js`, `test/anim-xl.test.js`, `test/rig-node-order.test.js`, `test/pose-ik.test.js`, `test/auto-corpse.test.js`.

---

## 16. Node collection key lists — Low

`animation.js:58` (with `Nodes`), `pose-ik.js:523` (same list), `editor-commands.js:1` `nodeCollections` (no `Nodes`, different order), `editor-document.js:27-35` `NODE_TYPES` (canonical), `portrait-extents.js:28` `RIG_KEYS`, `ai-regions.js:2`, `app/particle-preview-adapter.js:201,235` (partial, deliberate).
**Identical** apart from order. **Owner:** export `NODE_COLLECTION_KEYS` from `editor-document.js`, derived from `NODE_TYPES`, or from `animation.js` to avoid a heavy import. `pose-ik`, `editor-commands` and `portrait-extents` use it. **Tests:** `test/animation.test.js`, `test/pose-ik.test.js`, `test/editor-commands.test.js`.

## 17. Transform defaults and "sample node property" — Low

`movement.js:7` `defaults` and `movement.js:68-73` `sampleMovement` already form the full helper. Copies: `motion-inspector.js:8`, `keyframe-timeline.js:10`, `model-optimizer.js:151`, `optimizexl-animation.js:81`, `optimizexl-checker-repairs.js:35,52`, `optimizexl-endpoints.js:6-7`, `optimizexl.js:79`, `optimizexl-motion-context.js:49` (Scaling falls back to `[0,0,0]`, which is fine there because it only reads Rotation/Translation), `auto-corpse.js:129`, and the anim-xl `rotOpts`/`posOpts` at `:65,293`. **Identical.** **Owner:** `src/animation.js` exporting `TRANSFORM_DEFAULTS` and `sampleNodeProperty(model, node, property, frame, sequenceIndex, globalTime)`, with `movement.sampleMovement` delegating to it. **Tests:** `test/movement.test.js`, `test/animation.test.js`.

## 18. Pivot lookup — Low

`node.PivotPoint || model.PivotPoints?.[id] || [0,0,0]`, inline **31×**: anim-xl ×16, attachemator ×4, pose-ik ×3, motion-inspector ×3, AnimXL.jsx ×3, and others. Reversed order at `node-clipboard.js:83` and `node-id-order.js:34`. **Identical** inside a document, because `normalizeModel` aliases the two (`editor-document.js:165`). **Owner:** `animation.js` `nodePivot(model, nodeOrId)` and `worldPivot(model, id, matrices)`.

## 19. Unique-name generation — Low

`glow-up.js:179-183` (`"Name 2"`, all nodes), `app/portrait-background.js:186` (`"Name2"`), `node-clipboard.js:73-78` (`"Name_copy2"`), `dummy-bone.js:18` (`"DummyBone_2"`), `bone-tools.js:23-28` (`bone_newN`, bones only), `sequence-editor.js:73-75` (`New Sequence N`), `app/AnimXL.jsx:421` (`"Name (AnimXL 2)"`), `editor-document.js:1105` (`_import`, no uniqueness check). Every copy is case-sensitive. **Divergent schemes, all plausible.** **Owner:** `src/node-hierarchy.js` or `bone-tools.js` `uniqueName(taken, base, format = n => \`${base} ${n}\`)`. Each caller keeps its format. Low value; do it opportunistically.

## 20. Texture slots, texture-ID remap, team-colour/glow predicates — Low–Medium

- Slot list `['TextureID', … 'ReflectionsTextureID']` appears **11×**: `mdx-compatibility.js:7` (exported), `editor-document.js:47`, `texture-references.js:1`, `sort-my-mess.js:17`, `geoset-operations.js:4`, `bits-and-parts.js:11`, `model-optimizer.js:12`, `node-clipboard.js:6`, `particle-recipes.js:10`, `clipboard-paste.js:76`, `uv-preview.js:142`. **Identical**, so import `TEXTURE_SLOTS` from `mdx-compatibility.js`.
- The texture-ID remap over slots, `_MdxDefaults` and keyframe tracks is reimplemented at `sort-my-mess.js:437-440` (remaps only `key.Vector`, not tangents), `bits-and-parts.js:20-25,167-174`, `geoset-operations.js:24-30`, `particle-recipes.js:70-74`, `model-optimizer.js:100-104` and the import paths in finding 1. `texture-references.js:3` `visitTextureReferences` already does this, and also covers PE2 `TextureID`. It has only two users (`sort-my-mess`, `particle-picture`).
- The "team-glow geoset" predicate **diverges**:
  - `auto-corpse.js:24`: *every* layer is RID 2 **or FilterMode ≥ 3**, so any additive geoset counts as glow.
  - `glow-up.js:28`: *some* layer is RID 2.
  - `glow-up.js:37`: some layer is RID 2 *and* FilterMode ≥ 3.
  - `paint-materials.js:45`: *every* layer is RID 2.
  - `geoset-animation-repair.js:46`: RID 2 split by filter.
  - None of them handle a layer whose `TextureID` is a track (`model.Textures[track]` is `undefined`).
- Texture labels: `resource-relations.js:1` `textureName` ("Team color"), `uv-tools.js:14-18` `textureLabel` ("Team Color"), and `sort-my-mess.js:41-50` `textureIdentity`. The different casing means two separate translation keys.

**Owner:** `texture-references.js` for `visitTextureReferences` (more callers) plus `isTeamColorLayer` / `isTeamGlowLayer(model, layer)` that resolve track `TextureID`s. Each feature keeps its own "geoset is glow" aggregation, but over the shared layer predicate. **Tests:** `test/sort-my-mess.test.js`, `test/glow-up.test.js`, `test/auto-corpse.test.js`, `test/paint-*.test.js`, `test/geoset-animation-repair.test.js`.

## 21. "Keys inside an interval" — Low

`Keys.filter(k => k.Frame >= a && k.Frame <= b)` appears **27×**. The bulk is OptimizeXL (spline-tracks ×3, snaps ×3, checker-repairs ×3, redundant ×2, animation ×2, and others), plus sort-my-mess ×3, sequence-editor ×2, motion-inspector ×2, particle-recipes, `anim-xl.js:498` and `app/showcase-effects.js:11` `localKeys`. `optimizexl-motion.js:15` `inInterval` already exists. **Identical.** **Owner:** `animation.js` `keysInInterval(track, interval)`. Because keys are sorted, it can reuse `sampleTrack`'s binary search. Optional.

## 22. vec3 helpers and `faceNormal` — Low

- `cross`/`dot`/`sub` are redefined in `forge-detail-editing.js:7`, `forge-shape-editing.js:8`, `mesh-density.js:155`, `mesh-tools.js:4-6` and others. 2-D `cross` is redefined in `forge-geometry.js:7` (exported), `forge.js:96,108` and `sd-kit.js:112`.
- `faceNormal` exists twice. `paint-projection.js:23-28` returns **`[0,0,0]`** for a degenerate triangle (divides by `||1`). `paint-uv-atlas.js:4-10` uses epsilon 1e-8 and returns `[0,0,1]`.
- **Owner:** `src/vec3.js`, or reuse `forge-geometry.js` for 2-D. Low value.

## 23. `createRigNode` repeats `createNode`'s bind-pose extension — Low

`bone-tools.js:29-40` takes `BindPoses` aside, calls `createNode`, then extends each pose itself. `editor-document.js:826-831` already extends the poses. Both produce `id - cameraStart + 1` identity matrices before the camera block on consistent files, so the result is **equal**. They differ only when `Matrices` is shorter than the node ids: `createNode` then overwrites `Matrices[id]`, while `createRigNode` keeps it. **Owner:** keep `createRigNode`'s version, the safer one, inside `createNode`, and drop the temporary detach. **Tests:** `test/bone-tools.test.js`, `test/editor-document.test.js`.

## 24. Shallow "preview model" copies — Low

`pose-ik.js:520-529` `posePreviewModel` copies node records in every node collection, including `Nodes`. `app/AnimXL.jsx:93-99` `withTracks` patches only `Bones` and `Helpers`, so `Nodes` still points at the old records. This works only because `allNodes` lets later collections overwrite `Nodes` entries. **Owner:** `withTracks` = `posePreviewModel(model)` followed by assigning tracks to the copied nodes.

## 25. Inspector sequence edits bypass the sequence-editor validators — Low–Medium

`app/Inspectors.jsx:56`: `mutate('Rename sequence',['Sequences'],()=>s.Name=v)`, and `s.Interval[0]=v` / `s.Interval[1]=v`. The Animations sidebar uses `setSequenceName` (`sequence-editor.js:36-44`), which strips newlines and NUL characters, refuses empty names and enforces the 79-byte limit. It also uses `setSequenceInterval` (`:26`). `validateModel` catches bad intervals, but not over-long or multi-line names; those surface only at save time. **Fix:** call the existing functions. **Tests:** `test/sequence-editor.test.js`.

## 26. `apply(label, sections, mutator)`: `sections` is advisory — Low–Medium (plumbing)

`EditorDocument.apply` (`editor-document.js:400-448`) diffs the **whole** model through `createChanges` and records `changed`. The caller's `sections` is stored only as `requestedSections` (`:447`), and no code reads it back. One side effect does depend on the declared list: `App.edit` (`app/App.jsx:433`) runs the portrait-extent refresh only when `sections.includes('Nodes')`. An edit that moves nodes but declares, say, `['Bones']` skips that refresh. Call sites keep long hand-maintained lists (`app/AnimXL.jsx:423`, `GLOW_SECTIONS`, …) that otherwise do nothing. **Proposed:** keep the parameter, and have the portrait refresh check the *actual* changed sections, either by having `apply` pass `changed` to a post-commit hook or by reading `doc.history.at(-1).sections`. **Tests:** `test/editor-document.test.js`, `test/portrait-extents.test.js`.

---

## Layering

### L1. `src/` importing from `app/` — Medium
- `src/particle-sweep.js:4` `import {samplePreviewMatrices} from '../app/preview-pose.js'`. `preview-pose.js` is pure model maths: billboard and inheritance on top of `sampleNodeMatrices`, with no React or DOM.
- `src/world-editor-catalog.js:1` `import { parseSlk } from '../app/event-preview-data.js'`. `parseSlk` is a pure SLK parser.

**Fix:** move `preview-pose.js` (or just `samplePreviewMatrices` and `billboardCameraCorrection`) and `parseSlk` into `src/`, and have `app/` re-export them so other imports keep working. **Tests:** `test/particle-sweep.test.js`, `test/world-editor-catalog.test.js`, `test/game-file-library.test.js`.

### L2. Pure model logic in `app/` — Low–Medium
- `app/portrait-background.js`: 21 model-collection accesses. It creates bones, materials, geosets and GeosetAnims, and has no React. It belongs beside `src/portrait-extents.js`.
- `app/AnimXL.jsx`: `withTracks` (93), `weaponTip` (102), the copy-name logic in `commitAsNew` (418-421) and `addSoundEvent` (405) are model logic inside a component.
- `app/ResourceEditors.jsx:150-175`: inline node, geoset and sequence creation (finding 10).
- `app/model-save.js` and `app/sequence-actions.js` are thin app glue and in the right place.

---

## Already shared and good

- **`sampleTrack`** (`animation.js:5`) is imported by about 60 modules, and no private interpolator was found. Hermite, Bezier and squad exist only here; `anim-xl.js:998` `squad` is a separate fitting helper for AnimXL's key reduction, not a sampler. **`sampleNodeMatrices`, `skinGeoset`, `skinGeosetNormals`, `sampleGeosetAnimation` and `allNodes`** are shared the same way, apart from the copies in finding 4.
- **One commit path with undo**: every model change goes through `EditorDocument.apply`. No code writes `doc.model` directly (checked across `app/` and `src/`). Features either expose pure `(model) => …` mutators that `App.edit` wraps (AnimXL, Auto Corpse, Sort My Mess, NormalsXL, Attachemator, Glow Up), or take the document and call `doc.apply` once (OptimizeXL on a working copy, `model-optimizer`, `paint-model-integration`, `starter-model`, Collect Bit). Lab documents use the consistent `edit ? edit(...) : doc.apply(...)` fallback (`ParticleEditor.jsx`, `ResourceEditors.jsx`). `HistoryStore` is used only by `EditorDocument`. `createChanges` is reused as the diff engine (`portrait-extents`, AI review, `ai-model`, `ai-versions`). Tool windows that keep their own Undo (AnimXL settings, ShapingDialog, PaintCutoutEditor, Forge preview) hold preview or settings state only, not the model.
- **Deep copies**: `structuredClone` everywhere. There are no `JSON.parse(JSON.stringify())` round trips. The `const clone = v => structuredClone(v)` alias in 9 files is harmless.
- **Rig recognition**: `pose-ik.suggestPoseRig`, `poseNodeRole` and `poseChainIds` are shared by Attachemator, Auto Corpse geometry, AnimXL, the POSE overlay and portrait camera editing.
- **Geoset merge primitives**: `appendGeosetGeometry` (editor-document) and `unionAnimatedExtents` (geoset-operations) are shared by Sort My Mess and Merge Similar.
- **Geoset animation defaults**: `createVisibilityGeosetAnimation` and the colour-default family in `geoset-animation-defaults.js` (4+ callers).
- **`recalculateExtents`** (15 callers). **`createSequence`** is reused by Bits and Parts and by the shared Create action (`app/sequence-actions.js`). **`setAnimationSequences`** is reused by Sort My Mess.
- **Record preservation**: `record-preservation.js` is used only by the save path; no feature re-does MDX/MDL byte preservation. Features keep `_MdxDefaults` when cloning, through the same pattern (finding 20).
- **`node-hierarchy.js`** (`nodeHierarchyRows`, `downstreamBoneIds`) is the right home for finding 3.
- **`visitTextureReferences`** and **`partBones` / `geosetBoneIds`** exist and are correct; they just need more callers (findings 2 and 20).

## Suggested order (smallest, safest first)
1. Identical swaps with no behaviour change: finding 4 (matrix composition), 16 (key lists), 17 (transform defaults), 18 (pivot), 8 (the three identical `canonical` copies and the seven typed-json copies), 20 (the `TEXTURE_SLOTS` import), `portrait-extents` → `portraitSequenceIndices`.
2. Shared primitives with the current per-caller policy passed in: finding 2 (`vertexBones` with `minWeight`), 5 (`isGlobalTrack`), 7 (`removeGeosets`), 11 (`ensureGeosetAnimation`), 12 (`visitTracks`), L1 (move the two app modules into `src/`).
3. Owner decisions, because behaviour would change: finding 6 (which Stand / Death), 13 (Inspector normals), 15 (weapon vocabulary false positives), 8 (Sort My Mess and Merge Similar sharing one material key), 1 (import reuse policy).
