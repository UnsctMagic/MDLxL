import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Box,ChevronDown,ChevronRight,File,Folder,FolderOpen} from 'lucide-react';
import {decodeTextureThumbnail} from '../src/texture-thumbnail.js';
import {createThumbnailQueue} from '../src/texture-library-session.js';
import {buildWorldEditorCatalog,WORLD_EDITOR_FILES} from '../src/world-editor-catalog.js';
export const SKIN={classic:'sd',reforged:'hd','forsaken-kingdom':'de'};
export const WORLD_EDITOR_PLACEHOLDER='Search units, spells, items and doodads by name';
const ROW=24;
// Folder icons for the World Editor view's top level, taken from the game's own buttons.
const FOLDER_ICONS={Human:'ReplaceableTextures\\CommandButtons\\BTNFootman.blp',Orc:'ReplaceableTextures\\CommandButtons\\BTNGrunt.blp','Night Elf':'ReplaceableTextures\\CommandButtons\\BTNArcher.blp',Undead:'ReplaceableTextures\\CommandButtons\\BTNGhoul.blp',Naga:'ReplaceableTextures\\CommandButtons\\BTNNagaMyrmidon.blp','Neutral Hostile':'ReplaceableTextures\\CommandButtons\\BTNFurbolg.blp','Neutral Passive':'ReplaceableTextures\\CommandButtons\\BTNSheep.blp',Items:'ReplaceableTextures\\CommandButtons\\BTNChestOfGold.blp',Doodads:'ReplaceableTextures\\WorldEditUI\\Doodad-Prop.blp'};
// Small icons for tree rows: decoded once per session, a few at a time.
const iconQueue=createThumbnailQueue({concurrency:3}),icons=new Map();
function loadIcon(key,read,size=48){
  if(!icons.has(key)){
    const job=iconQueue(key,async()=>{const file=await read();return file?.bytes?.length?decodeTextureThumbnail({name:file.name||key,bytes:file.bytes},size):null;}).catch(()=>null);
    icons.set(key,job);if(icons.size>6000)icons.delete(icons.keys().next().value);
  }
  return icons.get(key);
}
export function GameIcon({iconKey,read,fallback:Fallback=File,size=16}){
  const [url,setUrl]=useState(null);
  useEffect(()=>{let active=true;setUrl(null);if(iconKey&&read)loadIcon(iconKey,read,Math.max(48,size)).then(value=>{if(active)setUrl(value);});return()=>{active=false;};},[iconKey]);
  return url?<img className="gf-icon" src={url} alt="" width={size} height={size} draggable={false}/>:<Fallback size={size-1} aria-hidden="true" className="gf-icon-glyph"/>;
}

// World Editor trees are built from the game tables once per game version.
const worldEditorTrees=new Map();
export function worldEditorTree(variant,signature){
  const skin=SKIN[variant]||'sd',key=signature+'|'+skin;
  if(!worldEditorTrees.has(key)){
    const job=window.desktop.gameFilesWorldEditorSources({files:WORLD_EDITOR_FILES}).then(sources=>{
      const catalog=buildWorldEditorCatalog(new Map(sources.files),sources.strings,{skin});
      const index=(node,path)=>{node.key=path;if(!node.children)return 1;node.total=node.children.reduce((sum,item,at)=>sum+index(item,path+'/'+at),0);return node.total;};index(catalog.root,'we');
      return catalog;
    });
    worldEditorTrees.set(key,job);job.catch(()=>worldEditorTrees.delete(key));
  }
  return worldEditorTrees.get(key);
}


