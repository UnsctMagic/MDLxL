# Build for Warcraft III

A casual request creates a basic classic SD asset at the game camera. Pick a role first: held weapon, ground item, scenery, unit, building or effect. Choose a bold outline, two supporting masses and one small accent. A simple sword is a blade, guard, grip and pommel, not a display sculpture. Build fresh vertices and faces with the mesh, extrude, bevel, mirror and weld APIs; inspect their signatures. Never load a reference model to harvest geometry.

Start round grips and shafts with 4–5 sides; small horns with 3–5; bowls and hats with 5–6. Add a side only when its silhouette visibly needs it. A closed 4-sided tube with two rings has 12 triangles including its ends. A five-ring, 16-sided grip already spends more than many entire native weapons. Count the result, not just the requested primitive parameter. Do not subdivide or automatically smooth everything. Flat shading on a bent blade or plate needs split normals, not extra tiny triangles.

Targets for ordinary new parts: head 40–90 triangles, hand 8–24, foot 8–20, torso 24–70, shoulder plate 8–24, blade 8–32, grip 8–24. These are starting targets informed by named native bone territories, not hard limits or measured individual-part percentiles. Portraits, heroes and large scenery differ. The measurement catalogue labels ambiguous surfaces and cannot justify a budget for a part it did not identify.

Choose a native sheet and a checked region before building. Keep the game texture path. Paint bevels, wrapping, small rivets, sockets and scratches; model only outline, volume, joints and important negative space. Use one main material, a contrasting secondary and one restrained accent. Never add runes or gems simply because a plain prompt left them unspecified. Show the result at game scale and from every side.

Keep the part count purposeful. Separate surfaces for a different material, transparency, articulation or a major silhouette change; do not make an object for every painted mark. Several pieces can share one coherent atlas. Extra complexity on one focal shape does not require making every grip, limb and rim rounder.

## Commit fresh geometry in the real model format

Use the existing general Forge commit for arbitrary fresh mesh data, not its preset shapes. Read api.describe('forge') and the commitForge source first. Supply the vertices, normals, UVs and triangles you designed yourself:

```js
const forge=await api.module('forge');
const result=forge.commitForge(model,{geosets:[{
  Vertices:new Float32Array(vertices),
  Normals:new Float32Array(normals),
  TVertices:[new Float32Array(uvs)],
  Faces:new Uint16Array(triangleIndices)
}]},{texturePath:chosenNativePath});
return result;
```

This commits a complete geoset/material/binding with the model's required defaults; it does not prescribe a shape. Use one geoset for the chosen material and map its face groups to the checked regions afterwards in the same script. Put part names in review sdParts annotations. Geosets have no serializable Name field. If writing a material directly, include PriorityPlane:0, RenderMode:0 and complete Layers defaults (FilterMode, Shading, numeric TextureID, TVertexAnimId:null, CoordId:0, Alpha:1). If writing PrimitiveCounts, also write PrimitiveTypes and make the count sum equal Faces.length. Never attach a human-readable label to a field the format cannot store. For edits use the existing source material, rig and mesh operations instead of rebuilding the document.

## Measured evidence and limits

head: 890 named-bone territories; triangles median 66, P10–P90 5–158; 26 detected planar-ring samples (median 4 sides). torso: 682 named-bone territories; triangles median 32, P10–P90 6–80; 3 detected planar-ring samples (median 4 sides). shaft: 56 named-bone territories; triangles median 10, P10–P90 2–70; 3 detected planar-ring samples (median 6 sides).

Unit models only, excluding portrait files: head: 373 territories, median 40 triangles; torso: 310 territories, median 32 triangles; shaft: 33 territories, median 22 triangles. Heroes and differently named bone territories are still mixed; inspect the comparable role.

These counts come from [installed game measurements](../AI-SD-PART-DATA.json). A bone territory may be one segment or several joined parts; portraits, scenery and variants differ. Targets above are construction guidance, not measured percentiles or universal caps. Unknown classifications stay unknown. No source geometry is supplied.
