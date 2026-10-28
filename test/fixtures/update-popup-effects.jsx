import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import useUpdates from '../../app/useUpdates.js';
import UpdatePrompt from '../../app/UpdatePrompt.jsx';

const release={version:'99.0.0',summary:['Preview update'],notes:{},url:'https://www.lowpolyworks.com/mdlxl'};
let broadcast;
window.desktop={updateStatus:async()=>({state:'available',currentVersion:'0.35.0',canInstall:false,release}),onUpdateStatus:callback=>{broadcast=callback;return()=>{};}};
window.updateStatus=value=>broadcast({state:'available',currentVersion:'0.35.0',canInstall:false,release,...value});
function Dialog({title,children,footer,onClose,...props}){return <div role="dialog" aria-label={title} className="update-overlay"><header><button onClick={onClose}>Close</button></header><main>{children}</main><footer>{footer}</footer></div>;}
function Fixture(){const [muted,setMuted]=useState(false),[revision,setRevision]=useState(0);const updates=useUpdates({disableSounds:muted});window.remountPopup=()=>setRevision(v=>v+1);return updates.open&&<UpdatePrompt key={revision} helmetEffects={updates.effects} status={updates.status} Dialog={Dialog} onInstall={()=>{}} onClose={updates.close} disableSounds={muted} onDisableSounds={setMuted}/>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
