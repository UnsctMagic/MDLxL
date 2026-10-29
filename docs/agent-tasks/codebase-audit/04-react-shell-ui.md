# Audit 04 — React shell and shared UI primitives

Revision: `origin/main` fe46a534 (read-only worktree `D:\Claude\MDLxL\.claude\worktrees\codebase-audit`).
Scope: `app/App.jsx`, `AppToolbar/AppSidebar/AppPanels/AppDialogs`, `Settings`, `EditorControls`, `Fields`,
`Hotkeys`, `Learn`, `theme.js`, `localized-element.js`, `src/preferences.js`, `src/localization.js`, the tool
windows (scanned for UI-primitive duplication only) and all `app/*.css`.

Product rules respected: every proposal is "make these N copies one owner" in the existing look and
controls. No new panels, no redesign. Where copies *look* different, unifying the look is called out as an
owner decision, separate from sharing the behaviour.

## Corrections to the seed numbers

| Seed | Actual |
|---|---|
| App.jsx "56 useState / 39 useEffect" | **100 `useState` hooks** (many lines declare 3–6 at once; the 56 is the line count), **38 `useEffect`**, 31 `useRef`, 19 `useMemo`, 4 `useCallback`, 2 `useLayoutEffect`; 98 import lines |
| "29 app/*.css files (2403 lines)" | **44 CSS files**, 2,395 lines but ~**440 KB** (most rules are one-line minified blocks; line counts understate size) |
| "14 files touch localStorage" | **17 files** (14 in `app/`, plus `src/display-overlays.js`, `src/motion-decisions.js`, `src/learn-keycaps.js` via Learn) using **21 distinct keys** |
| Slider ×4, Dialog ×2, Section ×2, NumberField ×2, Tool ×2 | Confirmed, and the families are bigger: **7** slider components + 25 inline ranges, **9** number-field implementations + ~37 inline, **4** collapsible components + ~36 raw `<details>`, **4** checkbox/toggle shapes, **9** modal backdrops in CSS |

Severity: **High** = users see inconsistent behaviour today or every new window must copy it again;
**Medium** = real duplication with drift, fixing it is contained; **Low** = tidy-up, dead code, cosmetic.

---

## Findings

### F1. Escape, Undo/Redo and window keys are wired five different ways — High

The central dispatcher (`app/Hotkeys.jsx` `runShortcut`, keydown at `app/Hotkeys.jsx:257`) already discovers
every `[data-hotkey]` control, gives a window's Close control **Escape** automatically
(`src/hotkey-allocation.js:66-68` `allocateGroup` → `isCloseControl`), shows badges, honours user rebinding
and feeds Learn (`mdlxl-hotkey-used`, `app/Hotkeys.jsx:214`). Many tool windows bypass all of that:

| Mechanism | Instances |
|---|---|
| A. Central `data-hotkey` discovery | Settings (38 `data-hotkey`), AiAssistant (58), ResourceEditors (12), ShapingDialog (19), ForgeShapes (10), MovementControllerRecomp (13), App `Dialog` (`app/App.jsx:133`) |
| B. Hard-coded `onKeyDown` Escape/Space/Ctrl+Z | `app/AnimXL.jsx:523-527` (`Escape`, `' '`, `Ctrl+Z/Y` → `undoSettings`), `app/Attachemator.jsx:71`, `app/SortMyMess.jsx:157`, `app/Forge.jsx:126`, `app/TextureLibrary.jsx:145`, `app/BitsAndParts.jsx:105`, `app/EmitterTextDialog.jsx:37`, `app/ResourceEditors.jsx:197-198` (on top of its data-hotkey close), `app/Settings.jsx:320`, `app/ParticleEditor.jsx:313` |
| C. Named pre-emption events hard-coded inside the dispatcher | `app/Hotkeys.jsx:231` `mdlxl-showcase-key`, `:233` `mdlxl-uv-key`, `:235` `mdlxl-paint-key`, `:238` `mdlxl-escape-key`; plus class-name sniffing `.learn-menu` (`:230`), `.bone-create-menu` (`:236`), `.uv-workspace-body[data-pointer-region="preview"]` (`:239-240`), `.ai-assistant` (`:245`) |
| D. Own key system | Paint: `data-paint-key` + `PaintKey` (`app/PaintStudioLayout.jsx:9-12,60`), static shortcut table `shortcuts` (`app/PaintStudioLayout.jsx:14`); Showcase: `chordFromEvent` Ctrl+Z/Y at `app/ShowcaseWorkspace.jsx:68,480` |
| E. Per-popover `window/document.addEventListener('keydown')` for Escape | see F6 (8 copies) |

Snippets:
```js
// app/AnimXL.jsx:525-527 — ignores the user's Undo/Redo binding from src/commands.js:9
if (event.key === 'Escape') { event.preventDefault(); if (picking) setPicking(null); else onClose(); }
if (event.key === ' ' && !isTypingTarget(event.target)) { event.preventDefault(); setPlaying(v => !v); }
if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { ... undoSettings(...) }
```
```js
// app/Hotkeys.jsx:231-235 — the dispatcher knows three specific workspaces by name
if(!inLocalWindow&&!window.dispatchEvent(new CustomEvent('mdlxl-showcase-key',{detail:event,cancelable:true}))){cancel();return;}
if(!inLocalWindow&&!window.dispatchEvent(new CustomEvent('mdlxl-uv-key',{detail:event,cancelable:true}))){cancel();return;}
if(!inLocalWindow&&latest.current.activeScope==='paint'&&!window.dispatchEvent(new CustomEvent('mdlxl-paint-key',...
```
Divergent: yes. Windows in B/D get no badges, no Settings → Keyboard Shortcuts entries, ignore rebinding of
Undo/Redo/Play, and Learn never counts their keys. Tool windows with **zero** `data-hotkey`: AnimXL,
ParticleEditor, Attachemator, SortMyMess, Forge (main), BitsAndParts, TextureLibrary, OptimizeXL,
ShowcaseWorkspace, PaintWorkspace, GameFileBrowser, NodeEventEditor, GlowUpControls, PortraitSetup,
EmitterTextDialog, Addons, NormalizerControls. Note also `mdlxl-uv-key` is dispatched but **no listener exists**
anywhere in `app/` or `src/` (dead hook point).

