# MDLxL 0.38.0

**Layout and geosets**
- Model controls moved to the top toolbar: MDX conversion and DPI/Scroll sit with language, team colour and Smooth. Open models are tabs along the bottom. **Settings > Add-ons…** opens the add-ons panel. Routine status messages are gone; errors appear briefly above the timeline.
- **Compact Set** is the new default geoset list: numbered boxes instead of the checklist. **Settings > Appearance > Interface** offers **Compact Set**, **Classic Set** and the **Compact Set color**. VIS always shows **Classic Set**.
- Geoset groups are tabs instead of a dropdown. **New** (+) and **Tab** actions sit in the **Geosets** heading.
- Right-click a geoset for **Hide Geoset** and **Show Always**. With **Hide extras** on, baking a geoset's visibility to 0 no longer removes it from the list mid-work.
- One icon set based on MDLVis for every toolbar (hand = Move, horseshoe = Rotate, magnifier = Resize), with the active tool still lit.
- Right-click **Bones** to choose **Helpers** and **Bones** in Bones, Movement, Animations, POSE and VIS. View shows the same controls in VIS and XL.

**Moving and rotating**
- **Workplane Constraints**: one shared gizmo for Move and Rotate in every 3D editor, following MDLVis. In quad view each Front/Top/Side pane uses its own plane; Perspective keeps the XY/ZX/YZ choice.
- Holding Shift during a constrained Move shows an orange padlock with the locked axis next to the pointer.
- All live drags update once per screen frame: UV Wrapper, mesh moves and camera turning no longer lag. Where you let go is unchanged.
- Quad-view vertex Move no longer lags, and geometry no longer disappears in orthographic views.
- UV Wrapper: **Zoom** grows or shrinks the selection in every drag direction; **Rotate** turns one for one with the mouse and ignores the 3D rotation settings. **Live Select** shows **Lines** and **Grabthrough** directly beside it.
- Movement and Animations: the **Rotate around Axis** box sits under **Current Sequence**.

**Effects**
- **FX** (Global Animation Maker) gives parts of your model permanent looks that run on their own global sequences, such as glowing runes, flowing water or terrain skins. Each look has its own layers and **Loop length**; **Open in EMTR** opens its emitter in the full editor.
- EMTR adds effects the way ribbons are added: pick a Library effect, it is placed at the selected vertices on their bone, then **Create** or **Cancel**. Library browsing is shared with the main Library.
- New EMTR weapon ribbons use Blizzard's weapon-trail image, so the bright edge stays at the weapon during a swing.
- The Emitter Editor **Motion** tab works on models without animations; **Place burst at playhead** explains that an animation is needed first.
- Sphereomancer keeps its preview steady while editing, starts from the model's own collision shapes, offers presets (x2 standard unit by default) and **Add sphere** / **Add square**. Every shape has a numbered box you can drag.

**Library and parts**
- Library textures and every texture picker offer **World Editor Style** (the default) beside **Standard**: browse textures by World Editor entry, like models.
- Bitz **Replace Part** takes the visibility of the part it replaces; whole imports get the standard corpse visibility.
- A **Fix model** prompt repairs values Warcraft III can only store as keyframes before Save, Bones, Movement/Animations, Managers and Showcase. Such models could not be saved before.
- Vertex sidebar: **Nuclear Weld** joins selected vertices on the same spot when their geosets share a material. **Seperate by Loose parts** and **Nuclear** share one row.
- Auto Corpse: a grabbed part gets a handle to raise or lower it, and drags follow the mouse at any Size.

**AI**
- Offload birds are removed. Each model tab keeps its own direct chat; several can work at once, and old chats still open.
- The AI names geosets by the number shown in the Geosets list, looks up editor functions in one step, and can measure a rule across every frame of every animation.

**Fixes and startup**
- If Windows cannot start WebGL, MDLxL retries once with software rendering by itself, without shortcut edits.
- Double-clicked models open in the installed MDLxL, not in a test copy that happened to run last.
- Forge's **Add shape** menu closes again with a second click, an outside click or Escape. The language menu is no longer covered by the portrait toolbar.
- Viewing controls say **Playback Speed**; the control that changes the model's timing says **Animation Speed**.
- Square vertex dots are no longer hidden behind blended materials.
- **Help > Sanity Check** shows only the Hive checker's findings; MDLxL's own structural warnings are no longer mixed in.
- Updates: this version also accepts the single fixed download name used from 0.39.0. Older copies must update to 0.38.0 first.
