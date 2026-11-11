import React,{useRef,useState} from 'react';
import {useWindowKeyClaim} from './Hotkeys.jsx';
import {PresetNameRow} from './PresetBar.jsx';
import {sanitizePresetName} from '../src/settings-presets.js';
import {NOT_A_LOOK,MAX_OWN_LOOK_BYTES,OWN_LOOK_ID} from '../src/fx-own-looks.js';
import './preset-bar.css';

/** Save as… / Load from… for the look on screen. `actions`: save(name) keeps it under a name, saveFile(name) writes a file, loadText(text) reads one; each returns the look (saveFile: whether it was written) or throws a short message. */
export default function FxLookBar({look,stack,actions}){
 const root=useRef(null),file=useRef(null),[naming,setNaming]=useState(false),[name,setName]=useState(''),[status,setStatus]=useState('');
 const desktopFiles=!!globalThis.desktop?.presetOpenFile,own=OWN_LOOK_ID.test(stack.look);
 const attempt=async action=>{try{await action();}catch(error){setStatus(error.message);}};
 const save=()=>attempt(()=>{const kept=actions.save(name);setStatus(`${kept.name} saved.`);setNaming(false);});
 const saveFile=()=>attempt(async()=>{const label=sanitizePresetName(name)||look.name;if(await actions.saveFile(label)){setStatus(`${label} saved to file.`);setNaming(false);}});
 const loadText=text=>attempt(()=>{const loaded=actions.loadText(text);setStatus(`${loaded.name} loaded.`);});
 const load=()=>{if(!desktopFiles){file.current?.click();return;}attempt(async()=>{const picked=await globalThis.desktop.presetOpenFile();if(picked)loadText(picked.text);});};
 const loadPicked=async event=>{const picked=event.target.files?.[0];event.target.value='';if(!picked)return;attempt(async()=>{if(picked.size>MAX_OWN_LOOK_BYTES*2)throw Error(NOT_A_LOOK);loadText(await picked.text());});};
 useWindowKeyClaim(({event,localWindow})=>{if(event.key!=='Escape'||!naming||(localWindow&&!localWindow.contains(root.current)))return false;setNaming(false);return true;},20);
 return <div className="preset-bar fx-look-bar" ref={root}>
  <div className="preset-bar-main">
   <button type="button" aria-expanded={naming} title="Keeps this look under a name, or writes it to a file to share." onClick={()=>{setName(own?look.name:'');setNaming(open=>!open);}}>Save as…</button>
   <button type="button" title="Opens a look file. It is added to My looks and used right away." onClick={load}>Load from…</button>
  </div>
  {!desktopFiles&&<input ref={file} className="preset-bar-file" type="file" accept=".mdlxl-preset,.json" aria-label="Look file" onChange={loadPicked}/>}
  {naming&&<PresetNameRow domain="fx" name={name} onName={setName} onSave={save} onSaveFile={saveFile} onClose={()=>setNaming(false)}/>}
  {status&&<div className="preset-bar-status" role="status">{status}</div>}
 </div>;
}
