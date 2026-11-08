# Presets, 3D Rotate settings, hotkeys, previews and toolbar

Status: built on local branch `claude/uv-drag-settings`. Not online until the
owner says "merge". The full packaged suite is for releases only. Targeted
packaged run on the final build, 8 Nov: 16 of 19 pass. The three that fail do
not come from this branch: `citadel-studio` and `game-file-library` fail the same
way on the pre-branch build (`5e2746b7`), and `emtr-add-like-ribbons` needs a real
profile whose Warcraft index is current. The 46 tests picked for the code this
branch changed passed on the build before the last Paint Cut-out fix, apart from
`pose-ik`, whose stale step was corrected and passes on the final build. Audits in `out/audit/` are
git-ignored working notes; decisions below are the durable record. Follows [UV drag settings](uv-drag-settings.md).

## Owner's request (8 Nov 2026), in their words

- "Make sure users can FULLY configure their own hotkeys and that LER reacts to
  that as well."
- "For everything that is in the current presets for both UV and 3D - call it
  MDLxL then have MDLVis - and examine the source code carefully for this. then
  have Blender and Maya - but do not call it Blender and Maya please."
- "users can make their own custom ones - adjust, save presets and also SHARE
  PRESETS WITH EACHOTHER! For both HOTKEYS and these settings as well as
  appearance. Save as - Load from -"
- "I will NOT test anything - the defaults ARE my tests. that means everything
  you add as a setting has to be POLISHED, MODULAR and clean."
- "For hotkeys - make sure NOTHING overlaps and that NO weird workflows can
  happen with defaults."
- "slightly re-factor the UI layout for the settings to accommodate all this,
  give it a professional Claude feel."
- "FOR ALL SETTINGS - I want VISUAL GIFS that DEMONSTRATE how the setting
  operates ... additional markers on it to show things like an axis turn or
  directions ... simplify for ADHD users."
- "give users the ability to change the TOOLBAR into something more trim and
  less graphic ... GIVING THEM THE ABILITY to remove the toolbar alltogether and
  access it differently / via hotkeys."
- 3D Rotate: "the current remains default."

## Rules for every builder

1. **Defaults are the owner's test.** With an untouched profile, every existing
   behaviour, key and pixel of the default layout stays as it is unless this note
   lists the change. Prove it (old-vs-new numeric comparison or existing tests).
2. **Modular.** One concern, one module. Pure logic DOM-free in `src/`, testable
   with `node --test`. No dead code, no half-wired options. Every option must do
   what its label says in every editor that shows it; if it can't apply, hide it.
3. **Plain UI.** Names and short functional labels only, no flavour text. Each
   complicated control has a short plain tooltip on both control and label. Theme
   tokens only (`--ui-*`, `--m-*`, `--lit`), checked in light and dark.
4. **Never the product names** Blender or Maya anywhere in the UI, locale files
   or tooltips.
5. **Max two keys** per shortcut. H, K, Ctrl+X, Ctrl+B stay free in the editor.
6. **3D tools and UV stay separate.** `uvDrag` never reaches 3D, `rotation` never
   reaches UV, and FX texture fitting ignores both.
7. **Tests.** Fail-first where a bug is fixed. Real clicks, drags and keys for
   anything on screen, focus left where a real click left it. No window may ever
   appear on the owner's screen: packaged runs go through
   `node scripts/run-packaged-tests.mjs` only, and only the supervisor runs them
   (the runner kills processes in this worktree, so builders must not).
8. **Shared folder.** Builders work in one worktree on separate files. Do not
   commit. Do not run `pnpm run build`; use `node --test` on focused files and
   `npx vite build --outDir out/build-<your-name> --emptyOutDir` to compile.
   Do not edit `src/locales/*` (one translation pass runs at the end): append
   every new English UI string, one per line, to
   `out/audit/strings-<your-name>.txt`. Files are CRLF; keep it. Write scripts
   with the Write tool, because shell heredocs lose backslashes here.
9. Keep all work on D:. Audit reports: `out/audit/{mdlvis,industry,hotkeys,
   hotkey-inventory,settings,toolbar,rotate3d}.md` (git-ignored; read the
   relevant one, it holds exact file:line evidence and math).

## Decisions (supervisor, from the audits)

### Built-in presets, UV and 3D: `MDLxL`, `MDLVis`, `Freeform`, `Manipulator`

Freeform and Manipulator are the two industry-standard behaviours. Earlier UV
presets (Follow the mouse, Left/right, Circle + left/right) are dropped; those
styles remain under "How you drag". A built-in writes every key in its domain,
so the result never depends on what was set before.

| `uvDrag` | mdlxl | mdlvis | freeform | manipulator |
|---|---|---|---|---|
| rotateStyle | circle | leftRight | circle | circle |
| rotateSpeed | 70 | 100 | 100 | 100 |
| rotateZone | 24 | 0 | 0 | 24 |
| rotateBigPieces | true | false | false | false |
| rotateReverse | false | false | false | false |
| rotateSnap | 0 | 0 | 5 | 15 |
| zoomStyle | centre | upDown (new) | centre | leftRight |
| zoomSpeed | 100 | 100 | 100 | 100 |
| zoomSnap | 0 | 0 | 10 | 10 |

`upDown`: only vertical movement counts, up grows,
`factor = exp(-sum(dy) / 100 * speed)`, ignores UV transform sensitivity. It
cannot flip. Zoom past the centre keeps the owner's collapse rule in every
preset; no preset flips the piece. Rename `uvRotatePreset` to `uvDragPreset` and
compare all nine keys. Today's `uvEachPiece` is a separate toggle, never in a
preset.

