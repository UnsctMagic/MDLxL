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
   `mdlxl-shredder-notebook-v1`). A lesson is learned when you do it yourself
   5 separate times (uses at least a minute apart, 10 seconds in the test
   version, or after another app start). Using the key while its tip is open
   counts; "K, bro." and "Tell me later, bro." do not. A learned lesson is never
   mentioned again. Keys you already use count from day one.
4. **Voice.** One small bubble above the bird with one sentence and two
   buttons: "K, bro." (it comes back now and then until learned) and "Tell me
   later, bro." (back after 5 minutes, 30 seconds in the test version). The key
   shown is always your own, current binding. The text is translated like the
   rest of the app.

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
- **He speaks up.** A shortcut tip comes on the first mouse click of a button;
  a code tip on the 2nd. A trick comes the first time you are where it helps,
  for example Zoom anchor as soon as you pick Resize with several vertices
  selected. He says hello once, the first time he may speak.
- **The right key closes the tip.** Using the key or trick a tip talks about
  closes it at once.
- **One at a time.** At most one tip every 3 minutes. "Fewer tips" makes it
  10 minutes.
- **He hammers it in, spaced out.** A tip comes back until you have learned
  it: at most every 15 minutes (1 minute in the test version) and at most 10
  times. Quiet for today, Fewer tips and Turn off are in his notebook.
- **Short-lived.** The bubble fades after 8 seconds and pauses while the mouse
  is over it. It never takes the keyboard and never blocks clicks elsewhere.
- **You decide.** Notebook: Quiet for today, Fewer tips, Turn off.
- **Codes after basics.** Ctrl+Alt+Space code tips in an area open only after
  3 lessons in that area are learned. Tricks never wait.

## Lessons in step 1

Shortcut and code lessons cover every button outside dialogs, Paint and Forge.
Tricks come before key tips. The hand-written tricks are:

| Lesson | When | Learned by |
| --- | --- | --- |
| Hold Alt to see keys | 3 clicks on buttons that have a key within a minute | holding Alt alone |
| Wheel over a list | 2 list changes by mouse within a minute | wheel over a list |
| Ctrl+K opens Hotkeys | opening Settings | using the Hotkeys key |
| W toggles camera | a click on a camera mode button | using the camera toggle key |
| Alt-drag turns the camera | switching to Camera rotation and back within 20 s | Alt + left drag in the viewport |
| Shift for fine camera | 2 camera drags within a minute | Shift during a camera drag |
| Shift adds, Ctrl removes | 2 box selections within a minute | Shift or Ctrl selection |
| Shift locks a move | picking Move | Shift while moving |
| Shift snaps rotation to 15° | picking Rotate | Shift while rotating |
| Zoom anchor | picking Resize (the "zoom" tool), or dragging with it | using Zoom anchor |
| Shift-click geoset range | 3 geoset box clicks within a minute | a Shift-click on a geoset box |
| UV keys X, Y, G | entering the UV editor | using those keys |
| UV Alt fine, Shift lock | 2 UV drags within a minute | Alt at the start of a UV drag |
| Space plays | entering the animation editor | using the play key |
| Timeline ← / → | a click on the timeline | arrow keys on the timeline |
| Bones keys R, C, T, D | entering Bones | using those keys in Bones |

Key badges shown while Alt is held are limited to one short key (at most three
characters); longer chords and Ctrl+Alt+Space codes stay in the tooltips.

## The bird

`app/ShredderBird.jsx` draws Shredder with his LowPolyWorks sprites
(`app/assets/shredder`: standing/walking, flight, take-off). He visits now and
then (in the test version after 2 seconds, staying 25-45 seconds), perches on
the bottom edge of the 3D view, looks around, leans, walks a little, hops off
and flies away. He is never in the way:

- clicks pass through him (`pointer-events: none`), and menus draw over him;
- he only perches where the 3D view's own picture is under him, never over a
  control, label, panel, tip or notebook; when something appears there he
  moves along or leaves;
- he only walks or comes back while you pause, never while you work;
- the mouse coming near him, or a click near him, sends him flying off;
- a window or dialog, Paint and Showcase hide him;
- with reduced motion set in Windows he appears and disappears without flying.

The status-bar icon stays the button for his notebook.

## Tests

- `test/shredder.test.js` covers the rules: 5 uses to learn, repeats until
  learned and their spacing, quiet start, cooldown, quiet for today, damaged notebooks, the
  lesson texts and their translations.
- `test/shredder-bird.electron.cjs` checks the bird: he lands with only the 3D
  picture under him, clicks pass through, a control where he stands moves him,
  the mouse sends him off, a window hides him, he returns only after a pause.
- `test/shredder.electron.cjs` drives the real app:
  - the hello, and that Settings switches him;
  - Alt shows only short key badges;
  - the first click on Move brings its Shift trick and the M tip;
  - pressing the key closes the tip, and only real uses count;
  - he stays silent while Settings is open;
  - Tell me later, bro. brings a tip back, and doing the trick closes it;
  - picking Resize brings Zoom anchor, and pressing 1 closes it;
  - Alt-drag is recorded, the notebook opens and closes, Turn off works.

  `SHREDDER_THEME=dark` repeats its screenshots (`out/shredder/*.png`) in
  another theme. The test shortens the waits through the
  `mdlxl-shredder-timing` storage key; nothing in the app writes that key.

## Next steps

- **Step 2.** The full lesson list for every area. It needs a small hook in
  each place that handles its own keys: Paint (`mdlxl-paint-key`), Forge
  shapes, resource managers, AnimXL, Particle Editor and Showcase.
- **Step 3.** The bird himself: reuse the update sprite, perch on the viewport
  edge, and point at the button he talks about.
