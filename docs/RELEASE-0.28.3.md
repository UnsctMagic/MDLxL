# MDLxL 0.28.3 - Hotfix

**Fixes**

- Collect Bit: saving no longer fails when a different texture already exists in BitsAndParts. Collected Bits save only their MDX, keeping the exact texture paths from the source model. Texture files are neither copied nor overwritten.
- A Bit can be collected even when its textures are not loaded. Geometry, materials, UVs and RGB animation tracks are preserved.

**Update**  In 0.28.2, open Settings > Configuration > Search for updates > Update and restart.
