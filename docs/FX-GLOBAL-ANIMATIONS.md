# FX contract: the Global Animation Maker

Owner-defined contract for the FX window, written 1 November 2026 after reviewing
PR #492. It overrides earlier FX handovers and recipe choices. If code, a task note
or a preset disagrees with this file, this file wins. Ask the owner before changing it.

## What FX is

FX gives a part the user already has (a sword, a skin, armour, a cape, a head) a
**permanent looping animation** that runs in every animation of the model, driven by
**global sequences**, and that works in the game.

The owner's own examples define the target:

- a flaming sword, a frost blade, a lightning blade, a magical blade;
- water skin, ice skin, lava skin, glowing skin;
- a rune that turns slowly on a sword or shield;
- flies or motes that fly around the unit **all the time**.

In one sentence: **FX is a global animation maker. It makes models look enchanted,
always, in a way that is model friendly and fully adjustable.**

## What FX is not

| Not in FX | Why | Where it belongs |
| --- | --- | --- |
| Ground auras, circles and seals under the feet | The game draws auras through abilities. A unit model must not carry one. | Nowhere. Do not build them. |
| Weapon swing trails (ribbons that only show during a swing) | EMTR already makes and fits weapon trails. | EMTR |
| Impacts, birth, death and other one-moment cues | They belong to one animation, not a global loop. | Parked (see below) |
| Buffs and curses as status SFX | The game shows those through abilities. | Nowhere, unless the owner asks |
| A big catalogue of finished looks | Quantity is not the goal. A few good starting points with real controls are. | — |

**Parked, not deleted:** the impact and cue code (`hit`, `cue`, `stamp`, birth/death
timing in `visual-effect-recipes.js` and `visual-effect-composition.js`) stays in the
repository and its tests stay green. Remove those cards from the FX list. Do not wire
them into another window; the owner decides later where they go.

## How auras are used

The owner asked to **study** native aura models, not to make auras. Aura models show
how Blizzard animates flat geometry with global sequences: bones that spin, scale and
breathe; texture animations that scroll; alpha and colour tracks that shimmer. Examples
are `Abilities\Spells\Human\DevotionAura\DevotionAura.mdx`,
`Abilities\Spells\Orc\CommandAura\CommandAura.mdx` and
`Abilities\Spells\Undead\UnholyAura\UnholyAura.mdx`.

FX uses that **technique** on the user's parts. Example: an aura rune, reused from the
native aura model, wrapped around a sword blade as a slowly turning, shimmering ring,
or laid flat on a shield. It is attached to the part's bone, so it follows every swing.
It is never placed on the ground.

## The test every effect must pass

An effect belongs in FX only if all four answers are yes:

