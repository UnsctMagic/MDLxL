import {Buffer} from 'buffer';
import {parseCompatibleMdx,mdxRecords,mdxChunk,readTrack,TEXTURE_SLOTS} from '../../src/mdx-compatibility.js';
import {parseMdx} from '../../src/mdx-container.js';

// Read-only study adapter. The app parser remains unchanged. The complete ordered
// slot records are retained, including repeated slot IDs and all animation keys.
export function parseResearchMdx(input,{inferDuplicateNormalSlot=false}={}) {
 try { return parseCompatibleMdx(input); }
 catch(error) {
  if(!/Unsupported or duplicate texture slot/.test(error.message)) throw error;
  const bytes=Buffer.from(input),container=parseMdx(bytes);
  if(container.version<1100) throw error;
  const records=[],issues=[],chunks=[Buffer.from('MDLX')];
  for(const chunk of container.chunks){
   const payload=bytes.subarray(chunk.payloadOffset,chunk.payloadOffset+chunk.declaredSize);
   if(chunk.tag!=='MTLS'){chunks.push(mdxChunk(chunk.tag,payload));continue;}
   const materials=mdxRecords(payload,'MTLS').map((material,material0)=>{
    const layers=[];let p=20;
    for(let layer0=0;layer0<material.readUInt32LE(16);layer0++){
     const layer=material.subarray(p,p+material.readUInt32LE(p)),count=layer.readUInt32LE(56),slots=[],selected=[],seen=new Set();let q=60;
     for(let order0=0;order0<count;order0++){
      const start=q,id=layer.readInt32LE(q),slot=layer.readUInt32LE(q+4);q+=8;
      if(!TEXTURE_SLOTS[slot]) throw error;
      let track=null;if(layer.toString('ascii',q,q+4)==='KMTF'){const found=readTrack(layer,q,1,true);track=found.track;q+=found.size;}
      const entry={order0,slot,textureId:id,track};slots.push(entry);
      if(!seen.has(slot)){selected.push(layer.subarray(start,q));seen.add(slot);}
      else issues.push({material0,layer0,order0,slot,firstOrder0:slots.find(s=>s.slot===slot).order0,projection:'first occurrence retained only for compatibility; all ordered records preserved'});
     }
     records.push({material0,layer0,slots});
     const header=Buffer.from(layer.subarray(0,60));header.writeUInt32LE(selected.length,56);
     const canonical=Buffer.concat([header,...selected,layer.subarray(q)]);canonical.writeUInt32LE(canonical.length);layers.push(canonical);p+=layer.length;
    }
    if(p!==material.length)throw Error('Unrecognized research material tail');
    const out=Buffer.concat([material.subarray(0,20),...layers]);out.writeUInt32LE(out.length);return out;
   });chunks.push(mdxChunk('MTLS',Buffer.concat(materials)));
  }
  const canonical=Buffer.concat(chunks),model=parseCompatibleMdx(canonical.buffer.slice(canonical.byteOffset,canonical.byteOffset+canonical.byteLength));
  for(const record of records){const layer=model.Materials[record.material0].Layers[record.layer0];layer._ResearchOrderedTextureSlots=record.slots;}
  model._ResearchAmbiguousTextureSlots=issues;
  if(inferDuplicateNormalSlot){
   for(const issue of issues){
    const record=records.find(r=>r.material0===issue.material0&&r.layer0===issue.layer0),entry=record.slots[issue.order0];
    const ids=entry.track?.Keys?.map(k=>k.Vector[0])||[entry.textureId];
    if(entry.slot===0&&!record.slots.some(s=>s.slot===1)&&ids.length&&ids.every(id=>/normal/i.test(model.Textures[id]?.Image||''))){
     const layer=model.Materials[issue.material0].Layers[issue.layer0];layer.NormalTextureID=entry.track||entry.textureId;
     issue.projection='second diffuse slot interpreted as missing normal slot for diagnostic rendering; inferred from every referenced texture path containing normal';issue.inferredSlot=1;
    }
   }
  }
  model._ResearchParserNote='Original bytes unchanged. Duplicate material slot records retained in _ResearchOrderedTextureSlots. Compatibility projection is explicit and does not prove game interpretation.';
  return model;
 }
}
