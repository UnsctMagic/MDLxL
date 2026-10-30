# MDLxL 0.37.0 - One way to work

**Rotate and model views**
- **Rotate** uses **Along the ring** by default in every editor: pull along the axis ring. X, Y and Z turn equally per pixel, without sticking or speeding up near the centre. Speed is **Rotation sensitivity × DPI** (the Wisp wheel). **Settings > Mouse > Rotation > Behavior** also offers **Straight drag** and **Circle the pivot**. Shift still snaps; cancelling and Undo still work. Existing profiles move to the new default once; per-editor speeds and overrides stay.
- **Smooth edges (antialiasing)** works in every 3D view. Model edges soften while bones, wire, dots and other editor lines stay sharp. First launch asks **How should your models look?**; choose **Smooth** or **Classic MDLVis**. Existing profiles keep their choice. XL has a small switch beside language and team colour; VIS keeps its compact toolbar.
- **Ready to try:** rotate the same part on X, Y and Z, then switch Smooth on with bones or wire visible.

**Windows and keys**
- **Escape** closes tool windows and their buttons show the key badge. During an active editing drag, Escape cancels the drag first; press it again to close. **Undo**, **Redo** and **Play** inside AnimXL and Showcase follow **Settings > Keyboard Shortcuts** and count in **Learn mode**. Learn teaches actual commands rather than incidental window letters.
- Sliders share one look. Number boxes apply on Enter or when you leave them; Escape restores the previous value, including Settings and Showcase. Tool windows share moving, Tab focus and closing behaviour.
- The old top-left file/edit/camera button row is removed; menus and shortcuts keep those actions. Language now sits before team colour. Theme colours are more consistent, including the Y axis in dark themes. Spanish, Russian and Chinese catch up with the new text.

- **Welcome and updates**: helmet eyes light with the fanfare after 0.65 seconds. **Disable sounds** remembers your choice; both popups still work if the optional effects cannot start.

**Paint, Forge and model editing**
- Citadel Paint keeps cut-out edges clean with smoothing on, fits the whole model in tall orthographic panels and follows **Grabthrough**. Paint texture/cut-out views and Forge's mask editor follow **Settings > Mouse** for wheel zoom and pan; zoom stays under the pointer.
- Inspector's **Recalculate normals** uses the NormalsXL SD-style result. **Add sequence** fills each geoset's extents; Inspector checks sequence names and whole-frame intervals like the Animations list. Portrait framing refreshes after rig edits; empty geosets save with zero-sized bounds. Forge and shaping tools reset normals on tiny or flat triangles cleanly, without leaving old X/Y values.
- Glow Up and Attachemator no longer mistake Elbow or Balance bones for weapons. Tools agree on which **Stand** to preview. New bone names avoid clashes with other node types. Bitz **Replace Part** fits the incoming part to the selected part's size and position.
- Bitz: parts without animations (such as a saved bit) now show every piece in the preview and stay visible when placed.
- **Help > Sanity Check** checks unsaved model data without changing it. Classic-format checks use mdx-m3-viewer by GhostWolf and contributors; modern-format coverage is partial. MDL comments round-trip safely; MDX saving explains that comments cannot be stored. Collision handles cancel cleanly if their shape disappears.
- **Ready to try:** rebuild normals in Inspector, add a sequence, or open Sanity Check before saving.

