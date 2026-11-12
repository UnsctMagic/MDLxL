import test from 'node:test';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import * as looks from '../src/global-animation-looks.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
import {DEFAULT_PREFERENCES,PREFERENCE_LIMITS,normalizePreferences} from '../src/preferences.js';
import {normalizeOwnLook,normalizeOwnLooks,ownLookFrom,stackFromOwnLook,upsertOwnLook,ownLookFile,parseOwnLookFile,ownLookId,MAX_OWN_LOOKS} from '../src/fx-own-looks.js';

const {applySettingsPatch}=createRequire(import.meta.url)('../electron/settings.cjs');
const {findLook,makeLayer,newStack,partFrame,LAYER_CHOICES}=looks;
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),message+': '+a+' vs '+b);
const thin={length:100,girth:8,radius:6},big={length:300,girth:24,radius:18};
const layerOf=(label,frame,id)=>{const spec=[...LAYER_CHOICES,...looks.GLOBAL_LOOKS.flatMap(l=>l.variations?l.variations.flatMap(v=>v.layers):l.layers)].find(s=>s.label===label);return makeLayer(spec,frame,'copper',id);};
const sample=frame=>{
 const stack={...newStack(findLook('flaming-sword'),frame,'model-a'),group:[1,2],sequence:3,hit:100,baseMaterial:2,createdClocks:[1760],createdClockIds:[0],variation:'x'};
 stack.layers.push(layerOf('Orbiting flies',frame,10),layerOf('Light edge',frame,11),layerOf('Runes',frame,12),layerOf('Flowing energy',frame,13));
 const flame=stack.layers.find(l=>l.kind==='flame');
 Object.assign(flame,{offset:[1,-2,3],tint:[1,.5,.2],atlasRect:[.1,.2,.3,.4],speed:2,direction:45,tiling:2,native:{Speed:80,Gravity:{Keys:[{Frame:0,Vector:[-12]},{Frame:500,Vector:[-6],InTan:[1],OutTan:[2]}]},Width:50,Length:40,ParticleScaling:[1,2,3],Alpha:[255,255,0],Latitude:30},unitAlphaPeak:.7});
 return stack;
};
const valid=(n=1,extra={})=>({id:'own-look-'+n,name:'Look '+n,loop:2000,frame:{length:100,girth:8,radius:6},layers:[{id:1,type:'Glow',label:'Glow'}],...extra});

test('the normaliser keeps good looks as deep copies and drops everything else without throwing',()=>{
 const good=valid(1),kept=normalizeOwnLooks([good]);
 assert.deepEqual(kept,[good]);kept[0].layers[0].label='changed';assert.equal(good.layers[0].label,'Glow','a deep copy');
 for(const [why,item] of Object.entries({
  'no prefix':valid(1,{id:'fire'}),'capitals':valid(1,{id:'own-Fire'}),'empty id':valid(1,{id:'own-'}),'long id':valid(1,{id:'own-'+'a'.repeat(65)}),'number id':valid(1,{id:5}),
  'empty name':valid(1,{name:'  '}),'no name':valid(1,{name:undefined}),'short loop':valid(1,{loop:99}),'long loop':valid(1,{loop:60001}),'nan loop':valid(1,{loop:NaN}),'text loop':valid(1,{loop:'2000'}),
  'no frame':valid(1,{frame:undefined}),'bad frame':valid(1,{frame:{length:0,girth:1,radius:1}}),'nan frame':valid(1,{frame:{length:10,girth:NaN,radius:1}}),
  'layers not a list':valid(1,{layers:{}}),'33 layers':valid(1,{layers:Array.from({length:33},(_,i)=>({id:i+1,type:'Glow'}))}),
  'layer without id':valid(1,{layers:[{type:'Glow'}]}),'layer id not whole':valid(1,{layers:[{id:1.5,type:'Glow'}]}),'layer without type':valid(1,{layers:[{id:1}]}),'layer a list':valid(1,{layers:[[]]}),
  'non-finite value':valid(1,{layers:[{id:1,type:'Glow',strength:Infinity}]}),'function value':valid(1,{layers:[{id:1,type:'Glow',x:()=>1}]}),
  'class instance':valid(1,{layers:[{id:1,type:'Glow',x:new Map()}]}),'typed array':valid(1,{layers:[{id:1,type:'Glow',x:new Float32Array(2)}]}),
  'over 256 KB':valid(1,{layers:Array.from({length:32},(_,i)=>({id:i+1,type:'Glow',values:Array.from({length:4500},(__,j)=>j+.123456)}))}),
  'text':'x','null':null,'list':[],
 })){
  assert.equal(normalizeOwnLook(item),null,why);
  assert.deepEqual(normalizeOwnLooks([item,good]),[good],why+': the other looks stay');
 }
 for(const value of [undefined,null,'x',5,{},{length:1}])assert.deepEqual(normalizeOwnLooks(value),[]);
 assert.equal(normalizeOwnLooks(Array.from({length:201},(_,i)=>valid(i))).length,200,'at most 200 looks');
 assert.equal(MAX_OWN_LOOKS,200);
 assert.deepEqual(normalizeOwnLooks([valid(1),valid(1,{name:'Other'}),valid(2,{name:'look 1'})]).map(l=>l.id),['own-look-1'],'repeated ids and names keep the first');
});