Proposed owner: keep `app/Hotkeys.jsx` as the single owner. (1) Tool windows mark their Close button
`data-hotkey="close"` (as `App.jsx:133` and `ResourceEditors.jsx:212` already do) and drop their hand-written
Escape branch; (2) replace the three named events with one generic claim event, e.g.
`mdlxl-window-key` with `detail.scope`, that any workspace can cancel — callers Showcase, Paint (and remove
the dead UV one); (3) AnimXL/Showcase local Undo/Redo become window-scoped actions
(`allowInModal`/`scope`) in the catalog rather than raw `ctrlKey` checks. Do this window by window.

Risk: High — Escape ordering is subtle (AI drawing tool first, Learn menu, bone-create menu, recording field).
Covering tests: `test/hotkey-defaults.test.js`, `test/hotkey-migration.test.js`, `test/hotkey-badges.test.js`,
`test/hotkey-badges.electron.cjs`, `test/hotkey-playback.electron.cjs`, `test/ai-hotkeys.electron.cjs`,
`test/forge-shape-hotkeys.electron.cjs`, `test/uv-numpad.electron.cjs`, `test/learn.electron.cjs`,
`test/learn-menu.electron.cjs`, `test/anim-xl.electron.cjs`, `test/showcase-actions.electron.cjs`,
`test/attachemator.electron.cjs`, `test/sort-my-mess.electron.cjs`. Gap: no test presses Escape in each tool window.

### F2. Modal windows: four shells, three mechanisms, one shared hook used by only some — High

| Shell | Where | Mechanism | Movable | aria-modal | Hotkey scope |
|---|---|---|---|---|---|
| `Dialog` (classic) | `app/App.jsx:131-134` | inline overlay `div.classic-modal` + `section.classic-modal-window` | yes (`useMovableWindow`) | true | `data-hotkey-scope="dialog"` |
| `Dialog` (Showcase) | `app/ShowcaseWorkspace.jsx:51-61` | native `<dialog>.showModal()` (`:53`), form with Cancel/OK | no | none (no `role` attribute either) | none |
| Resource window | `app/ResourceEditors.jsx:210-212`, `app/AnimXL.jsx:529-530`, `app/ParticleEditor.jsx:318-319` | `div.resource-editor` + `section.re-window` + `header.re-caption` + `×` | yes | true / conditional | ResourceEditors + ParticleEditor only |
| XL window | `app/SortMyMess.jsx:250`, `app/Attachemator.jsx:75` | `.smm-overlay`/`.atm-overlay` + `.smm-window`/`.atm-window` | no | true | own scope names |
| Feature-specific | `app/Forge.jsx:130` `.forge-dialog`, `app/TextureLibrary.jsx:148` `.tl-dialog`, `app/BitsAndParts.jsx:105` `.parts-dialog`, `app/ShapingDialog.jsx:76`, `app/PaintWorkspace.jsx:454,460`, `app/PaintSceneOptions.jsx:13`, `app/PaintCutoutEditor.jsx:95`, `app/AiAssistant.jsx:1831` `.ai-cleanup` | each its own overlay | no | true | mixed |
| Hand-rolled classic | `app/PortraitSetup.jsx:8`, `app/EmitterTextDialog.jsx:37-38`, `app/Settings.jsx:327`, `app/main.jsx:9` (error boundary — justified) | copy of `classic-modal` markup without the component | no | PortraitSetup/Settings true; **EmitterTextDialog none** | — |
| Separate BrowserWindow | OptimizeXL: `app/detached-window.js:2-6` → `app/AppDialogs.jsx:80` `DetachedWindow`; Electron allow-list `electron/main.cjs:627` | `window.open('about:blank','MDLxL-OptimizeXL')` + portal (`app/DetachedWindow.jsx`) | OS window | — | `forwardKeys={false}` |
| Contained movable panel | `app/UVWindow.jsx:9` (aria-modal false), `app/PoseControls.jsx:15` | `useMovableWindow({contained})` | yes | false (intended) | — |

Identical vs divergent: divergent in movability, title-bar drag, Close wording (`Close ${title}` vs
`Close dialog`), Escape handling (F1), focus trap (F7) and whether Hotkeys sees them as modal
(`activeDialog` at `app/Hotkeys.jsx:34` only matches `[role="dialog"][aria-modal="true"]`). Two
consequences worth verifying in the packaged app:
- `EmitterTextDialog` looks modal (dark `classic-modal` backdrop) but lacks `aria-modal`, so editor shortcuts can
  still run behind it when focus is on a button (React `stopPropagation` at `:37` does not stop the window
  capture listener).
- Showcase's native `<dialog>` is not found by `activeDialog` (no `role` attribute); Showcase protects itself via
  `mdlxl-showcase-key` for Ctrl+Z/Y only.

Also: `App.jsx` `Dialog` is not exported, so it is **passed down as a prop** — `Dialog={Dialog}` into
`AppDialogs` (`app/AppDialogs.jsx:24`), then into `SanityCheck` (`:44`), `SaveEditorData` (`:52`),
`UpdatePrompt` (`:94`), and via `AppSidebar.jsx:102` into `AnimationController` (`app/AnimationController.jsx:75,379`)
and `GeosetTabs`. 16 `<Dialog` uses in AppDialogs alone.

Proposed owner: move `Dialog` verbatim to `app/Dialog.jsx` (default export, same markup/classes) and import
it directly; delete the `Dialog` prop from 6 components. Then, one at a time: PortraitSetup and
EmitterTextDialog render through `Dialog` (gains movability, `aria-modal`, `data-hotkey="close"`); Showcase's
`Dialog` becomes `Dialog` with an optional `onSubmit` (form + Cancel/OK footer) — keep its pointer-capture props.
A second small shell `app/ToolWindow.jsx` (overlay + `section` + movable `header` + `×` with
`data-hotkey="close"`) can absorb the `re-window` trio and the `smm/atm` pair without changing their CSS
classes (pass `className`). Leave Paint/Forge/TextureLibrary looks alone unless the owner wants one look.

Risk: Medium-high (Showcase dialog uses the native top layer; moving it to the overlay changes stacking with
the Showcase canvas). Tests: `test/startup.electron.cjs`, `test/appearance.electron.cjs`,
`test/appearance-contrast.electron.cjs`, `test/vis-mdlvis-mode.electron.cjs`, `test/showcase.electron.cjs`,
`test/showcase-actions.electron.cjs`, `test/showcase-history.test.js`, `test/attachemator.electron.cjs`,
`test/sort-my-mess.electron.cjs`, `test/manager-simplification.electron.cjs`, `test/updater.electron.cjs`
(these select on `.classic-modal-window`/`.smm-window`/`.atm-window` — keep class names). Source tests that grep
`App.jsx` (11 files, e.g. `test/release-fixes.test.js`, `test/vis-mdlvis-mode.test.js`) must be checked when
`Dialog` moves.

