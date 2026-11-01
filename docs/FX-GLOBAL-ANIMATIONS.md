# FX contract: the Global Animation Maker

Owner-defined contract for the FX window, written 1 November 2026 after the owner
reviewed PR #492. It overrides earlier FX handovers and recipe choices. If code, a
task note or a preset disagrees with this file, this file wins. Ask the owner before
changing it.

Read the first section slowly. PR #492 was built with careful engineering, but on
the wrong idea of what the tool is for. The rules further down only make sense once
the intention is clear.

## The intention

### What the owner asked for

A **global sequence maker**: a tool that gives parts of the user's own model a
permanent, looping animation that is useful on a real unit.

- Make this sword burn. Make this blade crackle with frost or lightning.
- Make this skin flow like water, freeze like ice, glow like lava.
- Make these runes or this trim glow and pulse.
- Make flies buzz around this head, forever.

The model then carries that enchantment itself, in every animation, in the game,
with no trigger, ability or map script.

### Why "global sequence" is the key word

In a Warcraft III model, normal animations (Stand, Walk, Attack, Death) are ranges
on one timeline: only one plays at a time. A **global sequence** is a separate clock
that runs forever, whatever animation is playing. Anything keyed to it loops
constantly: texture animations, material alpha, geoset colour, bone rotation and
scale, emitter visibility and emission.

That is how Blizzard makes the Water Elemental's body flow, the Fire Lord's embers
glow and the Revenant's skin ripple. FX lets a modder do the same on any part of their
own model, quickly, and adjust the result. Every piece FX writes should be driven by
a global sequence. That is the test for whether something belongs in the main FX
workflow.

### Why PR #492 missed

PR #492 read "effects" as "spell effects" (SFX) and built a catalogue of them:
auras, impacts, buffs, curses, trails. In Warcraft III those are mostly separate
things the game spawns or attaches for a moment or for an ability. They are not
permanent animations a unit model carries:

- **Auras** are drawn by the game when a unit has an aura ability. Putting one inside
  a unit model makes no sense for this tool. It was never part of the request.
- **Weapon trails** usually appear during attacks, so they are keyed to the Attack
  animation, not to a global sequence. A burning sword is a global animation; a swing
  trail is not.
- **Impacts, birth and death flashes** are one moment of one animation.

None of these is wrong to have. They are simply not the tool that was asked for, and
building them took the place of the actual job.

### What "study auras" meant

Aura models are some of the clearest native examples of how Blizzard animates
geometry with global sequences: rings that turn, shapes that breathe in scale, alpha
that shimmers, textures that scroll. Examples are
`Abilities\Spells\Human\DevotionAura\DevotionAura.mdx`,
`Abilities\Spells\Orc\CommandAura\CommandAura.mdx` and
`Abilities\Spells\Undead\UnholyAura\UnholyAura.mdx`.

The owner asked to **study** them to learn that **technique**, then use it on the
user's parts. Example: take an aura's rune ring, wrap it around a sword blade, and let
it turn slowly and shimmer while it follows every swing. The aura is the textbook;
the enchanted sword is the product.

### The question to ask on every decision

> Is this a permanent animated enchantment of a part of the user's model, driven by
> a global sequence, that the user can fit and adjust?

If yes, it is this work. If no, it is not, however good it looks.

## Everything from PR #492 stays

The owner will sort through the existing work later. Until then:

- Do not delete, hide, rename or rework any existing card, recipe, test or piece of
  code: auras, trails, impacts, buffs and curses, cues, skins, terrain, model cards.
  They keep working exactly as they do now, and their tests stay green.
- Do not add more cards like them, and do not spend this pass improving them.
- The new global animation work is built alongside. Reuse PR #492's skins,
  texture motion, fitting and composition code wherever it fits.

## What a global animation is made of (layers)

Every global animation is a short stack of layers. A starter look such as Flaming
sword is just a stack of these, and stays fully editable after it is chosen.

| Layer | What it does | Built from |
| --- | --- | --- |
| Moving skin | Scrolls, flips or pulses a texture over the part (fire, water, ice, lava, energy running along a blade) | Material layer + texture animation on a global sequence |
| Glow | Brightens, pulses or changes the colour of the part | Material layer, geoset colour/alpha on a global sequence |
| Rune | Native aura or spell geometry (ring, rune, seal) on or around the part that turns, breathes and shimmers | Copied native geometry + a bone under the part's bone with global-sequence rotation/scale + alpha |
| Particles | Something that leaves the part or flies around it all the time: embers rising off the blade, frost mist, drips, flies, motes | Native PRE2 emitter under the part's bone, emitting on a global sequence |
| Edge | A flame or light edge that clings along the whole part all the time | Native ribbon emitter fitted to the full length of the part, visible on a global sequence |

Five layer types. Do not add new layer types without asking the owner.

## Controls: no baked values

The second complaint about PR #492: effects were dropped on the model and could not
be adjusted. An ember trail became a tiny squeeze in the middle of the sword. These
rules fix that for the global animation work.

1. **Every layer is listed and selectable** in the FX window (a short list, one line
   per layer, in the existing right column). Selecting a layer shows its controls.
   Add layer and remove layer are allowed. No hidden ingredients.
