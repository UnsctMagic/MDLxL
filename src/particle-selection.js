import {vertexBones} from './part-bones.js';

/** The ribbon influence rule, shared by marked vertices and complete polygons. */
export function particleVertexSelection(model,selection={}){
 const points=[],bindings=[];
 for(const [index,ids]of Object.entries(selection)){
  const geo=model.Geosets[Number(index)];if(!geo)continue;
  for(const id of new Set(ids))if(Number.isInteger(id)&&id>=0&&id*3+2<geo.Vertices.length){
   points.push(Array.from(geo.Vertices.slice(id*3,id*3+3)));
   bindings.push([...new Set(vertexBones(geo,id))]);
  }
 }
 const first=bindings[0]||[],rigid=bindings.length>0&&first.length<=1&&bindings.every(group=>group.length===first.length&&group[0]===first[0]);
 const influence=new Map();for(const group of bindings)for(const id of group)influence.set(id,(influence.get(id)||0)+1/group.length);
 const parent=[...influence].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
 return {points,parent,needsBone:bindings.length>0&&!rigid,center:[0,1,2].map(axis=>points.length?points.reduce((sum,point)=>sum+point[axis],0)/points.length:0)};
}
