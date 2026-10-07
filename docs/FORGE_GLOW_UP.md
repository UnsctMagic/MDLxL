# Forge: Glow Up

Select vertices in the vertex editor, open **Forge → Glow Up**, choose a type,
adjust Width, Height and Intensity, and click **Add**. One glow is centered on the
selected vertices. The strongest selected bone influence supplies the initial
attachment; the Attach to control makes mixed selections explicit. Model root
creates an unparented glow. Add is one undo step and Cancel leaves the model alone.

Types: camera-facing Billboarded; a flat XY, XZ or YZ plane; and the format's
Billboarded Lock X/Y/Z variants. Locks use the model's authored axes. Width and
height are model units; intensity is material alpha from 0 to 1. Preview shows
rest positions and evaluates billboards while orbiting. The model's animations
are retained on Add.

## Research

The supplied archives were extracted into ignored test output. All 11 MDX files,
including texture variants and the Thrall missile, were inspected. Source models
and texture bytes are not shipped with this feature.

| Supplied example | Observed glow setup |
| --- | --- |
| Sally Whitemane HotS, Lumi | Flat hero planes; `weapon_glow` is a Billboarded bone parented to `Bone_Staff`. Unshaded Additive material. |
| Baron Rivendare living, Sarsaparilla, all three variants | Flat ground glows and multiple Billboarded sword quads parented to `Sword`. Additive, generally Unshaded and TwoSided. |
| Baron Rivendare Death Knight, Sarsaparilla / ddd deathknight, all three variants | Separate ground and weapon geometry; weapon glow bones parent to `Bone Weapon` or `Sword`. Additive materials, authored visibility tracks. |
| Thrall Shadowlands, Lumi, both variants and missile | Flat ground planes; weapon mesh bones inherit billboarding from helper nodes beneath the axe hierarchy. The portrait backdrop also uses replaceable 2 with an opaque material, so texture ID alone does not identify a visible glow. |
| Gnome Dragonrider, Direfury | Flat base glow and many Billboarded quads on weapons, wings and body. Two AddAlpha layers, including team glow and `Textures\\sun.blp`, with animated alpha. The supplied custom BLPs are body/fire textures, not the team-glow texture. |

[Hive's weapon-glow discussion](https://www.hiveworkshop.com/threads/weapon-glow-questions.287743/)
describes a separate centered bone per quad, parented to the weapon, and
distinguishes full billboarding from axis locks.
[Hive's modeling tutorial](https://www.hiveworkshop.com/threads/how-to-add-remove-hero-glow-with-modelling.292349/)
imports geometry together with its bones.
[XGM's material example](https://xgm.guru/p/wc3/removingheroglow) identifies
replaceable 2 as team glow and shows an unshaded Additive layer with alpha;
replaceable 1 is team color on the body. This is model geometry rather than a
World Editor ability or an attached external effect.

## Implementation boundary

- `src/forge-glow.js` adds four vertices, two triangles, a dedicated centered Bone,
  a geoset animation, and a separate material. Parent transforms are inherited;
  existing bone flags, bindings, tracks, meshes, UVs and authored geoset bounds
  are preserved. Shared team-glow texture entries may be reused.
- New material: empty image path, ReplaceableId 2, AddAlpha (4), Unshaded and
  TwoSided (17), static alpha. AddAlpha is deliberately used for the intensity
  control, following the supplied Gnome example. The renderer's Additive mode
  uses source color blending, whereas AddAlpha uses source alpha blending.
- Full billboard quads face model +X and occupy YZ. The pivot is at the quad's
  center. Flat ground planes occupy XY. A fresh bone avoids billboarding the
  selected body geometry. Existing `createRigNode` handles node and bind-pose
  insertion; the editor's serializer handles canonical exported node order.
- The normal Forge modes and main editor sidebar footprint remain unchanged.
  Preview uses a private copy and the existing Warcraft renderer.
- Paused non-portrait billboard previews receive the current camera before node
  evaluation, avoiding a stale orientation when only one orbit frame is drawn.

## Verification

- 66 focused Forge, bone, glow, viewport and preview tests; 57 compatibility tests.
- All 11 supplied MDX models: all five types, MDL and MDX save/reopen, parent,
  pivot/binding/material checks, original geometry/rig/sequence preservation,
  and undo (110 round trips). Input archive/model/BLP hashes retained.
- Isolated packaged Electron test: no-selection guidance; selected vertices;
  dimensions and alpha controls; all types; preview/Cancel immutability; Add;
  one-step undo; native MDL/MDX Save As; unchanged 164px main sidebar.
  Real left-button mouse drags rotate the camera in both directions; native
  bone matrices follow those camera angles with a stationary pivot.
  0% and 100% intensity produce different rendered glow pixels. No renderer errors.
- Native Warcraft III / World Editor and external model editors have not been
  exercised. Those remain separate compatibility acceptance checks.

Local evidence: `out/glow-research/inspection.json`,
`out/glow-research/verification.json`, `out/glow-ui/`, and
`out/glow-rotation-ui/`. The mouse-drag regression test fails on the previous
package, where the unsupported `cameraMode="camera"` left rotation unbound,
and passes with `cameraMode="rotate"`.
