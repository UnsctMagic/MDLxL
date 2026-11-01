import React,{useState} from 'react';
import * as THREE from 'three';
import {openDocument} from '../src/editor-document.js';
import {beginRotationDrag as beginProduct,rotationDragDegrees as productDegrees} from '../src/rotation-drag.js';
import {LAB_STYLES,current} from '../src/rotation-lab-styles.js';
import './rotation-lab.css';
let records=[],sessions,choice={style:'A',unit:false};
const originals=new WeakMap();
export async function prepareLab(){records=await window.rotationLab.fixtures();}
export function labSessions(newSession){
  return sessions??=records.map(record=>{
    const session=newSession(openDocument(new Uint8Array(record.bytes),record.name),record.path);
    session.viewState.selectable=new Set(session.doc.model.Geosets.map((_,i)=>i));
    session.viewState.selection=Object.fromEntries(session.doc.model.Geosets.map((g,i)=>[i,Array.from({length:g.Vertices.length/3},(_,v)=>v)]));
    originals.set(session.doc,session.doc.model.Geosets.map(g=>Object.fromEntries(['Vertices','Normals','Tangents'].filter(key=>g[key]).map(key=>[key,g[key].slice()]))));
    return session;
  });
}
export function LabButtons({doc,edit,refresh}){
  const [style,setStyle]=useState(choice.style),[unit,setUnit]=useState(choice.unit);
  const select=value=>{choice={...choice,style:value};setStyle(value);};
  const tips={A:'Drag along the ring, using the current MDLxL rule.',B:'Circle the pivot. Inside 12 px, the turn holds until you move out.',C:'Drag left or right. Vertical movement does not turn.',D:'Drag along the projected ring tangent at your grab point.',E:'Drag freely: sideways turns about screen up; vertical turns about screen right.'};
  return <div className="rotation-lab-row" role="group" aria-label="Rotation Lab">
    {Object.entries({A:'Current',B:'Circle around',C:'Straight drag',D:'Drawn ring',E:'Free turn'}).map(([key,name])=><button key={key} aria-pressed={style===key} title={tips[key]} onClick={()=>select(key)}>{key} {name}</button>)}
    <button title="Restore this test model’s original vertices. Ctrl+Z undoes Reset." onClick={()=>{const saved=originals.get(doc);if(!saved)throw Error('This model has no lab baseline.');edit('Reset model',['Geosets'],model=>model.Geosets.forEach((g,i)=>Object.entries(saved[i]).forEach(([key,value])=>g[key].set(value))));refresh();}}>Reset model</button>
    <button aria-label="Your speed / 1×" aria-pressed={unit} title="Use your saved Rotation speed, or compare all styles at 1×." onClick={()=>{choice={...choice,unit:!unit};setUnit(!unit);}}>{unit?'1×':'Your speed'}</button>
  </div>;
}
export function beginRotationDrag(options={}){
  if(!options.lab)return beginProduct(options);
  const selected={...choice}, speed=selected.unit?1:options.sensitivity;
  const rule=selected.style==='A'?current:LAB_STYLES[selected.style];
  const drag=rule.begin({...options,sensitivity:speed});
  return Object.assign(drag,{labChoice:selected,labRule:rule,labPixels:[0,0]});
}
export function rotationDragDegrees(drag,dx,dy,pointerSensitivity=1){
  if(!drag.labChoice)return productDegrees(drag,dx,dy,pointerSensitivity);
  drag.labPixels=[dx,dy];
  const pointer=drag.labChoice.unit?1:pointerSensitivity;
  const value=drag.labRule.degrees(drag,dx,dy);
  return typeof value==='number'?value*pointer:Math.hypot(value.up,value.right)*pointer;
}
export function labEuler(drag,dx,dy,pointerSensitivity,shift,camera,axis){
  const snap=value=>shift?Math.round(value/15)*15:value;
  if(!drag.labChoice||drag.labChoice.style!=='E')return new THREE.Euler(...[0,1,2].map(i=>THREE.MathUtils.degToRad(i===axis?snap(rotationDragDegrees(drag,dx,dy,pointerSensitivity)):0)));
  const value=drag.labRule.degrees(drag,dx,dy),speed=drag.labChoice.unit?1:pointerSensitivity;
  const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const q=new THREE.Quaternion().setFromAxisAngle(up,THREE.MathUtils.degToRad(snap(value.up*speed)));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(right,THREE.MathUtils.degToRad(snap(value.right*speed))));
  drag.labFreeDegrees={up:snap(value.up*speed),right:snap(value.right*speed)};
  // transformVertices applies world X, then Y, then Z (Three's ZYX order).
  return new THREE.Euler(0,0,0,'ZYX').setFromQuaternion(q,'ZYX');
}
export function logLabDrag(drag,pane,camera){
  if(!drag?.moved||!drag.rotationDrag?.labChoice)return;
  const d=drag.rotationDrag;
  window.rotationLab.log({style:d.labChoice.style,pane,cameraDirection:camera.getWorldDirection(new THREE.Vector3()).toArray(),pixels:d.labPixels,rotationDegrees:drag.payload?.rotation,freeDegrees:d.labFreeDegrees??null,speed:d.labChoice.unit?'1×':'Your speed',sensitivity:d.sensitivity});
}
