import { standSequenceIndex } from '../src/sequence-editor.js';
import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Box,Castle,File,FileText,Film,Folder,FolderOpen,Image,Map as MapIcon,MessageSquare,Music,Sparkles,Swords,Trees,Type,Volume2} from 'lucide-react';
import {openDocument,deleteGeoset} from '../src/editor-document.js';
import {separateGeosetsByLoosePart,nuclearSeparateGeosets} from '../src/geoset-operations.js';
import {collectPart} from '../src/bits-and-parts.js';
import {readStoredText,writeStoredText} from '../src/local-store.js';
import LibraryGeosets from './LibraryGeosets.jsx';
import LibrarySaveCopy,{saveConvertedLibraryTexture} from './LibrarySaveCopy.jsx';
import {builtinTextureAssets} from '../src/builtin-textures.js';
import {decodeTextureThumbnail} from '../src/texture-thumbnail.js';
import {FOLDER_ICONS,FolderStyle,GameIcon,LibraryTree,SKIN,worldEditorTree,worldEditorRows,worldEditorResults,worldEditorRowIcon,WORLD_EDITOR_PLACEHOLDER,WORLD_EDITOR_NO_GAME,WORLD_EDITOR_NO_MATCHES} from './WorldEditorTree.jsx';
import { gamePathKey } from '../src/game-path.js';

const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const TYPE_ICON={models:Box,textures:Image,sounds:Music,text:FileText,maps:MapIcon,video:Film,fonts:Type,other:File};
const TYPE_LABEL={all:'All file types',models:'Models',textures:'Textures',sounds:'Sounds',text:'Text & data',maps:'Maps',video:'Videos',fonts:'Fonts',other:'Other files'};
const SOUND_FOLDER_ICON={Ambient:Trees,Buildings:Castle,'Campaign dialogue':MessageSquare,Cinematics:Film,Combat:Swords,Doodads:Trees,Interface:Volume2,Music,Spells:Sparkles,Units:Box,'Other sounds':Volume2};
const SOUND_ICON='ReplaceableTextures\\WorldEditUI\\SoundEditor-UseSound.dds';
const MUSIC_ICON='ReplaceableTextures\\WorldEditUI\\SoundEditor-UseMusic.dds';
const VARIANTS=[['classic','Classic'],['reforged','Reforged'],['forsaken-kingdom','Forsaken Kingdom'],['language','Other languages'],['other','Teen & retired'],['all','All installed']];
const PLACEHOLDER={models:'Search models, e.g. footman or units\\human',worldeditor:WORLD_EDITOR_PLACEHOLDER,sounds:'Search sounds, e.g. footmanyes or music',all:'Search every game file by name or folder'};
const AUDIO={wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',flac:'audio/flac'},VIDEO={webm:'video/webm',mp4:'video/mp4'},IMAGE={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
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
    assets.set(gamePathKey(record.name),asset);assets.set(gamePathKey(record.name.split(/[\\/]/).at(-1)),asset);
  }
  return {assets,release:()=>urls.forEach(url=>URL.revokeObjectURL(url))};
}

