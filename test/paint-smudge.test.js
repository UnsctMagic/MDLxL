import test from 'node:test';
import assert from 'node:assert/strict';
import {smudgeProjectedPaint} from '../src/paint-smudge.js';
import {prepareTexturePaintProjection} from '../src/paint-projection.js';
import {createPaintRaster,compositePaintRasters} from '../src/paint-raster.js';

// Red left half, blue right half; smudge drags across the border like the app does.
function drag(opacity,{mask=null,from=12,to=36,size=12,hardness=.5}={}){
  const base=createPaintRaster(48,16,[0,0,255,255]);for(let y=0;y<16;y++)for(let x=0;x<24;x++)base.data.set([255,0,0,255],(y*48+x)*4);
  const coat=createPaintRaster(48,16),reference=compositePaintRasters(base,[{raster:coat}]),projection=prepareTexturePaintProjection(48,16),state={};
  const brush={size,opacity,strength:1,hardness};
  for(let x=from;x<=to;x+=1){
    smudgeProjectedPaint(coat,projection,{x,y:8},brush,{reference,mask},state);
    compositePaintRasters(base,[{raster:coat}],{output:reference});
  }
  return reference;
}
const pixel=(raster,x,y=8)=>[...raster.data.slice((y*48+x)*4,(y*48+x)*4+4)];

test('smudge pulls the colour under the brush along the stroke',()=>{
  const result=drag(.8);
  // Just past the border the blue is now strongly red; untouched rows stay as painted.
  assert.ok(pixel(result,28)[0]>150,`pulled red: ${pixel(result,28)}`);
  assert.deepEqual(pixel(result,40),[0,0,255,255]);
  assert.deepEqual(pixel(result,28,0),[0,0,255,255]);
});

test('higher smudge opacity drags paint further and 0% leaves the texture alone',()=>{
  const weak=drag(.3),strong=drag(.9),none=drag(0);
  assert.ok(pixel(strong,32)[0]>pixel(weak,32)[0]+40,`strong ${pixel(strong,32)} weak ${pixel(weak,32)}`);
  for(let x=0;x<48;x++)assert.deepEqual(pixel(none,x),x<24?[255,0,0,255]:[0,0,255,255]);
});

test('smudge neither reads from nor writes into protected pixels',()=>{
  const mask=Uint8Array.from({length:48*16},(_,i)=>i%48<24?0:255),result=drag(.9,{mask});
  // The protected red never enters the smear, and protected pixels stay red.
  for(let x=0;x<48;x++)assert.deepEqual(pixel(result,x),x<24?[255,0,0,255]:[0,0,255,255],`x ${x}`);
});
