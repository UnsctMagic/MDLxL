# MDLxL 0.40.4

- Settings > Configuration > File icons: Remove MDLxL from Windows takes MDLxL out of Windows (file icons, Open with, Default apps). Use it before deleting the MDLxL folder. Picking a file icon adds MDLxL back.

## 0.40.3

- XFER is difficult to get right, so it is a work in progress: check every result, and some models will still need fixing by hand.
- ANIM is removed for now and comes back only when it is useful.
- XFER (Transfer, F11): gives a model movement from another model. Transplant puts the model on the other model's skeleton with all its animations; Retarget takes movement one body part at a time. Rotation, Position or Mix chooses how limbs follow. See the XFER guide (PDF).
- Every slider has a small − and + that move it one step.
- Vertex editor: new Cut tool (key I) splits a triangle at a new point on one of its lines.
- UV Wrapper: Fit moves the selected UVs into an area you mark on the texture. Replace Texture… sits at the end of the material row. Preview RGB shows the whole model's RGB again.
- Movement: Motion path draws the path of the selected bones (its colour is in Settings > Appearance > Editor helpers). Local axes turns Rotate's handles with the selected bone. Events show their sound, blood or spawn name; double-click an event frame to see it in Animations.
- Top and Bottom views turn around the model's upright axis instead of tipping it over.
- Playing an animation pauses while you edit and plays on when you are done.
- The editing panel has a hide button. Narrow views show the camera bar as icons.
- FX: quick views keep looks while the model is open, and FX opens faster on large models. FX and EMTR save pictures as .blp.
- EMTR: switching emitters no longer replays the effect. PRE2 emission areas face the right way in the preview.
- OptimizeXL: Calculate extents offers Full or Necessary only (a smaller file). Unused data keeps FX layers in step. Reorder works on models with short geoset bounds tables.
- Help > Report a problem… sends a short plain-text report straight to me.
- AI: works without stops, View AI work replays each AI step in the editor, more AI providers (Claude first, then Codex), and drawing notes in the UV Wrapper and Movement.
- Node Manager: sound search finds sounds from every expansion.

Update: Settings > Configuration > Search for updates, or the portable ZIP.
