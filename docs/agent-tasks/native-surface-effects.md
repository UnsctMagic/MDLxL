# Native Surface Effects audit

Status: ready to test locally. Owner review precedes a push or PR.
Owner: Codex
Updated: 2026-11-01

## Revision and review build

- Working checkout: `D:\Codex\mdlxl-global-effects`, branch `codex/global-effects-local`.
- Original 0.37.0 prototype checkpoint: `4d84756d`. Local merge: `7abe7a35`, incorporating `origin/main` at `fcc3ec4b`. Both rows of the task-table conflict were retained. The merged package identifies itself as 0.37.2.
- The audit fixes and the Warrior polish are uncommitted. The previous audit build is `D:\Codex\mdlxl-global-effects-audited-preview\MDLxL-win32-x64\MDLxL.exe`. The sibling verification folder contains the final run results.
- Native effect inventory: `D:\Codex\mdlxl-native-global-effects`. The owner explicitly requested both copying the selected shape and using the native eye surface for New geoset.

## Audit changes

1. FX sliders use the shared RangeField release commit. The colour picker commits its native change event. The duplicate channel sliders were removed.
2. The window caches compact native packages by game path, Classic variant and material/shape selection. Each package contains referenced textures, UV animations and clocks, plus the four-vertex native surface for eyes. Own-skin effects copy the selected material. Visible library thumbnails resolve one native picture at a time after the selected effect loads.
3. GamePreview shares the animated-geoset framing operation between Fit selection and Solo. Solo uses a target-specific frame key. Stable selection, isolation and overlay props and a sequence-start seek replace the FX playback-time state.
4. Fire wisps and Water droplets use EMTR's existing reviewed-name mechanism. The native index entries were identified by source path, content hash and emitter identity: Hero Flame Lord object 101 (BlizParticle20), Water Elemental object 61 (BlizParticle04). Existing and newly scanned matching entries receive the names. EMTR owns their Lab editing, placement handles and insertion.
5. Eye placement uses a temporary helper with constantTrack in the preview. Apply bakes translation, rotation and scale into the geometry and binds it directly to the selected part's dominant bone. Copied skins retain their original weights and geoset visibility.
6. Package preparation, geometry placement, material composition and geoset appearance have separate owners in src/surface-effects.js. Recipes declare blend mode and texture reuse. Material references are remapped before the completed overlay is interned. Visibility pulse can use the geoset alpha channel without adding a material. When an ordinary geoset alpha track gates Death or Decay, the material supplies the independent pulse. Only creating geometry is limited on bind-pose models.
7. Surface Effects is a registered command in the dock and Managers menu, with an empty default shortcut. The command follows read-only, save, Showcase and Paint restrictions. Ctrl-click picks the highlighted surface. The numbered dropdown remains available. The change-count footer was removed.
8. The permanent fixture is `D:\Claude\MDLxL-TestModels\surface-effects\WH_WOC_KnightTzeentchSword04.mdx`. Its SHA-256 matches the supplied model. Its README entry was appended. The packaged runner requires this fixture through testModel().

## Library additions

The first audit build brought FX to **16 surface effects**, with the two emitters available separately in EMTR.

| Group | Effects | Native art |
| --- | --- | --- |
| Skins | Frost skin, Revenant waves | Freezing Breath material 1, Revenant material 3 |
| Magic | Moon well swirl, Starfield | Moon Well target material 1, Frost Wyrm portrait material 5 |
| Weapons | Sacred edge, Frost edge | Directional glow recipes using SacredGlowSharper.blp and Ice3b.blp |

## Slider measurements

Water skin, same model and speed values for both versions. Each sample times structuredClone of the destination followed by applying the recipe. Donor loading, React and WebGL are outside the timer. Four warm-ups and 20 measured samples per version, alternating execution order, on the owner's PC. These numbers measure **model preparation**. The draft label continues to update during a drag.

| Permanent fixture | Before, each input (median / p90 ms) | During drag now | After, once on release (median / p90 ms) |
| --- | ---: | ---: | ---: |
| Footman | 7.35 / 8.91 | 0 builds | 4.20 / 5.15 |
| Tzeentch Sword04 | 17.61 / 19.20 | 0 builds | 10.26 / 11.61 |
| Khorne Flail03 | 14.06 / 17.87 | 0 builds | 7.66 / 9.25 |
| Hero Tinker | 35.94 / 39.36 | 0 builds | 32.68 / 34.31 |

## Verification

