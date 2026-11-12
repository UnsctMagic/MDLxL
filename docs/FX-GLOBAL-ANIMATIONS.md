# FX contract: the Global Animation Maker

Owner-defined contract for PR #492, updated from the complete 1 November 2026
owner hand-test round. That round supersedes the earlier promise to keep every
card. The owner allocates another 15% to these corrections and visual quality.
Each note is an example of a general rule: apply it everywhere it fits. If an
intention is still unclear, choose what fits, keep working and list the decision
as a question in the PR. No merge or release in this round.

## Intention and scope

FX gives parts of the user's own model permanent, adjustable animation: a burning
sword, glowing runes, flowing water, solid ice, lava and flies. Global sequences
run independently of Stand, Walk, Attack and Death. The model carries the result
without triggers, abilities or map scripts.

Keep the terrain and buff/curse looks. The owner retired the entire Impacts folder and its six cards in the third hand test. Models with an existing Attack effect keep their native data and saved layer list.

The owner kept 13 of the 30 candidates after the fifth hand test. They are filed in the existing folders. Previously saved looks remain editable, including retired entries. Ice skin contains Dark ice and White ice as finish options. Auras and Impacts are retired.

| Folder | Accepted looks |
| --- | --- |
| Terrain | Basalt skin, Void shale, Carved cairn, Moon mosaic |
| Skins | Briar binding, Living ink, Tide etching |
| Blades | Thorn script, Rift seam |
| Buffs & curses | Eclipse brand, Soul lantern, Astral chart |
| Around the unit | Sanguine drip |

Basalt skin, Briar binding, Carved cairn, Moon mosaic and Eclipse brand start as overlays. Black stone and Vine weave are stationary surfaces. Briar binding offers the Spore bark finish as an initially disabled surface; its spores are available from Add emitter. Living ink starts with the clouds alone. Ink seal remains an addable ingredient. Basalt skin's Heat seams start at 40% intensity and RGB 82, 34, 16. Soul lantern's Soul seal starts with the rotation, scale and position recovered from the owner's fifth-round UV screenshot.

Studying aura models teaches texture and alpha animation; it does not authorize
adding aura rings to Rune blade. Rune blade means glowing glyphs on the blade.

## Layers and native fields

A preset with nothing but emitters starts with its first own emitter already added; every other new library preset starts without Particles layers. Particles → Add emitter lists that preset's own emitters first, in their original order, with only the first labelled `(recommended)`, followed by the other existing ingredients. Choosing one uses the original native values, fit and controls. Presets without their own emitters mark none recommended. Saved stacks keep their existing emitters; retired impacts and ribbon layers are unchanged. The Lightning surface burst controls stay removed. This 2 November decision supersedes earlier default-emitter descriptions below.

Every ingredient is a listed, selectable layer with an on/off switch. Emitters and
ground pieces are independent. Ground seals and rings start **off**, including
Recall seal's ground aura. Reopening an applied part restores its layer list and
current values. An unchecked layer is stored only as an editor choice. Do not resolve
its assets or write its native emitters, nodes, materials, clocks or geometry; remove
its unreferenced resources if it was previously applied. Apply updates that stack; it does not append duplicates. One Apply
is one Undo step. Removing a layer removes only its owned resources.

| Layer | Native data |
| --- | --- |
| Moving skin | Material layers and texture animation on the selected surface |
| Glow | Material alpha and geoset colour, pulsing on a global sequence |
| Rune | Native rune glyphs on the surface; optional ground seals are separate, disabled layers |
| Particles | Native PRE2 emitters and any nodes needed to carry their motion |
| Edge | Native ribbons fitted to the part |
| Card | Flat quads with one native texture, each on its own owned bone, in one owned geoset and one single-layer material |

No new types without asking the owner.

