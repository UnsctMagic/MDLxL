import React,{Suspense,lazy,useEffect,useMemo,useRef,useState} from 'react';
import {Box,File,FileText,Film,Folder,Image,Map as MapIcon,Music,Type} from 'lucide-react';
import {openDocument} from '../src/editor-document.js';
import {builtinTextureAssets} from '../src/builtin-textures.js';
import {decodeTextureThumbnail} from '../src/texture-thumbnail.js';

const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const TYPE_ICON={models:Box,textures:Image,sounds:Music,text:FileText,maps:MapIcon,video:Film,fonts:Type,other:File};
const TYPE_LABEL={all:'All file types',models:'Models',textures:'Textures',sounds:'Sounds',text:'Text & data',maps:'Maps',video:'Videos',fonts:'Fonts',other:'Other files'};
const VARIANTS=[['classic','Classic'],['reforged','Reforged'],['forsaken-kingdom','Forsaken Kingdom'],['language','Other languages'],['other','Teen & retired'],['all','All installed']];
const PLACEHOLDER={models:'Search models, e.g. footman or units\\human',sounds:'Search sounds, e.g. footmanyes or music',all:'Search every game file by name or folder'};
const AUDIO={wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',flac:'audio/flac'},VIDEO={webm:'video/webm',mp4:'video/mp4'},IMAGE={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
const normalize=value=>String(value||'').replaceAll('/','\\').toLowerCase();
const fileSize=bytes=>bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':bytes>=1024?Math.round(bytes/1024)+' KB':bytes+' B';
function remembered(key,fallback,allowed){try{const value=localStorage.getItem(key);return allowed.includes(value)?value:fallback;}catch{return fallback;}}
function remember(key,value){try{localStorage.setItem(key,value);}catch{}}

/** One installed model with its own module's textures; the preview never edits it. */
async function loadGameModel(entry,signature){
  const file=await window.desktop.gameFilesRead({id:entry.id,signature});
  const doc=openDocument(file.bytes,entry.name);
  if(!doc.model)throw Error('This model could not be read.');
  const names=doc.model.Textures.map(texture=>texture.Image).filter(Boolean);
  const resolved=names.length?await window.desktop.gameFilesResolve({id:entry.id,signature,names}):{found:[],missing:[]};
  return {doc,bytes:file.bytes,textures:resolved.found,missing:resolved.missing};
}
function previewAssets(textures){
  const assets=builtinTextureAssets(),urls=[];
  for(const record of textures){
    const asset={name:record.name,bytes:record.bytes,source:'gameFile'},mime=IMAGE[record.name.split('.').at(-1).toLowerCase()];
    if(mime){asset.url=URL.createObjectURL(new Blob([record.bytes],{type:mime}));urls.push(asset.url);}
    assets.set(normalize(record.name),asset);assets.set(normalize(record.name.split(/[\\/]/).at(-1)),asset);
  }
  return {assets,release:()=>urls.forEach(url=>URL.revokeObjectURL(url))};
}
function ModelView({entry,signature,preferences,onOpen,onError}){
  const [state,setState]=useState({loading:true}),[sequence,setSequence]=useState(-1),[time,setTime]=useState(0),[playing,setPlaying]=useState(true);
  useEffect(()=>{
    let active=true,release=()=>{};setState({loading:true});setSequence(-1);setTime(0);setPlaying(true);
    loadGameModel(entry,signature).then(loaded=>{
      if(!active)return;const preview=previewAssets(loaded.textures);release=preview.release;
      const stand=loaded.doc.model.Sequences.findIndex(item=>/^stand\b/i.test(item.Name||'')),first=stand>=0?stand:loaded.doc.model.Sequences.length?0:-1;
      setSequence(first);setTime(loaded.doc.model.Sequences[first]?.Interval?.[0]||0);setState({loaded,assets:preview.assets});
    }).catch(error=>{if(active)setState({error:error.message});});
    return()=>{active=false;release();};
  },[entry.id,signature]);
  if(state.error)return <p className="tl-error" role="alert">{state.error}</p>;
  if(state.loading)return <div className="gf-model-stage"><span>Loading model…</span></div>;
  const model=state.loaded.doc.model,interval=model.Sequences[sequence]?.Interval;
  return <>
    <div className="gf-model-stage" title="Drag to turn the camera; scroll to zoom."><Suspense fallback={<span>Loading preview…</span>}><GamePreview key={entry.id} presentation="preview" fitModel model={model} revision={0} textureAssets={state.assets} preferences={preferences} sequenceIndex={sequence} time={time} onTimeChange={setTime} playing={playing&&sequence>=0} onPlayingChange={setPlaying} showParticles mode="textured" view="perspective"/></Suspense></div>
    {model.Sequences.length>0&&<div className="gf-transport">
      <button type="button" onClick={()=>setPlaying(value=>!value)}>{playing?'Pause':'Play'}</button>
      <select aria-label="Model animation" value={sequence} onChange={event=>{const index=Number(event.target.value);setSequence(index);setTime(model.Sequences[index].Interval[0]);setPlaying(true);}}>{model.Sequences.map((item,index)=><option key={index} value={index}>{item.Name||'Animation '+(index+1)}</option>)}</select>
      {interval&&<input aria-label="Animation time" type="range" min={interval[0]} max={Math.max(interval[0]+1,interval[1])} value={Math.min(Math.max(time,interval[0]),interval[1])} onChange={event=>{setPlaying(false);setTime(Number(event.target.value));}}/>}
    </div>}
    {state.loaded.missing.length>0&&<details className="gf-missing"><summary>{state.loaded.missing.length} texture{state.loaded.missing.length===1?'':'s'} not found</summary>{state.loaded.missing.map(name=><code key={name} translate="no">{name}</code>)}</details>}
    {state.loaded.doc.hdViewOnly&&<p className="tl-note">This is a Reforged HD model. MDLxL opens it for viewing; convert it to SD in the editor to change it.</p>}
    <div className="tl-actions"><button type="button" className="tl-primary" onClick={()=>onOpen({name:entry.name,path:entry.path,bytes:state.loaded.bytes,textures:state.loaded.textures}).catch(error=>onError(error.message))}>Open in editor</button></div>
  </>;
}
function FileView({entry,signature}){
  const [state,setState]=useState({loading:true});
  useEffect(()=>{
    let active=true,url=null;setState({loading:true});
    window.desktop.gameFilesRead({id:entry.id,signature}).then(async file=>{
      if(!active)return;const extension=entry.extension;
      if(AUDIO[extension]||VIDEO[extension]){url=URL.createObjectURL(new Blob([file.bytes],{type:AUDIO[extension]||VIDEO[extension]}));setState({media:url});}
      else if(entry.type==='textures'){const image=await decodeTextureThumbnail({name:entry.name,bytes:file.bytes},512);if(active)setState({image});}
      else if(entry.type==='text'){const text=new TextDecoder().decode(file.bytes.subarray(0,262144));setState({text,clipped:file.bytes.length>262144});}
      else setState({});
    }).catch(error=>{if(active)setState({error:error.message});});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[entry.id,signature]);
  if(state.error)return <p className="tl-error" role="alert">{state.error}</p>;
  if(state.loading)return <div className="tl-preview"><span>Loading…</span></div>;
  if(state.image)return <div className="tl-preview"><img src={state.image} alt={entry.name}/></div>;
  if(state.media&&AUDIO[entry.extension])return <audio key={state.media} className="gf-audio" aria-label="Sound preview" controls autoPlay src={state.media} onError={()=>setState({error:'This sound format cannot be played here.'})}/>;
  if(state.media)return <video key={state.media} className="gf-video" aria-label="Video preview" controls src={state.media} onError={()=>setState({error:'This video format cannot be played here.'})}/>;
  if(state.text!=null)return <><pre className="gf-text" translate="no">{state.text}</pre>{state.clipped&&<p className="tl-note">Showing the first 256 KB.</p>}</>;
  return <p className="tl-note">MDLxL has no viewer for this file type. Save a copy to open it in another program.</p>;
}
function FolderNode({node,depth,current,filters,load,onSelect}){
  const inside=current===node.key||current.startsWith(node.key+'\\');
  const [open,setOpen]=useState(inside&&current!==node.key),[children,setChildren]=useState(null);
  useEffect(()=>{if(inside&&current!==node.key)setOpen(true);},[current]);
  useEffect(()=>{let active=true;if(open)load(node.key).then(result=>{if(active)setChildren(result.folders);}).catch(()=>{});return()=>{active=false;};},[open,node.key,filters]);
  return <div className="tl-folder-branch"><div className={'tl-folder-row'+(current===node.key?' selected':'')} style={{paddingLeft:4+depth*12}}>
    <button type="button" className="tl-expand" onClick={()=>setOpen(value=>!value)} aria-label={(open?'Collapse ':'Expand ')+node.name}>{open?'▾':'▸'}</button>
    <button type="button" className="tl-folder" translate="no" onClick={()=>onSelect(node.key)} title={node.path}><span translate="no">{node.name}</span><small>{node.count.toLocaleString()}</small></button>
  </div>{open&&children?.map(child=><FolderNode key={child.key} node={child} depth={depth+1} current={current} filters={filters} load={load} onSelect={onSelect}/>)}</div>;
}

/** The Library's browser for every installed Warcraft III file, organised like the game folders. */
export default function GameFileBrowser({preset='all',preferences,onOpenGameModel,onClose}){
  const [summary,setSummary]=useState(null),[variant,setVariant]=useState(()=>remembered('mdlvis.game-files.variant','classic',VARIANTS.map(([value])=>value))),[chosenType,setChosenType]=useState('all');
  const [folder,setFolder]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(200),[result,setResult]=useState(null),[root,setRoot]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState(null),[message,setMessage]=useState('');
  const type=preset==='all'?chosenType:preset,filters=variant+'|'+type,cache=useRef(new Map()),input=useRef(),list=useRef();
  const browse=payload=>window.desktop.gameFilesBrowse({variant,type,...payload});
  const loadFolder=key=>{const id=filters+'|'+key;if(!cache.current.has(id))cache.current.set(id,browse({folder:key,limit:1}).catch(error=>{cache.current.delete(id);throw error;}));return cache.current.get(id);};
  useEffect(()=>{input.current?.focus();},[preset]);
  useEffect(()=>{
    if(!window.desktop?.gameFilesSummary){setLoading(false);setError('Game files can be browsed in the desktop app.');return;}
    let active=true;window.desktop.gameFilesSummary().then(value=>{if(active)setSummary(value);}).catch(error=>{if(active){setError(error.message);setLoading(false);}});return()=>{active=false;};
  },[]);
  useEffect(()=>{let active=true;if(summary)loadFolder('').then(value=>{if(active)setRoot(value.folders);}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[summary,filters]);
  useEffect(()=>{setLimit(200);},[folder,query,filters]);
  useEffect(()=>{
    if(!summary)return;let active=true;setLoading(true);
    const timer=setTimeout(()=>browse({folder,query,limit}).then(value=>{if(active){setResult(value);setError('');setLoading(false);}}).catch(error=>{if(active){setError(error.message);setLoading(false);}}),query.trim()?120:0);
    return()=>{active=false;clearTimeout(timer);};
  },[summary,folder,query,limit,filters]);
  const openFolder=key=>{setFolder(key);setQuery('');setSelected(null);};
  const openModel=async record=>{setMessage('');await onOpenGameModel(record);onClose?.();};
  const quickOpen=async row=>{try{const loaded=await loadGameModel(row,summary.signature);await openModel({name:row.name,path:row.path,bytes:loaded.bytes,textures:loaded.textures});}catch(error){setMessage(error.message);}};
  const rows=useMemo(()=>[...(!query.trim()?(result?.folders||[]).map(item=>({...item,folderRow:true})):[]),...(result?.files||[])],[result,query]);
  const activate=row=>{if(row.folderRow)openFolder(row.key);else if(row.type==='models'&&onOpenGameModel)quickOpen(row);};
  const keys=event=>{
    const index=rows.findIndex(row=>selected&&(row.folderRow?row.key===selected.key&&selected.folderRow:row.id===selected.id&&!selected.folderRow));
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=rows[Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1)))];if(next){setSelected(next);list.current?.querySelector(`[data-row="${next.folderRow?'f:'+next.key:next.id}"]`)?.scrollIntoView({block:'nearest'});}}
    else if(event.key==='Enter'&&selected){event.preventDefault();activate(selected);}
    else if(event.key==='Backspace'&&folder&&!query){event.preventDefault();openFolder(result?.crumbs?.at(-2)?.key||'');}
  };
  const saveCopy=async()=>{setMessage('');try{const saved=await window.desktop.gameFilesExport({id:selected.id,signature:summary.signature});if(saved)setMessage('Saved '+saved);}catch(error){setMessage(error.message);}};
  const copyPath=async()=>{setMessage('');try{await window.desktop.copyTexturePath(selected.path);setMessage('Path copied.');}catch(error){setMessage(error.message);}};
  const crumbs=result?.crumbs||[],Icon=selected&&!selected.folderRow?TYPE_ICON[selected.type]||File:null;
  return <>
    <div className="tl-toolbar"><input ref={input} type="search" value={query} placeholder={PLACEHOLDER[preset]||PLACEHOLDER.all} onChange={event=>setQuery(event.target.value)} aria-label="Search game files"/>
      <select aria-label="Game version" title="Which game files to show: Classic (SD), Reforged (HD), Forsaken Kingdom, other languages or everything installed" value={variant} onChange={event=>{setVariant(event.target.value);remember('mdlvis.game-files.variant',event.target.value);}}>{VARIANTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      {preset==='all'&&<select aria-label="File type" value={chosenType} onChange={event=>setChosenType(event.target.value)}>{Object.entries(TYPE_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}
    </div>
    <div className="tl-body"><nav className="tl-folders" aria-label="Game folders"><button type="button" className={'tl-all-folders'+(!folder?' selected':'')} onClick={()=>openFolder('')}>All game files</button>{root.map(node=><FolderNode key={filters+node.key} node={node} depth={0} current={folder} filters={filters} load={loadFolder} onSelect={openFolder}/>)}</nav>
      <main className="tl-results gf-results"><div className="tl-result-status" aria-live="polite">{loading&&!result?'Loading game files…':loading?'Searching…':query.trim()?`${(result?.total||0).toLocaleString()} matching files`:`${(result?.folders?.length||0).toLocaleString()} folders · ${(result?.total||0).toLocaleString()} files`}</div>
        <div className="gf-crumbs"><button type="button" onClick={()=>openFolder('')}>Game files</button>{crumbs.map(crumb=><React.Fragment key={crumb.key}><span>›</span><button type="button" translate="no" onClick={()=>openFolder(crumb.key)}>{crumb.name}</button></React.Fragment>)}{query.trim()&&<em>{folder?'searching this folder':'searching everywhere'}</em>}</div>
        {error&&<p className="tl-error" role="alert">{error}</p>}{summary?.errors?.map((item,index)=><p key={index} className="tl-error">{item.message}</p>)}
        {summary&&!summary.folder&&<p className="tl-note">No Warcraft III game files were found. Choose your Warcraft III folder (1.30 or newer) in Settings.</p>}
        {!loading&&!error&&result&&!rows.length&&<p className="tl-empty">{query.trim()?'No matching game files. Try fewer words, another game version, or All file types.':'This folder has no files of this kind.'}</p>}
        <div ref={list} className="gf-list" role="listbox" aria-label="Game files" tabIndex={0} onKeyDown={keys}>{rows.map(row=>{const RowIcon=row.folderRow?Folder:TYPE_ICON[row.type]||File,active=selected&&(row.folderRow?selected.folderRow&&selected.key===row.key:!selected.folderRow&&selected.id===row.id);
          return <div key={row.folderRow?'f:'+row.key:row.id} data-row={row.folderRow?'f:'+row.key:row.id} role="option" aria-selected={!!active} className={'gf-row'+(active?' selected':'')} onClick={()=>{setSelected(row);setMessage('');list.current?.focus({preventScroll:true});}} onDoubleClick={()=>activate(row)} title={row.folderRow?row.path:row.path+(row.type==='models'?'\nDouble-click to open in the editor.':'')}>
            <RowIcon size={15} aria-hidden="true"/><span className="gf-name" translate="no">{row.name}{query.trim()&&!row.folderRow&&<small translate="no">{row.path.slice(0,row.path.length-row.name.length-1)}</small>}</span>{row.folderRow?<small>{row.count.toLocaleString()}</small>:<><span className="gf-badge" translate="no">{row.module}</span><small>{fileSize(row.size)}</small></>}
          </div>;})}</div>
        {result?.hasMore&&<button type="button" className="tl-more" onClick={()=>setLimit(value=>value+200)} disabled={loading}>Show more files</button>}
      </main>
      <aside className="tl-details gf-details">{selected&&!selected.folderRow?<>
        {selected.type==='models'?<ModelView key={selected.id} entry={selected} signature={summary.signature} preferences={preferences} onOpen={openModel} onError={setMessage}/>:<FileView key={selected.id} entry={selected} signature={summary.signature}/>}
        <h3 translate="no"><Icon size={15} aria-hidden="true"/> {selected.name}</h3>
        <p className="tl-version">Game version: <strong translate="no">{selected.module}</strong> · {fileSize(selected.size)}</p>
        <code translate="no">{selected.path}</code>
        <div className="gf-file-actions"><button type="button" onClick={copyPath}>Copy path</button><button type="button" onClick={saveCopy}>Save a copy…</button></div>
        {message&&<p className={/^Saved |^Path copied/.test(message)?'tl-success':'tl-error'} role="status">{message}</p>}
      </>:selected?.folderRow?<div className="tl-empty">Double-click a folder to open it.</div>:<div className="tl-empty">{preset==='models'?'Choose a model to view it. Double-click opens it in the editor.':preset==='sounds'?'Choose a sound to hear it. Use the arrow keys to step through a folder.':'Choose a file to view it.'}</div>}</aside>
    </div>
    <footer className="tl-footer"><span>{summary?`${summary.total.toLocaleString()} game files${summary.folder?' · '+summary.folder:''}`:''}</span><span>Arrow keys move through the list · Enter opens · Backspace goes up a folder</span></footer>
  </>;
}
