import json, pathlib, math, re
ROOT=pathlib.Path('D:/Codex/sd-research'); REPO=ROOT/'repo'; DOC=REPO/'docs/SD-RESEARCH'; D=ROOT/'data'
observations=json.loads((DOC/'data/native-environment-observations.json').read_text())
models={}; captures={}; annotations=[]
for o in observations:
 mid=o['modelId']
 if mid not in models:
  models[mid]=json.loads((D/'parts'/f'{mid}.json').read_text())
  captures[mid]=json.loads((ROOT/'captures/models'/mid/'capture.json').read_text())
 m=models[mid];c=captures[mid];p=next(x for x in m['parts'] if x['id']==o['partId']);ci=next(i for i,x in enumerate(c['components']) if x['id']==o['partId']);pc=c['components'][ci]
 a={**o,'sourcePath':m['logicalPath'],'triangles':p['triangles'],'vertices':p['vertices'],'distinctPositions':p['distinctPositions'],'visibleAtSample':p['visible'],'sample':m['sample'],'size':p['bindBounds']['size'],'normalSplitPositions':p['normalSplitPositions'],'uvSplitPositions':p['uvSplitPositions'],'boundaryEdges':p['boundaryEdges'],'crossSections':p['crossSections'],'uvBounds':p['uv']['bounds'],'uvTriangles':p['uv']['triangles'],'texturePaths':list(dict.fromkeys(t['path'] for g in m['geosets'] if g['geoset1']==p['geoset1'] for l in g['layers'] for t in l['textureSlots'] if t.get('path'))),'modelTexturePaths':m['sheets'],'replacementBindings':c.get('replacementBindings',[]),'capture':str(ROOT/'captures/models'/mid/pc['file']),'contactSheet':str(ROOT/'captures/models'/mid/f'components-sheet-{math.floor(ci/20)+1}.webp'),'captureSide':str(ROOT/'captures/models'/mid/pc['sideFile'])}
 annotations.append(a)
(D/'annotations').mkdir(exist_ok=True)
for dest in [D/'annotations/native-environment.json',DOC/'data/native-environment.json']:dest.write_text(json.dumps(annotations,indent=2),encoding='utf8')
def source(short):
 return next(m for m in models.values() if m['logicalPath'].endswith('\\'+short+'.mdx'))
def part(short,g,c):
 m=source(short);return next(a for a in annotations if a['partId']==m['id']+f':g{g}:c{c}')
def link(a):
 return 'D:/Codex/sd-research/captures/models/'+a['modelId']+'/index.html'
def table(specs):
 rows=['| Model and exact part | Triangles | Vertices / positions | Bind size X x Y x Z | UV bounds |','|---|---:|---:|---|---|']
 for short,g,c in specs:
  a=part(short,g,c);rows.append('| ['+short+f' g{g}:c{c}'+']('+link(a)+') '+a['label']+' | '+str(a['triangles'])+' | '+str(a['vertices'])+' / '+str(a['distinctPositions'])+' | '+' x '.join(str(round(x,2)) for x in a['size'])+' | '+', '.join(str(round(x,4)) for x in a['uvBounds'])+' |')
 return '\n'.join(rows)
def picture(short,title):
 m=source(short);return '!['+title+'](D:/Codex/sd-research/captures/models/'+m['id']+'/view-1.webp)\n\n[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/'+m['id']+'/index.html).'
def write(name,text):
 out=DOC/'subjects/families';out.mkdir(parents=True,exist_ok=True);text=re.sub(r'(?<=[a-z])(?=\d+(?:triangle|tri\b|vertices|positions|side|units|model|serialized|bindings|shared|environment|visually))',' ',text)
 text=re.sub(r'(?<=\d)(?=(?:triangles?|tri\b|vertices|positions|sides?|units?|model|serialized|bindings|shared|environment|visually|high|across|gold|capped|larger|smaller|distinct|normal))',' ',text)
 (out/('environment-'+name+'.md')).write_text(text.strip()+'\n',encoding='utf8')
