# Smoke and flame are painted motion, colour, and blending together

`ImmolationDamage.mdx` and `ImmolationRedDamage.mdx` are a controlled pair: each has **zero stored geoset triangles**, one particle emitter and the same `Textures\Clouds8x8Fire.blp`. The decoded sheet is grey, with 64 successive wisps, not green or red flame. Their emitter colour phases produce the different colours. Calling the sheet “green fire” would therefore lose half of its demonstrated purpose.

| Authored setting | Night elf `ImmolationDamage` | `ImmolationRedDamage` |
| --- | ---: | ---: |
| Atlas | 8 rows × 8 columns | 8 rows × 8 columns |
| First / later frame range | 0–32 / 33–63 | 0–32 / 33–63 |
| Blend | Additive | Additive |
| Lifetime | 0.500 s | 0.655 s |
| Speed / emission rate | 187 / 55 | 187 / 55 |
| Three size values | 20.2 → 13.7 → 8.301 | 24.4 → 16.7 → 10.201 |
| Three alpha values | 255 → 255 → 0 | 255 → 255 → 0 |
| RGB colour phases, rounded | (.702,1,.541) → (.078,.953,.012) → (.118,.804,.149) | (1,.859,.435) → (.949,.165,.012) → (.667,.118,.118) |

The first frame occupies UV `[0,0,0.125,0.125]`; cell 32 occupies `[0,0.5,0.125,0.625]`; cell 63 occupies `[0.875,0.875,1,1]`. These rectangles are dictated by the models' 8×8 emitter grid. They are not hand-drawn “safe” regions. The shrinking sizes are also specific to these two immolation models: they are not a universal smoke rule.

![The actual grey atlas used by both colours](<D:/Codex/sd-research/captures/textures/native-sd-C4721494C0B46396E92905BE7CFB062B.webp>)

`LargeBuildingFire0.mdx` deliberately combines three different jobs. Its `Clouds8x8ModFire` emitter lasts 4 seconds, grows 20 → 30 → 40 and uses **Modulate**. A `CloudSingle` emitter lasts 0.5 seconds, uses Additive, grows then shrinks 30 → 40 → 20, and changes from yellow to red. A second additive emitter uses `ReplaceableTextures\Weather\Clouds8x8`, lasts 1.2 seconds and shrinks 40 → 40 → 4. This file has zero mesh triangles. Its construction is three differently timed layers of painted motion, not a low-triangle flame mesh.

The decoded `Clouds8x8ModFire` sheet has pale surroundings and coloured interior marks. `DeathAndDecayTarget.mdx` likewise uses the pale `Clouds8x8Mod` sheet through two Modulate emitters, each with white tint and alpha 255 at all three phases. That pairing matters: the pale background is appropriate to a multiplying layer. A texture-only material catalogue that drops FilterMode would treat these as interchangeable with the bright-on-dark additive flame sheets, although the source models explicitly do not.

| Source | Painted atlas | Authored atlas grid / frame use | Construction difference |
| --- | --- | --- | --- |
| `PolymorphTarget.mdx` | `Clouds8x8Fade` | 8×8, 0–32 then 33–63 | Two Blend cloud emitters, delayed emission starts at 33 and 200 ms, plus additive stars; zero mesh triangles |
| `DeathAndDecayTarget.mdx` | `Clouds8x8Mod` | 8×8, 0–32 then 33–63 | Two Modulate clouds, purple additive stars and streamers; zero mesh triangles |
| `CannonTowerMissile.mdx` | `Clouds32_anim` | **8×8 despite “32” in the name**, but this emitter selects cell 0 for both phases | One painted cell is enough here; atlas capacity does not prove that every frame is animated |
| `ToonBoom.mdx` | `ToonSmokeX` | 4×8, 0–16 then 17–31 | Two Blend emitters use white and yellow/orange colour phases; a separate additive star emitter accompanies them |

`ToonSmokeX` visibly uses graphic, outlined puff shapes. The first `ToonBoom` cloud emitter grows 11.3 → 24.7 → 27.1 over 1.905 seconds while alpha falls 255 → 162 → 0. Its second cloud grows 15.8 → 17.9 → 24.7 over 1.63 seconds. Those are growing smoke puffs, unlike the shrinking wisps in the immolation pair. The same 32-cell sheet supplies both colour treatments.

![Graphic puffs in the 4×8 ToonSmokeX sheet](<D:/Codex/sd-research/captures/textures/native-sd-11336EC329904DA659D6A17F81B1F30F.webp>)

The installed SD inventory contains related but visibly distinct `Clouds8x8Black`, `Fade`, `FadeWhite`, `Fire`, `Grey`, `Mod`, `ModBlight` and `ModFire` sheets. Their differences include dark versus pale field, opacity progression, per-cell hue and edge softness. The whole-sheet observations are in `native-effect-material-observations.json`; exact model emitter references, grids and phase settings are in `effect-atlases-sd.jsonl.gz`. Together those records preserve both the paint and the way a model uses it. An inventory filename alone preserves neither.

Evidence: `native-sd-837DC84C04B6B07D0C6883266D426A34`, `FFD3E168C28AD2F2046D0B021FA8633F`, `FD9379C8AD3A621907DC5A4269C1D516`, `D2856554396BCE976EC6D598542D967D`, `00EE935DA2064726A17D1475F6D1C362`, `9DA91DF1A0E502ADFFD8625CDAE558B7` and `15C0C22C48A1B6F56AA90E7F7C6000FD`; all IDs after the first share its `native-sd-` prefix. Particle scales are source units, not claims about final in-game screen diameter. The lifetime frame ranges above are encoded ranges; the dataset retains out-of-grid ranges where present instead of silently correcting them.
