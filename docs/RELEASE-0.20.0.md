# MDLxL 0.20.0 — Updates, one-version revert and translations

MDLxL can now check for its next release. This build also includes all the Forge, SHAPE and editor improvements published in 0.19.0.

- **Updates:** Settings → Mouse now has **Search for updates** and **Auto update**. Auto update is off by default. When enabled, it checks once at startup and prompts if a newer stable release exists. It downloads and installs only after you choose **Update and restart**.
- **See what changes:** the prompt shows a short list of changes in your language. The expanded update post lives on [Low Polyworks](https://www.lowpolyworks.com/mdlxl/?version=0.20.0), with English, Russian, Spanish and Simplified Chinese choices at the top.
- **Revert to last version:** each successful update keeps exactly one previous program version. Settings can restore it offline. The next successful update moves this snapshot forward. Your current settings, personal libraries, recordings and saved files are preserved when updating or reverting. MDLxL asks about unsaved work before restarting.
- **Translations:** newer controls, tooltips, editor messages and updater prompts now have Russian, Spanish and Chinese translations. Existing community translations remain in place.
- **Official website:** Help, About and the update prompt include a small Low Polyworks link. Start downloads from [the official MDLxL page](https://www.lowpolyworks.com/mdlxl).

## Also included from 0.19.0

- **Forge and SHAPE:** visual primitive tiles, dimensions, thickness, modest complexity and the ThumperXL helmet; Projector textures and cutouts; preview-first Curve, Fold, Twist, Dome, Roll and Taper, with automatic support rows for coarse pieces.
- **BITZ and EMTR:** Quad View part placement with inherited bone bindings, collected per-animation RGB palettes and cleaner model folders; independent working copies of library effects with conflicting texture paths separated.
- **Materials and UV:** undoable Sort My Mess consolidation with Before/After previews; temporary UV textures allow normal geometry edits, preserve authored material settings and keep geometry/UV edits on Revert; faster initial UV scrolling and no team-color backdrop overlay.
- **Editor and recording:** vertically resizable geoset lists; particles and ribbons render in Animations without editing markers; GIF temporary frames use the recording destination drive.

## Getting this release

Open [www.lowpolyworks.com/mdlxl](https://www.lowpolyworks.com/mdlxl), download the Windows portable ZIP, extract the whole folder and run **MDLxL.exe**. Keep its folders together. Builds without the updater need this portable download first; subsequent updates can be installed from Settings. The page also links the FFmpeg corresponding-source archive.
