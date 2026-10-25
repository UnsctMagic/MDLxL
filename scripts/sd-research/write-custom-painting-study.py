import json,pathlib
R=pathlib.Path('D:/Codex/sd-research');D=R/'data';DOC=R/'repo/docs/SD-RESEARCH';a=json.loads((D/'annotations/custom-painting-parts.json').read_text('utf8'));atlases=json.loads((D/'custom-painting-atlases.json').read_text('utf8'))
def table(h,rs):return '| '+' | '.join(h)+' |\n| '+' | '.join('---' for _ in h)+' |\n'+'\n'.join('| '+' | '.join(str(x) for x in r)+' |' for r in rs)+'\n'
def row(mid,g,c):
 r=next(x for x in a if x['modelId']==mid and x['geoset1']==g and x['component1']==c);return [f'g{g}:c{c}',r['label'],r['triangles'],r['mappedPixelCentres'],f"{r['atlasPixelFraction']*100:.2f}%",f"{r['alphaBelow128Fraction']*100:.1f}%"]
text='''# Custom painting: scales, iron and stitched leather

These are direct studies of Gluma's Saurus Warrior and Saurus Warrior Hero, and HerrDave's Greenskin - Black Orc and Warhammer Witch Hunter. Their custom source images are each 256 × 256 pixels. The comparison uses actual UV triangle footprints, not guessed safe rectangles. The 127 selected component records retain exact UV triangles and decoded pixel measurements in [custom-painting-parts.json](../../data/custom-painting-parts.json).

'''
text+=table(['Model','Custom sheet','Distinct pixel centres mapped by any authored face','Fraction of sheet'],[[r['modelId'],r['texturePath'],r['mappedWholePixels'],f"{r['mappedFraction']*100:.2f}%"] for r in atlases])
text+='''
Coverage is the union of mapped pixel centres, including overlap only once. Unmapped pixels can include padding or unused painted regions; this count does not equate them with waste. Per-part percentages below may overlap because repeated parts can reuse the same paint. Alpha is sampled from the original BLP decoder, including JPEG alpha, rather than inferred from thumbnail colour.

## Gluma: one scale vocabulary at several sizes

![Saurus Warrior](D:/Codex/sd-research/captures/models/lpw-gluma-137328/view-1.webp)
![Saurus source paint](D:/Codex/sd-research/pictures/custom-painting/76b4080da83350b329b3c7448a1ecf2dcf9ce516fa4fe0c5b3d73128c9f3eccd.png)

Saurus Warrior's 466-triangle connected body uses 29,515 distinct pixels, or 45.04% of the sheet. Most scales do not alter the silhouette. They are irregular blue cells with a pale cyan edge and dark blue lower boundary, ranging from small shoulder dots to large cranial plates. The smaller arm scales keep the same bright-edge/dark-border relationship as the enlarged head plates, so the viewer reads one hide across differently sized body regions. The model's projecting head horns are separate four- or six-triangle shapes with a simple yellow-to-dark-root gradient.

The twenty-triangle club head uses 4,059 pixels, or 6.19% of the sheet. Its repeated round golden studs and square end ornament are painted. Six separate six-triangle edge teeth supply the genuinely projecting silhouette. The two orange eyeballs are seventy triangles each but each maps only 177 distinct pixel centres: mesh complexity and paint allocation are very different quantities in this model.

'''
text+=table(['Part','Observed use','Triangles','Mapped pixels','Sheet share','Alpha below 128'],[row('lpw-gluma-137328',g,c) for g,c in [(3,1),(3,15),(3,17),(3,19),(4,1),(4,2),(4,4)]])
text+='''
Saurus Warrior's shield and pointed gold ends share the same material with team colour underneath. Yet 48.6% of the shield's mapped pixel centres have alpha below 128, versus 0% on either gold point. The shield's painted outlines and local highlights remain while the cell interiors admit team colour; the opaque gold ends preserve their own material identity. The wrist bands expose 22.8% of their region below 128. A material-level label would incorrectly treat all those parts as equally team-coloured.

Saurus Warrior stores 942 triangles and samples 904 visible body triangles. Saurus Warrior Hero stores 918 and samples 916, of which 12 are hero-glow cards; its body is again 904. Both use the same custom texture hash. The unit stores 36 triangles of corpse pieces plus a hidden two-triangle portrait card; the hero stores the portrait card and 12 glow triangles. This pair does not support a claim that a hero necessarily receives a more detailed body.

## HerrDave: broad metal highlights and tiny repeated details

![Black Orc](D:/Codex/sd-research/captures/models/lpw-herrdave-87376/view-1.webp)
![Black Orc source paint](D:/Codex/sd-research/pictures/custom-painting/9280717815d516714ea09de8c6bd0168c455f2b911d5159aa594a5301be3575d.png)

Greenskin - Black Orc's custom sheet is overwhelmingly grey-brown metal, horn, mail and fittings. Its green skin is supplied separately by Hellscream, and the large shoulder skull/horns by Necromancer. Calling the custom sheet an orc-skin atlas would miss its actual role. The closed 129-triangle helmet maps 17.61% of the custom sheet; pale rim lines and deep vertical slit marks make the face read beneath its broad polished dome. The 103-triangle torso mixes large plate highlights with very fine chainmail rings at its lower edge.

The repeated twelve-triangle waist plates use only 99 pixel centres per plate in one sampled crop. They remain legible because a broad diagonal highlight and a narrow pale border survive that small allocation. At the other extreme, the fifteen-triangle skull buckle maps 4,068 pixels, 6.21% of the atlas. Its skull identity is strongly painted on a shallow bent plate. The shield rivets are two-triangle cards with the round outline and central slot painted; each shares the same 196-pixel footprint.

'''
text+=table(['Part','Observed use','Triangles','Mapped pixels','Sheet share','Alpha below 128'],[row('lpw-herrdave-87376',g,c) for g,c in [(4,1),(4,6),(4,9),(4,18),(7,1),(7,3),(7,4)]])
text+='''
## HerrDave: leather seams and fasteners travel with the UVs

![Witch Hunter](D:/Codex/sd-research/captures/models/lpw-herrdave-75064/view-1.webp)
![Witch Hunter source paint](D:/Codex/sd-research/pictures/custom-painting/ef276c863ba4eac1239d92ab2ee7e33532545a6ced5cb5db06e6def191f0c9f8.png)

Warhammer Witch Hunter puts the face, red-brown coat, white fabric, weapons, book and seals on one custom sheet. The 98-triangle torso has painted silver fasteners with black undersides and white top glints; the thirty-triangle coat skirt repeats long vertical rows of buttonholes. Those repeated metal marks have no separate button meshes in these components. The 64-triangle hat carries curved stitched seams on smooth panels: highlights brighten toward each seam's upper edge while dark stitching breaks up the line.

The eight-triangle book cover includes its painted studs and skull emblem. Each four-triangle wax-seal/scroll component includes the round red skull seal, yellow parchment, tiny horizontal writing strokes and the irregular paper edge in the texture. The pistol barrel and grip cost thirty triangles; the long steel highlight and dark muzzle mark are painted within that compact mesh.

'''
text+=table(['Part','Observed use','Triangles','Mapped pixels','Sheet share','Alpha below 128'],[row('lpw-herrdave-75064',g,c) for g,c in [(1,1),(1,5),(2,2),(2,7),(2,9),(2,17),(2,22),(5,2)]])
text+='''
Warhammer Witch Hunter's face and boots share a material with team colour underneath, but the face region has 0% of pixels below alpha 128 while a boot region has 15.5%. The coat skirt is almost entirely opaque: only 0.3% of mapped pixels are below full opacity. Team colour therefore must be measured through each part's actual UV footprint and alpha, rather than assigned to every part in the material.

These three sheets differ in how they allocate contrast. Saurus uses repeated bounded scale cells and localized gold; Black Orc uses soft broad metal gradients, thin borders and sparse high-frequency mail; Witch Hunter uses deep red fields with tiny pale stitches, fasteners and scroll writing. All three reserve geometry for conspicuous silhouettes and use paint for finer repeated detail, but the actual examples and allocations above show where each artist made that tradeoff.

The offline exact-mask picture sheets are in [custom-painting](D:/Codex/sd-research/pictures/custom-painting). They show the mapped regions for every selected part; they are not proposed reusable rectangles. Shader tint, lighting and display scale can change perceived colour. These observations describe the decoded paint and reviewed research captures, without claiming in-game verification.
'''
(DOC/'subjects/materials').mkdir(exist_ok=True);(DOC/'subjects/materials/custom-painted-scales-iron-leather.md').write_text(text,encoding='utf8')
print('Wrote custom-painted-scales-iron-leather.md')
