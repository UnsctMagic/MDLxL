import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {Vector3,Triangle} from 'three';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,makeLayer,partFrame,LAYER_CHOICES} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';
const {fixturePath}=createRequire(import.meta.url)('./helpers/fixtures.cjs');
const file=fixturePath('footman');
for(const label of ['Eye sparks','Heavy drops','Ichor drops','Blood beads'])test(label+' is born clear of the Footman body surface', {skip:!fs.existsSync(file)&&'private Footman fixture missing'},()=>{
 const m=openDocument(fs.readFileSync(file),'footman.mdx').model,g=m.Geosets[0],f=partFrame(g),s=newStack(findLook('empty'),f,'surface');
 s.layers=[makeLayer(LAYER_CHOICES.find(l=>l.label===label),f,'native',1)];
 compileAnimation(m,0,s);
 const triangles=[];for(let i=0;i<g.Faces.length;i+=3)triangles.push(new Triangle(...Array.from(g.Faces.slice(i,i+3),v=>new Vector3().fromArray(g.Vertices,3*v))));
 const emitters=m.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('surface/'));
 assert.ok(emitters.length);
 for(const p of emitters){
  const point=new Vector3().fromArray(p.PivotPoint),closest=new Vector3(),normal=new Vector3();let distance=Infinity;
  for(const tri of triangles){const v=tri.closestPointToPoint(point,new Vector3()),d=v.distanceToSquared(point);if(d<distance){distance=d;closest.copy(v);tri.getNormal(normal);}}
  assert.ok(point.clone().sub(closest).dot(normal)>.01,label+' emission site must be outside the mesh: '+point.toArray());
 }
});
