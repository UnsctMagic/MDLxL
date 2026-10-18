import {openDocument} from './editor-document.js';

/** MDL block keyword for each emitter family, as the model saves it. */
export const EMITTER_BLOCKS={ParticleEmitters2:'ParticleEmitter2',RibbonEmitters:'RibbonEmitter',ParticleEmitters:'ParticleEmitter',ParticleEmitterPopcorns:'ParticleEmitterPopcorn'};

const decode=bytes=>typeof bytes==='string'?bytes:new TextDecoder().decode(bytes);
export const emitterFamily=(model,id)=>Object.keys(EMITTER_BLOCKS).find(family=>model[family]?.some(node=>node.ObjectId===id));

/** Start and end (exclusive) of each top-level `Keyword "..." { ... }` block, in file order. */
function blocks(text,keyword){
 const found=[],pattern=new RegExp('^'+keyword+'\\s+"','gm');let match;
 while((match=pattern.exec(text))){
  let depth=0,quoted=false,i=text.indexOf('{',match.index);
  for(;i<text.length;i++){const c=text[i];if(c==='"')quoted=!quoted;else if(!quoted&&c==='{')depth++;else if(!quoted&&c==='}'&&--depth===0)break;}
  if(depth!==0)throw Error('The MDL text of an emitter is incomplete.');
  found.push([match.index,i+1]);pattern.lastIndex=i+1;
 }
 return found;
}

function locate(doc,id){
 const family=emitterFamily(doc.model,id);if(!family)throw Error('The emitter was removed.');
 const index=doc.model[family].findIndex(node=>node.ObjectId===id),keyword=EMITTER_BLOCKS[family];
 const text=decode(doc.serialize('mdl')),found=blocks(text,keyword);
 if(found.length!==doc.model[family].length)throw Error('The emitter could not be found in the MDL text.');
 return {family,index,keyword,text,range:found[index]};
}

/** The exact MDL text the model would save for this emitter. */
export function emitterMdlText(doc,id){
 const {family,keyword,text,range}=locate(doc,id);
 return {family,keyword,block:text.slice(...range)};
}

/**
 * Reads an edited block with the same MDL reader that opens models, inside the complete model text,
 * so every reference (material, texture, parent, global sequence) is checked as in a saved file.
 */
export function parseEmitterMdlText(doc,id,edited){
 const {family,index,keyword,text,range:[from,to]}=locate(doc,id),replaced=blocks(edited,keyword);
 if(replaced.length!==1||edited.slice(replaced[0][1]).trim()||edited.slice(0,replaced[0][0]).trim())throw Error(`Keep exactly one ${keyword} "…" { … } block.`);
 const reopened=openDocument(new TextEncoder().encode(text.slice(0,from)+edited.trim()+text.slice(to)),'emitter.mdl');
 const errors=reopened.diagnostics.filter(item=>item.severity==='error');
 if(reopened.readOnly||errors.length)throw Error(errors[0]?.message||'The edited text is not a valid SD emitter.');
 const node=reopened.model[family][index],current=doc.model[family][index];
 if(!node||node.ObjectId!==current.ObjectId)throw Error('Keep the ObjectId; it links the emitter to the rest of the model.');
 if(reopened.model.Nodes.length!==doc.model.Nodes.length)throw Error('The edited text changed the number of model nodes.');
 return node;
}

/** Applies a parsed emitter in place, so every reference to the node object stays valid. */
export function applyEmitterNode(model,id,parsed){
 const family=emitterFamily(model,id),node=family&&model[family].find(item=>item.ObjectId===id);
 if(!node)throw Error('The emitter was removed.');
 const pivot=node.PivotPoint;
 for(const key of Object.keys(node))delete node[key];
 Object.assign(node,structuredClone(parsed),{ObjectId:id,PivotPoint:pivot});
}