### F3. Number fields: nine implementations with four commit behaviours — Medium

| # | Component | Draft while typing | Commit | Escape | Validation |
|---|---|---|---|---|---|
| 1 | `TextField`/`NumberField` `app/Fields.jsx:5-10` | yes | blur / Enter | cancels | min/max/integer, reverts |
| 2 | `Coordinate` `app/EditorControls.jsx:11-16` | yes | blur / Enter | cancels | finite, 4 dp |
| 3 | `PositionField` `app/MovementControllerRecomp.jsx:43-53` | yes | blur / Enter | cancels | finite, `formatted()` — **near-copy of #2**, same `data-hotkey={\`coordinate:${axis}\`}` |
| 4 | `NumberRow` `app/ParticleRibbonFields.jsx:15-19` | yes | blur / Enter | cancels + `stopPropagation` | none |
| 5 | `ShowcaseNumber` `app/ShowcaseNumber.jsx:4-15` | yes | **live while valid**, clamp on blur | cancels, stops **all** key propagation | clamp min/max |
| 6 | `NumberField` `app/ShowcaseWorkspace.jsx:40-42` | no | every keystroke (`''` allowed) | none | none |
| 7 | `Numeric` `app/Settings.jsx:77-79` | no | every valid keystroke (`valueAsNumber`) | none | browser only |
| 8 | `SpeedControl` number `app/AnimationController.jsx:36-69` | yes | blur / Enter | none | 1–300 |
| 9 | `ParticleSlider` number box `app/ParticleCluelessControls.jsx:9-17` | yes | live + gesture finish on blur | cancels gesture | none |

Plus ~37 inline `type="number"` inputs (e.g. `app/UVWorkspace.jsx:55`, `app/PortraitSetup.jsx`,
`app/ShapingDialog.jsx`, `app/Forge.jsx`, `app/AiAssistant.jsx` ×3).

