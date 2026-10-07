# Sort My Mess

The Material and Texture managers share one **Sort My Mess** button. It opens a compact Before/After comparison, isolates the geosets affected by the current choice, and synchronizes rotation and zoom. Animation selection, playback and seeking let the same choice be inspected over time.

Exact duplicate texture records and material records are condensed in the draft. Texture equality includes path, replaceable ID, wrapping flags and all stored fields. Material equality includes every layer, its order, shading, shader, alpha, animation references and preserved MDX defaults. Geosets with different alpha/visibility settings stay unique. Geometry is never merged.

Each appearance decision is separate:

- **Different RGB:** Ignore, or Choose most similar RGB. Classic geoset tint, material colour fields and the native fixed-colour textures used by Color Tint presets are compared. The recommendation retains an existing profile closest to the group's sampled RGB values; it does not invent a new colour. Animated RGB retains the chosen complete track and MDX static base.
- **Team color:** Ignore, or preview Add team color / Remove team color and Merge & next. Existing material layer stacks supply both directions. Team glow is a different replaceable texture. A team-colour layer with different alpha is not a merge candidate.
- **Different rendering:** Ignore, or choose which existing filter/shading/draw-order settings to retain and Merge & next. Alpha and texture-animation differences are never discarded by this comparison.

Done commits the draft as one ordinary undoable document edit. Closing or Escape discards it. Ignored proposals do not change appearance. Unused records and repeated rendering layers are not swept away. Only materials superseded by an approved merge, or exact duplicates, are removed. No model file is overwritten by the dialog.

## Research and correction boundaries

Hive's [Model Optimizer](https://www.hiveworkshop.com/threads/model-optimizer-v1-3-0.323265/) explicitly records fixes for texture merging breaking Texture ID animations, and textures used only by those animations being deleted. Reindexing here uses the existing `visitTextureReferences` owner: classic and HD slots, discrete texture-ID keys, retained static MDX defaults and particle-emitter references. Interpolated texture-ID domains are preserved rather than compacted, since remapping endpoints does not prove preservation between them.

The author of [War3 Model Tuner](https://www.hiveworkshop.com/threads/war3-model-tuner-v1-3-8.357550/) lists merging identical materials/textures and notes ribbon emitters must be considered when removing materials. Both geosets and ribbons are remapped here.

[Modeling and Animation 101](https://www.hiveworkshop.com/threads/modeling-and-animation-101.41840/) explains that filter modes have different compositing behavior and team colour uses replaceable ID 1 and an ordered layer stack. Accordingly, layer passes are not treated as redundant merely because their texture matches. Appearance changes require the visual decision.

This manager command owns resource consolidation and explicit appearance choices. It does not invoke or alter OptimizeXL's accepted reductions, irregularity repairs, animations or immutable flail baseline. No fixture counterpart is used at runtime.

## Verification

`test/sort-my-mess.test.js` covers exact record comparison, discrete/HD/default/emitter/ribbon reference remapping, wrapping and layer-pass preservation, interpolated texture-ID protection, unique alpha/visibility, existing RGB recommendations, animated RGB defaults, both team-colour and filter directions, stale proposals, idempotence, MDX reopening and undo/redo. `test/sort-my-mess.electron.cjs` exercises the packaged dialog, rotation synchronization, isolation, Cancel, Ignore, directional choices, Done and document history.

Verified on 2026-10-07 in a separate packaged `MDLxL.exe` and test profile. The synthetic fixture condensed 9 materials to 5 and 6 textures to 5, preserving an ignored RGB group and a distinct 25% alpha material. The isolated prompt groups were geosets 1–3, 4–5 and 6–7. Screenshots were inspected for actual geometry and proposed appearance. Cancel kept the document identical; Done saved and reopened without validation errors; one Undo/Redo restored the edit; the source model stayed byte-identical. Shared rotation, playback and forward/backward seeking passed. The package verified 530 runtime/asset files and 55 locales. No Warcraft III, Retera or MDLvis execution was performed for this feature.
