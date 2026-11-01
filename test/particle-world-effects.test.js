import test from 'node:test';
import assert from 'node:assert/strict';
import {particleWorldEffects} from '../src/particle-world-effects.js';
import {activeParticleSample} from '../src/particle-sampling.js';
const item=(id,path)=>({id,name:id,sources:[{logicalPath:path}]}),group=(title,...refs)=>({title,refs});
test('ribbon sampling uses native default visibility when the optional track is absent',()=>{
 assert.ok(activeParticleSample({Sequences:[{Interval:[0,1000]}],RibbonEmitters:[{EmissionRate:20,LifeSpan:0.4}]}).score>0);
});
test('an empty clip uses native visibility while an authored zero stays hidden',()=>{
 const model={Sequences:[{Interval:[0,1000]},{Interval:[2000,3000]}],RibbonEmitters:[{EmissionRate:20,LifeSpan:0.4,Visibility:{LineType:0,Keys:[{Frame:0,Vector:[0]},{Frame:1000,Vector:[0]}]}}]};
 assert.equal(activeParticleSample(model).sequence,1);
});
test('ribbon inspection accounts for births before the selected frame and animated alpha',()=>{
 const model={Sequences:[{Interval:[0,1000]}],RibbonEmitters:[{EmissionRate:20,LifeSpan:.2,Alpha:1,Visibility:{LineType:0,Keys:[{Frame:0,Vector:[0]},{Frame:400,Vector:[1]},{Frame:500,Vector:[0]}]}}]};
 assert.ok(activeParticleSample(model).time>=500,'Inspect the accumulated trail rather than the instant emission rate');
 model.RibbonEmitters[0].Alpha={LineType:0,Keys:[{Frame:0,Vector:[0]},{Frame:700,Vector:[1]}]};
 assert.ok(activeParticleSample(model).score===0,'Do not select an invisible alpha window');
});
test('World Editor assigns once to melee owners, separates blood, flattens buildings and prunes empty objects',()=>{
 const items=[item('heal','abilities\\heal.mdx'),item('blood','objects\\spawnmodels\\human\\humanblood.mdx'),item('water','buildings\\other\\fountain.mdx'),item('unit','units\\human\\priest.mdx')];
 const browse={buckets:[['heal'],['blood'],['water'],['unit']],objects:[
 {id:'campaign',name:'Campaign priest',folders:[['Units','Human','Campaign']],groups:[group('Heal · Target',0)]},
 {id:'priest',name:'Priest',folders:[['Units','Human','Normal']],groups:[group('Model',3),group('Heal · Target',0),group('Death/Special',1),group('Empty')]},
 {id:'blood',name:'Blood only',folders:[['Units','Human','Normal']],groups:[group('Death/Special',1)]},
 {id:'ndfl',name:'Fountain of Life',folders:[['Buildings','Orc','Campaign']],groups:[group('Model',2)]}]};
 const tree=particleWorldEffects(browse,items),units=tree.children.find(n=>n.name==='Units');assert.deepEqual(units.children[0].children.map(n=>n.name),['Priest']);
 assert.equal(units.total,1);assert.equal(units.children[0].children[0].children[0].item.id,'heal');
 const buildings=tree.children.find(n=>n.name==='Buildings');assert.equal(buildings.children[0].name,'Neutral');assert.equal(buildings.children[0].children[0].item.id,'water');
 assert.equal(tree.children.find(n=>n.name==='Blood & death').total,1);assert.equal(tree.total,3);
 assert.deepEqual(items.map(i=>i.id),['heal','blood','water','unit']);
});
test('unit ownership precedes an item reusing its art, including campaign units',()=>{
 const tree=particleWorldEffects({buckets:[['effect']],objects:[
 {id:'item',name:'Item',folders:[['Items','Charged']],groups:[group('Ability · Target',0)]},
 {id:'unit',name:'Unit',folders:[['Units','Human','Campaign']],groups:[group('Ability · Target',0)]}]},[item('effect','abilities\\effect.mdx')]);
 assert.deepEqual(tree.children.map(node=>node.name),['Units']);assert.equal(tree.children[0].children[0].children[0].name,'Unit');
});
test('a playable shipyard keeps its race even when its model is stored in other',()=>{
 const tree=particleWorldEffects({buckets:[['shipyard']],objects:[{id:'oshy',name:'Orc Shipyard',folders:[['Buildings','Orc','Campaign']],groups:[group('Model',0)]}]},[item('shipyard','buildings\\other\\orcshipyard\\orcshipyard.mdx')]);
 assert.equal(tree.children[0].children[0].name,'Orc');
});
test('unit races retain World Editor neutral labels; neutral buildings share one race',()=>{
 const objects=[['creep','Units','Neutral Hostile'],['critter','Units','Neutral Passive'],['ndfl','Buildings','Orc']].map(([id,type,race],index)=>({id,name:id,folders:[[type,race]],groups:[group(type==='Buildings'?'Model':'Ability · Target',index)]}));
 const tree=particleWorldEffects({objects,buckets:[['a'],['b'],['c']]},['a','b','c'].map(id=>item(id,'abilities\\effect.mdx')));
 assert.deepEqual(tree.children.find(node=>node.name==='Units').children.map(node=>node.name),['Neutral Hostile','Neutral Passive']);
 assert.equal(tree.children.find(node=>node.name==='Buildings').children[0].name,'Neutral');
});
