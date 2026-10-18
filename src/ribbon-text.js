import {openDocument} from './editor-document.js';

const decode=bytes=>typeof bytes==='string'?bytes:new TextDecoder().decode(bytes);

/** Start and end (exclusive) of each top-level `RibbonEmitter "..." { ... }` block, in file order. */
function ribbonBlocks(text){
 const blocks=[],pattern=/^RibbonEmitter\s+"/gm;let match;
 while((match=pattern.exec(text))){
  let depth=0,quoted=false,i=text.indexOf('{',match.index);
  for(;i<text.length;i++){const c=text[i];if(c==='"')quoted=!quoted;else if(!quoted&&c==='{')depth++;else if(!quoted&&c==='}'&&--depth===0)break;}
  if(depth!==0)throw Error('The MDL text of a ribbon is incomplete.');
  blocks.push([match.index,i+1]);pattern.lastIndex=i+1;
 }
 return blocks;
}

/** The exact MDL text the model would save for this ribbon. */
export function ribbonMdlText(doc,id){
 const index=doc.model.RibbonEmitters.findIndex(node=>node.ObjectId===id);
 if(index<0)throw Error('The ribbon was removed.');
 const text=decode(doc.serialize('mdl')),blocks=ribbonBlocks(text);
 if(blocks.length!==doc.model.RibbonEmitters.length)throw Error('The ribbon could not be found in the MDL text.');
 return {text,block:text.slice(...blocks[index]),index};
}

/**
 * Reads an edited block with the same MDL reader that opens models, inside the complete model text,
 * so every reference (material, parent, global sequence) is checked as in a saved file.
 */
export function parseRibbonMdlText(doc,id,edited){
 const {text,index}=ribbonMdlText(doc,id),blocks=ribbonBlocks(text),[from,to]=blocks[index];
 const replaced=ribbonBlocks(edited);
 if(replaced.length!==1||edited.slice(replaced[0][1]).trim()||edited.slice(0,replaced[0][0]).trim())throw Error('Keep exactly one RibbonEmitter "…" { … } block.');
 const reopened=openDocument(new TextEncoder().encode(text.slice(0,from)+edited.trim()+text.slice(to)),'ribbon.mdl');
 const errors=reopened.diagnostics.filter(item=>item.severity==='error');
 if(reopened.readOnly||errors.length)throw Error(errors[0]?.message||'The edited text is not a valid SD ribbon.');
 const ribbon=reopened.model.RibbonEmitters[index],current=doc.model.RibbonEmitters[index];
 if(!ribbon||ribbon.ObjectId!==current.ObjectId)throw Error('Keep the ribbon\'s ObjectId; it links the ribbon to the rest of the model.');
 if(reopened.model.Nodes.length!==doc.model.Nodes.length)throw Error('The edited text changed the number of model nodes.');
 return ribbon;
}

/** Applies a parsed ribbon in place, so every reference to the node object stays valid. */
export function applyRibbonNode(model,id,parsed){
 const node=model.RibbonEmitters.find(item=>item.ObjectId===id);
 if(!node)throw Error('The ribbon was removed.');
 const pivot=node.PivotPoint;
 for(const key of Object.keys(node))delete node[key];
 Object.assign(node,structuredClone(parsed),{ObjectId:id,PivotPoint:pivot});
}