/** Center stage: one persistent preview. A new model replaces the old one when it has loaded and the camera glides to it. */
function ModelStage({shown,sequence,time,setTime,playing,setPlaying,isolated,hidden,hovered,highlight,onHover}){
  if(!shown)return null;
  return <Suspense fallback={<span className="gf-stage-note">Loading preview…</span>}><GamePreview presentation="preview" fitModel glideCamera glideKey={shown.key} fitSequenceExtent isolatedGeosets={isolated} frameKey={shown.key+':'+(isolated||[]).join(',')} hiddenGeosets={hidden} interactivePreview hoveredGeoset={highlight?hovered:null} highlightSelection={highlight} onHoverGeoset={highlight?onHover:undefined} model={shown.doc.model} revision={shown.revision} textureAssets={shown.assets} sequenceIndex={sequence} time={time} onTimeChange={setTime} playing={playing&&sequence>=0} onPlayingChange={setPlaying} showParticles mode="textured" view="perspective"/></Suspense>;
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

function BrowserToolbar({input,query,onQuery,placeholder,label,children}){
  return <div className="tl-toolbar"><input ref={input} type="search" value={query} placeholder={placeholder} onChange={event=>onQuery(event.target.value)} aria-label={label}/>{children}</div>;
}

function BrowserTree({rows,expanded,toggle,selected,onChoose,onOpen,rowIcon,style,onStyle,standardTitle,worldEditorTitle,empty,status,onVisibleRows,resetKey,focusKey:focused,setFocusKey:setFocused}){
  const [localFocus,setLocalFocus]=useState(null);
  return <nav className="gf-side" aria-label="Game folders">
    {onStyle&&<FolderStyle style={style} onChange={onStyle} standardTitle={standardTitle} worldEditorTitle={worldEditorTitle}/>}
    <LibraryTree rows={rows} expanded={expanded} selected={selected} focusKey={setFocused?focused:localFocus} setFocusKey={setFocused||setLocalFocus}
      toggle={toggle} choose={onChoose} onOpen={onOpen} onDoubleClick={onOpen} rowIcon={rowIcon} empty={empty} status={status} onVisibleRows={onVisibleRows} resetKey={resetKey}/>
  </nav>;
}

function BrowserFrame({toolbar,tree,stage,info,footer,detailsBelow=false}){
  const preview=<><main className="gf-stage" aria-label="Preview">{stage}</main><aside className="gf-info">{info}</aside></>;
  return <>{toolbar}<div className="tl-body gf-body">{tree}{detailsBelow?<div className="gf-preview-column">{preview}</div>:preview}</div><footer className="tl-footer">{footer}</footer></>;
}

/** The same browser accepts catalogue rows, stage content and actions from EMTR. */
export default function GameFileBrowser({browser,...props}){
  if(browser)return <BrowserFrame toolbar={<BrowserToolbar {...browser.toolbar}/>} tree={<BrowserTree {...browser.tree}/>} stage={browser.stage} info={browser.info} footer={browser.footer} detailsBelow/>;
  return <GameFiles {...props}/>;
}

/** The Library's browser for every installed Warcraft III file: icon tree on the left, one central view. */
function GameFiles({preset='all',onOpenGameModel,onImportGameGeosets,importTargetName,onClose}){
  const [summary,setSummary]=useState(null),[variant,setVariant]=useState(()=>remembered('mdlvis.game-files.variant','classic',VARIANTS.map(([value])=>value))),[chosenType,setChosenType]=useState('all');
  const styleKey='mdlvis.game-files.style'+(preset==='models'?'':'.'+preset);
  const [style,setStyle]=useState(()=>remembered(styleKey,preset==='all'?'standard':'worldeditor',['standard','worldeditor']));
  const [query,setQuery]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [expanded,setExpanded]=useState(()=>new Set()),[children,setChildren]=useState(()=>new Map()),[root,setRoot]=useState(null),[we,setWe]=useState(null),[results,setResults]=useState(null);
  const [selected,setSelected]=useState(null),[resolved,setResolved]=useState(null),[focusKey,setFocusKey]=useState(null);
  const [fileMessage,setFileMessage]=useState(null),[saving,setSaving]=useState(false);
  const [shown,setShown]=useState(null),[loadingModel,setLoadingModel]=useState(false),[modelChoice,setModelChoice]=useState(0),[sequence,setSequence]=useState(-1),[time,setTime]=useState(0),[playing,setPlaying]=useState(true);
  const type=preset==='all'?chosenType:preset,worldEditor=style==='worldeditor';
  const worldModels=worldEditor&&preset==='models',worldFiles=worldEditor&&!worldModels;
  const filters=[variant,type,style].join('|'),input=useRef(),modelRequest=useRef(0),pendingOpen=useRef(null),messageRef=useRef(null),browseScope=useRef();
  browseScope.current=filters;
  const signature=summary?.signature;
  useEffect(()=>{input.current?.focus();},[preset]);
  useEffect(()=>{
    if(!window.desktop?.gameFilesSummary){setError('Game files can be browsed in the desktop app.');return;}
    let active=true;window.desktop.gameFilesSummary().then(value=>{if(active)setSummary(value);}).catch(caught=>{if(active)setError(caught.message);});return()=>{active=false;};
  },[]);
  // Both file layouts load child folders only when opened.
  useEffect(()=>{
    setChildren(new Map());setRoot(null);
    if(!signature||worldModels)return;
    let active=true;
    const folder=worldFiles&&type!=='all'?type:'';
    window.desktop.gameFilesBrowse({folder,variant,type,worldEditor:worldFiles,limit:10000}).then(value=>{if(active)setRoot(value);}).catch(caught=>{if(active)setError(caught.message);});
    return()=>{active=false;};
  },[signature,filters,worldModels,worldFiles]);
  // The model catalogue also provides icons for unit folders in the sound tree.
  const needsCatalog=preset==='models'||worldFiles;
  useEffect(()=>{
    setWe(null);
    if(!signature||!needsCatalog)return;
    let active=true;
    worldEditorTree(variant,signature).then(value=>{if(active)setWe(value);}).catch(caught=>{if(active&&worldModels)setError(caught.message);});
    return()=>{active=false;};
  },[signature,variant,needsCatalog,worldModels]);
  useEffect(()=>{setExpanded(new Set());setFocusKey(null);setResults(null);},[filters]);
  useEffect(()=>{if(worldModels&&!SKIN[variant])setVariant('classic');},[worldModels,variant]);
  // Search: World Editor names in the window, game paths in the main process.
  useEffect(()=>{
    const text=query.trim().toLowerCase();if(!text){setResults(null);return;}
    if(worldModels){
      setResults(worldEditorResults(we,query));return;
    }
    if(!signature)return;
    let active=true;
    const timer=setTimeout(()=>window.desktop.gameFilesBrowse({query:text,variant,type,worldEditor:worldFiles,limit:500}).then(value=>{
      if(active)setResults({rows:value.files.map(file=>({key:'f'+file.id,name:file.name,file,detail:file.browsePath||file.path.slice(0,file.path.length-file.name.length-1)})),total:value.total});
    }).catch(caught=>{if(active)setError(caught.message);}),120);
    return()=>{active=false;clearTimeout(timer);};
  },[query,worldModels,worldFiles,we,signature,filters]);

  const readPath=path=>()=>window.desktop.gameFilesReadPath({path,variant});
  const readFile=file=>()=>window.desktop.gameFilesRead({id:file.id,signature});
  const modelIcon=file=>we?.modelIcons?.[gamePathKey(file.path)];
  const unitIcons=useMemo(()=>{
    const icons=new Map();
    if(worldFiles)for(const [model,icon] of Object.entries(we?.modelIcons||{})){
      const folder=model.slice(0,model.lastIndexOf('\\'));
      if(!icons.has(folder))icons.set(folder,icon);
    }
    return icons;
  },[we,worldFiles]);
  const fileRow=(file,depth)=>({key:'f'+file.id,depth,name:file.name,file,detail:file.module});
  // Visible rows: open folders only, so clicking a folder never moves anything else.
  const rows=useMemo(()=>{
    if(results)return results.rows.map(row=>({...row,depth:0,search:true}));
    const list=[];
    if(worldModels){
      return worldEditorRows(we,expanded);
    }
    const walk=(listing,depth)=>{
      for(const folder of listing.folders){const key='d'+folder.key;list.push({key,depth,name:folder.name,folderKey:folder.key,iconFolder:folder.iconFolder,folder:true,count:folder.count});if(expanded.has(key)&&children.has(folder.key))walk(children.get(folder.key),depth+1);}
      for(const file of listing.files)list.push(fileRow(file,depth));
    };
    if(root)walk(root,0);return list;
  },[results,worldModels,we,root,children,expanded]);
  const toggle=row=>{
    if(!row.folder)return;
    setExpanded(previous=>{const next=new Set(previous);if(next.has(row.key))next.delete(row.key);else next.add(row.key);return next;});
    if(row.folderKey!=null&&!children.has(row.folderKey))window.desktop.gameFilesBrowse({folder:row.folderKey,variant,type,worldEditor:worldFiles,limit:10000}).then(value=>{
      if(browseScope.current===filters)setChildren(previous=>new Map(previous).set(row.folderKey,value));
    }).catch(caught=>{if(browseScope.current===filters)setError(caught.message);});
  };
  // Selecting a leaf: models load in the background and replace the shown model when ready.
  const choose=useCallback(async(row,choice=0)=>{
    if(!row||row.folder)return;if(pendingOpen.current!==row.key)pendingOpen.current=null;setSelected(row);setResolved(null);setFocusKey(row.key);setMessage('');setFileMessage(null);setModelChoice(choice);
    const request=++modelRequest.current;
    let entry=row.file||null;
    if(row.node){
      const model=row.node.models?.[choice];if(!model){setLoadingModel(false);return;}
      setLoadingModel(true);entry=await window.desktop.gameFilesFindPath({path:model.path,variant}).catch(()=>null);if(request!==modelRequest.current)return;
      if(!entry){setLoadingModel(false);setMessage('Model not found in the game files: '+model.path);return;}
      setResolved(entry);
    }
    if(!entry||entry.type!=='models'){setLoadingModel(false);return;}
    setLoadingModel(true);
    try{
      const loaded=await loadGameModel(entry,signature);if(request!==modelRequest.current)return;
      const preview=previewAssets(loaded.textures),first=standSequenceIndex(loaded.doc.model);
      setShown(previous=>{previous?.release();return {...loaded,key:row.key+'|'+choice,assets:preview.assets,release:preview.release,revision:request};});
      setSequence(first);setTime(loaded.doc.model.Sequences[first]?.Interval?.[0]||0);setPlaying(true);
      if(pendingOpen.current===row.key){pendingOpen.current=null;await onOpenGameModel({name:entry.name,path:entry.path,bytes:loaded.bytes,textures:loaded.textures});onClose?.();}
    }catch(caught){if(request===modelRequest.current)setMessage(caught.message);}
    finally{if(request===modelRequest.current)setLoadingModel(false);}
  },[signature,variant,onOpenGameModel,onClose]);
  useEffect(()=>()=>shown?.release(),[]);// eslint-disable-line react-hooks/exhaustive-deps
  const selectedEntry=selected?.file||resolved,selectedModels=selected?.node?.models||[];
  const copyFilePath=async()=>{
    const request=modelRequest.current;
    try{
      await window.desktop.copyTexturePath(selectedEntry.path);
      if(request===modelRequest.current)setFileMessage({text:'Path copied.'});
    }catch(caught){if(request===modelRequest.current)setFileMessage({text:caught.message,error:true});}
  };
  const saveCopy=async format=>{
    const request=modelRequest.current;
    setFileMessage(null);setSaving(true);
    try{
      const payload={id:selectedEntry.id,signature};
      const saved=format
        ?await saveConvertedLibraryTexture(await window.desktop.gameFilesRead(payload),format)
        :await window.desktop.gameFilesExport(payload);
      if(saved&&request===modelRequest.current)setFileMessage({text:'Saved '+saved});
    }catch(caught){if(request===modelRequest.current)setFileMessage({text:caught.message,error:true});}
    finally{setSaving(false);}
  };
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
  const rowIcon=row=>{
    if(row.node)return worldEditorRowIcon(row,variant,expanded);
    if(row.folder){
      const [family,group,...nested]=row.folderKey.split('\\');
      const soundCategory=family==='sounds'&&group&&!nested.length;
      const icon=worldFiles&&(unitIcons.get(row.iconFolder)||(family==='sounds'&&FOLDER_ICONS[row.name])||(family==='sounds'&&!group?SOUND_ICON:soundCategory&&group==='music'?MUSIC_ICON:null));
      const glyph=worldFiles&&(!group?TYPE_ICON[family]:soundCategory?SOUND_FOLDER_ICON[row.name]:null);
      return <GameIcon iconKey={icon?'p:'+variant+':'+icon:null} read={icon?readPath(icon):null} fallback={glyph||(expanded.has(row.key)?FolderOpen:Folder)}/>;
    }
    const file=row.file,icon=file.type==='models'?modelIcon(file):worldFiles&&file.type==='sounds'?(/\\music\\/i.test(file.path)?MUSIC_ICON:SOUND_ICON):null;
    if(icon)return <GameIcon iconKey={'p:'+variant+':'+icon} read={readPath(icon)} fallback={file.type==='sounds'?Volume2:Box}/>;
    return <GameIcon iconKey={file.type==='textures'&&file.size<4194304?'f:'+signature+':'+file.id:null} read={readFile(file)} fallback={TYPE_ICON[file.type]||File}/>;
  };
  const interval=shown?.doc.model.Sequences[sequence]?.Interval;
  const treeReady=worldModels?we:root;
  const empty=error?'':summary&&!summary.folder?WORLD_EDITOR_NO_GAME:results||treeReady&&!query.trim()?WORLD_EDITOR_NO_MATCHES:'Loading game files…';
  return <BrowserFrame toolbar={<BrowserToolbar input={input} query={query} onQuery={setQuery} placeholder={PLACEHOLDER[worldModels?'worldeditor':preset]||PLACEHOLDER.all} label="Search game files">
      <select data-hotkey="game-files:game-version" data-hotkey-manual data-hotkey-label="Game version" aria-label="Game version" title="Which game files to show: Classic (SD), Reforged (HD), Forsaken Kingdom, other languages or everything installed" value={variant} onChange={event=>{setVariant(event.target.value);remember('mdlvis.game-files.variant',event.target.value);}}>{VARIANTS.filter(([value])=>!worldModels||SKIN[value]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      {preset==='all'&&<select data-hotkey="game-files:file-type" data-hotkey-manual data-hotkey-label="File type" aria-label="File type" value={chosenType} onChange={event=>setChosenType(event.target.value)}>{Object.entries(TYPE_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}
    </BrowserToolbar>} tree={<BrowserTree rows={rows} expanded={expanded} toggle={toggle} selected={selected} onChoose={choose}
      onOpen={row=>{if(!row.node&&row.file?.type!=='models')return;if(current&&selected?.key===row.key)openInEditor();else pendingOpen.current=row.key;}} rowIcon={rowIcon} style={style} focusKey={focusKey} setFocusKey={setFocusKey}
      onStyle={value=>{if(style!==value){setResults(null);setStyle(value);remember(styleKey,value);}}}
      worldEditorTitle={preset==='sounds'?'Units by race, campaign dialogue, music, ambient sounds and effects':preset==='all'?'Grouped by file type, with World Editor sound categories':undefined} resetKey={filters}
      status={results&&(results.total>results.rows.length?`${results.rows.length.toLocaleString()} of ${results.total.toLocaleString()} matches`:`${results.total.toLocaleString()} matches`)}
      empty={empty}/>} stage={<>
        <div className={'gf-stage-layer'+(showsModel?'':' hidden')}><ModelStage shown={shown} sequence={sequence} time={time} setTime={setTime} playing={playing} setPlaying={setPlaying} isolated={selectedOnly&&current?isolation.isolated:undefined} hidden={selectedOnly&&current?isolation.hidden:undefined} hovered={current?hoveredGeoset:null} highlight={highlightGeoset} onHover={setHoveredGeoset}/>{loadingModel&&<span className="gf-stage-busy">Loading model…</span>}</div>
        {!showsModel&&<div className="gf-stage-layer gf-stage-content">
          {selectedEntry&&selectedEntry.type!=='models'?<FileStage key={selectedEntry.id} entry={selectedEntry} signature={signature}/>
            :loadingModel?<span className="gf-stage-note">Loading model…</span>
            :<span className="gf-stage-note">{preset==='models'?'Choose a model on the left. Drag to turn the camera; it glides to each model you pick.':preset==='sounds'?'Choose a sound on the left to hear it. Arrow keys step through a folder.':'Choose a file on the left to view it.'}</span>}
        </div>}
      </>} info={selected&&!selected.folder?<>
        <h3 translate="no">{selected.name}</h3>
        {selected.node&&<p className="tl-version" translate="no">{selected.node.id}</p>}
        {selectedModels.length>1&&<select data-hotkey="game-files:model" data-hotkey-manual data-hotkey-label="Model" aria-label="Model" value={modelChoice} onChange={event=>choose(selected,Number(event.target.value))}>{selectedModels.map((model,index)=><option key={index} value={index}>{model.label}</option>)}</select>}
        {selectedEntry&&<>
          <p className="tl-version">Game version: <strong translate="no">{selectedEntry.module}</strong> · {fileSize(selectedEntry.size)}</p>
          <code translate="no">{selectedEntry.path}</code>
          <div className="gf-file-actions">
            <button data-hotkey="game-files:copy-path" data-hotkey-manual data-hotkey-label="Copy path" type="button" onClick={copyFilePath}>Copy path</button>
            <LibrarySaveCopy key={selectedEntry.id} textureName={selectedEntry.type==='textures'?selectedEntry.name:undefined} disabled={saving}>
              {format=><button data-hotkey="game-files:save-a-copy" data-hotkey-manual data-hotkey-label="Save a copy…" type="button" disabled={saving} onClick={()=>saveCopy(format)}>Save a copy…</button>}
            </LibrarySaveCopy>
          </div>
          {fileMessage&&<p className={fileMessage.error?'tl-error':'tl-success'} role="status">{fileMessage.text}</p>}
        </>}
        {showsModel&&!current&&loadingModel&&<p className="tl-note">Loading model…</p>}
        {current&&<>
          {shown.doc.model.Sequences.length>0&&<div className="gf-transport">
            <button data-hotkey="game-files:play" data-hotkey-manual data-hotkey-label="Play / pause" type="button" onClick={()=>setPlaying(value=>!value)}>{playing?'Pause':'Play'}</button>
            <select data-hotkey="game-files:model-animation" data-hotkey-manual data-hotkey-label="Model animation" aria-label="Model animation" value={sequence} onChange={event=>{const index=Number(event.target.value);setSequence(index);setTime(shown.doc.model.Sequences[index].Interval[0]);setPlaying(true);}}>{shown.doc.model.Sequences.map((item,index)=><option key={index} value={index}>{item.Name||'Animation '+(index+1)}</option>)}</select>
          </div>}
          {interval&&<input data-hotkey="game-files:animation-time" data-hotkey-manual data-hotkey-label="Animation time" className="gf-time" aria-label="Animation time" type="range" min={interval[0]} max={Math.max(interval[0]+1,interval[1])} value={Math.min(Math.max(time,interval[0]),interval[1])} onChange={event=>{setPlaying(false);setTime(Number(event.target.value));}}/>}
          {shown.missing.length>0&&<details className="gf-missing"><summary>{shown.missing.length} texture{shown.missing.length===1?'':'s'} not found</summary>{shown.missing.map(name=><code key={name} translate="no">{name}</code>)}</details>}
          {shown.doc.hdViewOnly&&<p className="tl-note">This is a Reforged HD model. MDLxL opens it for viewing; convert it to SD in the editor to change it.</p>}
          <LibraryGeosets count={shown.doc.model.Geosets.length} selected={geosets} onChange={setGeosets} hovered={hoveredGeoset} onHover={setHoveredGeoset} highlight={highlightGeoset} onHighlight={setHighlightGeoset} selectedOnly={selectedOnly} onSelectedOnly={setSelectedOnly} editable={!shown.doc.readOnly&&!shown.doc.hdViewOnly} busy={geosetBusy} onSeparate={separate} onImport={importSelected} onOpen={openSelected} message={message} messageRef={messageRef} canImport={!!onImportGameGeosets} importReason={onImportGameGeosets?'':'The model you are editing is read-only.'}/>
        </>}
        {message&&!current&&<p ref={messageRef} className={/^(Saved |Path copied|Imported |Split into )/.test(message)?'tl-success':'tl-error'} role="status">{message}</p>}
        {error&&<p className="tl-error" role="alert">{error}</p>}
      </>:<div className="tl-empty">{error?<span className="tl-error">{error}</span>:preset==='models'?'Choose a model to view it. Double-click opens it in the editor.':'Choose a file to view it.'}</div>} footer={<><span>{summary?`${summary.total.toLocaleString()} game files${summary.folder?' · '+summary.folder:''}`:''}</span><span>Arrow keys move through the list · Right/Left open and close folders · Enter or double-click opens a model in the editor</span></>}/>;
}
