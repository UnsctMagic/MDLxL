# Shredder the Wise

Shredder is a helper bird who teaches MDLxL while you work: hotkeys for the
buttons you click, and the hidden tricks behind the tools you use. He is meant
to be switched on for about a week and then switched off, because by then you
know the program.

Turn him on in **Settings → Configuration → Shredder the Wise**. The bird then
sits at the right end of the status bar. Click him to open his notebook.

He is the same bird that perches on the update window (`app/UpdateShredder.jsx`).
Step 3 gives him that body; until then he is a small placeholder icon.

## How he works

1. **Eyes.** He listens to signals the app already has:
   - every button with a `data-hotkey` id,
   - the `mdlxl-hotkey-used` event the Hotkeys system fires when a shortcut runs,
   - commands chosen from the native menu (`mdlxl-menu-command`),
   - a few mouse gestures (Alt-drag in the viewport, wheel over a list,
     timeline scrubbing).

   A real mouse click on a button (`detail > 0`) is a click. A shortcut is a
   key. He never guesses from screen text.
2. **Lesson book** (`src/shredder-lessons.js`). Every lesson has an area, a
   level, one sentence, and the signals that prove you do it yourself.
   - **Shortcut lessons** come for free for every button that has a key:
     "Next time press M for Move." Buttons without a direct key get their
     Ctrl+Alt+Space code as a deeper lesson.
   - **Trick lessons** are hand-written and come with their own triggers.
3. **Notebook** (`src/shredder-notebook.js`, saved in browser storage under
   `mdlxl-shredder-notebook-v1`). A lesson is learned only when you do it
   yourself on 3 separate occasions. Separate means another app start, or at
   least 20 minutes later. Clicking "Got it" does not count as learning. A
   learned lesson is never mentioned again. Keys you already use count from
   day one, so experienced users hear nothing about them.
4. **Voice.** One small bubble above the bird with one sentence, plus "Show me"
   (outlines the button) and "Got it". The key shown is always your own,
   current binding. The text is translated like the rest of the app.

## Test version

`SHREDDER_TEST_VERSION` in `src/shredder-notebook.js` is `true` for now. In
the test version:
- Shredder is on by default;
- there is no quiet start;
- tips can come every 10 seconds;
- a new occasion is 1 minute later;
- a third showing waits 2 minutes.

His notebook says so. Set it to `false` before release; that restores the
release timing below and makes him off by default.

## Manners (hard rules)

- **Quiet start.** Nothing in the first 2 minutes after the app starts with
  him already on. Switching him on while you work lets him talk right away.
- **He waits for a pause.** He speaks only after 1.5 seconds without mouse or
  key input, and never while a mouse button is held.
- **Silence.** Nothing while you type in a field, play an animation, have a
  window or dialog open, save, or work in Paint or Showcase. Recordings come
  from the 3D picture only, so the bubble can never appear in a GIF.
- **A habit, not one click.** A shortcut tip comes on the 2nd click of the same
  button in one session; a code tip on the 3rd.
- **One at a time.** At most one tip every 3 minutes. "Fewer tips" makes it
  10 minutes.
- **No nagging.** Each tip is shown at most 3 times ever. The 2nd showing waits
  for another app start; the 3rd waits at least 2 more days.
- **Short-lived.** The bubble fades after 8 seconds and pauses while the mouse
  is over it. It never takes the keyboard and never blocks clicks elsewhere.
- **You decide.**
  - Right-click a tip: "never show this one again".
  - Notebook: Quiet for today, Fewer tips, Turn off.
- **Basics first.** Deeper (level 2) lessons in an area open only after 3
  lessons in that area are learned.

## Lessons in step 1

Shortcut and code lessons cover every button outside dialogs, Paint and Forge.
The hand-written tricks are:

| Lesson | When | Learned by |
| --- | --- | --- |
| Hold Alt to see keys | 6 clicks on buttons that have a key | holding Alt alone, twice |
| Wheel over a list | 3 list changes by mouse within a minute | wheel over a list, twice |
| W toggles camera | 2 clicks on the camera mode buttons | using the camera toggle key |
| Alt-drag turns the camera (level 2) | switching to Camera rotation and back within 20 s, twice | Alt + left drag in the viewport |
| Zoom anchor (level 2) | 2 Resize drags with several vertices selected | using Zoom anchor, twice |
| Timeline ← / → | 3 timeline scrubs within a minute | arrow keys on the timeline |

## Tests

- `test/shredder.test.js` covers the rules: occasions, the 3-show limit and its
  spacing, quiet start, cooldown, quiet for today, damaged notebooks, the
  lesson texts and their translations.
- `test/shredder.electron.cjs` drives the real app:
  - it is off by default, and Settings turns it on;
  - one tip comes after a second mouse click;
  - Show me works, and pressing the key closes the tip;
  - he stays silent while Settings is open;
  - right-click retires a tip;
  - the Hold Alt trick works, and Alt-drag is recorded;
  - the notebook opens and closes;
  - Turn off works.

  `SHREDDER_THEME=dark` repeats its screenshots (`out/shredder/*.png`) in
  another theme. The test shortens the waits through the
  `mdlxl-shredder-timing` storage key; nothing in the app writes that key.

## Next steps

- **Step 2.** The full lesson list for every area. It needs a small hook in
  each place that handles its own keys: Paint (`mdlxl-paint-key`), Forge
  shapes, resource managers, AnimXL, Particle Editor and Showcase.
- **Step 3.** The bird himself: reuse the update sprite, perch on the viewport
  edge, and point at the button he talks about.
