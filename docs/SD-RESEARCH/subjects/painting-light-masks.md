# Light masks: a centre, an empty ring, and a dark centre are different materials

The native `GenericGlow1` sheet is a bright soft centre with a long grey falloff. `GenericGlow2_64` has a much broader near-white centre. `GenericGlowX_Mod2` reverses the arrangement: a dark centre spreads into pale surroundings. These are visible differences in the decoded pixels, not three names for the same glow.

| Sheet | Dimensions | Demonstrated source models | What is painted |
| --- | ---: | --- | --- |
| `Textures\GenericGlow1.blp` | 32×32 | `LightningBoltMissile`, `FarseerMissile`, `LavaSpawnMissile`, `ChimaeraRoost` | Small white centre, broad soft grey falloff |
| `Textures\GenericGlow2_64.blp` | 64×64 | `ReviveHuman`, `ReviveNightElf`, `ReviveOrc`, `ReviveUndead`, `Awaken` | Large luminous disc with a short soft boundary |
| `Textures\GenericGlowX_Mod2.blp` | 32×32 | `DeathCoilMissile`, `Shade`, `Shade_Portrait` | Dark centre and pale outer field |
| `Textures\Shockwave10.blp` | 64×64 | `CannonTowerMissile` | Hollow ring with long radial streaks pointing inward/outward |
| `Abilities\Spells\Undead\RegenerationAura\DarkSummon.blp` | 128×128 | `ObsidianRegenAura` | Purple line circle, six small circles and intersecting triangular lines; empty gaps remain important |

![Three different mask families, within the reviewed native contact sheet](<D:/Codex/sd-research/pictures/textures/effects/sheet-021.webp>)

`ObsidianRegenAura.mdx` has no stored geoset triangles. It uses one additive particle carrying the entire `DarkSummon` symbol. The sprite lasts 1 second, grows through sizes 70 → 105 → 140, and changes alpha 0 → 70 → 0. Emission rate is 5 and speed is 2. The ring is therefore drawn in the texture and enlarged by particle scaling; its six small circles are not separate geometric loops. This is an observed one-sheet construction for a complex emblem.

![The complete painted emblem used by ObsidianRegenAura](<D:/Codex/sd-research/captures/textures/native-sd-E6358371E8C4668542259E48DF8A9BD2.webp>)

`CannonTowerMissile.mdx` is a different construction: 10 stored mesh triangles and six particle emitters. Its `Shockwave10` particle lasts 0.3 seconds, grows 31.7 → 122.9 → 158.8 and fades 255 → 195 → 0. Its `GenericGlowX` particle lasts 0.4 seconds and grows 24.1 → 88.7 → 109. The model combines a textured projectile, rock particles, smoke/fire sprites, an expanding streaked ring and a softer flash. “Missile triangle count” describes only one of those ingredients.

The reviewed lightning sheets also show two distinct layout directions. `Abilities\Spells\Human\ThunderClap\Lightning2b` and the tutorial campaign's `Lightning2b` paint a vertical blue-white bolt on a 64×128 strip. `ReplaceableTextures\Weather\Lightning` paints a horizontal blue-white bolt on a 256×64 strip. Their bright core and softer blue fringe establish a ribbon direction in the pixels. The full texture inventory retains both; no claim is made that an unreferenced copy has a model use merely because its name looks useful.

The UI/glue sheets are part of the same visual vocabulary. `Textures\CloudsTile1` and `CloudsTile2` contain broad irregular white cloud banks with soft gaps; both appear in `OrcCampaign3D` and `TutorialCampaign3D`, and `CloudsTile2` also appears in `MainMenu3D`. They are large continuous cloud fields, unlike the regular smoke animation grids used by immolation. Treating every cloud-named sheet as a sprite atlas would mistake the actual painted layout.

Evidence: decoded sheet IDs and model users are recorded in `native-effect-material-observations.json`; exact particle settings are in `effect-atlases-sd.jsonl.gz`. The comparisons above concern authored pixels and model settings. Preview illumination, background and additive compositing can change the colour seen on screen.
