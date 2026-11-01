import React,{useMemo,useState} from 'react';
import {Box,ChevronDown,ChevronRight,Folder,FolderOpen} from 'lucide-react';
import GameIcon,{FOLDER_ICONS} from './GameIcon.jsx';

import {visibleWorldEditorRows,worldEditorRaceOrder} from '../src/world-editor-catalog.js';
const order = ['Units','Buildings','Heroes','Items','Doodads','Destructibles'];
const matches = (text,terms) => terms.every(term => text.toLowerCase().includes(term));

// Use the existing grid below the current folder. Browsing a large palette never
// mounts all its icons or previews at once.
export function worldPage(browse, collectionItems, matchedItems, terms, selected) {
  const rows=[], sections=[], available=new Map(collectionItems.map(item=>[item.id,item]));
  const matched=new Set(matchedItems.map(item=>item.id)), searching=terms.length>0;
  const other=browse.other.filter(id=>available.has(id));
  const isFavorites=collectionItems.some(item=>item.collection!=='Warcraft');
  const addPersonal=title=>collectionItems.filter(item=>item.collection===title).map(item=>item.id);
  const specials=[['Other effects',other],...(isFavorites?['My presets','My work'].map(name=>[name,addPersonal(name)]):[])];
  const special=specials.find(([title])=>title===selected);
  if(special) {
    sections.push({title:special[0],items:special[1].filter(id=>matched.has(id)).map(id=>available.get(id))});
    return {rows,sections,title:selected};
  }
  for(const object of browse.objects) {
    if(selected && selected!==object.id)continue;
    const objectMatch=matches(object.name,terms);
    const ids=new Set(),groups=[];
    for(const {title,refs} of object.groups) {
      const groupMatch=objectMatch || matches(object.name+' '+title,terms);
      const groupIds=new Set();
      for(const ref of refs)for(const id of browse.buckets[ref]) {
        if(!available.has(id) || (!groupMatch && !matched.has(id)))continue;
        groupIds.add(id);ids.add(id);
      }
      if(groupIds.size || (!refs.length && groupMatch))groups.push({title,items:[...groupIds].map(id=>available.get(id))});
    }
    if(selected)return {rows,sections:groups,title:object.name};
    if(!ids.size && !(searching && groups.length && object.groups.some(g=>g.refs.some(ref=>browse.buckets[ref].some(id=>available.has(id))))))continue;
    rows.push({id:object.id,name:object.name,folders:object.folders,icon:object.icon,count:ids.size});
  }
  rows.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  for(const [name,ids] of specials) {
    const count=ids.filter(id=>matched.has(id)).length;
    if((!searching && name==='Other effects') || count)rows.unshift({id:name,name,count});
  }
  return {rows,sections,title:''};
}

function originTree(rows,searching) {
  const root=[],folders=new Map(),rank=name=>[...order,...worldEditorRaceOrder].indexOf(name);
  for(const object of rows){
    for(const path of (searching ? [[]] : object.folders || [[]])){
      let siblings=root,key='';
      for(const name of path){
        key+=JSON.stringify(name);
        if(!folders.has(key)){
          const folder={key,name,icon:FOLDER_ICONS[name],children:[]};
          folders.set(key,folder);siblings.push(folder);
        }
        siblings=folders.get(key).children;
      }
      siblings.push({...object,key:key+'#'+object.id,total:object.count});
    }
  }
  const sort=nodes=>{
    nodes.sort((a,b)=>Number(b.name==='Other effects')-Number(a.name==='Other effects')||
      Number(!!b.children)-Number(!!a.children)||rank(a.name)-rank(b.name)||a.name.localeCompare(b.name));
    for(const node of nodes)if(node.children)sort(node.children);
  };
  sort(root);return root;
}

export function WorldRows({rows,searching,limit,onMore,onChoose}) {
  const [expanded,setExpanded]=useState(new Set());
  const tree=useMemo(()=>originTree(rows,searching),[rows,searching]);
  const visible=useMemo(()=>visibleWorldEditorRows(tree,expanded),[tree,expanded]);
  const toggle=key=>setExpanded(previous=>{
    const next=new Set(previous);if(next.has(key))next.delete(key);else next.add(key);return next;
  });
  if(!visible.length)return null;
  return <><div className="pe-origin-rows" role="tree" aria-label="World Editor objects">{visible.slice(0,limit).map(({key,node,folder,depth})=>{
    const open=expanded.has(key),Arrow=open?ChevronDown:ChevronRight;
    return <button key={key} role="treeitem" aria-label={node.name} aria-level={depth+1} aria-expanded={folder?open:undefined}
      style={{paddingLeft:6+depth*16}} onClick={()=>folder?toggle(key):onChoose(node.id)}
      onKeyDown={event=>{if(folder&&((event.key==='ArrowRight'&&!open)||(event.key==='ArrowLeft'&&open))){event.preventDefault();toggle(key);}}}>
      {folder?<Arrow size={12}/>:<span className="pe-tree-indent"/>}
      <GameIcon iconKey={node.icon?'p:classic:'+node.icon:null} read={node.icon?()=>window.desktop.gameFilesReadPath({path:node.icon,variant:'classic'}):null}
        fallback={folder?(open?FolderOpen:Folder):Box}/>
      <span translate="no">{node.name}</span>{node.count!=null&&<small>{node.count}</small>}
    </button>;
  })}</div>{visible.length>limit&&<button onClick={onMore}>Show more</button>}</>;
}
