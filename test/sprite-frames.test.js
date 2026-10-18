import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSpriteGrid,framesAcrossLife,playedFrames,spriteGridValues,suggestedSetups,setupValues,setupLabel} from '../src/sprite-frames.js';
import {starterTextureAsset} from '../src/particle-starters.js';

const image=(width,height,paint)=>{const data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const v=paint(x,y),i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(255*v);data[i+3]=255;}return {width,height,data};};
const blob=(cx,cy,r)=>(x,y)=>Math.max(0,1-Math.hypot(x-cx,y-cy)/r);
const sheet=(rows,columns,size=128)=>image(size,size,(x,y)=>{const cw=size/columns,ch=size/rows,c=Math.floor(x/cw),r=Math.floor(y/ch);return blob(c*cw+cw/2,r*ch+ch/2,Math.min(cw,ch)*.38)(x,y);});

test('sprite sheets are found from the picture itself',()=>{
 for(const [rows,columns] of [[2,2],[4,4],[1,4],[8,8]])assert.deepEqual(detectSpriteGrid(sheet(rows,columns)),{rows,columns},rows+'x'+columns);
});

test('a single picture is not a sprite sheet',()=>{
 assert.deepEqual(detectSpriteGrid(image(64,64,blob(32,32,40))),{rows:1,columns:1},'soft glow');
 const star=image(64,64,(x,y)=>Math.max(blob(32,32,30)(x,y),Math.abs(x-y)<1.5||Math.abs(x+y-63)<1.5||Math.abs(x-32)<1||Math.abs(y-32)<1?.8:0));
 assert.deepEqual(detectSpriteGrid(star),{rows:1,columns:1},'star');
 const {bytes}=starterTextureAsset(),size=64,data=new Uint8ClampedArray(size*size*4);for(let i=0;i<size*size;i++){data.set(bytes.subarray(18+i*4,18+i*4+3),i*4);data[i*4+3]=bytes[18+i*4+3];}
 assert.deepEqual(detectSpriteGrid({width:size,height:size,data}),{rows:1,columns:1},'starter soft disc');
 assert.deepEqual(detectSpriteGrid(image(64,64,()=>0)),{rows:1,columns:1},'empty');
});

test('chosen frames play once across the whole life',()=>{
 const emitter={Rows:4,Columns:4,Time:.5};
 const all=spriteGridValues(emitter,4,4);
 assert.deepEqual([...all.LifeSpanUVAnim],[0,8,1]);assert.deepEqual([...all.DecayUVAnim],[8,16,1]);
 assert.deepEqual([...all.TailUVAnim],[...all.LifeSpanUVAnim]);
 assert.deepEqual(playedFrames({...emitter,...all}),{first:0,last:15,repeat:1});
 const some=framesAcrossLife(emitter,3,6,2);assert.deepEqual([...some.LifeSpanUVAnim],[3,5,2]);assert.deepEqual([...some.DecayUVAnim],[5,7,2]);
 assert.deepEqual(playedFrames({...emitter,...some}),{first:3,last:6,repeat:2});
 const one=framesAcrossLife(emitter,5,5);assert.deepEqual([...one.LifeSpanUVAnim],[5,6,1]);assert.deepEqual([...one.DecayUVAnim],[5,6,1]);
 const late=framesAcrossLife({Time:.8},0,9);assert.deepEqual([...late.LifeSpanUVAnim],[0,8,1],'More frames before a late halfway point');
 assert.deepEqual(playedFrames({Rows:4,Columns:4,LifeSpanUVAnim:[0,15,1],DecayUVAnim:[15,0,1]}),{first:0,last:15,repeat:1},'A backwards range still reads');
});

test('the game\'s own frame setups are suggested for its sprite sheets',()=>{
 const clouds=suggestedSetups('ReplaceableTextures\\Weather\\Clouds8x8.blp');
 assert.ok(clouds.length>=1);assert.equal(clouds[0].rows*clouds[0].columns,64);
 assert.deepEqual(suggestedSetups('Textures\\clouds8x8.blp').length>0||suggestedSetups('Custom\\Clouds8x8.blp').length>0,true,'Found by file name in another folder');
 const values=setupValues(clouds[0]);assert.deepEqual([...values.LifeSpanUVAnim],clouds[0].life);assert.equal(values.Rows,clouds[0].rows);
 assert.match(setupLabel(clouds[0]),/^Like .+ · \d+→\d+$/);
 assert.deepEqual(suggestedSetups('Textures\\Star.blp'),[]);
});
