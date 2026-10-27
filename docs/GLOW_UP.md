# Glow Up

Open a model, open **EMTR** (Particle Editor) and click **Glow Up** next to
Add ribbon. Tick **Origin glow**, **Weapon glow** or both and click **Create**.
Placement and size are dragged in the preview with EMTR's emitter handles
(`GlowStageTools`, same markup, CSS, latching and keys as `ParticleStageTools`):

| Handle | Like | Changes |
| --- | --- | --- |
| Move (green) | Move emitter | origin glow position on the ground |
| Edge of the ground outline | Spawn width handle | origin glow size |
| Two ends of the weapon line | Ribbon edge handles | where the weapon glow starts and ends, free in the view plane (a spear tip: drag the start to the tip; a hammer or axe head: drag an end onto it, up to half a weapon past the tip) |
| Corners of the Size square | Particle size corners | weapon glow square size |

Escape cancels a drag, arrow keys nudge a focused handle, and dragging a handle
never moves the camera. **Origin brightness %** and **Weapon brightness %** are EMTR's own `ParticleSlider`. The
preview plays the model's Stand with the glow, orbits with the mouse, fits the
view once and then keeps the user's camera. Create is one undo step; Cancel or
Escape leaves the model alone. Glow Up used to be a Forge mode; Forge no longer has it.

## How heroes glow

Measured from every classic (SD) Warcraft III unit model with team glow (80
files from the game's CASC storage: all melee, campaign and neutral heroes) and
from 23 hero variants by Gluma on Hive Workshop (Saurus Oldblood, Skink Chief and
High Priest, Kroxigor, Cold One Rider, Bray Shaman, Zweihander Knight, Elf
Lashers, Bladedancer, Witch Elf, Horn-gor, Dragon-priest, Plate Armor Knight,
Serpent Knight, Lizard Warlord, Lizard Witch, Assassin). Source models are not
shipped; the measurements are below.

All glow uses the team glow texture (ReplaceableId 2), FilterMode Additive,
Unshaded, layer alpha 0.75 (Gluma: 0.75 or 1) and full 0..1 UVs.

**Origin glow** is the same template on Paladin, Jaina, Uther, Arthas and most
heroes: three flat ground planes at the model's origin, each on its own
unparented bone with its pivot at the plane's centre.

| Plane | Width | Height | Scale pulse |
| --- | --- | --- | --- |
| 1 | 0.89 × S | 7 × S/254 | 1 → 1.17 → 1, global sequence 1600 ms, Hermite |
| 2 | 1.00 × S | 15.8 × S/254 | 1 → 0.82 → 0.92 → 0.78 → 1, 3333 ms |
| 3 | 0.75 × S | 25.5 × S/254 | as plane 2 |

S is 254 on the Paladin and runs 175–430 on other heroes. Gluma uses two or
three such planes (190–285 wide, 7–34 high) and gives each its own pulse period,
so they never beat in step; Glow Up runs plane 3 on 2666 ms for that.
Across 32 glowed heroes S ≈ 8.9 × h^0.71, where h is the 95th-percentile vertex
height of the body (mean error 15%); taller bodies get relatively smaller glows
(Kroxigor 175 high → 260 wide).

**Weapon glow** is a row of camera-facing squares along the weapon: Arthas's
sword (6), Death Knight (6), Paladin's hammer (4), Warden (7), Tauren axe (5),
Gluma's swords (5), clubs (3–4) and staffs (3). Each square has its own
Billboarded bone parented to the weapon bone (or the weapon mesh's bone), pivot
at its centre. Squares are 40–130 wide, about 1.4 × the glowing span (Arthas 66 → 90,
Paladin 42 → 76, Gluma's blades 40 → 54), spaced at
roughly a fifth of their width so they overlap into one glow, and narrower at
the tip (Arthas 95 mid → 57 at the tip). Shields get one large square.

Visibility: the glow geosets go dark in Death, Decay and Dissipate (Dissipate on
34 native models, Death 15, Decay 14).

## What Glow Up writes

- One material per brightness (team glow, Additive, Unshaded + TwoSided, alpha =
  Brightness); origin and weapon share it when their brightness matches.
- Origin: one geoset with three quads on bones `Glow Origin 1–3`, Scaling tracks
  as above on reused or new global sequences.
- Weapon: one geoset of 1–10 squares built in YZ (Warcraft billboards face +X)
  on bones `Glow Weapon n`, Flags Bone + Billboarded, parented to the weapon.
  By default the row runs from 30% to 100% of the reach from the grip (the
  nearest `hand` ancestor's pivot) to the tip; the end handles override it as
  fractions of the whole weapon, plus two sideways offsets (weapon lengths) when an
  end is dragged off the weapon's line. The tip is the side with more of the weapon's
  length × vertices, so hammer and staff heads win over handles. Spacing
  follows the unscaled square, so Weapon size shrinks squares without adding
  more, and a short stretch gets one to three.
- A geoset animation per geoset: alpha 0 at the start of Death/Decay/Dissipate,
  1 elsewhere. Sequence starts outside signed 32-bit (Far Seer's stray
  `nothing`) are skipped; shared starts stay visible.
- New geoset bounds only; authored bounds, bones, meshes and animations stay.

Weapon choice lists marked polygons first (when polygons are selected in
Vertices), then a mirrored pair such as `sword_L + sword_R`, then bones by
likelihood: a weapon name (sword, axe, hammer, staff, club, bow, Gluma's
`W_handle`…) scores 4, held under a hand 2, thin 1, longer than 35% of the
body height 1. Weapon glow starts ticked for marked polygons or a score of 4,
which covers an unnamed sword held in a hand (the Footman's `Cone11`).

On the 84 reference models the automatic pick is the bone the author glowed on
38 of 53 that have weapon glow; most others glow hands or bodies (Keeper, Moon
Priestess, Lich, Dreadlord) rather than a weapon. Of the unnamed bones that
start ticked, 10 of 13 are the weapon; Keeper and Moon Priestess pick a hand
part and the Tinker robot a body part. All 84 accept the glow and
save as MDX and MDL, except five that fail without it (read-only HD format, a
Goblin Tinker camera, a quote in Malfurion's sequence name).

## Verification

- `test/glow-up.test.js`: origin template and pulse, visibility keys, sword
  detection and line, mirrored pairs and marked polygons, billboard orientation
  under orbit, MDL/MDX round trip, one-step undo.
- `test/glow-up.electron.cjs`: packaged app, hidden desktop. Glow Up beside Add
  ribbon, trim default panel, real mouse drags on every handle (and Escape),
  wheel zoom, camera kept during handle drags, real mouse orbit, Create,
  undo, Forge without Glow Up.
