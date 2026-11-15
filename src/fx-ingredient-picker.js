import {GLOBAL_LOOKS,LAYER_CHOICES,emitterName,emitterChoices,layerType} from './global-animation-looks.js';

// The searchable lists behind "Add emitter" and "Add layer" in the FX window.
// Every choice is traced to the looks that use it, so the list can put what fits the current look first.

const RECOMMENDED=/ \(recommended\)$/;
/** The name shown for a row: the label without the "(recommended)" note the old menu added. */
export const ingredientName=row=>row.label.replace(RECOMMENDED,'');

const choicesOf=(look,kind)=>kind==='emitter'
 ?emitterChoices(look).map(({spec,label})=>({label,spec}))
 :LAYER_CHOICES.filter(spec=>spec.type!=='Particles').map(spec=>({label:emitterName(spec),spec}));
const keyOf=(type,name)=>type+'\u0000'+name;
// The layers of a look in recipe order, each with the variation it belongs to (none for the look's own layers).
const lookLayers=look=>[...(look.layers||[]).map(layer=>({layer,variation:''})),...(look.variations||[]).flatMap(v=>(v.layers||[]).map(layer=>({layer,variation:v.name})))];

/** Sections of rows for one kind ('emitter' or 'layer') of ingredient, best fits first. */
export function ingredientSections(look,kind){
 const wanted=kind==='emitter'?'Particles':null;
 const byKey=new Map();
 for(const choice of choicesOf(look,kind)){
  const name=emitterName(choice.spec),key=keyOf(choice.spec.type,name);
  if(!byKey.has(key))byKey.set(key,choice);
 }
 // A look's layer matches a choice of the same type and name; a choice named after its look matches that look's own layer.
 const choiceFor=(source,layer)=>{
  if(wanted?layer.type!==wanted:layer.type==='Particles')return null;
  return byKey.get(keyOf(layer.type,emitterName(layer)))||byKey.get(keyOf(layer.type,layer.label+' ('+source.name+')'))||null;
 };
 const used=new Set(),rowFor=(choice,source,variation)=>({label:choice.label,type:layerType(choice.spec),source:source?source.name:'',folder:source?source.group:'',variation:variation||'',spec:choice.spec});
 const take=(rows,source,variation,choice)=>{
  if(!choice||used.has(choice.label))return;
  used.add(choice.label);rows.push(rowFor(choice,source,variation));
 };
 const fromLook=(rows,source)=>{for(const {layer,variation} of lookLayers(source))take(rows,source,variation,choiceFor(source,layer));};

 const sections=[],suggested=[];
 fromLook(suggested,look);
 if(look.group)for(const other of GLOBAL_LOOKS)if(other.group===look.group&&other.id!==look.id)fromLook(suggested,other);
 sections.push({title:'Suggested',rows:suggested});

 const folders=[...new Set(GLOBAL_LOOKS.map(item=>item.group))];
 for(const folder of folders){
  const rows=[];
  for(const source of GLOBAL_LOOKS)if(source.group===folder)fromLook(rows,source);
  sections.push({title:folder,rows});
 }
 const other=[];
 for(const choice of byKey.values())take(other,null,'',choice);
 sections.push({title:'Other',rows:other});
 return sections.filter(section=>section.rows.length);
}

/** Keeps the rows that contain the query (any case) in their name, type, source look, variation or folder. Empty sections go. */
export function filterSections(sections,query,translate=text=>text){
 const needle=String(query||'').trim().toLowerCase();
 if(!needle)return sections;
 const hit=row=>[ingredientName(row),translate(ingredientName(row)),row.type,translate(row.type),row.source,row.variation,row.folder].some(text=>text&&String(text).toLowerCase().includes(needle));
 return sections.map(section=>({...section,rows:section.rows.filter(hit)})).filter(section=>section.rows.length);
}
