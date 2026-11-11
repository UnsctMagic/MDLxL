import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { Tool } from './EditorControls.jsx';
import ToolIcon from './ToolIcon.jsx';
import { ShapeThumbnail } from './ForgeShapes.jsx';
import { ForgeMoldTools, ForgeMoldControls } from './ForgeMoldTools.jsx';
import { forgeMoldState, prepareForgeMold, previewForgeMold, clamp } from '../src/forge-molding.js';
import { forgeMoldHandles } from './forge-mold-handles.js';
import { pickEditHandle } from './viewport-edit-handles.js';
import { normalDragTranslation } from './viewport-math.js';
import { pickForgeParts, forgePartsFromVertices } from './forge-viewport-selection.js';
import { forgeShapeMesh, forgeSelectionVertices, forgeSelectionNormal, forgeSelectionCenter, extrudeForgeFaces, insetForgeFaces, forgeCutFrame, cutForgeShape } from '../src/forge-shape-editing.js';
import { vertexForgeDraft, vertexForgeFaces, vertexForgeResult } from '../src/forge-vertex.js';
import { FORGE_SHAPES, PRIMITIVE_DEFAULTS } from '../src/forge-primitives.js';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import { isTypingTarget } from '../src/preferences.js';
import './forge.css';

/** An added toolset: selection, transforms, camera and history stay in App and
 * its existing Viewport. Only the active operation has an uncommitted preview. */
