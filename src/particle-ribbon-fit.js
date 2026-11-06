import {Vector3,Quaternion} from 'three';
import {createStarterRecipe} from './particle-starters.js';
import {particleVertexSelection} from './particle-selection.js';
import {sampleNodeMatrices} from './animation.js';

// Native weapon ribbons store their tint as written; the most common is this orange.
export const NATIVE_RIBBON_COLOR=[1,.64,0];

/**
 * The part of a clip where the weapon actually swings, as native ribbons are keyed:
 * visible from the first to the last moment the fitted edge moves fast, hidden
 * through the wind-up and recovery. A weapon that barely moves keeps the whole clip.
 */
export function ribbonSwingWindow(model,sequenceIndex,parentId,endpoints){
 const clip=model.Sequences?.[sequenceIndex];if(!clip)return null;
 const [start,end]=clip.Interval,length=end-start;if(!(length>0))return null;
 const steps=Math.max(8,Math.min(120,Math.round(length/33))),points=endpoints.map(point=>new Vector3(...point));
 const sample=frame=>{const matrix=parentId==null?null:sampleNodeMatrices(model,frame,sequenceIndex).get(parentId);return points.map(point=>matrix?point.clone().applyMatrix4(matrix):point.clone());};
 const speeds=[];let previous=sample(start);
 for(let i=1;i<=steps;i++){const next=sample(start+length*i/steps);speeds.push(Math.max(...next.map((point,k)=>point.distanceTo(previous[k]))));previous=next;}
 const peak=Math.max(...speeds),reach=points[0].distanceTo(points[1])||1;
 // Under a tenth of the blade per sample at the fastest moment is not a swing.
 if(!(peak>reach*.1))return [start,end];
 // Unbroken fast bursts are strikes. The strongest one, and any other nearly as
 // strong (a double strike), are shown; the wind-up and smaller moves stay hidden.
 // Speed i covers step i to i+1.
 const bursts=[];
 for(let i=0;i<speeds.length;i++){if(speeds[i]<peak*SWING_SHARE)continue;const from=i;let top=0;while(i<speeds.length&&speeds[i]>=peak*SWING_SHARE)top=Math.max(top,speeds[i++]);bursts.push({from,to:i,top});}
 const strikes=bursts.filter(burst=>burst.top>=peak*STRIKE_SHARE);
 // Keep it on a little after the strike so the trail fades out instead of being cut.
 const from=Math.round(start+length*strikes[0].from/steps),to=Math.round(Math.min(end,start+length*(strikes.at(-1).to/steps+SWING_TAIL)));
 return to>from?[from,to]:[start,end];
}
// Fitted to the hand-keyed windows of Blademaster, Hellscream, Arthas, Paladin,
// Tauren Chieftain, Pit Lord, Crypt Lord, Garithos and a community Tzeentch Champion.
const SWING_SHARE=.25,STRIKE_SHARE=.7,SWING_TAIL=.15;

/** Only complete marked polygons contribute; unrelated selected vertices do not. */
export function ribbonPolygonSelection(model,selection={}){
 const marked={};let polygons=0;
 for(const [index,ids] of Object.entries(selection)){
  const geo=model.Geosets[Number(index)];if(!geo)continue;
  const selected=new Set(ids),used=new Set();
  for(let i=0;i<geo.Faces.length;i+=3){const face=Array.from(geo.Faces.slice(i,i+3));if(face.length===3&&face.every(id=>selected.has(id))){polygons++;face.forEach(id=>used.add(id));}}
  marked[index]=[...used];
 }
 return {...particleVertexSelection(model,marked),polygons};
}

/** Principal length and centre shared by a native ribbon and an energy streak. */
export function weaponStripFrame(vertices){
 if(!vertices.length)return null;
 const points=[...new Map(vertices.map(point=>[point.join(','),new Vector3(...point)])).values()];
 if(points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw Error('The selected polygons have invalid coordinates.');
 const center=points.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/points.length),matrix=Array(9).fill(0);
 for(const p of points){const d=p.clone().sub(center).toArray();for(let i=0;i<3;i++)for(let j=0;j<3;j++)matrix[i*3+j]+=d[i]*d[j];}
 const multiply=v=>new Vector3(matrix[0]*v.x+matrix[1]*v.y+matrix[2]*v.z,matrix[3]*v.x+matrix[4]*v.y+matrix[5]*v.z,matrix[6]*v.x+matrix[7]*v.y+matrix[8]*v.z);
 let axis,largest=-1;
 for(const seed of [[1,0,0],[0,1,0],[0,0,1]]){let v=new Vector3(...seed);for(let i=0;i<32;i++){const next=multiply(v);if(next.lengthSq()<1e-20)break;v=next.normalize();}const variance=v.dot(multiply(v));if(variance>largest){axis=v;largest=variance;}}
 const components=axis.toArray(),dominant=components.map(Math.abs).indexOf(Math.max(...components.map(Math.abs)));if(components[dominant]<0)axis.negate();
 const distances=points.map(p=>p.clone().sub(center).dot(axis)),min=Math.min(...distances),max=Math.max(...distances),length=max-min;
 if(!(length>1e-5))return null;
 center.addScaledVector(axis,(min+max)/2);
 return {center,axis,length};
}

/** WC3 SD ribbons are straight strips along local Y. Fit that axis to the marked back. */
export function fitRibbonToPolygons(model,selection){
 const selected=ribbonPolygonSelection(model,selection);
 if(!selected.polygons)throw Error('In Vertices, select the polygons along the weapon’s back, then open EMTR.');
 const frame=weaponStripFrame(selected.points);
 if(!frame)throw Error('Select a longer strip of polygons along the weapon.');
 const {center,axis,length}=frame;
 const recipe=createStarterRecipe('ribbon'),ribbon=recipe.native.RibbonEmitters[0];
 recipe.name='Weapon ribbon';recipe.id='weapon-ribbon';ribbon.Name='Weapon ribbon';
 // Blizzard's weapon trails (Blademaster, Hellscream, Chaos Blademaster and the
 // models built on them): RibbonBlur1, Additive, a faint tinted strip and a
 // short life, so the swing reads as a smear rather than a solid white sheet.
 recipe.native.Materials[0].Layers[0].FilterMode=3;
 Object.assign(ribbon,{Alpha:.35,Color:new Float32Array(NATIVE_RIBBON_COLOR),LifeSpan:.35,EmissionRate:35});
 ribbon.PivotPoint=new Float32Array(center.toArray());recipe.native.PivotPoints[ribbon.ObjectId]=ribbon.PivotPoint;
 ribbon.HeightAbove=ribbon.HeightBelow=length/2;
 ribbon.Rotation={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),axis).toArray())}]};
 return {...selected,recipe,length,endpoints:[center.clone().addScaledVector(axis,-length/2).toArray(),center.clone().addScaledVector(axis,length/2).toArray()]};
}
