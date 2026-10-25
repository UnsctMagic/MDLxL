# SD: one standard, four ways of making it (reviewed with the owner, 25 October 2026)

Owner, 25 October 2026: these are not rules. SD is one standard; Blizzard, HerrDave, Gluma and
the owner's HQSD are different ways of doing the same thing. HQSD can be laid over any of them.

Measured on 3,078 labelled pieces of UnsanctionedMagic's 26 models, 673 pieces of 40 reviewed
Blizzard models, and the model files of HerrDave (25) and Gluma (72), grouped by each model's main
author. Per piece: real triangles, the paint under each triangle (decoded sheet × geoset tint),
cross-section thickness and shading. Comparison cases: the owner's Traitor Axe (BITZ) and the test
build's "brutal sword". Measuring scripts: `out/rules/` in the `claude/sd-brain-knowledge` worktree (local, not committed): extract.mjs, extras.mjs, measure.py, pieces.py, rules.py, tiers.py, authors.mjs. Sizes are the model file alone, without textures.
Sharp-side score = thickness at the thinnest side ÷ thickness in the middle (1.0 = no thinning).

## The art director may use all of it

Owner, 25 October 2026: unrestricted, the AI may combine every technique to reach the owner's
wish, always preferring native textures and native parts. The owner can ask for one approach
(kitbash, or a standard model with its own skin). Example of a valid direction for "orc warlord":
start from the Grunt, replace the head with Thrall's, change the hair, add a helmet with horns,
reshape it, recolour it from a kitbash palette, give him Frostmourne and change its hilt. The
art director knows the toolbox (MDLxL's tools), the box of parts (every game model and the BITZ
box) and the palettes (every texture). Building new shapes from scratch is also allowed, as long
as the shapes respect the craft above (the test-build sword did not). Mixing is best: once the
AI has a Blizzard reference part or base, it can add shapes to it and build further from there.

## What makes a model SD

- Format 800: all 130 LowPolyWorks models are MDX 800.
- Model file size by type, roughly 200–700 KB at most (owner: a dragon rider with many
  animations can reach 700). Measured, model file only: owner 104–248 KB (median 192), HerrDave
  60–203 (89), Gluma 68–392 (225), Blizzard units 34–226 (p10–p90, median 116), Blizzard heroes
  131–386 (244).
- Simple textures of 256 or 512 pixels.

## Textures: palette or skin

- HQSD (owner): textures are painting palettes for kitbashing. Any sheet at hand can be used:
  Blizzard's, Gluma's or HerrDave's. 98% of the owner's triangles use game paint chosen by look,
  from a median of 20 sheets per model; the biggest sheet covers only 30% of a model.
- The AI can work both ways (owner, 25 October 2026): the owner has seen AI build muscles from
  skin paint and armour from wood, ignoring what a sheet was made for and using the part of it
  that looks right. That needs the AI to look at the sheet itself, not only at a list of labels.
- Blizzard, HerrDave, Gluma: the texture is the model's skin, painted for that unit. Blizzard
  units use 1 sheet; Gluma's biggest sheet covers 96% of each model; HerrDave's orcs put 84–86% on
  one custom sheet and his Empire units wear whole Footman and Knight sheets.

## Four ways of making SD

### Blizzard (WC3 SD): reshape, don't rebuild
- One skin per unit; each part uses the area painted for it (the Footman's sword on Footman.blp).
- Simple, recognisable shapes; the paint carries shading and detail. Edges are painted brighter
  on the blade (8 of 10 weapons) and the whole blade thins to an edge (16 of 16 blades ≤ 0.41).
- Detail spread evenly: the Footman's helmet, shield and sword are no denser than his body.
- Units median 399 visible triangles and 31 bones; heroes 529 and 53.
- A Footman is a Footman: it cannot be recreated from new shapes. It can be reshaped wisely,
  moving its geometry so its own skin still fits.

### HerrDave: simplicity is king, closest to WC3
- Few skins used whole: about 4 sheets per model, the biggest covering 45%.
- Simplest builds: median 846 triangles, 21 bones, about 2,100 animation keys.

### Gluma: high-quality elements, painted skin, heavy animation
- One big custom skin per unit (96% of the triangles); the hand painting carries the detail.
- More complex, more continuous meshes and much more intense animation: 44 bones and about 6,300
  animation keys per model (3 times HerrDave), 0.82 keys per bone per second.

### HQSD (UnsanctionedMagic): an upgrade layer on any base
- Laid over a base model of any style: a Gluma model can get HQSD details; a WC3 unit can get an
  HQSD weapon in place of its own. All 26 owner models credit a base model (13 HerrDave's Vile
  Knight with Stein123's edits, 5 azazeron's Chaos Warrior, 3 by Direfury, one each by Rhapsodie,
  Maximal, FerSZ, Johnwar and Greedy Martyrdom) and became full kitbashes.
- The body stays near SD density; helmets, shields and weapons are upgraded. Body median 20
  triangles per 1,000 square units (Blizzard unit bodies 14); gear 59 (Blizzard gear 8). Gear takes
  57% of the triangles on 30% of the surface; more than twice the body's density in 19 of 26 models.
- Many parts from many palettes: median 117 pieces, 20 sheets, about 2,100 triangles, 52 bones.
- Cutouts on blades: 14 of 20 models with a bladed weapon split the blade into contrasting pieces.
  10 add a separate edge in another paint (Chaos Ogre silver on black, Khorne orange on red,
  Nurgle green on brown, Slaanesh purple and white on gold, lava cleaver, Berserker, Warrior of
  Nurgle, Blood Dragon, Undivided Lance, Old Version); 3 swords put a separate dark inset into a
  bright blade (both Von Carsteins, Knight Undivided Sword); Aspiring Champion pairs two steel
  tones. The Traitor Axe does it with unwelded silver edge triangles on black iron.
- The edge piece is thin; the body can be a slab: 12 of 14 separate edge pieces thin out
  (0.05–0.43) on bodies that do not (0.9–1.0).
- Layered gear: helmets 22 of 22 add visor, crest or horn pieces (crest brighter than shell in 9
  of 10 measured); pauldrons 15 of 19 add a rim (brighter in 10 of 15); shields 15 of 15 add rim or
  back pieces.
- Many points: 24 of 26 models have 3 or more spike, horn, tooth or claw pieces (median 16,
  typically 4 triangles on a 4-sided base).
- Small accents as their own pieces: glow cards in 22 of 26 models, skull ornaments 19, rivets and
  studs 7, gems 5. Geoset tint in 24 of 26. Team colour is a design choice, not a default.

## Seen across all four

- Round parts use few sides: owner hafts, grips and collars median 4 (99 of 116 ≤ 6); Blizzard
  median 3.
- Light is smooth inside a piece (median 0% flat-shaded triangles for owner and Blizzard); hard
  breaks come from separate pieces (HQSD) or paint (skins). The AI's blade was 100% flat.
- What a chosen texture area contains matters more than its size: the owner's edge pieces get
  about 0.5 texture pixels per unit, the same density as the AI's banded blade.

## The test-build sword

One flat-shaded slab (sharp side 1.00), no edge, one banded paint, square steps in the outline,
box hilt, a new shape on a borrowed strip, and no base model. It is none of the four.

Not measured reliably: outline corner angles. Hive authors and other LowPolyWorks authors are not
part of these counts. Five HerrDave files did not parse and are left out of his mesh and
animation numbers.
