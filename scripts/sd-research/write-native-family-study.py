"""Source-specific family study assembled from reviewed observations and measurements."""
import json
from pathlib import Path
ROOT=Path('D:/Codex/sd-research');OUT=ROOT/'repo/docs/SD-RESEARCH/subjects/families';OUT.mkdir(parents=True,exist_ok=True)
parts=json.loads((ROOT/'repo/docs/SD-RESEARCH/data/native-reviewed-parts.json').read_text('utf-8'))
chapters=[
('weapons-sword-blades','Sword blades: thin solids, broad painted faces',['straight-blade','curved-blade','rune-blade'],'''
The Footman blade (g1:c9) and Blademaster blade (g4:c2) each use nine triangles and seven distinct positions. This is a specific construction shared by these two examples, not a recommended budget for every sword. Their two triangular longitudinal rings and terminal tip create a very thin solid with an open proximal end. Footman's ten stored vertices represent seven positions because three positions carry split normals. Blademaster has eleven stored vertices for its seven positions. Extra stored vertices therefore do not necessarily buy extra silhouette.

Footman's real side triangles are slightly twisted. A plane through the middle encounters five corners even though the authored rings each have three points. Calling that a five-sided blade from slice statistics alone would misdescribe the construction. The triangle topology and ring positions were inspected directly; the dataset keeps both the automatic slice observations and this interpretation.

The Knight blade (g1:c18) uses ten triangles and a broader reinforced base. Its black central channel is bounded by bright silver paint. Skeleton's curved sword (g1:c6) uses fourteen triangles and nine distinct positions, with a closed surface. The bend changes the outline; the dark groove does not require another inset strip of geometry. These are different silhouette problems even when the material is similarly silver steel.

Death Knight's twenty-four-triangle sword (g1:c16) is a whole connected weapon body: blade, hilt colour, green gem and red grip are visible on it. Its white curling runes are paint. Comparing 24 against Footman's blade-only 9 would mix assembly boundaries. The useful comparison is that Death Knight spends additional geometry on a more complicated connected silhouette while retaining elaborate internal decoration in the sheet.

Footman's diamond guard (g1:c10) and Blademaster's guard (g4:c1) are separate two-triangle planar pieces. Both look more elaborate in the intact model because concentric or angular highlights are painted on them. These guards should not be described as solid metal bosses. Their oblique views reveal the lack of thickness.
'''),
('weapons-axes-and-polearms','Axe and polearm heads: perimeter before ornament',['axe-blade','polearm-blade','weapon-spike'],'''
Grunt's axe is unusually economical in this comparison: g8:c1 is an eight-triangle head with six distinct positions; g8:c2 is a separate eight-triangle haft. The head's broad dark face and pale cutting edge read as heavy iron. The bright edge is painted onto the wedge rather than carried by a separate narrow bevel ring. Its six-position solid can be inspected independently of the hand and body.

Mountain King's axe head (g1:c16) has ten triangles. Its broad dark centre looks rounded and raised because of a circular painted highlight, although the mesh does not follow that circular boundary. The axe haft (g1:c8) contributes another ten triangles. In the normal material state the head is dark steel; enabling the dormant Avatar layer produces a different appearance and was explicitly excluded from this normal-state comparison.

Magnataur's polearm is a different family within the broad weapon-head category. The main pointed blade (g1:c3) has twenty triangles; four separate spikes (g1:c10–13) have six each; the haft and end fitting (g1:c6) add twenty-seven. Those identified weapon pieces total 71 triangles. Reporting only the 20-triangle blade would omit 24 triangles of silhouette spikes. Gold bolt-like squares and dark channels remain painted on the main blade, while the separate spikes create the unmistakable shape from the game-camera elevation.

Death Knight's five-triangle armour spikes are included in the comparison table as a boundary case: similar pointed solids can belong to armour rather than a weapon. Their carrier and attachment location are retained. The Orc Barracks weapon emblem is a stronger boundary: its axe can be a two-triangle alpha-painted decoration, documented in the environment chapters. It is not a volumetric axe reference merely because the image depicts an axe.

LowPolyWorks' Knight of Nurgle separates a 55-triangle scythe blade body from a 26-triangle cutting-edge component, both mapped to Tomb of Relics. The model thus reuses building paint while giving the silhouette substantially more geometry than Grunt's eight-triangle head. The source sheet identity does not imply that the scythe geometry came from the building. The owner's labelled component records and source-to-part plates retain that distinction.
'''),
('weapons-hafts-grips-and-totems','Hafts, grips and large totem weapons',['weapon-haft','banner-pole','totem-weapon','lance'],'''
Grunt's eight-triangle haft (g8:c2) has six distinct positions and a triangular cross-section at all three measured cuts. The seven stored vertices include one split. Its small UV range across the sheet width and much longer range down the sheet align wood and grip markings along the shaft; the dark horizontal grip bands are painted. This is direct evidence for a three-sided shaft in one native axe, rather than a generic instruction to choose four or five sides.

Mountain King uses different connected pieces for the axe haft (ten triangles) and hammer haft (seven). Their wood, black gripping areas and gold rings are painted into the same surfaces. Blademaster's sword grip also has seven triangles, with alternating gold-brown bands. Knight's sword grip is only three triangles, while his long lance shaft is six. The lance's dark spiral pattern is paint on a long tapered triangular shaft; it does not consist of a helix of modelled wrapping.

Magnataur's twenty-seven-triangle polearm haft includes an end fitting and spans a much longer weapon. Repeated oblique bindings are painted along it. The comparison table keeps its actual principal-axis span next to Grunt's and the smaller grips. Equal triangle counts would not describe equal dimensions, and a grip-only piece should not be confused with the entire haft.

Tauren's weapon demonstrates another solution. Its fourteen-triangle totem (g2:c2) is a large block-like form carrying red glyphs, end grain and pale horizontal bindings. Neither the curling glyphs nor each binding row is separate geometry. A cylindrical-handle rule would fail to describe this weapon: its broad readable painted faces are part of the design.

Blademaster's fourteen-triangle banner pole is also elongated wood, but it has an explicit bend and a different job. It is kept as a banner support family rather than counted as a weapon haft. The shared material vocabulary does not erase the part's function or position on the carrier.
'''),
('armour-shoulders-and-bracers','Shoulder armour and bracers: paint creates inset layers',['pauldron','bracer','greave','armour-cap'],'''
The reviewed shoulder caps make a compact comparison with clear assembly boundaries: Grunt has two eight-triangle metal plates with pale fur edging; Footman has two nine-triangle team-colour caps; Mountain King has two eleven-triangle team-colour plates; Skeleton has two fifteen-triangle shoulder plates before its detached spike faces are counted. These are individual plates, not all shoulder-area geometry or the entire upper arm.

Footman's red cap has a broad white-grey border and a dark inset outline. Mountain King's red plate substitutes a gold border. Grunt's pale irregular fringe is painted on the same component as the dark metal. These three pieces obtain different material and faction readings without requiring a separate mesh for every visible border. Skeleton's gold-rimmed dark plates add detached single-triangle spike faces, so its spiky shoulder assembly must be considered beyond the 15-triangle cap.

Blademaster's bracers (g2:c6 and c26) each use five triangles. Two dark inset bands and multiple gold borders are painted into those few planes. The component views make the distinction plain: the apparent layered metal detail does not have matching geometric recesses. His lower legs combine skin, straps and feet in 25- and 26-triangle components, so they are not interchangeable with the isolated bracer count.

Magnataur's four red leg bands have nine triangles each and its two red wrist bands have eight. Their black borders and painted fur surround the saturated centre. The proportions table shows the much larger carrier context, but its part dimensions remain raw model measurements; World Editor scale is stored separately in category data.

The two pale round ten-triangle Mountain King caps are retained with medium confidence about their exact armour placement. Their shallow faceted form and painted bright centre are observable; assigning an exact body location from the small isolated sample would overstate the evidence. This is an explicit uncertainty, not an excuse to mix them into a broad shoulder budget.
'''),
('armour-shields-and-surfaces','Shields: front, reverse, boss and added ornaments',['shield','shield-back','shield-boss'],'''
Footman's shield front (g2:c1) has nine triangles. The white border and dark outline are painted into that front. Its central steel boss is a separate eight-triangle low-relief component (g1:c14), with a broad light face and dark flank. A shield count based on the front alone would omit the boss; a count based on all arm-weighted vertices would include unrelated armour.

Skeleton also has a nine-triangle shield front, but its wooden reverse is a separate three-triangle part (g1:c16). Detached single-triangle spike faces sit at the shield edge. The common nine-triangle front count does not make these shield assemblies identical: paint, reverse material, boss and spike treatment differ. The dataset therefore retains an assembly relationship rather than flattening all shields into one triangle range.

Graveguard's LowPolyWorks shield is a more elaborate assembled object. Its frame has 204 triangles; the wooden back has 42; the front surface has 42. The back takes paint from the campaign Human Tree, and the front uses the Undead inventory-cover sheet. The front occupies only 6.49% of that sheet in the union of its actual UV triangles sampled at native pixel centres (8,507 of 131,072 pixels). The back covers 72.39% of the tree sheet (23,722 of 32,768 pixel centres). Those are measured used pixels, not rectangles judged visually safe.

A 146-triangle gargoyle-like head plus 6- and 8-triangle fragments decorates that shield, while a 17-triangle Destroyer-painted ornament contributes purple and gold. The owner's credits identify a Blizzard gargoyle head, but the exact native geometry source remains a separate matching question. Texture use from Gargoyle Spire is evidence about paint, not sufficient geometry provenance.

The native Footman and Skeleton examples spend few triangles on the readable front surface. Graveguard invests much more in the frame and attached relief while borrowing an interface sheet for the central face. This specific comparison explains why a native-looking kitbash can have many sheets and a much richer silhouette without painting a new shield atlas.
'''),
('heads-skulls-helmets-and-crowns','Skulls, helmets and crowns: distinguish ornament from head',['helmet','skull','skull-headdress','helmet-horn','helmet-point','head-assembly','jaw'],'''
Footman's helmet shell and visor are 47 triangles; his face and moustache are a separate 44-triangle component. The opening is therefore real geometry around another surface, not merely a dark patch painted on an uninterrupted helmet. The shell uses 59 stored vertices for 29 positions, including ten positions with normal splits. Its steel planes, gold borders and painted rivets cooperate; vertex count alone would overstate the geometric complexity.

Skeleton's 126-triangle skull includes its jaw in one connected component. Necromancer's 166-triangle animal-skull headdress includes two long curved horns and sits over a different 114-triangle human head-and-beard assembly. These are not two samples of the same bare-skull problem. Necromancer's horn growth bands and dark skull cavities are painted, but the long horn curves alter the silhouette geometrically.

Lich's 210-triangle rigid component includes skull, crown and spiked shoulder collar. His 32-triangle pointed lower jaw is articulated separately. Counting every bone near the head as a skull would conceal both the collar and jaw boundary. Mountain King's 123-triangle head assembly likewise includes helmet, face and long beard, with separate 20-triangle moustache and four-triangle brows.

Death Knight devotes 144 triangles to head and white hair. The large bright hair silhouette is a major part of the overhead reading. His skull-faced five- and seven-triangle armour plates provide the opposite approach: the skulls on those plates are mostly painted symbols, with eye sockets visible in paint but not cut out as cavities. The same motif therefore appears as anatomy, headdress and flat armour decoration in three distinct constructions.

The LowPolyWorks Graveguard uses a 56-triangle face skull and sixteen triangles of helmet-wing cards across six components. These parts belong to a new assembly with native texture reuse. Its credit text and exact component source matching are retained independently; a matching skull motif or bone paint is insufficient to assign a copied mesh source.
'''),
('clothing-capes-robes-and-linings','Capes and robes: separate drape, lining and emblem',['cape','cape-lining','robe','sleeve','hood','banner','cloth-panel'],'''
Archer's 33-triangle cloak is one articulated cloth component with a broad team-colour field and dark painted fold shading. Rifleman's visible clothing is divided more explicitly: a 59-triangle hood, 43-triangle shoulder cloak and 13-triangle trailing cape. The trailing cape has a separate eleven-triangle brown lining; the upper lining is another five triangles. Treating the red and brown surfaces as one arbitrary cloth budget would hide this front/back construction.

The Rifleman hood's pointed trailing shape and the cape's bends are geometric. Gold hems, patterned grey-white trim and dark fold bands are painted. The lining is comparatively flat brown. This contrast makes the outside and inside distinguishable without a simulated cloth material. The 13-triangle outside and 11-triangle inside are not identical topology, so a blanket assumption that lining doubles the front count is wrong for this model.

Lich builds his lower silhouette from many narrow flared strips. Eight reviewed short outer strips have five triangles each; three longer strips have ten each. Separate four-triangle dark lining strips sit behind portions of the robe. Repeated four-triangle red gem-like badges attach to the cloth. Their bright square rims and star-shaped highlights are painted, while the independent strip bends make the floating, torn outline.

Necromancer's main skirt has 22 triangles and two wide sleeves have ten each. Two three-triangle side hems complete separate lower surfaces. The broad red fields, gold hem and painted shadows remain legible while the mesh supplies only major drape changes. Death Knight's twelve-triangle cape and Blademaster's twelve-triangle back banner similarly carry complex gold emblems without mesh tracing every emblem line.

These are observed alternatives: Archer's single cloak, Rifleman's hood-plus-cape-and-lining, Lich's many separate strips, and Necromancer's skirt and sleeves. They should remain separate families or subfamilies. Calling all of them a cape and averaging the counts would lose the construction choices that the examples actually teach.
'''),
('ornaments-chains-rings-and-gems','Chains, rings and gems: apparent complexity on thin surfaces',['chain-card','jewellery-card','gem-plate','weapon-ornament'],'''
Lich's hanging chains use four connected ribbons: the upper pair have four triangles each, the lower pair six each. The visible links, gaps and interlocking pattern are painted on those bent strips. There are no individually modelled torus links in these components. Their geometry provides the changing direction of the chain, while the sheet supplies the repetition and metallic highlights.

Blademaster's gold hoop earring and Tauren's U-shaped nose ring each occupy a two-triangle planar surface. The transparent centre and curved outer edge are texture alpha. Their side views become extremely thin. These pieces solve a silhouette-and-paint problem, not a solid jewellery problem, and their planar status is recorded alongside the semantic label.

Mountain King's hammer medallion is another two-triangle overlay. An oval gold rim and a dark steel centre appear on a planar card attached to the hammer face. The hammer underneath is a twelve-triangle box. Separating these pieces explains how a simple solid can carry a curved-looking ornamental insert without adding an oval bevel loop.

Lich's purple arm ornaments have four triangles each. Their rounded purple highlights are painted into gold-bordered plates. His eight red robe badges also have four triangles each, but their square silver rims and star-shaped internal light pattern produce a different material reading. Neither example justifies calling every bright painted patch a modelled gemstone.

LowPolyWorks' Knight of Nurgle uses separate crossed chain cards for the reins. This preserves the useful native ribbon approach while changing the carrier and material. Its reviewed label records distinguish outer and crossing cards on both sides. A future assembly system would need those relationships: one selected card is only one surface of the chain representation.
'''),
('anatomy-hands-fingers-and-face-hair','Hands and facial hair: selective detail around the face',['hand','facial-hair','eye','eye-lid','face'],'''
Tauren's two block hands each have ten triangles. Necromancer's hands each have seven. Both use broad painted surfaces to suggest knuckles and fingers; they are not meshes with every finger separated. The hand silhouettes are compact enough to fit the weapon or book without a full finger rig. These measured examples support a specific observation about these hands, not a rule that all Warcraft hands should be blocks.

Rifleman's face-and-beard component has 94 triangles, while his moustache is a separate 23-triangle piece and each long eyebrow has four. Mountain King has a 20-triangle two-lobed moustache and four-triangle eyebrows beside a 123-triangle head/helmet/beard assembly. Necromancer's moustache has ten triangles beside his 114-triangle head and beard. The facial-hair lobes bend away from the head; their pale hair strands and dark roots are painted on those larger surfaces.

Footman, Mountain King, Rifleman, Knight and Blademaster each have separate one-triangle eye surfaces in the reviewed pieces. A tiny painted iris or dark eye does not need many triangles to be an independent surface. Necromancer's eyelids are two-triangle strips with eyelid rig assignment, distinct from an iris surface. Names alone were not used to invent these labels: the isolated texture, posed position and matching facial context were inspected.

The distribution of effort is uneven within the same character. Rifleman can use one triangle for an eye, four for a brow, 23 for the moustache and 94 for the head-and-beard assembly. The useful knowledge is this hierarchy and the exact component boundary. A broad minimum/maximum across everything called face would discard it.
'''),
('weapons-bows-firearms-books-and-staves','Bows, firearms, books and staves: assemblies with different jobs',['bow','bowstring','quiver','firearm','firearm-fitting','shell-casing','staff','dagger','book'],'''
Archer's recurved bow has 24 triangles. Its angular direction changes and taper carry the weapon's silhouette, while the pale wood and silver binding paint provide material detail. The bowstring uses two four-triangle components in crossing planes. Its visibility from more than one direction comes from this crossed arrangement; it is not a thin cylindrical string.

Archer's twelve-triangle quiver shell carries strong cyan and dark-blue chevrons. The chevrons decorate the shell in paint. The bow, string and quiver remain separate parts with separate placement, rather than being merged into an undifferentiated ranged-weapon count.

Rifleman's 32-triangle connected rifle body includes stock and barrel form. A six-triangle lower fitting, four-triangle narrow strip, two-triangle lock plate and four-triangle lock/trigger silhouette remain separate. The small mechanism's holes and individual-looking pieces are largely alpha paint on the card. Some exact mechanism names are retained as uncertain where the isolated rendering proves a fitting but not its precise function. The ejected shell body is another eight-triangle component associated with the rifle animation, not part of the standing weapon surface budget.

Necromancer's seventy-triangle staff has a connected shaft and angular branched head. Its yellow wrapping and wood/metal colour changes are painted. His two twelve-triangle waist dagger-and-hilt components use gold, green gem paint and dark grip bands. His twenty-triangle book models a thick page block, while the white skull on the black cover and the page-edge stripes are painted.

These examples explain why the category must retain the carrier and sequence. Rifleman's shell belongs to an animation event; Archer's quiver belongs on the back; Necromancer's book belongs in the hand. Matching a texture colour or elongated shape alone would not supply that assembly knowledge.
''')]
for slug,title,families,text in chapters:
 rows=[p for p in parts if p.get('family')in families]
 # Preserve meaningful differences; repeated left/right parts stay in the searchable data.
 seen=set();selected=[]
 for p in rows:
  key=(p['modelId'],p['label'],p['measurement']['triangles'])
  if key in seen:continue
  seen.add(key);selected.append(p)
 lines=['# '+title,'',text.strip(),'','## Measured examples','', '| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |', '|---|---|---:|---:|---|---:|']
 for p in selected:
  m=p['measurement'];model=p['modelPath'].split('\\')[-1];sp=' × '.join(f'{v:.3f}'for v in m['pcaSpansInFootmanHeights'])
  lines.append(f"| {model} g{p['geoset1']}:c{p['component1']} | {p['label']} | {m['triangles']} | {m['storedVertices']} / {m['distinctPositions']} | {sp} | {m['normalSplitPositions']} |")
 lines+=['','The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.','', '## Traceable sources and pictures','']
 bymodel={p['modelId']:p for p in rows}
 for mid,p in bymodel.items():lines.append(f"- `{p['modelPath']}` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/{mid}/index.html).")
 lines+=['','Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).']
 (OUT/(slug+'.md')).write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'chapters':len(chapters),'sourceModels':len(set(p['modelId']for p in parts))}))