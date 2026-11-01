import ParticleSourceContext from './ParticleSourceContext.jsx';
import ParticleThumbnailQueue from './ParticleThumbnailQueue.jsx';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Box,Folder,FolderOpen} from 'lucide-react';
import GameFileBrowser from './GameFileBrowser.jsx';
import GameIcon,{FOLDER_ICONS} from './GameIcon.jsx';
import ParticleLibraryStage from './ParticleLibraryStage.jsx';
import {visibleWorldEditorRows} from '../src/world-editor-catalog.js';
import {parseParticleData} from '../src/particle-data.js';
import {particleBrowserTree} from './ParticleWorldBrowser.jsx';
// The service primes 36 thumbnails per snapshot. During a scan retain thumbnails
// already loaded on later pages for the same stock recipe and reviewed sample.
function refreshCatalog(previous,next) {
  if(!previous.coverage?.sourceKey || previous.coverage.sourceKey!==next.coverage?.sourceKey)return next;
  const shown=new Map(previous.items.filter(item=>item.collection==='Warcraft'&&item.thumbnail).map(item=>[item.id,item]));
  if(!shown.size)return next;
  return {...next,items:next.items.map(item=>{
    const old=shown.get(item.id);
    return old && !item.thumbnail && JSON.stringify(old.previewSample)===JSON.stringify(item.previewSample)
      ? {...item,thumbnail:old.thumbnail} : item;
  })};
}
export async function readParticleLibraryRecipe(item){
  const recipe=parseParticleData(await window.desktop.particleRead(item.id));
  for(const key of ['name','tags','categories','naming','previewSample'])if(item[key]!==undefined)recipe[key]=item[key];
  return recipe;
}
export default function ParticleLibrary({onChoose,onClose,onError,onSelectionChange,preferences,disabled=false}) {
  const opening=useRef(false);
  const [openingName,setOpeningName]=useState('');
  const [catalog,setCatalog]=useState({items:[]}),[search,setSearch]=useState(''),[style,setStyle]=useState('standard'),[selected,setSelected]=useState(null),[sourceContext,setSourceContext]=useState(null);
  const [expanded,setExpanded]=useState(()=>new Set(['Warcraft'])),[visible,setVisible]=useState([]);
  const load=()=>window.desktop?.particleCatalog?.().then(next=>setCatalog(old=>refreshCatalog(old,next))).catch(error=>onError(error.message));
  useEffect(()=>{
    let active=true,inFlight=false,again=false,timer,lastLoad=0;
    const refresh=async()=>{
      if(inFlight){again=true;return;}
      inFlight=true;lastLoad=Date.now();
      try{const next=await window.desktop?.particleCatalog?.();if(active&&next)setCatalog(old=>refreshCatalog(old,next));}
      catch(error){if(active)onError(error.message);}
      finally{inFlight=false;if(active&&again){again=false;schedule();}}
    };
    const schedule=()=>{if(!timer)timer=setTimeout(()=>{timer=null;refresh();},Math.max(0,1000-(Date.now()-lastLoad)));};
    refresh();
    const off=window.desktop?.onParticleProgress?.(status=>{
      setCatalog(old=>({...old,status}));
      if(status.running)schedule();else{clearTimeout(timer);timer=null;refresh();}
    });
    return()=>{active=false;clearTimeout(timer);off?.();};
  },[]);
  const tree=useMemo(()=>particleBrowserTree(catalog,style,search),[catalog.items,catalog.browse,style,search]);
  const searchFolders=useRef({filter:null,keys:new Set()});
  useEffect(()=>{
    const filter=style+'|'+search,previous=searchFolders.current;
    if(previous.filter!==filter)setExpanded(search.trim()?tree.autoExpanded:new Set(['Warcraft']));
    else if(search.trim()){
      const added=[...tree.autoExpanded].filter(key=>!previous.keys.has(key));
      if(added.length)setExpanded(current=>new Set([...current,...added]));
    }
    searchFolders.current={filter,keys:tree.autoExpanded};
  },[style,search,tree.autoExpanded]);
  const opened=expanded;
  const emptyArtSearch=useMemo(()=>{
    const terms=search.toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length||style!=='worldeditor')return '';
    return [...new Set((catalog.browse?.objects||[]).flatMap(object=>object.groups.filter(group=>!group.refs.length&&group.title!=='Model'&&terms.every(term=>group.title.toLowerCase().includes(term))).map(group=>group.title+' · No indexed emitters')))].join(' · ');
  },[search,style,catalog.browse]);
  const rows=useMemo(()=>visibleWorldEditorRows(tree.nodes,opened),[tree,opened]);
  const selectedItem=catalog.items.find(item=>item.id===selected?.node?.item?.id);
  useEffect(()=>{onSelectionChange?.(selectedItem||null);},[selectedItem,onSelectionChange]);
  useEffect(()=>()=>onSelectionChange?.(null),[onSelectionChange]);
  const item=selectedItem?{...selectedItem,associations:selected?.node?.item?.associations}:null;
  const onVisibleRows=useCallback(rows=>setVisible(rows.map(row=>row.node?.item).filter(Boolean)),[]);
  const toggle=row=>setExpanded(previous=>{const next=new Set(previous);if(next.has(row.key))next.delete(row.key);else next.add(row.key);return next;});
  const choose=async item=>{if(disabled||opening.current)return;if(item.blocked)return;opening.current=true;setOpeningName(item.name);try{await onChoose(await readParticleLibraryRecipe(item));}catch(error){onError(error.message);}finally{opening.current=false;setOpeningName('');}};
  const favorite=async item=>{try{const favorite=!item.favorite;await window.desktop.particleAnnotate({id:item.id,favorite});setCatalog(old=>({...old,items:old.items.map(entry=>entry.id===item.id?{...entry,favorite}:entry)}));}catch(error){onError(error.message);}};
  const annotate=async patch=>{try{await window.desktop.particleAnnotate({id:item.id,...patch});await load();}catch(error){onError(error.message);}};
  const rowIcon=row=>{
    const effect=row.node?.item,icon=row.node?.icon||(row.folder?FOLDER_ICONS[row.name]:null);
    if(effect?.thumbnail)return <img className="gf-icon" src={effect.thumbnail} alt="" draggable={false}/>;
    return <GameIcon iconKey={icon?'p:classic:'+icon:null} read={icon?()=>window.desktop.gameFilesReadPath({path:icon,variant:'classic'}):null} fallback={row.folder?(opened.has(row.key)?FolderOpen:Folder):Box}/>;
  };
  return <div className="pe-library tl-dialog" aria-label="Particle Library" aria-busy={disabled||!!openingName}>
    {(disabled||openingName)&&<div className="pe-library-loading" role="status">{openingName?'Opening '+openingName+'…':'Restoring your work…'}</div>}
    <ParticleThumbnailQueue items={!sourceContext?visible.filter(item=>catalog.sourceStatus?.state==='ready'||item.collection!=='Warcraft'):[]} preferences={preferences} onFailure={(id,error)=>setCatalog(old=>({...old,items:old.items.map(item=>item.id===id?{...item,previewError:error}:item)}))} onThumbnail={(id,url)=>setCatalog(old=>({...old,items:old.items.map(item=>item.id===id?{...item,thumbnail:url}:item)}))}/>
    <header><strong>Particle Library</strong><button onClick={onClose} aria-label="Close Particle Library">×</button></header>
    <GameFileBrowser browser={{
      toolbar:{query:search,onQuery:setSearch,placeholder:'Find an effect…',label:'Find an effect'},
      tree:{rows,expanded:opened,toggle,selected,onChoose:setSelected,onOpen:row=>choose(row.node.item),rowIcon,style,status:emptyArtSearch,
        onStyle:value=>{setStyle(value);setExpanded(new Set(['Warcraft']));},standardTitle:'By type: Fire, Smoke, Sparks, Magic, Glows, Trails, Bursts, Other',
        empty:search.trim()?'No matching effects.':catalog.sourceStatus?.state==='missing'?'':catalog.sourceStatus?'No effects.':'Loading effects…',onVisibleRows,resetKey:style+'|'+search},
      stage:<ParticleLibraryStage item={item} preferences={preferences} suspended={!!sourceContext}/>,
      info:item?<div key={item.id} className="pe-library-info">
        <h3 translate="no">{item.name}</h3>
        <div className="gf-file-actions">
          <button disabled={disabled||!!item.blocked||!!openingName} onClick={()=>choose(item)}>Open in Lab</button>
          <button aria-label={'Favorite '+item.name} aria-pressed={!!item.favorite} onClick={()=>favorite(item)}>{item.favorite?'★':'☆'} Favorite</button>
          <button disabled={!!item.blocked||item.empty} onClick={async()=>{try{await window.desktop.particleDuplicate(item.id);await load();}catch(error){onError(error.message);}}}>Duplicate</button>
          <button disabled={!!item.blocked||item.empty} onClick={()=>window.desktop.particleExport(item.id).catch(error=>onError(error.message))}>Export preset</button>
          {item.collection==='My presets'&&<button onClick={async()=>{try{await window.desktop.particleRemove(item.id);setSelected(null);await load();}catch(error){onError(error.message);}}}>Delete</button>}
          {!item.blocked&&item.sources?.some(source=>source.physicalPath)&&<button onClick={()=>setSourceContext(item)}>View source context</button>}
        </div>
        <div className="pe-library-fields"><label>Name<input aria-label="Effect display name" defaultValue={item.name} onBlur={event=>{const name=event.target.value.trim();if(name&&name!==item.name)annotate({name});}}/></label>
          <label>Tags<input aria-label="Effect tags" defaultValue={(item.tags||[]).join(', ')} onBlur={event=>{const tags=event.target.value.split(',').map(v=>v.trim()).filter(Boolean);if(JSON.stringify(tags)!==JSON.stringify(item.tags||[]))annotate({tags});}}/></label></div>
        <div className="tl-version" translate="no">{(item.sources||[]).map((source,i)=><code key={i}>{source.emitterName&&<>{source.emitterName} · </>}{source.physicalPath||source.logicalPath}</code>)}</div>
        {item.associations?.length>0&&<small className="tl-version">{item.associations.join(' · ')}</small>}
        {item.blocked&&<small>{item.blocked.reason}</small>}{item.previewError&&<small>{item.previewError}</small>}{item.unsupported?.map((entry,i)=><small key={i}>{entry.reason||entry}</small>)}
      </div>:null,
      footer:<>{catalog.status?.running?<><span>{catalog.status.originsOnly?'Finding World Editor effects…':'Indexing '+catalog.status.processed+' / '+catalog.status.total}</span><button onClick={()=>window.desktop.particleCancel()}>Cancel scan</button></>:<button onClick={()=>window.desktop?.particleScan?.().then(load).catch(error=>onError(error.message))}>Index Warcraft assets</button>}
        <button onClick={()=>window.desktop.particleImport().then(load).catch(error=>onError(error.message))}>Import preset…</button>
        {(catalog.sourceStatus?.message||catalog.status?.browseError||catalog.status?.error)&&<span role="status">{catalog.sourceStatus?.message||catalog.status?.browseError||catalog.status?.error}</span>}
        {catalog.coverage&&<details><summary>Coverage · {catalog.coverage.recipes} recipes</summary><p>{catalog.coverage.parsedAssets} parsed / {catalog.coverage.candidateAssets} candidates · {catalog.coverage.failures} extraction exceptions · {catalog.coverage.reviewedNames} appearance names reviewed, {catalog.coverage.reviewNeededNames} still to review. Preview and placement validation are incomplete.</p></details>}</>
    }}/>
    {sourceContext&&<ParticleSourceContext item={sourceContext} onClose={()=>setSourceContext(null)}/>}
  </div>;
}
