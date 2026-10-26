# Toolbar dock rules

The module dock is the row of square WC3 icons at the top right (AI, LIBR, FRG,
BITZ, OPXL, EMTR, ANIM, KEY, LER, VIS). The owner approved this look on
2026-10-26. Every icon added later follows the same rules, so the row always
looks like one set.

These rules cover the new look only. The VIS (classic) look keeps its own
labels in [modules.css](../app/modules.css).

## Picture and frame

- Use a 64×64 WC3 button picture (`public/classic/`) with the standard baked
  WC3 frame: a dark outer line, a two-pixel grey bevel and a dark inner line.
  Copy the frame from `btn-animate-dead.png` if new art lacks it. Don't use a
  larger picture or one with its own frame.
- The picture fills the 40px button exactly. The button adds no border, ring,
  outline, shadow or background, whether it is off, switched on, hovered or
  disabled. Disabled only dims the picture.
- A switched-on toggle (KEY, LER) never changes its frame. Its label glows in
  the highlight colour instead.

## Label

- Every icon has a short capital label of two to four letters.
- There is one label style for all: bold 10px Oxanium (`'MDLxL Dock'`, bundled
  in `public/fonts/showcase/oxanium`) with a soft black shadow, centred in the
  lower half and set slightly low (`bottom:-1px`). Don't give an icon its own
  font, size, outline or position.
- Every icon has its own colour. Pick a light colour that suits the picture
  and differs clearly from all the others:

| Icon | Colour |
| --- | --- |
| AI | `#c9a2ff` violet |
| LIBR | `#ffbf47` gold |
| FRG | `#7cc4ff` sky blue |
| BITZ | `#ece8de` ivory |
| OPXL | `#8fe07f` green |
| EMTR | `#5fe0cf` teal |
| ANIM | `#ff8574` coral |
| KEY | `#ffa257` orange |
| LER | `#f2e35c` lemon |
| VIS | `#ff8fd0` pink |

## Adding an icon

1. Add the `Tool` in the dock in [AppToolbar.jsx](../app/AppToolbar.jsx) with a
   `className` and `badge`.
2. Add one colour line for it beside the others in the module-dock block of
   [new-look.css](../app/new-look.css), and add it to the table above.
3. Add it to the lists in [module-button-labels.test.js](../test/module-button-labels.test.js)
   and [module-button-labels.browser.cjs](../test/module-button-labels.browser.cjs).
   The browser test fails if any icon's frame, picture size, font or position
   differs, or if two icons share a colour.
