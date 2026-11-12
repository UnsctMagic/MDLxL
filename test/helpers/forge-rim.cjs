const assert=require('node:assert/strict');
const sub=(a,b)=>a.map((n,i)=>n-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(n=>n/Math.hypot(...a));
const point=(g,i)=>g.vertices.slice(i*3,i*3+3),key=p=>p.map(n=>n.toFixed(5)).join(',');
function triangles(g,ids){const chosen=ids&&new Set(ids),result=[];for(let i=0;i<g.faces.length;i+=3){const t=g.faces.slice(i,i+3);if(!chosen||t.every(v=>chosen.has(v)))result.push(t.map(v=>point(g,v)));}return result;}
function edges(tris){const map=new Map();for(const t of tris)for(let i=0;i<3;i++){const edge=[key(t[i]),key(t[(i+1)%3])].sort().join('|');if(!map.has(edge))map.set(edge,[]);map.get(edge).push(t);}return map;}
function assertShieldRim(before,after,ids){
 const original=triangles(before,ids),border=[...edges(original)].filter(([,t])=>t.length===1),edited=edges(triangles(after));
 assert.equal(border.length,7,'the actual shield has seven outer edges');
 for(const [edge,[face]]of border){
  const uses=edited.get(edge);assert.equal(uses?.length,1,'shield border retained without a notch: '+edge);
  const normal=unit(cross(sub(face[1],face[0]),sub(face[2],face[0]))),next=uses[0],rimNormal=unit(cross(sub(next[1],next[0]),sub(next[2],next[0])));
  assert.ok(Math.abs(normal.reduce((n,v,i)=>n+v*rimNormal[i],0))<.98,'each outer edge belongs to a sloped rim face');
 }
}
module.exports={assertShieldRim};
