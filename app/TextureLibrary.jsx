import { useWindowKeyClaim } from './Hotkeys.jsx';
import React,{Suspense,lazy,useEffect,useMemo,useRef,useState} from 'react';
import {backgroundThumbnail} from './asset-preload-client.js';
import {createTextureAssetCache,createTextureLibrarySessions,createThumbnailQueue,createThumbnailLookup,warmTextureLibrarySession} from '../src/texture-library-session.js';
import {initialTextureLibraryResults,textureFolderTree,textureFormatMatches} from '../src/texture-library-search.js';
import {cachedThumbnail,saveThumbnail,peekThumbnail} from '../src/texture-library-cache.js';
import {getUVPreviewSelection,existingTextureIndex,materialsUsingTexture} from '../src/uv-preview.js';
import './texture-library.css';
import { translate } from '../src/localization.js';
import { readStoredText, writeStoredText } from '../src/local-store.js';
import { trapTab } from './focus-trap.js';
import { gamePathKey } from '../src/game-path.js';
import { resolveGameFiles } from './desktop.js';
import {FolderStyle,WorldEditorTextureTree,WORLD_EDITOR_PLACEHOLDER,SKIN} from './WorldEditorTree.jsx';
import {entryTextureList} from './world-editor-textures.js';
import {matchEntryTextures} from '../src/world-editor-textures.js';

