# New MDLxL look

Status: ready for review; awaiting merge approval
Owner / consolidator: Claude Code (side session of the mockup session)
Updated: 2026-10-24

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
- Survey script for every screen: kept in the session scratchpad (`survey.cjs`),
  pattern: launch packaged exe with `fixtures/demo.mdx`, send `menu` ids through
  `webContents.send('menu', id)`, close with dialog-scoped `[aria-label^=Close]`
  (never the model tab's close). Paint needs an MDX800 model with a texture;
  "New base coat" opens the studio without game data.
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
