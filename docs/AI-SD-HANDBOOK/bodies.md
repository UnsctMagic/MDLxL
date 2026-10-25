# Bodies and proportions

Start from an actual comparable native unit, not a generic human diagram or a stack of boxes. Search the installed SD game library for Footman (armoured human), Grunt (heavy orc), Archer (light elf) or Skeleton (exposed undead). Load it as an open reference with mdlxl_assets source:game action:reference. It stays separate from the working document. Read references[documentId].model; sample its Stand pose with the existing animation APIs and inspect its real surfaces, not its bind-pose bounding box. For pictures, use the existing Library preview while retaining the working document: mdlxl_command with id textureLibrary opens the full Library; mdlxl_ui inspects its controls, selects the Models tab, sets Search game files to the native unit name and single-clicks the appropriate Classic/SD tree row. Pause the preview and use mdlxl_ui capture. Its canvas supports a normal drag to turn the body. Look at front, side and three-quarter shapes, then close the Library with Close texture library. Do not choose Open in editor or switch model tabs during a captured task: the task pauses when its working tab is not active. The separately loaded reference remains available for numeric read-only scripts.

Record the role, visible body height, head including helmet, shoulder span, chest and waist widths, limb taper, hand/boot scale, stance and forward/backward lean. Exclude weapons, corpses, portraits and invisible variants from body proportions. Generic bone names are not anatomical labels: look at where their posed surfaces actually lie. The native Footman has 323 visible Stand triangles, while its whole file has 372. Its head/helmet territory is about 26.6 high in a 99.3-high visible figure: around one quarter, not a realistic one eighth. That territory has 105 triangles and includes helmet/face detail. Do not force it into a 60-triangle cap. These are one reference's numbers, not all humans' proportions.

## Compare actual unit types

These renderer-checked examples are visible Stand-start silhouettes, including their equipment. Their whole-file totals also include hidden alternate/corpse surfaces. Treat named head territories as rig regions, which can include a hood, hair, helmet and adjoining edges. They are useful comparisons, not anatomical caps.

| Native body | Visible / whole-file triangles | Visible height | Head territory height / visible height |
| --- | ---: | ---: | ---: |
| Footman | 323 / 372 | 99.33 | 26.8% including helmet |
| Grunt | 421 / 688 | 101.03 | 19.7% named Head territory |
| Archer | 417 / 449 | 93.31 | 34.1% Head mesh territory including hood/hair |
| Skeleton | 334 / 707 | 104.08 | 15.6% Head bone; excludes facial child bones |

The Grunt's named chest territory is 55 triangles, each upper arm 30 and each forearm 24 in this visible pose. The Skeleton's named chest territory is 42 and each lower arm 15. Do not turn either count into an exact isolated muscle budget. The large orc forearms and projecting head, the narrow elf waist and hood mass, and the skeleton's open chest/limb gaps come from their actual native surfaces. Choose a reference for compatible stance, joint layout and body masses before choosing colours. A human body scaled sideways does not become an orc; a humanoid is not a suitable base for a quadruped.

For a fresh body, work the large masses into a coherent contour: sloped shoulders lead into a broad upper chest, the breastplate narrows at the waist, and the pelvis flares modestly into the legs. Chamfer the important outline corners with a few purposeful planes. Upper/lower limbs taper and bend at their joints; they are not uniform rectangular bricks. Let the forearms and boots carry readable weight, keep gaps between arms/torso and between legs, and check the side depth as carefully as front width. A flat grey torso with a cap and a painted shield does not pass as plate armour. A plain ordinary soldier may start near the comparable visible triangle count; add faces only for a specific contour, joint or material boundary.

A human soldier uses an upright chest, broad plate planes and a helmet that wraps the crown, brow and cheeks. An orc has a wider upper body, a projecting head/jaw and thick forearms; a light elf has narrower waist and longer tapered lines; an undead skeleton needs the chest/pelvis contrast and open negative spaces. Take those relationships from the reference you actually inspected. Vary torso taper, shoulder mass, stance, head profile and equipment balance rather than repainting one body.

