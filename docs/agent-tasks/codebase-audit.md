# MDLxL codebase audit and repair plan

Status: audit complete, plan final after the owner review of 2026-10-29 (decisions in
section 5, plan changes in section 7 "Review notes"). Wave 0 packages launched 2026-10-29.
Revision audited: `origin/main` at `fe46a534` (0.35.0), 2026-10-29.
Branch: `claude/codebase-audit` (this document and the evidence folder only; no code changed).
Session: claude local_2ff36156-d295-4751-9c75-28b35fe8316d

Evidence: seven area reports with `file:line` for every instance live in
[codebase-audit/](codebase-audit/) (01 math helpers, 02 Electron plumbing, 03 AI subsystem,
04 React shell and UI, 05 preview and render stack, 06 model core and features, 07 tests,
scripts, CI and docs), plus the mechanical scans (`dupscan-*.txt`, `unused-exports.txt`,
`dupscan.mjs`). Finding ids below (for example `06-#3`, `02-F4`) point into those files.
Nothing was built, run or packaged for this audit; all statements come from reading code.
Items marked **ready to test** need a look in the packaged app.

---

## 1. The short version (for the owner)

MDLxL is not rotten. The core is in better shape than feared: one undo path, one track sampler,
one camera-control class, one translation adapter, every IPC channel wired both ways,
`structuredClone` everywhere. The mess is around the edges, where features were built in
separate sessions and each copied what it needed instead of calling a shared piece.

- **About 155 findings, 13 high.** Roughly 300 duplicated call sites in `src/`, 160+ test files
  that copy the same launch boilerplate, and one whole file (`PaintViewport.jsx`) that is a
  stale copy of another (`Viewport.jsx`).
- **About 22 of the duplicates have already drifted into likely bugs** (section 4). Three are
  visible today: white fringes on cut-out textures in Citadel Paint, event-spawned models with
  the wrong team colour, and the Y axis label glowing pure green in dark themes.
- **The packaged test suite mostly tests the development build**, not the release ZIP. 99 of
  164 harnesses fall back to dev Electron because 19 different variable names decide which exe
  to launch.
- **The agent task index is stale**: 9 of 10 "current" tasks are merged, and 16 notes still say
  "awaiting merge".
- **The plan is 24 work packages in three waves**, each one agent, one branch, one PR, smallest
  change, no behaviour change unless listed. The 19 decisions were answered on 2026-10-29 (section 5).

---

## 2. Health scorecard

| Area | Lines | What is already right | Where the screws are loose | High |
| --- | --- | --- | --- | --- |
| Math and generic helpers (01) | — | `structuredClone` uniform (246 sites); quaternion and matrix maths all through three.js; one `createNode` id owner | No `src/math.js` or `src/vec.js`: game-path key copied 36×, `clamp` 16×, vec3 helpers verbatim in 3 Forge files, normalize has 7 zero-length behaviours, quaternion distance 2 formulas | 3 |
| Electron main and bridge (02) | 3.9k | Every channel has a handler and every push a listener; `src/` never touches `window.desktop`; one profile path; one dialog localiser | 12 atomic-write copies with 5 behaviours; CASC fingerprint 6×; installation order decided 4 ways; IPC error prefix shown to users; no renderer adapter (243 direct calls, 5 detection styles) | 0 |
| AI subsystem (03) | 9k | `ai-process.cjs`, `callEditorTool`, `AiRecorder`, `ai-birds.json` table pattern, `handle()` guard | Provider dispatch 4×, one-shot call 3×; transcript reduced twice (main and renderer, already drifted); provider names in 20 places; `ai-service.cjs` holds 16 jobs | 2 |
| React shell and UI (04) | 12k + 440 KB CSS | `useMovableWindow`, `Fields.jsx`, `EditorControls.Tool`, `HotkeysProvider`, `localizedCreateElement`, `useUpdates` | 17 tool windows bypass the hotkey system; 4 modal shells, 3 opening mechanisms; 9 number fields, 7 sliders, 8 dismiss copies; 21 localStorage keys, 6 helper pairs; 9 CSS backdrops; `App.jsx` 100 states, 90-prop bag | 2 |
| Preview and render (05) | 7k | Every 3D preview uses `EditorCameraControls` (mouse rotation safe); one render scheduler; one capture path; Forge, Bits, Showcase, UV all reuse Viewport or GamePreview | `PaintViewport.jsx` is a frozen fork (495 identical lines, 10 drift points); scene boilerplate 3×; 4 texture decoders; team glow 4 ways; 6 modules patch `war3-model` | 1 |
| Model core and features (06) | 20k | `sampleTrack` (60 importers), `EditorDocument.apply` is the only write path, rig recognition shared, merge primitives shared | Node-hierarchy walks 45× (map rebuilt 30×); "bones of a vertex" 19× with 3 thresholds; "is global track" 4 semantics over 50 sites; cross-model import 4× with different reuse rules; Stand/Death detection differs per feature | 3 |
| Tests, scripts, CI, docs (07) | 500 test files | `playwright-variant.cjs`, isolated profiles, empty known-failures baseline, map links all valid, README version consistent | Packaged suite runs dev build for 99/164 harnesses; no `test/helpers/`; fiber probes hand-written 130×; temp files on C:; stale task index; 7 CI steps duplicated | 2 |

---

## 3. Cross-cutting themes

These are the patterns behind most findings. Each repair package in section 6 addresses one.

