# Top bar layout: status row items up, model tabs down, warning toasts

State: implemented 1 Nov 2026 by Codex; ready to test and awaiting merge approval.
Owner of implementation: Codex. Branch: `codex/top-bar-layout` from current `main`.

## Goal (owner's words)

"Move everything with green arrows up there and MATCH that UI. Tabs move down.
Addons go into Settings. Warning box goes where I made a red box (so warnings etc
go there as a popup and disappear). And no messages like 'opened this file' etc —
just useful warnings."

The owner marked a screenshot of the default look (not VIS) in Animations mode.
Their answers to follow-up questions: "tabs" means the **open-model file tabs**
only; the small arrows pointing at the model's waist are unrelated — ignore them.

## Required result

1. **Bottom-right status items move to the top toolbar.**
   - `MDX800 ⇄` (convert version) and the `DPI …× / Scroll …×` readout move from
     the bottom status row into the top toolbar's model group, right after the
     language switch, team colour picker and Smooth/Classic toggle
     (`toolbar-model` in [AppToolbar.jsx](../../app/AppToolbar.jsx)).
   - **Match that UI**: they take the same look as the existing items in that
     group (same height, frame, font, spacing, hover, theme variables). No new
     style family, no new group box, no labels added. Keep their current
     behaviour, tooltips, `data-hotkey="convertVersion"`, disabled rules and the
     `adjusting` highlight on DPI/Scroll.
   - In VIS mode, `inputStrength` already sits in the top row; leave VIS as it is
     unless the default-look move makes it inconsistent (then match it).
2. **Add-ons move into the Settings menu.**
   - Remove the `Add-ons` button from the status row. Add an `Add-ons…` item to
     the Settings menu: desktop menu in [electron/menu.cjs](../../electron/menu.cjs)
     (`Settings` submenu, before the separator) and the browser fallback menu in
     `AppToolbar.jsx` (`classic-menu`).
   - It opens the existing Add-ons panel from [Addons.jsx](../../app/Addons.jsx)
     unchanged (install/list/run/close). Reuse it — do not build a new settings
     page. The panel must open on screen (it currently drops from the status row;
     anchor it near the top instead) and keep its Escape/close behaviour and
     `data-hotkey-scope="addons"`.
3. **Open-model tabs move down to the bottom row.**
   - `ModelTabs` leaves the `classic-modules` row and takes the left part of the
     bottom row (`classic-status` in [App.jsx](../../app/App.jsx)), where
     "Opened …" is now. Editor tabs (Vertices, Bones, Movement, Animations,
     Managers, Citadel Paint, Showcase) and Quick Display stay where they are.
   - Tabs keep their dirty dot, close ×, middle/regular click, wheel scroll and
     overflow measuring. With one model open the tab still shows.
   - The row the tabs leave must not leave an empty gap; the `module-divider`
     goes with them if nothing remains to divide.
