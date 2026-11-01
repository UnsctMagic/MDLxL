# FX surface effects

> **Owner review of PR #492 (1 Nov 2026): the task was misunderstood.** Read the [FX contract](../FX-GLOBAL-ANIMATIONS.md) first; it overrides this note. FX is a global sequence maker (burning sword, water skin, rune blade, fly swarm) with layer controls, whole-part fit and re-editing. Keep every existing card and its code as it is; the owner will sort them later.

## Current handover

The FX button and Managers command open the compact Surface Effects window. Choose a geoset in the model or dropdown, choose a card, preview it and click Apply effect. Overlay, Replace and New geoset are available. New geoset copies the selected shape and skin weights. The command has an assignable shortcut and starts unbound.

The second pass retires Moving eye and Classic eye. Six overlapping or faint earlier presets also leave the library. The library has **51 presets**, including 36 new looks.

| Category | Cards |
| --- | ---: |
| Energy streaks | 5 |
| Auras | 6 |
| Ambient | 6 |
| Weapons | 8 |
| Impacts | 7 |
| Buffs & curses | 7 |
| Skins | 5 |
| Terrain | 4 |
| Model | 3 |

Each card exposes two to four tuning controls with one-line tooltips. The energy streaks travel on the selected surface. Layered effects can attach native PRE2 particles, ribbons, team glow, SPL or UBR marks. Position & size uses EMTR’s handles. An impact, birth or death cue can play during a chosen clip. Search accepts terms such as “weapon trail”, “debuff” and “spawn”.

## Decisions from animated review

- On the straight Khorne blade, red lava overwhelmed weak additive streaks. Streak presets now start with a replacement material and a distinct moving core. An explicit user choice of Apply mode carries between cards.
- On the Nurgle hook, the whole-geoset UV range lit a detached tooth and missed most of the weapon. An energy streak now fits the length of each connected indexed piece. An overlay retains the authored base UVs. The renderer uses the UV set named by each layer.
- For paired pauldrons, the combined bounding-box centre put several accents inside the chest. A body accent now starts on an exterior vertex carried by its attachment bone. Ground rings use the model origin. Ribbons reuse the EMTR weapon-strip fit.
- The Nurgle weapon has no local visibility keys in Attack. A geoset defaults to visible in an empty clip, but a ribbon defaults to hidden. Only the generated ribbon receives a held visibility key in that clip. The original mesh and its authored fades keep their keys. The packaged motion check requires live ribbon segments, including on the Nurgle hook. After an MDX round trip, the native renderer had 11 and 7 segments on the two frost lines at 290 ms into Attack, on both Warriors.
- Ground seals use a blend suited to their real alpha channels. Sparse sparks, falling leaves, a moving core and a fading trail use different lifetimes. A burst retains its positive squirt key until the end of the cue, so a short render step cannot miss the intended emission window.
- Rime trail uses two fine frost lines at separate positions on the fitted blade. Coalbrand, Wraith trail and Viper trail use additive-alpha blending so their native masks fade into the scene without dark polygon edges.
- The Water Elemental’s native Stand layer values are retained, including the half-strength second layer. Cropped native sprite sheets, counter-rotating UV layers and game-defined ground marks add motion without exporting or synthesising artwork.
- Cloud shimmer, Sacred edge, Venom edge, Starfield, Falling water and Moon well swirl were removed after comparison. The original and revised palettes, placements and materials were inspected on animated models.

## Implementation

- `src/visual-effect-recipes.js` holds the native ingredients and timing. `src/visual-effect-composition.js` turns these into actual MDX texture tracks, materials, emitter graph nodes and events. `src/surface-effects.js` applies the selected mode and handles model resource reuse.
- `app/SurfaceEffects.jsx` owns the existing window. `app/VisualEffectStage.jsx` reuses `ParticleStageTools` and updates the small attached effect on a drag. Slider drafts commit on release. Thumbnails load lazily in a window-owned queue.
- Fire wisps and Water droplets remain individual reviewed EMTR entries. FX uses EMTR’s graph importer for preset accents. The artist can choose the individual ingredients and timing directly in EMTR.

## Slider measurements from the first audit

Model preparation measured destination cloning and applying Water skin. The old implementation did this per input event. The release-only control performs zero builds while dragging and one on release. Medians and p90 values use twenty samples after four warm-ups.

| Permanent fixture | Before, each input (median / p90 ms) | During drag now | After, once on release (median / p90 ms) |
| --- | ---: | ---: | ---: |
| Footman | 7.35 / 8.91 | 0 builds | 4.20 / 5.15 |
| Tzeentch Sword04 | 17.61 / 19.20 | 0 builds | 10.26 / 11.61 |
| Khorne Flail03 | 14.06 / 17.87 | 0 builds | 7.66 / 9.25 |
| Hero Tinker | 35.94 / 39.36 | 0 builds | 32.68 / 34.31 |

## Verification

- The fail-first library check found both retired eye cards on the previous package. The previous renderer differed at 6,420 pixels for two equivalent UV sets on the Nurgle fixture. The corrected renderer gave identical pixels with a 6,420-pixel difference for the negative control.
- The packaged motion review captures three playback frames and uses an actual mouse orbit for each look. The main set uses the Khorne and Nurgle Warriors. A second set changes the part or model and includes Footman impacts.
- The workflow tests cover picking a surface, staged slider and handle drags, all three Apply modes, colour swatches, picker value, preset reset, the original comparison, applying every card and restoring the full model in one Undo. The fresh-window check reopens a widened native ribbon and a timed impact with its ground event.
- The permanent model collection supplies the fixtures through `test/helpers/fixtures.cjs`. The desktop review, reports and selected captures are outside the source tree under `D:\Codex\mdlxl-visual-lab-review`. Screenshots for the PR live under `test/evidence/visual-effects/` and are excluded from packaged runtime files.
- The Windows package built and verified 1,383 runtime and asset files. Compatibility passed 57/57. The full source suite passed with nine host or fixture skips. The 87 focused FX, EMTR, hotkey, localisation and slider checks all passed.
- Nine focused desktop/browser checks passed, including native EMTR placement on the Footman, fitted ribbons on the Blademaster and the material manager’s native colours. A separate shield check tried three looks on Nurgle geoset 7. The two Warrior review files still match the permanent fixtures byte for byte.
- Three of the source skips are host-specific (POSIX signals, Windows symlink rights and DOS short names). Six need optional reference models or manifests. The deleted original archer is one of these. Its documented packaged material test passed using the current substitute.
- Warcraft III engine playback and owner visual acceptance remain open.

## Revisions

The first prototype checkpoint was `4d84756d`. The initial main merge was `7abe7a35`. The reviewed Warrior build and its timing audit were checkpointed before the second main merge at `03133420`. The 0.37.2 package version stays unchanged for this feature.

Session: codex Visual Lab effects second pass
