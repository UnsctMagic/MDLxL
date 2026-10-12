# MDLxL 0.24.0 - HD models and save fixes

## HD models

- Reforged HD models, with HD texture maps or skin weights, open view-only with a popup: HD models aren't supported yet. Saving is disabled, and the same note appears in the status bar and Help > Model diagnostics.
- Models whose only HD parts are a shader name or HD lighting values ask whether to Open view-only or Convert to SD. Converting removes those settings; the file is not changed until you save.
- HD content pasted into an SD model, or placed from a particle preset, is converted to SD, and a popup tells you. A shader name typed in the material inspector is not applied.
- HD event resources and HD BitsAndParts show the same clear message instead of failing. Event previews in formats 1300–1800 say they need a compatible Warcraft renderer.

## Saving

- Saving as MDL no longer freezes when a classic ParticleEmitter has Visibility.
- Saves that were wrongly refused now work: a geoset with all its triangles deleted, a light with a white ambient color, and models whose helpers carry a leftover bone tag from other tools.

## Updates and translations

- In-app updates now install on Windows accounts whose temporary folder uses a short "~1" path, common with long or non-ASCII user names.
- Forge shortcut names, the Events display toggle and the new HD messages are translated into Russian, Spanish and Chinese.
- Under the hood: cleanup with more tests, smaller code files and faster checks. Nothing changes in how MDLxL behaves.

## Update

In 0.23.0, open Settings > Configuration > Search for updates > Update and restart. If the update cannot install on an account with a short "~1" temporary folder, download the complete Windows portable ZIP once from [Low Polyworks](https://www.lowpolyworks.com/mdlxl), extract the whole folder and run MDLxL.exe. Later updates work in the app.