test('prototype keys never survive and nothing is shared with the input',()=>{
 const dirty=JSON.parse('{"id":"own-evil","name":"Evil","loop":2000,"frame":{"length":100,"girth":8,"radius":6,"__proto__":{"polluted":1}},"__proto__":{"polluted":2},"constructor":{"x":1},"layers":[{"id":1,"type":"Glow","__proto__":{"polluted":3},"constructor":{"prototype":{"polluted":4}},"deep":{"prototype":{"a":1},"keep":[{"__proto__":{"polluted":5},"ok":1}]}}]}');
 const [look]=normalizeOwnLooks([dirty]);
 assert.ok(look,'the look itself is kept');
 const layer=look.layers[0];
 for(const key of ['__proto__','constructor','prototype'])assert.equal(Object.hasOwn(layer,key),false,key);
 assert.equal(Object.hasOwn(layer.deep,'prototype'),false);
 assert.deepEqual(layer.deep.keep,[{ok:1}]);
 assert.equal(({}).polluted,undefined);assert.equal(Object.getPrototypeOf(layer),Object.prototype);
 assert.notEqual(layer.deep,dirty.layers[0].deep);
});

test('fxLooks is a preference: default empty, normalised on every load, written and read back',()=>{
 assert.deepEqual(DEFAULT_PREFERENCES.fxLooks,[]);
 const kept=normalizePreferences({fxLooks:[valid(1),{id:'bad'},valid(2)]}).fxLooks;
 assert.deepEqual(kept.map(l=>l.id),['own-look-1','own-look-2']);
 assert.deepEqual(normalizePreferences({fxLooks:'x'}).fxLooks,[]);
 const stored=JSON.parse(JSON.stringify(normalizePreferences({fxLooks:[valid(1)]})));
 assert.deepEqual(normalizePreferences(stored).fxLooks,[valid(1)],'survives a settings file round trip');
 assert.deepEqual(normalizePreferences({...stored,theme:'dark'}).fxLooks,[valid(1)]);
 const written=applySettingsPatch({preferences:normalizePreferences()},{preferences:{...normalizePreferences(),fxLooks:[valid(1),valid(2)]}},normalizePreferences,PREFERENCE_LIMITS);
 assert.deepEqual(JSON.parse(JSON.stringify(written)).preferences.fxLooks.map(l=>l.id),['own-look-1','own-look-2'],'the settings store writes the key');
 const patched=applySettingsPatch(written,{preferences:{scrollSensitivity:3}},normalizePreferences,PREFERENCE_LIMITS);
 assert.equal(patched.preferences.fxLooks.length,2,'another preference change keeps the looks');
});

