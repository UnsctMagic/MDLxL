# Method and limits

## Sources and scope

The installed game is read through the unchanged `electron/casc.cjs` CASC reader. Enumeration was checked against the complete named-file index, including UI, glue scenes, effects, spawn models and cinematics. Paths aliasing the same content key are grouped within a tier; extracted bytes are SHA-256 deduplicated. The original 3,448-model base-namespace index had no missing model paths relative to this installed named corpus. This inventory count is distinct from the 3,431 models retained in the active SD-art study. This is completeness of named local content, not proof about unnamed archive content or other game builds.

The game build metadata SHA-256 at acquisition was `d8c9d777bcfdbfa48c8424e7b2f1d51562cd630c7ec64e53c06e45a7e55b41c5`. It was unchanged after acquisition. Read-only extraction does not modify the game. LowPolyWorks' live JSON, all 130 model files, 42 referenced download packs, thumbnails and public texture mappings were saved. The permitted Hive manifest contains exactly 646 models from 90 resources; no other Hive resource is part of the study.

The active scope was subsequently narrowed by the owner to SD, including SD artwork stored in MDX version 1800. Version 1800 is not a visual tier. The research parser recognizes the installed representation; the rendering adapter treats shader type 2 as the documented SD fixed-function material. Prior HD/DE evidence is retained locally as an unfinished snapshot outside active statistics. The [art-scope review](data/base-namespace-art-exceptions.json) separates 17 base-namespace contents from the active study: 11 modern high-detail assets and six dense bridge assets whose art classification remains uncertain. These sources, measurements and captures remain preserved as supplementary evidence. The active set is 3,431 native models plus 130 LowPolyWorks and 646 permitted Hive models, 4,207 in total. SurgeOfLightHalo remains an SD-style effect with its cross-tier texture reference explicitly recorded; an SD model does not automatically make every referenced image SD paint.

## Parts and shape measurements

Faces sharing an edge after position quantization to 0.00001 model units form one physical component within a geoset. Material boundaries remain geoset boundaries. Separate UV islands and dominant-bone surface patches are also measured. Parts receive visual names from two isolated textured views, carrier context and the actual geometry/rig evidence. Bone names support location; they do not assign the semantic label.

Triangle count, stored vertices, distinct positions, normal and UV splits, bounds, area, boundary/nonmanifold edges, PCA directions and cross-sections are retained. Automatic cuts at 25%, 50%, 75% along a principal axis are plane-intersection measurements. Their corner counts can change with triangulation and twist; they are not declared authored ring sides. The Footman/Blademaster blade chapter demonstrates this distinction with actual ring topology.

Raw model-space size is normalized to the documented Footman Stand sample height 98.257613. Official object-scale fields are retained separately. A compound body, whole weapon or head/collar assembly stays explicitly compound. Family statistics include repeated and variant parts and therefore are descriptive memberships, not independent-sample budgets.

## UV and colour evidence

Mesh regions store the real projected UV triangles, including authored UV set and wrapping flags. Animated diffuse texture choices are retained. Repeated coordinates are wrapped only on flagged axes; polygons are clipped to the sheet for the overview. Out-of-range nonwrapping coordinates are flagged because edge-clamping can sample an edge colour that has no two-dimensional interior coverage. Extreme tiling skipped by bounded rasterization is explicitly flagged.

The general atlas database uses a 64×64 raster approximation for overlap and colour summaries; exact coordinates remain present. Selected owner/custom-paint comparisons use full-resolution pixel-centre union masks. Those percentages are the canonical picture-table values. Earlier polygon-edge-inclusive measurements are not interchangeable with them. Neither method is a guessed safe rectangle.

Source RGB/alpha, destination appearance, authored geoset tint, team-colour layer, layer blend mode and sampled visibility are distinct. A region's rendered material tags must not be read as source-paint tags. Matching logical texture paths or `.blp`/`.dds` stems are candidate identities; encoded-byte equality and reviewed decoded-RGBA equality are separately recorded.

Particle atlas cell rectangles come from actual emitter Rows/Columns, not filename guesses. Their blend mode, life-stage tint/alpha/size and frame ranges are separate from static mesh UVs. Legacy particle, ribbon, popcorn and external particle effects do not all have the same rendering support; the coverage report records unresolved cases.

## Captures

A background headless browser uses the project's parser, pose and renderer code read-only. No Electron app is launched and the owner's desktop is not controlled. Research-only adapters record modern SD material routing, mixed weight representation, MDX colour conversion, official replaceable-texture bindings and exact texture-resolution provenance. No imported library or application code is patched.

Every active model has four yaw views at 56° camera elevation and a wireframe record. The elevation matches the first installed game-camera angle; the research framing uses 30° vertical FOV and fits the sampled bounds, so these images are inspection views rather than a pixel-identical gameplay camera. Default pose is the first Stand sequence at 20%, otherwise the first sequence/static state. Empty sampled effects can use a documented alternate visible phase, with attempted samples retained.

Refreshed isolated mesh views suppress unrelated particles and ribbons but keep selected glow meshes and material layers. Six retained older component sets lack this suppression record and remain flagged in the capture coverage. Full-model views retain supported authored effects. Billboard camera orientation uses the project's existing correction. Emitter-only assets are framed to sampled live particle extents where authored bounds are insufficient. Capture file presence, foreground detection and direct visual review are separate statuses.

An offline capture samples one state and a bounded particle history. It does not prove every sequence, particle dependency, game renderer path or Warcraft III gameplay acceptance. Missing texture references are listed rather than filled with guessed artwork. Check the final capture coverage report for remaining blank views and explanations.

## Provenance and knowledge boundaries

A credit is an author-stated claim. Shared paint does not establish copied geometry. Strict point/UV signatures are candidates or transfers with explicit tolerances; full raw face-corner comparisons are used for the selected exact owner-variant study. Experimental affine fits that do not match remain inconclusive and are not reported as provenance.

Directly reviewed parts, strict transfers, weaker candidates and unreviewed measurements remain separate. Whole-sheet observations are not a segmentation of every material region. The initial volume intentionally exposes these gaps so later research can extend the evidence without turning an unfinished classification into a rule.
