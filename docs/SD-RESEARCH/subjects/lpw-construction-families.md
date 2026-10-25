# Construction families in the directly reviewed owner models

## A shield is a layered assembly, not one polygon budget

Graveguard, Warrior of Tzeentch, Knight of Nurgle and Knight of Slaanesh each have a 204-triangle principal shield rim. Knight of Khorne has a 199-triangle principal rim; Knight Undivided has a 104-triangle rim. These numbers refer to the identified connected rim, not the whole shield. Equal counts are not proof of an identical source mesh. The rest of each shield explains its character:

| Model | Identified shield pieces | Construction implication |
|---|---|---|
| Graveguard | Rim 204; carved front 42; wooden back 42; main gargoyle head 146; purple/gold ornament 17; additional jaw/cheek accents and glow cards | A low-count broad front and back support a much denser projected head and rim. The highest triangle investment is in the silhouette/decorative relief. |
| Warrior of Tzeentch | Rim 204; scaled front 32; wood back 32; eye 24; eye frame 16; glyph 18+6; metal accent 76; side band 48 | A small animated surface becomes the focal point inside a comparatively elaborate frame. |
| Knight of Nurgle | Rim 204; seven flesh-shell pieces 133; back 86; tongue 44; three skull discs 90; 23 teeth 191; mouth lining 8; horns 28+28 | The disturbing mouth is made from independently placed teeth and tongue, not merely a painted symbol. |
| Knight of Slaanesh | Rim 204; face 38; torso 52; hair 60; gem 6; gem frame 18; chains and small fringe cards | A figure is mounted inside the shield. Individual materials follow anatomy, cloth, jewellery and background roles. |
| Knight of Khorne | Rim 199; Khorne emblem 117; gold accent 39; 22 rim spikes at 4 each; skull jaw 86; cheek pieces 42 each; skull upper face 76; front/back 41+44 | Repeated small wedges sharpen the outer silhouette, while the centre spends triangles on the raised skull. |

The totals above name the listed pieces, not an exhaustive aggregate budget; exact component records and UV masks remain the searchable source. In Graveguard, the metal-looking front is painted by a UI inventory sheet while the silhouette of the gargoyle head is modelled. In Knight of Nurgle, tooth silhouettes remain geometric even though their colour comes from HeroBladeMaster. This separation is the useful craft observation.

## Rings and painted bands support very different horns

| Model / component family | Measured construction | Paint source and appearance |
|---|---|---|
| Graveguard helmet wing membranes | Six disconnected pieces: 5,2,1 triangles per side | GargoyleStatue dark wing membrane; separate framework pieces use NewBlacksmith. |
| Knight Undivided main helmet horns | Two 54-triangle curved pieces | Necromancer pale/brown bands; the curvature is geometry, the banded light pattern is paint. |
| Knight of Nurgle branched helmet horns | Two 54-triangle branched pieces | SkeletonArcher pink banding; the side branches change the outline beyond the painted stripes. |
| Knight of Slaanesh helmet horn assembly | Two upper curves at 64 each and two lower curves at 36 each | InfernalCannon gold regions; narrow twisting outlines and bright paint work together. |
| Chaos Ogre helmet horns | Two roots at 118 each, plus two tips at 125 each | Necromancer pale roots; NewBlacksmith red tips. The colour break is a component/material break. |
| Knight of Slaanesh horse spikes | Four separate 4-triangle wedges | EditorGemAct purple/white bevel bands make the very small geometry read as faceted ornaments. |

The Chaos Ogre roots and tips are far denser than the four-triangle Slaanesh horse wedges; they serve different outlines and should not be collapsed into one broad “horn budget.” The comparison remains useful when subdivision, size, assembly role and material are retained together.

## Mail is painted on low-count carrier surfaces

Graveguard's HumanCampaignFootman mail covers a 24-triangle skirt and 16-triangle face veil. Chaos Ogre uses the same sheet on a 16-triangle face/neck veil. Warrior of Tzeentch uses it on two 6-triangle upper-arm patches, a 24-triangle skirt, an 8-triangle face border and a 64-triangle face veil. The 64-triangle veil spends geometry on the covering shape; none of these meshes builds each mail link individually. Their exact mapped islands, rather than the texture's filename, locate the useful link patterns.

Knight Undivided uses HumanCampaignFootman on a 35-triangle horse mail caparison. Knight of Khorne uses it on a 32-triangle caparison and 16-triangle neck collar. The rider's mail and the mount's cloth-sized surface therefore belong to the same painted material family but very different carrier roles.

## Painted rivets and separate rivets coexist

Knight of Nurgle's six helmet stud pieces each contain 8 triangles and use InfernalCannon's painted rivet region. Each stud is a separate raised piece whose image also supplies a round highlight. In Graveguard, four small front-waist fasteners contain 8 triangles each; their exact hardware interpretation remains probable because they are tiny in the full model. In both cases a flat-vs-modelled binary would be incomplete: a raised geometric plate carries a painted rounded rivet.

The broader lesson is bounded to these examples: keep a named assembly, its connected components, and its painted sub-features as separate records. A shield's carved engraving, a mail link or a horn stripe can be painted, while the containing surface still has purposeful geometry.
