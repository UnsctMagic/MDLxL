import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {Vector3,PerspectiveCamera} from 'three';
import {movementAxisHandles} from '../app/movement-overlay.js';
import {transformLabSource} from '../scripts/rotation-lab-transform.mjs';
const file=path.resolve(`out/gizmo-adapter-${process.pid}.mjs`);await fs.mkdir(path.dirname(file),{recursive:true});
const bundled=await build({entryPoints:['app/gizmo-lab.js'],bundle:true,platform:'node',packages:'external',format:'esm',write:false,loader:{'.css':'empty'}});await fs.writeFile(file,bundled.outputFiles[0].text);
let adapter;try{adapter=await import(pathToFileURL(file));}finally{await fs.unlink(file);}
function setup(tool='translate',enabled=false,handle={axis:'X'},pane={id:'single'},quad=false,strength=1){
 const camera=new PerspectiveCamera(45,1.4,.1,10000);camera.position.set(100,-160,110);camera.up.set(0,0,1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const width=800,height=600,pivot=new Vector3(),active={world:pivot,x:width/2,y:height/2,visible:true};
 const poseHandles=movementAxisHandles(active,camera,width,height,100,'world','move');
 const state={gizmoLabViews:new Map([[pane.id,{data:{poseHandles,unit:1}}]])};
 const drag={action:tool,pivot,handle};const start={x:420,y:270,width,height,shift:false};
 const p={rotationLab:true,workplaneEnabled:enabled,workplane:'xy',preferences:{rotation:{sensitivity:strength}}};
 adapter.beginLabDrag(p,state,drag,start,camera,pane,quad,handle);
 return {drag,start,camera,p};
}
const close=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-9);
const axisSolve=(axis,from,to)=>{const out=[0,0,0];out['XYZ'.indexOf(axis)]=axis==='Y'?to.y-from.y:to.x-from.x;return out;};
test('all Move arrows switch to their perpendicular planes and retain the visible offset on mid-drag Shift transitions',()=>{
 for(const axis of ['X','Y','Z']){
  const {drag,start}=setup('translate',false,{axis});
  const move=(dx,dy,shift)=>adapter.moveLabDrag(drag,{...start,x:start.x+dx*.2,y:start.y+dy*.2},{...start,x:start.x+dx,y:start.y+dy},shift,axisSolve,false).toArray();
  const first=move(10,5,false),pressed=move(10,5,true);assert.ok(close(first,pressed),'pressing Shift does not jump');
  const plane=move(30,20,true);assert.ok(Math.abs(plane['XYZ'.indexOf(axis)]-first['XYZ'.indexOf(axis)])<1e-9,'Shift+arrow never moves along that arrow');
  assert.ok(plane.some((v,i)=>i!=='XYZ'.indexOf(axis)&&Math.abs(v-first[i])>1e-6));
  assert.ok(close(plane,move(30,20,false)),'releasing Shift does not jump');
  const last=move(40,25,false);for(let i=0;i<3;i++)if(i!=='XYZ'.indexOf(axis))assert.equal(last[i],plane[i]);
  assert.equal(drag.gizmoLab.distance,Math.hypot(...last));
 }
});
test('all Move squares select one dominant in-plane axis with Shift, without DPI scaling',()=>{
 for(const plane of ['xy','xz','yz']){
  const {drag,start}=setup('translate',false,{plane});
  const raw={...start,x:start.x+30,y:start.y+5},slow={...start,x:start.x+6,y:start.y+1};
  const result=adapter.moveLabDrag(drag,slow,raw,true,axisSolve,false).toArray();
  const axis=drag.gizmoLab.usedAxis;assert.ok(plane.toUpperCase().includes(axis));
  assert.ok(result.filter(v=>Math.abs(v)>1e-9).length===1);assert.equal(result['XYZ'.indexOf(axis)],axis==='Y'?5:30);
 }
});
test('constrained Move stays in the pane plane and keeps current pointer sensitivity',()=>{
 const {drag,start}=setup('translate',true);
 const delta=adapter.moveLabDrag(drag,{...start,x:start.x+12,y:start.y+6},{...start,x:start.x+40,y:start.y+20},false,axisSolve,false);
 assert.equal(delta.z,0);assert.ok(delta.length()>0);
});
test('flat quad panes force their plane; constrained Rotate ignores DPI and is MDLVis signed',()=>{
 for(const [id,plane,axis,sign]of [['front','yz',0,1],['top','xy',2,1],['side','xz',1,-1]]){
  const {drag,start}=setup('rotate',false,null,{id,workplane:plane},true);
  const degrees=adapter.rotateLabDrag(drag,{...start,x:start.x+40,y:start.y+200},false);
  assert.equal(degrees[axis],40*sign);assert.equal(drag.gizmoLab.constraints,true);
  assert.equal(adapter.rotateLabDrag(drag,{...start,x:start.x+37},true)[axis],30*sign);
 }
});
test('off-handle Rotate always uses swept pointer angle, ignores strength and holds inside 8px',()=>{
 for(const strength of [.1,1,4]){
  const {drag}=setup('rotate',false,{axis:'Z',offHandle:true},{id:'single'},false,strength),c=drag.gizmoLab.center;
  // Begin uses (420,270), a vector (20,-30); current pointer vector (40,-30).
  const degrees=adapter.rotateLabDrag(drag,{x:c.x+40,y:c.y-30},false),magnitude=Math.hypot(...degrees);
  assert.ok(Math.abs(magnitude-19.44003482817619)<1e-9);
  const held=adapter.rotateLabDrag(drag,{x:c.x,y:c.y},false);assert.deepEqual(held,degrees);
 }
});
test('lab hooks do not modify product sources and fail if an owner anchor drifts',async()=>{
 for(const name of ['App.jsx','Viewport.jsx','AppSidebar.jsx','EditorControls.jsx']){
  const file=path.resolve('app',name),source=await fs.readFile(file,'utf8'),transformed=transformLabSource(source,file.replaceAll('\\','/'));
  assert.notEqual(transformed,source);assert.equal(await fs.readFile(file,'utf8'),source);
 }
 assert.throws(()=>transformLabSource('changed upstream','/app/Viewport.jsx'),/hook drifted|block drifted/);
 assert.ok(!(await fs.readFile('vite.config.js','utf8')).includes('rotation-lab'));
});
test('Gizmo Lab shares the real frame coalescer and only samples angle in the pointer handler',async()=>{
 const source=transformLabSource(await fs.readFile('app/Viewport.jsx','utf8'),'/app/Viewport.jsx');
 const body=source.slice(source.indexOf('function pointerMove(event)'),source.indexOf('// These run at the start'));
 assert.match(body,/sampleLabDrag/);assert.match(body,/transformFrame.schedule/);
 assert.doesNotMatch(body,/moveLabDrag|rotateLabDrag|drawGizmoLab|drawMovementGizmo|logLabDrag/);
 assert.match(source,/transformFrame.flush\(\)/);assert.match(source,/transformFrame.cancel\(\)/);
});

