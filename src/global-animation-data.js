import {Buffer} from 'buffer';
import {parseMdx} from './mdx-container.js';
import {parseMdl} from './mdl-lossless.js';

const prefix='// MDLXL_GLOBAL_ANIMATIONS_V1 ';
const collections=['Geosets','Materials','Textures','TextureAnims','Bones','ParticleEmitters2','RibbonEmitters','EventObjects'];
export function fxData(model){
 const parts=[];
 for(const [i,g] of model.Geosets.entries())if(g._FxStack)parts.push([i,g._FxStack]);
 if(!parts.length)return null;
 const tags={};
 for(const key of collections){
  const entries=(model[key]||[]).flatMap((item,i)=>item._FxTag?[[i,item._FxTag]]:[]);
  if(entries.length)tags[key]=entries;
 }
 return {parts,tags};
}
export function isFxChunk(bytes,c){
 return c.tag==='XLFX' && Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength).subarray(c.payloadOffset,c.payloadOffset+prefix.length).toString()===prefix;
}
export function fxRecords(bytes,format,container){
 if(format==='mdl')return (container||parseMdl(bytes)).tokens.filter(t=>t.kind==='line-comment'&&t.raw.toString().startsWith(prefix)).map(t=>({start:t.start,end:t.end+(bytes[t.end]===13&&bytes[t.end+1]===10?2:bytes[t.end]===10?1:0),text:t.raw.toString()}));
 return (container||parseMdx(bytes)).chunks.filter(c=>isFxChunk(bytes,c)).map(c=>({start:c.offset,end:c.payloadOffset+c.declaredSize,text:bytes.subarray(c.payloadOffset,c.payloadOffset+c.declaredSize).toString()}));
}
export function readFxData(bytes,format,model,container){
 for(const record of fxRecords(bytes,format,container)){
  let data;
  try{data=JSON.parse(record.text.slice(prefix.length));}catch{return [{severity:'warning',code:'FX_ANNOTATION',message:'The saved FX layer list could not be read.'}];}
  if(!Array.isArray(data?.parts)||!data.tags)continue;
  for(const entry of data.parts){
   if(!Array.isArray(entry))continue;
   const [i,s]=entry;
   if(!model.Geosets[i]||typeof s?.look!=='string'||typeof s.owner!=='string'||!Number.isFinite(s.loop)||!Array.isArray(s.createdClocks)||!model.Materials[s.baseMaterial])continue;
   if(Array.isArray(s.layers)&&s.layers.every(l=>l&&Number.isInteger(l.id)&&Array.isArray(l.tint)&&Array.isArray(l.offset)))model.Geosets[i]._FxStack=s;
  }
  for(const family of collections){
   if(!Array.isArray(data.tags[family]))continue;
   for(const entry of data.tags[family])if(Array.isArray(entry)&&model[family]?.[entry[0]]&&typeof entry[1]==='string')model[family][entry[0]]._FxTag=entry[1];
  }
 }
 return [];
}
export function writeFxData(input,format,model){
 const bytes=Buffer.from(input),data=fxData(model);
 if(!data&&!bytes.includes(prefix))return bytes;
 const records=fxRecords(bytes,format),pieces=[];let start=0;
 for(const r of records){pieces.push(bytes.subarray(start,r.start));start=r.end;}
 const body=Buffer.concat([...pieces,bytes.subarray(start)]);
 if(!data)return body;
 const text=Buffer.from(prefix+JSON.stringify(data)+'\n');
 if(format==='mdl'){
  const bom=body.subarray(0,3).equals(Buffer.from([239,187,191]))?3:0;
  return Buffer.concat([body.subarray(0,bom),text,body.subarray(bom)]);
 }
 const header=Buffer.alloc(8);header.write('XLFX');header.writeUInt32LE(text.length,4);
 const end=body.length-parseMdx(body).trailingBytes.length;
 return Buffer.concat([body.subarray(0,end),header,text,body.subarray(end)]);
}
export function forgetFxData(model){
 for(const key of collections)for(const item of model[key]||[]){delete item._FxTag;if(key==='Geosets')delete item._FxStack;}
}
