# Objects: one set of words in every editor (plan)

Status: awaiting approval (plan only, nothing built). 14 Nov 2026.

## 1. The words

"Nodes" goes away as a show switch. Today it is a leftover pile (lights, collision, odd events), and it means something else in each editor. The word for "all of them" becomes **Objects**, which the app already uses ("Delete object", "Other Objects").

The show switches, same names, same order, same icons everywhere:

1. **Bones** (bones and helpers; right-click still picks which)
2. **Attachments** (today "Attachment" in one place, "Refs" in another)
3. **Emitters** (particle emitters and ribbons, as EMTR treats them)
4. **Events** (blood, footprints, splats, and the odd ones that hid under Nodes)
5. **Sounds**
6. **Lights** (was under Nodes)
7. **Collision** (was under Nodes)

An editor shows only the switches it needs, never a different word or order. Skeleton, Focused Skeleton, Grid and the rest stay as they are. Cameras are not touched.

## 2. Each editor

| Editor | Shown at start | Switches | Select | Move | Animate | Delete | Double-click a symbol |
|---|---|---|---|---|---|---|---|
| Vertex | Mesh | Bones only | Mesh | Mesh | no | Mesh | (parts, as today) |
| Bones | Bones | All seven | Any shown object | Yes, rest position | no | Yes | Emitter or ribbon opens EMTR |
| Movement | Bones, Emitters | All seven | Any shown object | Yes | Yes, keyframes | **Yes (new)**, same button and key as Bones | Emitter or ribbon opens EMTR |
| POSE | Clean, as today | Same as Movement | as today | as today | as today | no | Emitter or ribbon opens EMTR |
| Animations | Model with its effects playing | Emitters, Events, Sounds: each hides the real thing (particles, blood and footprints, sound) | no | no | no | no | No symbols. Double-click a playing effect opens EMTR |
| EMTR | Only the emitter you are editing | View All Emitters | Emitter | Yes, handles | Yes, diamonds | as today | switches emitter |

**ViS (MDLVis look):** the same words, order and rules. It keeps its classic marker shapes and text-only switches. ViS Vertex shows bones as today; attachments move to Bones.

Fixed along the way: in Bones and Movement, lights and collision could not be shown at all, and emitter symbols in Animations only appeared with "Nodes" on.

## 3. Where visibility is edited

- **Emitters and ribbons:** only in EMTR, with the diamonds.
- The "Nodes" list in the Animations sidebar is removed. The "Visible" tick in Movement goes away for emitters; "Edit effect" stays and opens EMTR.
- The "Visibility…" button in the manager opens EMTR for emitters.
- Mesh and material visibility stay in Animations, unchanged.

## 4. Questions for you

1. **Rename "Node Manager" to "Object Manager"?** It lists every object, so yes, it is all of them. Alt+O stays. *Recommended: yes.*
2. **Lights and attachments also switch on and off over time, and EMTR cannot edit them.** *Recommended:* keep the small "Visible" tick in Movement for those two only. Nothing is lost, nothing new is added.
3. **Animations: keep the Bones, Skeleton and Focused Skeleton switches?** You said "just a model preview". *Recommended: remove them there.* They stay in Bones, Movement and POSE.

---

## Implementation notes (for agents)

Base: branch `claude/node-display-37527c` from main `40a37825`. Inventory verified in code on that revision; key facts below. Do not start before the owner answers section 4 (each answer changes scope; defaults below assume the recommended answers).

### Verified facts the design rests on

