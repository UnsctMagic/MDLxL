# Movement Recomp — required merger notes

These Movement-lane corrections are part of the final product and must travel with the lane when it is merged:

- Keep language, team colour, Smooth/Classic, MDX conversion and DPI/Scroll in the top toolbar, using its shared look. Open-model tabs occupy the bottom status row. The language popup opens below the top selector, stays on-screen and remains at least 220 px wide, including “The Language of Mordor”.
- Keep the former Display toolbar row removed. Bones, Wireframe Overlay, Nodes, Attachments, Emitters, Vertices, Grid, Cameras, Normals, Show Particles, and Clean View now live in the top-level View menu and retain checked state. The VIS look keeps exactly these lists (`src/view-menu.json`). The MDLxL look has its own (`src/view-menu-xl.json`, owner's spec 14 Nov 2026): Vertices: Shadows, RGB, Vertices, Normals, Objects, Wireframe Overlay, Axis guides, Grid, Clear; Bones: Shadows, Vertices, Bones, Skeleton, Objects, Lights, Wireframe Overlay, Axis guides, Grid, Clear; Movement: Shadows, Vertices, Bones, Skeleton, F.Skeleton, Objects, Lights, Axis guides, Grid, Clear; Animations: RGB, Shadows, Lights, Emitters, Events, Sounds, Grid, Clear. Objects shows attachments, emitters, events and sounds (right-click picks which); there is no Nodes switch and collision never shows there.
- In Movement/Bones, do not restore the UV-maps toolbox button. UV-maps belongs only to the Vertices toolbox.
- The Movement/Bones toolbox ends with “List of bones connected to selected vertices” and a larger list field. Clicking a listed bone changes the current bone/node selection without clearing the selected vertices.
- Workplane coordinate locks are intentional and required: XY disables Z, ZX disables Y, and YZ disables X. The disabled field must stay visibly grey and uneditable.

Primary files: `app/App.jsx`, `app/MovementControllerRecomp.jsx`, `app/pressed-keys.css`, `app/styles.css`, `src/view-menu.json`, and `electron/menu.cjs`.
