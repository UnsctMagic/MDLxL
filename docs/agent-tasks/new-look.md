# New MDLxL look

Status: ready for review; awaiting merge approval
Owner / consolidator: Claude Code (side session of the mockup session)
Updated: 2026-10-24 (complete pass)

## Goal and completion criteria

- Build the look the owner approved from hidden-desktop mockups: carved sidebar
  tool tiles with new icons and a user-pickable highlight colour, new top-row
  icons in the theme text colour, the slate-and-gold module dock with the AI
  button first (Illidan's Metamorphosis), unified dock labels, foldable Stats and
  Coords, a detachable floating Geosets panel, all seven themes, and VIS as a
  switch back to the classic MDLVis look.
- No version bump; PR into `claude/ai-console-tools` while PR #291 is open
  (the AI console only exists there), otherwise `main`.

## Revision and local state

- Branch / checkout: `claude/new-look-69148b`, worktree `.claude/worktrees/zen-gagarin-1cd649`.
- Base: `claude/ai-console-tools` at `7adbf878`.
- Mockup source (reference only, not product code): `.claude/worktrees/ai-console/out/mockup/v3/`
  and pictures `out/mockup/27`–`52` in that worktree.

## Relevant owners

- `app/new-look.css`: the whole look. Every rule is scoped to
  `:root .classic-app.classic-app:not([data-vis-ui])`, so VIS (the `data-vis-ui`
  attribute set in `App.jsx`) shows the classic look untouched. Dark themes
  (`:root[data-theme=dark]`) swap the carving variables.
- `app/LookIcon.jsx`: the hand-drawn 24px icons (parts s/f/d). `Tool` in
  `app/EditorControls.jsx` draws one when given `look`; `CameraTools` and
  `TransformTools` pass it on. Forge reuses those components without `look`,
  so Forge is unchanged.
- Highlight colour: preference `toolHighlight` (`src/preferences.js`, empty =
  follow the UI accent) → `--ui-tool-highlight` in `app/theme.js`; the picker sits
  under UI accent in Settings → Appearance → Interface (`app/Settings.jsx`).
- AI button: `app/AiAssistant.jsx` renders it as a dock icon
  (`public/classic/btn-metamorphosis.png`, notice in `THIRD_PARTY_NOTICES.md`);
  `app/AppToolbar.jsx` places `{aiControl}` first in `.toolbar-modules`.
  `app/portrait-view.css` keeps it visible beside XL when VIS is on.
- Folds and float: `FoldHeader`/`useFold` and `GeosetPicker`/`FloatingGeosets`
  in `app/AppSidebar.jsx`; float position is App state `geosetsFloat`, never saved.

## Findings and decisions

- Decision: the mockups also restyled the chrome (rounded buttons, soft top row,
  pill view controls, airy sidebar, Segoe UI). That is included, but scoped to the
  main window's toolbar, editor row, view controls, status bar and the Vertices
  sidebar, so module windows and other sidebars keep their own styling.
- Decision (owner, 2026-10-24: "make a complete pass"): the look now covers the
  whole program: every window and dialog (Settings, all resource managers, Particle
  editor, AnimXL, Sort My Mess, Attachemator, Paint dialogs…) gets soft rounded
  cards with a quiet title bar; tabs are one segmented control; sidebar sections
  are cards; bone/movement/Forge tool grids use the carved tiles; Forge's top row
  uses the new icons. Shape and tone only, no background overrides, so theme
  colours and special buttons (Record, swatches) stay. The Library (`.tl-*`) and
  BitsAndParts (`.parts-*`) keep their own designed looks.
- Decision (owner, 2026-10-24, screenshot of the Particle editor: "not the
  same, not modernized"; "yes all of them"): windows must use the main window's
  controls, not just its shapes. The "Window kit" section of `new-look.css` gives
  every button a soft filled pill (`--m-btn`, no outline), fields rounded wells,
  tab rows one segmented control, 12px Segoe UI, 38px quiet title bars with a
  round close button. Library and BitsAndParts now follow the theme too. The old
  module colour fallbacks (`--panel`, `--text`, `--accent`, `--app-bg`,
  `--panel-bg`, `--title-bg`) point at the theme inside the new look.
- Gotcha: lazy-loaded module CSS and `:root[data-theme=light] button:not(...)…`
  (0,6,1) beat class-only selectors, so the window sections are anchored on
  `#root .classic-app.classic-app:not([data-vis-ui])`. Inline-styled swatches,
  image tiles (`:has(>img)`), list rows and the `!important` Record button keep
  their own look. Main-window chrome rules use `!important`, so they still win.
- Survey script for every screen: kept in the session scratchpad (`survey.cjs`),
  pattern: launch packaged exe with `fixtures/demo.mdx`, send `menu` ids through
  `webContents.send('menu', id)`, close with dialog-scoped `[aria-label^=Close]`
  (never the model tab's close). Paint needs an MDX800 model with a texture;
  "New base coat" opens the studio without game data.
- Decision (owner, 2026-10-25, picked mockup 10 of ten): the display toggles
  (Shadows, Bones, Emitters, Grid…) are icon + name chips in one soft well in the
  top row, after the team colour. `QuickDisplay.jsx` measures the room up to the
  next item (the DPI/Scroll readout, pushed right by an auto margin) and adds
  `quick-display-compact` (icons only, names on hover) when the names do not fit.
  The readout gives way first, then the icons; the language picker stays. The
  real checkbox stays in each chip as an invisible layer over it, so hotkeys,
  `getByLabel` and clicks keep working. VIS keeps the classic row in the editor
  row (`{visUI && quickDisplay}`). Names show at 1900 px in Animations (9 toggles).
- Decision: with VIS on the AI icon stays reachable next to XL (classic label
  style), because VIS hides the other dock icons and the top-row AI text button
  no longer exists.
- Decision: "Flip" in the brief = Reverse normals (the old "−1" button); it is
  icon-only like Weld.
- Decision: Stats/Coords fold state lasts until MDLxL closes (module variable),
  Stats starts folded and Coords open, as in mockup 28.
- Verified: native `BTNMetamorphosis` SD bytes SHA-256
  `fa3c6b08…dc8bc70`, converted with the app's own DDS decoder, 64×64.

## Changes and verification

- Checks: `node --test test/module-button-labels.test.js test/appearance-themes.test.js`;
  full `pnpm run test:source` and `pnpm test`; packaged app on the hidden desktop
  (all seven themes, custom highlight, fold/unfold, float + drag + checkbox in the
  float + Bones mode + dock back, AI console opens from the dock, VIS on = classic
  look with float docked, orbit drag still turns the camera); see the PR.
- Packaged suite (`default` variant): `core` 27/28 pass + 1 fixture skip after
  fixes; also appearance-contrast, particle-workflow, rotation-interaction,
  ai-console, geoset-tabs/-leave-visible/-operations, localization and
  module-button-labels.browser pass. `ai-editor` fails at the provider sign-in
  step (line ~250) on the untouched base `7adbf878` too, so it is not this work.
- Test updates: `particle-workflow` now expects the single EMTR colour;
  `ai-console` starts its eraser sweeps below the floating view controls.
- Avoid repeating: no CSS transition on chrome buttons (appearance-contrast
  switches themes instantly and measures mid-fade); keep the view-controls pill
  opaque; keep the editor row tight (gap 2px) or it scrolls at 1440 px with the
  AI console open.
- Remaining: the owner's own look and feel at their screen size / DPI.

## Blockers and next action

- None. Next: owner review of the PR; merge only on their go-ahead.

## UI recomposition — 2026-10-26

- Current follow-up: Codex chat UI RECOMP, branch `codex/ui-recomposition`,
  based on online main `548c1b89`. Ready for review; merge requires owner approval.
- Supersedes the historical top-row layout B placement above: the WC3 dock is
  centred in the top row, Quick Display follows the editor buttons, and model
  tabs have the full row below. No red divider is added.
- Team colour and language remain top right. MDX conversion and Add-ons move
  to the far right of the status bar, immediately after DPI/Scroll. Add-ons
  opens upward. The 44px row and 48px dock meet halfway at 46px (38px icons).
- The dock stays mounted in the top row across VIS toggles. VIS still shows
  only AI and XL with classic styling; an unsent AI draft survives toggling.
- `public/classic/wc3-vis.png` is a high-resolution restoration of the original
  purple VIS symbol with a WC3-style frame, made with built-in imagegen from
  the original icon and neighboring Library icon. Original is retained in Git.
- Verified: production build and disposable Windows package; 26 focused
  checks; 57 compatibility tests; full source suite (1960 pass, 22 skip);
  module-button browser check; hidden packaged interaction checks at 1920,
  1440, 1280, 1100, 960 and 720px. Actual right-mouse camera rotation, view
  toggles, upward Add-ons, full-width tabs and AI draft retention passed.
- No model-data or installed-app/profile changes. Owner visual acceptance
  remains pending. Temporary package and test profile removed after testing.
