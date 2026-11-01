import React,{useState} from 'react';
import {openDocument} from '../src/editor-document.js';
import './rotation-lab.css';
let records=[],sessions,choice={appearance:'Lines'};
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
export function labAppearance(){return choice.appearance;}
export function LabButtons({doc,edit,refresh}){
 const [appearance,setAppearance]=useState(choice.appearance);
 return <div className="rotation-lab-row" role="group" aria-label="Gizmo Lab">
  {['Lines','Rings','Arcs'].map(name=><button key={name} aria-pressed={appearance===name} title={{Lines:'Grab an X, Y or Z ball and swing it around the centre.',Rings:'Grab a coloured ring and circle the selection centre.',Arcs:'Grab a coloured quarter ring and circle the selection centre.'}[name]} onClick={()=>{choice.appearance=name;setAppearance(name);window.dispatchEvent(new Event('mdlxl-gizmo-lab-change'));}}>{name}</button>)}
  <button title="Restore the test model. Ctrl+Z undoes Reset." onClick={()=>{const saved=originals.get(doc);if(!saved)throw Error('This model has no lab baseline.');edit('Reset model',['Geosets'],model=>model.Geosets.forEach((g,i)=>Object.entries(saved[i]).forEach(([key,value])=>g[key].set(value))));refresh();}}>Reset model</button>
 </div>;
}