write('roofs-and-chimneys', '''# Roofs, chimney pots, and the Farm atlas

The Human Farm and Elven Farm spend different geometry on related painted areas. Human Farm's main house is one54 triangle connected component containing walls and roof; Elven Farm's comparable component has 62 triangles. Counting either entire component as a roof would mix the house walls into the roof family. The isolated components and surface patches provide the separation needed for inspection.

'''+table([('farm',2,2),('farm',2,3),('farm',2,9),('farm',2,10),('elvenfarm',1,2),('elvenfarm',1,7),('elvenfarm',1,8),('humanbarracks',1,3),('humanbarracks',1,6),('watchtower',2,2),('orcbarracks',2,1),('orcbarracks',2,2)])+'''

In Human Farm, each chimney pot has 13 triangles,34serialized vertices and ten distinct positions. Five sampled sides stay five at 25%,50% and 75% of the principal length. Its sides account for ten triangles; the top is a flat three-triangle cap. The black round mouth is paint on that cap, not an open hole with an interior wall. Both pots reuse UV bounds(0.121094,0.691406) to(0.25,0.765625) of Buildings/Human/Farm/House.blp, though their heights differ: 12.095 and 13.796model units. This is a precise example of a convincing dark cavity made without cavity geometry.

Human Farm's detached dormer roof has ten triangles. Elven Farm's two dormer roofs use eight each, with a curved ridge outline and painted fine straw. The corresponding roof regions lie at about u0.502–0.784,v0.502–0.69 on the respective House and ElvenFarm sheets. Elven Farm's two25 triangle ornamental supports sample the same part of ElvenFarm's atlas that Human Farm's brick chimney mainly occupies on House. Their gold looping pattern replaces brick while the UV layout remains closely related. This is a same-layout artistic substitution, not evidence that the complete models share geometry.

Human Barracks makes its long main tiled roof from four triangles and each of its four pyramidal tower caps from four. Orc WatchTower's six-triangle roof is a six-sided pyramid with seven positions. On both roofs, the dozens of painted red tiles, edge glints and overlapping shingle rows greatly outnumber the actual faces. Orc Barracks instead models a radial24 triangle upper roof and a 32 triangle lower ring with an open centre. Its dark wooden spokes and team-colour perimeter marks follow the radial sheet region; the connected roof geometry carries broad bends, while much thinner spoke detail remains paint.

'''+picture('farm','Human Farm: broad painted surfaces and two tiny chimney pots')+'\n\n'+picture('watchtower','Orc WatchTower: six roof faces carry a densely painted shingle field')+'''

Coordinates above are bounds of measured UV triangles, not empty-space guarantees or recommended rectangles. The exact polygons are retained in native-environment.json and the UV overlay. Sizes are raw bind-space dimensions, without official game object scale. These examples are native Blizzard SD; no LowPolyWorks building counterpart was asserted.
''')
write('wood-stone-and-stairs','''# Architectural wood, stone, and painted stairs

Human Farm, Elven Farm and Orc Barracks all use stair paintings to imply more treads than their geometry contains. Human Farm g2:c12 and Elven Farm g1:c6 each have four triangles and six positions; their UV bounds are exactly equal despite different texture sheets. Their grey tread lines sit on a bent surface with no series of individual risers. Orc Barracks g3:c7 uses eight triangles, adding timber-sided volume around a painted stair face.

'''+table([('farm',2,12),('elvenfarm',1,6),('orcbarracks',3,7),('farm',2,1),('humanbarracks',2,6),('humanbarracks',2,8),('orcbarracks',1,4),('watchtower',1,4),('watchtower',1,5),('watchtower',1,8),('watchtower',1,35)])+'''

Human Farm's foundation has eight triangles and eight positions; rough stone blocks are painted on an open shell. The Human Barracks entrance g2:c1 uses16 triangles to preserve a real arch opening. Its25 triangle side wall sections model crenellation silhouettes, while their masonry joints and window darkness stay on the sheet. Each24 triangle corner tower shell has an overhanging upper rim, but the many stone courses are painted. These are different choices: an opening that changes the silhouette receives geometry, while a window that only changes the wall's appearance may remain dark paint.

Orc Barracks' six ten-triangle stone pillars reuse the same roughstone-with-timber-rim region of OrcBarraks.blp. Their stones are not individual pieces. Its four six-triangle wooden beams have a row of painted metal studs; the studs are not separate objects. Orc Barracks' skull plaque g1:c25 is also a six-triangle bent board with a skull painting. The nearby shield-and-weapon emblems g1:c1/c11 each occupy one two-triangle alpha card, and the hanging axe head g1:c19 is another two-triangle card. They must not be treated as reusable solid weapon geometry merely because the isolated image looks like a shield or axe.

Orc WatchTower separates its frame into three-sided six-triangle slender braces, four-sided eight-triangle tall posts, and ten-triangle capped short posts. A structural cross-section can therefore change within one model according to the piece. Its twisted rope g1:c35/c36 is a two-triangle card; most rope wraps on posts are painted directly into the post texture. WatchTower's two16 triangle skulls have twelve positions each, modeling the outer head and jaw taper while eye sockets and teeth are dark and pale paint.

'''+picture('humanbarracks','Human Barracks: real arch and crenellation silhouette, painted masonry')+'\n\n'+picture('orcbarracks','Orc Barracks: broad material masses and some completely flat weapon emblems')+'''

These conclusions compare the named native components only. The annotation table preserves exact triangles, normal splits, UV splits and capture evidence per piece; it does not generalize one brace count to every Warcraft beam.
''')
write('trees','''# Tree trunks, bent leaf cards, and object-bound texture variants

AshenTree0, LordaeronTree0 and RuinsTree0 do not specify a normal named texture on their main material. The installed destructible skin table supplies it. ATtr binds replacement 32 to ReplaceableTextures/AshenvaleTree/AshenTree, LTlt binds 31 to ReplaceableTextures/LordaeronTree/LordaeronSummerTree, and ZTtw binds 36 to ReplaceableTextures/RuinsTree/RuinsTree. The study captures record those object bindings. A black tree produced by ignoring replacement slots is a renderer omission, not evidence of the original tree painting.

'''+table([('ashentree0',1,1),('ashentree0',1,2),('ashentree0',1,3),('ashentree0',1,4),('lordaerontree0',1,1),('lordaerontree0',1,2),('lordaerontree0',1,5),('ruinstree0',1,1),('ruinstree0',1,2),('lordaerontree0',2,2)])+'''

LordaeronTree0 has a 12 triangle trunk and four separate four-triangle bent canopy cards. Each canopy card has only five positions; dense leaves, branch gaps and irregular outer silhouettes come from alpha painting. Three larger cards repeat exactly the same UV bounds, while the smallest crown uses another patch. The six-sided trunk has no normal splits at shared positions, unlike the hard-faceted Icecrown crystal. Its bark fissures and light streaks are painted vertically.

AshenTree0 also uses four-triangle/five-position leaf cards, but only three of them. Two sample the upper-left foliage region and one the lower-left region. Its31 triangle bent trunk uses six-sided sampled sections and a pointed upper silhouette. RuinsTree0 takes another construction: its24 triangle curved palm trunk has three-sided sampled sections, while the entire palm-frond canopy is one12 triangle/nine-position bent component. Individual leaflets and fine stems are painted cutouts; their visibility does not imply hundreds of thin frond meshes.

All three tree files also carry a 16 triangle stump and three three-triangle fallen-foliage cards, hidden during the sampled Stand. Their stump UV bounds match, including the endgrain region, even though the three bound sheets paint different bark treatments. A whole-file tree count would include this post-death geometry. The ordinary standing tree counts here are 43 triangles for AshenTree0, 28 for LordaeronTree0 and 36 for RuinsTree0.

The installed bindings make reuse more interesting than one model/one texture: CTtr uses the AshenTree prefix with FelwoodTree, ITtw uses it with Ice_Tree, and FTtw/WTtw/WTst use the LordaeronTree prefix with Fall/Winter/Snow sheets. Their texture assignments are explicit data, not filenames guessed by the study. world-editor-replaceables.json preserves 219 active SD bindings, including multiple objects sharing one model prefix.

'''+picture('ashentree0','AshenTree0 with official ATtr texture assignment')+'\n\n'+picture('ruinstree0','RuinsTree0: one canopy component paints the individual palm leaflets')+'''

A model-only atlas query must carry the object identity when the same replacement slot can have several valid sheets. The examples above concern variant 0 and do not assume all ten Lordaeron variants have the same trunk or canopy counts.
''')
write('props-and-crystals','''# Crates, barrels, coins, and crystal facets

Crates0 uses two bottomless boxes with ten triangles each. Both have eight distinct positions and 20serialized vertices, with four boundary edges around the omitted underside. The top's diagonal timber brace, the side planks, dark inset corners and edge highlights are entirely painted. The two crates differ in shape: one is 20.775 units tall and the other 37.95, but they reuse nearly identical regions of Doodads0-0.blp.

'''+table([('crates0',1,1),('crates0',1,2),('floatingbarrel',1,1),('treasurechest',1,1),('treasurechest',1,2),('treasurechest',1,3),('icecrown_crystal0',1,1)])+'''

FloatingBarrel's single60 triangle closed component has 32 positions: three rings of ten perimeter positions and two cap centres. Each end cap has ten triangles;40 triangles connect the rings. The body bulge is geometric. The alternating wooden staves, grooves, and metal hoops are painted on the same surface; neither hoops nor planks are separate parts. Its UVs repeatedly crop the barrel side region of Doodads0 rather than mapping each side to a unique sheet area.

TreasureChest's main bowl and gold surface are 20 triangles, its raised lid 18, and its lock block 10. The apparently numerous gold coins are a continuous four-triangle patch. The silver rim and wood panels change colour without creating one component per material; the main bowl remains connected. The chest's four two-triangle star cards belong to a separate sparkling presentation layer, with only two visible in the sample, so they are distinct from the modeled chest body.

Icecrown_Crystal0 has 48 triangles,144serialized vertices and 31distinct positions. Every triangle therefore has its own vertices, and all31shared positions have split normals. That makes a different construction from the smooth tree trunks and barrel: geometry deliberately supports faceted shading. Its cyan-white diagonal streaks and dark teal lower areas remain on crystal.blp. The mesh is a joined cluster, so its principal cross-section corner counts 24/25/14 are measurements through the cluster, not a claim that every individual crystal is a24-sided prism.

'''+picture('floatingbarrel','FloatingBarrel: a bulged closed mesh with painted hoops')+'\n\n'+picture('treasurechest','TreasureChest: one painted gold surface stands in for many coins')+'\n\n'+picture('icecrown_crystal0','Icecrown crystal: split normals and painted cyan streaks')+'''

These are source-specific examples of material meaning and mesh topology disagreeing: visible silver/wood/gold need not mean three separate meshes, while the crate can split vertices for normals and UV seams without increasing the eight geometric corners.
''')
write('banners','''# Banners, poles, and decoration cards

BannerHuman0 and BannerOrc0 share Textures/Doodads0.blp. Their blue and red cloth are painted colours, not proof of team colour: neither doodad uses a team-colour replacement texture. In contrast, the Human Barracks and Orc WatchTower banners use team-colour material treatment. This distinction matters when a region is chosen for its apparent red cloth.

'''+table([('bannerhuman0',1,1),('bannerhuman0',1,7),('bannerhuman0',1,8),('bannerhuman0',1,3),('bannerorc0',1,6),('bannerorc0',1,3),('humanbarracks',1,1),('watchtower',2,1)])+'''

BannerHuman0's cloth is five triangles and seven positions, occupying u0.25098–0.498039,v0.25098–0.498039. BannerOrc0's cloth is six triangles and eight positions in the adjacent lower-left patch, u0–0.247059,v0.247059–0.494118. The Human hanging cloth measures 73.67 units in height and 40.60across; the Orc panel is 72.93high and 71.95across. The differing silhouette comes from panel proportions and edge shape, while emblem, fold highlights and dark creases are painted.

Both doodads use seven-triangle three-sided vertical masts and eight-triangle three-sided crossbars. All four parts sample the same narrow wood-and-binding strip, u0.964706–0.996078,v0.505882–1. BannerHuman0 adds four three-triangle planar metal finial cards, crossed in perpendicular planes. Bright steel facets are texture painting on cards. Its five-triangle gold tassel is also planar. BannerOrc0 instead has a 23 triangle pale finial; the sampled views used here establish a bone-coloured volume, but do not establish enough frontal detail to label it a skull with high confidence.

'''+picture('bannerhuman0','Human banner: blue painted panel and three-sided poles')+'\n\n'+picture('bannerorc0','Orc banner: wider fixed-red panel on the same atlas')+'''

The UV coordinates refer to actual measured triangles. They are not guaranteed clean rectangles: the exact masks and neighbouring painted content remain visible in the source overlays. These14environment models received 156visually reviewed component annotations; this chapter does not claim all corpus banners have been individually reviewed.
''')
print(json.dumps({'models':len(models),'annotations':len(annotations),'chapters':5}))
