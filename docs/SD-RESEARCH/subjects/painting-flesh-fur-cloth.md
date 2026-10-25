# Flesh, fur, hair and cloth: directional paint attached to specific shapes

Gluma's Witch Elf, Bestigor and Stormvermin make useful counterexamples to treating a colour swatch as a material. Their diffuse sheets contain anatomy, direction and silhouette information.

| Source | Observed region | What the pixels already describe |
| --- | --- | --- |
| Witch Elf Hero (`lpw-gluma-159913`), `Witch_Elf.blp` | Pale face and thigh/upper-arm islands | Pink-violet shadow beneath pale flesh, dark eye socket/makeup, mouth and muscle shading |
| Witch Elf Hero, same sheet | White hair islands | Black and grey lines following the hair flow; separate narrow locks and broad fan-shaped patches |
| Bestigor (`lpw-gluma-127545`), `bestigor.blp` | Muzzle, beard and body-fur islands | Broad tan/brown flesh masses next to sharply directional dark fur strokes; face landmarks occupy specific UV positions |
| Stormvermin (`lpw-gluma-82593`), `stormvermin.blp` | Rat head and ear | Red eye, warm nose, pale teeth and fine dark fur strokes painted around recognisable face landmarks |
| Stormvermin, same sheet | Brown hanging cloth | Long dark vertical folds with pale upper edges and deeper recesses; the cloth strip is not a flat brown swatch |

Witch Elf uses the same white-hair treatment in several distinct geometric roles. Its connected components `g2:c7`, `g2:c8` and `g2:c9` each have six triangles. Components c8 and c9 share UV bounds `[0.191,0.631,0.421,0.770]`; c7 uses `[0.664,0.594,0.867,1.000]`. These numbers describe particular hair strips in this model. The white hair has dark internal strand marks already painted in it; six triangles do not imply six strands.

Witch Elf's two 7-triangle shoulder pieces, `g3:c2` and `g3:c3`, share `[0.545,0.590,0.687,0.683]`. The apparent repeated detail is therefore supported by matching UV regions. This is a reusable observation about that pair, not evidence that every piece in the model is mirrored. The large Witch Elf head/body components contain coordinates outside the unit texture square; the exact original coordinates and texture wrap flags must be considered together. The study does not replace them with a guessed safe rectangle.

Bestigor's curved horn is painted yellow-orange with pale transverse bands and a much darker inner bend. That directional contrast is different from the soft tan flesh beside it and from the blue-black plate above it. Moving the horn strip unchanged to a flat cloth panel would carry the horn's bands and bend shading with it. This is a visible reason that “same brown/gold colour” is an insufficient description of this sheet.

The native Footman face and Stormvermin rat face both reserve large, legible eye/eyebrow or socket contrasts inside a relatively small atlas. Their anatomical images differ sharply: Footman's face is a broad brow/cheek arrangement, while Stormvermin's side face stretches into a snout. The texture itself records that difference before the model is rendered. A material library should preserve the actual face-region meaning alongside palette data; classifying both as merely “skin” would discard the observed distinction.

## Picture evidence

- Witch Elf: `D:/Codex/sd-research/captures/models/lpw-gluma-159913/uv-001.webp` and `captures/textures/lpwtexture-0ec26d33f54edc1ed4.webp`.
- Bestigor: `D:/Codex/sd-research/captures/models/lpw-gluma-127545/uv-001.webp`.
- Stormvermin: `D:/Codex/sd-research/captures/models/lpw-gluma-82593/uv-001.webp`.
- Native Footman: `D:/Codex/sd-research/captures/models/proof-footman-sd/uv-001.webp`.

The exact polygons and triangle identities are in the corresponding `data/parts/<model-id>.json` files. The observations distinguish painted features from region boundaries; they do not claim that all the atlas pixels were hand-painted by a particular person rather than inherited or edited.
