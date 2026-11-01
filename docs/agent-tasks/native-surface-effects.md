# FX global animation maker

The [owner’s contract](../FX-GLOBAL-ANIMATIONS.md) governs the FX window. Branch `codex/global-effects-local` continues in [PR #492](https://github.com/UnsctMagic/MDLxL/pull/492).

## Third hand test · 1 November 2026

Continued from `75a440f0`. The owner accepted the teal Ice skin, requested a white variation and retired all six Impacts. The top `sort` folder holds 30 candidates for their next review. The revised native textures, layer choices, overlay and UV workflow are specified in the [FX contract](../FX-GLOBAL-ANIMATIONS.md).

- Compared the Knight and Impaler Tzeentch Spell emitters. Both use `Textures\LightningBall.blp` at 33 particles per second and 0.4 s lifetime. Lightning blade uses their native sprite with shorter travel, on each independently skinned blade. The game archive supplied all 82 distinct texture paths used by the library and its addable ingredients.
- The previous build failed the 30-candidate check (`0 !== 30`) and the packaged check that the textured rune UV is immediately visible. In the review build a mouse dragged each of the three editor tools. A zero-opacity image comparison on Slaanesh geoset 29 distinguished overlay from replacement. Reopened older attack stacks retained their native hit records.
- Reviewed all 61 looks in Stand, Walk and Attack on Slaanesh, including loop wrap, game distance and a closer mouse orbit. Reviewed all candidates on Nurgle's shield as well. Adjusted seven candidates after playback. Phoenix quill's first feather had visible square corners. The replacement passed a fail-first transparency check and a second motion review on all three Warriors. [Watch the 30 candidates](../../test/evidence/visual-effects/sort-round.webp).
- All 61 looks passed packaged MDX and MDL save, reopen, re-edit and exact Undo (122 round trips). For 60 looks the saved MDX and MDL bytes were identical between their reviewed build and delivery build `b7affa92`. Phoenix quill passed both round trips directly on that build.
- On the hidden desktop, `fx-owner-intensity` exercised 50 surface-layer sliders at minimum, middle and maximum. `fx-owner-motion` also replayed five representative looks on the Footman, Paladin and Abomination in all three clips. `fx-owner-followup`, `fx-owner-round`, `surface-effects`, `surface-effects-warriors`, `global-animations`, `uv-controls` and `uv-rotate-steady` exercised picking, editing, mouse orbit, EMTR transfer and the shared UV editor. `visual-effects-save` covered both formats.
- Windows passed 2,718 source checks, 57 compatibility checks and 13 real-model FX checks with 0 failures. The seven existing source skips cover POSIX signal handling, Windows symlink privileges, a volume without 8.3 short names, the private archer fixture, the skin-collapse model pair and two checks of the original pose corpus manifest. The known-failures baseline is unchanged.
- Which `sort` entries should stay is open for the owner. Warcraft III playback and independent QA remain outstanding.

## Second hand test · 1 November 2026

Starting point: `ae13c9ab`. The owner rejected dark frost mist, sparse sparks,
crystal ice and translucent Glacial fissures. Rune blade must offer glyph,
position and glow choices. Lava fire is optional. Attack bursts belong on the
striking weapon or creature limb regardless of the geoset the user clicks.
See the updated feature contract for the current requirements; the prior
results below describe the earlier package.

Verified on the isolated Windows build of `36934bd1`:

- [Packaged playback](../../test/evidence/visual-effects/hand-test-2.webp): white
  Freezing Breath mist, sparks, embers, a chosen rune, optional lava fire,
  striated natural ice, pulsing fissures and Attack bursts on a weapon and a
  creature. Also inspected Stand, Walk and Attack captures on all three Warriors.
- At default Amount on Slaanesh geoset 29, both weapons had at least two live
  sparks/embers in 80/80 measured frames after warm-up (old sparks: 14/80).
  Old saved frost used normal blend rather than additive. The two revised ice
  looks retained the original material and all original foreground pixels in a
  paused Footman comparison at an 18/255 background threshold.
- The old package had no rune selector. Hidden follow-up controls verified four
  art choices, steady and animated glow, UV drag, optional fire, independent
  contact from different selections, and a size drag that cannot move the hit.
  The owner controls and global FX/EMTR workflows also passed.
- Without a marker the hit frame is an estimate: a manual timing adjustment
  resamples the strike. On the Dire Wolf the first Attack reaches with its muzzle,
  the second with a forelimb. MDX has no knowledge of a live victim or damage event.
- **2,690 source passed, 0 failed, 7 skipped** (same documented private fixtures
  and Windows conditions as below). **74 focused** and **57 compatibility** checks
  passed, none skipped. All 36 looks passed 72 MDX/MDL round trips with re-edit and
  exact Undo on the hidden desktop. Renderer art and saved native records were
  unchanged by the final resize-handle restriction, verified on the owner package.
  Checked-off then disabled layers left no extra native records in either format.
- No further cards removed. Optional ground decals are no longer offered on impact
  cards. The independent QA, owner's final visual review and in-game playback are
  still open. No merge or release.

## First hand-test round · 1 November 2026

Continues `46ff2fa900147c540492e27bfc3ad4e7bbe09255` on the same branch and PR.
The complete owner contract is folded into the feature guide. This round removes
34 earlier cards, keeps 17 earlier cards as editable layer stacks, retains the
17 global starters and adds Crystal veins and Felwood curse: **36 looks** total.
No merge or release is authorized. Claude's independent QA and owner acceptance
remain before merge.

Slaanesh displayed geoset 29 has two 110-vertex weapon bindings (bones 19 and 22).
The former combined frame/parent 19 caused the displaced flames. Fits now follow
each skin region, including blended attachments; original surface weights stay
unchanged. Coincident native seam vertices no longer crash FX. EMTR's own LifeTable
exposes all three colours, sizes and transparency values directly in FX.

The library shares GameIcon/GameLibraryRow, with visible folder arrows, native
icons, search, Highlight geoset and double-click selection. Ground pieces start
off. Impacts use local Attack timing at the selected weapon's far end. Rune blade
uses glowing native surface glyphs; Ice/Poison reuse the liked terrain recipes;
Fly swarm uses native paths and a corrected transparent sprite; Glow reaches four
continuous additive passes. The feature guide records the exact native sources.

Verified in this round:

- Full source: **2,690 pass / 0 fail / 7 skip**, unchanged empty failure baseline.
  Skips: Windows SIGTERM behavior; exact private Archer fixture; private broken/
  rebuilt skin pair; two pose-corpus-manifest tests; Windows symlink privilege;
  volume without 8.3 short names. Available private Fx, Nurgle merge and large-pose
  performance fixtures were enabled. Missing private pairs were not substituted
  with unrelated models.
- Focused FX/owner/source: **62 pass / 0 fail / 0 skip**. Compatibility:
  **57 pass / 0 fail / 0 skip**.
- Hidden packaged owner controls, global animation/EMTR workflow, surface smoke,
  Warrior workflow, UV comparison and shared game-file library pass. The library
  harness now uses real clicks and camera readiness; hidden status-bar strings
  are replaced by unchanged-model/material-count assertions. Camera comparison
  retains numeric tolerance for the observed 2e-14 rounding difference.
- Every look: exact single Undo and **72 MDX/MDL save/reopen/re-edit round trips**.
- Animated review: all 36 looks on Khorne in Stand/Walk/Attack; the eight owner
  priorities on all three Warriors; six body looks on Footman, Paladin and
  Abomination. All 36 Intensity ranges were exercised at min/middle/max; final
  whole-body Glow and Rune ranges were also inspected. Two compact animated
  captures are under `test/evidence/visual-effects/owner-round-*.webp`.

Fail-first evidence: the starting revision failed both weapon bindings, native
life fields and disabled-layer regressions; the hidden starting package exposed
0 Born-colour controls instead of 1. Additional regressions first failed for a
normal-frame Attack burst, coincident native seam groups, and hidden library
folder SVGs. Obsolete ring-handle/card assertions were replaced because those
cards and controls were explicitly removed by this contract, not to hide failures.

Rune review distinguishes actual model parts: Slaanesh face 28 versus purple edge
29; Khorne face 17 versus flame edge 19 and handle 16 (all displayed one-based IDs).
FX always affects the selected surface. The final native glyph strip remains
legible on the blade faces and follows the authored skin through motion.

Open questions for the owner: is the native Icecrown glyph strip the desired rune
style? Are event/weapon-speed inferred hit times suitable defaults where the MDX
has no gameplay attack-point data? Both are editable. Warcraft III map playback
and the owner's final visual acceptance are unverified.

Working copy was isolated on D:. Owner checkout, game, models and installed app
were read-only. Small final report: `D:\Codex\mdlxl-492-owner-round-report`.
Disposable builds/profiles and the pushed working copy are removed at handoff.

The historical rounds below do not establish acceptance of this round.

## Global animation maker · 1 November 2026

Select a model part and choose a look from Blades, Skins, Around the unit, or Your textures. These 17 starters sit above the 51 earlier cards. Select a layer in the right column to adjust it, drag its position or size, or open its emitter in EMTR. One Apply writes one history entry. Selecting a saved skin or rune resolves to its original part. Reopening a stack reads back native emitter settings, material colour and intensity, and simple texture speeds. Independently edited tracks survive changes to another layer.

- One loop drives the stack during Stand, Walk, Attack and Death. An equal existing clock is shared. Each fly has its own phase, tilt, direction and number of turns inside the common period.
- Short-lived fire comes from several points along the blade. The points follow its actual faces, including bends and separated pieces. Flames stay behind a moving weapon for a moment while the bright core stays on it. The rune mesh turns around a pivot under the existing part bone.
- Moving skins fit the material to each UV island. Separate water highlights cross the underlying surface. Moving own texture scrolls repeating materials and makes a short return movement on painted unit atlases. A dark crust and brighter, pulsing fissures give lava its contrast. Colour, strength, timing and placement remain editable.
- Native materials, texture tracks, bones, particles and ribbons carry the animation. MDL comments and the MDX `XLFX` chunk hold the editable layer grouping. The save window can remove that grouping while keeping the native animation. Independently tinted layers can require a copy of the selected geometry because classic geoset colour belongs to the geometry.

The [model checks](../../test/global-animations.test.js) cover every starter in both formats, shared clocks, independent adjustments and Undo. The [packaged workflow](../../test/global-animations.electron.cjs) exercises both blade ends, actual camera rotation, colour, loop length, rune and swarm handles, persistence and Open in EMTR.

The earlier review (superseded above for Rune blade and Water skin) covered all 17 looks on the Khorne Warrior’s straight sword, the Nurgle Warrior’s hooked weapon, a Footman, a Paladin and an Abomination. The 255 full-loop captures cover Stand, Walk and Attack at game distance and in close orbit. I also checked 28 controls or gestures at three settings and corrected flame lifetime, wing blending, hooked-blade placement and painted texture travel. The packaged regressions previewed, applied and undid all 51 earlier cards, compared UV sets and reopened two saved effects in fresh windows. The five animated PR images come from the packaged editor. The captures and review are under `D:\Codex\fx-global-review`. Playback inside Warcraft III remains unverified.

## Earlier card handover

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

## Earlier card verification

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

Earlier session: codex Visual Lab effects second pass

Session: codex FX global animation maker