2. **Reuse the existing control for the job, exactly** (AGENTS.md "one way of doing
   things"):
   - Particles and edges use EMTR's own fields and wording: `Upper end`, `Lower end`,
     `Size`, `Lasts`, `Intensity`, `Smoothness`, `Gravity`, colour, emission amount
     and speed (`app/ParticleRibbonFields.jsx`, `app/ParticleStageTools.jsx`,
     `app/ParticleTimingTool.jsx`). Same handles, same drags, same tooltips. An
     `Open in EMTR` button opens the full emitter editor for that layer.
   - Placing, moving and resizing anything in the preview uses EMTR's handles
     (`ParticleStageTools`). That includes runes and particle areas.
   - Texture motion (speed, direction, tiling) reuses the Texture Animation Manager
     and UV controls the app already has. If the app already drags for a job, FX
     drags too. No new slider for a job that has a handle.
   - Colour uses the existing swatches and picker.
3. **Fit the whole part by default.** A new layer starts fitted to the selected
   part's full length and size, along its long axis, on its own bone. A blade effect
   runs from hilt to tip. An edge spans both ends of the blade. Particles emit along
   the whole part. A rune is sized to wrap the part. Flies orbit around the part at a
   radius that clears it. The user then adjusts; they never have to rescue a
   misplaced default.
4. **Loop length is the global sequence.** Each global animation has one
   `Loop length` (milliseconds) shared by its layers, so the layers stay in sync. It
   is that effect's global sequence. Speed controls change the motion inside the loop.
5. **Re-editable after Apply.** Reopening FX on a part with a global animation shows
   its layers with their current values. Editing updates it; it does not stack a
   duplicate. Each piece also stays editable in its normal manager (EMTR for
   emitters, Material and Texture Animation managers).
6. Controls apply on release, as in the first audit (no rebuild per input tick).
7. Every control and its label has a one-line plain tooltip.

## Model friendly

- Global sequences only. Never add, change or retime the model's own sequences or
  keys. Reuse an existing global sequence of the same length instead of adding a
  duplicate.
- Reuse native game files (textures, aura geometry, emitters). No exported, painted
  or newly generated textures.
- Attach to the part's existing dominant bone. Add a bone only when a layer needs its
  own motion (a turning rune); add no helpers otherwise.
- The animation plays in every model animation, all the time.
- Keep it small: no extra geosets, materials or textures beyond what the layers need;
  reuse existing ones.
- Survives saving and reopening as MDX and MDL, and plays the same in the game.
- One Apply is one Undo step.

## Starter looks

The global animation part of FX starts with a **short** list of starting points,
grouped by what is enchanted. Each one is an editable layer stack. Start with these,
and add more only when the owner asks:

| Group | Starter looks |
| --- | --- |
| Blades | Flaming sword, Frost blade, Lightning blade, Arcane blade, Rune blade (turning aura rune) |
| Skins | Water skin, Ice skin, Lava skin, Glowing skin, Poison skin |
| Around the unit | Fly swarm, Motes, Rising embers, Frost mist |
| Your textures | Moving own texture, Colour pulse, Fade pulse |

Build them from PR #492's existing pieces where they fit (Water skin, Flaming skin,
Frost skin, Revenant waves, the lava and fissure skins, Blade energy, Frost edge,
Ember edge, the energy streaks, Fireflies, Forge cinders, Winter breath, Spell ward's
turning rune, Moon orbit's orbit, the own-texture cards). Reuse the code; leave the
original cards in place.

## Window

Same FX window and size: geoset choice, preview with normal mouse camera rotation,
look list on the left, layer list and controls on the right, Apply at the bottom.
No new panels, tabs or toolbars. FX opens on the global animation groups above.
The existing PR #492 categories stay reachable in the same list, unchanged, after
them.

## Done means (the owner's click-through)

1. Khorne Warrior, sword geoset, `Flaming sword`: fire covers the blade from hilt to
   tip; embers rise from its whole length. Drag `Upper end` and `Lower end` on the
   preview handles to shorten it; change colour; change `Loop length`. Apply.
2. Play Stand, Walk, Attack and Death: the fire plays in all of them and follows the
   swing.
3. Reopen FX on the sword: the same layers show with the changed values. Change one,
   Apply: still one effect, no duplicate emitters.
4. Body geoset, `Ice skin`, then `Water skin` on another unit: the skin moves
   continuously, the part keeps its shape.
5. Head or body, `Fly swarm`: flies circle around the part all the time; drag the
   handle to widen the circle; lower the amount.
6. Sword, `Rune blade`: a native aura rune wraps the blade, turns slowly and
   shimmers; drag it along the blade and resize it with the EMTR handles.
7. Undo removes each Apply in one step. Save as MDX, reopen: everything is there.
   Open the model in the game: it looks the same.
8. Every PR #492 card still appears and works as before.

## Rules for the work

- Use the intention section to decide unclear cases. When the answer is still
  unclear, ask the owner instead of guessing.
- Spend the effort on the global sequence maker: layers, controls, fit and
  re-editing. Not on new looks or new SFX.
- Do not add looks, layer types, categories or windows beyond this file without
  asking the owner.
- Keep PR descriptions short and plain: what the owner can now do, and what is left.
- Continue on `codex/global-effects-local` and PR #492; retitle it to match this file.