**A. "Copy the helper" instead of "import the helper".** Path key, clamp, vec3, CRC-32,
Euler conversion, pivot lookup, texture slot list, transform defaults, matrix inheritance.
Most copies are byte-identical, so they merge with no behaviour change (01-H3, 01-M1, 01-M2,
01-M5, 06-#4, #16, #17, #18, #20).

**B. Model-walking re-done per feature.** Node lookup, parent chain, depth, root, descendants,
vertex-to-bone resolution, "is this track global", sequence classification, geoset removal,
GeosetAnim lookup. Here the copies disagree on edge cases (cyclic rigs, truncated weight arrays,
invalid global ids, "Death Alternate"). The fix is one primitive per job in `src/node-hierarchy.js`,
`src/part-bones.js`, `src/animation.js`, `src/sequence-editor.js` and `src/editor-document.js`,
with each caller's current policy passed as an option (06-#2, #3, #5, #6, #7, #11, #12).

**C. Shared systems that windows bypass.** The hotkey dispatcher, the `Dialog` shell, the
`Fields.jsx` controls, `bindScrollSensitivity`, `rotation-drag.js`, `EditorCameraControls`,
`partBones`, `portraitSequenceIndices`, `visitTextureReferences` all exist and work; many tool
windows and features simply do not call them (04-F1 to F5, 05-F3, 06-#2, #6, #20).

**D. The fork.** `PaintViewport.jsx` was copied from `Viewport.jsx` and never followed its fixes
(05-F1). Half of Paint's copy is unreachable with the props Paint passes.

**E. Plumbing written per call site.** Atomic writes, serial queues, operation tracking, sender
guards, request/reply protocols, listener boilerplate, dialog wrappers, provider dispatch,
one-shot AI calls (02-F4 to F11, 03-F1).

**F. State in two places.** Preferences on disk and in localStorage; three preference validators
with different rules; AI transcript built in main and again in the renderer; awareness flag in
four places; `apply(sections)` advisory but relied on (02-F14, 03-F2, 03-F16, 06-#26).

**G. The test suite grew the same way.** 186 harnesses create their own profile, 162 load
Playwright themselves, 130 walk React fibers by hand, 19 variable names pick the exe (07-T1 to T3).

**H. Docs lag merges.** Merging is automatic; the note update is not (07-D1, D2).

---

## 4. Likely bugs found along the way

Found by reading; none reproduced. Each is a one-line fix inside its repair package, but the
owner should know they exist. **Visible today** means a user can see it without special setup.

| # | Where | What | Visible | Package |
| --- | --- | --- | --- | --- |
| B1 | `PaintViewport.jsx:858` | Alpha-to-coverage on every layer; Viewport's own comment says this leaks white edges on cut-out textures | yes | WP-2.1 |
| B2 | `PaintViewport.jsx:243` | Ortho framing ignores window shape; tall Paint panels crop the model | yes | WP-2.1 |
| B3 | `event-preview-runtime.js:231` | Spawned event models get linear team colour, so non-red teams look darker than the unit | yes | WP-1.9 |
| B4 | `styles.css:31` vs `theme.css:108` | Dark themes: Y axis label is pure `#00ff00` while X and Z use the theme's soft colours | yes | WP-0.3 |
| B5 | 4 CSS files | `--selection`, `--error`, `--ui-error`, `--ui-text-muted` are never defined, so those spots ignore the theme | yes | WP-0.3 |
| B6 | `EmitterTextDialog.jsx:37` | Looks modal but has no `aria-modal`; editor shortcuts can run behind it | ready to test | WP-2.6 |
| B7 | all `ipcRenderer.invoke` errors | Users see `Error invoking remote method 'model:open': Error: …` prefixes | ready to test | WP-1.5 |
| B8 | `main.cjs:130`, 11 other writers | `recent.json` written non-atomically; Windows EPERM rename retry exists in one writer only | rare | WP-2.4 |
| B9 | `main.cjs:306-350`, `particle-library.cjs:165` | With a custom CASC source added, Library browser reads the Settings install while Texture Library and particles read the custom one | yes, with custom CASC | decision D2 |
| B10 | `bone-tools.js:23` | New `bone_newN` checks only Bones, so it can collide with a Helper or Attachment of that name | rare | WP-2.2 |
| B11 | `glow-up.js:15`, `attachemator.js:38` | Weapon regex matches `Bone_Elbow_R` (bow), `Bone_Balance` (lance) | yes, on such rigs | decision D7 |
| B12 | `ResourceEditors.jsx:162` | Add sequence never fills per-geoset extents; OptimizeXL then flags the model | yes | WP-2.3b |
| B13 | `Inspectors.jsx:56` | Sequence rename and interval edits skip `setSequenceName`/`setSequenceInterval` validation; bad names surface only at save | yes | WP-2.3b |
| B14 | `editor-document.js:447`, `App.jsx:433` | `apply(sections)` is advisory; the portrait-extent refresh depends on the declared list | rare | WP-2.3b |
| B15 | `scripts/run-packaged-tests.mjs` | 99 of 164 harnesses launch dev Electron, so release variants do not test the release | CI blind spot | WP-1.7 |
| B16 | `editor-document.js:894` | Degenerate normal keeps tiny x and y, only z is set to 1 | rare | decision D1 |
| B17 | `ai-service.cjs:388` | In Offload mode `taskInfo` can persist the organiser's task as interrupted while it runs | small | WP-2.5 |
| B18 | `ai-providers.cjs:75`, `AiAssistant.jsx:132` | Tool details truncated at 4000 chars then `JSON.parse`d; long plans show raw JSON | yes, long plans | decision D13 |
| B19 | `pose-ik.js:618` | `descendantOf` rebuilds the node map on every call inside loops (O(n²)) | slow on big rigs | WP-2.2 |
| B20 | `Viewport.jsx:172,1078` | Renderer is `antialias:false` but effects still depend on the setting; toggling rebuilds for nothing | minor | decision D9 |
| B21 | 6 Stand pickers | `paint-view` picks `Stand Ready`, ParticleEditor and Attachemator pick `Stand` on the same model | yes | decision D5 |
| B22 | `pose-ik.js:27` | Refuses inherited-transform flags with a reason that is no longer true | message only | WP-1.3 |

---

## 5. Decisions needed from the owner before the related work starts

All 19 answered by the owner on 2026-10-29 (walkthrough session). Answers that differ from
the default are in bold; see the review notes in section 7 for what they change in the plan.

| # | Question | Default if you say "your call" | Owner's answer | Blocks |
| --- | --- | --- | --- | --- |
| D1 | Game-path key: three sites turn a missing name into `"undefined"` or throw. Make all give `''`? Also B16 normal fallback. | Yes, `''`; fix B16 to zero x and y | **Decided:** yes (default) | WP-1.2 |
| D2 | Which Warcraft installation should particles and the Texture Library read when a custom CASC source exists: the Settings folder (like the Library browser) or the custom one? | Settings folder first, everywhere | **Decided:** Settings folder first, everywhere (default) | WP-2.4 |
| D3 | Empty geoset extents: zeros (Recalculate extents) or ±Infinity (`updateBounds`, `classic-mesh`)? Changes saved bytes for that edge case only. | Zeros | **Decided:** zeros (default) | WP-2.3b |
| D4 | Inspector "Recalculate normals" uses an area-weighted sum; NormalsXL uses the SD-style unit sum. Switch the button to NormalsXL defaults, or rename it? | Rename to "Quick normals" and leave the maths | **Decided: switch the button to the NormalsXL (SD-style) maths**; one way of doing it, matches SD | wave 3 |
| D5 | Unify Stand / Death / Decay / Portrait detection across features (the shared rule would be Attachemator's)? Changes which clip some features pick. | Unify, with Attachemator's rule | **Decided:** unify with Attachemator's rule (default) | wave 3 |
| D6 | Sort My Mess and Merge Similar: one "same material" key? They treat missing materials differently today. | One key, Sort My Mess's `missing` policy as an option | **Decided: no, keep them separate.** Merge Similar is the quick "merge these geosets" tool, Sort My Mess is for sorting out a messy model; different jobs, own checks | wave 3 |
| D7 | Fix weapon-name false positives (`Elbow`, `Balance`)? Changes Glow Up and Attachemator rankings on affected rigs. | Fix, word-boundary tokens | **Decided:** fix, word-boundary tokens (default) | wave 3 |
| D8 | 2D image zoom in Paint and Forge mask editor: follow the Wheel sensitivity and Mouse settings like the UV editor does? | Yes | **Decided:** yes (default) | wave 3 |
| D9 | Viewport antialias: restore the setting, or drop the dependency? | Drop the dependency | **Decided: neither; make the setting real everywhere, with sharp overlay lines**, plus a first-run choice and a toolbar switch (new package WP-3.10, see review notes) | WP-1.9 → WP-3.10 |
| D10 | Vertex click rule: editor uses Manhattan 5 px, previews Euclidean 7 px. One rule? | Leave both, document | **Decided:** leave both, document (default) | wave 3 |
| D11 | Settings number fields and Showcase number fields commit on every keystroke; the rest commit on blur/Enter. Unify? | Leave as is | **Decided: unify; Settings and Showcase number fields commit on Enter/blur like the rest** | WP-2.6 |
| D12 | Should all sliders look alike (they already behave alike after WP-2.6)? | No | **Decided: yes, all sliders look alike** (one shared look from the theme variables) | WP-2.6 |
| D13 | AI: live errors shown inline like after reload? Sign-in pre-check: drop or cache? Routing JSON leniency? Atomic `connections.json`? Tool detail short line? | inline yes; cache; keep strict; atomic yes; short line yes | **Decided:** all five defaults (inline yes; cache; keep strict; atomic yes; short line yes) | WP-2.5 |
| D14 | Delete the dead OptimizeXL save validator (`electron/optimizexl-validation.js` plus its build and package steps)? | Delete | **Decided:** delete (default) | WP-0.2 |
| D15 | Delete the unused detached UV window (`openDetachedUVWindow`) or is it a planned option? | Delete | **Decided:** delete, not planned (default) | WP-0.2 |
| D16 | Tests: add one small app-side test hook (`window.__mdlxl`) so harnesses stop walking React fibers? Adds ~20 lines of product code. | Yes | **Decided:** yes (default) | WP-1.7 |
| D17 | Keep the localStorage mirror of preferences on desktop (two sources of truth) or browser-only? | Browser-only | **Decided:** browser-only (default) | WP-2.4 |
| D18 | Should UV split percentages and AI panel width join exported preferences? | No | **Decided:** no, leave them out (default) | WP-1.6 |
| D19 | Preload error unwrapping (B7) changes the wording users see in error toasts. OK? | Yes | **Decided:** yes (default) | WP-1.5 |

---

## 6. Repair plan

### Rules for every work package

- One package = one agent, one branch `claude/audit-<id>`, one PR into `main`, `Session:` line,
  smallest change, **no behaviour change unless the package says so**. Audit code is a repair,
  not a redesign: no new panels, no new control schemes (AGENTS.md).
- The agent reads only: this file's package entry, the finding ids it names in `codebase-audit/`,
  the matching [map](../agent-map.md) row and the owner rules in `AGENTS.md`. Not the whole audit.
- Each package keeps `src/vendor/`, OptimizeXL rule bodies ([teaching agreement](../OPTIMIZEXL_TEACHING.md))
  and the immutable flail baseline untouched. OptimizeXL files may only swap in a shared primitive.
- Before opening the PR: `pnpm run build`, `pnpm test`, `pnpm run test:source`, the focused tests
  named in the findings, and `pnpm run test:packaged default <names>` for any renderer or Electron
  change (hidden desktop, never on screen). Report checks run and gaps; say **ready to test** for
  visible changes with a plain click-through list.
- Source-text tests to update alongside moves: 11 tests grep `App.jsx` (list in 04-F8),
  `test/paint-contract.test.js` greps `main.cjs` and `PaintViewport.jsx`,
  `test/local-portrait-frame.test.js` and `test/desktop-native-rescan.test.js` run slices of `main.cjs`
  in a vm, `test/uv-camera-preservation.test.js` greps `GamePreview.jsx`.
- Packages in the same wave touch disjoint files and can run in parallel. Waves are sequential.
  Each package updates the matching map row and marks itself done in section 7.
- Thinking levels: **low** = mechanical, well-specified; **medium** = many files, judgement on
  call sites; **high** = behaviour-sensitive refactor or subtle ordering; **xhigh** = the one
  package where ordering bugs would be invisible in tests.
- Models: Sonnet for mechanical and docs work, Opus for behaviour-sensitive refactors and all
  review passes. No Fable agents.

### Wave 0: zero-risk cleanup (parallel, 4 agents)

| Id | Package | Findings | Files | Agent | Thinking |
| --- | --- | --- | --- | --- | --- |
| WP-0.1 | **Docs sweep.** Empty the task-index table to the one live row; set `Status: completed — merged in #n` on 16 notes and move in-flight bullets under History; fix the two self-contradicting notes; merge the two AI map rows; correct PACKAGED-TESTS.md wording; add the post-merge rule ("after merging, mark the note completed and remove its README row") to CLAUDE.md's merge bullet and AGENTS.md; CLAUDE.md "at release" → "after publishing"; fix the 25 + 17 dead anchors; `package.json` engines `>=22.12`. | 07-D1, D2, D3, D4, D5, D6, S2 | `docs/agent-tasks/*.md`, `docs/agent-map.md`, `docs/PACKAGED-TESTS.md`, `CLAUDE.md`, `AGENTS.md`, `docs/COMMUNITY_RESEARCH.md`, `docs/RELEASE-HISTORY-LEGACY.md` | Sonnet | low |
| WP-0.2 | **Dead code and trivial deletions.** Runner `forge-glow` entry; `rotation-local`/`rotation-editors` → `test/helpers/` (or SKIP); duplicate `test:compatibility` script; delete `package-lock.json`, point THIRD_PARTY_NOTICES at pnpm lock; `neutralTextColor`; `mdlxl-particle-mode` write; `mdlxl-uv-key` dispatch; AI `waiting` emit; `imageExtensions` alias; `src/capture-settings.js` duplicate; dead compressed-texture branch (`GamePreview.jsx:1173`, `particle-picture-canvas.js:17`); `settings:get` comment as test-facing; particle indexer worker_threads entry. **Pending D14, D15**: validator and detached UV window. | 07-T4, T6, S2, S3; 04-F16; 03-F19; 02-F1; 05-F7 dead, F15 | small, scattered; no shared helper introduced | Sonnet | medium |
| WP-0.3 | **CSS tokens.** Delete `styles.css:30-31` axis override (B4); rename the 4 undefined vars to existing `--ui-*` tokens (B5); `--ai-*` as aliases of `--m-*`; add `.sr-only` and `.preview-fill` utilities and use them (10 + 5 sites); merge the byte-identical `smm`/`atm` overlay and window rules into one shared rule each (keep both class names as selectors). No layout change. **Ready to test**: dark, light and VIS themes, Sort My Mess and Attachemator windows. | 04-F11, F12, F10 (identical pair only) | `app/styles.css`, `app/theme.css`, `app/*.css` | Sonnet | medium |
| WP-0.4 | **AiAssistant double translation.** Remove the redundant `translate()` wrappers on DOM elements listed in 04-F13 (Mordor mode ciphers them twice). | 04-F13 | `app/AiAssistant.jsx` only | Sonnet | low |

### Wave 1: identical-body consolidations (parallel, 9 agents; after wave 0 merges)

| Id | Package | Findings | Files (owned by this package) | Agent | Thinking |
| --- | --- | --- | --- | --- | --- |
| WP-1.1 | **`src/math.js`, `src/vec.js`, `src/crc32.js`, `src/rotation-math.js`.** `clamp/clamp01/clampByte/lerp/smoothstep01/quantile`; n-dimensional `add/sub/scale/dot/cross/length/distance/lerp/unit` with the Forge `|| 1` zero rule; `crc32`; `quaternionToDegrees/degreesToQuaternion`. Switch only the byte-identical copies (01 lists them); leave every normaliser whose fallback differs. `forge.js` and `sd-kit.js` import `signedArea/pointInside/cross/segmentDistance` from `forge-geometry.js`; `forge-geometry` imports `forgeEdgeKey`; hoist `rotationOf` in `anim-xl.js`. Excludes `movement.js` and `animation.js` (WP-1.3). | 01-H3, M1 (plain copies), M2, M5, L1, L3, L4, L5, L8 | `src/forge-*.js`, `src/sd-kit.js`, `src/mesh-tools.js` (dot/cross only), `src/optimizexl-motion-context.js`, `-geometry.js`, `-snaps.js` (primitives only), `src/paint-project.js`, `src/forge-assets.js`, `src/particle-bindings.js`, `src/particle-editing.js`, `src/portrait-model-control.js:119`, `src/forge-primitives.js`, `app/ForgeEditor.jsx:48`, `app/editor-camera-controls.js:22`, `app/showcase-*.js` clamps, `app/KeyframeTimeline.jsx:11`, `app/GlowStageTools.jsx:8`, `app/uv-workspace-layout.js:9`, `app/event-preview-data.js:6` | Sonnet | medium |
| WP-1.2 | **`src/game-path.js` and `electron/game-path.cjs`.** `gamePathKey(value)` = `String(value || '').replaceAll('/', '\\').toLowerCase()`; `bits-and-parts.js` re-exports it as `partPathKey`. Switch the ~21 named copies and the inline sites. Fix the opposite-direction `slash` trap with two clearly named helpers. **Pending D1** for the three unguarded sites. Leave sites that also trim or strip. | 01-H1 | the 31 files listed in 01-H1 (renderer lines in `Viewport.jsx:48`, `PaintViewport.jsx:42`, `GamePreview.jsx:54` are one-liners; WP-2.1 rebases on this) | Sonnet | medium |
| WP-1.3 | **`src/animation.js` as the owner of node maths.** Export `inheritedParentMatrix(parent, flags)` and `composeNodeMatrices(model, ids, localTRS)`; `anim-xl.worldMatrices`, `movement.movementParentMatrix`, `preview-pose.inherited` call them. Export `TRANSFORM_DEFAULTS`, `sampleNodeProperty`, `nodePivot`, `worldPivot`, `NODE_COLLECTION_KEYS`, `keysInInterval`; switch the identical copies (06 lists them). `optimizexl-motion.js` and `-motion-context.js` import `rotationDistance` from `motion-inspector.js`; export the hand-rolled `trackValueError` once from `optimizexl-animation.js` for `optimizexl.js:81` and `-endpoints.js:8` (do not merge the two formulas; add the zero-quaternion comment). Correct the pose-ik message (B22) only. | 06-#4, #16, #17, #18, #21; 01-H2 | `src/animation.js`, `src/anim-xl.js`, `src/movement.js`, `app/preview-pose.js`, `src/pose-ik.js` (message + key list), `src/motion-inspector.js`, `src/keyframe-timeline.js`, `src/model-optimizer.js:151`, `src/optimizexl-animation.js`, `-endpoints.js`, `-motion.js`, `-motion-context.js`, `optimizexl.js:79-81`, `src/auto-corpse.js:129`, `src/editor-commands.js:1`, `src/portrait-extents.js:28` | Opus | medium |
| WP-1.4 | **Value identity, texture slots, layering.** `src/value-key.js` (`canonicalValue`, `stableKey`, `typedJson`) replaces the 3 identical `canonical` copies and the 7 identical typed-json copies; import `TEXTURE_SLOTS` from `mdx-compatibility.js` at the 10 other sites; `portrait-extents.js:7` → `portraitSequenceIndices`; `optimizexl-endpoints.js:9` → `optimizexl.js` `seqName`; move `samplePreviewMatrices`/`billboardCameraCorrection` and `parseSlk` into `src/` with `app/` re-exports. Leave `model-optimizer` and `motion-decisions` variants. | 06-#8 (identical only), #20 slots, #6 identical, L1 | `src/sort-my-mess.js:24-29`, `src/geoset-operations.js:7-13`, `src/bits-and-parts.js:13`, 7 `optimizexl-*` typed-json lines, `src/geoset-animation-repair.js:6`, the 10 slot-list sites, `src/portrait-extents.js`, `app/preview-pose.js` → `src/preview-pose.js`, `app/event-preview-data.js` (parseSlk) → `src/slk.js`, `src/particle-sweep.js`, `src/world-editor-catalog.js` | Sonnet | medium |
| WP-1.5 | **Electron small helpers in `main.cjs` and `preload.cjs`.** `installKey` exported from `casc.cjs` (6 copies); use `captureOperation`/`trackTextureOperation` at the 6 inlined sites; `editorOnly(event, msg)` for the 13 guards; `sendToEditor`; `appFolder/showcaseRecordings/headless/userRun` constants; `MODEL_EXTENSIONS` from `external-model-open.cjs`; preload `subscribe()`/`answer()` for the 12 listener copies; preload `call()` that strips the IPC error prefix (B7, **pending D19**); `showThemedPrompt` shared by close and welcome prompts. Keep `test/local-portrait-frame.test.js` vm slices working (define helpers inside the sliced range or add them to the vm context). | 02-F2, F5, F9, F10, F11, F12, F16 (model extensions), F18 | `electron/main.cjs`, `electron/preload.cjs`, `electron/casc.cjs` (export only), `electron/particle-source.cjs:7`, `electron/particle-library-worker.mjs:41`, `electron/external-model-open.cjs`, `electron/close-prompt.cjs`, `electron/welcome-prompt.cjs`, the three vm tests | Opus | medium |
| WP-1.6 | **React shell step 1.** Move `Dialog` verbatim to `app/Dialog.jsx` and delete the `Dialog` prop from the 6 components; `src/local-store.js` (`readStored/writeStored/useStoredState`, keys unchanged) replacing the 6 helper pairs and guarding the 2 unguarded sites; `app/useDismiss.js` for the 8 outside-click/Escape copies (ownerDocument, capture, stopPropagation on Escape); `app/focus-trap.js` `trapTab` for the 5 copies; `LoadingWindow` for the window-type Suspense fallbacks. Update the 11 `App.jsx` text tests. **Pending D18.** | 04-F2 step 1, F6, F7, F9, F15 | `app/App.jsx:131-134` + the prop sites, `app/AppDialogs.jsx`, `app/AppSidebar.jsx`, `app/AnimationController.jsx`, `app/SanityCheck.jsx`, `app/SaveEditorData.jsx`, `app/UpdatePrompt.jsx`, `app/GeosetTabs.jsx`, `app/UVWorkspace.jsx`, `app/GameFileBrowser.jsx`, `app/AnimXL.jsx` (storage lines only), `app/TextureLibrary.jsx`, `app/ShowcaseWorkspace.jsx:31-37`, `app/NodeEventEditor.jsx`, the 8 dismiss sites, the 5 trap sites, `app/AppPanels.jsx:51` | Opus | medium |
| WP-1.7 | **Test helpers foundation.** `test/helpers/app.cjs` (`appTarget` from one variable `MDLXL_TEST_EXE` with `MDLXL_SUITE_PKG` fallback then dev Electron, `launchApp`, `stubDialogs`, `clickMenu`, `sha256File`, `settle`, `closeApp` that deletes the profile), `fiber-probe.cjs` (or the app hook, **pending D16**), `model-fixtures.js`, `assert-near.js`, `temp.js` rooted at `MDLXL_TEMP || out/tmp`, `hive.mjs`, `pose-compare.mjs`, `fixturePath()`; the runner sets the one variable for every test and drops the exe rows from `SPECIAL`; wrapper harnesses that stub `main.cjs` opt out explicitly. Migrate the **pose family (8 files)** as proof, run `test:packaged default` and `release` before and after, expect and report new real failures. | 07-T1, T2, T3, T7, T8, T9, T12 | `test/helpers/*` (new), `scripts/run-packaged-tests.mjs`, `test/pose-*.electron.cjs`, `docs/PACKAGED-TESTS.md` (variable name) | Opus | medium |
| WP-1.8 | **AI service helpers.** `runProvider()` in `ai-providers.cjs` and `AiService.askOnce()` (4 + 3 sites); `toolSummary`, `providerImage`, one `IMAGE_DATA_URL` regex; `prepareEnvironment` in `ai-process.cjs`; `catalogKey`, `chatFile`, `CHAT_ID`, `addressedBird`, `MCP_TOOL_TIMEOUT_MS`, `apiBase`, `ANTHROPIC_HEADERS`; `setSwitch` behind the five toggles; `AI_ROUTER_PROMPT` and `AI_EDITING_INTRO/BODY` in `src/ai-tools.js` with a test that the assembled strings are byte-identical; `contextNote`, `memoryNoteText`, `CANCELLED`, `TOOLS_ONLY` constants. No product behaviour change. | 03-F1, F6, F10, F14, F17, F20, F22 | `electron/ai-service.cjs`, `electron/ai-providers.cjs`, `electron/ai-process.cjs`, `electron/ai-mcp.cjs` (regex export), `src/ai-tools.js`, `electron/ai-model-choice.cjs` | Opus | medium |
| WP-1.9 | **Preview small helpers.** Delete `src/capture-settings.js` duplicate (or make it the one owner); `capturePreviewThumbnail` for the 4 queues; `app/gl-utils.js` (`createGLProgram`, `uploadTexture`, `preserveGLState`); `app/war3-model-patches.js` (`guardRendererDestroy` ×3, `compensateRibbonWallClock` ×2) with a header comment listing which module owns which patch; `teamGlowFactor`, `teamColorPixels`, `DEFAULT_TEAM_COLOR` in `viewport-quality.js`, and `event-preview-runtime.js:231` switches to `nativeTeamColor` (B3, **ready to test**: spawn a blood or footprint event on a blue-team unit); Antialias (05-F19) is not part of this package: it moved to WP-3.10 (D9). Excludes `Viewport.jsx`/`PaintViewport.jsx` bodies (WP-2.1). | 05-F8, F9, F14, F15, F16 | `app/event-preview-runtime.js`, `app/EventDecalPreview.jsx`, `app/game-preview-background-gl.js`, `app/preview-scene-gl.js`, `app/rig-markers-gl.js`, `app/particle-*.js/jsx` (glow and thumbnail lines), `app/uv-material-preview.js:40-48`, `app/viewport-shared.js`, `app/viewport-quality.js`, `app/showcase-playback.js`, `app/node-effect-controls.js`, `src/update-popup-effects.js:109`, `GamePreview.jsx:102-115` and `:1366` only | Sonnet | medium |

### Wave 2: shared primitives with each caller's policy kept (parallel, 9 agents; after wave 1 merges)

| Id | Package | Findings | Files | Agent | Thinking |
| --- | --- | --- | --- | --- | --- |
| WP-2.1 | **Un-fork PaintViewport.** New `app/viewport-materials.js` with `textureFromAsset(asset, info, {fallbackDecoder})`, `layerMaterial(layer, shaded, {extendShader, cacheKey})`, `updateWideWireGeometry`, `configureWideLine` (always via `configureWideWirePattern`); `Viewport.jsx` re-exports so its 9 importers do not change; Paint passes `decodePaintBlp` and `applyPaintLightShader`. Both call `drawPreviewBackground`; both use `snapshotPreviewCamera/restorePreviewCamera` from `viewport-math.js`; `createEditorCameras`, `createEditorLights`, `watchContextLoss`, `applyCameraButtons`/`orbitMouseAction`, `scrollSensitivityCallbacks` + `SensitivityIndicator` shared by Viewport, Paint and GamePreview. Rename Paint's component to `PaintViewport`. Step 2 (separate commit, after owner OK): delete Paint's unreachable transform, anchor and playback branches. Brings fixes B1, B2, wire pattern, zero-normal shader and Grabthrough into Paint. **Ready to test**: Paint cut-out edges with antialias on, tall Paint panel in ortho, mouse rotate/pan/zoom in Viewport, Paint, GamePreview and Quad View, Showcase camera. | 05-F1, F2, F3, F4, F11, F12 | `app/Viewport.jsx`, `app/PaintViewport.jsx`, `app/GamePreview.jsx` (camera and sensitivity lines), `app/UVEditor.jsx:290-316`, `app/editor-camera-controls.js`, `app/viewport-math.js`, `app/viewport-performance.js`, `app/preview-lighting.js`, `app/game-preview-data.js`, `app/showcase-crop.js:30-33`, `test/paint-contract.test.js`, `test/uv-camera-preservation.test.js` | Opus | high |
| WP-2.2 | **Node hierarchy and vertex bones.** `src/node-hierarchy.js` gains `nodeIndex(model)` → `{byId, children, parentOf, ancestors, depth, root, isAncestor}` with one cycle rule (seen set) and one sentinel rule; switch the plain copies first (motion-inspector, corpse-geometry, attachemator, pose-recognition, rig-node-order, movement), then anim-xl and glow-up (cyclic-rig depth becomes true depth: a fix), then pose-ik (build the index once per public call: fixes B19). `src/part-bones.js` gains `vertexBones(geoset, vertex, {minWeight})`, `vertexBoneWeights`, `isHdSkinned`; switch the `> 0` group, then the thresholded callers with their exact numbers (Glow Up 128, Corpse 32, AnimXL radii 128). `uniqueName(base, used, format)` in `node-hierarchy.js`; `bone-tools.js` builds its used set from `allNodes` (B10). OptimizeXL files: walk helpers only. | 06-#2, #3, #19; 01-M6, M7 | `src/node-hierarchy.js`, `src/part-bones.js`, `src/resource-relations.js`, `src/pose-ik.js`, `src/anim-xl.js`, `src/attachemator.js`, `src/glow-up.js`, `src/corpse-geometry.js`, `src/movement.js`, `src/motion-inspector.js`, `src/rig-node-order.js`, `src/pose-recognition.js`, `src/bone-tools.js`, `src/binding-inspection.js`, `src/portrait-model-control.js`, `src/particle-ribbon-fit.js`, `src/dummy-bone.js`, `src/node-clipboard.js:73`, `app/AnimXL.jsx:93-111`, `app/portrait-background.js:186`, `optimizexl-exclusions.js:19`, `-skin-collapse.js:25`, `-snaps.js:19`, `optimizexl.js:68,109`, `-motion-context.js:185` | Opus | high |
| WP-2.3a | **Track primitives.** `globalSequenceId(track, model?)` and `isGlobalTrack` in `animation.js` using the `sampleTrack` rule; switch family A copies; export one `optimizexlLocalTrack` from `optimizexl-format.js` for the 10 OptimizeXL files (keeps the checker contract, do not merge A and B). `visitTracks(model, visit, {skip})` for `classic-keyframes`, `global-sequence-preview`, `animation-speed`, `sequence-editor.visitModel`. `makeKey(frame, value, lineType, property)` property-aware in `animation-tracks.js`, `keyframe-timeline` imports it. | 06-#5, #12; 01-M4, M8 | `src/animation.js`, `src/animation-tracks.js`, `src/keyframe-timeline.js`, `src/classic-keyframes.js`, `src/global-sequence-preview.js`, `src/animation-speed.js`, `src/sequence-editor.js` (predicate and walker only), `src/movement.js:210,282,345`, `src/motion-inspector.js:11`, `src/sort-my-mess.js:31`, `src/bits-and-parts.js` (5 predicate sites), `src/emitter-timing.js`, `src/geoset-extras.js`, `src/particle-sweep.js`, `src/node-clipboard.js:29`, `app/AnimationController.jsx:102,257`, `app/ParticleTimingTool.jsx:6`, `src/optimizexl-format.js` + the 9 other OXL `local` lines | Opus | high |
| WP-2.3b | **Geoset primitives.** `removeGeosets(model, removed)` in `editor-document.js` built from Sort My Mess's version; `deleteGeoset` wraps it; OptimizeXL checker repair, Sort My Mess and `mergeSimilarGeosets` call it. `ensureGeosetAnimation`/`geosetAnimationOf` in `geoset-animation-defaults.js`. `geosetBounds` + `fillSequenceExtents` (**pending D3**; until decided, keep `updateBounds`' empty behaviour behind an option). `createSequence(model, duration, {name, gap, template, nonLooping, extents})`; `ResourceEditors` Add sequence calls it (B12). Inspector sequence edits call `setSequenceName`/`setSequenceInterval` (B13). `checkedVertexSelection`/`gatherStreams` in `mesh-tools.js` with each caller's flags. `createNode` absorbs `createRigNode`'s safer bind-pose extension. Portrait refresh checks actual changed sections (B14). | 06-#7, #9, #10, #11, #14, #23, #25, #26; 01-M3 | `src/editor-document.js`, `src/mesh-tools.js`, `src/classic-mesh.js`, `src/editor-commands.js`, `src/bone-tools.js:29-40,72-79`, `src/geoset-operations.js`, `src/sort-my-mess.js:351,443`, `src/optimizexl-checker-repairs.js:65-79,221-226`, `src/optimizexl.js:90`, `src/auto-corpse.js:41-63`, `src/geoset-animation-defaults.js`, `src/sequence-editor.js:66-87`, `src/bits-and-parts.js:47,86,235`, `src/forge.js:257`, `src/glow-up.js:232`, `app/portrait-background.js:242,267`, `app/ResourceEditors.jsx:150-175`, `app/Inspectors.jsx:56`, `app/App.jsx:433` | Opus | high |
| WP-2.4 | **Electron file and settings plumbing.** `electron/atomic-file.cjs` `writeFileAtomic(file, data, {verify, backup})` = random temp + `wx` + EPERM-retrying rename + unlink on failure; switch the 12 writers (B8), re-export `atomic` from the particle worker for its test; `serialQueue()` alongside; private `cachedListing` in `casc.cjs` with a `keep` for sounds; `chooseSavePath`/`openFolder` in `main.cjs` (two dialogs gain the extension rule); `orderedCascFolders` in `game-data.cjs` with each caller's order named explicitly (**pending D2** before any order changes); preference limit constants exported from `src/preferences.js` and used by `SettingsStore` (one validator rule); `app/desktop.js` (`desktop`, `hasDesktop`, `resolveGameFiles`) and migrate the 8+ resolve-with-fallback sites only; `safeWindowsName`/`isWindowsName` in one CJS file. **Pending D17.** | 02-F3, F4, F6, F7, F8, F13, F14, F16 (filename rules) | `electron/atomic-file.cjs` (new), `electron/settings.cjs`, `session.cjs`, `recovery.cjs`, `texture-preview-cache.cjs`, `casc.cjs`, `particle-library.cjs`, `particle-library-worker.mjs`, `game-data.cjs`, `paint-textures.cjs:47`, `main.cjs` (writers, dialogs, folder order), `src/preferences.js` (export constants), `app/desktop.js` (new), the 8 resolve sites in 02-F13, `bits-and-parts.cjs`, `forge-assets.cjs`, `preview-capture.cjs`, `updater.cjs:59` (filename rule), `test/paint-contract.test.js:20` | Opus | high |
| WP-2.5 | **AI state and providers.** `src/ai-providers.json` table (`id, label, native, apiKey, baseUrl, effort, spendLimit, stepLimit, web, logFolders`) read by service, offload and console; `providerModels` handles Codex and new `providerAuth` in `ai-providers.cjs`; shared `applyAiEvent` reducer in `src/ai-transcript.js` used by `AiRecorder` and the console (write its unit test first; `error` stays out until D13); sign-in status cached in main, renderer pre-check dropped (D13); `taskInfo` also accepts `tasks.has(id)` (B17); `removeFiles` walker; `writeJsonAtomic` for `connections.json` (D13); `AI_HELPER_TOOLS`/`aiToolRunsUnqueued` co-located in `src/ai-tools.js`; `toolDetail` short `line` (D13, B18). Then the two file moves: part components to `app/AiParts.jsx`, chat cleanup block to `electron/ai-chats.cjs`. Console layout and `data-hotkey` attributes unchanged. | 03-F2, F3, F4, F5, F8 (steps 2, 4), F9 (step 1), F11, F12, F13, F15, F21 | `electron/ai-service.cjs`, `electron/ai-providers.cjs`, `electron/ai-offload.cjs`, `electron/ai-process.cjs:18`, `electron/ai-job-plan.cjs`, `src/ai-tools.js`, `src/ai-transcript.js` (new), `src/ai-providers.json` (new), `app/AiAssistant.jsx`, `app/AiParts.jsx` (new), `app/ai-editor.js:423`, `test/ai-transcript.test.js` (new) | Opus | high |
| WP-2.6 | **UI primitives.** `useDraftNumber` and `useRangeCommit` hooks in `app/Fields.jsx`; `PositionField` becomes `Coordinate` with `format`; `NumberRow`, `SpeedControl`, `ShowcaseNumber`, Settings `Numeric` and Showcase `NumberField` use `useDraftNumber`, so Settings and Showcase number fields now commit on Enter/blur like the rest (D11, behaviour change, **ready to test**). One shared `RangeField` (label, range, output) built from theme variables replaces the ribbon, AnimXL, Showcase and Paint `Slider` wrappers and `SpeedControl`'s range, so all sliders look alike (D12, visible change, **ready to test** in light, dark and VIS); `ParticleSlider` and `MeshDensitySlider` keep their richer contracts but adopt the look. `Section` gains `note`/`defaultOpen`, `Check` gains `description`/`id`; AnimXL `Section` and Settings `Toggle` become them with their class names. `app/ToolWindow.jsx` (overlay + section + movable header + × with `data-hotkey="close"`) absorbs the `re-window` trio and the `smm`/`atm` pair, emitting shared `.mdlxl-overlay`/`.mdlxl-window` classes next to the feature class; `PortraitSetup`, `EmitterTextDialog` (B6) and Showcase's `Dialog` render through `Dialog`; replace the 16-class lists in `new-look.css:199-203` with `.mdlxl-window`; three `--z-*` tokens. UV `Tool` renders `EditorControls.Tool` (icons unchanged). **Ready to test**: every window in light, dark and VIS; Escape and Tab inside each. | 04-F2 step 2, F3, F4, F5, F10, F14 | `app/Fields.jsx`, `app/EditorControls.jsx`, `app/MovementControllerRecomp.jsx:43-53`, `app/ParticleRibbonFields.jsx`, `app/ShowcaseNumber.jsx`, `app/ShowcaseWorkspace.jsx:40-61`, `app/Settings.jsx:74-79,327`, `app/AnimationController.jsx:36-69`, `app/AnimXL.jsx` (Slider, Section, window shell), `app/PaintStudioLayout.jsx:11-13`, `app/ToolWindow.jsx` (new), `app/ResourceEditors.jsx:210`, `app/ParticleEditor.jsx:318`, `app/SortMyMess.jsx:250`, `app/Attachemator.jsx:75`, `app/PortraitSetup.jsx`, `app/EmitterTextDialog.jsx`, `app/UVWorkspace.jsx:40-43`, `app/styles.css`, `app/theme.css`, `app/new-look.css`, `app/sort-my-mess.css`, `app/attachemator.css`, `app/resource-editors.css` | Opus | high |
| WP-2.7 | **Window keys through the hotkey system.** Window by window: Close buttons get `data-hotkey="close"` and the hand-written Escape branch goes; the three named pre-emption events become one `mdlxl-window-key` claim event with `detail.scope` (Showcase and Paint keep their claims, the dead UV one goes); AnimXL and Showcase local Undo/Redo/Play become window-scoped catalog actions so rebinding, badges and Learn apply. 17 windows listed in 04-F1. Preserve Escape ordering: AI drawing tool, Learn menu, bone-create menu, recording field. **Ready to test**: Escape, Ctrl+Z/Y and Space in every tool window; Keyboard Shortcuts settings show the new entries; Learn counts them. | 04-F1 | `app/Hotkeys.jsx`, `src/hotkey-allocation.js`, `src/commands.js`, `src/hotkey-defaults.js`, the 17 windows' close/key handlers, `app/PaintStudioLayout.jsx` (PaintKey integration), `app/ShowcaseWorkspace.jsx:68,480`, `test/hotkey-*.test.js` | Opus | **xhigh** |
| WP-2.8 | **Test harness migrations by family** (one Sonnet agent per family, run in parallel; each runs `test:packaged default <names>` before and after): (a) ai 12 + uv 15, (b) optimizexl 20 + citadel 10, (c) particle 15 + showcase 10 + forge 10, (d) everything else + port the two raw-CDP harnesses, merge `fixtures/` into `test/fixtures/`, `gameFolder()` for the 8 hard-coded paths, `scripts/lib/paths.mjs` + `digest` re-export, `fetch-ffmpeg` calls `verifyFFmpegBundle`, composite CI action + `packageManager`, `test/manual/` for the 12 private-model scripts with doc commands updated, delete `uv-camera-check.*`. | 07-T2, T3, T5, T9, T10, T11, S1, C1 | `test/*.electron.cjs` per family, `fixtures/`, `scripts/*.mjs`, `.github/workflows/*.yml`, `.github/actions/setup-build/` (new) | Sonnet ×4 | medium |

### Wave 3: behaviour changes the owner approved (after wave 2 merges)

| Id | Package | Decision | Agent | Thinking |
| --- | --- | --- | --- | --- |
| WP-3.1 | `App.jsx` hooks: `useEditorDisplay`, `usePortraitState`, `usePreferences`, `PreferencesContext` read by `GamePreview`/`Viewport`, `openHotkeySettings` on it (removes 8 `onHotkeys` closures). Last, because it touches `App.jsx` everywhere. | none, but after all wave 2 merges | Opus | high |
| WP-3.2 | Sequence classification owner in `sequence-editor.js` (`sequenceWords`, `isDeathSequence`, `isDecaySequence`, `isPortraitSequence`, `standSequenceIndex`), divergent callers switched. | D5 | Opus | high |
| WP-3.3 | Cross-model import owner `src/model-import.js` `createResourceImporter(source, target, {reuseTextures, reuseGlobals})` with each caller's current policy; then the policy question. | none for step 1 (policies kept); owner for step 2 | Opus | high |
| WP-3.4 | `isTeamColorLayer`/`isTeamGlowLayer` resolving track texture ids (each feature keeps its own "geoset is glow" aggregation); `visitTextureReferences` for the 5 remap copies. Sort My Mess and Merge Similar keep their own material keys (D6: no shared `materialKey`). | D6 answered: keep separate | Opus | medium |
| WP-3.5 | `src/rig-names.js` token vocabularies; Glow Up and Attachemator rankings re-checked on the SD corpus. | D7 | Opus | high |
| WP-3.6 | Inspector "Recalculate normals" button calls `planNormalRebuild`/`applyNormalRebuild` with NormalsXL defaults (90°); label unchanged; `editor-document.recalculateNormals` stays for Forge and shaping and gets a comment saying it is the quick area-weighted version for generated geometry. **Ready to test**: press the button on an SD unit and compare with NormalsXL. | D4 answered: switch the maths | Sonnet | medium |
| WP-3.7 | 2D image zoom in Paint image views and the Forge mask editor goes through `bindScrollSensitivity` with the UV editor's zoom step (`wheelZoomFactor` exported from `viewport-performance.js`); Forge's mask editor gains the wheel (D8). Vertex click rules stay as they are and are documented in the map row (D10). | D8, D10 answered | Opus | medium |
| WP-3.8 | `ai-service.cjs` editor-utility IPC handlers to `electron/ai-editor-ipc.cjs`; `AiConnectionSettings.jsx` extraction. | none, optional | Opus | medium |
| WP-3.9 | Storage key naming convention and the channel-naming convention written into the map; source test that fails when a preload channel has no handler or vice versa. | none | Sonnet | low |
| WP-3.10 | **Smooth edges (antialiasing) made real everywhere.** The setting works in every 3D view including `Viewport.jsx` (hard-coded off since `59cf9ce7`); the pointless rebuild on toggle stops; with smoothing on, only the model is multisampled and bones, wireframe, vertex dots, normals and editor lines stay pixel-sharp on their own layer (the `pixel-lines.js` way GamePreview already draws bone connectors); off by default stays, existing users keep their value; software rendering and low-power still force off; re-check `viewportPixelRatio` so "on" is not blurrier on HiDPI and `test/herrdave-render.test.js` HD06 still means something. First-run question in the existing welcome prompt with the owner's wording ("How should your models look?" → **Smooth** default / **Classic MDLVis**, note "You can change this any time in Settings → Graphics"), translated into the four languages. One toolbar quick switch next to team colour and language, existing button look, short tooltip, same preference; hidden in VIS. Full spec in the section 7 review notes. **Ready to test**: fresh-profile prompt, toolbar switch in XL and absent in VIS, crisp bones and wireframe with Smooth on, mouse rotation in every preview. | D9 answered | Opus | high |

### Review and gates

- **After each wave**: one Opus **high** review agent runs `/code-review` over the wave's PRs
  looking only for behaviour drift (changed edge cases, changed strings, changed defaults), and
  writes the owner's click-through list for the **ready to test** items into section 7.
- **Merge order inside a wave**: smallest diff first. A package that fails its focused tests is
  not widened; it is split.
- **Owner click-throughs** are batched per wave into one hand-test build (rapid-testable build,
  no release wait), never one build per package.
- Packaged tests run hidden (`pnpm run test:packaged`), never on screen; packaging fails
  silently while `MDLxL.exe` is open.

### Rough size

| Wave | Packages | Agents | Owner time |
| --- | --- | --- | --- |
| 0 | 4 | 4 Sonnet | one theme look |
| 1 | 9 | 5 Opus, 4 Sonnet | one hand-test build (B3, B7) |
| 2 | 9 (+3 parallel test agents) | 8 Opus, 4 Sonnet | one hand-test build (Paint, windows, sliders, keys) |
| 3 | 10 | mostly Opus | one hand-test build (normals, zoom, smooth edges prompt and switch) |

---

## 7. Tracker

| Package | Branch / PR | State | Notes |
| --- | --- | --- | --- |
| audit | `claude/codebase-audit` | plan final; PR open; wave 0 launched 2026-10-29 | the Fable session keeps this tracker current from the package sessions' reports |
| WP-0.1 docs sweep | `claude/audit-wp-0-1-*` | started | Sonnet low |
| WP-0.2 dead code | `claude/audit-wp-0-2-*` | started | Sonnet medium; D14, D15 = delete |
| WP-0.3 CSS tokens | `claude/audit-wp-0-3-*` | started | Sonnet medium; ready to test after merge |
| WP-0.4 AI double translate | `claude/audit-wp-0-4-*` | started | Sonnet low |

### Review notes (owner walkthrough, 2026-10-29)

Nothing was declared off limits and no package was dropped. Changes to the plan:

- **Likely bugs (section 4):** the owner wants every B-item fixed, whichever they had noticed;
  they did not single any out. Keep all B-items in their packages.
- **D4 → WP-3.6:** the Inspector "Recalculate normals" button switches to the NormalsXL
  (SD-style unit sum) maths instead of being renamed. Keep its current label. Already-saved models
  do not change; only the button's result does. Probably Sonnet **medium** rather than low (it has
  to call the NormalsXL path with its defaults, not copy it). **Ready to test**: press the button on
  an SD unit and compare with NormalsXL.
- **D6 → WP-3.4:** drop the shared `materialKey`. Sort My Mess and Merge Similar keep their own
  "same material" checks because they are different tools for different jobs. The rest of WP-3.4
  (`isTeamColorLayer`/`isTeamGlowLayer`, `visitTextureReferences` for the 5 remap copies) stays.
- **D9 → new WP-3.10, removed from WP-1.9.** WP-1.9 no longer touches the antialias dependency.
  WP-3.10 (Opus, high, after WP-2.1 merges because it touches `Viewport.jsx`):
  - The **Smooth edges (antialiasing)** setting works in every 3D view, including the main editor
    `Viewport.jsx` (today it is hard-coded off there since `59cf9ce7` while still rebuilding on
    every toggle). Stop the pointless rebuild either way.
  - When smoothing is on, **only the model is smoothed**: bones, wireframe, vertex dots, normals and
    other editor lines stay pixel-sharp on their own non-multisampled layer, the way GamePreview
    already draws bone connectors on a 2D canvas with `app/pixel-lines.js`. Check the
    "bone preview layering" fixed in `59cf9ce7` still holds with smoothing on.
  - **Off by default** stays (`src/preferences.js`); existing users keep their current value and
    are not asked again. Software rendering and low-power modes still force it off.
  - Re-check `viewportPixelRatio` (`app/viewport-quality.js:7`): with antialias on it currently
    caps the editor at the pixel-ratio setting, which made "on" slightly blurrier on HiDPI. Keep
    HerrDave's test `HD06` (`test/herrdave-render.test.js:32`) meaningful for the Classic choice.
  - **First-run question** in the existing welcome prompt (`electron/welcome-prompt.cjs`, the
    first-open window that asks about automatic updates), owner-approved wording:
    "**How should your models look?**" with **Smooth** ("Clean, soft edges. Bones and lines stay
    sharp.", highlighted/default button) and **Classic MDLVis** ("Crisp pixel edges, like the old
    MDLVis."), note "You can change this any time in Settings → Graphics." Keep it one small
    window in the same style; translate into the four languages.
  - **Quick switch in the top toolbar** next to team colour and language (`app/AppToolbar.jsx`):
    one small button toggling Smooth / Classic MDLVis, the existing toolbar button look, a short
    tooltip, the same preference as Settings and the welcome prompt. **Hidden in VIS** (VIS stays
    MDLVis, see `vis-mdlvis-mode.md`).
  - **Ready to test**: first-run prompt on a fresh profile, toolbar switch in XL (absent in VIS),
    bones and wireframe stay crisp with Smooth on, mouse camera rotation in every preview.
  - Background the owner asked for: sharp edges came from HerrDave's September 10 contract
    (0.10.2, ticket HD06). Of HerrDave's recorded requests this is the only one that locked
    MDLxL to the old look: his lighting is only a default with presets in Settings, and his
    MdlVis Rotate drag is already optional (Pivot-based default again, `ecbb4088`). His full
    original ticket list is not in the repository (tests show HD01, 03 to 06, 10, 13 only).
- **D11 and D12 → WP-2.6:** Settings and Showcase number fields commit on Enter/blur like every
  other number field (behaviour change, **ready to test**). All sliders share one look built from
  the theme variables instead of each wrapper keeping its own CSS (visible change, **ready to
  test** in light, dark and VIS). WP-2.6's "keep their CSS" for sliders no longer applies.
- **D10:** WP-3.7 only documents the two vertex click rules; no code change for that half.
- All other decisions took the default, so the packages they block can start as written.

---

## 8. Method and gaps

- Seven read-only auditors (Opus) each covered one area with `rg`/`sed` and reading; two
  mechanical scans (`dupscan.mjs`: normalized 8-line and 5-line window hashing over source, 10-line
  over tests; an exported-name cross-reference) seeded them. Seed counts that were wrong were
  corrected in the reports (for example `clamp` 20 → 16 named copies, App.jsx 56 → 100 states).
- Not covered: domain correctness of each feature's rules, `src/vendor/`, native C# and C++
  helpers, the paint-library and public assets, performance beyond the two O(n²) notes.
- Nothing was run except `node --test tests/*.test.js` (57/57 pass). Every "likely bug" and
  every **ready to test** item needs the packaged app.
