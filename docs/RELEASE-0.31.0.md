# MDLxL 0.31.0 - AI console and a new look

- **AI console**: chat with an AI that can edit your model and animations. It docks at the left of the workspace (drag its edge to resize), shows its thinking while it works, and you can steer it mid-task. Pick the model in its header.
- AI: draw on the 3D model with **Marker**, **Pen** and **Eraser** to show the AI what you mean. Drawings never change the model or its saved file. Ctrl+Z / Ctrl+Y undo drawings too; picking any editor tool puts the drawing tool away.
- AI: **Offload Mode** (on by default) hands each job to its own worker chat, so long sessions stay quick. When you save, you can keep, summarise or wipe the chats. Switching model tabs pauses the AI and resumes it when you return.
- AI: an AI edit that would leave the model unsavable is undone straight away and explained. Replacing an existing file always asks you first.

- **New look**: carved tool tiles with new hand-drawn icons, new top-row icons, and a slate-and-gold module dock with square Warcraft III icons. The AI button is the first icon in the dock (Illidan's Metamorphosis). The active tool glows in your theme's accent; pick your own colour in Settings > Appearance > Interface > Tool highlight.
- New look: Stats and Coords fold under slim headers (folded Stats still shows vertices, selection and triangles). Geosets can float over the view with ⇱ and dock back with ⇲.
- The new look works in all seven themes. **VIS** still gives you the classic, old-school MDLVis look, untouched.
- **Shift+F1** / **Shift+F2** switch between a dark and a light look. Switching back restores your own look exactly, including custom colours. Both keys can be changed in Keyboard Shortcuts.

- Models where a geoset has duplicate geoset animations now open straight into the editor. A small **⚠ Duplicate geoset animations** button in the status bar offers **Fix** (undoable with Ctrl+Z) or **Not now**.
- Saving over a read-only file, such as one opened from a zip, now asks where to save instead of failing.
- Coords follows the selection live while you drag vertices in the vertex editor and Forge.
- UV Wrapper: Live Select has a small ▾ menu with **Lines** (new, untick to hide the lines between vertices) and **Grabthrough**.
- Texture menus in the Material Manager and particle settings show only the texture file name instead of the full path.
- After an update installs, MDLxL sends one anonymous ping with the new version number, so we can count updates. Nothing else is sent or stored.

**Update** Open Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
