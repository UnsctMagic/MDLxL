# Shredder step 2: every editor, every faster way

This is the task brief for the next round of work on **Shredder the Wise**,
the helper bird in MDLxL. Read `docs/SHREDDER.md` first. It describes what
exists and the rules it follows.

## Goal

Shredder must cover **all of MDLxL**: every editor, every tool, every useful
shortcut and trick. Someone who leaves him on for a week should end up using
the program like a pro.

He teaches **the fastest way to do what the user is doing**, nothing else.

## Where to work

- **Repository:** https://github.com/UnsctMagic/MDLxL
- **Start from:** branch `claude/shredder-tutor`, open as PR #269.
- **Your branch:** `codex/shredder-all-editors`.
- **When done:**
  - push it and open a pull request into `claude/shredder-tutor`, not into `main`;
  - put a lesson table in the PR description: lesson id, editor, trigger (what the user did slowly), the faster way, `learnedBy` and `coveredBy` signals, and the `file:line` that proves the key or gesture works that way.
- **Disk:** use one clone on the D: drive. At the end, delete the build outputs and packaged builds you made (`out/`, `dist/`). Nothing on C:.

## Rules (all already in the code; keep them)

1. **Only faster ways.**
   - Never suggest a way that is not faster than what the user just did.
   - Never suggest one that is not faster than a way they already use.
   - Every "faster" lesson lists in `coveredBy` the signals of equally fast ways, so a user who already uses one never hears about another.
   - Example: a user who turns the camera with a middle click never hears about Alt-drag.
2. **Follow the user's own settings:** mouse bindings (`cameraBindings`), wheel mode, and their own hotkeys (`shortcuts`). See `fastestCamera` and `cameraSignal` in `src/shredder-lessons.js`.
3. **Triggers need evidence.** A tip comes when the user does something the slow way or repeatedly, never just because they opened an editor. The one exception is Zoom anchor, which is offered whenever Resize is picked; the user asked for it.
4. **No Ctrl+Alt+Space code tips for buttons that are visible.** One click is faster than typing a code. A keyless button used a lot gets the "give it a key" lesson (`bindLesson`).
5. **Learning.**
   - A way is learned after 5 separate real uses.
   - Using it while its tip is open counts. "Remind me" and "Understood" do not.
   - Doing what a tip says closes the tip at once (`learnedBy` / `coveredBy`).
6. **His voice is the user's own:**
   - short and direct;
   - " - " joins thoughts;
   - phrases like "no need to", "way faster", "skip the ... button";
   - the odd `:P` or `-_-`;
   - no polished AI phrasing.

   Copy the style of the existing lines in `src/shredder-lessons.js`, for example "Hit [M] for Move next time - way faster than clicking." Keys go in `{0}` slots so they show as key caps. The buttons stay "Remind me" / "Understood".
7. **Every new line is translated** into Russian, Spanish and Chinese (`src/locales/*.json`), in the same casual tone. Update the counts in `test/localization-catalogs.test.js`.
8. **Verify every fact in the code before writing a tip:** the key, the modifier, and what the gesture really does. If it isn't in the code, it isn't a tip.
9. **Don't change** the bird's look, the bubble design, the manners/timing rules, or `SHREDDER_TEST_VERSION`.
10. **No new panels, toolbars or permanent UI** (see `AGENTS.md`).

## Editors to cover

Go through each one. List its tools and shortcuts, and find where users do things the slow way. Then write evidence-based lessons.

1. **Vertex editor (F1):**
   - tools: select, move, rotate, resize and Zoom anchor, triangles, weld, collapse, uncouple, extrude, mirror, detach;
   - normals and NormalsXL;
   - geosets: ranges, hide extras, next/previous;
   - workplane and Shift locks, Grabthrough.
2. **UV editor (F2):**
   - flips, fold, rotate;
   - select connected, invert, UV sets;
   - Hold A over the 3D preview;
   - splitters, fine drags.
3. **Movement and animation (F3):**
   - the timeline: diamonds, ranges, right-click menu, arrows, frame field;
   - copy pose (C), delete keys, clear (Ctrl+D);
   - the sequence list (wheel);
   - Motion warnings.
4. **Bones:**
   - Hard Bind (R), Soft Bind (C), Attach (T);
   - detach (D, V);
   - focused skeleton.
5. **Pose IK:**
   - cycling overlapping handles;
   - pins;
   - copying a pose with Ctrl+C / Ctrl+V.
6. **Resource managers:** Materials, Textures, Nodes, Geosets, Sequences, Geoset Animations, Texture Animations, Global Sequences, plus Sort My Mess. Cover:
   - list keys;
   - local undo;
   - double-click a camera;
   - search.
7. **Citadel Paint.** It has its own keymap through `mdlxl-paint-key` in `app/PaintStudioLayout.jsx`. Cover:
   - tools B, T, E, N, D, I, Q;
   - `[` `]` size, Shift+`[` `]` hardness, `-` `=` opacity, `,` `.` stamp turn;
   - Shift+Z undo stroke, hold R;
   - the `?` overlay;
   - the cutout editor keys.
8. **Forge:**
   - shape keys G, 1-3, E, X, D, C, Enter, Ctrl+Enter;
   - molding 4, V, T, B, 5;
   - Shift-click chips, double-click faces;
   - Glow Up.
9. **The other tools:**
   - AnimXL: presets, Ghost, Shift-drag sections, double-click a diamond;
   - OptimizeXL;
   - the Emitter / Particle Editor;
   - BitsAndParts;
   - the Texture Library;
   - Attachemator;
   - the game file library.
10. **Showcase, portraits and recording.**
11. **Settings and Hotkeys (Ctrl+K), and add-ons.**

## Editors that handle their own keys, and dialogs

- **Some editors handle keys outside the central Hotkeys system:** Paint, Forge shapes, the managers, AnimXL, the Particle Editor and Showcase. For each, add a small hook that tells Shredder when the user used the fast way. For example, dispatch `mdlxl-hotkey-used` (`{ id, chord }`) or a similar event, the same way `app/Hotkeys.jsx` does.
- **Shredder is silent today** while a modal dialog is open, and in Paint and Showcase (`quiet()` in `app/Shredder.jsx`, `blocked()` in `app/ShredderBird.jsx`). Many editors are dialogs, so Shredder must be able to speak inside them. Keep it never in the way:
  - the bird perches only where nothing useful is under him, for example the edge of that editor's own preview;
  - he moves on when something appears there;
  - the bubble keeps clear of the mouse;
  - he never covers controls.

  Check this with screenshots of every editor.

## Testing

- **Unit tests:** `node --test test/*.test.js` must stay green. Add lesson tests in `test/shredder.test.js`: triggers, `coveredBy`, the texts with their keys, and translations.
- **App tests:** extend `test/shredder.electron.cjs` with at least one real slow-way → tip → fast-way check per editor.
- **The user works on this PC while you work.** Never open visible windows. Run every app test through the hidden runner:
  - `pnpm run test:packaged default shredder,shredder-bird,...` (see `docs/PACKAGED-TESTS.md`);
  - or `scripts/hidden-run.ps1`.
- **Before you finish,** run the packaged tests for Shredder and for every editor you hooked into.
