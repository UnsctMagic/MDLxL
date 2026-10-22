# MDLxL 0.29.0 - Attachemator, Warcraft III Library, Glow Up, Portrait backgrounds

## Attachemator

- New in Bones mode → Tools. Places the standard attachment points (Origin, OverHead, Head, Chest, Hands, Feet, rear feet for mounts, Weapon) on the right bones, the way Blizzard's own units have them.
- Existing points are found by name, moved and re-parented; points that are already right are left alone.
- A preview window shows every point. Untick a point to keep it as it is, or drag it with the normal Move handle. Nothing changes until **Commit**, which is one Undo step.

## Warcraft III Library

- The **LIBR** button opens the whole game: tabs **Textures**, **Models**, **Sounds** and **All files**, with a version filter (Classic, Reforged, Forsaken Kingdom and more).
- Models can be browsed **World Editor Style** (race › units, heroes, buildings, spells, items, doodads, each with its game icon) or by the game's own folders.
- Instant search across about 175,000 files. Search `painting`, `art` or `loading screen` to find only the game's illustrations.
- Models show a rotating 3D preview with an animation picker. Double-click or **Open in editor** opens one as a new tab. Sounds play on click; any file can be copied out with **Save a copy…**.
- In **Geosets**, tick parts of a game model and click **Import to current** to copy them into your model, from any model format.
- When a texture is already in the model, adding it asks: **Use existing material** or **Make a new material**.
- The texture pickers (Replace Texture, Material Manager, EMTR, Forge, Citadel Paint) work exactly as before.

## Glow Up (now in EMTR)

- Glow Up moved from Forge to EMTR's top bar. It builds hero glow the way Blizzard's heroes do: three pulsing team-glow planes at the feet and a row of glow squares along the weapon.
- Switches for Origin glow and Weapon glow (with a weapon picker) and a Brightness slider. Size and place the glows by dragging their handles in the preview, like emitters; the preview turns with the mouse. **Create** is one Undo step.

## Portrait background

- **Add Background** in the portrait toolbar (Movement and Animations) adds the Warcraft-style team-color backdrop behind the model, placed for the selected camera the way Blizzard's SD portraits do it. It is only shown in Portrait animations.
- When the model already has one, the button reads **Refresh Background** and re-places it for the current camera.
- **▾** opens Size and Height sliders with a small preview of the game crop, and **Blizzard default**.

## OptimizeXL

- **Fix everything** repairs every problem the checker reports, previews all repairs at once and checks again. **Approve all fixes** keeps them. Problems that need a decision offer a **Choice** with a default.
- Before and After previews sit side by side.
- **Save** writes the result into your open model (one Undo step). The first save offers **Back up, then save**.

## Forge

- Copy or mirror an extrusion or bevel onto the same shape and place it with Move, Rotate and the Workplane. The **Magnet** handle keeps it on the surface.
- Hold **Shift** to snap cuts and extrusions to matching ones. **Blend** joins adjoining flat faces so they extrude as one surface.

## Editor

- **Perspective** zoom: zooming out moves the camera back instead of widening the lens, so nearby parts no longer stretch across the screen.
- **Sound events** list every game sound, grouped by what it is for (Spells, Weapons, Units…), with ROC / TFT / RE / FK filters. Blood and Footprint events list only their own kind.
- **Appearance → Bones & skeleton** has separate Bone style (Cubes, Diamonds) and Skeleton style (Shaded, Tapered, Cone, Stick).
- UV mapper: the numpad moves selected UVs in eight directions.
- Emitters on camera-facing bones no longer move while you turn the camera during editing. Highlight KF also shows the emitter's visibility keys.

## Fixes

- Bones / Helpers / Refs labels are readable in dark themes.
- POSE can click Helper markers again (for example the Footman's head).
- Scrolling over the animation name no longer scrolls the side panel as well.

## Update

Open Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