test('ownLookFrom keeps what is the look and leaves behind what belongs to one model',()=>{
 const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]);
 const stack={...newStack(findLook('poison-skin'),frame,'model-a'),group:[1],sequence:2,hit:50,contact:{geoset:0,vertex:1},impact:false,asOverlay:false};
 compileAnimation(doc.model,0,stack);
 const compiled=readAnimationStack(doc.model,0);
 assert.ok(compiled.baseMaterial!=null&&compiled.createdClocks&&compiled.createdClockIds&&compiled.layers.some(l=>l.unitAlphaPeak!=null),'the saved stack carries model state');
 const record=ownLookFrom(compiled,frame,'My poison');
 assert.deepEqual(Object.keys(record).sort(),['asOverlay','frame','id','layers','loop','name']);
 assert.deepEqual([record.id,record.name,record.loop,record.asOverlay],['own-my-poison','My poison',stack.loop,compiled.asOverlay]);
 assert.deepEqual(Object.keys(record.frame).sort(),['girth','length','radius']);
 assert.ok(record.layers.every(l=>!('unitAlphaPeak' in l)&&!('owner' in l)));
 assert.deepEqual(record.layers.map(l=>l.label),compiled.layers.map(l=>l.label));
 assert.ok(compiled.layers.some(l=>l.unitAlphaPeak!=null),'the source stack is not modified');
 assert.deepEqual(normalizeOwnLook(record),record,'a saved look passes the normaliser unchanged');
 const withVariation=ownLookFrom({...stack,variation:'ice'},frame,'V');
 assert.equal(withVariation.variation,'ice');
});

test('a look made on a long thin part follows a part three times larger, and fits back exactly on its own part',()=>{
 const stack=sample(thin),record=ownLookFrom(stack,thin,'Big fire'),before=structuredClone(record);
 const same=stackFromOwnLook(record,thin,'model-a');
 assert.deepEqual(same.layers,record.layers,'the same part reproduces the layers exactly');
 assert.deepEqual([same.owner,same.look,same.name,same.loop,same.impact],['model-a','own-big-fire','Big fire',stack.loop,false]);
 assert.equal('group' in same||'sequence' in same||'hit' in same||'baseMaterial' in same||'createdClocks' in same,false);
 const next=stackFromOwnLook(record,big,'model-b'),k=layerOf('Blade flames',big,1).velocity/layerOf('Blade flames',thin,1).velocity;
 assert.deepEqual(record,before,'the saved look is not changed');
 close(k,3,'unit ratio');
 const was=record.layers.find(l=>l.kind==='flame'),now=next.layers.find(l=>l.kind==='flame');
 for(const key of ['velocity','gravity','size','spriteSize'])close(now[key],was[key]*3,'flame '+key);
 now.offset.forEach((v,i)=>close(v,was.offset[i]*3,'offset '+i));
 close(now.upper,was.upper*3,'upper');close(now.lower,was.lower*3,'lower');
 close(now.native.Speed,240,'native Speed');close(now.native.Width,150,'native Width');close(now.native.Length,120,'native Length');
 close(now.native.Gravity.Keys[0].Vector[0],-36,'animated Gravity');close(now.native.Gravity.Keys[1].Vector[0],-18,'animated Gravity key 2');
 close(now.native.Gravity.Keys[1].InTan[0],3,'tangent');assert.equal(now.native.Gravity.Keys[1].Frame,500);
 close(now.native.ParticleScaling[2],9,'ParticleScaling follows size');
 for(const key of ['tint','atlasRect','speed','direction','tiling','amount','count','lasts','strength','pulse','label','id','kind','enabled'])assert.deepEqual(now[key],was[key],'flame '+key+' is not scaled');
 assert.deepEqual(now.native.Alpha,[255,255,0]);assert.equal(now.native.Latitude,30);
 const fly=[was,...record.layers].find(l=>l.kind==='flies'),flyNow=next.layers.find(l=>l.kind==='flies');
 // A fly swarm's radius follows the part's main piece; each fly keeps the size it was given (it follows the unit, not the part).
 assert.ok(fly.swarm&&flyNow.swarm,'Orbiting flies are a fly swarm');
 close(flyNow.size,fly.size*Math.max(18*.9,300*.3)/Math.max(6*.9,100*.3),'swarm size follows the radius formula');
 close(flyNow.spriteSize,fly.spriteSize,'fly size stays');
 const rune=record.layers.find(l=>l.glyphs),runeNow=next.layers.find(l=>l.glyphs);
 close(runeNow.size,rune.size*Math.min(24,300*.29)/Math.min(8,100*.29),'rune size follows its formula');
 const skin=record.layers.find(l=>l.label==='Flowing energy'),skinNow=next.layers.find(l=>l.label==='Flowing energy');
 assert.deepEqual([skinNow.speed,skinNow.direction,skinNow.tiling,skinNow.strength,skinNow.tint],[skin.speed,skin.direction,skin.tiling,skin.strength,skin.tint],'a surface layer keeps its motion and colour');
 const edge=record.layers.find(l=>l.type==='Edge'),edgeNow=next.layers.find(l=>l.type==='Edge');
 close(edgeNow.upper,edge.upper*3,'edge strip end');
});

