# MDLxL codebase audit and repair plan

Status: audit repaired; release 0.36.0 in progress. All package PRs are merged;
owner click-throughs remain ready to test, and B16 plus the remaining B18 case
are still open (section 4).
Revision checked: `origin/main` at `56fb26c8`, 2026-10-30.
Revision originally audited: `fe46a534` (0.35.0), 2026-10-29.
Branch: `codex/audit-closeout` (documentation only).
Session: codex audit close-out

Evidence: seven area reports with `file:line` for every instance live in
[codebase-audit/](codebase-audit/) (01 math helpers, 02 Electron plumbing, 03 AI subsystem,
04 React shell and UI, 05 preview and render stack, 06 model core and features, 07 tests,
scripts, CI and docs), plus the mechanical scans (`dupscan-*.txt`, `unused-exports.txt`,
`dupscan.mjs`). Finding ids below (for example `06-#3`, `02-F4`) point into those files.
The evidence reports and sections 1–3 describe the original audit snapshot; sections 5–6
and the owner review notes preserve the approved plan. Sections 4 and 7 record the close-out.
No application was built, launched or packaged for this documentation update. Items marked
**ready to test** still need owner acceptance in the packaged app.

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

## 4. Likely bugs found along the way — outcomes

Checked against `origin/main` at `56fb26c8` on 2026-10-30. Source links pin that
revision so their file:line references remain usable after main moves. These are
code outcomes, not owner acceptance or Warcraft III test results.