4. **No status chatter; warnings become a toast in the red-box area.**
   - Stop showing the plain status text in the bottom row ("Ready", "Opened …",
     "Saved …", mode hints such as "Vertex editor (F1)", "Modified · ",
     "Human UI portrait simulation …"). The tab's dirty dot already shows
     unsaved work; "Saving…" may stay as a tiny indicator only if dropping it
     would hide a running save — prefer the tab/save button showing it.
   - Useful warnings and errors show as a small popup at the **bottom-left of
     the 3D viewport, just above the timeline**, full content width of that area
     at most (the owner's red box spans from the left edge to about the middle).
     It fades out by itself after a few seconds, can be dismissed by click, and
     never blocks mouse camera rotation or editing outside its own box.
   - What counts as a warning: `say(message, true)` errors (`statusAlert` in
     App.jsx), and the existing clickable status warnings such as
     `Duplicate geoset animations` (keep it clickable to open the repair dialog;
     a warning that has an action may stay until acted on or dismissed).
     Read-only / HD-view-only notices on open are warnings too.
   - Plain success/info messages (`say(message)` without `true`) are not shown.
     Go through the ~105 `say(` calls in App.jsx and any other `setStatus`
     callers (`rg "say\(|setStatus\(" app`); if a non-error message is a real
     warning (data lost, conversion refused, file not found, read-only, etc.),
     mark it as a warning rather than dropping it. List the reclassified ones in
     the PR.
   - Same warning repeated: show once, restart its timer, do not stack copies.
     At most a couple visible at once; newest on top.
   - Use the theme variables (see the "Main window look" map row); the existing
     `data-alert` flash style is the starting point. No game-style look.

## Out of scope / keep

- Motion warnings below the timeline ([MOTION-INSPECTOR.md](../MOTION-INSPECTOR.md))
  keep their own place and behaviour. Do not route them into the toast.
- No new panels, toolbars, dashboards or settings pages. No change to the
  module dock icons, sidebar, timeline, Portrait Frame View row or viewport
  `Orthographic / Fit / Fit selection` box.
- [MERGER_NOTES.md](../../MERGER_NOTES.md) line 5 still says the language selector
  sits in the bottom status row; it is already at the top. Update that line to
  describe the new layout (language, team, Smooth, MDX, DPI/Scroll on top; model
  tabs in the bottom row). Read the rest of MERGER_NOTES before editing the
  toolbar.
- If the bottom row ends up holding only the model tabs, keep its current
  height; do not add filler.

## Where to look

- Map rows: "Main window look" and "Desktop recovery, settings, game data,
  add-ons" in [agent-map.md](../agent-map.md).
- [AppToolbar.jsx](../../app/AppToolbar.jsx): `toolbar-model`, `classic-modules`,
  `ModelTabs`, browser `classic-menu`.
- [App.jsx](../../app/App.jsx): `say`, `status`/`statusAlert`, `inputStrength`,
  the `classic-status` row (MDX button, `<Addons>`, duplicate-animation warning).
- [ModelTabs.jsx](../../app/ModelTabs.jsx), [Addons.jsx](../../app/Addons.jsx),
  [electron/menu.cjs](../../electron/menu.cjs), styles in
  [new-look.css](../../app/new-look.css) and [modules.css](../../app/modules.css).

## Verification

- Source tests that pin the old layout will need updating, not deleting:
  [compact-toolbar](../../test/compact-toolbar.test.js),
  [addons](../../test/addons.test.js),
  [module-button-labels](../../test/module-button-labels.test.js),
  [vis-mdlvis-mode](../../test/vis-mdlvis-mode.test.js). Run `pnpm run test:source`
  and `pnpm test`; compare against `.github/known-test-failures.txt`.
- Packaged app (`pnpm run build` then package), hidden desktop, owner's real
  settings: default look and VIS look; captures of the top bar, the bottom row
  with 1 and 4 open models, the Settings menu with Add-ons…, the Add-ons panel
  opened from it, a forced error toast over the viewport and its fade-out, and
  the duplicate-geoset warning clicked. Check a real mouse-drag camera rotation
  still works with a toast showing. Check narrow window (1280 px) and 150 % DPI
  for overlap or cut-off.
- Report `ready to test` with a short click-through for the owner.

## Next action

Review the `codex/top-bar-layout` PR into `main`, then owner/Claude QA click-through.
Do not merge without the owner's approval.

## Implementation and handoff

- Base: `0cad695887d689d4e7e90aee568b8a1f91ee4b82` (current `main` after #483).
- MDX and DPI/Scroll now share `toolbar-model` after the existing language,
  team and Smooth controls. Their behavior, tooltip, disabled rule and input
  adjustment highlight remain. VIS retains its existing top readout.
- Settings → Add-ons… in both menus opens the same `Addons` install/list/run
  panel near the top. Escape and close use the existing panel scope. Outside
  clicks do not introduce a new dismissal behavior.
- `ModelTabs` is mounted once in the bottom row, including one model. The
  module divider and vacated grid rows are gone. Its selection, dirty dot,
  close, scrolling and overflow logic remain; middle-click closes a tab as
  required by this contract.
- `WarningToasts` lives inside `classic-view`, above the timeline. Errors are
  deduplicated, newest first, capped at two, click-dismissible and fade out
  after five seconds. The duplicate-animation repair action remains until
  dismissed. Motion Inspector warnings and their ownership were not changed.

### Status audit

Reviewed every App `say` call and all `app/` `setStatus` callers. Other
`setStatus` owners (Settings, updates, mesh density) maintain their own panels;
they do not feed the removed main-window status text. `usePreferences`,
`usePreviewBackgrounds` and dialog error callbacks already supply `true`.

Reclassified these former info messages as warnings:

- Read-only and HD view-only notices when opening or switching models.
- HD-to-SD conversion notice (unsupported HD content was converted).
- No bone moves this part; select nodes / vertices before copying.
- Bake Text before saving; save/revert temporary UV previews before Undo.
- Choose a Warcraft III installation in the desktop app (both callers).
- No compatible geosets to merge (both callers); stale merge selection;
  model-format limits kept selected geosets separate; no parts to separate.
- Save-preparation notes, separately from the suppressed Saved/Downloaded text.

The listed source tests were updated, with five failures recorded on the
unchanged main layout. The additional Smooth toolbar test fixture now supplies
the model prop required by the moved MDX control. A new packaged
`top-bar-layout` harness exercises the user path with real models and a
disposable copy of the owner's settings. Its first run on main failed:
`MDX conversion belongs to the top model group: 0 !== 1`.

Full source: 2,610 pass / 0 fail / 10 existing conditional skips; compatibility:
57 pass / 0 fail / 0 skip. The empty known-failure baseline is unchanged.
Final focused source checks: 33 pass / 0 fail / 0 skip. The packaged
`top-bar-layout` harness passed on the hidden `MDLxLTests` desktop in default
and 150% DPI variants (one harness per variant, eight workflow groups each,
zero page errors and no skips). Both used a disposable copy of the owner's
real settings and 1280 px window bounds. Captures cover default/VIS one and
four model layouts, Add-ons, warning/fade/removal and duplicate repair.
Real Alt+mouse drags changed the camera while a warning remained visible.
Read-only/HD warnings, MDX disabled state, error deduplication, the two-warning
cap, tab dirty/Undo, middle/close clicks and overflow wheel scrolling also ran.
The owner's source settings remained byte-identical. The package and disposable
profiles were removed. Two reviewed capture sheets, JSON report and logs remain
at `D:\Codex\mdlxl-top-bar-layout-report`.

### Verification boundary

Native Settings menu contents are read from the packaged app and checked
against the desktop template. The actual native OS menu click was not
exercised: keyboard/UI Automation probes on the hidden desktop did not expose
that menu. Real Settings → Add-ons clicks and the complete panel workflow are
verified through a packaged renderer without the desktop preload (the existing
browser fallback). The owner's native-menu click-through remains required.

Several older packaged harnesses still assert removed status chatter or the old
`.classic-status .status-warning` selector. They were not run as part of this
layout acceptance and need their assertions migrated to visible effects before
the next full release suite (not restored product chatter). Examples:
`alert-ping`, `model-tabs`, `dummy-bone`, `geoset-operations`,
`geoset-merge-conflicts`, `localization`, `normalizer`, `vis-mdlvis-mode`,
`uv-preview-edit-constraints`, `pose-complex`, `showcase`.