const GameFileBrowser=lazy(()=>import('./GameFileBrowser.jsx'));
const LIBRARY_TABS=[['textures','Textures','Warcraft III textures and textures beside your model'],['models','Models','Every Warcraft III model; double-click one to open it in the editor'],['sounds','Sounds','Every Warcraft III sound, voice and music file'],['all','All files','Every Warcraft III game file, organised like the game folders']];
const librarySessions=createTextureLibrarySessions();
const loadAsset=createTextureAssetCache({resolve:({names,path})=>resolveGameFiles(names,path)});
const readNativeThumbnail=createThumbnailLookup(options=>window.desktop?.textureLibraryThumbnails?.(options)||[]);
const thumbnailQueue=createThumbnailQueue({concurrency:4});
const thumbnailJobs=new Map();
let sharedWorker=null,searchSerial=0,libraryConsumers=0;
const warmJobs=new Map();
const textureVersionLabel={classic:'CLASSIC',reforged:'REFORGED','forsaken-kingdom':'FORSAKEN KINGDOM',custom:'MODEL FOLDER',unknown:'UNCLASSIFIED NATIVE SOURCE'};
function preferredTab(){return readStoredText('mdlvis.library.tab','textures',value=>LIBRARY_TABS.some(([tab])=>tab===value)?value:'textures');}
function preferredVibe(){return readStoredText('mdlvis.texture-library.vibe',true,value=>value!=='false');}
function preferredFormat(){return readStoredText('mdlvis.texture-library.blp-only','all',value=>value==='true'?'blp':'all');}
function libraryWorker(){
  if(!sharedWorker){const created=new Worker(new URL('../src/texture-library-worker.js',import.meta.url),{type:'module'});created.addEventListener('message',({data})=>{if(data.type==='ready')created.warmSignature=data.signature;});created.addEventListener('error',()=>{if(sharedWorker===created){created.terminate();sharedWorker=null;}});sharedWorker=created;}
  return sharedWorker;
}
function warmSearch(catalog,options){
  const w=libraryWorker(),id=++searchSerial;
  return new Promise((resolve,reject)=>{
    const finish=(error,result)=>{clearTimeout(timer);w.removeEventListener('message',message);w.removeEventListener('error',failed);error?reject(error):resolve(result);};
    const search=()=>w.postMessage({type:'search',id,signature:catalog.signature,options});
    const message=({data})=>{if(data.type==='ready'&&data.signature===catalog.signature)search();else if(data.type==='result'&&data.id===id)finish(null,data.result);else if(data.type==='error'&&(data.id===id||data.id==null&&data.signature===catalog.signature))finish(Error(data.message));};
    const failed=event=>finish(Error(event.message||'Texture search could not start.'));
    const timer=setTimeout(()=>finish(Error('Texture search preparation timed out.')),30000);
    w.addEventListener('message',message);w.addEventListener('error',failed);
    if(w.warmSignature===catalog.signature)search();else w.postMessage({type:'init',items:catalog.items,signature:catalog.signature});
  });
}
/** Called only after explicit Yes; the browser opens with its search worker/results ready. */
export function warmTextureLibrary(modelPath){
  const key=String(modelPath||'');if(warmJobs.has(key))return warmJobs.get(key);
  const vibe=preferredVibe(),format=preferredFormat();
  const job=warmTextureLibrarySession({sessions:librarySessions,modelPath,vibe,format,loadCatalog:()=>window.desktop.textureLibraryCatalog({modelPath}),canWarm:()=>libraryConsumers===0,search:warmSearch});
  warmJobs.set(key,job);job.finally(()=>warmJobs.delete(key)).catch(()=>{});return job;
}
async function thumbnail(item,modelPath){
  if(thumbnailJobs.has(item.cacheKey))return thumbnailJobs.get(item.cacheKey);
  const job=(async()=>{
    const cached=await cachedThumbnail(item.cacheKey);if(cached)return cached;
    const native=await readNativeThumbnail(item.cacheKey).catch(()=>null);
    if(native){await saveThumbnail(item.cacheKey,native);return native;}
    return thumbnailQueue(item.cacheKey,async()=>{
      const asset=await loadAsset(item,modelPath),url=await backgroundThumbnail(asset,item.cacheKey);
      await saveThumbnail(item.cacheKey,url);
      if(window.desktop?.textureLibrarySaveThumbnail)await window.desktop.textureLibrarySaveThumbnail({key:item.cacheKey,url}).catch(()=>{});
      return url;
    });
  })();thumbnailJobs.set(item.cacheKey,job);try{return await job;}finally{thumbnailJobs.delete(item.cacheKey);}
}
function TextureTile({item,modelPath,selected,onSelect,cacheEpoch}){
  const ref=useRef(),[image,setImage]=useState(()=>peekThumbnail(item.cacheKey)),[error,setError]=useState('');
  useEffect(()=>{
    let active=true,started=false;setImage(peekThumbnail(item.cacheKey));setError('');
    const start=()=>{if(started)return;started=true;thumbnail(item,modelPath).then(url=>{if(active)setImage(url);}).catch(error=>{if(active)setError(error.message);});};
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();start();}},{rootMargin:'80px'});observer.observe(ref.current);
    return()=>{active=false;observer.disconnect();};
  },[item.cacheKey,modelPath,cacheEpoch]);
  return <button ref={ref} type="button" className={'tl-tile'+(selected?' selected':'')} onClick={()=>onSelect(item)} aria-pressed={selected} title={item.sourcePath}>
    <span className="tl-tile-image">{image?<img src={image} alt="" loading="lazy" decoding="async"/>:<span>{error?'Unavailable':'…'}</span>}</span><span className="tl-tile-name" translate="no">{item.name}</span>
    <small>{textureVersionLabel[item.variant]||textureVersionLabel.unknown}</small>
  </button>;
}
function FolderBranch({node,selected,onSelect,depth=0}){
  const [open,setOpen]=useState(depth<1);
  return <div className="tl-folder-branch"><div className={'tl-folder-row'+(selected===node.path?' selected':'')} style={{paddingLeft:4+depth*12}}>
    {node.children.length?<button type="button" className="tl-expand" onClick={()=>setOpen(v=>!v)} aria-label={(open?'Collapse ':'Expand ')+node.name}>{open?'▾':'▸'}</button>:<span className="tl-expand"/>}
    <button type="button" className="tl-folder" translate="no" onClick={()=>onSelect(node.path)} title={node.path}><span translate={node.path && node.name !== 'Model folder' ? 'no' : undefined}>{node.name}</span><small>{node.count}</small></button>
  </div>{open&&node.children.map(child=><FolderBranch key={child.path} node={child} selected={selected} onSelect={onSelect} depth={depth+1}/>)}</div>;
}
export default function TextureLibrary({model,modelPath,onClose,onAddTexture,onPreviewTexture,previewEnabled=false,previewReason='',selectedGeosets,onOpenMaterials,onSelectTexture,selectLabel='Use in Forge',fullLibrary=false,onOpenGameModel,onImportGameGeosets,importTargetName,preferences}){
  // Only the Library button opens every game file; texture pickers stay texture-only.
  const [tab,setTab]=useState(()=>fullLibrary?preferredTab():'textures'),chooseTab=value=>{setTab(value);writeStoredText('mdlvis.library.tab',value);};
  const [style,setStyle]=useState(()=>readStoredText('mdlvis.texture-library.style','worldeditor',value=>value==='standard'?'standard':'worldeditor'));
  const worldEditor=style==='worldeditor';
  const [entry,setEntry]=useState(null),[entryRecords,setEntryRecords]=useState([]),[entryLoading,setEntryLoading]=useState(false),[entryError,setEntryError]=useState('');
  const entryRequest=useRef(0);
  const initialCatalog=librarySessions.peek(modelPath);
  const [catalog,setCatalog]=useState(initialCatalog),[loading,setLoading]=useState(!initialCatalog),[error,setError]=useState(''),[query,setQuery]=useState(''),[vibe,setVibe]=useState(preferredVibe),[format,setFormat]=useState(preferredFormat),[folder,setFolder]=useState(''),[variant,setVariant]=useState('classic'),[kind,setKind]=useState('all'),[limit,setLimit]=useState(120),[result,setResult]=useState(()=>librarySessions.result(modelPath,initialCatalog?.signature,{query:'',vibe:preferredVibe(),folder:'',variant:'classic',kind:'all',format:preferredFormat(),limit:120})||{items:[],total:0}),[ready,setReady]=useState(false),[searching,setSearching]=useState(false),[selected,setSelected]=useState(null),[selectedAsset,setSelectedAsset]=useState(null),[selectedImage,setSelectedImage]=useState(null),[selectionError,setSelectionError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[cacheEpoch,setCacheEpoch]=useState(0),[choice,setChoice]=useState(null);
  const worker=useRef(),requestId=useRef(0),requestOptions=useRef(null),expectedCatalog=useRef(null),previewFilters=useRef(null),dialog=useRef(),input=useRef();
  const currentFilters=useRef();currentFilters.current={query,format,folder,variant,kind,worldEditor};
  const [catalogFresh,setCatalogFresh]=useState(false);
  useEffect(()=>{
    const previous=document.activeElement;input.current?.focus();return()=>previous?.focus?.();
  },[]);
  useEffect(()=>{
    let active=true,initTimer,fullCatalogTimer;expectedCatalog.current=null;setCatalogFresh(false);setLoading(!librarySessions.peek(modelPath));setReady(false);setError('');
    if(!window.desktop?.textureLibraryCatalog){setLoading(false);setError('The native texture library is available in the desktop app.');return;}
    const w=libraryWorker();worker.current=w;libraryConsumers++;
    const onMessage=({data})=>{if(!active)return;if(data.type==='ready'&&expectedCatalog.current!==null&&data.signature===expectedCatalog.current){setReady(true);setLoading(false);}else if(data.type==='result'&&data.id===requestId.current){librarySessions.remember(modelPath,expectedCatalog.current,requestOptions.current,data.result);setResult(data.result);setSearching(false);}else if(data.type==='error'&&(data.id===requestId.current||data.id==null&&expectedCatalog.current!==null&&data.signature===expectedCatalog.current)){setError(data.message);setLoading(false);setSearching(false);}};
    const onError=event=>{if(sharedWorker===w){w.terminate();sharedWorker=null;}if(active){setError(event.message||'Texture search could not start.');setLoading(false);}};
    w.addEventListener('message',onMessage);w.addEventListener('error',onError);
    const useCatalog=data=>{if(!active)return;clearTimeout(initTimer);if(expectedCatalog.current!==data.signature){requestId.current=++searchSerial;setSearching(false);}expectedCatalog.current=data.signature;setCatalog(data);setSelected(previous=>previous&&data.items.some(item=>item.cacheKey===previous.cacheKey)?previous:null);if(!currentFilters.current.worldEditor&&!data.items.some(item=>item.variant==='classic'))setVariant('all');if(data.signature&&w.warmSignature===data.signature){setReady(true);setLoading(false);}else{setReady(false);initTimer=setTimeout(()=>{if(active)w.postMessage({type:'init',items:data.items,signature:data.signature});},50);}};
    const refreshCatalog=()=>librarySessions.load(modelPath,()=>window.desktop.textureLibraryCatalog({modelPath})).then(data=>{useCatalog(data);if(active)setCatalogFresh(true);}).catch(error=>{if(active){setError(error.message);setLoading(false);}});
    const warm=librarySessions.peek(modelPath);
    if(warm){useCatalog(warm);refreshCatalog();}
    else if(window.desktop.textureLibraryPreview){
      const previewFormat=currentFilters.current.format;
      window.desktop.textureLibraryPreview({modelPath,format:previewFormat}).then(preview=>{
        if(!active)return;
        const filters=currentFilters.current;
        if(filters.worldEditor||filters.query.trim()||filters.folder||filters.kind!=='all'||filters.variant!=='classic'||filters.format!==previewFormat)return;
        previewFilters.current={format:previewFormat,variant:preview.variant};setVariant(preview.variant);setResult(preview.result);setLoading(false);
      }).catch(error=>{if(active)console.warn('Texture library first page:',error);}).finally(()=>{if(active)fullCatalogTimer=setTimeout(()=>{if(active)refreshCatalog();},75);});
    }else refreshCatalog();
    const unsubscribe=window.desktop.onTextureLibraryPreloadProgress?.(status=>{if(['complete','cancelled'].includes(status.state)){setCacheEpoch(value=>value+1);refreshCatalog();}});
    return()=>{active=false;clearTimeout(initTimer);clearTimeout(fullCatalogTimer);libraryConsumers--;unsubscribe?.();w.removeEventListener('message',onMessage);w.removeEventListener('error',onError);worker.current=null;};
  },[modelPath]);
  useEffect(()=>{setLimit(120);},[query,vibe,folder,variant,kind,format]);
  useEffect(()=>{
    if(worldEditor){requestId.current=++searchSerial;setSearching(false);return;}
    const options={query,vibe,folder,variant,kind,format,limit};
    const first=catalog?initialTextureLibraryResults(catalog.items,options):null;
    if(first){setResult(first);setLoading(false);}
    if(!ready){requestId.current=++searchSerial;if(first)setSearching(Boolean(query.trim()&&vibe));else if(previewFilters.current&&(query.trim()||folder||kind!=='all'||variant!==previewFilters.current.variant||format!==previewFilters.current.format)){setResult({items:[],total:0});setSearching(true);}return;}
    if(!query.trim()||!vibe){requestId.current=++searchSerial;setSearching(false);return;}
    const id=++searchSerial;requestId.current=id;requestOptions.current=options;
    const cached=librarySessions.result(modelPath,catalog?.signature,options);if(cached){setResult(cached);setSearching(false);return;}
    setSearching(true);const timer=setTimeout(()=>worker.current?.postMessage({type:'search',id,signature:catalog?.signature,options}),35);return()=>clearTimeout(timer);
  },[ready,catalog?.signature,modelPath,query,vibe,folder,variant,kind,format,limit,worldEditor]);
  useEffect(()=>{
    let active=true;setSelectedAsset(null);setSelectedImage(null);setSelectionError('');setMessage('');setChoice(null);if(!selected)return;
    loadAsset(selected,modelPath).then(asset=>{if(active)setSelectedAsset(asset);}).catch(error=>{if(active)setSelectionError(error.message);});
    thumbnail(selected,modelPath).then(url=>{if(active)setSelectedImage(url);}).catch(error=>{if(active)setSelectionError(error.message);});
    return()=>{active=false;};
  },[selected?.cacheKey,modelPath]);
  useEffect(()=>{
    entryRequest.current++;setEntry(null);setEntryRecords([]);setEntryLoading(false);setEntryError('');if(worldEditor)setSelected(null);
    if(worldEditor&&!SKIN[variant])setVariant('classic');
  },[worldEditor,variant]);
  const chooseEntry=async node=>{
    const request=++entryRequest.current;setEntry(node);setEntryRecords([]);setEntryLoading(true);setEntryError('');setSelected(null);
    try{const summary=await window.desktop.gameFilesSummary(),records=await entryTextureList(node,variant,summary.signature);if(request===entryRequest.current)setEntryRecords(records);}
    catch(error){if(request===entryRequest.current)setEntryError(error.message);}
    finally{if(request===entryRequest.current)setEntryLoading(false);}
  };
  useEffect(()=>()=>{entryRequest.current++;},[]);
  const entryResult=useMemo(()=>matchEntryTextures(entryRecords,catalog?.items||[]),[entryRecords,catalog?.items]);
  const entryItems=useMemo(()=>entryResult.items.filter(item=>textureFormatMatches(item,format)),[entryResult,format]);
  const displayed=worldEditor?{items:entryItems,total:entryItems.length}:result;
  const tree=useMemo(()=>worldEditor?{count:0,children:[]}:textureFolderTree((catalog?.items||[]).filter(item=>(variant==='all'||item.variant===variant)&&textureFormatMatches(item,format))),[catalog,variant,format,worldEditor]);
  const used=useMemo(()=>new Set((model?.Textures||[]).map(t=>gamePathKey(t.Image))),[model,model?.Textures?.length]);
  const checkedPreview=selectedGeosets==null?null:getUVPreviewSelection(model,selectedGeosets);
  const previewAllowed=previewEnabled&&(!checkedPreview||checkedPreview.enabled),disabledPreviewReason=previewReason||checkedPreview?.reason||'Texture preview is unavailable for this selection.';
  const act=async(callback,success,options)=>{if(!catalogFresh||!selectedAsset||!callback)return;setBusy(true);setSelectionError('');setChoice(null);try{await callback(selectedAsset,selected,options);setMessage(success);}catch(error){setSelectionError(error.message);}finally{setBusy(false);}};
  // A texture already in the model pops up one button per material that shows it, plus a new material; one click decides.
  const existingTexture=selected?existingTextureIndex(model,selected.path):-1,materialUsers=useMemo(()=>materialsUsingTexture(model,existingTexture),[model,model?.Materials?.length,existingTexture]);
  const geosetsUsing=id=>(model?.Geosets||[]).flatMap((geoset,index)=>geoset.MaterialID===id?[index+1]:[]);
  const requestTexture=(action,callback,success)=>{if(existingTexture<0)return act(callback,success);if(!materialUsers.length)return act(callback,action==='preview'?success:'Added a new material.',action==='preview'?undefined:{material:'new'});setMessage('');setChoice({callback,success:action==='preview'?success:''});};
  const choicePopup=useRef();
  const copyPath=async()=>{setSelectionError('');try{await window.desktop.copyTexturePath(selected.path);setMessage('Texture path copied.');}catch(error){setSelectionError(error.message);}};
  const changeVariant=value=>{setVariant(value);setFolder('');};
  const changeStyle=value=>{setStyle(value);setQuery('');if(value==='standard'&&catalog&&!catalog.items.some(item=>item.variant==='classic'))setVariant('all');writeStoredText('mdlvis.texture-library.style',value);};
  useWindowKeyClaim(({event, localWindow}) => {
    if (localWindow !== dialog.current || event.key !== 'Escape' || !choice) return false;
    if (!busy) setChoice(null); return true;
  });
  const keys=event=>{
    event.stopPropagation();
    trapTab(event,choicePopup.current||dialog.current);
  };
  return <div className="tl-overlay" onKeyDown={keys}><section ref={dialog} data-hotkey-prefix="texture-library" className="tl-dialog" role="dialog" aria-modal="true" aria-label={fullLibrary?'Warcraft III Library':'Material and Texture Library'} data-hotkey-scope={fullLibrary?'library':undefined}>
    <header className="tl-header"><img src="./classic/wc3-library.png" alt=""/><div><h2>{fullLibrary?'Warcraft III Library':<>{translate("Material & Texture Library")}</>}</h2><span>{LIBRARY_TABS.find(([value])=>value===tab)[2]}</span></div>{onOpenMaterials&&<button type="button" onClick={onOpenMaterials}>Material Manager</button>}<button type="button" data-hotkey="close" aria-label="Close texture library" onClick={onClose} disabled={busy}>✕</button></header>
    {fullLibrary&&<div className="tl-tabs" role="tablist" aria-label="Library sections">{LIBRARY_TABS.map(([value,label])=><button key={value} type="button" role="tab" aria-selected={tab===value} onClick={()=>chooseTab(value)}>{label}</button>)}</div>}
    {tab!=='textures'?<Suspense fallback={<p className="tl-empty">Loading game files…</p>}><GameFileBrowser key={tab} preset={tab} onOpenGameModel={onOpenGameModel} onImportGameGeosets={onImportGameGeosets} importTargetName={importTargetName} onClose={onClose}/></Suspense>:<>
    <div className="tl-toolbar"><input ref={input} type="search" value={query} placeholder={worldEditor?WORLD_EDITOR_PLACEHOLDER:vibe?'Try rusty chain mail, painting, high resolution, or 512':'Search names, paths, high resolution, or 256'} onChange={event=>setQuery(event.target.value)} aria-label="Search textures"/>
      {!worldEditor&&<label title="Search surfaces, colours and kitbash associations"><input type="checkbox" checked={vibe} onChange={event=>{setVibe(event.target.checked);writeStoredText('mdlvis.texture-library.vibe',event.target.checked);}}/>Vibe search</label>}
      <label title="Hide DDS and other texture formats"><input aria-label="BLP textures only" type="checkbox" checked={format==='blp'} onChange={event=>{const next=event.target.checked?'blp':'all';setFormat(next);if(next==='blp')setSelected(previous=>textureFormatMatches(previous,next)?previous:null);writeStoredText('mdlvis.texture-library.blp-only',event.target.checked);}}/>BLP only</label>
      <select aria-label="Texture source" value={variant} onChange={event=>changeVariant(event.target.value)}><option value="classic">Classic</option><option value="reforged">Reforged</option><option value="forsaken-kingdom">Forsaken Kingdom</option>{!worldEditor&&<><option value="custom">Model folder</option><option value="all">All installed</option></>}</select>
      {!worldEditor&&<select aria-label="Texture kind" value={kind} onChange={event=>setKind(event.target.value)}><option value="all">All textures</option><option value="units">Units &amp; characters</option><option value="buildings">Buildings</option><option value="doodads">Doodads</option><option value="terrain">Terrain</option><option value="effects">Effects</option><option value="icons">Icons</option><option value="art">Paintings &amp; art</option></select>}
    </div>
    <div className="tl-body"><nav className={'tl-folders'+(worldEditor?' gf-side':'')} aria-label="Native texture folders"><FolderStyle style={style} onChange={changeStyle}/>{worldEditor?<WorldEditorTextureTree variant={variant} query={query} onChoose={chooseEntry} onError={error=>setEntryError(error.message)}/>:<><button type="button" className={'tl-all-folders'+(!folder?' selected':'')} onClick={()=>setFolder('')}>All folders <small>{tree.count}</small></button>{tree.children.map(node=><FolderBranch key={node.path} node={node} selected={folder} onSelect={setFolder}/>)}</>}</nav>
      <main className="tl-results"><div className="tl-result-status" aria-live="polite">{worldEditor?<span>{translate('{0} textures').replace('{0}',displayed.total.toLocaleString())}{entry&&<> · <span translate="no">{entry.name}</span></>}</span>:<>{loading?'Loading texture library…':searching?'Searching…':`${result.total.toLocaleString()} textures`}{folder&&<span title={folder}>{folder}</span>}</>}</div>
        {error&&<p className="tl-error" role="alert">{error}</p>}{catalog?.errors?.map((item,index)=><p key={index} className="tl-error">{item.message}</p>)}
        {!loading&&catalog?.nativeCount===0&&<p className="tl-note">No Warcraft textures were found. Choose your Warcraft III folder in Settings.</p>}
        {!worldEditor&&result.notice&&vibe&&<p className="tl-note">{result.notice}</p>}
        {!worldEditor&&result.unknown?.length>0&&vibe&&<p className="tl-note">Unrecognised words: {result.unknown.join(', ')}.</p>}
        {!worldEditor&&!loading&&!searching&&!error&&result.total===0&&<p className="tl-empty">No matching textures. Try a material, a Warcraft unit name, or a broader folder.</p>}
        {worldEditor&&!entry&&<p className="tl-empty">{translate('Choose a unit, spell, item or doodad to see its textures.')}</p>}
        {worldEditor&&entryError&&<p className="tl-error" role="alert">{entryError}</p>}
        <div className="tl-grid">{worldEditor&&entry&&(entryLoading||!catalog)&&<span className="tl-tile"><span className="tl-tile-image">…</span></span>}{displayed.items.map(item=><TextureTile key={item.id} item={item} modelPath={modelPath} cacheEpoch={cacheEpoch} selected={selected?.id===item.id} onSelect={setSelected}/>)}</div>
        {worldEditor&&catalog&&entryResult.missing.length>0&&<details className="gf-missing"><summary>{translate('{0} textures not found').replace('{0}',entryResult.missing.length)}</summary>{entryResult.missing.map(name=><code key={name} translate="no">{name}</code>)}</details>}
        {!worldEditor&&result.hasMore&&<button type="button" className="tl-more" onClick={()=>setLimit(n=>n+120)} disabled={searching}>Show more textures</button>}
      </main>
      <aside className="tl-details">{selected?<><div className="tl-preview">{selectedImage?<img src={selectedImage} alt={selected.name} translate="no"/>:<span>{selectionError?'Preview unavailable':'Loading preview…'}</span>}</div><h3 translate="no">{selected.name}</h3><p className="tl-version">Game version: <strong>{textureVersionLabel[selected.variant]||textureVersionLabel.unknown}</strong></p><code translate="no">{selected.path}</code><button type="button" className="tl-copy-path" onClick={copyPath}>Copy texture path</button>{selected.sourcePath!==selected.path&&<details><summary>Native source path</summary><code translate="no">{selected.sourcePath}</code></details>}
        {selected.width>0&&<p className="tl-dimensions">{selected.width} × {selected.height}</p>}{selected._match?.type==='inspiration'&&<p className="tl-note">{selected._match.inspiration} kitbash suggestion<br/>{selected._match.reason.split(' · ').map(value=>translate(value)).join(' · ')}</p>}
        {selected.notes&&<p>{selected.notes}</p>}{selected._match?.missing?.length>0&&<p className="tl-note">Related result. Unconfirmed: {selected._match.missing.map(value=>translate(value)).join(', ')}.</p>}
        {selected.tags?.length>0&&<div className="tl-tags">{selected.tags.slice(0,12).map(tag=><button type="button" key={tag} onClick={()=>{setQuery(tag==='chain'?'chainmail':tag.replaceAll('-',' '));setVibe(true);}}>{tag==='chain'?'chainmail':tag.replaceAll('-',' ')}</button>)}</div>}
        {selectionError&&<p className="tl-error" role="alert">{selectionError}</p>}{message&&<p className="tl-success" role="status">{message}</p>}
        <div className="tl-actions">{!catalogFresh&&<p className="tl-note">Checking the current texture sources…</p>}{onSelectTexture?<button type="button" className="tl-primary" disabled={!catalogFresh||!selectedAsset||busy} onClick={()=>act(onSelectTexture,'')}>{selectLabel}</button>:<button type="button" disabled={!catalogFresh||!selectedAsset||busy||!onAddTexture} title={existingTexture>=0?'Already in the model: pick a material that shows it, or make a new one.':undefined} onClick={()=>requestTexture('add',onAddTexture,'Texture added to the model.')}>{used.has(selected.path.toLowerCase())?'Texture already in model…':'Add texture to model'}</button>}
          {onPreviewTexture&&<><button type="button" className="tl-primary" disabled={!catalogFresh||!previewAllowed||!selectedAsset||busy} title={!previewAllowed?disabledPreviewReason:undefined} onClick={()=>requestTexture('preview',onPreviewTexture,'Preview texture loaded.')}>Preview Texture in Editor</button>{!previewAllowed&&<p className="tl-preview-reason">{disabledPreviewReason}</p>}</>}
        </div>
      </>:<div className="tl-empty">Choose a texture to inspect or add it to your model.</div>}</aside>
    </div>
    {choice&&<div className="tl-choice-shade" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setChoice(null);}}><div ref={choicePopup} className="tl-choice" role="dialog" aria-modal="true" aria-label="Texture already in the model">
      <h3>Texture already in the model</h3><p>Pick the material that should show it.</p>
      {materialUsers.map((id,index)=><button key={id} type="button" autoFocus={index===0} className={index===0?'tl-primary':undefined} disabled={busy} title="Use this material, with its blending and settings." onClick={()=>act(choice.callback,choice.success||'Using Material '+(id+1)+'.',{material:id})}>{'Material '+(id+1)+(geosetsUsing(id).length?' · geoset '+geosetsUsing(id).join(', '):'')}</button>)}
      <button type="button" disabled={busy} title="Make a separate material for this texture, so its settings can differ from the existing one." onClick={()=>act(choice.callback,choice.success||'Added a new material.',{material:'new'})}>New material</button>
      <button type="button" className="tl-choice-cancel" disabled={busy} onClick={()=>setChoice(null)}>Cancel</button>
    </div></div>}
    <footer className="tl-footer"><span>{catalog?`${catalog.nativeCount.toLocaleString()} native · ${catalog.customCount} beside model`:''}</span><span>Previews are cached. Use Settings → Warcraft III → Preload Assets to prepare the library.</span></footer>
    </>}
  </section></div>;
}