| Finding | Outcome | PR(s) | Current-main evidence |
| --- | --- | --- | --- |
| B1 · Paint cut-out edges | Fixed: coverage is limited to cut-out layers and follows the live Smooth choice. | [#422](https://github.com/UnsctMagic/MDLxL/pull/422), [#424](https://github.com/UnsctMagic/MDLxL/pull/424) | [app/PaintViewport.jsx:444](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/PaintViewport.jsx#L444) |
| B2 · Tall Paint panels crop in ortho | Fixed: framing accounts for panel shape. | [#422](https://github.com/UnsctMagic/MDLxL/pull/422) | [app/PaintViewport.jsx:133](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/PaintViewport.jsx#L133); [app/viewport-math.js:55](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/viewport-math.js#L55) |
| B3 · Event models have darker team colour | Fixed: spawned models use the same colour conversion as the unit. | [#397](https://github.com/UnsctMagic/MDLxL/pull/397) | [app/event-preview-runtime.js:203](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/event-preview-runtime.js#L203) |
| B4 · Pure-green Y label in dark themes | Fixed: axis labels use the theme colours; the overriding rule is gone. | [#390](https://github.com/UnsctMagic/MDLxL/pull/390) | [app/styles.css:59](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/styles.css#L59); [app/theme.css:112](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/theme.css#L112) |
| B5 · Undefined theme colours | Fixed: selection, error and muted text use existing theme colours. | [#390](https://github.com/UnsctMagic/MDLxL/pull/390) | [app/particle-editor.css:4](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/particle-editor.css#L4); [app/movement.css:8](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/movement.css#L8); [app/pose-controls.css:24](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/pose-controls.css#L24); [app/styles.css:89](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/styles.css#L89) |
| B6 · Adjust Manually lets keys reach the editor | Fixed: it uses the shared modal window and shortcut boundary. | [#413](https://github.com/UnsctMagic/MDLxL/pull/413), [#418](https://github.com/UnsctMagic/MDLxL/pull/418) | [app/EmitterTextDialog.jsx:38](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/EmitterTextDialog.jsx#L38); [app/Dialog.jsx:22](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/Dialog.jsx#L22); [app/Hotkeys.jsx:56](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/Hotkeys.jsx#L56) |
| B7 · Technical prefix in error messages | Fixed: the desktop bridge removes the remote-method prefix. | [#395](https://github.com/UnsctMagic/MDLxL/pull/395) | [electron/preload.cjs:3](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/electron/preload.cjs#L3) |
| B8 · Interrupted file writes and Windows rename failures | Fixed: recent files and the other app-owned writers share temporary-file replacement and rename retry. | [#403](https://github.com/UnsctMagic/MDLxL/pull/403) | [electron/main.cjs:154](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/electron/main.cjs#L154); [electron/atomic-file.cjs:27](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/electron/atomic-file.cjs#L27) |
| B9 · Libraries disagree on Warcraft installation | Fixed per D2: the Settings installation comes first for Library, Texture Library and particles; ordinary model-texture lookup keeps custom-source priority. | [#403](https://github.com/UnsctMagic/MDLxL/pull/403) | [electron/game-data.cjs:36](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/electron/game-data.cjs#L36); [electron/main.cjs:78](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/electron/main.cjs#L78); [electron/main.cjs:349](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/electron/main.cjs#L349) |
| B10 · New bone name can collide with another node | Fixed: new bone names check Helpers and Attachments as well as Bones. | [#402](https://github.com/UnsctMagic/MDLxL/pull/402) | [src/bone-tools.js:28](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/bone-tools.js#L28) |
| B11 · Elbow and Balance mistaken for weapons | Fixed per D7: weapon names are checked as words, with each tool keeping its own ranking rules. | [#408](https://github.com/UnsctMagic/MDLxL/pull/408) | [src/rig-names.js:21](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/rig-names.js#L21); [src/glow-up.js:108](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/glow-up.js#L108); [src/attachemator.js:96](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/attachemator.js#L96) |
| B12 · Add sequence misses per-part bounds | Fixed: the manager calls the shared sequence creator, which adds bounds for every part. | [#404](https://github.com/UnsctMagic/MDLxL/pull/404) | [app/ResourceEditors.jsx:164](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/ResourceEditors.jsx#L164); [src/sequence-editor.js:122](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/sequence-editor.js#L122) |
| B13 · Inspector skips sequence validation | Fixed: name, start and end edits use the shared validators. | [#404](https://github.com/UnsctMagic/MDLxL/pull/404) | [app/Inspectors.jsx:58](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/Inspectors.jsx#L58) |
| B14 · Portrait bounds depend on declared edit sections | Fixed: the actual changed sections decide the Portrait refresh, inside the same Undo step. | [#404](https://github.com/UnsctMagic/MDLxL/pull/404) | [src/editor-document.js:425](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/editor-document.js#L425); [app/App.jsx:409](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/App.jsx#L409) |
| B15 · Release tests silently launch the development app | Fixed across the helper and family migrations: the runner supplies one executable choice; explicit development-only wrappers remain listed. | [#400](https://github.com/UnsctMagic/MDLxL/pull/400), [#414](https://github.com/UnsctMagic/MDLxL/pull/414), [#407](https://github.com/UnsctMagic/MDLxL/pull/407), [#417](https://github.com/UnsctMagic/MDLxL/pull/417), [#425](https://github.com/UnsctMagic/MDLxL/pull/425) | [scripts/run-packaged-tests.mjs:65](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/scripts/run-packaged-tests.mjs#L65); [scripts/run-packaged-tests.mjs:146](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/scripts/run-packaged-tests.mjs#L146); [test/helpers/app.cjs:12](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/test/helpers/app.cjs#L12) |
| B16 · Tiny normals keep nonzero X/Y | **Still open:** D1 approved clearing X/Y, but the quick geometry helper still changes only Z. The Inspector switch in #412 avoids this helper there; Forge and shaping still use it. No fixing PR. | — | [src/editor-document.js:944](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/editor-document.js#L944) |
| B17 · Running organiser shown as interrupted | Fixed: a live Offload task counts as running. | [#406](https://github.com/UnsctMagic/MDLxL/pull/406) | [electron/ai-service.cjs:440](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/electron/ai-service.cjs#L440) |
| B18 · Long AI plans show raw cut-off data | **Still open in part:** #406 adds the short label and shortens long strings before cutting. A plan with many short entries can still exceed the limit, be cut mid-JSON and fall back to raw data; older cut-off chats also remain unreadable. | [#406](https://github.com/UnsctMagic/MDLxL/pull/406) | [electron/ai-providers.cjs:112](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/electron/ai-providers.cjs#L112); [app/AiParts.jsx:114](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/AiParts.jsx#L114); [app/AiParts.jsx:38](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/AiParts.jsx#L38) |
| B19 · POSE repeatedly rebuilds the node lookup | Fixed: each public operation builds or receives one shared lookup and passes it through. | [#402](https://github.com/UnsctMagic/MDLxL/pull/402) | [src/pose-ik.js:42](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/pose-ik.js#L42); [src/pose-ik.js:613](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/pose-ik.js#L613) |
| B20 · Smooth switch rebuilds a renderer that ignores it | Fixed per D9 by making the setting work: the live model pass is smoothed while editor lines keep their sharp layer. | [#424](https://github.com/UnsctMagic/MDLxL/pull/424) | [app/Viewport.jsx:845](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/Viewport.jsx#L845); [app/model-smoothing.js:37](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/model-smoothing.js#L37) |
| B21 · Different previews choose different Stand clips | Fixed per D5: callers use Attachemator's shared Stand rule; the Showcase Portrait callback missed in #411 is corrected in #416. | [#411](https://github.com/UnsctMagic/MDLxL/pull/411), [#416](https://github.com/UnsctMagic/MDLxL/pull/416) | [src/sequence-editor.js:17](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/sequence-editor.js#L17); [src/paint-view.js:9](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/paint-view.js#L9); [app/ParticleEditor.jsx:230](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/app/ParticleEditor.jsx#L230) |
| B22 · Outdated POSE refusal explanation | Wording fixed; the solver restriction remains deliberately. The message now distinguishes what the preview shows from what the joint solver supports. | [#396](https://github.com/UnsctMagic/MDLxL/pull/396) | [src/pose-ik.js:30](https://github.com/UnsctMagic/MDLxL/blob/56fb26c861715cc0e2188b9f0a00503bb70c35dc/src/pose-ik.js#L30) |

Close-out checks confirmed both remaining cases without launching the app: B16
returns `[0, 9.9999998245167e-15, 1]` for a tiny triangle; B18 turns a valid
4,052-character plan (20 keeps, six options, 20 checks, 62-character strings)
into 4,001 characters that no longer parse. Neither is an owner decision to
leave the bug. B16's approved D1 change was missed; B18 is only partly repaired.

The owner decisions to keep separate material comparisons (D6), keep the two
vertex-click distances (D10), and omit UV splits/AI width from exported preferences
(D18) remain intentional. They are not unresolved B-items.

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
| WP-3.7 | 2D image zoom in Paint image views and the Forge mask editor goes through `bindScrollSensitivity` with the UV editor's zoom step (`wheelZoomFactor` exported from `viewport-performance.js`); Forge's mask editor gains the wheel (D8). Vertex click rules stay as they are and are documented in the map row (D10). | D8, D10; merged in [PR #420](https://github.com/UnsctMagic/MDLxL/pull/420). Owner zoom checks remain ready to test (section 7). | Codex | medium |
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

### Package close-out (2026-10-30)

All 36 package rows below are merged, including the four WP-2.8 test families
and the separate rotation package. PR states and bodies were read with
`gh pr list --repo UnsctMagic/MDLxL --state all --limit 80` (including its JSON
body/state/date fields). Merge dates use Europe/Amsterdam (UTC+1).
The original audit/plan was merged in [#387](https://github.com/UnsctMagic/MDLxL/pull/387). Package completion does not
mean every B-item or owner click-through passed; see section 4 and the list below.

| Package | PR(s) | State | What it did |
| --- | --- | --- | --- |
| WP-0.1 | [#388](https://github.com/UnsctMagic/MDLxL/pull/388) | Merged 2026-10-29 | Updated old task notes, links and setup wording. |
| WP-0.2 | [#391](https://github.com/UnsctMagic/MDLxL/pull/391) | Merged 2026-10-29 | Removed unused code and test entries, keeping code with real callers. |
| WP-0.3 | [#390](https://github.com/UnsctMagic/MDLxL/pull/390) | Merged 2026-10-29 | Repaired theme colours and shared identical window styles. |
| WP-0.4 | [#389](https://github.com/UnsctMagic/MDLxL/pull/389) | Merged 2026-10-29 | Stopped the AI console translating the same words twice. |
| WP-1.1 | [#392](https://github.com/UnsctMagic/MDLxL/pull/392) | Merged 2026-10-29 | Shared identical maths, vector, checksum and rotation helpers. |
| WP-1.2 | [#394](https://github.com/UnsctMagic/MDLxL/pull/394) | Merged 2026-10-29 | Shared game-file path matching and made missing names safe to compare. |
| WP-1.3 | [#396](https://github.com/UnsctMagic/MDLxL/pull/396) | Merged 2026-10-29 | Shared animation node maths and corrected the POSE refusal wording. |
| WP-1.4 | [#393](https://github.com/UnsctMagic/MDLxL/pull/393) | Merged 2026-10-29 | Shared value comparisons and texture slots; moved model helpers out of the UI. |
| WP-1.5 | [#395](https://github.com/UnsctMagic/MDLxL/pull/395) | Merged 2026-10-29 | Shared desktop bridge helpers and removed technical prefixes from errors. |
| WP-1.6 | [#399](https://github.com/UnsctMagic/MDLxL/pull/399) | Merged 2026-10-29 | Shared dialogs, saved small choices, popover dismissal and Tab handling. |
| WP-1.7 | [#400](https://github.com/UnsctMagic/MDLxL/pull/400) | Merged 2026-10-29 | Added common test launch helpers and one setting for the app under test. |
| WP-1.8 | [#398](https://github.com/UnsctMagic/MDLxL/pull/398) | Merged 2026-10-29 | Shared AI provider calls, prompt assembly and service helpers. |
| WP-1.9 | [#397](https://github.com/UnsctMagic/MDLxL/pull/397) | Merged 2026-10-29 | Shared preview helpers and matched event-model team colour to the unit. |
| WP-2.1 | [#422](https://github.com/UnsctMagic/MDLxL/pull/422) | Merged 2026-10-29 | Brought shared materials, wire display and camera fixes into Citadel Paint. |
| WP-2.2 | [#402](https://github.com/UnsctMagic/MDLxL/pull/402) | Merged 2026-10-29 | Shared node and bone lookups, avoided duplicate bone names and sped up POSE. |
| WP-2.3a | [#401](https://github.com/UnsctMagic/MDLxL/pull/401) | Merged 2026-10-29 | Shared track checks, track walking and new animation-key creation. |
| WP-2.3b | [#404](https://github.com/UnsctMagic/MDLxL/pull/404) | Merged 2026-10-29 | Shared part/sequence editing and repaired bounds, validation and Portrait refresh. |
| WP-2.4 | [#403](https://github.com/UnsctMagic/MDLxL/pull/403) | Merged 2026-10-29 | Shared safe file writes and made libraries prefer the Settings installation. |
| WP-2.5 | [#406](https://github.com/UnsctMagic/MDLxL/pull/406) | Merged 2026-10-29 | Shared AI chat/provider state, live errors and short step labels; B18 remains partial. |
| WP-2.6 | [#413](https://github.com/UnsctMagic/MDLxL/pull/413) | Merged 2026-10-29 | Shared number boxes, slider styling and movable tool-window shells. |
| WP-2.7 | [#418](https://github.com/UnsctMagic/MDLxL/pull/418), [#423](https://github.com/UnsctMagic/MDLxL/pull/423) | #418 merged 2026-10-29; #423 merged 2026-10-30 | Routed tool-window keys through Shortcuts; follow-up cancels a drag before closing. |
| WP-2.8a | [#414](https://github.com/UnsctMagic/MDLxL/pull/414) | Merged 2026-10-29 | Moved AI and UV app checks onto the shared test helpers. |
| WP-2.8b | [#407](https://github.com/UnsctMagic/MDLxL/pull/407) | Merged 2026-10-29 | Moved OptimizeXL and Citadel app checks onto the shared test helpers. |
| WP-2.8c | [#417](https://github.com/UnsctMagic/MDLxL/pull/417) | Merged 2026-10-29 | Moved particle, Showcase and Forge app checks onto the shared test helpers. |
| WP-2.8d | [#425](https://github.com/UnsctMagic/MDLxL/pull/425) | Merged 2026-10-30 | Moved remaining app checks, repaired stale tests and shared script/CI setup. |
| WP-3.1 | [#426](https://github.com/UnsctMagic/MDLxL/pull/426) | Merged 2026-10-30 | Moved App state into four small owners while preserving controls and saved choices. |
| WP-3.2 | [#411](https://github.com/UnsctMagic/MDLxL/pull/411), [#416](https://github.com/UnsctMagic/MDLxL/pull/416) | Merged 2026-10-29 | Shared animation-name rules; follow-up repaired Showcase's Portrait playlist. |
| WP-3.3 | [#415](https://github.com/UnsctMagic/MDLxL/pull/415) | Merged 2026-10-29 | Shared cross-model resource importing while keeping each tool's reuse choices. |
| WP-3.4 | [#421](https://github.com/UnsctMagic/MDLxL/pull/421) | Merged 2026-10-29 | Shared team-colour/glow checks and texture remapping; kept material comparisons separate. |
| WP-3.5 | [#408](https://github.com/UnsctMagic/MDLxL/pull/408) | Merged 2026-10-29 | Shared rig-name words so Elbow and Balance no longer count as weapons. |
| WP-3.6 | [#412](https://github.com/UnsctMagic/MDLxL/pull/412) | Merged 2026-10-29 | Made Inspector Recalculate normals use NormalsXL at 90°; kept Forge's quick helper. |
| WP-3.7 | [#420](https://github.com/UnsctMagic/MDLxL/pull/420) | Merged 2026-10-29 | Made Paint and Forge image zoom follow the UV step and Mouse settings. |
| WP-3.8 | [#410](https://github.com/UnsctMagic/MDLxL/pull/410) | Merged 2026-10-29 | Moved AI editor messages and connection settings into their own files. |
| WP-3.9 | [#405](https://github.com/UnsctMagic/MDLxL/pull/405) | Merged 2026-10-29 | Documented bridge/storage names and added a check for missing message connections. |
| WP-3.10 | [#424](https://github.com/UnsctMagic/MDLxL/pull/424) | Merged 2026-10-30 | Made Smooth edges work live with sharp editor lines, welcome choice and toolbar switch. |
| WP-R1 rotation | [#409](https://github.com/UnsctMagic/MDLxL/pull/409) | Merged 2026-10-29 | Made Along the ring the shared Rotate default with equal speed on every axis. |

### Follow-ups and release work

| Work | PR / branch | State | What it did / what remains |
| --- | --- | --- | --- |
| Showcase Portrait correction | [#416](https://github.com/UnsctMagic/MDLxL/pull/416) | Merged 2026-10-29 | Replaced the missed playlist callback after #411 so Showcase opens again. |
| MDX empty node tracks | [#419](https://github.com/UnsctMagic/MDLxL/pull/419) | Merged 2026-10-29 | User-reported save bug: omits empty node animation blocks while preserving the other saved data. |
| Escape during a drag | [#423](https://github.com/UnsctMagic/MDLxL/pull/423) | Merged 2026-10-30 | Cancels Glow Up, emitter, UV, Movement and Forge drags before window dismissal; a second Escape closes where applicable. |
| AI chat fixes | [#427](https://github.com/UnsctMagic/MDLxL/pull/427) | Merged 2026-10-30 | Gives the outside check its pictures, honours deliver anyway and lets chats recover from failed display steps and follow-ups. |
| Opt-in real-use AI checks | [#428](https://github.com/UnsctMagic/MDLxL/pull/428) | Merged 2026-10-30 | Adds explicitly requested live-AI runs and graded reports; the recorded baseline still shows unfinished jobs and missed example-following. |
| Bitz unanimated parts | [#429](https://github.com/UnsctMagic/MDLxL/pull/429) | Merged 2026-10-30 | Shows and imports every piece of an unanimated saved part such as A1. |
| AI context diet | [#430](https://github.com/UnsctMagic/MDLxL/pull/430) | Merged 2026-10-30 | Sends the first editor snapshot and then changes, with the user's words first; restores a full snapshot when needed. |
| UV Texture Library Escape | `codex/uv-library-escape` | Open follow-up; no PR found in the checked list | Search takes focus but Escape leaves the library open on main; the release task is splitting out the fix. |
| Release 0.36.0 | `codex/release-0.36.0` | In progress; no PR found in the checked list | The release task owns the full test run and release preparation; no release is claimed here. |

PR #430 merged during close-out and is included in checked main `56fb26c8`.
The UV and release branch names above come from the task handover; their work
is separate from this documentation PR. B16 and the remaining B18 case have no
separate fixing PR in the checked records. The full-suite results in #425
(150 pass, 12 fail, 29 skip after repeat) are its historical run, not the release
0.36.0 result. Its UV Search/Escape failure is a product bug; its other remaining
failures include stale test expectations and missing private inputs.

### Owner click-through — ready to test

Use the release task's hand-test build when ready. These checks are pending owner
acceptance; this docs-only close-out did not build or run the app. Repeat visual
checks in light, dark and VIS where available, and rotate every 3D preview by mouse.

**Settings and the main window**

- On a fresh test profile, the welcome window asks “How should your models look?” and offers Smooth / Classic MDLVis; an existing profile keeps its choice without asking again (#424).
- Beside team colour and language, switch Smooth / Classic MDLVis; Settings agrees, VIS hides the switch, and bones, wire, dots and lines stay sharp with Smooth on, including at high screen scaling (#424).
- Restart with a saved dark theme or another language; the first screen already uses it (#403, #426).
- Open a moved or deleted Recent file; the error contains the useful message without “Error invoking remote method” (#395).
- Look at X/Y/Z labels and tool colours in each theme; no pure-green Y override or unreadable error/selection text remains (#390).

**Movement, vertices and UV Wrapper**

- Choose Along the ring, view a bone from an angle and drag X, Y and Z equally; turns are equally fast and do not jam near the centre, and vertex, Forge, UV and Showcase rotation feels steady too (#409).
- Change rotation speed with the Wisp wheel, try Shift snapping, Undo, Escape and right-click cancel; the old Straight drag / Circle the pivot choices and camera orbit still work (#409).
- In UV Wrapper, try Move, Rotate, Zoom, Mirror, Uncouple and Fold; the familiar tools and icons still work (#413).
- On a rig with unusual inherited movement, try POSE; its refusal explains that the preview can show the movement but the joint solver cannot use it (#396).
- Save and reopen a copy of a previously affected model as MDX, then open that copy in War3 Model Editor; empty animation blocks no longer prevent opening (#419; external editor/game acceptance still pending).

**Tool windows and their keys**

Repeat the following window checks in Settings, Managers/resource editors, Node
Manager, AnimXL, Particle Editor, Adjust Manually, Sort My Mess, Attachemator,
Forge and its shaping/detail windows, BITZ, Texture Library, OptimizeXL, Showcase
and its Add/Edit animation/preset windows, Paint, Game Files, Node Event Editor,
Glow Up, Portrait setup, Addons, NormalsXL and Auto Corpse.

- In each window, check light/dark/VIS appearance, move its title bar where offered, use × to close, and Tab through a modal without focus escaping (#399, #413).
- In each window, press Escape from its body and a number/search box; leave picking or an inner menu first where offered, then close; UV Texture Library Search is the known open exception awaiting its separate fix (#413, #418, #425).
- Where a window offers Undo, Redo or Play, try Ctrl+Z/Y and Space, then rebound keys in Keyboard Shortcuts; buttons show their key hints and Learn counts their use (#418).
- While dragging Glow Up, an emitter/placement handle, UVs, Movement or Forge, press Escape; the drag rolls back before dismissal, then Escape closes the tool where applicable (#423).
- Open the Learn menu, bone-create menu or AI drawing mode and press Escape; it leaves that inner mode before dismissing the surrounding window (#418, #423).
- In Adjust Manually, type Space/Delete in the text box; the model behind the window does not react (#413).
- Open a small popover and dismiss it by Escape or an outside click, including the Portrait toolbar in the separate OptimizeXL window (#399).
- Compare AnimXL, Auto Corpse, Showcase, Paint, ribbon, particle, triangle-density and animation-speed sliders; their theme styling agrees, and a ribbon/speed drag cancels with Escape or undoes in one step (#413).
- In Settings and Showcase video From/To boxes, type a value; it applies on Enter or leaving the box, while Escape drops the typed change (#413).
- In Managers, add an animation and edit its name/start/end in Inspector; valid values work, invalid names/times are refused and OptimizeXL does not report missing per-part animation bounds (#404).

**Citadel Paint, Forge and model previews**

- In Citadel Paint with Smooth on, inspect cut-out edges and opaque pieces; there are no white fringes or faded solid parts (#422, #424).
- Make Paint tall and narrow in ortho; the whole model stays framed (#422).
- Rotate, pan and zoom with the mouse in the editor, Paint, GamePreview, Quad View and Showcase; change model tabs and return without losing each saved camera (#422, #425).
- In Paint texture view, Paint cut-out view and Forge's mask editor, compare wheel zoom with UV Wrapper; Mouse wheel sensitivity, Peon/Wisp and chosen pan buttons all work, with zoom staying under the pointer (#420).
- On an SD unit, use Inspector Recalculate normals for a part and compare with NormalsXL at 90°; shading agrees and Undo restores the old result (#412).
- Open Paint, Particle Editor and Attachemator on the same Footman; all start on the same Stand clip, and a model with Stand Ready before Stand still chooses the ordinary Stand (#411).
- Open Showcase and its Portrait playlist; it opens and plays without the missing-Portrait-rule error (#416).
- In EMTR → Glow Up and Bones → Tools → Attachemator, check the Footman's sword/shield choices and a rig named Elbow/Balance; body parts no longer gain a weapon-name preference (#408).
- Set a unit to blue or another non-red team and play a blood/footprint event; the spawned model matches the unit's team colour (#397).
- In Emitter Editor, open Ingredients, blend comparison and examples; their small pictures fill in (#397).
- With a custom CASC source added, open Library, Texture Library and particles; each browses the installation selected in Settings first (#403).
- In BITZ, select A1 and place it on a model; all seven pieces appear both in the preview and after placement (#429).

**AI console**

- Switch connection providers and send two requests, then sign out/in; the same settings rows work and sending continues without a duplicate sign-in check (#406, #410).
- Trigger a request error and reopen the chat; the error appears beside the failed reply both live and after reopening, with the banner still present (#406).
- Open a long plan and inspect its step label; ordinary long-string plans are readable, while the many-entry B18 case above remains open (#406).
- Finish a task with reference pictures and before/after or wire comparisons; the outside check sees those pictures and explains missing ones (#427).
- After a blocked review, say “deliver anyway”; the kept result completes without repeating edits, with remaining concerns stated (#427).
- After a failed or stalled display step or Stop, send another message; work can continue, and “reduce it to around 8” does not produce a false model-changed refusal (#427).
- Point to an example you made and request it over the whole chosen area; check coverage, shape and textures yourself, since the measured baseline still missed example-following (#427, #428).
- Continue a job with steering, then after chat compaction or replacing the model; the newest words arrive with the current target, unchanged context is not repeatedly added and a fresh snapshot returns when needed (#430).
- Only when deliberately opting in, use the [real-use AI run instructions](../PACKAGED-TESTS.md#opt-in-real-use-ai-measurements), then read the [recorded baseline](../verification/ai-real-use-baseline-2026-10-30.md) and the new report; unfinished or poor edits stay reported rather than counted as accepted (#428).

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
- Original audit verification: `node --test tests/*.test.js` (57/57 pass). Package PRs
  record their own later checks. This close-out checked PR records, current source, links
  and the two isolated remaining-bug cases; it ran no build, packaged app or owner test.
  The owner click-throughs in section 7 remain **ready to test**.
