import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Box,ChevronDown,ChevronRight,File,FileText,Film,Folder,FolderOpen,Image,Map as MapIcon,Music,Type} from 'lucide-react';
import {openDocument,deleteGeoset} from '../src/editor-document.js';
import {separateGeosetsByLoosePart,nuclearSeparateGeosets} from '../src/geoset-operations.js';
import {collectPart} from '../src/bits-and-parts.js';
import {readStoredText,writeStoredText} from '../src/local-store.js';
import LibraryGeosets from './LibraryGeosets.jsx';
import {builtinTextureAssets} from '../src/builtin-textures.js';
import {decodeTextureThumbnail} from '../src/texture-thumbnail.js';
import {createThumbnailQueue} from '../src/texture-library-session.js';
import {buildWorldEditorCatalog,WORLD_EDITOR_FILES} from '../src/world-editor-catalog.js';

const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const TYPE_ICON={models:Box,textures:Image,sounds:Music,text:FileText,maps:MapIcon,video:Film,fonts:Type,other:File};
const TYPE_LABEL={all:'All file types',models:'Models',textures:'Textures',sounds:'Sounds',text:'Text & data',maps:'Maps',video:'Videos',fonts:'Fonts',other:'Other files'};
const VARIANTS=[['classic','Classic'],['reforged','Reforged'],['forsaken-kingdom','Forsaken Kingdom'],['language','Other languages'],['other','Teen & retired'],['all','All installed']];
const PLACEHOLDER={models:'Search models, e.g. footman or units\\human',worldeditor:'Search units, spells, items and doodads by name',sounds:'Search sounds, e.g. footmanyes or music',all:'Search every game file by name or folder'};
const AUDIO={wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',flac:'audio/flac'},VIDEO={webm:'video/webm',mp4:'video/mp4'},IMAGE={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
const SKIN={classic:'sd',reforged:'hd','forsaken-kingdom':'de'};
// Folder icons for the World Editor view's top level, taken from the game's own buttons.
const FOLDER_ICONS={Human:'ReplaceableTextures\\CommandButtons\\BTNFootman.blp',Orc:'ReplaceableTextures\\CommandButtons\\BTNGrunt.blp','Night Elf':'ReplaceableTextures\\CommandButtons\\BTNArcher.blp',Undead:'ReplaceableTextures\\CommandButtons\\BTNGhoul.blp',Naga:'ReplaceableTextures\\CommandButtons\\BTNNagaMyrmidon.blp','Neutral Hostile':'ReplaceableTextures\\CommandButtons\\BTNFurbolg.blp','Neutral Passive':'ReplaceableTextures\\CommandButtons\\BTNSheep.blp',Items:'ReplaceableTextures\\CommandButtons\\BTNChestOfGold.blp',Doodads:'ReplaceableTextures\\WorldEditUI\\Doodad-Prop.blp'};
const ROW=24;
const normalize=value=>String(value||'').replaceAll('/','\\').toLowerCase();
const fileSize=bytes=>bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':bytes>=1024?Math.round(bytes/1024)+' KB':bytes+' B';
const remembered=(key,fallback,allowed)=>readStoredText(key,fallback,value=>allowed.includes(value)?value:fallback);
const remember=writeStoredText;

/** One installed model with its own module's textures; the preview never edits it. */
async function loadGameModel(entry,signature){
  const file=await window.desktop.gameFilesRead({id:entry.id,signature});
  const doc=openDocument(file.bytes,entry.name);
  if(!doc.model)throw Error('This model could not be read.');
  const names=doc.model.Textures.map(texture=>texture.Image).filter(Boolean);
  const resolved=names.length?await window.desktop.gameFilesResolve({id:entry.id,signature,names}):{found:[],missing:[]};
  return {entry,doc,bytes:file.bytes,textures:resolved.found,missing:resolved.missing};
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

// Small icons for tree rows: decoded once per session, a few at a time.
const iconQueue=createThumbnailQueue({concurrency:3}),icons=new Map();
function loadIcon(key,read,size=48){
  if(!icons.has(key)){
    const job=iconQueue(key,async()=>{const file=await read();return file?.bytes?.length?decodeTextureThumbnail({name:file.name||key,bytes:file.bytes},size):null;}).catch(()=>null);
    icons.set(key,job);if(icons.size>6000)icons.delete(icons.keys().next().value);
  }
  return icons.get(key);
}
function GameIcon({iconKey,read,fallback:Fallback=File,size=16}){
  const [url,setUrl]=useState(null);
  useEffect(()=>{let active=true;setUrl(null);if(iconKey&&read)loadIcon(iconKey,read,Math.max(48,size)).then(value=>{if(active)setUrl(value);});return()=>{active=false;};},[iconKey]);
  return url?<img className="gf-icon" src={url} alt="" width={size} height={size} draggable={false}/>:<Fallback size={size-1} aria-hidden="true" className="gf-icon-glyph"/>;
}

// World Editor trees are built from the game tables once per game version.
const worldEditorTrees=new Map();
function worldEditorTree(variant,signature){
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

/** Center stage: one persistent preview. A new model replaces the old one when it has loaded and the camera glides to it. */
function ModelStage({shown,preferences,sequence,time,setTime,playing,setPlaying,isolated,hidden,hovered,highlight,onHover}){
  if(!shown)return null;
  return <Suspense fallback={<span className="gf-stage-note">Loading preview…</span>}><GamePreview presentation="preview" fitModel glideCamera glideKey={shown.key} fitSequenceExtent isolatedGeosets={isolated} hiddenGeosets={hidden} interactivePreview hoveredGeoset={highlight?hovered:null} highlightSelection={highlight} onHoverGeoset={highlight?onHover:undefined} model={shown.doc.model} revision={shown.revision} textureAssets={shown.assets} preferences={preferences} sequenceIndex={sequence} time={time} onTimeChange={setTime} playing={playing&&sequence>=0} onPlayingChange={setPlaying} showParticles mode="textured" view="perspective"/></Suspense>;
}
function FileStage({entry,signature}){
  const [state,setState]=useState({loading:true});
  useEffect(()=>{
    let active=true,url=null;setState({loading:true});
    window.desktop.gameFilesRead({id:entry.id,signature}).then(async file=>{
      if(!active)return;const extension=entry.extension;
      if(AUDIO[extension]||VIDEO[extension]){url=URL.createObjectURL(new Blob([file.bytes],{type:AUDIO[extension]||VIDEO[extension]}));setState({media:url});}
      else if(entry.type==='textures'){const image=await decodeTextureThumbnail({name:entry.name,bytes:file.bytes},1024);if(active)setState({image});}
      else if(entry.type==='text'){const text=new TextDecoder().decode(file.bytes.subarray(0,262144));setState({text,clipped:file.bytes.length>262144});}
      else setState({});
    }).catch(error=>{if(active)setState({error:error.message});});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[entry.id,signature]);
  if(state.error)return <p className="tl-error gf-stage-note" role="alert">{state.error}</p>;
  if(state.loading)return <span className="gf-stage-note">Loading…</span>;
  if(state.image)return <img className="gf-stage-image" src={state.image} alt={entry.name}/>;
  if(state.media&&AUDIO[entry.extension])return <div className="gf-stage-sound"><Music size={56} aria-hidden="true"/><audio key={state.media} className="gf-audio" aria-label="Sound preview" controls autoPlay src={state.media} onError={()=>setState({error:'This sound format cannot be played here.'})}/></div>;
  if(state.media)return <video key={state.media} className="gf-stage-video" aria-label="Video preview" controls src={state.media} onError={()=>setState({error:'This video format cannot be played here.'})}/>;
  if(state.text!=null)return <div className="gf-stage-text"><pre className="gf-text" translate="no">{state.text}</pre>{state.clipped&&<p className="tl-note">Showing the first 256 KB.</p>}</div>;
  return <p className="tl-note gf-stage-note">MDLxL has no viewer for this file type. Save a copy to open it in another program.</p>;
}

/** The Library's browser for every installed Warcraft III file: icon tree on the left, one central view. */
export default function GameFileBrowser({preset='all',preferences,onOpenGameModel,onImportGameGeosets,importTargetName,onClose}){
  const [summary,setSummary]=useState(null),[variant,setVariant]=useState(()=>remembered('mdlvis.game-files.variant','classic',VARIANTS.map(([value])=>value))),[chosenType,setChosenType]=useState('all');
  const [style,setStyle]=useState(()=>remembered('mdlvis.game-files.style','worldeditor',['standard','worldeditor']));
  const [query,setQuery]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [expanded,setExpanded]=useState(()=>new Set()),[children,setChildren]=useState(()=>new Map()),[root,setRoot]=useState(null),[we,setWe]=useState(null),[results,setResults]=useState(null);
  const [selected,setSelected]=useState(null),[focusKey,setFocusKey]=useState(null),[scrollTop,setScrollTop]=useState(0),[viewHeight,setViewHeight]=useState(600);
  const [shown,setShown]=useState(null),[loadingModel,setLoadingModel]=useState(false),[modelChoice,setModelChoice]=useState(0),[sequence,setSequence]=useState(-1),[time,setTime]=useState(0),[playing,setPlaying]=useState(true);
  const type=preset==='all'?chosenType:preset,worldEditor=preset==='models'&&style==='worldeditor',filters=variant+'|'+type,input=useRef(),tree=useRef(),modelRequest=useRef(0),pendingOpen=useRef(null),messageRef=useRef(null);
  const signature=summary?.signature;
  useEffect(()=>{input.current?.focus();},[preset]);
  useEffect(()=>{
    if(!window.desktop?.gameFilesSummary){setError('Game files can be browsed in the desktop app.');return;}
    let active=true;window.desktop.gameFilesSummary().then(value=>{if(active)setSummary(value);}).catch(caught=>{if(active)setError(caught.message);});return()=>{active=false;};
  },[]);
  // Standard tree: the game folders, loaded as they are opened.
  useEffect(()=>{
    if(!signature||worldEditor)return;let active=true;setChildren(new Map());setRoot(null);
    window.desktop.gameFilesBrowse({folder:'',variant,type,limit:10000}).then(value=>{if(active)setRoot(value);}).catch(caught=>{if(active)setError(caught.message);});
    return()=>{active=false;};
  },[signature,filters,worldEditor]);
  // World Editor tree (also gives standard model rows their unit icons).
  useEffect(()=>{
    if(!signature||preset!=='models')return;let active=true;setWe(null);
    worldEditorTree(variant,signature).then(value=>{if(active)setWe(value);}).catch(caught=>{if(active&&worldEditor)setError(caught.message);});
    return()=>{active=false;};
  },[signature,variant,preset]);
  useEffect(()=>{setExpanded(new Set());setFocusKey(null);},[worldEditor,filters]);
  useEffect(()=>{if(worldEditor&&!SKIN[variant])setVariant('classic');},[worldEditor,variant]);
  // Search: World Editor names in the window, game paths in the main process.
  useEffect(()=>{
    const text=query.trim().toLowerCase();if(!text){setResults(null);return;}
    if(worldEditor){
      if(!we)return;const words=text.split(/\s+/),found=[];
      const visit=(node,trail)=>{if(node.children){for(const item of node.children)visit(item,node.key==='we'?trail:[...trail,node.name]);return;}const haystack=(node.name+' '+node.id+' '+trail.join(' ')).toLowerCase();if(words.every(word=>haystack.includes(word)))found.push({key:node.key,name:node.name,node,detail:trail.join(' › ')});};
      visit(we.root,[]);setResults({rows:found.slice(0,500),total:found.length});return;
    }
    if(!signature)return;let active=true;const timer=setTimeout(()=>window.desktop.gameFilesBrowse({query:text,variant,type,limit:500}).then(value=>{if(active)setResults({rows:value.files.map(file=>({key:'f'+file.id,name:file.name,file,detail:file.path.slice(0,file.path.length-file.name.length-1)})),total:value.total});}).catch(caught=>{if(active)setError(caught.message);}),120);
    return()=>{active=false;clearTimeout(timer);};
  },[query,worldEditor,we,signature,filters]);

  const readPath=path=>()=>window.desktop.gameFilesReadPath({path,variant});
  const readFile=file=>()=>window.desktop.gameFilesRead({id:file.id,signature});
  const modelIcon=file=>we?.modelIcons?.[normalize(file.path)];
  const fileRow=(file,depth)=>({key:'f'+file.id,depth,name:file.name,file,detail:file.module});
  // Visible rows: open folders only, so clicking a folder never moves anything else.
  const rows=useMemo(()=>{
    if(results)return results.rows.map(row=>({...row,depth:0,search:true}));
    const list=[];
    if(worldEditor){
      const walk=(nodes,depth)=>{for(const node of nodes){list.push({key:node.key,depth,name:node.name,node,folder:!!node.children,count:node.total});if(node.children&&expanded.has(node.key))walk(node.children,depth+1);}};
      if(we)walk(we.root.children,0);return list;
    }
    const walk=(listing,depth)=>{
      for(const folder of listing.folders){const key='d'+folder.key;list.push({key,depth,name:folder.name,folderKey:folder.key,folder:true,count:folder.count});if(expanded.has(key)&&children.has(folder.key))walk(children.get(folder.key),depth+1);}
      for(const file of listing.files)list.push(fileRow(file,depth));
    };
    if(root)walk(root,0);return list;
  },[results,worldEditor,we,root,children,expanded]);
  const toggle=row=>{
    if(!row.folder)return;
    setExpanded(previous=>{const next=new Set(previous);if(next.has(row.key))next.delete(row.key);else next.add(row.key);return next;});
    if(row.folderKey!=null&&!children.has(row.folderKey))window.desktop.gameFilesBrowse({folder:row.folderKey,variant,type,limit:10000}).then(value=>setChildren(previous=>new Map(previous).set(row.folderKey,value))).catch(caught=>setError(caught.message));
  };
  // Selecting a leaf: models load in the background and replace the shown model when ready.
  const choose=useCallback(async(row,choice=0)=>{
    if(!row||row.folder)return;if(pendingOpen.current!==row.key)pendingOpen.current=null;setSelected(row);setFocusKey(row.key);setMessage('');setModelChoice(choice);
    const request=++modelRequest.current;
    let entry=row.file||null;
    if(row.node){
      const model=row.node.models?.[choice];if(!model){setLoadingModel(false);return;}
      setLoadingModel(true);entry=await window.desktop.gameFilesFindPath({path:model.path,variant}).catch(()=>null);if(request!==modelRequest.current)return;
      if(!entry){setLoadingModel(false);setMessage('Model not found in the game files: '+model.path);return;}
    }
    if(!entry||entry.type!=='models'){setLoadingModel(false);return;}
    setLoadingModel(true);
    try{
      const loaded=await loadGameModel(entry,signature);if(request!==modelRequest.current)return;
      const preview=previewAssets(loaded.textures),stand=loaded.doc.model.Sequences.findIndex(item=>/^stand\b/i.test(item.Name||'')),first=stand>=0?stand:loaded.doc.model.Sequences.length?0:-1;
      setShown(previous=>{previous?.release();return {...loaded,key:row.key+'|'+choice,assets:preview.assets,release:preview.release,revision:request};});
      setSequence(first);setTime(loaded.doc.model.Sequences[first]?.Interval?.[0]||0);setPlaying(true);
      if(pendingOpen.current===row.key){pendingOpen.current=null;await onOpenGameModel({name:entry.name,path:entry.path,bytes:loaded.bytes,textures:loaded.textures});onClose?.();}
    }catch(caught){if(request===modelRequest.current)setMessage(caught.message);}
    finally{if(request===modelRequest.current)setLoadingModel(false);}
  },[signature,variant,onOpenGameModel,onClose]);
  useEffect(()=>()=>shown?.release(),[]);// eslint-disable-line react-hooks/exhaustive-deps
  const selectedEntry=selected?.file||null,selectedModels=selected?.node?.models||[];
  const showsModel=!!shown&&(selected?.node?selectedModels.length>0:selectedEntry?.type==='models'),current=showsModel&&shown.key===selected?.key+'|'+modelChoice;
  // Results and errors are scrolled into view next to the button that caused them.
  useEffect(()=>{if(message)messageRef.current?.scrollIntoView({block:'nearest'});},[message]);
  // Geoset box: works on the Library's own copy of the previewed model.
  const [geosets,setGeosets]=useState(()=>new Set()),[hoveredGeoset,setHoveredGeoset]=useState(null),[highlightGeoset,setHighlightGeoset]=useState(true),[selectedOnly,setSelectedOnly]=useState(false),[geosetBusy,setGeosetBusy]=useState(false);
  useEffect(()=>{setGeosets(new Set(Array.from({length:shown?.doc.model.Geosets.length||0},(_,i)=>i)));setHoveredGeoset(null);},[shown?.key]);
  const wholeGeosets=()=>Object.fromEntries([...geosets].map(index=>[index,Array.from({length:shown.doc.model.Geosets[index].Vertices.length/3},(_,vertex)=>vertex)]));
  const geosetTotal=shown?.doc.model.Geosets.length||0,geosetKey=[...geosets].sort((a,b)=>a-b).join(',');
  const isolation=useMemo(()=>({isolated:[...geosets].sort((a,b)=>a-b),hidden:new Set(Array.from({length:geosetTotal},(_,i)=>i).filter(i=>!geosets.has(i)))}),[geosetKey,geosetTotal]);// eslint-disable-line react-hooks/exhaustive-deps
  const separate=nuclear=>{
    if(!shown||!geosets.size)return;setMessage('');
    try{
      let result=false;shown.doc.apply(nuclear?'Nuclear Seperation':'Seperate by Loose parts',['Geosets','GeosetAnims','Gliders','Info'],model=>{result=(nuclear?nuclearSeparateGeosets:separateGeosetsByLoosePart)(model,wholeGeosets());});
      if(!result){setMessage('The checked geosets are already single pieces.');return;}
      setGeosets(new Set(result.geosetIndices));setShown(previous=>({...previous,revision:previous.revision+0.001}));
      setMessage(`Split into ${result.geosetIndices.length} geosets.`);
    }catch(caught){setMessage(caught.message);}
  };
  const importSelected=async()=>{
    if(!shown||!geosets.size||!onImportGameGeosets)return;setMessage('');setGeosetBusy(true);
    try{const part=collectPart(shown.doc.model,wholeGeosets()),result=await onImportGameGeosets({source:part,assets:shown.textures,name:shown.entry.name});if(result!==false)setMessage(`Imported ${geosets.size} geoset${geosets.size===1?'':'s'} into ${importTargetName||'the current model'} on DummyBone.`);}
    catch(caught){setMessage(caught.message);}finally{setGeosetBusy(false);}
  };
  const openSelected=async()=>{
    if(!shown||!geosets.size)return;setMessage('');setGeosetBusy(true);
    try{
      const count=shown.doc.model.Geosets.length,whole=geosets.size===count&&!shown.doc.revision;
      let bytes=shown.bytes;
      if(!whole){
        const format=shown.entry.extension==='mdl'?'mdl':'mdx',copy=openDocument(shown.doc.serialize(format),shown.entry.name);
        copy.apply('Keep checked geosets',['Geosets','GeosetAnims','Gliders','Info'],model=>{for(let index=count-1;index>=0;index--)if(!geosets.has(index))deleteGeoset(model,index);});
        bytes=copy.serialize(format);
      }
      await onOpenGameModel({name:shown.entry.name,path:shown.entry.path,bytes,textures:shown.textures});onClose?.();
    }catch(caught){setMessage(caught.message);}finally{setGeosetBusy(false);}
  };
  const openInEditor=async()=>{if(!shown)return;setMessage('');try{await onOpenGameModel({name:shown.entry.name,path:shown.entry.path,bytes:shown.bytes,textures:shown.textures});onClose?.();}catch(caught){setMessage(caught.message);}};
  const keys=event=>{
    const index=rows.findIndex(row=>row.key===focusKey),row=rows[index];
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();const next=rows[Math.max(0,Math.min(rows.length-1,index<0?0:index+(event.key==='ArrowDown'?1:-1)))];if(!next)return;
      setFocusKey(next.key);if(!next.folder)choose(next);
      const top=rows.indexOf(next)*ROW,element=tree.current;if(element&&(top<element.scrollTop||top+ROW>element.scrollTop+element.clientHeight))element.scrollTop=top-element.clientHeight/2;
    }else if(event.key==='ArrowRight'&&row?.folder&&!expanded.has(row.key)){event.preventDefault();toggle(row);}
    else if(event.key==='ArrowLeft'&&row){event.preventDefault();if(row.folder&&expanded.has(row.key))toggle(row);else{const parent=rows.slice(0,index).reverse().find(item=>item.folder&&item.depth<row.depth);if(parent)setFocusKey(parent.key);}}
    else if(event.key==='Enter'&&row){event.preventDefault();if(row.folder)toggle(row);else if(current)openInEditor();}
  };
  useEffect(()=>{const element=tree.current;if(!element)return;const observer=new ResizeObserver(()=>setViewHeight(element.clientHeight));observer.observe(element);return()=>observer.disconnect();},[]);
  const first=Math.max(0,Math.floor(scrollTop/ROW)-10),last=Math.min(rows.length,Math.ceil((scrollTop+viewHeight)/ROW)+10);
  const rowIcon=row=>{
    if(row.folder){const path=worldEditor?(row.node?.icon||(row.depth===0?FOLDER_ICONS[row.name]:null)):null;return <GameIcon iconKey={path?'p:'+variant+':'+path:null} read={path?readPath(path):null} fallback={expanded.has(row.key)?FolderOpen:Folder}/>;}
    if(row.node)return <GameIcon iconKey={row.node.icon?'p:'+variant+':'+row.node.icon:null} read={row.node.icon?readPath(row.node.icon):null} fallback={row.node.models?.length?Box:File}/>;
    const file=row.file,icon=file.type==='models'?modelIcon(file):null;
    if(icon)return <GameIcon iconKey={'p:'+variant+':'+icon} read={readPath(icon)} fallback={Box}/>;
    return <GameIcon iconKey={file.type==='textures'&&file.size<4194304?'f:'+signature+':'+file.id:null} read={readFile(file)} fallback={TYPE_ICON[file.type]||File}/>;
  };
  const interval=shown?.doc.model.Sequences[sequence]?.Interval;
  return <>
    <div className="tl-toolbar"><input ref={input} type="search" value={query} placeholder={PLACEHOLDER[worldEditor?'worldeditor':preset]||PLACEHOLDER.all} onChange={event=>setQuery(event.target.value)} aria-label="Search game files"/>
      <select aria-label="Game version" title="Which game files to show: Classic (SD), Reforged (HD), Forsaken Kingdom, other languages or everything installed" value={variant} onChange={event=>{setVariant(event.target.value);remember('mdlvis.game-files.variant',event.target.value);}}>{VARIANTS.filter(([value])=>!worldEditor||SKIN[value]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      {preset==='all'&&<select aria-label="File type" value={chosenType} onChange={event=>setChosenType(event.target.value)}>{Object.entries(TYPE_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}
    </div>
    <div className="tl-body gf-body">
      <nav className="gf-side" aria-label="Game folders">
        {preset==='models'&&<div className="gf-style" role="group" aria-label="Folder layout">
          <button type="button" aria-pressed={style==='standard'} title="The game's own folders, as they are stored" onClick={()=>{setStyle('standard');remember('mdlvis.game-files.style','standard');}}>Standard</button>
          <button type="button" aria-pressed={style==='worldeditor'} title="Grouped like the World Editor: races, units, buildings, spells, items and doodads by tileset" onClick={()=>{setStyle('worldeditor');remember('mdlvis.game-files.style','worldeditor');}}>World Editor Style</button>
        </div>}
        <div ref={tree} className="gf-tree" role="tree" aria-label="Game files" tabIndex={0} onKeyDown={keys} onScroll={event=>setScrollTop(event.currentTarget.scrollTop)}>
          {results&&<div className="gf-tree-status">{results.total>results.rows.length?`${results.rows.length.toLocaleString()} of ${results.total.toLocaleString()} matches`:`${results.total.toLocaleString()} matches`}</div>}
          {!rows.length&&<p className="tl-empty">{error?'':query.trim()?'No matches. Try fewer words or another game version.':summary&&!summary.folder?'No Warcraft III game files were found. Choose your Warcraft III folder (1.30 or newer) in Settings.':'Loading game files…'}</p>}
          <div style={{height:rows.length*ROW,position:'relative'}}>
            {rows.slice(first,last).map((row,offset)=>{const at=first+offset,open=expanded.has(row.key);
              return <div key={row.key} role="treeitem" aria-level={row.depth+1} aria-expanded={row.folder?open:undefined} aria-selected={selected?.key===row.key} data-row={row.key}
                className={'gf-row'+(row.folder?' folder':'')+(selected?.key===row.key?' selected':'')+(focusKey===row.key?' focused':'')} style={{top:at*ROW,paddingLeft:6+row.depth*16}}
                onClick={()=>{setFocusKey(row.key);tree.current?.focus({preventScroll:true});if(row.folder)toggle(row);else{if(pendingOpen.current!==row.key)pendingOpen.current=null;choose(row);}}} onDoubleClick={()=>{if(row.folder)return;if(current&&selected?.key===row.key)openInEditor();else pendingOpen.current=row.key;}}
                title={row.file?row.file.path:row.node&&!row.folder?row.node.models?.map(model=>model.path).join('\n')||row.name:row.name}>
                <span className="gf-twist" aria-hidden="true">{row.folder?(open?<ChevronDown size={12}/>:<ChevronRight size={12}/>):null}</span>
                {rowIcon(row)}<span className="gf-name" translate="no">{row.name}{row.search&&row.detail&&<small translate="no">{row.detail}</small>}</span>
                {row.folder&&row.count!=null&&<small className="gf-count">{row.count.toLocaleString()}</small>}
              </div>;})}
          </div>
        </div>
      </nav>
      <main className="gf-stage" aria-label="Preview">
        <div className={'gf-stage-layer'+(showsModel?'':' hidden')}><ModelStage shown={shown} preferences={preferences} sequence={sequence} time={time} setTime={setTime} playing={playing} setPlaying={setPlaying} isolated={selectedOnly&&current?isolation.isolated:undefined} hidden={selectedOnly&&current?isolation.hidden:undefined} hovered={current?hoveredGeoset:null} highlight={highlightGeoset} onHover={setHoveredGeoset}/>{loadingModel&&<span className="gf-stage-busy">Loading model…</span>}</div>
        {!showsModel&&<div className="gf-stage-layer gf-stage-content">
          {selectedEntry&&selectedEntry.type!=='models'?<FileStage key={selectedEntry.id} entry={selectedEntry} signature={signature}/>
            :loadingModel?<span className="gf-stage-note">Loading model…</span>
            :<span className="gf-stage-note">{preset==='models'?'Choose a model on the left. Drag to turn the camera; it glides to each model you pick.':preset==='sounds'?'Choose a sound on the left to hear it. Arrow keys step through a folder.':'Choose a file on the left to view it.'}</span>}
        </div>}
      </main>
      <aside className="gf-info">{selected&&!selected.folder?<>
        <h3 translate="no">{selected.name}</h3>
        {selected.node&&<p className="tl-version" translate="no">{selected.node.id}</p>}
        {selectedModels.length>1&&<select aria-label="Model" value={modelChoice} onChange={event=>choose(selected,Number(event.target.value))}>{selectedModels.map((model,index)=><option key={index} value={index}>{model.label}</option>)}</select>}
        {showsModel&&!current&&<p className="tl-note">Loading model…</p>}
        {current&&<>
          <p className="tl-version">Game version: <strong translate="no">{shown.entry.module}</strong> · {fileSize(shown.entry.size)}</p>
          <code translate="no">{shown.entry.path}</code>
          {shown.doc.model.Sequences.length>0&&<div className="gf-transport">
            <button type="button" onClick={()=>setPlaying(value=>!value)}>{playing?'Pause':'Play'}</button>
            <select aria-label="Model animation" value={sequence} onChange={event=>{const index=Number(event.target.value);setSequence(index);setTime(shown.doc.model.Sequences[index].Interval[0]);setPlaying(true);}}>{shown.doc.model.Sequences.map((item,index)=><option key={index} value={index}>{item.Name||'Animation '+(index+1)}</option>)}</select>
          </div>}
          {interval&&<input className="gf-time" aria-label="Animation time" type="range" min={interval[0]} max={Math.max(interval[0]+1,interval[1])} value={Math.min(Math.max(time,interval[0]),interval[1])} onChange={event=>{setPlaying(false);setTime(Number(event.target.value));}}/>}
          {shown.missing.length>0&&<details className="gf-missing"><summary>{shown.missing.length} texture{shown.missing.length===1?'':'s'} not found</summary>{shown.missing.map(name=><code key={name} translate="no">{name}</code>)}</details>}
          {shown.doc.hdViewOnly&&<p className="tl-note">This is a Reforged HD model. MDLxL opens it for viewing; convert it to SD in the editor to change it.</p>}
          <LibraryGeosets count={shown.doc.model.Geosets.length} selected={geosets} onChange={setGeosets} hovered={hoveredGeoset} onHover={setHoveredGeoset} highlight={highlightGeoset} onHighlight={setHighlightGeoset} selectedOnly={selectedOnly} onSelectedOnly={setSelectedOnly} editable={!shown.doc.readOnly&&!shown.doc.hdViewOnly} busy={geosetBusy} onSeparate={separate} onImport={importSelected} onOpen={openSelected} message={message} messageRef={messageRef} canImport={!!onImportGameGeosets} importReason={onImportGameGeosets?'':'The model you are editing is read-only.'}/>
        </>}
        {selectedEntry&&selectedEntry.type!=='models'&&<><p className="tl-version">Game version: <strong translate="no">{selectedEntry.module}</strong> · {fileSize(selectedEntry.size)}</p><code translate="no">{selectedEntry.path}</code></>}
        {(selectedEntry&&selectedEntry.type!=='models'||current)&&<div className="gf-file-actions">
          <button type="button" onClick={async()=>{setMessage('');try{await window.desktop.copyTexturePath((showsModel?shown.entry:selectedEntry).path);setMessage('Path copied.');}catch(caught){setMessage(caught.message);}}}>Copy path</button>
          <button type="button" onClick={async()=>{setMessage('');try{const target=showsModel?shown.entry:selectedEntry,saved=await window.desktop.gameFilesExport({id:target.id,signature});if(saved)setMessage('Saved '+saved);}catch(caught){setMessage(caught.message);}}}>Save a copy…</button>
        </div>}
        {message&&!current&&<p ref={messageRef} className={/^(Saved |Path copied|Imported |Split into )/.test(message)?'tl-success':'tl-error'} role="status">{message}</p>}
        {error&&<p className="tl-error" role="alert">{error}</p>}
      </>:<div className="tl-empty">{error?<span className="tl-error">{error}</span>:preset==='models'?'Choose a model to view it. Double-click opens it in the editor.':'Choose a file to view it.'}</div>}</aside>
    </div>
    <footer className="tl-footer"><span>{summary?`${summary.total.toLocaleString()} game files${summary.folder?' · '+summary.folder:''}`:''}</span><span>Arrow keys move through the list · Right/Left open and close folders · Enter or double-click opens a model in the editor</span></footer>
  </>;
}