test('lever freezes its chosen other axis after the first six pixels',()=>{
 const {drag,start}=setup('rotate',false,{axis:'Z'});
 adapter.sampleLabDrag(drag,{x:start.x+2,y:start.y+1});assert.equal(drag.gizmoLab.axis,null);
 adapter.sampleLabDrag(drag,{x:start.x+20,y:start.y});const chosen=drag.gizmoLab.axis;
 assert.ok(chosen&&chosen!=='Z');adapter.sampleLabDrag(drag,{x:start.x,y:start.y+100});assert.equal(drag.gizmoLab.axis,chosen);
});

test('leaving a pane clears only its hover and requests one display frame',()=>{
 let frames=0;const state={scheduler:{invalidate(){frames++;}},gizmoLabViews:new Map([['front',{hover:{axis:'X'}}],['perspective',{hover:{axis:'Y'}}]])};
 adapter.leaveLab(state,{id:'perspective'});assert.equal(state.gizmoLabViews.get('perspective').hover,null);assert.equal(state.gizmoLabViews.get('front').hover.axis,'X');assert.equal(frames,1);
 adapter.leaveLab(state,{id:'perspective'});assert.equal(frames,1);
});

test('ordinary AI module inventory cannot collect the lab rules',async()=>{
 const sandbox=await fs.readFile('app/ai-sandbox.js','utf8');assert.match(sandbox,/src\/\*\.js/);
 const src=await fs.readdir('src');assert.ok(!src.some(name=>/gizmo-lab|rotation-lab/.test(name)));
 const entry=await fs.readFile('app/main.jsx','utf8');assert.ok(!entry.includes('gizmo-lab')&&!entry.includes('rotation-lab'));
});

test('release records the final hover pointer for the next display frame',()=>{
 const state={gizmoLabViews:new Map([['single',{pointer:{x:1,y:2},hoverPointer:{x:1,y:2},hover:{axis:'Z'}}]])};
 adapter.releaseLabPointer(state,{id:'single'},{x:40,y:50});const v=state.gizmoLabViews.get('single');
 assert.deepEqual(v.pointer,{x:40,y:50});assert.deepEqual(v.hoverPointer,{x:1,y:2});assert.equal(v.hoverEnabled,true);
 adapter.leaveLab(state,{id:'single'});assert.equal(v.pointer,null);assert.equal(v.hover,null);
});
