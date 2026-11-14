import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {createDemoDocument,openDocument,validateModel} from '../src/editor-document.js';
import {fitRibbonToPolygons} from '../src/particle-ribbon-fit.js';
import {RIBBON_SWEEPS,SWEEP_TEXTURES,sweepRibbonFit} from '../src/ribbon-sweeps.js';
import {RIBBON_TEXTURE} from '../src/particle-starters.js';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
import {validateParticleRecipe} from '../src/particle-recipes.js';
import {sampleNodeMatrices} from '../src/animation.js';
import {gamePathKey} from '../src/game-path.js';
import catalogue from '../electron/data/texture-library-catalog.json' with {type:'json'};

const SECTIONS=['Nodes','PivotPoints','Materials','Textures','GlobalSequences'];
// A 100-unit blade on an animated, unevenly scaled bone, with three clips.
function fixture(height=100){
 const doc=createDemoDocument();doc.apply('Make test weapon',['Geosets','Nodes','Sequences'],m=>{
  const g=m.Geosets[0];g.Vertices=new Float32Array([20,4,0,22,4,0,22,4,height,20,4,height]);g.Normals=new Float32Array(12);g.TVertices=[new Float32Array(8)];g.Faces=new Uint16Array([0,1,2,0,2,3]);g.VertexGroup=new Uint8Array(4);g.Groups=[[0]];
  m.Sequences=[0,1,2].map(i=>({...m.Sequences[0],Name:'Clip '+i,Interval:new Uint32Array([i*3000,i*3000+2000])}));
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([0,0,0])},{Frame:2000,Vector:new Float32Array([17,-9,23])}]};
  m.Bones[0].Rotation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([0,0,0,1])},{Frame:2000,Vector:new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(1,1,0).normalize(),2).toArray())}]};
  m.Bones[0].Scaling={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([2,.5,1.5])}]};
 });return doc;
}
const placement=fit=>({ribbon:fit,sequences:[0,2],sequence:2,from:0,to:'',parent:String(fit.parent),position:[0,0,0],motion:'target',fit:true});
const place=(doc,fit)=>{let placed;doc.apply('Add particle effect',SECTIONS,m=>{placed=placeTimedParticleRecipe(m,fit.recipe,placement(fit),{convertHD:true});});return placed;};
const elements=RIBBON_SWEEPS.map(([id])=>id).filter(id=>id!=='plain');