- `previewOverlayOptions` (`app/preview-overlays.js:14`) forces `nodes:false` whenever `overlays.events` exists (XL), so lights, collision and non-SND/SPL/UBR/FPT events are never drawn or picked in XL Bones/Movement/Animations (only `poseConfig.picking` re-enables, `GamePreview.jsx:1513`). `effectSymbols` hides emitter/ribbon/sound/event markers in Animations unless `overlays.nodes`.
- `viewportOverlayOptions` (`app/viewport-overlays.js:5`) is a second, different adapter (Vertex Viewport, Paint).
- `movementNodeCategories` (`preview-overlays.js:32`) is the only classifier; fallback `'nodes'` in `movement-overlay.js:38`, `viewport-overlays.js:31`, `rig-markers-gl.js:66`, `visibleMovementPoints`.
- In XL Movement/Animations the Emitters switch already gates the rendered particles and ribbons (`GamePreview.jsx:1268`), Sounds gates playback (`:1440`), Events gates decals (`eventPreview.render`, `:1502`). XL Bones never renders particles. So "Animations toggles hide the real thing" is mostly removal of the symbol path, not new rendering.
- Double-click today: `pickParticle` (`GamePreview.jsx:872`) hits rendered particle pixels only; `pickPartBones` (`:877`) handles bone markers. No marker path to EMTR. `onParticlePick` (`App.jsx:2047`) opens EMTR except in Animations.
- Delete: `deleteSelectedNode` (`App.jsx:496`) → `deleteRigNode`; `onDeleteNode` is passed to `MovementController` only for `mode === 'bones'` (`AppSidebar.jsx:100`); the button already exists (`MovementControllerRecomp.jsx:182`).
- EMTR already solos (`ParticleEditor.jsx:73,86-94`) with "View All Emitters" (`:404`) and all markers off (`:395`). Lock with a test; no behaviour change expected.
- `emitter-timing.js` `FAMILIES` covers the four emitter collections only; lights/attachments are rejected ("The emitter was removed."). Global-sequence visibility is read-only in diamonds; "Adjust Manually" (EmitterTextDialog) is the remaining route, so removing the Animations route loses no ability for emitters. State this in the PR.
- Cameras: `useEditorDisplay.js` forces `cameras:false` since `dc41a9c1`; no menu item. MERGER_NOTES still lists Cameras in the View menu (stale vs code). Out of scope: owner did not ask; do not add a toggle. Correct the stale MERGER_NOTES line only if the owner agrees.
- `App.jsx:383` calls `setEditorDisplay(…, 'animation', …)`; no such editor key. Remove or fix while here.

### Design

