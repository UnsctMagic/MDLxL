# FX contract: the Global Animation Maker

Owner-defined contract for PR #492, updated from the complete 1 November 2026
owner hand-test round. That round supersedes the earlier promise to keep every
card. The owner allocates another 15% to these corrections and visual quality.
Each note is an example of a general rule: apply it everywhere it fits. If an
intention is still unclear, choose what fits, keep working and list the decision
as a question in the PR. No merge or release in this round.

## Intention and scope

FX gives parts of the user's own model permanent, adjustable animation: a burning
sword, glowing runes, flowing water, crystal ice, lava and flies. Global sequences
run independently of Stand, Walk, Attack and Death. The model carries the result
without triggers, abilities or map scripts.

The owner also keeps the good terrain and buff/curse looks and useful impacts.
An impact is the explicit exception to global timing: it plays in an Attack at
the hit moment, at the weapon's striking point. It must never default to a global
loop or the unit centre. Existing authored sequences and keys remain unchanged.

Remove the Auras category and all its cards. Remove weak duplicates and unrelated
birth/death effects. List every removed card in the PR. Add a small number of
looks in the style of the liked terrain, buffs/curses and Glacial fissures; each
must pass the same human-eye review. Reuse native recipes and existing app owners.

Studying aura models teaches texture and alpha animation; it does not authorize
adding aura rings to Rune blade. Rune blade means glowing glyphs on the blade.

## Layers and native fields

Every ingredient is a listed, selectable layer with an on/off switch. Emitters and
ground pieces are independent. Ground seals and rings start **off**, including
Recall seal's ground aura. Reopening an applied part restores its layer list and
current values. Apply updates that stack; it does not append duplicates. One Apply
is one Undo step. Removing a layer removes only its owned resources.

| Layer | Native data |
| --- | --- |
| Moving skin | Material layers and texture animation on the selected surface |
| Glow | Material alpha and geoset colour, pulsing on a global sequence |
| Rune | Native rune glyphs on the surface; optional ground seals are separate, disabled layers |
| Particles | Native PRE2 emitters and any nodes needed to carry their motion |
| Edge | Native ribbons fitted to the part |

These remain the five layer types. No new types without asking the owner.

A particle layer exposes all three native segment **Color**, **Size** and
**See-through %** values in EMTR's **Born / Halfway / End** control. Do not collapse
multi-value native fields to one value. Reuse the actual EMTR component, wording,
picker and behavior, not a lookalike. Presets remain starting points. Keep
**Open in EMTR** for the full emitter editor.

Use EMTR's own controls and handles for placement, size, ribbon ends, lifetime,
amount, gravity and timing (`ParticleCluelessControls`, `ParticleRibbonFields`,
`ParticleStageTools`, `ParticleTimingTool`). Texture fitting reuses the Texture
Animation Manager and UV controls. Do not invent another control scheme.

One Loop length (milliseconds) drives a permanent stack. Extra global clocks are
allowed only when the look needs them; retain ownership and reuse equal durations.
For impacts, expose the selected Attack and EMTR's Impact moment control. Default
to that Attack's hit time and the far end of the selected weapon. Both timing and
position are adjustable with the existing controls.

Controls commit on release. Live gestures update at most once per display frame
and update only what changed. Every control must make a clear visible difference
through its range; inspect minimum, middle and maximum. Maximum Intensity must
produce a clearly strong glow without erasing the model's shape.

## Placement and model preservation

Fit the whole selected part as it is drawn in the current animation, on any model.
A blade effect covers hilt to tip; particles originate on its actual surface.
Separate pieces sharing one geoset may use different bones. Do not fit their
combined empty space and parent the result to one dominant bone. Preserve each
region's skin binding, including blended weights. Test every sequence, not only a
rest pose. Surface copies retain the original triangles and skin weights.

Permanent regression: `WH_WOC_WarriorSlaaneshDual01.mdx` in
`D:\Claude\MDLxL-TestModels`, displayed geoset **29 · EredarPurple**, Flaming sword.
The owner saw flames beside the body. Cover Stand, Walk and Attack in captures.
Read this fixture through `test/helpers/fixtures.cjs`; never edit or delete it.

