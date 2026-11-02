import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {particleWorldEffects,bloodEffect} from '../src/particle-world-effects.js';
import {worldEditorRaceOrder} from '../src/world-editor-catalog.js';
const profile=process.argv[2];assert.ok(profile,'Supply a read-only profile with the full installed catalogue and browse sidecar');
const base=path.join(profile,'particles'),current=JSON.parse(fs.readFileSync(path.join(base,'current.json'))),directory=path.join(base,current.sourceKey);
const browse=JSON.parse(fs.readFileSync(path.join(directory,'browse.json'))),{reviewFor}=createRequire(import.meta.url)('../electron/particle-review.cjs');
const items=JSON.parse(fs.readFileSync(path.join(directory,'catalog.json'))).map(item=>({...item,...browse.metadata?.[item.id],...reviewFor(item)}));
const tree=particleWorldEffects(browse,items),seen=new Set(),folders=[];
// Independent reference inventory: inspect every eligible association before
// looking at the rendered tree, then choose its minimum World Editor owner.
const available=new Map(items.filter(item=>!item.empty).map(item=>[item.id,item]));
const kinds=['Units','Buildings','Heroes','Spells','Items','Doodads','Destructibles'],races=[...worldEditorRaceOrder,'Neutral'];
const ownerPath=object=>{const [kind,race]=object.folders[0];return [kind,kind==='Buildings'&&(/Neutral/.test(race)||race==='Naga'||/^n/i.test(object.id))?'Neutral':race||'Neutral',object.name];};
const rank=object=>{const [kind,race]=ownerPath(object);return [Number(!['Units','Buildings','Heroes'].includes(kind)),Number(object.folders[0].some(value=>/Campaign|Special/.test(value))),kinds.indexOf(kind),races.includes(race)?races.indexOf(race):6,object.name,object.id];};
const compare=(a,b)=>{const x=rank(a),y=rank(b);for(let i=0;i<x.length;i++){const order=typeof x[i]==='number'?x[i]-y[i]:x[i].localeCompare(y[i]);if(order)return order;}return 0;};
const owners=new Map(),expected=new Set();
for(const object of browse.objects)for(const group of object.groups){
 const kind=object.folders[0][0];
 if(group.title==='Death/Special'||group.title==='Model'&&!['Buildings','Doodads','Destructibles'].includes(kind))continue;
 for(const id of group.refs.flatMap(ref=>browse.buckets[ref]||[]))if(available.has(id)&&!bloodEffect(available.get(id))){
  expected.add(id);const prior=owners.get(id);if(!prior||compare(object,prior)<0)owners.set(id,object);
 }
}
for(const item of available.values())if(bloodEffect(item)||(item.sources||[]).some(source=>/abilities\\/i.test(source.logicalPath||source.physicalPath||''))||!item.sources?.length)expected.add(item.id);
function visit(node,trail=[]){
  if(node.item){
   const id=node.item.id;assert.ok(!seen.has(id),'Repeated recipe '+id);seen.add(id);assert.equal(bloodEffect(node.item),trail.includes('Blood & death'),'Blood classification '+id);
   const owner=owners.get(id);
   if(owner){const location=ownerPath(owner);assert.deepEqual(trail.slice(1,location[0]==='Buildings'?3:4),location[0]==='Buildings'?location.slice(0,2):location,'First World Editor owner '+id);if(location[0]==='Buildings')assert.ok(node.name.includes(owner.name),'Building origin '+id);}
   else assert.equal(trail[1],bloodEffect(node.item)?'Blood & death':'Other effects','Unowned effect location '+id);
   return 1;
  }
  assert.ok(node.children.length,'Empty folder '+trail.concat(node.name).join('/'));
  assert.ok(!['Model','Death/Special','Campaign','Normal','Attack/Missile'].includes(node.name),'Forbidden layer '+node.name);
  folders.push(node);const count=node.children.reduce((n,child)=>n+visit(child,trail.concat(node.name)),0);assert.equal(node.total,count,'Count '+node.key);assert.ok(count>0);return count;
}
visit(tree);
assert.deepEqual([...seen].sort(),[...expected].sort(),'Every eligible recipe is present exactly once');
for(const race of tree.children.find(node=>node.name==='Buildings').children)assert.ok(race.children.every(node=>node.item),'Buildings has rows directly');
for(const [name,ability]of [['Priest','Heal'],['Priest','Dispel Magic'],['Shaman','Bloodlust']]){const object=folders.find(node=>node.name===name);assert.ok(object,name);assert.ok(object.children.some(node=>node.name===ability),name+' / '+ability);}
const neutral=tree.children.find(node=>node.name==='Buildings').children.find(node=>node.name==='Neutral');assert.ok(neutral.children.some(node=>/Fountain of Life/i.test(node.name)));
console.log(JSON.stringify({sourceKey:current.sourceKey,catalogue:items.length,catalogueSha256:createHash('sha256').update(fs.readFileSync(path.join(directory,'catalog.json'))).digest('hex'),eligibleRecipes:expected.size,verifiedFirstOwners:owners.size,visibleRecipes:seen.size,folders:folders.length,blood:tree.children.find(node=>node.name==='Blood & death').total,buildings:tree.children.find(node=>node.name==='Buildings').children.map(node=>[node.name,node.total]),duplicates:0,empty:0,countMismatches:0},null,2));
