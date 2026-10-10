# MDLxL 0.22.0 - POSE animator and editing improvements

## Start posing
1. Open **Movement (F3)**. Choose an animation and frame. Click **POSE**.
2. Click a hand, foot or body handle. Use **Move** or **Rotate**. Move **Bend** to steer an elbow or knee. Drag directly, grab an arrow shaft, or use a square to move in its plane.
3. Move Body/Pelvis to pose the connected character. Click **Pin** beside a selected hand, foot or hoof to hold it in place; click **Pinned** to release it.
4. **Add** creates a handle: choose a symbol, click its bone, review the highlighted chain, then **Add handle**. Use **Adjust chain** for Start, End and bending joints. **Setup** edits existing handles. You can pick bones in the viewport and rotate the camera while setting up.
5. A red crosshair blinks on a handle blocking movement. Release its pin or adjust the pose. The crosshair button switches this feedback off/on. Ordinary bone editing remains available.

Automatic mapping uses the skeleton, geometry and existing animation. Unusual rigs may still need Add/Setup. Each completed pose drag writes native animation keys and supports Undo. Save normally.

## What else changed
- Connected upper-body and rider controls, more complex rig recognition and faster posing on large animated models.
- Fixed, smaller movement-plane squares; capped arrows; neon feedback on press. POSE remembers its display choices and restores your normal view when switched off.
- Copy/paste can repair references through **Fix and paste**. Matching-material geoset merges offer conflict choices.
- UV projection keeps selected geosets together. **Triangles** subdivides selected faces within their original bounds.
- Texture Library **Vibe** search improves matching and typing response.
- Portrait camera/model edits refresh animated bounds. This is not a confirmed cure for every black portrait in Warcraft III.

## Update or download
1. Open **Settings > Mouse**. Update controls are at the top.
2. Click **Search for updates**, then **Update and restart**. Save changes when prompted and let the editor close/restart. Do not reopen it during installation.
3. If the update fails or behaves incorrectly, use [the full download](https://www.lowpolyworks.com/mdlxl/). Extract the whole ZIP into a new folder and run **MDLxL.exe**. Keep the accompanying folders together. Keep your old profile and personal libraries; do not delete them.

**Launch disclaimer:** The maintainer is AFK at launch, so replies may be delayed. Posing, native keys and the updater were checked; a complete authored animation has not been acceptance-tested. Report problems and use the full download if needed.

[PDF - English](https://github.com/UnsctMagic/MDLxL/releases/download/v0.22.0/MDLxL-0.22.0-Quick-Manual-EN.pdf)