11 November 2026: the owner asked to be able to "create anything of the models I showed
you" in FX. That request is the permission for the sixth type, **Card**: one owned geoset
holding the layer's quads (1–8 along the part, or stacked on the ground), one owned bone
per card (billboarded when it faces the camera), one owned material with one layer (Add,
Unshaded, Unfogged, two-sided by default). Size pulse, spin, jitter and the atlas flipbook
each run on owned global sequences; several cards use different, non-dividing lengths
(loop × 1, 1.133, 1.2, 1.3 …). Position and size are dragged with the emitter handles.
Fields and bounds live in `src/fx-cards.js`. Removing a Card stack leaves the model as it
was before, including its bounds.

12 November 2026: the owner's Card permission of 11 November together with "fly swarm - doesnt
look good ... make it scaleable" covers the Fly swarm's owned quad geoset, bones and material
(below, under the native implementation routes). It is a Card-like set of quads on path-driven
billboarded bones and stays listed as the existing Particles ingredient, Orbiting flies.

A particle layer exposes all three native segment **Color**, **Size** and
**See-through %** values in EMTR's **Born / Halfway / End** control. Do not collapse
multi-value native fields to one value. Reuse the actual EMTR component, wording,
picker and behavior, not a lookalike. Each ingredient has one editable colour and Reset restores that ingredient's initial tint. Omit palette swatches and preset names. Keep
**Open in EMTR** for the full emitter editor.

Use EMTR's own controls and handles for placement, size, ribbon ends, lifetime,
amount, gravity and timing (`ParticleCluelessControls`, `ParticleRibbonFields`,
`ParticleStageTools`, `ParticleTimingTool`). Texture fitting reuses the Texture
Animation Manager and UV controls. Do not invent another control scheme.

One Loop length (milliseconds) drives a permanent stack. Extra global clocks are
allowed only when the look needs them; retain ownership and reuse equal durations.
Use the grouped Add layer menu for surface ingredients across all accepted presets. Every preset also has a Particles field with an empty Add emitter choice. Selecting an emitter only previews it (5 November owner request): it shows in the preview but not in the layer list, a new pick replaces it, the empty choice removes it, and **Add** keeps it as a layer through the same layer builder. Apply includes a previewed emitter, so Apply matches the preview. The empty choice allocates no native objects or assets. A layer can use a different native texture from the existing texture library. Particle layers can also change emitter while keeping their placement. Artists can combine different light shapes, rune glyphs, sparks, mist, moving textures and ribbon edges on the same part. The rune UV map opens with its native image and the vertex editor's Move, Rotate and Scale icons. M, R and Z select these tools inside FX.

Create as overlay keeps the original material visible and draws the effect on separate geosets fitted to the same surface and skin. With the switch cleared, the effect supplies the visible surface. Only stacks containing a surface ingredient offer the choice. Persist it through Apply and MDX/MDL reopen.

Intensity belongs to the selected ingredient. Show its level, preview its own material during the drag and commit on release. On particle layers it scales the three-stage opacity together. Verify the rendered change without changing sibling passes or emitters. Live gestures update at most once per display frame
and update only what changed. Every control must make a clear visible difference
through its range; inspect minimum, middle and maximum. Maximum Intensity must
produce a clearly strong glow without erasing the model's shape.

## Placement and model preservation

With two or more geosets checked in the editor, the Geoset dropdown starts on **Selected geosets (n)**. The effect is fitted to them as one surface and drawn as one overlay; the geosets themselves stay separate. Create as overlay is locked on for this choice. Picking one geoset in the dropdown returns to fitting that geoset alone.

Fit the whole selected part as it is drawn in the current animation, on any model.
A blade effect covers hilt to tip; particles originate on its actual surface.
Separate pieces sharing one geoset may use different bones. Do not fit their
combined empty space and parent the result to one dominant bone. Preserve each
region's skin binding, including blended weights. Test every sequence, not only a
rest pose. Surface copies retain the original triangles and skin weights.

Permanent regression: `WH_WOC_WarriorSlaaneshDual01.mdx` in
`D:\Claude\MDLxL-TestModels`, displayed geoset **29 Â· EredarPurple**, Flaming sword.
The owner saw flames beside the body. Cover Stand, Walk and Attack in captures.
Read this fixture through `test/helpers/fixtures.cjs`; never edit or delete it.

