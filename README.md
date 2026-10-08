# MDLxL 0.21.2

Warcraft III model editor. This source continues the requested MDLVis rebuild lane, with the MDLxL name and icon.

For the Windows release, extract the whole ZIP and run MDLxL.exe. Keep its resources, Backgrounds, BitsAndParts and Addons folders together.

For source development, use Node.js 22.12 or newer and pnpm. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm run build`, then `pnpm start` to launch the desktop app directly from the checkout. `pnpm run dev` starts browser development. After building, `pnpm run package` creates the Windows package under `release/MDLxL-win32-x64`. No installer is required.

Version 0.21.2 is a full portable hotfix for 0.21.1. EMTR preserves library texture paths and UV Wrapper keeps its live preview visible during small edits. See [the 0.21.2 release notes](docs/RELEASE-0.21.2.md). Version 0.21.1 is a fresh full download after the previous updater problem and includes a repaired updater for future releases. See [the 0.21.1 release notes](docs/RELEASE-0.21.1.md). It extends Forge shape controls and Glow Up, adds animation speed controls, and improves OptimizeXL, materials, Showcase, camera rotation, and effect editing. Version 0.20.1 lets Texture Manager select multiple local texture files and adds new texture entries when needed. See [the 0.20.1 release notes](docs/RELEASE-0.20.1.md). Version 0.20.0 adds opt-in startup checks, manual updates, a one-version offline revert, and translations for newer controls. Downloads and multilingual update posts are available at [Low Polyworks](https://www.lowpolyworks.com/mdlxl). See [the 0.20.0 release notes](docs/RELEASE-0.20.0.md). Version 0.19.0 adds visual Forge primitives and simpler SHAPE controls, BITZ part replacement, Sort My Mess, and UV material improvements. It also includes independent EMTR library copies, resizable geoset lists, animation effects without editing markers, and GIF temporary storage on the recording destination drive. See [the 0.19.0 release notes](docs/RELEASE-0.19.0.md). Version 0.18.8 fixes MDX save verification for models with empty bone-binding groups, preserving their group order and bone assignments. See [the 0.18.8 release notes](docs/RELEASE-0.18.8.md). Version 0.18.7 keeps billboard geosets under the pointer while moving them, preserves original Bitz texture names, paths, and bytes, extends timeline scrubbing below the keyframe box, and renames the Showcase Hive profile to Low Size. See [the 0.18.7 release notes](docs/RELEASE-0.18.7.md). Version 0.18.6 adds persistent working tabs for geosets, keeps VIS display controls available, retains visible geosets while editing vertices or movement, and lets Texture Library search by pixel size. See [the 0.18.6 release notes](docs/RELEASE-0.18.6.md). Version 0.18.5 preserves particles while Showcase replays GIF export frames and hides unresolved event sound definitions. See [the 0.18.5 release notes](docs/RELEASE-0.18.5.md). Version 0.18.4 keeps local Showcase GIFs within the former upload-size limit and adds Optimizer repairs for verified cubic spline keys. See [the 0.18.4 release notes](docs/RELEASE-0.18.4.md). Version 0.18.3 removes the Showcase upload service, keeps Hive and local GIF export, adds Collect Bit from selected vertices, preserves classic-skin animation rendering, and commits active geoset RGB edits before changing modes. See [the 0.18.3 release notes](docs/RELEASE-0.18.3.md). Version 0.18.2 keeps the unanimated Bones pose and the animated Movement/Animations pose consistent between textured and wireframe views. See [the 0.18.2 release notes](docs/RELEASE-0.18.2.md). Version 0.18.1 fixes edited-model saving, node references, particle dimensions, animated colors, and empty geoset bounds, and replaces the Showcase fantasy font with OFL-licensed Marcellus. See [the 0.18.1 release notes](docs/RELEASE-0.18.1.md). Version 0.18.0 adds resource-manager and Appearance tree controls, persistent adjustable Paint crops, 31 curated default Paint textures, and full image-layer-chain replacement in UV. See [the 0.18.0 release notes](docs/RELEASE-0.18.0.md). Paint keeps direct model brushwork, repeatable texture stamps, visible selection tools, protected pixels, quick copy/paste, and in-place UV adjustments. Hold R to start a brush or stamp outside an edge while keeping the selection protected. Paint is translated into every app language; short English and Russian PDF guides are included. Grabthrough now defaults on in Vertices and stays off in Bones. See [the 0.17.0 release notes](docs/RELEASE-0.17.0.md). The 57 compatibility regression tests run with `pnpm test`; the restored historical suite runs separately with `pnpm run test:source`. See [the compatibility fix status](docs/MDL-MDX-COMPATIBILITY-FIXES.md) for coverage and limitations. After pulling source changes, rebuild before launching: `pnpm run build`, then `pnpm start`.

See `docs/ADDONS.md` for add-ons and `THIRD_PARTY_NOTICES.md` for component credits.

Version 0.11.0 restores the repeatable F texture/wireframe toggle, corrects animated
MDX geoset RGB, and lets UV Highlight Select shrink to 25%. Forge now retains
geometric crops, produces low-count Rough meshes and exterior trim with signed
depth offsets, and supports Square, Circle and Triangle crops. Optimize Model
(red-plus toolbar icon) previews verified byte savings and applies one undoable
change. Windows GIF recording uses bundled FFmpeg with lossless temporary frames,
a shared palette, accurate recorded timing and Retry Save. The external FFmpeg
corresponding-source archive accompanies the release for redistribution.

Version 0.10.3 separates final-model previews from editing overlays. UV preview
has independent Show mesh, Highlight Select and Size controls. Animations and
other final-model previews use textured presentation with authored geoset color.
Settings > Warcraft III > Preload Assets prepares persistent local thumbnails for
the available texture library, with confirmation, progress and cancellation.
Importing continues to use original native texture paths and original bytes.
See docs/MDLxL-0.10.3-Changes.md for usage and cache scope.

Version 0.10.2 implemented HerrDave's September 10 contract: independent grids and
axes, consistent team color and lighting, sharp viewport edges with filtered
textures, 3D rig markers, compact Bones/Movement controls, rest-pose pivot editing,
selection-scoped UV maps and mesh copy/paste, workplane and movement locks, and
the updated toolbar, View menu and light theme. Bones replaces UV Wrapper;
UV-maps opens from an eligible vertex selection. The approved lighting setup
remains ambient 128, diffuse 192, specular 0, power 1. The release review bundle
contains the ticket checklist, comparison images, exact test results and limits.

This patch restores a compact, 52-pixel MDLVis-style keyframe reel in Movement
and Animations. It shows the current sequence, or the All line for local time.
Highlight KF restricts editing to selected objects and their active controller.
Ctrl+C copies stored keys, C copies the sampled frame, and Ctrl+V pastes whichever
was copied most recently. Shift selects an inclusive range. Delete removes keys
at the current time or selected range; Edit > Keyframes > Clear removes the selected range
or all keys in the displayed interval. Drag the reel bar to scrub; click the
bottom ruler to jump to the previous or next key. See docs/MDLxL-0.10.1-Changes.md.

Forge, shared DummyBone attachment, general geoset shaping, English/Russian
switching, viewport improvements and capture controls from 0.10.0 are retained.
