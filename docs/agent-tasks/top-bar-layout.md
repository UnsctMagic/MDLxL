# Top bar layout: status row items up, model tabs down, warning toasts

State: contract written 31 Oct 2026 by Claude Code; implementation not started.
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

Codex: implement on `codex/top-bar-layout`, open a PR into `main` with
`Session: codex <chat name>`, update this note's State line and the README table.