- Source: `node --test test/surface-effects.test.js test/module-button-labels.test.js test/live-drag-frames.test.js` — **57 pass, 0 fail, 0 skip**.
- Hidden UI checks on the final review bundle: `surface-effects`, `particle-native-placement`, `module-button-labels.browser` — **3 pass, 0 fail, 0 skip**. FX and EMTR ran in packaged Electron. The toolbar check uses its existing headless browser harness.
- FX covered all 16 presets, Ctrl-click picking, real mouse orbit and Move/Scale handles, draft/release renderer identity, a manually rotated Solo camera across an animation change, both New geoset shapes, Apply, Undo, and saved-file parsing. The saved Footman eye went from 5 to 6 geosets, kept 15 helpers and used bone 24. Its sole clock was the adjusted eye animation (733 ms). The baked and preview vertex positions also matched at three animation times in the placement test.
- EMTR exercised the actual scanner recipes in an isolated copy of the index entries. It searched both names, dragged the standard move and particle-size handles, confirmed placement, saved each MDX, restored the original model with one Undo, and reopened each saved file in a fresh packaged instance.
- Fail-first evidence: the original slider test failed “Dragging a range keeps the same live renderer until release”; the old EMTR library had no Fire wisps search result. The geoset-alpha check initially failed “The visibility loop belongs to the geoset”.
- An overlapping intermediate package/test run was discarded after a Windows runtime-file lock. The final package was built and verified before the reported run began. Its packager verified 1,370 runtime and asset files.
- Warcraft III engine playback and the owner's visual acceptance remain open. Claude owns final QA.

## Warrior review · 1 November

The current 0.37.2 review is in `D:\Codex\mdlxl-global-effects-elemental-preview`. `Try the Warriors.cmd` opens byte-verified working copies of the two LowPolyWorks Warriors with a separate local profile. The earlier Footman review is available in its original folder.

The library now has **23 effects**. Flaming skin uses the band of flame tongues on the native HeroAvatarFlame texture. Fire Lord embers preserves the original sprite animation and starts at the Fire Lord’s own orange. Ember edge and Venom edge use the Flaming Arrow and Acid Splash textures. Terrain adds Molten lava, Lava fissures, Glacial fissures and Felwood poison. The moving liquids stay inside filled terrain cells and the fissures pulse in place. All recipes reference native game paths.

Quick swatches have names and preset-specific defaults. The native custom picker commits on close. Reset restores the preset colour. Choosing a swatch sets an authored static RGB directly, including on the formerly magenta Khorne axe. Animated RGB keeps its keys when tinted. Ordinary geoset visibility remains intact. Overlay and Replace tint the selected geoset. New geoset gives the effect its own colour.

Library search, cropped native card artwork, material names in the geoset dropdown, a visible Original indicator and retaining an explicitly chosen application mode streamline comparison. Clicking the active card keeps the current adjustments. The preview now binds the UV set named by each material layer. Editing an overlay on a packed or wrapped UV island leaves the base mapping in place.

The Khorne fixture matches the catalogue model at SHA-256 `2cb28ecd61a1e1508f2281c7085b2d910610a7f878e87288943777ad6977b1cd`. The Nurgle fixture was added to `D:\Claude\MDLxL-TestModels\surface-effects\WH_WOC_WarriorNurgle02.mdx` and its collection README. Its SHA-256 is `6f3bf59ebfcee8beda63bc70b2058fc59a1a74f36c5fd14bb624af6c961312a7`.

### Local checks

- The targeted source run passed 63 checks with zero failures or skips. Five use the permanent Warrior files and also run with the packaged Warrior workflow.
- Electron compared the Nurgle weapon drawn with a saved second UV set against a visually equivalent first-set MDX. The old package differed at 6,420 pixels. The updated package differed at zero, and the original Warrior mapping still differed at 6,420.
- On Khorne geoset 18, the static gold preset retained its green channel and showed over 10,500 orange or gold stage pixels. Frostfire on the ember mask produced over 12,600 blue pixels. The packaged check also exercised preset reset, switching cards, Original, search, mode retention and the Nurgle Apply, save and Undo.

- The final review bundle passed five focused UI checks with zero failures and zero skips. Four ran in packaged Electron and the toolbar check ran in its headless browser harness. All 23 FX cards were exercised. Both EMTR entries placed, moved, resized, saved, undid and reopened with a fresh index of the installed game. An initial EMTR run detected the stale build signature of an older local index.
- The packager verified 1,373 runtime and asset files. The sibling verification folder contains the run summaries, UV comparison and slider timings. Warcraft III engine playback and owner visual acceptance are pending.

## Next action

Try Flaming skin on Khorne geoset 13 (shoulders), Fire Lord embers on 19 (weapon edge), or Felwood poison on Nurgle geoset 20 (weapon). After owner approval, prepare the PR into main with the description line `Session: codex Surface Effects audit`.