Snippet (#2 vs #3 are the same control):
```js
// app/EditorControls.jsx:13-15
const commit = () => { if (cancel.current) { cancel.current = false; return; } const number = Number(text); if (Number.isFinite(number) && number !== Number(value.toFixed(4))) onCommit(number); else setText(String(Number(value.toFixed(4)))); };
// app/MovementControllerRecomp.jsx:46-50
const commit = () => { if (cancel.current) { cancel.current = false; return; } const next = Number(text); if (text.trim() && Number.isFinite(next) && next !== Number(formatted(value)) && !disabled) onCommit(next); else setText(formatted(value)); };
```
Proposed owner: a `useDraftNumber({ value, format, parse, onCommit, live })` hook in `app/Fields.jsx`
returning `inputProps`; `TextField`, `Coordinate`, `PositionField`, `NumberRow`, `SpeedControl` and
`ShowcaseNumber` keep their own markup/classes but use it. `PositionField` can simply become
`<Coordinate>` with a `format` prop. Settings `Numeric` and Showcase `NumberField` (commit-per-keystroke) are
the behavioural outliers: switching them to blur/Enter commit is a small behaviour change — owner decision.

Risk: Medium (every coordinate box and inspector field). Tests: `test/mdl-save-fields.test.js`,
`test/display-number.test.js`, `test/showcase-layout.electron.cjs`, `test/showcase.electron.cjs`,
`test/ribbon-track.electron.cjs`, `test/particle-ribbon-fit.electron.cjs`, `test/movement-chain-focus-speed.electron.cjs`,
`test/portrait-movement.test.js`. Gap: no direct Escape-cancels test for Coordinate/PositionField.

### F4. Sliders: seven components, three "one undo per drag" implementations — Medium

| Component | Location | Look | Commit |
|---|---|---|---|
| `Slider` | `app/AnimXL.jsx:64-70` | label + output + low/high end labels, 0–100 | live `onChange(id, v)` |
| `Slider` | `app/ShowcaseWorkspace.jsx:48-50` | label + `{value}%` | live |
| `Slider` | `app/ParticleRibbonFields.jsx:8-13` | label + output | **draft; commit on pointerup/keyup/blur** |
| `Slider` | `app/PaintStudioLayout.jsx:11-13` | label + range + number box + suffix + `PaintKey` | live |
| `ParticleSlider` | `app/ParticleCluelessControls.jsx:9-17` | range + number box | **begin/change/finish/cancel gesture** |
| `SpeedControl` | `app/AnimationController.jsx:36-69` | number + range | **native `change` listener on release** (`:58-62`) |
| `MeshDensitySlider` | `app/MeshDensitySlider.jsx:5-31` | special (counts) | live, debounced |

Plus 25 inline `type="range"` inputs, e.g. `app/Settings.jsx:339,344` (sensitivity), `app/UVWorkspace.jsx:52,56,58,270`,
`app/PortraitToolbar.jsx:98,100,121`, `app/OptimizeXL.jsx:144,148`, `app/PaintSceneOptions.jsx:23,33`,
`app/NormalizerControls.jsx:25`, `app/ShapingDialog.jsx:80`, `app/ShowcaseLayerTools.jsx:106`,
`app/ModelManager.jsx:109`, `app/SortMyMess.jsx:283`, `app/GameFileBrowser.jsx:294`, `app/ParticleKeyTrack.jsx:30`.

Divergent in look and in undo semantics: live sliders that call `edit(...)` per input event create one history
step per pixel unless the caller debounces. Proposed owner: `useRangeCommit({ value, onCommit })` in
`app/Fields.jsx` (draft during drag, single commit on release/Escape-cancel — the ribbon and AnimationController
versions merged), plus an optional `RangeField` that renders label/range/output with a `className` so each
caller keeps its CSS. Callers to switch first: `ParticleRibbonFields.Slider`, `SpeedControl`; then
`AnimXL.Slider`, `ShowcaseWorkspace.Slider`, `PaintStudioLayout.Slider` (render-only wrappers). Leave
`ParticleSlider` (it already has a richer begin/finish contract) and `MeshDensitySlider`. Making all sliders
*look* alike is an owner decision.

Risk: Medium. Tests: `test/ribbon-track.electron.cjs`, `test/particle-ribbon-fit.electron.cjs`,
`test/ribbon-quick.test.js`, `test/anim-xl.electron.cjs`, `test/anim-xl.test.js`, `test/showcase.electron.cjs`,
`test/rotation-interaction.electron.cjs` (Settings sliders), `test/uv-grid.test.js`.

### F5. Collapsible sections and checkboxes: four components each — Medium

Collapsibles:
- `Section` `app/Fields.jsx:14` — `details.inspector-section`, chevron, `actions`, open by default, hotkey prefix + `expand` key.
- `Section` `app/AnimXL.jsx:73-78` — `details.ax-section`, closed by default, `note` summary, no hotkey.
- `SidebarSection` `app/SidebarSection.jsx:4-10` — `details.sidebar-section`, local open state.
- `FoldHeader` + `useFold` `app/AppSidebar.jsx:18-25` — a `<button aria-expanded>` with ▾/▸ and a closed summary, module-level `folds` memory.
- ~36 raw `<details>` in 31 files (e.g. `app/OptimizeXL.jsx`, `app/ParticleEditor.jsx`, `app/ShowcaseWorkspace.jsx` ×2, `app/SanityCheck.jsx` ×2, `app/AiAssistant.jsx` ×4).

Checkboxes/toggles:
- `Check` `app/Fields.jsx:12` — `label.check`, `data-hotkey="toggle:label"`.
- `Toggle` `app/Settings.jsx:74-76` — `label.settings-toggle`, `description` small text, `data-hotkey={id}`.
- `role="switch"` buttons: `app/AiAssistant.jsx:1061,1075,1087,1098,1769`, `app/AnimXL.jsx:88` (`ax-card-switch`).
- ~70 inline `type="checkbox"` (Settings 6, OptimizeXL 5, MovementControllerRecomp 5, AnimationController 5, PortraitToolbar 4, AnimXL 4...), each with a different hotkey shape or none.

Divergent: open-by-default, hotkey participation (only Fields' `Section`/`Check` and Settings `Toggle` register keys).
Proposed owner: `app/Fields.jsx` `Section` gains `note` and `defaultOpen`; AnimXL switches to it
(keep `className="ax-section"`). `Check` gains `description`/`id` so Settings `Toggle` becomes `Check`
with `className="settings-toggle"`. Keep `SidebarSection` (sidebar look) and `FoldHeader` (different control,
button not details) — they are the sidebar's own primitive and already shared.

Risk: Low-medium. Tests: `test/hotkey-badges.test.js`, `test/anim-xl.electron.cjs`,
`test/animations-sidebar.test.js`, `test/vis-mdlvis-mode.electron.cjs`.

### F6. "Close popover on outside click / Escape": eight hand-written copies — Medium

```js
// app/KeyframeTimeline.jsx:92-94         window (owner), bubble, refocuses panel
// app/PortraitToolbar.jsx:69-71          document (main only!), bubble
// app/ParticleKeyTrack.jsx:26-27         window, capture, closest('.pe-key-menu')
// app/OptimizeXLHelp.jsx:38              anchor.ownerDocument, pins
// app/AppToolbar.jsx:51-56               dock ownerDocument, capture, stopPropagation
// app/MovementControllerRecomp.jsx:78-81 ownerDocument, capture, stopPropagation
// app/PoseControls.jsx:31-33             ownerDocument, capture, Escape only
// app/PaintStudioLayout.jsx:21           window pointerdown capture (StrokeHistory), no Escape
```
Also `app/UVWorkspace.jsx:47` closes on blur instead. Divergent: `document` vs `ownerDocument` matters for the
detached OptimizeXL window (PortraitToolbar would fail there), capture vs bubble decides whether the global
Escape still fires, and only some call `stopPropagation`.
Proposed owner: `app/useDismiss.js` → `useDismiss(open, refs, onClose, { escape = true })` using
`ownerDocument`, capture phase, `stopPropagation` on Escape. All eight switch.
Risk: Low-medium (Escape precedence vs F1). Tests: `test/learn-menu.electron.cjs`, `test/portrait-toolbar.test.js`,
`test/hotkey-playback.electron.cjs`, `test/movement-create-ribbon-reentry.electron.cjs`.

### F7. Five copies of a Tab focus trap — Low-medium

`app/Forge.jsx:128`, `app/ParticleEditor.jsx:316`, `app/ResourceEditors.jsx:199`, `app/SortMyMess.jsx:158`,
`app/TextureLibrary.jsx:146`. Each re-lists focusable selectors slightly differently
(`summary`, `[tabindex="0"]`, `textarea` included or not). App `Dialog`, Settings, Attachemator, AnimXL and
BitsAndParts have none, so Tab escapes those modals.
Proposed owner: `trapTab(event, root)` in `app/focus-trap.js` (or inside `useDismiss`'s file); the five callers
switch, then `Dialog`/`ToolWindow` (F2) call it so every modal traps Tab.
Risk: Low. Tests: `test/event-focus.electron.cjs`, `test/sort-my-mess.electron.cjs`.

### F8. App.jsx: 100 states in one component; groups that already have a home — Medium (refactor candidates, not a rewrite)

Grouped by concern (state names exactly as in `app/App.jsx`):

| Group | State (line) | Existing / proposed owner |
|---|---|---|
| Preferences & persistence | `preferences`, `preferencesReady`, `settingsTab` (138-141) + refs `preferencesRef`, `savedPreferences`, `preferencesTimer` (148-150), `PANEL_WIDTH_EVENT` listener (151-155), save effect (1543-1550), load in boot effect (1517) | **`usePreferences()`** in `app/usePreferences.js` (new small hook; `src/preferences.js` stays the normaliser) |
| Updates | — | `useUpdates` (`app/useUpdates.js`) — already extracted, good |
| Documents / sessions | `session`, `sessions`, `tick`, `saving`, `recentFiles`, `recoveries`, `fileDrag`, `saveDataChoice` (172-176, 258, 302-303, 315) | leave in App (core); `tick` is a force-render counter used by `changePose`/`changePoseView` |
| Status / notices | `status`, `statusAlert`, `notice` (+ `mdlxl-notice` listener 305-306) | `useStatus()` returning `say` |
| Editor mode & tools | `mode`, `tool`, `cameraMode`, `managerKind`, `visUI`, `teamColor`, `renderMode`, `movementRenderMode`, `previewRenderModes` (177-181, 208-209) | leave |
| Camera / views | `view`, `portraitView`, `quadView`, `activeVertexPane`, `vertexViewRequest`, `vertexDragCenter`, `cameraAngles`, `cameraAnglesRequest`, `cameraGesture`, `adjustingInput`, `zoomAnchor`, `choosingZoomAnchor` (178-193, 317) | `useCameraState()` — moderate |
| Workplane | `storedWorkplane`, `storedWorkplaneEnabled`, `restrictions`, `grabThroughByEditor` (178, 203, 248-249) + pose overrides (285-288) | belongs with display group below |
| Display overlays (XL vs VIS pair + POSE override) | `xlCleanViews`, `visCleanViews`, `xlOverlayModes`, `visOverlayModes` (269-271) and the 20 derived lines 272-298 | **`useEditorDisplay(visUI, poseView)`** next to `src/display-overlays.js` (which already owns `storedEditorDisplay`/`saveEditorDisplay`) — best-contained candidate |
| Selection / geosets | `checkedGeosets`, `selection`, `activeGeoset`, `uvSet`, `visibleOnly`, `showAllGeosets`, `hideExtras`, `activeGeosetTab`, `viewHoveredGeoset`, `selectionHoveredGeoset`, `selectedNodeIds`, `attachSourceIds` (210-215, 220, 242) | leave (crosses everything) |
| Playback | `sequence`, `time`, `playing`, `playbackSpeed`, `globalSeqId`, `highlightByPanel`, `highlightChain`, `animationPanel`, `movementMode`, `movementSpace`, `showNodes`, `motionAnchor`, `rgbPreview`, `rgbSequence` (217-220, 267, 339) | `usePlayback()` — moderate |
| Portrait | `portraitEnabled`, `portraitCameraIndex`, `portraitSnapRevision`, `portraitSettings`, `portraitPreviewChanged`, `portraitLightingStatus`, `controlModelIds`, `controlModelGroup` (194-201) + session-reset effects (197-198) + backdrop look storage (553-556) | **`usePortraitState(session.id)`** |
| Dialogs / tool windows | `dialog`, `context`, `normalizer`, `attachematorOpen`, `boneCreateOpen`, `geosetsFloat`, `materialVisibility` (147, 183, 212, 218, 242) | leave; `dialog` is a tagged union (23 `type`s) — fine |
| UV | `uvWindow`, `uvFocused`, `uvEntrySelection`, `uvEntryId`, `liveUV` (259-260, 302) | `useUVWindow(session)` — small |
| Showcase | `showcaseHistoryState`, `showcaseSession`, `showcaseVisited`, `background` (169-171, 268) | `usePreviewBackgrounds` already exists; `background` + its localStorage could move into it |
| Desktop settings mirror | `historyMB`, `historySteps`, `anchor`, `normalAngle`, `gameDataPath`, `gameDataSources` (315-316) | part of `usePreferences()`/desktop settings |
| AI | `aiOffscreen` (1407) | leave |
| Capture | `captureAPI` (255) | leave |

Props threaded 3+ levels (prop-bag size from the destructured signatures): `AppDialogs` takes **90** props
(`app/AppDialogs.jsx:23-35`), `MovementController` 61, `RigSidebar` 40, `AppToolbar` 38, `AppTimeline` 37,
`AppUVWorkspace` 33, `ResourceManagerView` 32, `GeosetPicker` 29, `VertexTools` 27. Chains:
- `preferences` + `teamColor`: App → AppDialogs → ParticleEditor → ParticleLibrary → thumbnail `GamePreview` (4-5 levels); 15 of 21 `GamePreview` mounts take `preferences`, mostly for `pointerSensitivity`/`wheelMode`/`viewportAppearance`.
- `Dialog`: App → AppDialogs/AppSidebar → AnimationController/SanityCheck/SaveEditorData/UpdatePrompt/GeosetTabs (fixed by F2).
- `onHotkeys={()=>setSettingsTab('hotkeys')}`: built 8× in `app/AppDialogs.jsx` and threaded into Dialog/ResourceEditors.
- `say` → `onStatus` into AppPanels/Showcase.
Proposed: one `PreferencesContext` (the codebase already uses context for hotkeys: `app/Hotkeys.jsx:10-11`
`HotkeysContext`/`useHotkeys`) read by `GamePreview`/`Viewport`; an `openHotkeySettings` on that context
removes the `onHotkeys` closures. Do not split App further than the hooks above without owner approval.

Risk: Medium-high for any hook move (11 source tests read `App.jsx` text: `test/animations-sidebar.test.js`,
`test/bone-influence-view.test.js`, `test/compact-toolbar.test.js`, `test/file-input.test.js`,
`test/hd-models-view-only.test.js`, `test/particle-reentry.test.js`, `test/portrait-movement.test.js`,
`test/portrait-toolbar.test.js`, `test/quick-display-placement.test.js`, `test/release-fixes.test.js`,
`test/vis-mdlvis-mode.test.js`). These are text-shape tests and will need updating with each move.

### F9. Persistence: 21 localStorage keys, 6 local helper pairs, 3 prefixes — Medium

`src/preferences.js` is a **normaliser only** (`normalizePreferences`, `migratePreferences`); it never touches
storage. The only storage owner for preferences is `app/App.jsx:138` (read `mdlvis-preferences`) and
`:1546` (write, every change, even on desktop) plus `window.desktop.configure({preferences})` at `:1548`
(desktop authoritative, loaded at `:1517`). Settings → Reusable configuration exports only `preferences`
(`app/Settings.jsx:285` via `src/portable-settings.js`), so the side keys below are not exported/imported.

| Key | File:line | Guarded try/catch | Covered by preferences? |
|---|---|---|---|
| `mdlvis-preferences` | `app/App.jsx:138,1546` | yes | is preferences |
| `mdlvis-preview-background` | `app/App.jsx:268,392` | **no** | no (Showcase background) |
| `mdlxl-portrait-background-look` | `app/App.jsx:553,556` | yes | no |
| `mdlxl-editor-display` | `src/display-overlays.js:48-60` | yes | no |
| `mdlxl-ai-width` | `app/AiAssistant.jsx:90,126,981` | yes | no (cf. `panelWidth` is in preferences) |
| `mdlxl-addons` | `app/Addons.jsx:7-8` | yes | no |
| `mdlxl.animxl.presets` + per-sequence `keyFor(seq)` | `app/AnimXL.jsx:58-61,161,200,491` | yes (`readSaved/writeSaved`) | no |
| `mdlvis-classic-hotkeys-catalog-v1` (+ legacy `…warmkeys…`) | `app/Hotkeys.jsx:12,17,104`, `src/hotkey-defaults.js:45` | yes | catalog cache (not prefs; fine) |
| `mdlxl-learn-keycaps-v1` (+ legacy shredder key) | `app/Learn.jsx:14,21`, `src/learn-keycaps.js:8-9` | yes | `learn` settings are in prefs; notebook separate (fine) |
| `mdlxl-sound-expansions` | `app/NodeEventEditor.jsx:7-27` | yes | no |
| `mdlxl-particle-mode` | `app/ParticleEditor.jsx:172` | **no** | **write-only: never read anywhere** |
| `mdlxl-showcase-saved-colors-v1` | `app/ShowcaseWorkspace.jsx:31-37,169` | yes | no |
| `mdlvis.library.tab`, `mdlvis.texture-library.vibe`, `mdlvis.texture-library.blp-only` | `app/TextureLibrary.jsx:20-22,82,153-154` | yes (inline) | no |
| `mdlvis.game-files.variant`, `mdlvis.game-files.style` | `app/GameFileBrowser.jsx:24-25,105-106,249-256` | yes (`remembered/remember`) | no |
| `mdlxl.uv.side-percent`, `mdlxl.uv.preview-percent` | `app/UVWorkspace.jsx:23,31-37,96-139` | yes (`storedLayout/rememberLayout`) | no (cf. `uvGrid`, `uvPreviewDisplay` *are* in prefs) |
| motion decisions (prefix + model hash) | `src/motion-decisions.js:55` | — | no (per-model, fine) |

Six near-identical "read with fallback / write and swallow" helpers: `UVWorkspace.storedLayout/rememberLayout`,
`GameFileBrowser.remembered/remember`, `AnimXL.readSaved/writeSaved`, `TextureLibrary.preferred*`,
`ShowcaseWorkspace.readSavedColors`, `NodeEventEditor.readExpansions`. Key prefixes mix `mdlvis-`, `mdlvis.`,
`mdlxl-`, `mdlxl.`.
Proposed owner: `src/local-store.js` → `readStored(key, fallback, normalize)` / `writeStored(key, value)` (JSON,
try/catch) and optionally `useStoredState(key, fallback, normalize)`; the six helpers and the two unguarded
call sites switch. **Keep every existing key name** (users' saved layouts/presets). Whether UV split percents
or AI width should join `preferences` (and so be exported) is an owner decision. Remove the dead
`mdlxl-particle-mode` write (or read it, if restoring the mode was intended).

Risk: Low (pure helpers) if keys are preserved. Tests: `test/preferences.test.js`, `test/desktop-settings.test.js`,
`test/uv-workspace-layout.test.js`, `test/texture-library.test.js`, `test/learn.test.js`,
`test/learn-menu.electron.cjs` (migration), `test/hotkey-migration.test.js`.

### F10. CSS: nine modal backdrops, two byte-identical window pairs, hand-kept window lists in new-look.css — Medium

Backdrops (all `position:fixed;inset:0;display:flex;align-items:center;justify-content:center`):
`app/styles.css:7` `.classic-modal` (z 100, `#0002`), `app/resource-editors.css:1` `.resource-editor` (z 100,
transparent, Tahoma 11px), `app/forge.css:1` `.forge-overlay` (z 1200, `#0009`), `app/bits-and-parts.css:1`
`.parts-overlay` (z 1250, `#0009`, Arial 13px, `var(--text,#ebe6de)`), `app/texture-library.css:1` `.tl-overlay`
(z 1600, `#0009`, Arial 12px), `app/ai-assistant.css:169` `.ai-cleanup-shade` (z 2000, `#0005`),
`app/sort-my-mess.css:1` `.smm-overlay` and `app/attachemator.css:1` `.atm-overlay` (**identical**, z 2100,
`#0007`, system-ui 13px), `app/paint-workspace.css:84` `.paint-modal-shade` (z 16000, `#0007`, grid).

Window chrome: `app/sort-my-mess.css:2` `.smm-window` and `app/attachemator.css:2` `.atm-window` are identical
except width/height; their button rules are identical too (`sort-my-mess.css` `.smm-window button,...` vs
`attachemator.css` `.atm-window button{...}`). `forge.css:1` `.forge-overlay button` and
`paint-workspace.css` `.paint-workspace button` share the same panel/text/border/hover rules.
`texture-library.css:1` `.tl-dialog` (`#20282e`) and `bits-and-parts.css:1` `.parts-dialog` (`#302d28`) hard-code
dark colours that `theme.css:42` re-themes again.

Then `new-look.css:199-203` restyles windows from a **hand-maintained list** of 16 classes
(`.classic-modal-window,.classic-dialog,.re-window,.ax-window,.smm-window,.atm-window,.uv-tab-window,…`), and
`:194-195` exclude another hand list (`.tl-dialog *,.tl-overlay *,.parts-dialog *,.parts-overlay *, .ai-assistant *`).
`new-look.css` targets 57 forge, 28 texture-library, 25 resource-editor, 17 movement, 16 parts, 13 showcase, 11
smm, 11 atm selectors — so most tool windows are styled in three layers: own file → `theme.css` → `new-look.css`.
Every new window must be added to those lists by hand.

Proposed owner: one shared class pair defined once in `app/styles.css` + `theme.css` + `new-look.css` —
e.g. `.mdlxl-overlay` (backdrop) and `.mdlxl-window` (chrome) — emitted by `Dialog`/`ToolWindow` (F2) next to
the existing feature class. Start with the identical `smm`/`atm` pair (merge to one rule each), then replace
the 16-class lists in `new-look.css:199-203` with `.mdlxl-window`. Keep feature classes for layout. The
z-index ladder (100 → 16000) should become 3 named tokens (`--z-modal`, `--z-tool-window`, `--z-workspace-modal`)
in `theme.css`.

Risk: Medium (visual). Tests: `test/appearance.electron.cjs`, `test/appearance-contrast.electron.cjs`,
`test/appearance-themes.test.js`, `test/vis-mdlvis-mode.electron.cjs` / `.test.js`,
`test/module-button-labels.browser.cjs`. Needs a packaged visual check of every window in light, dark and VIS.

### F11. CSS tokens: duplicates, undefined variables, a dark-theme axis colour override — Low-medium (two likely bugs)

- **Duplicate axis tokens fighting:** `theme.css:108` sets `--functional-axis-x/y/z` from `--ui-channel-*`
  under `:root[data-palette]` (always present, `app/theme.js:20`). `styles.css:30-31` (loaded *after* theme.css
  via `@import` at `styles.css:1`) sets `:root{--functional-axis-…}` and `:root[data-theme=dark]{--functional-axis-y:#00ff00}`.
  Same specificity (0,2,0), later wins → **in every dark theme the Y coordinate label is pure `#00ff00` while X/Z
  use the theme's soft `#ff9797`/`#a6b6ff`**. Coordinates are coloured twice: `theme.css:38-40` (`--ui-channel-*`) and
  `styles.css:60-62` (`--functional-axis-*`, higher specificity, wins). Likely bug — verify in the app.
- **Undefined variables (always fall back, ignore theme):** `var(--selection,#d8eaff)` `particle-editor.css:1`
  (should be `--ui-selected`); `var(--error,#942b21)` `movement.css`; `var(--ui-error,#a32913)` `pose-controls.css`
  (should be `--ui-danger`); `var(--ui-text-muted,#555)` `particle-editor.css`, `styles.css` (should be `--ui-muted`).
- **Legacy aliases:** `--panel/--text/--accent` are defined only in `new-look.css:193` (XL look) and hard-coded in
  `KeyframeTimeline.css:38`; `particle-editor.css:17,31,33,35,37` use `var(--panel,#e6e6e6)`, so in VIS + dark the
  Particle Editor sub-views fall back to light grey.
- **Per-file token copies:** `ai-assistant.css:3-5` `--ai-accent/--ai-line/--ai-soft` duplicate
  `new-look.css:12-15` `--m-line/--m-soft/--lit` (same `color-mix` formulas, 38% vs 32%).
- **Hard-coded colours:** 1,232 hex literals outside `theme.css` (`#fff` 95, `#000` 73, classic `#d4d0c8` 53, `#555` 42);
  `theme.css` then needs 37 `[data-theme=dark]` override blocks to undo them.
- **`!important`:** 477 total — `new-look.css` 264, `ai-assistant.css` 50, `settings.css` 27, `particle-editor.css` 22,
  `movement.css` 14, `forge.css` 12, `anim-xl.css` 12, `portrait-view.css` 11, `resource-managers-xl.css` 10. `new-look.css`
  also escalates to `:root #root .classic-app.classic-app:not([data-vis-ui])` (id + doubled class, 201 uses).

Proposed owner: `app/theme.css` for all tokens. Delete `styles.css:30-31` (theme.css:108 already owns axis
colours) — or, if the bright Y was intended, move it into `theme.css` per theme. Rename the four undefined
vars to the existing `--ui-*` tokens. Make `--ai-*` aliases of `--m-*`. Leave `!important` reduction to after F10.
Risk: Low (colour only). Tests: `test/appearance-themes.test.js`, `test/appearance-contrast.electron.cjs`,
`test/vis-mdlvis-mode.electron.cjs`.

### F12. Repeated small CSS utility blocks — Low

Script result (identical ≥3-declaration blocks across files): 49 groups. The meaningful ones:
- ellipsis trio `overflow:hidden;text-overflow:ellipsis;white-space:nowrap` ×10 (`ai-assistant.css:35`,
  `AnimationController.css:56`, `model-manager.css:15`, `modules.css:31`, `paint-studio.css:16`, `pose-controls.css:41,46`,
  `showcase.css:25,28,41`) plus 3 more with `flex:1;min-width:0`.
- visually-hidden `clip-path:inset(50%);height:1px;…` ×2 (`ai-assistant.css:27` `.ai-hidden-label`,
  `pose-controls.css:19`) — and Settings has `.settings-sr-only` (`app/Settings.jsx:361`).
- preview fill `height:100%;inset:0;position:absolute;width:100%` for `>.game-preview-root` ×5 (`model-manager.css:3`,
  `particle-editor.css:3,31,35`, `texture-library.css:47`).
- header row `display:flex;align-items:center;justify-content:space-between` ×9.
Proposed: `.sr-only` and `.preview-fill` in `styles.css`; the rest is acceptable local layout. Risk: Low.

### F13. Translation wrapping — Low

`vite.config.js:4` injects `localizedCreateElement` (`app/localized-element.js:6-15`) as the JSX factory, so every
string child and `title/aria-label/placeholder/alt/data-hotkey-label` on **DOM elements** is translated
automatically. Consistency observations:
- **Needed explicit calls (correct):** strings inside fragments/props of components (`app/AppSidebar.jsx:63`
  `title={<>{translate('Geosets')}…</>}`, `app/MovementControllerRecomp.jsx:210`), imperative DOM
  (`app/Viewport.jsx:982-983`, `app/Hotkeys.jsx:128`), `translate="no"` + explicit key names (`app/Learn.jsx:139`,
  `app/PressedKeys.jsx:31`).
- **Redundant double translation** on DOM elements in `app/AiAssistant.jsx` (`:1079,1091,1102` `title={translate(…)}`
  on `<button>`, `:1179,1187,1321-1324` `<option>{translate(…)}</option>`, `:1318,1336`, `:1492,1579,1615,1833`):
  harmless in ru/es/zh, but in Mordor mode `translate` falls back to `blackSpeechCipher` (`src/localization.js:76`),
  so text is ciphered twice and differs from the same text elsewhere.
- **Second string system:** Paint uses key ids `paintMessage('paint.x')` (`src/paint-messages.js`, ~250 English
  strings; `app/PaintWorkspace.jsx:19` etc., 6 files). Output still passes through the JSX translator, so it works,
  but Paint's `{name}` placeholders (`src/paint-messages.js:254-257`) are filled before translation, unlike the
  catalog's `{0}` templates.
Proposed: remove the redundant `translate()` wrappers in `AiAssistant.jsx`; leave Paint's key layer (it has its
own test `test/paint-localization.test.js`). Risk: Low. Tests: `test/localization*.test.js`,
`test/localization.electron.cjs`, `test/paint-localization.test.js`, `test/showcase-localization.test.js`.

### F14. Two `Tool` buttons for the same jobs; different Move icon — Low

`Tool` `app/EditorControls.jsx:6-9` (classic image or `ModernIcon`, optional `LookIcon`, badge) vs `Tool`
`app/UVWorkspace.jsx:40-43` (lucide via `UV_ICONS`, `uv-tool`, `data-hotkey-category="UV"`). The UV tool row
uses `Hand` for **Move** (`UVWorkspace.jsx:39` `move: Hand`) where the main toolbar's Move uses `sb_move` → lucide
`Move` (`app/ModernIcon.jsx:8`), and `Maximize2` for scale where the main toolbar's Resize uses `sb_zoom` → `Search`.
"One way of doing things" suggests the same icon for the same job.
Proposed: UV `Tool` renders `EditorControls.Tool` with `className="uv-tool"`, adding the UV icons (`mirrorX`,
`fold`, `uncouple`) to `ModernIcon`'s table; icon choice is an owner decision. Risk: Low. Tests:
`test/uv-tools.test.js`, `test/uv-tool-state.test.js`, `test/uv-controls.electron.cjs`, `test/module-button-labels.test.js`.

### F15. Loading fallbacks: eight different markups — Low

`<Suspense fallback>` in 25 places with: `div.classic-modal` text (`app/AppDialogs.jsx:46-50` ×5),
`div.classic-modal > div.classic-modal-window` (`:70`), `<Dialog title=…>` (`:44`), `div.classic-modal > p`
(`app/AppPanels.jsx:51`), `div.classic-empty-view` (×7), `<span>` (×7), `<p>` (×3), `null` (×8).
The `.classic-modal`-only variants render bare text on the backdrop with no window.
Proposed: `LoadingWindow({title})` in `app/Dialog.jsx` for window-type lazies; keep `classic-empty-view` for
workspaces. Risk: Low. Tests: `test/startup.electron.cjs`.

### F16. Dead or orphaned code in the shell — Low

- `openDetachedUVWindow` / `UV_WINDOW_NAME` `app/detached-window.js:1,8-12` — used only by `test/uv-detached-window.test.js`;
  the UV editor is now the contained `UVWindow`. `electron/main.cjs:627` still allow-lists `'MDLxL-UV'`.
- `neutralTextColor` exported from `app/AppToolbar.jsx:16-20` — no caller anywhere.
- `mdlxl-uv-key` dispatched at `app/Hotkeys.jsx:233` with no listener.
- `mdlxl-particle-mode` written at `app/ParticleEditor.jsx:172`, never read.
- Local hex↔RGB helpers repeated in UI files: `app/ParticleCluelessControls.jsx:8`, `app/ParticleRibbonFields.jsx:4,29`,
  `app/PortraitToolbar.jsx:14`, `app/paint-lamps.js:46`, `app/uv-material-preview.js:12`, `src/paint-palette.js:1,5`
  (likely also flagged by the `src/` auditor).
- Keycap renderers: `PaintKey` `app/PaintStudioLayout.jsx:9` vs `keyHint` `app/PaintCutoutEditor.jsx:81` vs inline
  `<kbd className="paint-key">` `app/PaintTextureShelf.jsx:48` — same markup three ways.
Risk: Low; delete after confirming with the owner (the UV detached window may be a planned option).

---

## Already shared and good

- `useMovableWindow` `app/useMovableWindow.js` — one title-bar drag for App `Dialog`, ResourceEditors, AnimXL,
  ParticleEditor, PoseControls and `UVWindow` (with `contained`); clamps on resize. Extend it, don't copy it.
- `Tool` + `CameraTools` + `TransformTools` + `WorkplaneControls` + `Coordinate` in `app/EditorControls.jsx`, used by
  AppSidebar, AppToolbar, ForgeEditor, ForgeMoldTools, ForgeShapes — the one toolbar button, with `LookIcon`/`ModernIcon`.
- `Fields.jsx` (`TextField`, `NumberField`, `SelectField`, `Check`, `VectorField`, `Section`, `TrackEditor`) — good
  draft/commit/Escape contract and hotkey ids; the target for F3/F5.
- `SidebarSection` `app/SidebarSection.jsx` — used by AnimationController, AnimationNodes, App, AppSidebar, Movement.
- `DetachedWindow` `app/DetachedWindow.jsx` — copies styles, applies theme (`applyApplicationTheme(…, targetDocument)`),
  forwards keys, registers the root with Hotkeys (`mdlxl-detached-root`) — a clean second-document host.
- `applyApplicationTheme` / `readableTextColor` `app/theme.js` — single place that turns preferences into CSS variables.
- `localizedCreateElement` `app/localized-element.js` + `translate` `src/localization.js` — one translation adapter for
  all JSX; preserves option values; `translate="no"` opt-out.
- `HotkeysProvider` / `useHotkeys` / `controlActionId` `app/Hotkeys.jsx` and `allocateGroup` `src/hotkey-allocation.js` —
  the right owner for window keys (F1 is about windows not using it).
- `normalizePreferences` / `migratePreferences` / `chordFromEvent` / `isTypingTarget` `src/preferences.js` — shared and
  widely imported.
- `bindDropdownWheel` `src/dropdown-wheel.js`, installed once at `app/App.jsx:144`.
- `storedEditorDisplay` / `saveEditorDisplay` `src/display-overlays.js` — guarded, injectable storage; the pattern F9's
  helper should copy.
- `useUpdates`, `usePreviewBackgrounds`, `useMotionInspector` — App state already extracted into hooks; the model for F8.

## Suggested order (smallest, safest first)

1. F16 dead code, F11 token fixes, F13 redundant translate — prose/colour only.
2. F9 `src/local-store.js` (keys unchanged).
3. F2 step 1: move `Dialog` to `app/Dialog.jsx`, drop the `Dialog` prop.
4. F6 `useDismiss`, F7 `trapTab`.
5. F3/F4 hooks in `Fields.jsx`, callers one at a time.
6. F1 window keys through `data-hotkey="close"`, then the generic claim event.
7. F10 shared window classes, then shrink `new-look.css` lists.
8. F8 hooks (`useEditorDisplay`, `usePortraitState`, `usePreferences`) — each with its source-test updates.

## Method and gaps

Static reading with `grep`/`sed` plus two scratch scripts (CSS identical-block finder, prop-count from
destructured signatures; in the session scratchpad, not in the repo). Nothing was built, run or packaged.
The two "likely bug" items (F11 dark Y axis colour, F2 EmitterTextDialog/Showcase modality vs Hotkeys) are inferred
from specificity/attribute rules and need a packaged check. Domain logic of tool windows was not reviewed.