1. **One kind list.** New `src/object-kinds.js`: ordered `OBJECT_KINDS` = `bones, attachments, particles, events, sounds, lights, collision` with `{ key, label, tip, collections }` (labels: Bones, Attachments, Emitters, Events, Sounds, Lights, Collision). `objectKind(model)` returns Map ObjectId → kind for XL and ViS alike (no `vanilla` fork): Bones+Helpers → bones; Attachments; PE/PE2/Popcorn/RibbonEmitters → particles; EventObjects `SND*` → sounds, every other EventObject → events; Lights → lights; CollisionShapes → collision. Marker symbol stays a separate lookup (`symbolKind`: ribbon, sound, blood, foot, uber, …) so ribbons keep their symbol while sharing the Emitters switch. `EDITOR_KINDS`: vertices `['bones']`; bones, movement (and POSE) all seven; animations markers `[]`, effect switches `['particles','events','sounds']`. No fallback `'nodes'` anywhere.
2. **One adapter.** `objectOverlayOptions(overlays, { editor, vanilla, markers })` in the same module; `previewOverlayOptions` and `viewportOverlayOptions` both call it for the kind flags and keep only their own non-object flags (wires, grid, normals, boneLines…). Delete `grouped`, `effectSymbols` and the `ribbons = particles` special cases. `movementNodeCategories` becomes a re-export of `objectKind` or is removed; update every consumer (`movement-overlay.js`, `viewport-overlays.js` `viewportNodeLayout` groups, `rig-markers-gl.js` `rigMarkerVisible`/`markerStyle`, `GamePreview.jsx:594` right-click preview, `PaintViewport`, Attachemator, AutoCorpse, `preview-presentation.js` `CLEAN_DISPLAY`, `ShowcaseWorkspace` `CLEAN`, `PaintWorkspace` `emptyOverlays`). Per the "diff every consumer" rule, compare marker output for each consumer over the test-model library before and after; only the intended differences may appear. Lights/collision keep the tetrahedron in both looks; ViS keeps polyhedra for all.
3. **Menus.** `src/view-menu.json`: remove `display:nodes` everywhere; "Attachment" → "Attachments"; add `display:lights`, `display:collision`; reorder to the list; vertices keeps Bones only of the object kinds; animations keeps Emitters, Events, Sounds (+ Wireframe, Grid; Bones/Skeleton/Focused Skeleton per answer 3). Register the new commands (`App.jsx:1522`), `menuChecks` (`:1754`), `LookIcon.jsx` icons (drop the `nodes` glyph; lights and collision each need a glyph in the existing set's style), `electron/menu.cjs`, `command-launcher.js`, hotkey labels (`docs/HOTKEYS.md` rules). `QuickDisplay.jsx` `TIPS` come from `OBJECT_KINDS.tip` (short tooltips for Emitters, Events, Lights, Collision). Bones sidebar "Refs" checkbox label → "Attachments" (`MovementControllerRecomp.jsx:172`), same switch.
4. **Defaults and persistence** (`src/display-overlays.js`): replace `nodes` with `lights`, `collision` in `base`; ViS gains `events`, `sounds`. Movement default XL: bones, helpers, focusedSkeleton, particles (unchanged). Animations: particles, events, sounds true; no marker keys. Vertices: only bones among kinds. Migration in `storedEditorDisplay` (key stays `mdlxl-editor-display`): where a saved editor has boolean `nodes` and no `lights`/`collision`, copy `nodes` into both; for `vis` also into `events` and `sounds` (ViS kept all events under Nodes); XL `events`/`sounds` untouched; saved keys an editor no longer owns are dropped. POSE `session.poseView.overlays` gets the same mapping in `defaultPoseDisplay`/on read. `shareBones` list unchanged plus nothing new shared (ask before sharing more).
5. **Double-click.** In `GamePreview` add a marker branch ahead of `pickPartBones`: `pickMovementNode` over visible points whose kind is `particles` → `onOpenEmitter(id)` (new prop wired to `openParticles`; the existing `onParticlePick` pixel path stays and now also opens EMTR in Animations). Same in `Viewport.jsx` only if it can still draw emitter markers (after this change it cannot in Vertex; skip). Never moves the camera.
6. **Movement delete.** Pass `onDeleteNode={deleteSelectedNode}` and the Delete command for `mode==='animation' && animationPanel==='movement'` (`AppSidebar.jsx`, `App.jsx:1542` command guard). Same single-object rule, same button, same key, same undo label. Not in POSE.
7. **Visibility.** Remove `AnimationNodes.jsx` and its sidebar section; `AnimationController` node-visibility branch (`nodeSelection`, `:90-94`, `:246-267`) is removed if answer 2 is "Movement tick", leaving geoset and material visibility. `EmitterVisibility.jsx`: for emitter/ribbon selections render only "Edit effect"; for lights/attachments render the existing "Visible" checkbox (generalise the target list from `effectNodes` to nodes whose `animation-tracks` channels include `Visibility`). `AppDialogs.jsx:126` `onEditVisibility`: emitters → `openParticles(id)`; lights/attachments → Movement with the object selected; materials unchanged. Animations no longer selects nodes on click (`onSelectNodes` not passed for that panel).
8. **Rename (answer 1).** "Node Manager" → "Object Manager" in `ResourceEditors.jsx` titles, `electron/menu.cjs`, toolbar/launcher labels, tutorials text if they quote it. Internal kind key `'Nodes'` and history labels may stay; visible strings "Move bones and nodes", "Movement bone or node", "Select node …" → "object(s)".

### Translation strings (de, es, fr, ru, zh in `src/locales/`)

New or changed keys (English is the key): "Attachments" (check existing), "Lights", "Collision" (exist; confirm the sense fits a show switch), "Object Manager", "Object Manager…", each new tooltip sentence, any reworded history/aria label. Remove keys that become unused ("Nodes" only if no other user remains; the Node Manager tab label still uses it unless renamed to "Objects"). Run `test/localization-quality.test.js` and `test/localization-release-labels.test.js`.

### Tests (fail first on main, per docs/TESTING-RULES.md)

Source:
- `object-kinds`: every node collection of a mixed model maps to exactly one kind; no `'nodes'`; XL and ViS agree.
- `display-overlays`: each editor's menu is an ordered subset of `OBJECT_KINDS`; no entry labelled "Nodes"; Vertex has only Bones; migration cases (XL `nodes:true` → lights+collision; ViS → also events+sounds; absent key → defaults).
- `preview-overlays` / `viewport-overlays`: XL Bones with Lights on yields a visible, pickable light point (fails today); Animations yields no marker for any kind whatever the flags; both adapters return identical kind flags for the same input.
- Deliberately rewrite (state why in the PR): `display-overlays.test.js` "VIS retains the original independent Nodes…" and "Movement enables only Emitters; Animations…", `viewport-overlays.test.js` node-type test, `vis-mdlvis-mode.test.js`, `compact-toolbar.test.js`.

Packaged, real mouse, on a model from `test/helpers/fixtures.cjs` with a ribbon, a PE2, a light and an event:
- Bones: double-click the ribbon marker → EMTR opens on that ribbon; same for the PE2 in Movement; camera matrix unchanged before/after.
- Movement: click the PE2 marker, press Delete → object gone from the model; Undo restores it.
- Bones and Movement, XL and ViS: Lights switch shows and hides the light marker; the switch row reads the same labels in the same order.
- Animations: no marker pixels with every switch on; Emitters off removes particle pixels; sidebar has no "Nodes" section.
- Vertex: menu has no Emitters/Events/Sounds/Lights/Collision/Attachments.
- EMTR: opens showing one emitter's particles; "View All Emitters" adds the others; visibility diamond drag changes that emitter's keys only.
- Movement: selecting a light shows "Visible"; selecting an emitter shows only "Edit effect".

Feature work: targeted tests only, no full packaged suite. Hand-over build opens `TEST OBJECT DISPLAY 01.mdx` after a hidden click-through of every new control.