export function FolderStyle({style,onChange}){
 return <div className="gf-style" role="group" aria-label="Folder layout">
  <button type="button" aria-pressed={style==='standard'} title="The game's own folders, as they are stored" onClick={()=>onChange('standard')}>Standard</button>
  <button type="button" aria-pressed={style==='worldeditor'} title="Grouped like the World Editor: races, units, buildings, spells, items and doodads by tileset" onClick={()=>onChange('worldeditor')}>World Editor Style</button>
 </div>;
}
export function worldEditorResults(catalog,query){
 const text=query.trim().toLowerCase();if(!text||!catalog)return null;
 const words=text.split(/\s+/),found=[];
 const visit=(node,trail)=>{if(node.children){for(const item of node.children)visit(item,node.key==='we'?trail:[...trail,node.name]);return;}const haystack=(node.name+' '+node.id+' '+trail.join(' ')).toLowerCase();if(words.every(word=>haystack.includes(word)))found.push({key:node.key,name:node.name,node,detail:trail.join(' › ')});};
 visit(catalog.root,[]);return {rows:found.slice(0,500),total:found.length};
}
export function worldEditorRows(catalog,expanded){
 const list=[];const walk=(nodes,depth)=>{for(const node of nodes){list.push({key:node.key,depth,name:node.name,node,folder:!!node.children,count:node.total});if(node.children&&expanded.has(node.key))walk(node.children,depth+1);}};
 if(catalog)walk(catalog.root.children,0);return list;
}
export function worldEditorRowIcon(row,variant,expanded){
 const path=row.folder?(row.node?.icon||(row.depth===0?FOLDER_ICONS[row.name]:null)):row.node.icon;
 return <GameIcon iconKey={path?'p:'+variant+':'+path:null} read={path?()=>window.desktop.gameFilesReadPath({path,variant}):null} fallback={row.folder?(expanded.has(row.key)?FolderOpen:Folder):row.node.models?.length?Box:File}/>;
}
/** The same virtualized rows and mouse/keyboard navigation in both Library tabs. */
export function LibraryTree({rows,results,expanded,selected,focusKey,setFocusKey,toggle,choose,onOpen,onDoubleClick,rowIcon,empty}){
 const tree=useRef(),[scrollTop,setScrollTop]=useState(0),[viewHeight,setViewHeight]=useState(600);
 useEffect(()=>{const element=tree.current;const observer=new ResizeObserver(()=>setViewHeight(element.clientHeight));observer.observe(element);return()=>observer.disconnect();},[]);
 const keys=event=>{
  const index=rows.findIndex(row=>row.key===focusKey),row=rows[index];
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();const next=rows[Math.max(0,Math.min(rows.length-1,index<0?0:index+(event.key==='ArrowDown'?1:-1)))];if(!next)return;
   setFocusKey(next.key);if(!next.folder)choose(next);
   const top=rows.indexOf(next)*ROW,element=tree.current;if(element&&(top<element.scrollTop||top+ROW>element.scrollTop+element.clientHeight))element.scrollTop=top-element.clientHeight/2;
  }else if(event.key==='ArrowRight'&&row?.folder&&!expanded.has(row.key)){event.preventDefault();toggle(row);}
  else if(event.key==='ArrowLeft'&&row){event.preventDefault();if(row.folder&&expanded.has(row.key))toggle(row);else{const parent=rows.slice(0,index).reverse().find(item=>item.folder&&item.depth<row.depth);if(parent)setFocusKey(parent.key);}}
  else if(event.key==='Enter'&&row){event.preventDefault();if(row.folder)toggle(row);else onOpen?.(row);}
 };
 const first=Math.max(0,Math.floor(scrollTop/ROW)-10),last=Math.min(rows.length,Math.ceil((scrollTop+viewHeight)/ROW)+10);
 return <div ref={tree} className="gf-tree" role="tree" aria-label="Game files" tabIndex={0} onKeyDown={keys} onScroll={event=>setScrollTop(event.currentTarget.scrollTop)}>
  {results&&<div className="gf-tree-status">{results.total>results.rows.length?`${results.rows.length.toLocaleString()} of ${results.total.toLocaleString()} matches`:`${results.total.toLocaleString()} matches`}</div>}
  {!rows.length&&<p className="tl-empty">{empty}</p>}
  <div style={{height:rows.length*ROW,position:'relative'}}>{rows.slice(first,last).map((row,offset)=>{const at=first+offset,open=expanded.has(row.key);
   return <div key={row.key} role="treeitem" aria-level={row.depth+1} aria-expanded={row.folder?open:undefined} aria-selected={selected?.key===row.key} data-row={row.key}
    className={'gf-row'+(row.folder?' folder':'')+(selected?.key===row.key?' selected':'')+(focusKey===row.key?' focused':'')} style={{top:at*ROW,paddingLeft:6+row.depth*16}}
    onClick={()=>{setFocusKey(row.key);tree.current?.focus({preventScroll:true});if(row.folder)toggle(row);else choose(row);}} onDoubleClick={()=>{if(!row.folder)onDoubleClick?.(row);}}
    title={row.file?row.file.path:row.node&&!row.folder?row.node.models?.map(model=>model.path).join('\n')||row.name:row.name}>
    <span className="gf-twist" aria-hidden="true">{row.folder?(open?<ChevronDown size={12}/>:<ChevronRight size={12}/>):null}</span>
    {rowIcon(row)}<span className="gf-name" translate="no">{row.name}{row.search&&row.detail&&<small translate="no">{row.detail}</small>}</span>
    {row.folder&&row.count!=null&&<small className="gf-count">{row.count.toLocaleString()}</small>}
   </div>;})}</div>
 </div>;
}
export function WorldEditorTextureTree({variant,query,onChoose,onError}){
 const [catalog,setCatalog]=useState(null),[expanded,setExpanded]=useState(()=>new Set()),[selected,setSelected]=useState(null),[focusKey,setFocusKey]=useState(null);
 useEffect(()=>{let active=true;setCatalog(null);setSelected(null);setExpanded(new Set());setFocusKey(null);
  window.desktop.gameFilesSummary().then(summary=>worldEditorTree(variant,summary.signature)).then(value=>{if(active)setCatalog(value);}).catch(error=>{if(active)onError(error);});
  return()=>{active=false;};
 },[variant]);
 const results=useMemo(()=>worldEditorResults(catalog,query),[catalog,query]);
 const rows=useMemo(()=>results?results.rows.map(row=>({...row,depth:0,search:true})):worldEditorRows(catalog,expanded),[catalog,expanded,results]);
 const toggle=row=>setExpanded(previous=>{const next=new Set(previous);if(next.has(row.key))next.delete(row.key);else next.add(row.key);return next;});
 const choose=row=>{setSelected(row);setFocusKey(row.key);onChoose(row.node);};
 return <LibraryTree rows={rows} results={results} expanded={expanded} selected={selected} focusKey={focusKey} setFocusKey={setFocusKey} toggle={toggle} choose={choose} rowIcon={row=>worldEditorRowIcon(row,variant,expanded)} empty={catalog?'No matches. Try fewer words or another game version.':'Loading game files…'}/>;
}
