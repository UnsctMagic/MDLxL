# MDLxL 0.19.0 — Forge, Shape and editor improvements

- **Forge:** visual shape tiles, adjustable dimensions and thickness, and modest complexity. Cube starts at 12 triangles. Ordinary shape triangles use the full BTNTemp icon. ThumperXL replaces Monkey with the MDLxL helmet in black/gray and red triangular eyes. Projector handles textures and PC images, with cutout and trim controls shown on demand.
- **SHAPE:** opens with a middle curve already previewed. Choose Curve, Fold, Twist, Dome, Roll or Taper; adjust Amount, Across/Up-down, Reverse and Start/Middle/End. Coarse flat pieces gain support rows automatically. Original and Reset make comparison easy. Vertex centers, exact axes and local influence remain under More controls.
- **BITZ:** Replace Part opens placement in Quad View, keeps inherited bone bindings, and supports Move/Rotate/Scale/Zoom plus Normal-view workplanes. Collected Bits retain per-animation RGB palettes. The library lists model folders without texture-folder clutter.
- **Sort My Mess:** visual, undoable consolidation in Material and Texture managers, with isolated Before/After previews and choices for RGB, team-color and rendering differences.
- **UV Wrapper:** temporary textures no longer block normal vertex/triangle edits. Revert texture keeps geometry and UV edits. Texture replacement preserves authored material settings; direct filter choices are available. Team color no longer covers the UV backdrop, and initial UV scrolling is 30% faster.
- **EMTR:** library effects open as independent copies. Conflicting texture paths receive separate names while existing picture bytes remain intact.
- **Editor:** geoset lists resize vertically. Animations renders particles and ribbons without emitter editing markers, while respecting authored visibility.
- **GIF recording:** temporary frames use the recording destination drive, avoiding failures caused by a full Windows temporary drive.

Includes the merged changes in PRs #111–#116 and #118–#123. The portable updater from PR #117 was reverted and is not included.

Download **MDLxL-0.19.0-win32-x64.zip**, extract the whole ZIP, and run **MDLxL.exe**. Keep its folders together. The FFmpeg corresponding-source archive is supplied separately.
