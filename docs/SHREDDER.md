# Shredder the Wise

Shredder is a bird who lives in MDLxL and teaches you to use it like a pro. He
watches how you work, and when he sees a slower way than necessary, he flies
over and shows you the fastest way your own settings allow. Switch him on for
a week, learn the program, then switch him off.

Switch him on or off in **Settings → Configuration → Shredder the Wise**.

## The one rule: only faster ways

Shredder never shows you a feature just because it exists. He compares what
you just did with the fastest way to do it:

- **He never suggests a way that is not faster than one you already use.**
  - If you turn the camera with a middle click (classic mouse), Alt-drag or W,
    he never mentions any other way of turning it.
  - Each "faster way" lesson lists the ways that are already as fast
    (`coveredBy` in `src/shredder-lessons.js`). Using any of them settles it.
- **The fastest way depends on your settings.**
  - Camera tips follow your mouse buttons (Settings → Mouse). With the
    classic setup, turning is a middle click and moving is a right-drag. With
    the orbit setup, turning is a right-drag.
  - Zoom tips only appear while the wheel zooms.
  - Key tips always name your current key.
- **A click on a visible button is faster than typing a code.** He never
  teaches Ctrl+Alt+Space codes for buttons you can see. If you click a button
  without a key often (5 times in a session, or twice from the menu), he
  suggests giving it your own key with Ctrl+K.

## What he teaches (step 1)

- **Shortcut:** the first mouse click on a button that has a key, for
  example "Next time press M for Move." This also covers the play button
  (Space).
- **Faster way:**
  - Camera mode buttons: the middle click, right-drag or Alt-drag, whichever
    your mouse settings make fastest.
  - The Move camera button: right- or middle-drag.
  - The Zoom tool: the mouse wheel.
  - Selecting again and again: Shift adds, Ctrl takes away.
  - Ticking geosets one by one: Shift-click for a range.
  - Opening a list for the next entry: the mouse wheel.
  - Scrubbing the timeline: ← and →.
- **Tip:**
  - Zoom anchor, every time Resize is picked.
  - Shift to lock a move, when you move the same selection again and again.
  - Shift to snap a rotation, when you rotate the same selection again and
    again.
  - Shift for fine camera control, after many short camera nudges.
  - Hold Alt to see every key.
  - Alt and Shift in the UV editor.
- **Your own key:** for buttons without a key that you use a lot.

Paint, Forge, the managers, AnimXL, the Emitter Editor and Showcase come in
step 2; they handle their own keys and need a hook each.

## Learning

His notebook (`src/shredder-notebook.js`, browser storage
`mdlxl-shredder-notebook-v1`) counts how you really work:

- A way is learned once you use it yourself **5 separate times**. Separate
  means a minute apart (10 seconds in the test version) or after another app
  start.
- Using it while its tip is open counts. "Remind me" and "Understood" do not.
- Until a way is learned, its tip comes back now and then: at most every 15
  minutes (1 minute in the test version) and 10 times in all.
- Doing the thing a tip talks about closes the tip at once.

## The bird

`app/ShredderBird.jsx` draws Shredder with his LowPolyWorks sprites
(`app/assets/shredder`: standing and walking, flight, take-off), at about the
size he has on the website.

- **He roams the 3D view on his own:** he stands on its bottom edge, looks
  around, leans, walks a little, hops to another spot, and now and then flies
  off and comes back.
- **He speaks his tips himself.** The bubble comes out of him. He flies near
  the 3D view to say a tip, never at the mouse: he and his bubble stay clear
  of the pointer. Afterwards he flies back.
- **You can pick him up and put him anywhere.** Now and then he protests a
  little ("Easy with the feathers."). He stays where you put him for a while
  (10 minutes; 1 in the test version).
- **Click him for his notebook:** what you have learned, and Quiet for today,
  Fewer tips and Turn off.
- **He is never in the way:**
  - He roams only where nothing but the 3D picture is under him, and moves
    along when a control, panel or tip appears there.
  - He only roams while you pause.
  - Only his body takes the mouse; menus draw over him.
  - A window or dialog hides him, and so do Paint and Showcase.
  - With reduced motion set in Windows he appears without flying.

## The bubble

A modern chat bubble with a tail toward him:

- a small caption (Shortcut, Faster way, Tip, Your own key);
- the sentence, with keys shown as key caps;
- two small buttons, **Remind me** and **Understood**.

It uses the theme colours, so it works in every theme. The side is chosen once,
away from the mouse, so it never jumps when you go for its buttons. It fades
after 8 seconds unless the mouse rests on it.

## Manners

- **Quiet start:** nothing in the first 2 minutes after MDLxL opens with him on.
  Switching him on while working lets him talk at once.
- **He waits for a pause:** about 1.5 seconds without input.
- **Silence:** nothing while a mouse button is held, while typing in a field,
  during playback, or in windows, Paint and Showcase.
- **Spacing:** at most one tip every 3 minutes, or every 10 with Fewer tips.

## Test version

`SHREDDER_TEST_VERSION` in `src/shredder-notebook.js` is `true` for now. In
the test version:

- he is on by default;
- there is no quiet start;
- tips can come every 10 seconds;
- his visits are long;
- the other waits above are shorter.

His notebook says so. **Set it to `false` before release.**

## Tests

- `test/shredder.test.js` covers the rules:
  - the fastest camera method for each mouse setup;
  - that fast ways cover slower suggestions;
  - no code tips, 5 uses to learn, and repeats and their spacing;
  - the manners;
  - damaged notebooks;
  - key caps;
  - translations.
- `test/shredder.electron.cjs` checks the tips in the real app:
  - the hello;
  - the Move key tip coming from the bird;
  - no turning tip for an Alt-drag user;
  - the right-drag and wheel tips, each closed by doing it;
  - the wheel tip near the view but away from the mouse;
  - Remind me;
  - Zoom anchor;
  - the notebook and Turn off.

  `SHREDDER_THEME=dark` repeats its screenshots.
- `test/shredder-bird.electron.cjs` checks the bird in the real app:
  - his size, and that only the 3D picture is under him;
  - that he doesn't run from the mouse;
  - moving along when a control appears;
  - the notebook on a click;
  - picking him up, his protest, and staying where put;
  - hiding while a window is open.

The tests shorten the waits through the `mdlxl-shredder-timing` storage key;
nothing in the app writes it.
