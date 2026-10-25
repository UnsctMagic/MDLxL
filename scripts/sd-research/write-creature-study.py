import json, pathlib
ROOT=pathlib.Path('D:/Codex/sd-research');DOC=ROOT/'repo/docs/SD-RESEARCH'; rows=json.loads((ROOT/'data/annotations/native-creatures.json').read_text()); models={r['modelId']:r['sourcePath'].split('\\')[-1][:-4] for r in rows}
def get(name,g,c):return next(r for r in rows if models[r['modelId']]==name and r['geoset1']==g and r['component1']==c)
def link(r):return 'D:/Codex/sd-research/captures/models/'+r['modelId']+'/index.html'
def table(spec):
 out=['| Source model and part | Triangles | Vertices / positions | Raw dimensions X x Y x Z | Measured texture region bounds |','|---|---:|---:|---|---|']
 for n,g,c in spec:
  r=get(n,g,c);out.append('| ['+n+f' g{g}:c{c}'+']('+link(r)+') '+r['label']+' | '+str(r['triangles'])+' | '+str(r['vertices'])+' / '+str(r['distinctPositions'])+' | '+' x '.join(str(round(v,2)) for v in r['size'])+' | '+', '.join(str(round(v,4)) for v in r['uvBounds'])+' |')
 return '\n'.join(out)
def pic(n,label):
 r=next(r for r in rows if models[r['modelId']]==n);return '!['+label+'](D:/Codex/sd-research/captures/models/'+r['modelId']+'/view-1.webp)\n\n[Four angles, wireframe and isolated components]('+link(r)+').'
