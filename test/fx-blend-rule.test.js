import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLOBAL_LOOKS,LAYER_CHOICES,layerFilter} from '../src/global-animation-looks.js';
import {gamePathKey} from '../src/game-path.js';

// The blend rule of the library. A picture without alpha on a black ground is a sprite of light: it is added (surface
// filter 3 or 4, emitter filter 1), never drawn solid, cut out or blended. A picture with alpha is not drawn solid
// (filter 0) unless the layer is a base surface. Pictures outside the classic catalogue are not judged here: nothing
// is known about their alpha. No measured border data is read, so a picture without alpha is only judged where the
// rule does not need it.
const CATALOGUE=new Map(JSON.parse(fs.readFileSync(new URL('../electron/data/texture-library-catalog.json',import.meta.url),'utf8')).items.map(item=>[gamePathKey(item.path),item]));

function blendProblems(){
 const problems=[];
 const check=(where,l)=>{
  const image=l.nativeSpec?.texture||l.image;
  if(!image||l.team||l.nativeSpec?.team||l.own)return;
  const entry=CATALOGUE.get(gamePathKey(image));
  if(!entry)return;
  const alpha=!!entry.alpha;
  if(l.type==='Particles'){
   const filter=l.nativeSpec?(l.nativeSpec.filter??1):(l.kind==='drops'||l.kind==='flies'?(l.square?null:0):1);
   if(l.swarm||l.kind==='flies'){const f=l.square?l.filter??1:1;if(!alpha&&f!==3&&f!==4)problems.push(where+': swarm picture without alpha drawn with filter '+f+' ('+image+')');return;}
   if((filter===0||filter===4)&&!alpha)problems.push(where+': emitter blends a picture without alpha ('+image+')');
   return;
  }
  const filter=l.type==='Card'?l.filter??3:l.type==='Growth'?l.filter??(l.shape==='leaf'?1:0):l.type==='Edge'?l.filter??(l.orbit?3:4):layerFilter(l);
  if(filter==null||filter===3||filter===4)return;
  if(alpha&&filter===0&&!l.base&&l.type!=='Growth')problems.push(where+': a picture with alpha drawn solid ('+image+')');
 };
 for(const look of GLOBAL_LOOKS)for(const v of look.variations||[{name:'',layers:look.layers}])for(const l of v.layers)check(look.name+(v.name?' > '+v.name:'')+' / '+l.label,l);
 for(const l of LAYER_CHOICES)check('Add layer / '+(l.menuLabel||l.label),l);
 return problems;
}

test('No layer of the library draws a light sprite or a picture without alpha as a block',()=>{
 const problems=blendProblems();
 assert.equal(problems.length,0,'block problems: '+problems.length+'\n  '+problems.join('\n  '));
});
