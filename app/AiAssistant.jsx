import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUp,Box,Check,ChevronDown,LogIn,MessageSquarePlus,Paperclip,Plug,Settings2,Square,X} from 'lucide-react';
import AiMessage from './AiMessage.jsx';
import useMovableWindow from './useMovableWindow.js';
import './ai-assistant.css';
import {translate} from '../src/localization.js';

const providers=[['codex','Codex / ChatGPT'],['claude','Claude Code'],['openai','OpenAI API'],['anthropic','Claude API'],['compatible','Other AI / local model']];
const activity={mdlxl_context:'Inspecting the model',mdlxl_capabilities:'Reading MDLxL help',mdlxl_sample:'Inspecting the model',mdlxl_assets:'Checking model files',mdlxl_read:'Reading model data',mdlxl_script:'Working on the model',mdlxl_patch:'Applying a precise edit',mdlxl_select:'Selecting model elements',mdlxl_command:'Using an editor tool',mdlxl_view:'Inspecting a view',mdlxl_capture:'Checking the viewport',mdlxl_document:'Checking model files',mdlxl_help:'Reading MDLxL help',mdlxl_ui:'Using program controls'};
const phases={inspecting:'Inspecting the model',editing:'Working on the model',verifying:'Verifying the result',correcting:'Correcting the result',verified:'Result verified',complete:'Task complete'};
const readImage=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
function AiWindow({header,children}) {
  const panel=useRef(),move=useMovableWindow(panel);
  return <section ref={panel} className="ai-assistant" role="dialog" aria-modal="false" aria-label="AI assistant" style={move.style}>{React.cloneElement(header,move.handleProps)}{children}</section>;
}
export default function AiAssistant({bridge}) {
  const [open,setOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[settings,setSettings]=useState({provider:'codex',model:'',executable:'',baseUrl:''});
  const [apiKey,setApiKey]=useState(''),[models,setModels]=useState([]),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[authBusy,setAuthBusy]=useState(false);
  const [signedIn,setSignedIn]=useState(null);
  const [task,setTask]=useState(null),[awarenessBusy,setAwarenessBusy]=useState(false);
  const [prompt,setPrompt]=useState(''),[images,setImages]=useState([]),[messages,setMessages]=useState([]),[external,setExternal]=useState(false);
  const [id,setId]=useState(()=>localStorage.getItem('mdlxl-ai-chat')||crypto.randomUUID());
  const scroll=useRef(),files=useRef(),activeId=useRef(id);
  activeId.current=id;
  useEffect(()=>{localStorage.setItem('mdlxl-ai-chat',id);},[id]);
  useEffect(()=>{
    if(!window.desktop?.aiStatus)return;
    window.desktop.aiStatus().then(async value=>{setSettings(value);setExternal(value.enabled);const [messages,task]=await Promise.all([window.desktop.aiTranscript(activeId.current),window.desktop.aiTask(activeId.current)]);setMessages(messages);setTask(task);}).catch(reason=>setError(reason.message));
    return window.desktop.onAiEvent(event=>{
      if(event.id&&event.id!==activeId.current)return;
      if(event.type==='text')setMessages(previous=>{const list=[...previous],last=list.at(-1);if(last?.role==='assistant')list[list.length-1]={...last,text:last.text+event.text};else list.push({role:'assistant',text:event.text});return list;});
      if(event.type==='tool'||event.type==='external')setStatus(activity[event.name?.replace(/^mcp__mdlxl__/,'')]||'Using the editor');
      if(event.type==='external-done'&&!event.busy)setStatus('');
      if(event.type==='tool-result'&&event.error)setStatus('The AI is checking an editor error.');
      if(event.type==='notice'||event.type==='auth')setStatus(event.text);
      if(event.type==='error'){setError(event.text);setBusy(false);if(event.authRequired){setSignedIn(false);setSettingsOpen(true);}}
      if(event.type==='done'){setStatus('');setBusy(false);}
      if(event.type==='awareness')setSettings(previous=>({...previous,awareness:event.enabled}));
      if(event.type==='task'){setTask(event.task);if(event.task?.status==='running')setStatus(phases[event.task.phase]||'Working on the model');}
    });
  },[]);
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[messages,status]);
  const summary=open?bridge.summary():null;
  const native=['codex','claude'].includes(settings.provider);
  const providerName=providers.find(p=>p[0]===settings.provider)?.[1]||'AI';
  async function saveSettings() {
    const value=await window.desktop.aiConfigure({...settings,apiKey});setSettings(value);setApiKey('');return value;
  }
  async function action(callback) {setError('');try{return await callback();}catch(reason){setError(reason.message);}}
  async function changeProvider(provider) {
    setAuthBusy(true);setError('');
    try {setSettings(await window.desktop.aiStatus(provider));setModels([]);setApiKey('');setSignedIn(null);newChat();}
    catch(reason){setError(reason.message);}finally{setAuthBusy(false);setStatus('');}
  }
  function newChat(){if(busy)return;setId(crypto.randomUUID());setMessages([]);setTask(null);setStatus('');setError('');}
  async function send(resumeTask=false) {
    const resume=resumeTask===true;
    if(!resume&&!prompt.trim()||busy||authBusy)return;
    if(native&&signedIn===false){await authenticate('login');return;}
    const text=prompt,attached=images;
    setBusy(true);setError('');setStatus('Connecting…');
    try {
      await saveSettings();
      if(native){const auth=await window.desktop.aiAuth('status');setSignedIn(auth.loggedIn);if(!auth.loggedIn){setSettingsOpen(true);return;}}
      const context=bridge.context();if(!resume){setPrompt('');setImages([]);}
      setMessages(previous=>[...previous,{role:'user',text:resume?'Resume task':text,document:context.name,selection:context.selection},{role:'assistant',text:''}]);
      const result=await window.desktop.aiSend({id,text,images:attached.map(image=>image.data),context,resume});
      if(result.authRequired){setSignedIn(false);setSettingsOpen(true);if(!resume){setPrompt(text);setImages(attached);}setMessages(await window.desktop.aiTranscript(id));}
    }
    catch(reason){setError(reason.message);}
    finally{setBusy(false);setStatus('');}
  }
  async function authenticate(authAction) {
    setAuthBusy(true);setError('');
    try {await saveSettings();const result=await window.desktop.aiAuth(authAction);setSignedIn(!!result.loggedIn);setStatus('');if(!result.loggedIn)setSettingsOpen(true);else if(settings.provider==='codex'&&!models.length)setModels(await window.desktop.aiModels());}
    catch(reason){setError(reason.message);setSettingsOpen(true);}finally{setAuthBusy(false);setStatus('');}
  }
  function toggleOpen(){setOpen(!open);if(!open&&!busy&&!authBusy&&native&&window.desktop?.aiAuth)authenticate('status');}
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
    <button type="button" className="ai-open" aria-label="AI assistant" title="Use prompts to edit the model or ask how to use MDLxL" aria-pressed={open} onClick={toggleOpen}>AI{busy?' ·':''}</button>
    {open&&createPortal(<AiWindow header={<header className="ai-heading"><span className="ai-emblem"><Box size={18} aria-hidden="true"/></span><strong>AI assistant</strong><button type="button" className="ai-icon-button" aria-label="New chat" title="New chat" disabled={busy||authBusy} onClick={newChat}><MessageSquarePlus size={16} aria-hidden="true"/></button><button type="button" className="ai-icon-button" aria-label="Connection settings" title="Connection settings" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(value=>!value)}><Settings2 size={16} aria-hidden="true"/></button><button type="button" className="ai-icon-button" aria-label="Close AI assistant" title="Close AI assistant" onClick={()=>setOpen(false)}><X size={16} aria-hidden="true"/></button></header>}>
      {!window.desktop?.aiSend?<p>The AI connection is available in the desktop app.</p>:<>
        <div className="ai-provider-bar"><button className="ai-provider-name" title="AI provider" onClick={()=>setSettingsOpen(value=>!value)}><Plug size={13} aria-hidden="true"/><span translate="no">{providerName}</span><ChevronDown size={12} aria-hidden="true"/></button><select aria-label="Chat model" title="Model" value={settings.model||''} disabled={busy||authBusy} onChange={event=>action(async()=>{const value=await window.desktop.aiConfigure({...settings,model:event.target.value,apiKey});setSettings(value);setApiKey('');})}><option value="">Provider default</option>{settings.model&&!models.some(model=>model.id===settings.model)&&<option value={settings.model} translate="no">{settings.model}</option>}{models.map(model=><option key={model.id} value={model.id} translate="no">{model.name}</option>)}</select></div>
        {settingsOpen&&<div className="ai-connection">
          <label>AI provider<select aria-label="AI provider" value={settings.provider} disabled={busy||authBusy} onChange={event=>changeProvider(event.target.value)}>{providers.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          {native?<div className="ai-row"><button className={signedIn?'':'ai-primary'} disabled={busy||authBusy} onClick={()=>authenticate('login')}><LogIn size={14} aria-hidden="true"/>Sign in</button><button disabled={busy||authBusy} onClick={()=>authenticate('status')}>Check sign-in</button><button disabled={busy||authBusy} onClick={()=>authenticate('logout')}>Sign out</button>{authBusy&&<button onClick={()=>window.desktop.aiCancel()}>Cancel</button>}</div>:<label>API key<input type="password" autoComplete="off" value={apiKey} placeholder={settings.hasKey?'Saved securely':''} onChange={event=>setApiKey(event.target.value)}/></label>}
          {settings.provider==='compatible'&&<label>API base URL<input value={settings.baseUrl||''} placeholder="http://localhost:1234/v1" onChange={event=>setSettings(previous=>({...previous,baseUrl:event.target.value}))}/></label>}
          <label>Model<input aria-label="Model" list="mdlxl-ai-models" value={settings.model||''} placeholder={native?'Provider default':'Choose or enter a model ID'} onChange={event=>setSettings(previous=>({...previous,model:event.target.value}))}/><datalist id="mdlxl-ai-models">{models.map(model=><option key={model.id} value={model.id}>{model.name}</option>)}</datalist></label>
          <div className="ai-row"><button disabled={busy||authBusy} onClick={()=>action(async()=>{await saveSettings();setStatus('Connection saved.');})}>Save connection</button><button disabled={busy||authBusy||settings.provider==='claude'} onClick={loadModels}>Load models</button></div>
          {native&&<details><summary>Advanced connection</summary><label>CLI executable (optional)<input value={settings.executable||''} disabled={busy||authBusy} placeholder={settings.provider+'.exe'} onChange={event=>setSettings(previous=>({...previous,executable:event.target.value}))}/></label></details>}
          <details><summary>Connect another AI</summary><p>Connect any local AI client that supports MCP to the same editor tools.</p><div className="ai-row"><button onClick={()=>action(async()=>{const value=await window.desktop.aiEnable(!external);setExternal(value.enabled);})}>{external?'Disable connection':'Enable connection'}</button><button disabled={!external} onClick={()=>action(async()=>{await navigator.clipboard.writeText(JSON.stringify(await window.desktop.aiConfig(),null,2));setStatus('MCP connection copied.');})}>Copy connection JSON</button></div></details>
        </div>}
        <div className="ai-target" title="The model and selection are captured when you send the prompt."><div><Box size={13} aria-hidden="true"/><b translate="no">{summary.name}</b></div><span translate="no">{translate(`${summary.vertices} vertices · ${summary.nodes} nodes`)}{summary.sequenceName!=null?` · ${summary.sequenceName} @ ${Math.round(summary.time)}`:''}</span></div>
        <div className="ai-awareness"><label title="Share live model, selection, camera and timeline changes with the connected AI. Does not start AI requests by itself. Turning it off stops future updates; previously shared context remains in the conversation."><input type="checkbox" role="switch" aria-label="Continuous awareness" checked={!!settings.awareness} disabled={awarenessBusy} onChange={async event=>{const enabled=event.target.checked;setAwarenessBusy(true);setSettings(previous=>({...previous,awareness:enabled}));setError('');try{await window.desktop.aiAwareness(enabled);}catch(reason){setSettings(previous=>({...previous,awareness:!enabled}));setError(reason.message);}finally{setAwarenessBusy(false);}}}/>Continuous awareness</label>{task?.status==='complete'&&<span>{task.phase==='verified'?'Result verified':'Task complete'}</span>}</div>
        <div className="ai-messages" ref={scroll} role="log" aria-live="polite">{messages.length?messages.map((message,index)=><article key={index} className={'ai-message ai-role-'+message.role}><b className="ai-author">{message.role==='user'?'You':providerName}</b>{message.role==='assistant'?<AiMessage text={message.text}/>:<div className="ai-user-text" translate="no">{message.text}</div>}{message.error&&<p role="alert">{message.error}</p>}</article>):<div className="ai-empty"><span className="ai-empty-icon"><Box size={28} aria-hidden="true"/></span><h3>Work on your selection</h3><p>Mark part of the model and describe what you want. You can also ask how to use a tool, add reference models, or attach images.</p></div>}</div>
        {native&&signedIn!==null&&<div className={'ai-account'+(signedIn?' ai-connected':'')} role="status">{signedIn&&<Check size={12} aria-hidden="true"/>}{signedIn?'Signed in.':'Sign in to connect your AI. Your prompt has been kept.'}</div>}
        {status&&<div className="ai-status" role="status">{status}</div>}{error&&<div className="ai-error" role="alert">{error}</div>}
        {task?.canResume&&!busy&&<div className="ai-resume"><span>Task paused. Applied edits are kept.</span><button disabled={authBusy} onClick={()=>send(true)}>Resume task</button></div>}
        <div className="ai-composer">
        {images.length>0&&<div className="ai-images">{images.map((image,index)=><button key={index} title="Remove attached image" onClick={()=>setImages(previous=>previous.filter((_,i)=>i!==index))}><img src={image.data} alt={image.name}/>×</button>)}</div>}
        <textarea aria-label="AI prompt" placeholder="Mirror these vertices to the other side and weld the seam…" value={prompt} onChange={event=>setPrompt(event.target.value)} onPaste={event=>{const files=[...event.clipboardData.files];if(files.length){event.preventDefault();action(()=>attach(files));}}} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send();}}}/>
        <footer><button className="ai-attach" disabled={busy||authBusy} title="Attach reference models or images" onClick={()=>files.current.click()}><Paperclip size={15} aria-hidden="true"/>Attach</button><span className="ai-key-hint">Enter to send</span><input ref={files} type="file" hidden multiple accept=".mdl,.mdx,.png,.jpg,.jpeg,.webp" onChange={event=>{const selected=[...event.target.files];event.target.value='';action(()=>attach(selected));}}/>{busy?<button onClick={()=>window.desktop.aiCancel()}><Square size={12} aria-hidden="true"/>Stop</button>:<button className="ai-primary" disabled={!prompt.trim()||authBusy} onClick={send}>{native&&signedIn===false?<LogIn size={14} aria-hidden="true"/>:<ArrowUp size={15} aria-hidden="true"/>}{native&&signedIn===false?'Sign in to send':'Send'}</button>}</footer>
        </div>
      </>}
    </AiWindow>,document.body)}
  </>;
}
