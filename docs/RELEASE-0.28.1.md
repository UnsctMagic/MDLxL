# MDLxL 0.28.1 - Hotfix

## Fixes

- UV Wrapper: the yellow texture warning no longer flickers and the workspace no longer jumps while the texture map redraws after a material change. This was most visible on slower PCs.
- Particle library: all 34 reviewed effect names are back (for example "Low black smoke" and "Narrow flame column"). 11 of them had fallen back to automatic names. Reviewed names now stay attached to their effect when the library is rebuilt or Warcraft III updates, as long as the game's model is unchanged.
- The message for spawned effects that cannot be previewed is translated again in Spanish, Russian and Chinese for every model format, including 1800.
- Forge: adding a forged piece no longer changes the stored bounds of the model's other geosets.

## Update

In 0.28.0, open Settings > Configuration > Search for updates > Update and restart.
