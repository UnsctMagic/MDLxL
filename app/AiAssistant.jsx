import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import useMovableWindow from './useMovableWindow.js';
import './ai-assistant.css';
import {translate} from '../src/localization.js';

const providers=[['codex','Codex / ChatGPT'],['claude','Claude Code'],['openai','OpenAI API'],['anthropic','Claude API'],['compatible','Other AI / local model']];
const activity={mdlxl_context:'Inspecting the model',mdlxl_read:'Reading model data',mdlxl_script:'Working on the model',mdlxl_patch:'Applying a precise edit',mdlxl_select:'Selecting model elements',mdlxl_command:'Using an editor tool',mdlxl_view:'Inspecting a view',mdlxl_capture:'Checking the viewport',mdlxl_document:'Checking model files',mdlxl_help:'Reading MDLxL help',mdlxl_ui:'Using program controls'};
const readImage=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
function AiWindow({header,children}) {
  const panel=useRef(),move=useMovableWindow(panel);
  return <section ref={panel} className="ai-assistant" role="dialog" aria-modal="false" aria-label="AI assistant" style={move.style}>{React.cloneElement(header,move.handleProps)}{children}</section>;
}
export default function AiAssistant({bridge}) {
  const [open,setOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[settings,setSettings]=useState({provider:'codex',model:'',executable:'',baseUrl:''});
  const [apiKey,setApiKey]=useState(''),[models,setModels]=useState([]),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[authBusy,setAuthBusy]=useState(false);
  const [prompt,setPrompt]=useState(''),[images,setImages]=useState([]),[messages,setMessages]=useState([]),[external,setExternal]=useState(false);
  const [id,setId]=useState(()=>localStorage.getItem('mdlxl-ai-chat')||crypto.randomUUID());
  const scroll=useRef(),files=useRef(),activeId=useRef(id);
  activeId.current=id;
  useEffect(()=>{localStorage.setItem('mdlxl-ai-chat',id);},[id]);
  useEffect(()=>{
    if(!window.desktop?.aiStatus)return;
    window.desktop.aiStatus().then(value=>{setSettings(value);setExternal(value.enabled);return window.desktop.aiTranscript(activeId.current);}).then(setMessages).catch(reason=>setError(reason.message));
    return window.desktop.onAiEvent(event=>{
      if(event.id&&event.id!==activeId.current)return;
      if(event.type==='text')setMessages(previous=>{const list=[...previous],last=list.at(-1);if(last?.role==='assistant')list[list.length-1]={...last,text:last.text+event.text};else list.push({role:'assistant',text:event.text});return list;});
      if(event.type==='tool'||event.type==='external')setStatus(activity[event.name?.replace(/^mcp__mdlxl__/,'')]||'Using the editor');
      if(event.type==='external-done'&&!event.busy)setStatus('');
      if(event.type==='tool-result'&&event.error)setStatus('The AI is checking an editor error.');
      if(event.type==='notice'||event.type==='auth')setStatus(event.text);
      if(event.type==='error'){setError(event.text);setBusy(false);}
      if(event.type==='done'){setStatus('');setBusy(false);}
    });
  },[]);
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[messages,status]);
  const state=bridge.state(),vertexCount=Object.values(state.selection||{}).reduce((n,ids)=>n+ids.length,0),nodeCount=state.selectedNodeIds.length;
  const native=['codex','claude'].includes(settings.provider);
  async function saveSettings() {
    const value=await window.desktop.aiConfigure({...settings,apiKey});setSettings(value);setApiKey('');return value;
  }
  async function action(callback) {setError('');try{return await callback();}catch(reason){setError(reason.message);}}
  async function changeProvider(provider) {
    setAuthBusy(true);setError('');
    try {setSettings(await window.desktop.aiStatus(provider));setModels([]);setApiKey('');newChat();}
    catch(reason){setError(reason.message);}finally{setAuthBusy(false);}
  }
  function newChat(){if(busy)return;setId(crypto.randomUUID());setMessages([]);setStatus('');setError('');}
  async function send() {
    if(!prompt.trim()||busy||authBusy)return;
    const text=prompt,context=bridge.context(),attached=images.map(image=>image.data);
    setBusy(true);setPrompt('');setImages([]);setError('');setStatus('Connecting…');
    setMessages(previous=>[...previous,{role:'user',text,document:context.name,selection:context.selection},{role:'assistant',text:''}]);
    try {await saveSettings();await window.desktop.aiSend({id,text,images:attached,context});}
    catch(reason){setError(reason.message);}
    finally{setBusy(false);setStatus('');}
  }
  async function authenticate(authAction) {
    setAuthBusy(true);setError('');
    try {await saveSettings();const result=await window.desktop.aiAuth(authAction);setStatus(result.account||result.loggedIn?'Signed in.':'Not signed in.');}
    catch(reason){setError(reason.message);}finally{setAuthBusy(false);}
  }
  async function loadModels() {
    setAuthBusy(true);setError('');
    try{await saveSettings();setModels(await window.desktop.aiModels());setStatus('Available models loaded.');}
    catch(reason){setError(reason.message);}finally{setAuthBusy(false);}
  }
  async function attach(list) {
    for(const file of list) {
      if(/\.(mdl|mdx)$/i.test(file.name)) {await bridge.host().addReference({name:file.name,path:window.desktop?.droppedPath(file)||null,bytes:new Uint8Array(await file.arrayBuffer())});setStatus('Reference model added.');}
      else if(['image/png','image/jpeg','image/webp'].includes(file.type)) {
        if(file.size>9*1024*1024)throw Error('Each image must be under 9 MB.');
        const data=await readImage(file);setImages(previous=>{if(previous.length>=4)return previous;return [...previous,{name:file.name,data}];});
      } else throw Error('Choose MDL, MDX, PNG, JPEG or WebP files.');
    }
  }
  return <>
    <button type="button" className="ai-open" aria-label="AI assistant" title="Use prompts to edit the model or ask how to use MDLxL" aria-pressed={open} onClick={()=>setOpen(value=>!value)}>AI{busy?' ·':''}</button>
    {open&&createPortal(<AiWindow header={<header><strong>AI assistant</strong><button type="button" title="Connection settings" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(value=>!value)}>Connection</button><button type="button" aria-label="Close AI assistant" onClick={()=>setOpen(false)}>×</button></header>}>
      {!window.desktop?.aiSend?<p>The AI connection is available in the desktop app.</p>:<>
        {settingsOpen&&<div className="ai-connection">
          <label>AI provider<select aria-label="AI provider" value={settings.provider} disabled={busy||authBusy} onChange={event=>changeProvider(event.target.value)}>{providers.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          {native?<><label>CLI executable (optional)<input value={settings.executable||''} disabled={busy||authBusy} placeholder={settings.provider+'.exe'} onChange={event=>setSettings(previous=>({...previous,executable:event.target.value}))}/></label><div className="ai-row"><button disabled={busy||authBusy} onClick={()=>authenticate('login')}>Sign in</button><button disabled={busy||authBusy} onClick={()=>authenticate('status')}>Check sign-in</button><button disabled={busy||authBusy} onClick={()=>authenticate('logout')}>Sign out</button>{authBusy&&<button onClick={()=>window.desktop.aiCancel()}>Cancel</button>}</div></>:<label>API key<input type="password" autoComplete="off" value={apiKey} placeholder={settings.hasKey?'Saved securely':''} onChange={event=>setApiKey(event.target.value)}/></label>}
          {settings.provider==='compatible'&&<label>API base URL<input value={settings.baseUrl||''} placeholder="http://localhost:1234/v1" onChange={event=>setSettings(previous=>({...previous,baseUrl:event.target.value}))}/></label>}
          <label>Model<input aria-label="Model" list="mdlxl-ai-models" value={settings.model||''} placeholder={native?'Provider default':'Choose or enter a model ID'} onChange={event=>setSettings(previous=>({...previous,model:event.target.value}))}/><datalist id="mdlxl-ai-models">{models.map(model=><option key={model.id} value={model.id}>{model.name}</option>)}</datalist></label>
          <div className="ai-row"><button disabled={busy||authBusy} onClick={()=>action(async()=>{await saveSettings();setStatus('Connection saved.');})}>Save connection</button><button disabled={busy||authBusy||settings.provider==='claude'} onClick={loadModels}>Load models</button></div>
          <details><summary>Connect another AI</summary><p>Connect any local AI client that supports MCP to the same editor tools.</p><div className="ai-row"><button onClick={()=>action(async()=>{const value=await window.desktop.aiEnable(!external);setExternal(value.enabled);})}>{external?'Disable connection':'Enable connection'}</button><button disabled={!external} onClick={()=>action(async()=>{await navigator.clipboard.writeText(JSON.stringify(await window.desktop.aiConfig(),null,2));setStatus('MCP connection copied.');})}>Copy connection JSON</button></div></details>
        </div>}
        <div className="ai-target" title="The model and selection are captured when you send the prompt."><b translate="no">{state.doc.name}</b><span translate="no">{translate(`${vertexCount} vertices · ${nodeCount} nodes`)}{state.sequence>=0?` · ${state.model.Sequences[state.sequence]?.Name} @ ${Math.round(state.time)}`:''}</span></div>
        <div className="ai-messages" ref={scroll} role="log" aria-live="polite">{messages.length?messages.map((message,index)=><article key={index} className={'ai-message ai-role-'+message.role}><b>{message.role==='user'?'You':providers.find(p=>p[0]===settings.provider)?.[1]||'AI'}</b><div translate="no">{message.text}</div>{message.error&&<p role="alert">{message.error}</p>}</article>):<p>Mark part of the model and describe what you want. You can also ask how to use a tool, add reference models, or attach images.</p>}</div>
        {status&&<div className="ai-status" role="status">{status}</div>}{error&&<div className="ai-error" role="alert">{error}</div>}
        {images.length>0&&<div className="ai-images">{images.map((image,index)=><button key={index} title="Remove attached image" onClick={()=>setImages(previous=>previous.filter((_,i)=>i!==index))}><img src={image.data} alt={image.name}/>×</button>)}</div>}
        <textarea aria-label="AI prompt" placeholder="Mirror these vertices to the other side and weld the seam…" value={prompt} onChange={event=>setPrompt(event.target.value)} onPaste={event=>{const files=[...event.clipboardData.files];if(files.length){event.preventDefault();action(()=>attach(files));}}} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send();}}}/>
        <footer><button disabled={busy||authBusy} onClick={newChat}>New chat</button><button disabled={busy} title="Attach reference models or images" onClick={()=>files.current.click()}>Attach</button><input ref={files} type="file" hidden multiple accept=".mdl,.mdx,.png,.jpg,.jpeg,.webp" onChange={event=>{const selected=[...event.target.files];event.target.value='';action(()=>attach(selected));}}/>{busy?<button onClick={()=>window.desktop.aiCancel()}>Stop</button>:<button disabled={!prompt.trim()||authBusy} onClick={send}>Send</button>}</footer>
      </>}
    </AiWindow>,document.body)}
  </>;
}