Added nodes belong to their layer, have plain names and follow the selected part.
Effect motion uses global sequences; an impact uses its Attack interval. A blended
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
| Flaming sword | Fire comes from the whole blade, follows its pose and trails briefly behind a swing. The blade still reads through the fire. All three particle colours edit directly in FX. |
| Frost blade | A cold sheen and occasional sharp glints; mist falls rather than rising like fire. |
| Lightning blade | Short irregular arcs along the blade, never a solid white shape. |
| Arcane blade | Energy flows along the blade with a pulse. |
| Rune blade | Glowing native rune glyphs on the blade surface, pulsing on the global sequence. No turning collars, rings or aura geometry. Find native rune-glow textures in CASC. |
| Water skin | Two continuous crossing currents with translucent highlights; preserve the part's shape. |
| Ice skin | Use the game's crystal texture with the Glacial fissures technique. It reads as crystal ice, never water. |
| Lava skin | Dark crust and pulsing cracks, with occasional embers. |
| Glowing skin | The original texture glows in the chosen colour. Maximum Intensity is visibly strong. |
| Poison skin | Build from Felwood poison and its native poison tileset texture; it reads as poison. |
| Fly swarm | Compare with the native fly swarm. Correct atlas cell, rows/columns and blend preserve transparent corners. A few dark flies follow separate irregular paths, never an orderly glowing ring. |
| Motes / Rising embers / Frost mist | Distinct drifting points, rising sparks and falling mist respectively. |
| Glacial fissures | Keep the liked terrain look. Its crystal-texture counterpart supplies Ice skin. |
| Buffs & curses | Keep the good looks. Every emitter and ground ingredient is optional; ground starts off. |
| Impacts | At the weapon tip on the Attack hit, with editable timing and placement. |

The good terrain looks are the quality bar. Reuse their technique when it produces
a better skin, including Felwood poison. Do not preserve a weak card merely to
keep its count.

## Native implementation and regression routes

- `partFrame` divides disconnected skin bindings before fitting. Coincident seam
  vertices have no span and do not produce an emitter region. The original
  surface is never deleted. The Slaanesh private regression measures both weapon
  bindings and blended attachments against the shared skin evaluator in every clip.
- Rune blade uses the native Icecrown obelisk `glow_runes.blp` strip, fitted by the
  existing surface-island mapper. It adds no ring mesh or orbit bone. Select the
  actual blade face when a model separates its face, edge and handle into different
  geosets; the enchantment must not jump to a neighbouring material.
- Ice skin reuses Glacial fissures with `Textures\CrystalOpaque.blp`; Poison skin
  reuses Felwood poison. Crystal veins and Felwood curse are the two added looks.
- Fly swarm uses the five native `Flies.mdx` Hermite paths (1233 ms) and the
  `Doodads0` fly cell (12 rows, 16 columns, cell 151). Native Blend retains dark
  bodies and transparent corners. Amount is the total across skin regions.
- Maximum Glow uses up to four additive native material passes, with a fractional
  final pass. Intensity therefore changes continuously and survives reopening.
- MDX has no universal gameplay attack-point field. Impact defaults use an event
  inside the chosen Attack, otherwise the strongest sampled weapon-tip motion.
  The owner can move that default with Impact moment. A native Squirt amount key
  lasts until the clip end so ordinary playback frame steps cannot miss it.

The source checks are `test/global-animations.test.js` and the private real-model
`test/manual/fx-owner-round.test.js`. Hidden packaged checks are
`test/fx-owner-round.electron.cjs`, `test/fx-owner-motion.electron.cjs`,
`test/fx-owner-intensity.electron.cjs` and the existing FX/save/UV/library workflows.
The motion harness accepts `FX_MODELS` / `FX_LOOKS` (comma-separated) and `FX_PART`
(a zero-based test override; UI reports remain one-based). The intensity harness
also accepts `FX_MODEL`, relative to the permanent test-model collection.

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
5. Run compatibility, focused source and the full source suite against the unchanged
   known-failures baseline. Follow TESTING-RULES.md, including fail-first evidence.
   Claude's independent QA gate still applies before any merge.
6. Owner click-through: Slaanesh flames fit; three colours edit; runes are glyphs;
   ice is crystal; poison uses the tileset; maximum glow is strong; flies have no
   black corners; Recall seal has no ground aura by default; impacts occur at the
   blade tip on Attack. No descriptions remain.

Work only under `D:\Codex`. Owner checkout, models, game files and installed MDLxL
are read-only. Never delete anything from `D:\Claude\MDLxL-TestModels`. Clean task
builds/profiles and stop task processes after verification. Keep a few final PR
images and the small report. Continue `codex/global-effects-local`, push to PR #492,
update its short plain description (changes, every removed card, open questions,
unverified Warcraft III playback), report to the owner and stop. No merge/release.
