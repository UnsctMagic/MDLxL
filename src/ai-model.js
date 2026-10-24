import { createChanges, applyChanges } from './history-store.js';

const types = { Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array };
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const nodeOwners = new Set(['Bones','Helpers','Attachments','Lights','EventObjects','CollisionShapes','ParticleEmitters','ParticleEmitters2','RibbonEmitters','ParticleEmitterPopcorns']);
export const ignoreAiAlias = path => path[0] === 'Nodes' || path.length === 3 && nodeOwners.has(path[0]) && path[2] === 'PivotPoint';
export function encodeAiValue(value,ancestors=new Set()) {
  if (ArrayBuffer.isView(value)) return { $type: value.constructor.name, $data: Array.from(value) };
  if (value instanceof ArrayBuffer) return {$type:'Uint8Array',$data:Array.from(new Uint8Array(value))};
  if (value === undefined) return null;
  if (['bigint','function','symbol'].includes(typeof value))throw Error('Return a JSON value from the model script.');
  if (value === null || typeof value !== 'object') return value;
  if(ancestors.has(value))throw Error('Return a JSON value without circular references.');
  ancestors.add(value);
  try{return Array.isArray(value)?value.map(item=>encodeAiValue(item,ancestors)):Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encodeAiValue(item,ancestors)]));}
  finally{ancestors.delete(value);}
}
export function decodeAiValue(value) {
  if (!value || typeof value !== 'object') return value;
  if (value.$type) {
    const Type = Object.hasOwn(types,value.$type)?types[value.$type]:null;
    if (!Type || !Array.isArray(value.$data) || value.$data.some(x => typeof x !== 'number' || !Number.isFinite(x))) throw Error('Invalid typed array.');
    const result = new Type(value.$data);
    if (!(result instanceof Float32Array || result instanceof Float64Array) && result.some((x,i)=>x!==value.$data[i])) throw Error('Typed array value is out of range.');
    if (result.some(x=>!Number.isFinite(x))) throw Error('Typed array contains a non-finite value.');
    return result;
  }
  if (Array.isArray(value)) return value.map(decodeAiValue);
  const result = {};
  for (const [key,item] of Object.entries(value)) { if(forbidden.has(key))throw Error('Unsafe model property.'); result[key]=decodeAiValue(item); }
  return result;
}
export function pointerParts(path) {
  if (path === '') return [];
  if (typeof path !== 'string' || !path.startsWith('/') || /~(?:[^01]|$)/.test(path)) throw Error('Use a valid JSON Pointer, such as /Geosets/0/Vertices.');
  const parts = path.slice(1).split('/').map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~'));
  if(parts.some(x=>forbidden.has(x)))throw Error('Unsafe model path.');
  return parts;
}
export const pointer = parts => '/' + parts.map(x=>String(x).replace(/~/g,'~0').replace(/\//g,'~1')).join('/');
export function readPointer(value, path) {
  for(const key of pointerParts(path)) {
    if(value == null || !Object.hasOwn(value,key))throw Error('Model path does not exist: '+path);
    value=value[key];
  }
  return value;
}
export function readAiModel(model, {path='', offset=0, limit=2000}={}) {
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>20000)throw Error('Invalid read range.');
  const value=readPointer(model,path), list=Array.isArray(value)||ArrayBuffer.isView(value);
  return {path,offset:list?offset:0,total:list?value.length:null,truncated:list?offset+limit<value.length:false,value:encodeAiValue(list?value.slice(offset,offset+limit):value)};
}
export function patchAiModel(model, operations) {
  if(!Array.isArray(operations)||!operations.length||operations.length>10000)throw Error('Provide 1–10000 patch operations.');
  const next=structuredClone(model);
  for(const op of operations) {
    const parts=pointerParts(op.path); if(!parts.length)throw Error('Patch a model section, not the document root.');
    const key=parts.pop(), parent=parts.length?readPointer(next,pointer(parts)):next;
    if(!parent||typeof parent!=='object')throw Error('Patch parent is not an object.');
    if(op.op==='set') {
      if((Array.isArray(parent)||ArrayBuffer.isView(parent))&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=parent.length))throw Error('Use splice to resize an array.');
      const value=decodeAiValue(op.value);
      if(ArrayBuffer.isView(parent) && (typeof value!=='number'||!Number.isFinite(value)))throw Error('A numeric array requires finite numbers.');
      parent[key]=value;
      if(ArrayBuffer.isView(parent)&&!(parent instanceof Float32Array||parent instanceof Float64Array)&&parent[key]!==value)throw Error('Numeric value is out of range.');
    } else if(op.op==='delete') {
      if(Array.isArray(parent)||ArrayBuffer.isView(parent))throw Error('Use splice to remove array elements.');
      if(!Object.hasOwn(parent,key))throw Error('Cannot delete a missing property.');
      delete parent[key];
    } else if(op.op==='splice') {
      const array=parent[key]; if(!Array.isArray(array)&&!ArrayBuffer.isView(array))throw Error('Splice requires an array.');
      if(!Number.isSafeInteger(op.index)||op.index<0||op.index>array.length||!Number.isSafeInteger(op.deleteCount)||op.deleteCount<0||op.index+op.deleteCount>array.length)throw Error('Invalid splice range.');
      const items=decodeAiValue(op.items||[]), result=Array.from(array); result.splice(op.index,op.deleteCount,...items);
      parent[key]=ArrayBuffer.isView(array)?decodeAiValue({$type:array.constructor.name,$data:result}):result;
    } else throw Error('Unknown patch operation.');
  }
  return next;
}
const contains = (parent, child) => parent.length<=child.length && parent.every((part,i)=>String(part)===String(child[i]));
const equal = (a,b) => JSON.stringify(encodeAiValue(a))===JSON.stringify(encodeAiValue(b));
function protectedAnimationKeys(before, after, ranges) {
  if(!ranges)return;
  if(!Array.isArray(ranges)||!ranges.length||ranges.some(r=>!Array.isArray(r)||r.length!==2||!r.every(Number.isFinite)||r[0]>r[1]))throw Error('Invalid animation ranges.');
  const outside=frame=>!ranges.some(([a,b])=>frame>=a&&frame<=b);
  function visit(a,b,path=[]) {
    if(ignoreAiAlias(path))return;
    if(a?.Keys||b?.Keys) {
      if(!equal(a?.Keys?.filter(k=>outside(k.Frame))||[],b?.Keys?.filter(k=>outside(k.Frame))||[]))throw Error('Edit changes keys outside the requested animation ranges: '+pointer(path));
      if((a?.GlobalSeqId!=null||b?.GlobalSeqId!=null)&&!equal(a,b))throw Error('Animation ranges cannot authorize changes to global sequence tracks.');
      if(a&&b && (a.LineType!==b.LineType||a.GlobalSeqId!==b.GlobalSeqId) && ((a.Keys||[]).some(k=>outside(k.Frame))))throw Error('Track interpolation changes would affect protected animation keys.');
      return;
    }
    if(!a&&!b||ArrayBuffer.isView(a)||ArrayBuffer.isView(b))return;
    if(typeof a==='object'||typeof b==='object')for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))visit(a?.[key],b?.[key],[...path,key]);
  }
  visit(before,after);
}
export function prepareAiEdit(before, after, {scope, protectedPaths=[], animationRanges}={}) {
  if(!Array.isArray(scope)||!scope.length)throw Error('An edit needs an explicit model scope.');
  const allowed=scope.map(pointerParts), protectedScopes=protectedPaths.map(pointerParts);
  if(allowed.some(p=>!p.length||p[0]==='Nodes'))throw Error('Scope must name canonical model sections; use /Bones or another node collection instead of /Nodes.');
  const changes=createChanges(before,after,{ignore:ignoreAiAlias});
  for(const change of changes) {
    if(!allowed.some(p=>contains(p,change.path)))throw Error('Edit exceeds its scope: '+pointer(change.path));
    for(const p of protectedScopes)if(contains(p,change.path)||contains(change.path,p)) {
      // A parent array splice can include unchanged protected children.
      let a,b; try{a=readPointer(before,pointer(p));}catch{} try{b=readPointer(after,pointer(p));}catch{}
      if(!equal(a,b))throw Error('Edit changes a protected path: '+pointer(p));
    }
  }
  protectedAnimationKeys(before,after,animationRanges);
  return {changes,sections:[...new Set(changes.map(c=>c.path[0]))],summary:changes.slice(0,100).map(c=>({path:pointer(c.path),kind:c.kind,...(c.kind==='bytes'?{bytes:c.after.byteLength}:c.kind==='splice'?{index:c.index,removed:c.before.length,added:c.after.length}:{})})),changeCount:changes.length};
}
export function applyAiEdit(model, prepared) { applyChanges(model,prepared.changes); }
export function aiSelectionSignature(state) {
  return JSON.stringify([state.selection,Array.from(state.selectedNodeIds||[]),Array.from(state.selectable||[]),state.activeGeoset,state.uvSet,state.sequence,state.globalSeqId,state.keyframes,state.mode,state.workplane,state.session?.paintWorkingRevision,state.uvEditing,state.uvEligibleSelection]);
}
export function checkAiTarget(target,state) {
  if(!target || target.documentId!==state.session.id || target.revision!==state.doc.revision || target.selectionSignature!==aiSelectionSignature(state))throw Error('The model or selection changed since this prompt. Nothing was applied. Ask the user to send the request again for the current selection.');
}