test('the choice lists Plain first, then the elements',()=>{
 assert.deepEqual(RIBBON_SWEEPS[0],['plain','Plain']);
 for(const name of ['Fire','Frost','Lightning','Spirit','Fel'])assert.ok(RIBBON_SWEEPS.some(([,label])=>label===name),name);
 assert.equal(new Set(RIBBON_SWEEPS.map(([id])=>id)).size,RIBBON_SWEEPS.length);
});
test('Plain is the ribbon Add ribbon always made, byte for byte',()=>{
 const before=fixture(),after=fixture(),selection={0:[0,1,2,3]};
 const fit=fitRibbonToPolygons(before.model,selection),chosen=sweepRibbonFit(fitRibbonToPolygons(after.model,selection),'plain');
 assert.deepEqual(chosen.recipe,fit.recipe);
 place(before,fit);place(after,chosen);
 for(const format of ['mdx','mdl'])assert.deepEqual(new Uint8Array(after.serialize(format)),new Uint8Array(before.serialize(format)),format);
 // Trying an element first and going back leaves no trace.
 const third=fixture(),back=sweepRibbonFit(sweepRibbonFit(fitRibbonToPolygons(third.model,selection),'fire'),'plain');
 place(third,back);assert.deepEqual(new Uint8Array(third.serialize('mdx')),new Uint8Array(before.serialize('mdx')));
});
for(const kind of elements)test(kind+' sweep: a ribbon and emitters along the fitted edge, ordinary and undoable',()=>{
 const doc=fixture(),before=structuredClone(doc.model),fit=sweepRibbonFit(fitRibbonToPolygons(doc.model,{0:[0,1,2,3]}),kind);
 validateParticleRecipe(fit.recipe);
 const placed=place(doc,fit),model=doc.model,nodes=placed.ids.map(id=>model.Nodes[id]);
 const ribbons=nodes.filter(node=>model.RibbonEmitters.includes(node)),emitters=nodes.filter(node=>model.ParticleEmitters2.includes(node));
 assert.equal(ribbons.length,1);assert.ok(emitters.length>=1,'A sweep adds at least one emitter');assert.equal(nodes.length,1+emitters.length);
 assert.equal(model.RibbonEmitters.length,1);assert.equal(model.ParticleEmitters2.length,emitters.length);
 const ribbon=ribbons[0],stock=new Set([RIBBON_TEXTURE,...SWEEP_TEXTURES]);
 assert.equal(model.Nodes[placed.ids[0]],ribbon,'The ribbon is selected after Create');
 assert.equal(model.Textures[model.Materials[ribbon.MaterialID].Layers[0].TextureID].Image,RIBBON_TEXTURE);
 assert.equal(ribbon.HeightAbove,50);assert.equal(ribbon.HeightBelow,50);
 for(const emitter of emitters){
  assert.ok(stock.has(model.Textures[emitter.TextureID].Image)&&/^Textures\\/.test(model.Textures[emitter.TextureID].Image),'Stock game picture: '+model.Textures[emitter.TextureID].Image);
  assert.equal(emitter.Parent,fit.parent,'Rides the weapon bone directly');
  assert.deepEqual(emitter.Visibility,ribbon.Visibility,'Shows exactly when the ribbon does');
  assert.deepEqual(emitter.Rotation,ribbon.Rotation);
  assert.ok(emitter.EmissionRate>0&&emitter.LifeSpan>0&&emitter.LifeSpan<=1);
  assert.equal(emitter.Flags&524288,0,'Particles stay behind in the world, as a trail');
  // Its emitting strip lies on the fitted edge in every pose, inside the two ends.
  for(const frame of [0,570,1190,2000,6000,7300,8000]){
   const sequence=frame<3000?0:2,matrices=sampleNodeMatrices(model,frame,sequence),bone=matrices.get(fit.parent);
   const [low,high]=fit.endpoints.map(point=>new Vector3(...point).applyMatrix4(bone)),edge=high.clone().sub(low);
   for(const y of [-emitter.Length,emitter.Length]){
    const point=new Vector3(...emitter.PivotPoint).add(new Vector3(0,y,0)).applyMatrix4(matrices.get(emitter.ObjectId)),along=point.clone().sub(low).dot(edge)/edge.lengthSq();
    assert.ok(along>0&&along<1,`End inside the edge (${along})`);
    assert.ok(point.distanceTo(low.clone().addScaledVector(edge,along))<1e-3,'End on the edge');
   }
  }
 }
 assert.deepEqual(validateModel(model).filter(item=>item.severity==='error'),[]);
 assert.deepEqual(model.Geosets,before.Geosets);assert.deepEqual(model.Bones,before.Bones);assert.deepEqual(model.Sequences,before.Sequences);
 for(const format of ['mdl','mdx']){
  const reopened=openDocument(doc.serialize(format),'sweep.'+format).model;
  assert.equal(reopened.RibbonEmitters.length,1);assert.equal(reopened.ParticleEmitters2.length,emitters.length);
  for(const emitter of emitters){const next=reopened.ParticleEmitters2.find(item=>item.Name===emitter.Name);assert.ok(next,emitter.Name);assert.deepEqual(next.PivotPoint,emitter.PivotPoint);assert.deepEqual(next.Visibility,emitter.Visibility);assert.equal(reopened.Textures[next.TextureID].Image,model.Textures[emitter.TextureID].Image);assert.equal(next.Rows,emitter.Rows);}
 }
 doc.undo();assert.deepEqual(doc.model,before,'One undo removes the whole sweep');
});
test('a sweep follows the weapon: a longer edge gets a longer strip and larger particles',()=>{
 const sizes=[30,60,240].map(height=>{const doc=fixture(height),fit=sweepRibbonFit(fitRibbonToPolygons(doc.model,{0:[0,1,2,3]}),'fire'),emitter=fit.recipe.native.ParticleEmitters2[0];return {length:emitter.Length,scale:emitter.ParticleScaling[1],height};});
 for(const size of sizes)assert.ok(size.length>size.height*.4&&size.length<size.height*.5,'Strip covers the edge without passing its ends');
 assert.ok(sizes[0].scale<sizes[1].scale&&sizes[1].scale<sizes[2].scale);
 assert.ok(sizes[2].scale/sizes[1].scale<=2.5,'A huge weapon does not get screen-filling particles');
});
test('choosing a second element replaces the first',()=>{
 const doc=fixture(),fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]}),frost=sweepRibbonFit(sweepRibbonFit(fit,'fire'),'frost');
 assert.deepEqual(frost.recipe,sweepRibbonFit(fit,'frost').recipe);
 assert.ok(frost.recipe.native.ParticleEmitters2.every(node=>node.Name.startsWith('Frost')));
 assert.throws(()=>sweepRibbonFit(fit,'nonsense'),/Unknown sweep/);
});
test('every picture a sweep uses is a stock Warcraft III texture from the catalogue',()=>{
 const stock=new Set(catalogue.items.map(item=>gamePathKey(item.path))),doc=fixture();let checked=0;
 assert.ok(stock.size>1000);
 for(const [kind] of RIBBON_SWEEPS){
  const fit=sweepRibbonFit(fitRibbonToPolygons(doc.model,{0:[0,1,2,3]}),kind);
  for(const texture of fit.recipe.native.Textures){assert.ok(stock.has(gamePathKey(texture.Image)),kind+' uses a picture outside the game: '+texture.Image);checked++;}
  assert.deepEqual((fit.recipe.embeddedAssets||[]),[],'No picture is carried inside a sweep');
 }
 for(const image of [RIBBON_TEXTURE,...SWEEP_TEXTURES])assert.ok(stock.has(gamePathKey(image)),image);
 assert.ok(checked>=RIBBON_SWEEPS.length*2-1);
 assert.ok(!stock.has(gamePathKey('AzureGlow3.blp')),'A custom glow is not stock');
});
// How Blizzard's own models draw each picture (native usage counts in the FX research, FAMILIES.md):
// pictures painted on black have no alpha and must be Additive; only pictures with their own alpha may Blend.
// Any other pairing draws the picture's square. Emitter modes: 0 Blend, 1 Additive, 2 Modulate, 3 Modulate 2x, 4 Alpha key.
// Ribbon layers count differently: 0 None, 1 Transparent, 2 Blend, 3 Additive, 4 Add alpha, 5 Modulate.
const NATIVE_EMITTER_MODE={'Clouds8x8Fire.blp':[1,8],'Clouds8x8Fade.blp':[1,8],'Clouds8x8Black.blp':[0,8],'Sparkle_Anim.blp':[1,4],'LavaLump2.blp':[1,1],'snowflake.blp':[1,1],'Zap1.blp':[1,1],'LightningBall.blp':[1,1],'GenericGlow64.blp':[1,1],'Flame4.blp':[1,1],'Purple_Star.blp':[1,1],'Yellow_Star_Dim.blp':[1,1],'Blue_Star2.blp':[1,1],'Star8c.blp':[1,1],'BloodWhiteSmall.blp':[0,1]};
test('every ribbon and emitter is drawn the way its picture needs, so no square shows',()=>{
 const doc=fixture();let emitters=0;
 for(const [kind] of RIBBON_SWEEPS){
  const model=sweepRibbonFit(fitRibbonToPolygons(doc.model,{0:[0,1,2,3]}),kind).recipe.native;
  assert.equal(model.RibbonEmitters.length,1,kind);
  for(const ribbon of model.RibbonEmitters){
   const layers=model.Materials[ribbon.MaterialID].Layers;assert.equal(layers.length,1);
   for(const layer of layers){
    assert.equal(model.Textures[layer.TextureID].Image,RIBBON_TEXTURE);
    assert.equal(layer.FilterMode,3,kind+' ribbon: RibbonBlur1 has no alpha, so its layer is Additive, never None or Transparent');
    assert.equal(layer.Shading&16,16,kind+' ribbon is two-sided');
   }
   assert.ok(ribbon.Alpha>0&&ribbon.Alpha<=1);assert.equal(ribbon.Rows,1);assert.equal(ribbon.Columns,1);
  }
  for(const emitter of model.ParticleEmitters2){
   const image=model.Textures[emitter.TextureID].Image,expected=NATIVE_EMITTER_MODE[image.slice(image.lastIndexOf(String.fromCharCode(92))+1)];emitters++;
   assert.ok(expected,kind+': no native drawing rule recorded for '+image);
   assert.equal(emitter.FilterMode,expected[0],`${emitter.Name}: ${image} is drawn ${expected[0]?'Additive':'Blend'} by native models`);
   assert.equal(emitter.Rows,expected[1],emitter.Name+' atlas rows');assert.equal(emitter.Columns,expected[1],emitter.Name+' atlas columns');
   const frames=expected[1]**2;for(const range of [emitter.LifeSpanUVAnim,emitter.DecayUVAnim,emitter.TailUVAnim,emitter.TailDecayUVAnim])assert.ok(range[0]<frames&&range[1]<frames,emitter.Name+' frames inside its atlas');
   assert.equal(emitter.Alpha[2],emitter.FrameFlags===3&&emitter.ParticleScaling[2]===0?emitter.Alpha[2]:0,emitter.Name+' fades out or shrinks to nothing, never pops off');
   assert.equal(emitter.Flags&32768,32768,emitter.Name+' is unshaded');
  }
 }
 assert.ok(emitters>=17);
});