Added nodes belong to their layer, have plain names and follow the selected part.
New effect motion uses global sequences. Previously saved impacts keep their Attack interval. A blended
skin attachment may carry derived pose-following keys, without changing the
model's authored nodes, sequences or timing. Keep those keys limited to attachment
motion, and measure their position against the shared skin evaluator.

Use native game textures and data. Do not export, paint or generate replacement
textures. Keep only geometry, materials, textures and nodes the layers need.
Preserve independent edits made in EMTR and the material/node managers when an
unrelated layer changes. Save/reopen as both MDX and MDL must retain native results
and the editable grouping. Removing editor metadata must keep the native effect.

## Visual targets

Judge at ordinary game camera distance as well as close up, in motion.

| Look | Target |
| --- | --- |
| Flaming sword | Fire comes from the whole blade, follows its pose and trails briefly behind a swing. The blade still reads through the fire. All three particle colours edit directly in FX. Sparks and embers are visible at default Amount, including on both blades of a dual wielder. |
| Frost blade | Pale fractured ice moves across the blade with white mist and brief glints. |
| Lightning blade | Use the surface defaults from `44f8c6c8`. Storm steel and Forked arcs start enabled; Blade arcs starts off (owner, 11 November). Use the original replacement material by default. The Particles choice starts empty. The Blade arcs surface has no direct burst-duration, burst-interval or flash-count controls. |
| Arcane | Two energy layers cross on two clocks with a violet/blue colour beat; a spinning star card and a few glow orbs. Narrow highlight is offered, off. |
| Runes | Show the native glyph in the UV editor. The three icon tools position it. Runes and Glowing runes start with a slow colour beat at constant light; Thorn script keeps its glow with a slow colour beat. |
| Water | Running water with a soft sheen on a shorter clock, and visible drips: drops form along the part and fall with streak tails. Crossing currents crosses a highlight on a 0.66x clock over the surface. |
| Rift seam | A dark underlay, the crack moving slowly between two colours, softly crackling zap cards; the splinters keep their values and start off. |
| Ice skin | One Dark ice / White ice selector, with White ice selected for new stacks. Keep the accepted dark striations. White ice uses native Northrend frost and fractured ice. Falling mist is available in both finishes. |
| Fissures skin | The accepted Lava fissures surface replaces Lava skin in Skins. Fire is an independent layer, off by default. |
| Glowing skin | The original texture glows in the chosen colour. Maximum Intensity is visibly strong. |
| Poison skin | Build from Felwood poison and its native poison tileset texture; it reads as poison. |
| Fly swarm | Made the way native `Flies.mdx` is made: separate dark flies with transparent corners glide on different closed paths around one centre, never a ring of particle dots. It looks right on any part without touching a control and scales with Amount, Fly size, Swarm size and Speed. |
| Motes / Rising embers / Frost mist | Distinct drifting points, rising sparks and falling mist respectively. |
| Glacial fissures | Cold cracks brighten over a solid ice surface. The part remains visible through the whole pulse. |
| Buffs & curses | Keep the good looks. Every emitter and ground ingredient is optional; ground starts off. |

## Library quality rules (11-12 November 2026)

The study of hand-made native effects (section 2 of the study kept outside Git) set these
rules for every look in the library. `test/fx-look-quality.test.js` checks the general ones
over every look and variation.