## When the user asks to reshape a native unit

Native geometry is a legitimate starting point only when the user's request authorizes it. Use the existing document/import APIs; never make a prefab body-parts bank. First identify the body and equipment surfaces and inspect their posed positions. Keep the native topology, material stack, UVs, weights, bone IDs/pivots and animation tracks unless the requested change needs one of them altered. Change a small set of meaningful silhouette relationships, such as chest taper, shoulder slope and helmet profile. Do not simply recolour the source or rename an unchanged unit.

Reshape connected cross sections in model/bind coordinates, using bone membership to avoid touching nearby equipment or the opposite limb. Shared joint/seam vertices must receive the same positional change; keep joint centres and grips unless their movement is requested. Do not scale a whole geoset that also contains hands, weapons and the head. If designing the displacement in a posed view, use animation.unskinGeosetPoint to return each changed posed point to its authored vertex space; inspect its signature and do not invent inverse skinning. Preserve painted anatomy by keeping the UV layout attached to its surfaces. Inspect textured and untextured front/side views. Sample Stand, Walk and Attack at endpoints and intermediate times, checking shoulder/elbow/knee continuity, weapon grips, shield clearance and planted feet. Keep source quirks outside the requested changes. This reshaping workflow is different from fresh construction and must be reported honestly.


## Starting an authorized native unit in an empty document

A source header version such as 1800 and an empty destination at 800 do not by themselves mean the Classic body cannot be used. The existing paste-format adaptPasteFormat API adapts a COPY to the destination's format, leaving the source untouched. Inspect its implementation and the source's actual features first. For the installed Classic Footman, hdContentIssues is empty and BindPoses, FaceFX, SkinWeights and Tangents are absent. A complete canonical copy at destination 800 was checked: geometry, UVs, bindings, rig and sequence data match, 15 Stand/Walk/Attack samples have zero position difference, both file round trips pass, and the source remains 1800. This is a verified example, not a promise for all native files or permission to drop meaningful modern data.

Use this route only with explicit native-base permission and a truly empty destination: no authored mesh, rig, sequence, material or other content. Read the source and destination keys first; the edit scope must list the actual canonical collections. Never use scope / or /Nodes. Use existing model-version hdContentIssues and inspect the other modern feature arrays before choosing a compatible copy. If adapting would drop authored features, use the native document as the working model instead of discarding them.

The operation is a general model-data copy, not a shape generator:

```js
const format=await api.module('paste-format');
const source=references[referenceId].model;
const base=format.adaptPasteFormat(source,model.Version);
for(const key of Object.keys(base)) {
  if(key==='Nodes'||key==='Version')continue;
  model[key]=structuredClone(base[key]);
}
```

Preserve the destination Version; Nodes is rebuilt from canonical Bones/Helpers/etc by normal normalization. Include Sequences, GlobalSequences, PivotPoints, all node collections, materials, texture animations, geoset animations and other copied canonical data in scope. Copying just geometry onto DummyBone loses the animated unit; importGeosets without a rigid anchor is rig-aware but leaves sequence definitions unchanged. Read its source rather than assuming every import is rigid. The whole-body canonical copy keeps the complete compatible native setup for this empty-target case. Reshape the body deliberately in that same edit, then compare protected data, posed joints and actual images. An unchanged imported Footman is not a new knight design.

## Measured evidence and limits

torso: 682 named-bone territories; triangles median 32, P10–P90 6–80. arm: 290 territories; median 12, P10–P90 2–25. leg: 838 territories; median 11, P10–P90 4–19. A named territory can include adjoining joint surfaces.

Unit models only, excluding portraits: torso 310 territories, median 32 triangles; arm 191, median 13; leg 659, median 11. Heroes and differently named territories are mixed; inspect the comparable role. The renderer-checked Footman example is in [installed game measurements](../AI-SD-PART-DATA.json). Only numeric metadata is stored; no source geometry is supplied.
