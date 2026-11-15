import test from 'node:test';
import assert from 'node:assert/strict';
import {GLOBAL_LOOKS,LAYER_CHOICES,emitterName,emitterChoices} from '../src/global-animation-looks.js';
import {ingredientSections,filterSections,ingredientName} from '../src/fx-ingredient-picker.js';

const frost=GLOBAL_LOOKS.find(look=>look.id==='frost-blade');
const labels=sections=>sections.flatMap(section=>section.rows.map(row=>row.label));
const ownNames=(look,kind)=>(look.variations?look.variations.flatMap(v=>v.layers):look.layers).filter(layer=>kind==='emitter'?layer.type==='Particles':layer.type!=='Particles').map(layer=>emitterName(layer));

test('Suggested comes first and starts with the look\'s own ingredients, in recipe order',()=>{
 for(const kind of ['emitter','layer']){
  const sections=ingredientSections(frost,kind);
  assert.equal(sections[0].title,'Suggested');
  const own=sections[0].rows.filter(row=>row.source===frost.name);
  assert.ok(own.length>0,kind+': the look has ingredients of its own');
  assert.deepEqual(sections[0].rows.slice(0,own.length),own,kind+': its own come before other looks');
  assert.equal(ingredientName(sections[0].rows[0]),ownNames(frost,kind)[0],kind+': the first row is the look\'s first ingredient');
 }
 const emitters=ingredientSections(frost,'emitter')[0].rows;
 assert.equal(emitters[0].label,emitterChoices(frost)[0].label,'the recommended emitter is first');
});

test('Frost suggests the Ice folder\'s crystal growths as layers',()=>{
 const suggested=ingredientSections(frost,'layer')[0].rows;
 for(const name of ['Crystals','Ice spikes']){
  const row=suggested.find(item=>item.label===name);
  assert.ok(row,name+' is suggested');
  assert.equal(row.type,'Growth');
  assert.equal(row.folder,'Ice');
 }
 assert.equal(suggested.find(item=>item.label==='Crystals').source,'Crystal');
});

test('each ingredient is listed once, and every choice the old menu offered is reachable',()=>{
 for(const [kind,expected] of [['emitter',emitterChoices(frost).map(choice=>choice.label)],['layer',LAYER_CHOICES.filter(spec=>spec.type!=='Particles').map(emitterName)]]){
  const all=labels(ingredientSections(frost,kind));
  assert.equal(new Set(all).size,all.length,kind+': no duplicates');
  assert.deepEqual([...all].sort(),[...new Set(expected)].sort(),kind+': same choices as the old menu');
 }
});

test('folders follow library order and Other holds what no look uses',()=>{
 const titles=ingredientSections(frost,'layer').map(section=>section.title).filter(title=>title!=='Suggested'&&title!=='Other');
 const folders=[...new Set(GLOBAL_LOOKS.map(look=>look.group))];
 assert.deepEqual(titles,folders.filter(folder=>titles.includes(folder)));
 const other=ingredientSections(frost,'layer').find(section=>section.title==='Other');
 assert.ok(other&&other.rows.every(row=>!row.source));
});

test('filterSections finds a word anywhere, drops empty sections and leaves an empty query alone',()=>{
 const sections=ingredientSections(frost,'layer');
 assert.equal(filterSections(sections,''),sections);
 const found=filterSections(sections,'cryst');
 assert.ok(found.length>0&&found.length<sections.length,'sections without a match are dropped');
 assert.ok(found.every(section=>section.rows.length>0));
 assert.ok(labels(found).includes('Crystals'));
 assert.ok(found.flatMap(section=>section.rows).every(row=>[row.label,row.type,row.source,row.variation,row.folder].join(' ').toLowerCase().includes('cryst')));
 assert.deepEqual(filterSections(sections,'CRYSTALS').flatMap(section=>section.rows.map(row=>row.label)).includes('Crystals'),true,'case does not matter');
 assert.deepEqual(filterSections(sections,'zzzz-nothing'),[]);
 assert.ok(labels(filterSections(sections,'obstaculo',text=>text==='Crystals'?'Obstaculo':text)).includes('Crystals'),'a translated name matches too');
});
