import ParticleSourceContext from './ParticleSourceContext.jsx';
import ParticleThumbnailQueue from './ParticleThumbnailQueue.jsx';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {parseParticleData} from '../src/particle-data.js';
import {appearanceTypes} from '../src/particle-library-browse.js';
import {worldPage,WorldRows} from './ParticleWorldBrowser.jsx';
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
export default function ParticleLibrary({onChoose,onClose,onError,preferences,disabled=false}) {
  const opening=useRef(false);
  const [openingName,setOpeningName]=useState('');
  const [catalog,setCatalog]=useState({items:[]}),[collection,setCollection]=useState('Warcraft'),[category,setCategory]=useState('All'),[search,setSearch]=useState(''),[limit,setLimit]=useState(36),[details,setDetails]=useState(null),[sourceContext,setSourceContext]=useState(null);
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
  const [view,setView]=useState('By type'),[selected,setSelected]=useState('');
  const stock=collection==='Warcraft'||collection==='Favorites', world=stock&&view==='World Editor';
  const navigate=(id='')=>{setSelected(id);setLimit(36);setDetails(null);};
  const collectionItems=useMemo(()=>catalog.items.filter(item=>collection==='Favorites'?item.favorite:item.collection===collection)
    .sort((a,b)=>collection==='My work'?(b.updatedAt||0)-(a.updatedAt||0):Number(!!a.blocked)-Number(!!b.blocked)||Number(['reviewed','user-reviewed'].includes(b.naming?.state))-Number(['reviewed','user-reviewed'].includes(a.naming?.state))),[catalog.items,collection]);
  const terms=useMemo(()=>search.toLowerCase().split(/\s+/).filter(Boolean),[search]);
  const items=useMemo(()=>collectionItems.filter(item=>{
    if(!world&&category!=='All'&&!item.categories?.includes(category))return false;
    if(!terms.length)return true;
    const text=[item.name,...item.tags||[],...item.aliases||[],...(item.sources||[]).flatMap(source=>[source.emitterName,source.physicalPath])].join(' ').toLowerCase();
    return terms.every(term=>text.includes(term));
  }),[collectionItems,world,category,terms]);
  const page=useMemo(()=>world&&catalog.browse&&catalog.sourceStatus?.state==='ready'
    ?worldPage(catalog.browse,collectionItems,items,terms,selected):null,[world,catalog.browse,catalog.sourceStatus?.state,collectionItems,items,terms,selected]);
  const pageItems=world?[...new Map((page?.sections||[]).flatMap(group=>group.items.map(item=>[item.id,item]))).values()]:items;
  const visible=pageItems.slice(0,limit), visibleIds=new Set(visible.map(item=>item.id));
  const sections=world?(page?.sections||[]).map(group=>({...group,empty:!group.items.length,items:group.items.filter(item=>visibleIds.has(item.id))})):
    stock?[...new Set([...appearanceTypes,...visible.flatMap(item=>item.categories||[])])].map(title=>({title,items:visible.filter(item=>(category==='All'?item.categories?.[0]||'Other':category)===title)})):[{title:'',items:visible}];
  const choose=async item=>{if(disabled||opening.current)return;if(item.blocked){setDetails(item.id);return;}opening.current=true;setOpeningName(item.name);try{const recipe=parseParticleData(await window.desktop.particleRead(item.id));for(const key of ['name','tags','categories','naming','previewSample'])if(item[key]!==undefined)recipe[key]=item[key];await onChoose(recipe);}catch(error){onError(error.message);}finally{opening.current=false;setOpeningName('');}};
  const favorite=async item=>{try{const favorite=!item.favorite;await window.desktop.particleAnnotate({id:item.id,favorite});setCatalog(old=>({...old,items:old.items.map(entry=>entry.id===item.id?{...entry,favorite}:entry)}));}catch(error){onError(error.message);}};
  return <div className="pe-library" aria-label="Particle Library" aria-busy={disabled||!!openingName}>
    {(disabled||openingName)&&<div className="pe-library-loading" role="status">{openingName?'Opening '+openingName+'…':'Restoring your work…'}</div>}
    <ParticleThumbnailQueue items={!sourceContext&&(catalog.sourceStatus?.state==='ready'||collection!=='Warcraft')?visible:[]} preferences={preferences} onFailure={(id,error)=>setCatalog(old=>({...old,items:old.items.map(item=>item.id===id?{...item,previewError:error}:item)}))} onThumbnail={(id,url)=>setCatalog(old=>({...old,items:old.items.map(item=>item.id===id?{...item,thumbnail:url}:item)}))}/><header><strong>Particle Library</strong>{stock&&<div className="pe-browse-switch" role="group" aria-label="Browse effects">{['By type','World Editor'].map(name=><button key={name} aria-pressed={view===name} onClick={()=>{setView(name);navigate();}}>{name}</button>)}</div>}<button onClick={onClose} aria-label="Close Particle Library">×</button></header>
    <div className="pe-collections"><button onClick={()=>window.desktop.particleImport().then(load).catch(error=>onError(error.message))}>Import preset…</button>{['Warcraft','My presets','My work','Favorites'].map(name=><button key={name} aria-pressed={collection===name} onClick={()=>{setCollection(name);navigate();}}>{name}</button>)}</div>
    {(collection==='Warcraft'||world)&&catalog.sourceStatus?.message&&<p role="status">{catalog.sourceStatus.message}</p>}
    <div className="pe-library-search"><input aria-label="Find an effect" placeholder="Find an effect…" value={search} onChange={e=>{setSearch(e.target.value);navigate();}}/>{!world&&<select aria-label="Effect appearance" value={category} onChange={e=>{setCategory(e.target.value);setLimit(36);}}>{['All',...appearanceTypes].map(name=><option key={name}>{name}</option>)}</select>}</div>
    {world&&page&&<>
      {selected&&<div className="pe-origin-path"><button onClick={()=>navigate()}>Back</button><span>{page.title}</span></div>}
      <WorldRows rows={page.rows} searching={!!terms.length} limit={limit} onMore={()=>setLimit(value=>value+36)} onChoose={navigate}/>
    </>}
    {sections.filter(group=>group.items.length||group.empty).map(group=><section key={group.title}>
    {group.title&&<h3 className="pe-group-title">{group.title}</h3>}
    {group.empty&&<small>No indexed emitters.</small>}
    <div className="pe-library-grid">{group.items.map(item=><article key={item.id} data-effect-id={item.id}><button className="pe-effect-card" onClick={()=>choose(item)}><span className="pe-effect-thumb">{item.thumbnail?<img src={item.thumbnail} alt=""/>:<span aria-hidden="true" className="pe-thumbnail-pending">{item.empty?"+":"◇"}</span>}</span><span>{item.name}</span>{item.empty&&<small>Empty effect · undo or add</small>}{item.collection==='My work'&&<small>{new Date(item.updatedAt).toLocaleString(undefined,{dateStyle:'short',timeStyle:'short'})}</small>}{(item.blocked||item.unsupported?.length>0||item.previewError)&&<small>{item.blocked?'Unavailable':item.previewError?'Preview unavailable':'Incomplete preview'}</small>}</button><div><button aria-label={'Favorite '+item.name} aria-pressed={item.favorite} onClick={()=>favorite(item)}>{item.favorite?'★':'☆'}</button><button onClick={()=>setDetails(details===item.id?null:item.id)} aria-label={'Details for '+item.name}>Details</button></div>{details===item.id&&<div className="pe-effect-details"><div translate="no">{(item.sources||[]).map((source,i)=><p key={i}>{source.emitterName&&<strong>{source.emitterName} · </strong>}{source.physicalPath||source.logicalPath}</p>)}{item.aliases?.filter(alias=>!/[\\/:]/.test(alias)).join(', ')}</div>{item.blocked&&<p>{item.blocked.reason}</p>}{item.grouping&&<p>Source group: {item.grouping.kind}. Other source visuals are outside this particle group.</p>}{item.previewError&&<p>{item.previewError}</p>}{item.unsupported?.map((entry,i)=><p key={i}>{entry.reason||entry}</p>)}{!item.blocked&&item.sources?.some(source=>source.physicalPath)&&<button onClick={()=>setSourceContext(item)}>View source context</button>}<label>Name<input aria-label="Effect display name" defaultValue={item.name} onBlur={async event=>{if(event.target.value.trim()){await window.desktop.particleAnnotate({id:item.id,name:event.target.value});load();}}}/></label><label>Tags<input aria-label="Effect tags" defaultValue={(item.tags||[]).join(', ')} onBlur={async event=>{try{await window.desktop.particleAnnotate({id:item.id,tags:event.target.value.split(',').map(v=>v.trim()).filter(Boolean)});load();}catch(error){onError(error.message);}}}/></label><button disabled={!!item.blocked||item.empty} onClick={async()=>{try{await window.desktop.particleDuplicate(item.id);await load();}catch(error){onError(error.message);}}}>Duplicate</button><button disabled={!!item.blocked||item.empty} onClick={()=>window.desktop.particleExport(item.id).catch(error=>onError(error.message))}>Export preset</button>{item.collection==='My presets'&&<button onClick={async()=>{await window.desktop.particleRemove(item.id);load();}}>Delete</button>}</div>}</article>)}</div></section>)}
    {world&&!page&&!catalog.sourceStatus?.message&&<p role="status">{catalog.status?.browseError||catalog.status?.error||'Finding World Editor effects…'}</p>}
    {!visible.length&&!page?.rows.length&&!sections.some(group=>group.empty)&&(!world||page)&&!catalog.sourceStatus?.message&&<p>{stock?'No matching effects.':'No matching presets.'}</p>}
    {pageItems.length>limit&&<button onClick={()=>setLimit(value=>value+36)}>Show more</button>}
    {sourceContext&&<ParticleSourceContext item={sourceContext} onClose={()=>setSourceContext(null)}/>}
    <footer>{catalog.status?.running?<><span>{catalog.status.originsOnly?'Finding World Editor effects…':'Indexing '+catalog.status.processed+' / '+catalog.status.total}</span><button onClick={()=>window.desktop.particleCancel()}>Cancel scan</button></>:<button onClick={()=>window.desktop?.particleScan?.().then(load).catch(error=>onError(error.message))}>Index Warcraft assets</button>}{catalog.coverage&&<details><summary>Coverage · {catalog.coverage.recipes} recipes</summary><p>{catalog.coverage.parsedAssets} parsed / {catalog.coverage.candidateAssets} candidates · {catalog.coverage.failures} extraction exceptions · {catalog.coverage.reviewedNames} appearance names reviewed, {catalog.coverage.reviewNeededNames} still to review. Preview and placement validation are incomplete.</p></details>}</footer>
  </div>;
}