**Auto Corpse and effects**
- **CORP** opens **Corpse Editor** and **Blood Editor** with a mouse-rotatable preview. Adjust Size, Height and Color Tint; select and drag pieces to move, stretch or widen them. Add/remove pieces and use Body outline to fit them. Create applies corpse and blood as one Undo step, then pauses at the first Decay Bone frame.
- Corpses are fuller and reduce overlap flicker. Bodies without a recognised head can get a trunk; hand-held equipment stays out of the anatomy. Each blood splat and spray has its own **Kind**, time and placement.
- Walking previews leave world-space particles and footprints behind. Prints survive animation loops until their normal fade ends; pause keeps the trail and seeking resets it. Showcase follows row speed and held poses. Spawned blood and footprint models use the unit's real team colour.
- OptimizeXL preserves motion using each part's reach. Duplicate data keeps small helmet holes and slits; repeated triangles are removed only where the surface can safely lose them.
- **New in OptimizeXL:** **Animation optimization > Advanced > Reduction method > World-space bound** checks how the whole model actually moves in every animation and allows less change in slow animations than in fast ones. First and last poses stay exact. On over-keyed models it often saves two to three times more than **Local tracks**, which stays the default. Large models can take up to a minute.
- **Fixes:** Auto Corpse no longer turns a weapon on its own skeleton (such as a flail) into a second skull. **Delete** removes the part or blood you picked, also after dragging its handles, and **Ctrl+Z** brings it back. **Escape** during a handle drag cancels the drag instead of closing the window. In Attachemator, **Esc** now cancels bone picking as its tooltip says.

**Showcase**
- **Extra Time** accepts negative values for the whole take or individual animations. Death effect tails stop after 10 seconds by default; longer motion is kept and short deaths are not padded. Add Extra Time to keep more.
- **Output** has **Low** (up to 480 px / 2 MB), **Medium** (640 px / 5 MB, default), **High** (864 px / 20 MB) and **Best** (1280 px / 50 MB). Each sets colours, smoothing and FPS; long takes shrink to fit. **Main picture** (612 × 490) works with any level. Old Low Size presets become Medium; Standard becomes High. A Classic model-view choice stays Classic.
- The sidebar follows working order: Presets, Recording list, Model & animation, Output, Background or Portrait, Camera, Text and Signature. RECORD stays visible while scrolling; less obvious controls explain themselves on hover.
- **Text > Font > Load font…** adds TTF, OTF, WOFF or WOFF2 fonts for preview and export. Loaded fonts stay available; right-click removes one.
- **Ready to try:** choose Medium, trim an ending with negative Extra Time and load a font for your title.

**Library, saving and AI**
- Reforged and Forsaken Kingdom Library previews keep their skin and textures. Campaign characters use their proper names; the animation selector no longer cuts off its text. Texture Library and the particle library read the Warcraft folder chosen in Settings first; custom model-texture overrides still take priority.
- MDX export leaves out empty animation tracks rejected by War3 Model Editor 1.07. Windows writes use temporary files and retry brief file-in-use errors. Particle and game-file exports keep the right extension. Error messages drop the technical “Error invoking remote method…” prefix.
- AI questions and provider warnings stay readable in chat. Errors appear while you watch, sign-in is checked once per session and long plans remain readable. Chats keep their own attachments and drafts; attached references stay out of editor tabs.
- AI review compares matching original, edited and donor poses, including after Resume. A failed review stays unverified instead of passing. Birds route jobs and keep checkpoints more reliably, use read-only helpers and carry less repeated context. Unused model chats clean up after 3 days by default; **Important model** keeps a model's chats, and an empty cleanup setting disables cleanup.
- AI review now sees your reference pictures and before/after captures; missing ones are noted without blocking. Say “deliver anyway” to accept the result, with review concerns kept in the reply. A stuck display step no longer stops the whole job. Follow-ups no longer get a false “the model or selection changed” refusal after the AI’s own edits. When you point to an example you made, the AI copies its treatment over the whole requested area while keeping shape and textures.
- The AI now gets the full editor picture once and afterwards only what changed, with your newest words first, so short instructions are not lost.
- AI can measure animation changes with MDLxL's own playback code, including visibility and colour changes.
- AI can compare edits with a saved accepted version and show frames with the largest measured differences.
- A new size-optimisation guide helps preserve motion and explains native Blizzard key-density statistics.
- AI guidance now asks what looks wrong after a close result is rejected and reports the size and motion differences of saved candidates.
- Under the hood, the codebase audit replaces many copied helpers with shared owners. POSE rig detection is about 12× faster on the measured large rig. The packaged suite now selects the packaged app, with documented development-only exceptions.

**Update** Open Settings > Appearance > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
