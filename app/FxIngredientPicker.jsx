import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {translate} from '../src/localization.js';
import {ingredientSections,filterSections,ingredientName} from '../src/fx-ingredient-picker.js';
import {useWindowKeyClaim} from './Hotkeys.jsx';

/** A button that opens a searchable list of emitters or layers. kind: 'emitter' or 'layer'. onPick(label) gets the row's label; clearable adds a None row first that picks the empty label (it takes back a preview). */
export default function FxIngredientPicker({kind,look,label,title,disabled,clearable=false,onPick}){
 const root=useRef(null),pop=useRef(null),button=useRef(null),input=useRef(null),list=useRef(null),id=useId();
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[at,setAt]=useState(0);
 const searchLabel=kind==='emitter'?'Search emitters':'Search layers';
 const sections=useMemo(()=>open?ingredientSections(look,kind):[],[open,look,kind]);
 const shown=useMemo(()=>filterSections(sections,query,translate),[sections,query]);
 const none=clearable&&!query.trim();
 const rows=useMemo(()=>[...(none?[{label:'',none:true}]:[]),...shown.flatMap(section=>section.rows)],[shown,none]);
 const close=(restoreFocus=true)=>{setOpen(false);setQuery('');setAt(0);if(restoreFocus)button.current?.focus();};
 const pick=row=>{if(!row)return;close();onPick(row.label);};
 useEffect(()=>{if(open){input.current?.focus();pop.current?.scrollIntoView?.({block:'nearest'});}},[open]);
 useEffect(()=>{
  if(!open)return;
  const outside=event=>{if(!root.current?.contains(event.target))close(false);};
  document.addEventListener('pointerdown',outside,true);
  return ()=>document.removeEventListener('pointerdown',outside,true);
 },[open]);
 useEffect(()=>{if(open)list.current?.querySelector('[aria-selected=true]')?.scrollIntoView?.({block:'nearest'});},[open,at,query]);
 useEffect(()=>{if(disabled&&open)close(false);},[disabled]);
 useWindowKeyClaim(({event,localWindow})=>{if(!open||event.key!=='Escape'||(localWindow&&!localWindow.contains(root.current)))return false;close();return true;},20);
 const keys=event=>{
  const last=rows.length-1;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
  else if(event.key==='ArrowDown'){event.preventDefault();setAt(Math.min(last,at+1));}
  else if(event.key==='ArrowUp'){event.preventDefault();setAt(Math.max(0,at-1));}
  else if(event.key==='Home'&&event.ctrlKey){event.preventDefault();setAt(0);}
  else if(event.key==='End'&&event.ctrlKey){event.preventDefault();setAt(Math.max(0,last));}
  else if(event.key==='Enter'){event.preventDefault();pick(rows[Math.min(at,last)]);}
 };
 let index=none?0:-1;
 return <span className="fx-picker" ref={root}>
  <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} title={title} disabled={disabled} onClick={()=>open?close():setOpen(true)}>{label}</button>
  {open&&<div className="fx-picker-pop" ref={pop}>
   <input ref={input} className="sfx-search" type="search" role="combobox" aria-label={searchLabel} aria-expanded="true" aria-controls={id} aria-activedescendant={rows.length?id+'-'+Math.min(at,rows.length-1):undefined} placeholder="Search…" value={query} onChange={event=>{setQuery(event.target.value);setAt(0);}} onKeyDown={keys}/>
   <div className="fx-picker-list" id={id} role="listbox" aria-label={label} ref={list}>
    {none&&<div id={id+'-0'} role="option" aria-selected={Math.min(at,rows.length-1)===0} className="fx-picker-row" onMouseMove={()=>{if(at!==0)setAt(0);}} onClick={()=>pick(rows[0])}><span className="fx-picker-name">{translate('None')}</span></div>}
    {shown.map(section=><React.Fragment key={section.title}>
     <div className="fx-picker-head" role="presentation">{translate(section.title)}</div>
     {section.rows.map(row=>{
      index+=1;const mine=index,name=ingredientName(row),note=[kind==='emitter'?'':translate(row.type),translate(row.source)+(row.variation?' · '+translate(row.variation):'')].filter(Boolean).join(' · ');
      return <div key={row.label} id={id+'-'+mine} role="option" aria-selected={mine===Math.min(at,rows.length-1)} className="fx-picker-row" onMouseMove={()=>{if(at!==mine)setAt(mine);}} onClick={()=>pick(row)}>
       <span className="fx-picker-name">{translate(name)}</span>{note&&<small>{note}</small>}
      </div>;
     })}
    </React.Fragment>)}
    {!shown.length&&<div className="fx-picker-empty">{translate('No matches')}</div>}
   </div>
  </div>}
 </span>;
}