export default function ForgeVertexTools({ model, revision, selection, selectable, activeGeoset, readOnly, onPreview, onPick, onSelection, onCommit, onAdd, onClose, onWorkTool }) {
  const [operation,setOperation]=useState(null), [palette,setPalette]=useState(false), [settings,setSettings]=useState(PRIMITIVE_DEFAULTS), [error,setError]=useState('');
  const [scope,setScope]=useState('Vertices');
  const drag=useRef(null), current=useRef(null);
  const selectionKey=JSON.stringify(selection);
  const cancel=()=>{drag.current=null;setOperation(null);setError('');onPreview(null);return true;};
  useLayoutEffect(()=>{cancel();},[revision,model,selectionKey]);
  useEffect(()=>()=>{onPreview(null);onPick(null);},[onPreview,onPick]);
  const selectableKey=[...selectable].join(',');
  const pickEntries=useMemo(()=>{
    if(scope==='Vertices')return null;
    try{
      const chosen=Object.fromEntries([...selectable].filter(i=>model.Geosets[i]?.Faces.length).map(i=>[i,Array.from({length:model.Geosets[i].Vertices.length/3},(_,v)=>v)]));
      return Object.keys(chosen).length?vertexForgeDraft(model,chosen).shapes.map(shape=>({shape,mesh:forgeShapeMesh(shape)})):[];
    }catch(e){return {error:e.message};}
  },[scope,model,revision,selectableKey]);
  useLayoutEffect(()=>{
    if(!Array.isArray(pickEntries)||operation){onPick(null);return;}
    const previous=Object.fromEntries(pickEntries.map(({shape})=>{
      const vertices=new Set((selection[shape.id]||[]).map(i=>shape.sourceVertices[i]));
      const exploded=forgeShapeMesh(shape).vertexIds.flatMap((id,i)=>vertices.has(id)?[i]:[]);
      return [shape.id,exploded];
    }));
    const parts=forgePartsFromVertices(pickEntries,Object.fromEntries(pickEntries.map(({shape},i)=>[i,previous[shape.id]])),scope);
    onPick({select:event=>{
      const picked=pickForgeParts(pickEntries,parts,scope,event);
      onSelection(Object.fromEntries(pickEntries.map(({shape})=>{
        const ids=new Set(forgeSelectionVertices(shape,picked[shape.id],scope));
        return [shape.id,shape.sourceVertices.flatMap((id,i)=>ids.has(id)?[i]:[])];
      })));
    }});
  },[pickEntries,scope,selectionKey,operation,onPick]);
  const support=useMemo(()=>{
    if(!operation?.mold)return null;
    try{return {draft:prepareForgeMold(operation.draft,operation.mold)};}catch(e){return {error:e.message};}
  },[operation?.draft,operation?.mold?.tool,operation?.mold?.axis,operation?.mold?.center,operation?.mold?.width]);
  const result=useMemo(()=>{
    if(!operation)return null;
    try {
      let draft=operation.draft;
      if(operation.mold){if(support.error)throw Error(support.error);draft=previewForgeMold(draft,support.draft,operation.mold);}
      else if(operation.kind==='Inset')draft={...draft,shapes:draft.shapes.map(shape=>draft.selection[shape.id].length?insetForgeFaces(shape,draft.selection[shape.id],operation.amount):shape)};
      else if(operation.kind==='Cut'){
        const sections=Number(operation.sections);
        if(!Number.isInteger(sections)||sections<2||sections>64)throw Error('Choose between 2 and 64 sections.');
        draft={...draft,shapes:draft.shapes.map(shape=>{
          const ids=draft.selection[shape.id];if(!ids.length)return shape;
          const frame=forgeCutFrame(shape,ids[0],operation.turned,ids);
          return cutForgeShape(shape,frame,Array.from({length:sections-1},(_,i)=>(i+1)/sections),ids);
        })};
      } else if(operation.kind==='Extrude'&&operation.distance) draft={...draft,shapes:draft.shapes.map(shape=>draft.selection[shape.id].length?extrudeForgeFaces(shape,draft.selection[shape.id],forgeSelectionNormal([shape],draft.selection).map(n=>n*operation.distance)):shape)};
      return {draft,model:vertexForgeResult(model,operation.draft,draft)};
    } catch(e){return {error:e.message};}
  },[operation,support,model]);
  const handles=useMemo(()=>operation?.mold?forgeMoldHandles(operation.mold):operation?.kind==='Inset'?forgeMoldHandles(operation.handle):null,[operation]);
  const apply=()=>{
    if(!operation||!result?.model||result.error)return;
    if(onCommit(operation.kind,result.model,revision)!==false)cancel();
  };
  current.current={operation,result,apply,cancel};
  const startMold=event=>{
    const active=current.current.operation, state=active.mold||active.handle, handle=pickEditHandle(handles,event);
    if(!handle)return {update(){},finish(){},cancel};
    const session={};drag.current=session;
    const axis=handle.id==='amount'?state.direction:state.axis, normal=new Vector3().setComponent(axis,1),pivot=new Vector3(...handle.position);
    return {update:end=>{
      if(drag.current!==session)return;
      const delta=normalDragTranslation(event.camera,pivot,normal,end.width,end.height,end.x-event.start.x,end.y-event.start.y).getComponent(axis);
      const size=Math.max(...state.bounds.span,1),length=Math.max(state.bounds.span[state.axis],1);
      let next={...state};
      if(handle.id==='center')next.center=clamp(state.center+delta,state.bounds.min[state.axis],state.bounds.max[state.axis]);
      else if(handle.id.startsWith('range'))next.width=clamp(state.width+delta*(handle.id==='rangeStart'?-2:2),length*.05,length*2);
      else next.amount=active.kind==='Inset'?state.amount+delta:state.tool==='Bend'||state.tool==='Twist'?clamp(state.amount+delta/size*180,-180,180):state.tool==='Bevel'?Math.max(0,state.amount+delta):clamp(state.amount+delta/Math.max(state.bounds.span[state.direction]/2,size*.12),-.9,3);
      setOperation({...active,...(active.mold?{mold:next}:{handle:next,amount:next.amount})});
    },finish:()=>{drag.current=null;},cancel};
  };
  const startExtrude=event=>{
    const active=current.current.operation, draft=active.draft;
    const entries=draft.shapes.map(shape=>({shape,mesh:forgeShapeMesh(shape)})),hit=pickForgeParts(entries,{},'Faces',event);
    const shape=draft.shapes.find(s=>hit[s.id]?.some(id=>draft.selection[s.id].includes(id)));if(!shape)return null;
    const normal=new Vector3(...forgeSelectionNormal([shape],draft.selection)),pivot=new Vector3(...forgeSelectionCenter([shape],draft.selection,'Faces')),session={distance:0};drag.current=session;
    return {update:end=>{
      if(drag.current!==session)return;
      session.distance=normalDragTranslation(event.camera,pivot,normal,end.width,end.height,end.x-event.start.x,end.y-event.start.y).dot(normal);
      setOperation({...active,distance:session.distance});
    },finish:()=>{
      if(drag.current!==session)return;
      if(session.distance){
        try{const next={...draft,shapes:draft.shapes.map(s=>draft.selection[s.id].length?extrudeForgeFaces(s,draft.selection[s.id],forgeSelectionNormal([s],draft.selection).map(n=>n*session.distance)):s)};
          if(onCommit('Extrude',vertexForgeResult(model,draft,next),revision)!==false)cancel();
        }catch(e){setError(e.message);}
      }else cancel();
    },cancel};
  };
  useLayoutEffect(()=>{
    if(!operation){onPreview(null);return;}
    onPreview({model:result?.model||model,editHandles:handles,onStartPartDrag:operation.kind==='Extrude'?startExtrude:handles?startMold:()=>({update(){},finish(){},cancel}),cancel});
  },[operation,result,handles,onPreview]);
  useWindowKeyClaim(({event})=>{
    if(!operation||isTypingTarget(event.target))return false;
    if(event.key==='Escape'||(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){cancel();return true;}
    if(event.key==='Enter'){apply();return true;}
    return false;
  },0);
  const begin=kind=>{
    try{
      onWorkTool('translate');setPalette(false);setError('');
      let draft=vertexForgeDraft(model,selection);
      if(['Extrude','Inset','Cut'].includes(kind)){
        draft=vertexForgeFaces(draft);
        if(!Object.values(draft.selection).some(ids=>ids.length))throw Error('Select a complete face to use '+kind+'.');
        const handle=kind==='Inset'?{...forgeMoldState(draft,'Inset'),amount:0}:null;
        setOperation({kind,draft,amount:0,distance:0,sections:2,turned:false,handle});
      }else setOperation({kind,draft,mold:forgeMoldState(draft,kind)});
    }catch(e){setError(e.message);}
  };
  const selected=Object.values(selection).some(ids=>ids.length),disabled=readOnly||!selected;
  const add=shape=>{try{cancel();if(onAdd({...settings,shape,zUp:true})!==false)setPalette(false);}catch(e){setError(e.message);}};
  return <aside className="forge-vertex-tools" aria-label="Forge tools" data-hotkey-scope="forge-vertex" data-hotkey-category="Forge in Vertex editor">
    <header><strong>FORGE</strong><button aria-label="Close Forge tools" title="Close the toolset. Committed edits stay in the model." onClick={()=>{cancel();onClose();}}>×</button></header>
    <div className="forge-selection-scope" role="group" aria-label="Forge selection">{['Vertices','Edges','Faces'].map(name=><button key={name} aria-pressed={scope===name} onClick={()=>{cancel();setScope(name);onWorkTool('select');}}>{name}</button>)}</div>
    <div className="classic-tools forge-shape-tools">
      <Tool title="Add shape" action="forge:vertex:add" disabled={readOnly||!model.Geosets[activeGeoset]} active={palette} onClick={()=>{cancel();setPalette(!palette);}}><ToolIcon name="addShape" className="modern-retro-icon"/></Tool>
      {['Extrude','Inset','Cut'].map(name=><Tool key={name} title={name} action={'forge:vertex:'+name.toLowerCase()} active={operation?.kind===name} disabled={disabled} onClick={()=>begin(name)}><ToolIcon name={name.toLowerCase()} className="modern-retro-icon"/></Tool>)}
    </div>
    <ForgeMoldTools active={operation?.mold?.tool} disabled={disabled} onChoose={begin}/>
    {palette&&<div className="forge-vertex-palette" role="group" aria-label="Add shape">
      <div className="forge-shape-gallery">{FORGE_SHAPES.map(shape=><button key={shape} aria-label={shape} title={'Add '+shape+' to Geoset '+(activeGeoset+1)} onClick={()=>add(shape)}><ShapeThumbnail shape={shape}/><span>{shape}</span></button>)}</div>
      <div className="forge-dimensions">{['width','height','depth'].map(key=><label key={key}>{key[0].toUpperCase()+key.slice(1)}<input aria-label={key[0].toUpperCase()+key.slice(1)} type="number" min=".01" value={settings[key]} onChange={e=>setSettings({...settings,[key]:+e.target.value})}/></label>)}</div>
      <label>Detail<input aria-label="Shape complexity" type="range" min="1" max="4" value={settings.complexity} onChange={e=>setSettings({...settings,complexity:+e.target.value})}/></label>
    </div>}
    <ForgeMoldControls state={operation?.mold} error={result?.error} onChange={mold=>setOperation({...operation,mold})} onApply={apply} onCancel={cancel}/>
    {operation&&!operation.mold&&<div className="forge-vertex-operation" role="group" aria-label={operation.kind+' controls'}>
      <strong>{operation.kind}</strong>
      {operation.kind==='Cut'&&<><label>Sections<input aria-label="Cut sections" type="number" min="2" max="64" value={operation.sections} onChange={e=>setOperation({...operation,sections:e.target.value})}/></label><button onClick={()=>setOperation({...operation,turned:!operation.turned})}>Turn cuts</button></>}
      {operation.kind==='Extrude'?<span>Drag a selected face to extrude.</span>:<><button aria-label={'Commit '+operation.kind.toLowerCase()} disabled={!!result?.error||operation.kind==='Inset'&&!operation.amount} onClick={apply}>Commit</button><button aria-label={'Cancel '+operation.kind.toLowerCase()} onClick={cancel}>Cancel</button></>}
    </div>}
    {(error||result?.error||pickEntries?.error)&&<div role="alert" className="forge-error">{error||result?.error||pickEntries?.error}</div>}
  </aside>;
}