test('an own look compiles on another part, saves and reopens as that look',()=>{
 for(const format of ['mdx','mdl']){
  const doc=createDemoDocument(),first=partFrame(doc.model.Geosets[0]),second=partFrame(doc.model.Geosets[1]);
  const record=normalizeOwnLook(ownLookFrom({...newStack(findLook('flaming-sword'),first,'a')},first,'Torch'));
  const stack=stackFromOwnLook(record,second,'b');
  compileAnimation(doc.model,1,stack);
  const reopened=openDocument(doc.serialize(format),'torch.'+format),read=readAnimationStack(reopened.model,1);
  assert.deepEqual([read.look,read.name,read.layers.length],['own-torch','Torch',record.layers.length]);
  assert.equal(looks.lookOf(read).name,'Torch');
 }
});

test('a look file round-trips and anything else is refused with one message',()=>{
 const record=normalizeOwnLook(ownLookFrom(sample(thin),thin,'Shared fire')),text=ownLookFile(record,'0.40.0'),file=JSON.parse(text);
 assert.deepEqual([file.schema,file.version,file.name,file.app],['mdlxl-fx-look',1,'Shared fire','0.40.0']);
 assert.deepEqual(parseOwnLookFile(text),record);
 const message='This file is not an FX look.';
 for(const bad of ['','not json','[]','{}',JSON.stringify({...file,schema:'other'}),JSON.stringify({...file,version:2}),JSON.stringify({...file,look:{...file.look,loop:5}}),JSON.stringify({...file,look:null}),JSON.stringify({schema:'mdlxl-preset',version:1,domain:'mouse'}),'x'.repeat(600*1024),undefined,null])
  assert.throws(()=>parseOwnLookFile(bad),{message},String(bad).slice(0,30));
});

test('saving keeps names unique, replaces the look of the same name and stops at 200',()=>{
 const frame=partFrame(createDemoDocument().model.Geosets[0]),stack=newStack(findLook('flaming-sword'),frame,'a');
 let list=[];
 ({looks:list}=upsertOwnLook(list,ownLookFrom(stack,frame,'My fire')));
 assert.deepEqual(list.map(l=>[l.id,l.name]),[['own-my-fire','My fire']]);
 const changed={...stack,loop:2222};
 const again=upsertOwnLook(list,ownLookFrom(changed,frame,'my FIRE'));
 assert.equal(again.looks.length,1,'the same name replaces');assert.equal(again.looks[0].id,'own-my-fire');assert.equal(again.looks[0].loop,2222);assert.equal(again.looks[0].name,'my FIRE');
 const clash=upsertOwnLook(list,{...ownLookFrom(stack,frame,'Other'),id:'own-my-fire'});
 assert.deepEqual(clash.looks.map(l=>l.id),['own-my-fire','own-other'],'a taken id is not reused');
 const slug=upsertOwnLook(clash.looks,ownLookFrom(stack,frame,'Other!'));
 assert.deepEqual(slug.looks.map(l=>l.id),['own-my-fire','own-other','own-other-2'],'names that make the same id get a number');
 assert.equal(ownLookId('Ünï ✓'),'own-n','names without letters still give a valid id');assert.equal(ownLookId('***'),'own-look');
 assert.throws(()=>upsertOwnLook(list,{id:'bad'}),{message:'This look could not be saved.'});
 const full=Array.from({length:200},(_,i)=>valid(i));
 assert.throws(()=>upsertOwnLook(full,ownLookFrom(stack,frame,'One more')),{message:'Too many saved looks.'});
 assert.equal(upsertOwnLook(full,{...valid(7),loop:3000}).looks.length,200,'replacing is allowed at the limit');
});