- **Own clocks.** Every moving layer runs on its own clock, and the lengths never divide
  each other (sets such as 1000/1133/1200/1300 ms, or the look's loop x 0.66, 1.133, 1.333).
  A layer's own Loop length is an explicit field on the look; surfaces, Cards, Edges and
  native emitters can carry one. No two moving layers of a look share a clock.
- **Nothing flashes (owner, 12 November: "I hate flashing things").** No preset may strobe:
  no light that drops to near zero and comes back, no hard on/off alpha, no bursts, no
  flipbook faster than 100 ms a frame, no card size throb faster than 0.4 s or wider than
  45 %. Flicker, Flash, Lightning, Double pulse, Pulse and Fade stay only on the layers that
  carried them before 12 November; Uneven beat is used by no preset. New glows use Soft
  pulse (alpha .78-1); runes and cracks use Colour beat: a slow change (1.5 s or longer)
  between two colours of the same brightness (luminance within 0.8-1.25). Lightning-type
  looks crackle softly: zap cards jitter in angle, never in brightness.
- **Emitters of existing looks keep their values.** The quality pass does not change a
  look's emitter (texture, timing, alpha, frames, rate). The one exception is Water's
  Dripping water, which the owner asked to make visible. New looks bring their own emitters.
- Steadiness is measured, not judged: `out/fx-review/fx-measure.cjs` samples the preview
  36 times about 100 ms apart against the Original view; an existing look may not swing
  more than it did before, and a new look's largest step stays small.
- **Emissive layers** are Unshaded and Unfogged; glow overlays are lifted about .3 off
  the skin. One pass per material, two (Add alpha + Add of the same texture) for extra
  bright; the owner's Glow look keeps its 400 % start.
- **New flame and ember emitters** (Fire column, Lingering embers) hold alpha 255>255>0 with
  the middle at half life, a cooling colour ramp and shrinking particles; embers are few,
  slow and long-lived (alpha 200>150>80). Fire's Blade flames keep their own values.
- **Ribbons** are Add with a steady alpha (about .5); orbiting ribbons ride three helpers
  on clocks that never line up. Switching Orbit on gives a loop clear of the part.
- **Water** runs two frame speeds: the highlight on a clock about 0.66x the surface.
  Water's drips are large enough to see, fall with gravity and draw a short streak tail.
- **Amount is shared among a weapon's worth of sites (owner, 12 November: Falling mist "on a
  body it just flashes").** A part with up to four skin regions keeps one set of emitters per
  region, unchanged. A part with more regions (a body: the Footman's has 27) places
  `count x 4` sites on its regions by length, instead of a full set on every region; before,
  the Footman body's 135 mist emitters each released one puff every 6 s. Every site now keeps
  the density of a four-region weapon (about 1.3 mist particles in flight). Bursts and flies
  are not split this way. `test/fx-mist-steady.test.js`.
- **Sizes follow the part's main piece.** Emitter, card and orbit sizes come from the
  longest skin region of the selected part (before 12 November the first region, which on a
  Footman body was a small piece, so its mist was a few units wide).
- Native game textures only; every folder, look, variation and layer name is translated
  in all five catalogues. Applying and then removing a look leaves the model exactly as
  before; every look survives MDX save and reopen as the same editable stack.

New looks from these techniques (`src/fx-technique-looks.js`), filed in the existing
folders and one new folder, Light:

| Folder | Looks |
| --- | --- |
| Fire | Burning cracks (crack shell with a slow ember colour beat, lingering embers), Fire column; Flame cards offered in Fire, Fel fire, Burning cracks and Fire column |
| Ice | Lit crystal (Inner light / Team colour core) |
| Water | Liquid body (two frame speeds and glint cards) |
| Lightning | Lightning cage (jittering zap cards, orbiting arcs) |
| Arcane | Energy flow (two crossing scrolls), Rune circle (ground rune card over a shadow disc, contracting rune rings) |
| Light | Glow shell, Star flare, Glow orb, Eye glow (two small cards to drag onto the eyes) |
| Death & spirit | Ghost trails, Soul vortex, Dark smoke, Hollow shell |
| Build your own | Tint (Colour wash / Team colour) |

Glow shell's shell layer shows **Thickness** in its main controls (owner, 12 November: "Glow
shell - add thickness"). It is the layer's Lift (`inflate`, model units along the normals), so
that layer shows it once and not again under More. The range runs from 0 to a tenth of the
part's length (`shellReach`), so a sword and a body both get a visible range. The look-only
spec field `shell` marks the layer and is never saved.

Ground glow is retired (owner, 12 November: "remove ground glow"): a look missing from
`LIBRARY` is not listed, counted, searched or offered under Add layer, but a model saved with
it still opens and edits, like Ice skin, Water skin and Thorn script.

Look-only spec fields read by `makeLayer` and never saved: Card `fit` (share of the
part-fitted size; ground cards fit the unit's footprint), emitter `scale` (multipliers of
the part-fitted size, speed and gravity), and Edge `orbit` (starts as Orbit switched on).
Saved stacks made before per-layer editing compile byte-identically.

The good terrain looks are the quality bar. Reuse their technique when it produces
a better skin, including Felwood poison. Do not preserve a weak card merely to
keep its count.

## Native implementation and regression routes

- `partFrame` divides disconnected skin bindings before fitting. Coincident seam
  vertices have no span and do not produce an emitter region. The original
  surface is never deleted. The Slaanesh private regression measures both weapon
  bindings and blended attachments against the shared skin evaluator in every clip.
- Rune blade offers the Icecrown obelisk strip and three distinct native demon rune
  textures. Move, Rotate and Scale use the existing UV editor and affect only the
  generated surface, not the authored weapon UVs.
- Falling mist uses Freezing Breath’s additive weather cloud and its 0–12 / 13–25
  atlas phases. Ice skin uses a fixed section of Ice_Natural01. Glacial fissures
  keeps Ice_IceDull behind the Dungeon2 crack tile; only the cracks pulse.
  Poison skin continues to reuse Felwood poison.
- **Fly swarm (native Flies.mdx technique; owner, 12 November 2026: "fly swarm - doesnt look good
  ... make it scaleable").** Flies are geometry, not particles: one owned geoset holds one quad
  per fly, each quad entirely on its own owned billboarded bone (bone flags 264), under one owned
  swarm bone at the part's centre that follows the part without tilting (Don't inherit rotation).
  One owned material with one layer: Transparent (alpha key), two-sided, lit, priority plane 0,
  native `Textures\Doodads0.blp` cell 151 of 12 rows x 16 columns. Each fly rides one of the five
  native Hermite paths (`FLY_PATHS`, unchanged) as a closed translation track on an owned global
  sequence. Flies come in sets of five; each further set (`FLY_SETS` in `src/fx-cards.js`) has
  its own clock, yaw, time phase, width and height, so Amount above five never stacks flies and
  the swarm never visibly repeats. Clocks are `1233 x sqrt(radius / 88) x [1, 1.16, .89, 1.05, .95,
  1.11] / Speed` ms, all different. Five fly widths per set: Fly size x [.77, 1.12, .78, 1.47, .87].
  Defaults: Fly size is 7% of the unit's Stand height, kept within 10-22 units; Swarm size (the
  mean path radius) is .9 x the main skin region's radius or .3 x its length, never less than four
  fly widths; a part split into many skin regions still gets one swarm around one centre. Controls:
  **Amount** 5-30 in steps of 5, **Fly size**, **Swarm size**, **Speed** (0.25-4x, multiplies every
  clock), colour (geoset colour, default no tint) and **Intensity** (layer alpha); the swarm is
  moved and resized with the emitter placement handles. Flies are always visible while the layer is
  on (no Death rise, no portrait hiding). Removing the swarm restores the model exactly, bounds
  included; it reopens from MDX and MDL as the same editable stack (`test/fx-fly-swarm.test.js`).
  **Compatibility:** a layer saved with the old emitter flies (no `swarm` field) keeps its emitter
  flies and their old controls and compiles byte-identically; picking Fly swarm or Orbiting flies
  fresh from the library, Add emitter or Change emitter gives the new swarm. A saved own look keeps
  whichever kind it was saved with.
- Moving skin **Speed** takes fine values from 0 to 8 (step 0.05; owner, 12 November: slow
  skins must still move). Whole speeds run that many passes on the layer clock, as before; a
  fractional speed runs the next whole number of passes on a longer owned clock, so a pass
  always wraps seamlessly. Frame flipbooks, atlas excursions and native cards follow the same
  rule, and the value reopens unchanged from MDX and MDL (`test/fx-skin-speed.test.js`).
- Maximum Glow uses up to four additive native material passes, with a fractional
  final pass. Intensity therefore changes continuously and survives reopening.
- The six retired Attack recipes can be read from saved stacks. They are excluded from the library, folder counts and search.

The source checks include `test/global-animations.test.js`, `test/fx-sort.test.js` and the private real-model
`test/manual/fx-owner-round.test.js`. Hidden packaged checks are
`test/fx-empty-emitters.electron.cjs`, `test/fx-layer-editing.electron.cjs`, `test/fx-lightning-bursts.electron.cjs`,
`test/fx-owner-followup.electron.cjs`, `test/fx-owner-round.electron.cjs`,
`test/fx-owner-motion.electron.cjs`,
`test/fx-owner-intensity.electron.cjs` and the existing FX/save/UV/library workflows.
The motion harness accepts comma-separated `FX_MODELS`, `FX_LOOKS` and `FX_CLIPS`.
`FX_PART` is zero-based in the harness and one-based in reports. The intensity
harness also accepts `FX_MODEL`, relative to the permanent test-model collection.
The packaged save/reopen harness accepts `FX_LOOKS` for testing a batch in one app session.

## Window and text

Same FX window, size, preview and controls. Replace the mixed starter buttons and
large cards with one compact library: grouped folders, a small native icon or
thumbnail and name for every entry, plus search. Reuse the game-file model
library's components and style (`GameFileBrowser.jsx`, shared `GameIcon.jsx`).
No new panel, tabs or toolbar. Global looks and retained cards share this list.

**Highlight geoset** sits at the top beside the Geoset dropdown and highlights the
chosen part. **Double-click** a surface to select it; update the hint. Normal
mouse camera rotation remains available. Choices, edits and animation changes
preserve the user's view; only opening a new subject or Fit may frame it.

No effect descriptions or flavour lines in cards, tooltips, hints or status text.
Use names and short functional labels. Only an ambiguous control needs a short
plain tooltip, such as "Milliseconds for one full loop". No imagery or adjectives.
The following is also an Essential constraint in AGENTS.md:

> No flavour text. UI shows names and short functional labels only; do not write descriptions, slogans or atmospheric copy unless the owner asks for that text.

## Human-eye review and acceptance

Every remaining and added look, and every changed control, is judged by eye in
motion before being reported done. Passing structural tests is insufficient.

1. Use the Khorne Warrior, Nurgle Warrior and Slaanesh Dual Warrior, plus straight
   and hooked weapons, small infantry, a hero and a large body. Fit rules must be
   general. Compare relevant native game examples.
2. In the packaged app on the **hidden desktop**, capture game distance and a close
   mouse orbit in Stand, Walk and Attack, across a complete loop including wrap.
3. Check recognition within a second, coverage, attachment while moving, loop
   continuity, sorting, transparent edges, stretching, contrast and preserved model
   silhouette. Inspect minimum, middle and maximum for controls. Fix and recapture.
4. Use real mouse clicks/drags for the library, Highlight, double-click selection,
   camera rotation, placement and timing. Undo and save/reopen both formats for
   every remaining look/card, including disabled layers and later re-editing.
5. For the 2 November empty-emitter change, run only the related FX tests plus CI
   against the unchanged known-failures baseline. Follow TESTING-RULES.md, including fail-first evidence.
   Claude's independent QA gate still applies before any merge.
6. Owner click-through: Slaanesh flames fit; three colours edit; runes are glyphs;
   ice reads as solid ice without crystals; poison uses the tileset; maximum glow is strong; flies have no
   black corners and Recall seal has no ground aura by default. Check the 15 filed looks, optional spores and seal, per-layer intensity during a drag, texture and emitter changes, the three UV shortcuts and both surface modes.

Work only under `D:\Codex`. Owner checkout, models, game files and installed MDLxL
are read-only. Never delete anything from `D:\Claude\MDLxL-TestModels`. Clean task
builds/profiles and stop task processes after verification. Keep a few final PR
images and the small report. Continue `codex/global-effects-local`, push to PR #492,
update its short plain description (changes, every removed card, open questions,
unverified Warcraft III playback), report to the owner and stop. No merge/release.