1. Does it sit **on or around a part** of the model (not on the ground)?
2. Does it **loop forever** on a global sequence, in every animation?
3. Does it **follow the part** when the part moves (attached to the part's bone)?
4. Can the user **adjust every visible piece** of it with existing MDLxL controls?

## Building blocks (layers)

Every FX effect is a short stack of layers. A starter look such as Flaming sword is
just a stack of these, and stays fully editable after it is chosen.

| Layer | What it does | Built from |
| --- | --- | --- |
| Moving skin | Scrolls, flips or pulses a texture over the part (fire, water, ice, lava, energy running along a blade) | Material layer + texture animation on a global sequence |
| Glow | Brightens, pulses or changes the colour of the part | Material layer, geoset colour/alpha on a global sequence |
| Rune | Native aura or spell geometry (ring, rune, seal) on or around the part that spins, breathes and shimmers | Copied native geometry + a bone under the part's bone with global-sequence rotation/scale + alpha |
| Particles | Something that leaves the part or flies around it all the time: embers rising off the blade, frost mist, drips, flies, motes, sparks | Native PRE2 emitter under the part's bone, emitting on a global sequence |
| Ribbon edge | A flame or light edge that clings along the whole part at all times (not a swing trail) | Native ribbon emitter fitted to the full length of the part |

Five layer types. Do not add new layer types without asking the owner.

## Controls: no baked values

The main complaint about PR #492: effects were dropped on the model and could not be
adjusted. An ember trail became a tiny squeeze in the middle of the sword. These rules
fix that.

1. **Every layer is listed and selectable** in the FX window (a short list, one line
   per layer, in the existing right column). Selecting a layer shows its controls.
   Add layer and remove layer are allowed. No hidden ingredients.
2. **Reuse the existing control for the job, exactly** (AGENTS.md "one way of doing
   things"):
   - Particles and ribbons use EMTR's own fields and wording: `Upper end`, `Lower end`,
     `Size`, `Lasts`, `Intensity`, `Smoothness`, `Gravity`, ribbon colour, emission
     amount and speed (`app/ParticleRibbonFields.jsx`, `app/ParticleStageTools.jsx`,
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
   runs from hilt to tip. A ribbon spans both ends of the blade. Particles emit along
   the whole part. A rune is sized to wrap the part. A swarm orbits around the part
   at a radius that clears it. The user then adjusts; they never have to rescue a
   misplaced default.
4. **Loop length is the global sequence.** Each effect has one `Loop length`
   (milliseconds) shared by its layers, so the layers stay in sync. It is that
   effect's global sequence. Speed controls change the motion inside the loop.
5. **Re-editable after Apply.** Reopening FX on a part with an FX effect shows that
   effect's layers with their current values. Editing updates the effect; it does not
   stack a duplicate. Each piece also stays editable in its normal manager
   (EMTR for emitters, Material and Texture Animation managers).
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
- The effect plays in every animation, including Death. Keep it small: no extra
  geosets, materials or textures beyond what the layers need; reuse existing ones.
- Survives saving and reopening as MDX and MDL, and plays the same in the game.
- One Apply is one Undo step.

## Starter looks

FX opens with a **short** list of starting points, grouped by what is enchanted.
Each one is an editable layer stack. Start with these, and add more only when the
owner asks:

| Group | Starter looks |
| --- | --- |
| Blades | Flaming sword, Frost blade, Lightning blade, Arcane blade, Rune blade (turning aura rune) |
| Skins | Water skin, Ice skin, Lava skin, Glowing skin, Poison skin |
| Around the unit | Fly swarm, Motes (fireflies), Rising embers, Frost mist |
| Your textures | Moving own texture, Colour pulse, Fade pulse |

Existing PR #492 pieces that pass the four-question test are reused in these looks
(Water skin, Flaming skin, Frost skin, Revenant waves, lava and fissure terrain
skins, Blade energy, Frost edge, Ember edge, energy streaks, Fireflies, Forge cinders,
Winter breath, Lantern wisp, Spell ward's turning rune, Moon orbit's orbit, own-texture
cards). Remove from FX: every ground aura (Sanctuary circle, Cinder tide, Winter seal,
Blight sigil, Banner ward), the swing trails (Sunsteel, Wraith, Rime, Coalbrand,
Viper), and all cue cards (Iron strike, Ice fracture, Ember burst, Dust shock, Soul
release, Dawn awakening, Thunder print, Fel rupture, Recall seal); park the cue code.

## Window

Same FX window and size: geoset choice, preview with normal mouse camera rotation,
look list on the left, layer list and controls on the right, Apply at the bottom.
No new panels, tabs or toolbars. Categories are the four groups above, not effect
types like "Buffs & curses".

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
8. The FX list shows no ground auras, no swing trails, no impact or cue cards.

## Rules for the work

- Less is more. Spend the effort on controls, fit and re-editing, not on new looks.
- Do not add looks, layer types, categories or windows beyond this file without
  asking the owner.
- Keep PR descriptions short and plain: what the owner can now do, what was removed,
  what is left.
- Continue on `codex/global-effects-local` and PR #492; retitle it to match this file.
