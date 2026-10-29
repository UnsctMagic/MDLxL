# Next release — unreleased changes

Add user-facing changes here as they merge.

## Showcase

- Extra Time accepts negative numbers, for the whole recording and for each
  animation, so a long ending can be cut short.
- Death animations stop after 10 seconds by default instead of waiting for
  every corpse decal and lingering particle (some took two minutes). Add Extra
  Time to keep more.
- Recording quality is one clear choice in Output: Low (up to 480 px, under
  2 MB), Medium (640 px, under 5 MB, the new default for upload pages), High
  (864 px, under 20 MB) and Best (1280 px, under 50 MB). Each level sets its
  colors, smoothness and FPS; long takes shrink until they fit the file size.
  This replaces Standard, Low Size and the separate Graphics quality. Main
  picture (612 x 490) is now a checkbox that works with any level, and old
  presets keep their look (Low Size becomes Medium, Standard becomes High).
- The Showcase sidebar is regrouped in working order: Presets, Recording list,
  Model & animation, Output (quality, crop size, main picture, FPS), Background or
  Portrait, Camera (Center, Maximal Zoom, Align and the orbit), Text and
  Signature. RECORD stays visible while scrolling, and the less obvious
  controls explain themselves on hover.
- Text can use your own fonts: Text → Font → Load font… takes a TTF, OTF,
  WOFF or WOFF2 file. Loaded fonts stay in the list for later; right-click one
  to remove it.
