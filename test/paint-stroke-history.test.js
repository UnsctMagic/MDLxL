import test from 'node:test';
import assert from 'node:assert/strict';
import {addPaintProjectTarget,compositePaintTarget,createPaintProject,paintProjectCoat,paintStrokeHistory,pastePaintTexture,recordPaintStroke,recordPaintUV,togglePaintStroke,travelPaintHistory} from '../src/paint-project.js';
import {clonePaintRaster,createPaintRaster} from '../src/paint-raster.js';

function project(){
  const value=createPaintProject({modelName:'Test',resolution:256});
  const target=addPaintProjectTarget(value,{id:'skin',textureId:0,texturePath:'skin.blp',label:'Skin',geosetIndices:[0],bindings:[{geosetIndex:0,materialId:0,layerIndex:0,coordId:0}],flags:0},createPaintRaster(8,8,[100,100,100,255]));
  value.activeTargetId=target.id;return value;
}
function paint(value,x0,x1,color){
  const coat=paintProjectCoat(value),before=clonePaintRaster(coat.raster);
  for(let y=0;y<8;y++)for(let x=x0;x<x1;x++)coat.raster.data.set(color,(y*8+x)*4);
  assert.ok(recordPaintStroke(value,value.activeTargetId,value.activeCoatId,before,'Normal stroke'));
}
const at=(value,x)=>[...paintProjectCoat(value).raster.data.slice(x*4,x*4+4)];

test('one stroke can be undone and restored while later strokes and UV edits stay',()=>{
  const value=project();paint(value,0,4,[255,0,0,255]);recordPaintUV(value,'0:0',new Float32Array([0,0]),new Float32Array([.5,.5]));paint(value,3,6,[0,0,255,255]);
  const [red,blue]=paintStrokeHistory(value);
  const result=togglePaintStroke(value,red);assert.equal(result.undone,true);assert.equal(red.strokeUndone,true);
  // Red is gone where nothing covered it; blue painted over red at x=3 keeps blue.
  assert.equal(at(value,0)[3],0);assert.deepEqual(at(value,3),[0,0,255,255]);assert.deepEqual(at(value,5),[0,0,255,255]);
  assert.deepEqual(Array.from(value.uvEdits['0:0']),[.5,.5]);assert.equal(blue.strokeUndone,undefined);
  togglePaintStroke(value,red);assert.equal(red.strokeUndone,false);assert.deepEqual(at(value,0),[255,0,0,255]);assert.deepEqual(at(value,3),[0,0,255,255]);
});

test('a stroke toggle is one Ctrl+Z step and keeps the stroke list honest',()=>{
  const value=project();paint(value,0,4,[255,0,0,255]);const [red]=paintStrokeHistory(value);
  togglePaintStroke(value,red);assert.equal(at(value,1)[3],0);assert.equal(paintStrokeHistory(value).length,1);
  travelPaintHistory(value);assert.deepEqual(at(value,1),[255,0,0,255]);assert.equal(red.strokeUndone,false);
  travelPaintHistory(value,true);assert.equal(at(value,1)[3],0);assert.equal(red.strokeUndone,true);
});

test('a stroke completely covered by later paint reports that nothing can change',()=>{
  const value=project();paint(value,0,4,[255,0,0,255]);paint(value,0,4,[0,255,0,255]);
  assert.deepEqual(togglePaintStroke(value,paintStrokeHistory(value)[0]),{covered:true});assert.deepEqual(at(value,0),[0,255,0,255]);
});

test('pasting an opaque image from an editor keeps the texture transparency',()=>{
  const value=project(),target=value.targets[0];for(let i=3;i<target.alphaMask.data.length;i+=32)target.alphaMask.data[i]=0;
  const before=compositePaintTarget(value),image=clonePaintRaster(before);for(let i=0;i<image.data.length;i+=4){image.data[i]=200;image.data[i+3]=255;}
  assert.deepEqual(pastePaintTexture(value,target.id,value.activeCoatId,image),{resized:false});
  const after=compositePaintTarget(value);for(let i=0;i<after.data.length;i+=4){assert.equal(after.data[i],200);assert.equal(after.data[i+3],before.data[i+3]);}
  // A round trip of the exact copy changes nothing visible, and Ctrl+Z restores the layer.
  travelPaintHistory(value);assert.deepEqual(compositePaintTarget(value).data,before.data);
});

test('pasting a transparent image applies its alpha once and fits other sizes',()=>{
  const value=project(),target=value.targets[0],image=createPaintRaster(16,16,[10,20,30,128]);
  assert.deepEqual(pastePaintTexture(value,target.id,value.activeCoatId,image),{resized:true});
  const after=compositePaintTarget(value);assert.deepEqual([...after.data.slice(0,4)],[10,20,30,128]);
});

test('a Citadel copy keeps a transparent background pasted back from GIMP',()=>{
  // Citadel copies take alpha from the paint layers, not from the original skin.
  const value=project(),target=value.targets[0];target.preserveSourceAlpha=false;
  const coat=paintProjectCoat(value);for(let i=0;i<coat.raster.data.length;i+=4)if((i/4)%8>=4)coat.raster.data.set([0,180,255,255],i);
  // The transparent background comes from the source skin, as in an eye or glow texture.
  for(let i=3;i<target.base.data.length;i+=4)if((i>>2)%8<4)target.base.data[i]=0;
  const before=compositePaintTarget(value),image=clonePaintRaster(before);
  for(let y=0;y<8;y++)image.data.set([255,255,0,128],(y*8+6)*4);
  pastePaintTexture(value,target.id,value.activeCoatId,image);
  const after=compositePaintTarget(value);
  for(let p=0;p<64;p++){const x=p%8,a=after.data[p*4+3];assert.equal(a,x<4?0:x===6?128:255,`pixel ${p}`);}
  assert.deepEqual([...after.data.slice((8+5)*4,(8+5)*4+4)],[0,180,255,255]);
});