def write(file,text):(DOC/'subjects/families'/('creature-'+file+'.md')).write_text(text.strip()+'\n',encoding='utf8')
write('wings-spikes-and-animal-feet','''# Membrane wings, shell spikes, and animal claws

Gargoyle, CryptFiend, Huntress and Dryad put different kinds of silhouette detail into different representations. Gargoyle has two-triangle membrane panels held by five-triangle finger struts; CryptFiend has separate three- and five-triangle shell spikes; Huntress paints several claws into each two-triangle card; Dryad gives each hoof nine triangles. These are measured alternatives with identifiable source parts, not a single recommended count for every pointed feature.

'''+table([('gargoyle',1,5),('gargoyle',1,6),('gargoyle',2,6),('gargoyle',2,8),('cryptfiend',1,3),('cryptfiend',1,5),('huntress',2,4),('huntress',1,3),('dryad',1,3),('dryad',1,7)])+'''

Gargoyle's four large membrane components are two triangles and four positions each. Their left/right pairs repeat UV bounds: g1:c5/c7 use u0.317613–0.609482,v0.533866–0.85585, while c6/c8 use another overlapping membrane region. Parallel dark stripes and lighter ridges suggest membrane folds on the same quad. Six main wing fingers use five triangles/five positions each, and two narrow root accents use two triangles each. The broad wingspan comes from a small number of bent panels plus tapering silhouette struts. Calling the entire wing a flat card would miss the separate struts and articulated wing roots.

CryptFiend repeats one abdomen-spike region ten times, once for each three-triangle/five-position edge spike. Those ten spikes all occupy u0.808123–0.993136,v0.895085–0.99965, yet their sizes and orientations change around the abdomen. The four five-triangle thorax spikes reuse a closely overlapping crop. The pale border and dark centre are paint; adding a new surface for every painted bevel would change the construction. CryptFiend's larger arms are 47 triangles each and include hand and trailing cloth, so that count must not be presented as a pure claw count.

Huntress's four panther claw groups each use a single quad. Several white nails appear inside each alpha mask; there is no separate cone for each claw. Its two fangs are even more specific: each uses three positions and two triangles with opposite winding, a double-sided triangular plane. Dryad's four hooves are nine-triangle/seven-position volumes, with front and rear pairs using different UV crops. Their dark cleft is strongly painted. The three examples therefore separate volumetric hoof shape, grouped claw cards, and duplicate-sided fang planes.

'''+pic('gargoyle','Gargoyle: broad membranes and separate team-colour wing fingers')+'\n\n'+pic('cryptfiend','Crypt Fiend: repeated small chitin spikes around a larger connected body')+'\n\n'+pic('huntress','Huntress panther: alpha-painted claw clusters and planar fangs')+'''

Normal and UV splits, exact UV polygons, source materials and isolated images are stored per annotation. The measurements include all authored faces in a named part; a front/back duplicate is still two triangles in that file. These results concern the named native SD models, not all creatures or their HD replacements.
''')
write('heads-ears-tusks-and-hair','''# Heads, ears, tusks, and hair receive different shares of the mesh

The native Gargoyle devotes 191 triangles to its connected head and swept hair, more than the 163 triangles in its connected headless body/limbs/wing roots. Dryad has 114 triangles in its head and leaf-green hair versus 148 in its connected headless body. HeadHunter gives its separate head 113 triangles while its two trousered legs and feet share 97. These component boundaries reveal where detail was spent, but they do not prove that every individual face inside the head component is facial anatomy: hair can be part of the same piece.

'''+table([('gargoyle',1,2),('gargoyle',1,1),('dryad',1,2),('dryad',1,1),('headhunter',2,2),('headhunter',2,4),('witchdoctor',1,2),('herodemonhunter',1,2),('herodemonhunter',1,1)])+'''

HeadHunter's head contains 64 positions and 113 triangles before its separate ears and tusks are counted. WitchDoctor's smaller head has 51 positions and 80 triangles. Each HeadHunter tusk has 15 triangles/ten positions and a pronounced bend; WitchDoctor's corresponding tusks have nine triangles/seven positions and a shorter wedge-like shape. Ochre lengthwise highlights, dark ridges and a pink gum base supply the small texture details in both. This is a narrow family comparison with distinct shapes, not a range pooled from unrelated blades or horns.

'''+table([('headhunter',2,3),('witchdoctor',1,6),('headhunter',2,1),('witchdoctor',1,11),('dryad',1,6),('druidoftheclaw',1,2),('herodemonhunter',1,7)])+'''

HeadHunter and WitchDoctor ears both use four triangles/six positions per ear, but their outlines and dimensions differ. The three Night Elf examples also differ: Dryad has six triangles/five positions, DemonHunter eight/nine, and DruidOfTheClaw nine/seven. The thin inner groove and bright rim are painted on elongated ear surfaces. In raw model space, Dryad's ear spans 35.89 units along X, while its entire head/hair component spans 18.76 along X. DruidOfTheClaw's ears span49.46 and DemonHunter's32.10; these are measured axis-aligned spans, not game-scaled head proportions or template targets.

DemonHunter divides its hair into a 27 triangle topknot and a 141 triangle head/long-hair component. Pale blue stripes run with the swept hair direction on dark masses. HeadHunter instead gives its tall team-colour mohawk 16 triangles/14 positions; fine red strands are paint. WitchDoctor's hanging beard has 12 triangles/13 positions, with a pointed split silhouette and a zigzag team-colour strand pattern. These examples distinguish a smooth large hair volume with painted locks from a thin, angular crest or beard.

'''+pic('dryad','Dryad: head detail and long ears above a very small centauroid body mesh')+'\n\n'+pic('headhunter','HeadHunter: separate tusks, ears and hair crest')+'\n\n'+pic('herodemonhunter','Demon Hunter: swept painted hair and broad tattooed body surfaces')+'''

The body components in this comparison are explicitly mixed. No claim here assigns their entire count to one torso, skull or limb. The data records preserve those boundaries so a later system can subdivide them further without inheriting a misleading label.
''')
write('pelts-clothing-and-paint','''# Pelts, clothing, hands, and decoration painted across simple shapes

DruidOfTheClaw's bear-mouth hood is a 112 triangle/58 position component visible during the ordinary humanoid Stand. It sits above the Night Elf face, with a red interior mouth and pale painted teeth. It is not the alternate bear body: that separate connected bear component has 366 triangles and is hidden at the sampled humanoid Stand. The same file deliberately carries both the worn animal motif and a transformation body.

'''+table([('druidoftheclaw',3,1),('druidoftheclaw',4,1),('druidoftheclaw',1,5),('shaman',1,1),('shaman',1,9),('shaman',2,3),('witchdoctor',3,1),('dryad',1,9),('dryad',4,1)])+'''

DruidOfTheClaw's paired skull ornaments are four-triangle/six-position bent cards. Their eye sockets, cheeks and jaw are painted. Its alternate bear claw groups are four-triangle surfaces carrying several pale claws, while several fur silhouette pieces are only two triangles each. A detailed skull or animal foot in a contact sheet is therefore insufficient evidence of a solid skull or individual claw mesh; the isolated wireframe and component count settle the construction.

Shaman uses a 262 triangle connected component that includes green orc face/body and the pale wolf-pelt hood. The headwear cannot honestly be measured as 262 helmet triangles. Its visible long dark hand-claw blades are separate nine-triangle/seven-position pieces; the bent tip and outer edge are geometry, with a narrow pale highlight painted along the surface. The chest chain is a four-triangle/six-position bent strip with painted links. Two necklace tooth cards have two triangles each and contain several painted tooth shapes. These are native examples of jewellery that depends on alpha or painted spacing rather than interlocking geometry.

WitchDoctor's cloak is 48 triangles/34 positions, with a real neck opening and broad folded outline. The numerous pale stripes and dark channels are painted on those broad surfaces. Dryad's paired leaf forearm guards use eight triangles/five positions each, so a cluster of painted leaf shapes shares one bent guard. Her javelin tip uses two perpendicular four-triangle card planes; branches and leaves within the silhouette are alpha painting. The raw spear shaft is seven triangles/six positions, separate from the leafy end.

'''+table([('headhunter',2,9),('witchdoctor',1,4),('dryad',1,10),('herodemonhunter',1,6),('shaman',1,5),('huntress',1,1),('huntress',1,2)])+'''

Hand forms also change by use. HeadHunter's closed hand is seven triangles/six positions; DemonHunter and Shaman closed hands are nine/seven; Dryad's mittenlike hand is eleven/eight. These components have painted knuckle/finger divisions instead of independently jointed fingers. WitchDoctor's 26 triangle arms include their blocklike hands, so they are recorded as arms rather than compared directly with the isolated seven-triangle hand.

Huntress makes its rider 232 triangles/140 positions and its panther body 221/118 before separate weapon, shoulder colour, claws and fangs. This near split is specific to that rider/mount pair. The proportions and armour scrolls in the rider are not evidence that the mount should inherit a humanoid body budget.

'''+pic('druidoftheclaw','Druid of the Claw: visible bear-mouth hood and separate transformation geometry')+'\n\n'+pic('shaman','Shaman: wolf pelt, claw weapon and painted chain')+'\n\n'+pic('witchdoctor','Witch Doctor: broad cloak folds with pale painted stripes')+'''

These nine native models received 166 visually reviewed semantic component annotations. A few generic wearable spikes retain medium confidence where isolation proves the shape but not an exact claw-versus-armour interpretation. Hidden transformation and death components remain explicitly marked. The comparison concerns authored geometry and painting, not Warcraft runtime acceptance or a proposed modelling tool.
''')
print('3 creature chapters written')