3D (`preferences.rotation`, absent key = today's behaviour):

| Key | Values | mdlxl | mdlvis | freeform | manipulator |
|---|---|---|---|---|---|
| sensitivity | number | 1 | 1 | 1 | 1 |
| precision | number | .1 | 1 | .03 | .1 |
| workplaneDrag | arrow, leftRight, circle, ring | arrow | leftRight | circle | arrow |
| handleDrag | swing, ring, leftRight | swing | ring | swing | swing |
| linePick | lever, axis | lever | axis | axis | axis |
| leverPick | 2-30 | 6 | 6 | 6 | 6 |
| offHandle | wheel, none | wheel | wheel | wheel | wheel |
| faceOn | circle, arrow | circle | arrow | circle | circle |
| reverse | bool | false | false | false | false |
| handleSensitivity | number or unset | unset | unset | unset | unset |
| useDPI | bool | true | false | false | false |
| centerZone | 0-100 | 8 | 0 | 0 | 8 |
| bigSelections | bool | false | false | false | false |
| shift | slow, snap | slow | slow | slow | slow |
| snap | 0,1,5,15,45,90 | 0 | 0 | 5 | 15 |

`linePick: axis` means a grabbed Lines handle turns around that handle's axis, as
Rings do, instead of the lever gesture. MDLVis left/right sign per plane: XY +1,
ZX -1, YZ +1 (removed in `6d371ba5`). `handleDrag: ring` follows `b17fc24d`,
1 degree per pixel, and must not copy MDLVis's zoom dependence. Deadzone uses the
piecewise rim from `rotate3d.md`: `rim = zone <= 8 ? 68 * zone / 8 : 68 + (zone - 8)`;
zone 8 equals today's exactly. `reverse` applies to straight paths only. Shift
snap is one 15 degree step. Apply to gains `emtr` and `glow`, as two entries.
Bones shows a one-line hint and no rows. Each piece is an always-visible toggle
beside Workplane Constraints in Vertices and Forge, like the UV Wrapper; it is
stored as `rotation.eachPiece`.

### Ctrl snap, no conflicts

Rule in `hotkeys.md` section 7. Ctrl pressed before the mouse keeps its existing
meaning (selection, inspect). Ctrl held after the drag has started snaps. Ctrl on
Vertices and Forge Resize stays Spread. Snap steps default to 0, so Ctrl does
nothing new on a default profile.

### Modifier bindings

`src/modifier-bindings.js` per `hotkeys.md` section 5, `preferences.modifiers`
holding only changes; values Shift, Ctrl, Alt or none. Rows in the Hotkeys table
under a "Mouse drag keys" category. Tooltips that name keys read the current
binding. Defaults equal today in every drag.

### Hotkeys

All 20 items of the `hotkeys.md` change list are approved, with these choices:
default keys do not change except the fixes the list names. Controls in windows
with no hotkey path become bindable but get **no default key** (add a
`data-hotkey-manual` marker that the allocator skips), so defaults gain no new
letters. "Press Esc again" applies only when a window really has unapplied work;
a first Esc shows a short message and the second discards. Update `HOTKEYS.md`.

### Save as / Load from

`src/settings-presets.js` per `settings.md` section 6, domains `mouse`, `rotate`,
`uv`, `hotkeys`, `appearance`; `preferences.settingsPresets`. File extension
`.mdlxl-preset`, strict validation, two thin IPC channels. Appearance files
embed background images and drop the original file name. Accent, tool highlight,
helper and Citadel edits flip Appearance to Custom. Modifier bindings travel with
the `hotkeys` domain. Presets stay in `settings.json`; the Revert-to-older-version
edge case is accepted.

Bar labels: `Preset`, optgroups `Built-in` and `Saved`, `Custom`, `Save as…`,
`Load from…`, `Restore`.

### Settings layout and previews

Layout per `settings.md` section 5: fixed-height window, sticky preset bar,
sticky preview column, form in the middle, narrow-window rules as listed, with
restrained spacing and section cards from theme tokens. Everything `settings.md`
lists under "Must not move" stays.

The "GIFs" are looping SVG scenes, drawn live from the real math
(`uvTurn`, `uvZoom`, `rotationDragDegrees`, ...), so they show the user's current
value and follow the theme; a captured .gif could do neither. 13 scene kinds,
8 marker parts (`settings.md` section 2). Lives in `app/settings-preview/`, one
delegated hover/focus listener, three loops then rest, honours reduced motion,
stops while hidden. Every new control in this note gets a scene.

### Toolbar

`preferences.toolbarMode`: `graphic` (default, DOM byte-identical), `trim`,
`hidden`; `toolbar.md` sections 3 and 4. Trim is two slim rows, CSS only. Hidden
keeps everything mounted off-screen, never `display:none`, and is ignored while
VIS is on. Status-row chip shows MDX format when hidden; DPI and Scroll only
while adjusting. Launcher on **Ctrl+F2** (outside the automatic key pool, so no default moves; F11 was auto-given to an editor field); cycle modes on **Shift+F3**; Settings menu
radio, Appearance > Interface select, one-time toast. Fix the "no menu route" gaps
for all modes.

## Build order

1. Parallel: Rotate engine; Presets module; Hotkey system; Toolbar and launcher.
2. Parallel: Modifier bindings and gesture guard across drag owners; Preview scenes.
3. Settings layout integration.
4. Translations, review, packaged tests, final build.
