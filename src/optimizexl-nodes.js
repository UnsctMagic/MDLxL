// Node bookkeeping shared by OptimizeXL reductions and repairs.
import { NODE_TYPES } from './editor-document.js';
import { allNodes } from './animation.js';

export const NODE_COLLECTIONS = Object.values(NODE_TYPES).map(([key]) => key);
const TYPE_FLAGS = 0x7f00;

export function rebuildNodes(m){m.Nodes=[];for(const n of NODE_COLLECTIONS.flatMap(k=>m[k]||[])){m.Nodes[n.ObjectId]=n;n.PivotPoint=m.PivotPoints[n.ObjectId];}}
export function remapNodes(m,removed,replacements=new Map()){
 const old=allNodes(m).filter(n=>!removed.has(n.ObjectId)),map=new Map(old.map((n,i)=>[n.ObjectId,i]));
 for(const [id,target]of replacements)map.set(id,map.get(target));
 const pivots=old.map(n=>new Float32Array(n.PivotPoint||m.PivotPoints[n.ObjectId]||[0,0,0]));
 for(const key of NODE_COLLECTIONS)m[key]=(m[key]||[]).filter(n=>!removed.has(n.ObjectId));
 for(const n of old){n.ObjectId=map.get(n.ObjectId);n.Parent=n.Parent==null?null:map.get(n.Parent);}
 for(const g of m.Geosets)g.Groups=g.Groups.map(group=>group.map(id=>map.get(id)));
 m.PivotPoints=pivots;rebuildNodes(m);
}
/** Move a node between the Bone and Helper collections. Both transform their
 * children and vertices identically; only the node type changes. */
export function changeNodeType(m,node,type){
 const from=NODE_COLLECTIONS.find(k=>(m[k]||[]).includes(node)),[to,,flags]=NODE_TYPES[type];
 m[from]=m[from].filter(n=>n!==node);node.Flags=(node.Flags&~TYPE_FLAGS)|flags;
 if(type==='Bone')Object.assign(node,{GeosetId:node.GeosetId??null,GeosetAnimId:node.GeosetAnimId??null});else{delete node.GeosetId;delete node.GeosetAnimId;}
 (m[to]||=[]).push(node);m[to].sort((a,b)=>a.ObjectId-b.ObjectId);rebuildNodes(m);
}
