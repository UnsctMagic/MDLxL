import React,{useState,useEffect,useRef,useCallback} from 'react';
import {Plus,Trash2,Diamond,ChevronDown} from 'lucide-react';
import {setKey} from '../src/editor-commands.js';
import {displayNumber} from '../src/display-number.js';
const draftText=value=>value??'';
/** A finite number from the typed text; an empty box or other text is rejected. */
export function parseDraftNumber(text){const trimmed=String(text??'').trim();if(!trimmed)return undefined;const number=Number(trimmed);return Number.isFinite(number)?number:undefined;}
/**
 * The one way a typed field commits: the box keeps its own text while typing and commits
 * once, on Enter or on leaving the box; Escape puts the current value back.
 * format(value) is the text shown. parse(text, final) returns the value to commit, or
 * undefined to reject the text (the box then shows the value again). live also commits
 * each valid keystroke (final is false then) and keeps the typed text while focused.
 * onCommit may return false, or a promise of false, to refuse the value.
 * Returns the props for the <input>.
 */
export function useDraftNumber({value,format=draftText,parse=parseDraftNumber,onCommit,live=false,disabled=false}){
  const [draft,setDraft]=useState(()=>format(value));
  const latest=useRef(null),skipBlur=useRef(false),focused=useRef(false),emitted=useRef(value);
  latest.current={value,format,parse,onCommit,disabled};
  // A live box keeps "4" while "48" is typed: its own change does not rewrite the text.
  useEffect(()=>{if(!(live&&focused.current&&Object.is(value,emitted.current)))setDraft(format(value));emitted.current=value;},[value]);
  const shown=()=>latest.current.format(latest.current.value);
  const commit=text=>{
    const {parse,onCommit,disabled,format}=latest.current;
    if(disabled){setDraft(shown());return;}
    const next=parse(text,true);
    if(next===undefined){setDraft(shown());return;}
    if(Object.is(next,parse(shown(),true))){setDraft(format(next));return;}
    emitted.current=next;
    const settle=accepted=>setDraft(accepted===false?shown():format(next));
    const result=onCommit(next);
    if(typeof result?.then==='function')result.then(settle,()=>setDraft(shown()));else settle(result);
  };
  return {
    value:draft,
    onFocus:()=>{focused.current=true;},
    onChange:event=>{
      const text=event.target.value;setDraft(text);
      if(!live||latest.current.disabled)return;
      const next=latest.current.parse(text,false);
      if(next!==undefined&&!Object.is(next,emitted.current)){emitted.current=next;latest.current.onCommit(next);}
    },
    onBlur:event=>{focused.current=false;if(skipBlur.current){skipBlur.current=false;return;}commit(event.currentTarget.value);},
    onKeyDown:event=>{
      if(event.key==='Enter'){commit(event.currentTarget.value);skipBlur.current=true;event.currentTarget.blur();}
      else if(event.key==='Escape'){skipBlur.current=true;setDraft(shown());event.currentTarget.blur();}
    },
  };
}
export function TextField({label,value,onChange,type='text',min,max,step='any',disabled=false}){
  const number=type==='number';
  const field=useDraftNumber({value,disabled,onCommit:onChange,parse:(text,final)=>{
    if(!number)return text;
    const next=parseDraftNumber(text);
    return next===undefined||(Number(step)===1&&!Number.isInteger(next))||(min!==undefined&&next<min)||(max!==undefined&&next>max)?undefined:next;
  }});
  return <label className="field"><span>{label}</span><input data-hotkey={`field:${label}`} data-hotkey-label={`Focus ${label}`} aria-label={label} disabled={disabled} type={type} min={min} max={max} step={step} {...field}/></label>;
}
export function NumberField(props){return <TextField type="number" {...props}/>;}
/**
 * One edit per slider drag: the slider moves a draft and commits once on release
 * (the native change event, also sent per arrow-key step) or on leaving the slider.
 * Escape drops the draft. onDraft(value or null) lets a caller preview the drag.
 * Returns the range input's props, including ref and the shown value.
 */
export function useRangeCommit({value,onCommit,onDraft}){
  const [draft,setDraftState]=useState(null),pending=useRef(null),latest=useRef(null),element=useRef(null);
  latest.current={value,onCommit,onDraft};
  const setDraft=next=>{pending.current=next;setDraftState(next);latest.current.onDraft?.(next);};
  const finish=useRef(()=>{const next=pending.current;if(next===null)return;setDraft(null);if(!Object.is(next,latest.current.value))latest.current.onCommit(next);}).current;
  // React's onChange is the input event; the native change event is the release.
  const ref=useCallback(node=>{element.current?.removeEventListener('change',finish);element.current=node;node?.addEventListener('change',finish);},[finish]);
  return {
    ref,value:draft??value,
    onChange:event=>setDraft(Number(event.target.value)),
    onBlur:finish,
    onKeyDown:event=>{if(event.key==='Escape'&&pending.current!==null){event.preventDefault();event.stopPropagation();setDraft(null);}},
  };
}
/**
 * A slider in the one shared look: label and value above, the slider below, optional
 * words under its two ends. onChange makes it live; onCommit makes one edit per drag
 * (onDraft previews the drag). output may be a function of the shown value. children
 * sit beside the value (for example a number box). Without label or output there is no
 * top row. inputProps go to the range input.
 */
export function RangeField({label,value,min,max,step,output,ends,className='',title,onChange,onCommit,onDraft,disabled,children,inputProps,'aria-label':ariaLabel}){
  const committed=useRangeCommit({value,onCommit:next=>onCommit?.(next),onDraft});
  const range=onCommit?committed:{value,onChange:event=>onChange?.(Number(event.target.value))};
  const shown=onCommit?committed.value:value,head=label!=null||output!==undefined||children;
  return <label className={`range-field${className?' '+className:''}`} title={title}>
    {head&&<span className="range-field-head"><span>{label}</span>{output!==undefined&&<output>{typeof output==='function'?output(shown):output}</output>}{children}</span>}
    <input className="range-input" type="range" min={min} max={max} step={step} disabled={disabled} aria-label={ariaLabel??(typeof label==='string'?label:undefined)} {...inputProps} {...range}/>
    {ends&&<span className="range-field-ends"><span>{ends[0]}</span><span>{ends[1]}</span></span>}
  </label>;
}
export function SelectField({label,value,onChange,options,disabled=false}){return <label className="field"><span>{label}</span><select data-hotkey={`field:${label}`} data-hotkey-label={`Focus ${label}`} aria-label={label} disabled={disabled} value={value??''} onChange={e=>onChange(e.target.value)}>{options.map(o=>typeof o==='string'?<option key={o}>{o}</option>:<option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;}
export function Check({label,value,onChange}){return <label className="check"><input data-hotkey={`toggle:${label}`} data-hotkey-label={`Toggle ${label}`} aria-label={label} type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)}/><span>{label}</span></label>;}
export function VectorField({label,value,onChange,size=3,min,max,step='any'}){return <div data-hotkey-prefix={label} className="vector-field"><span>{label}</span><div>{Array.from({length:size},(_,i)=><NumberField key={i} label={['X','Y','Z','W'][i]} value={value?.[i]??0} min={min} max={max} step={step} onChange={v=>{const a=Array.from(value||new Float32Array(size));a[i]=v;onChange(a);}}/>)}</div></div>;}
export function Section({title,children,actions,open=true,hotkeyId}){return <details data-hotkey-prefix={hotkeyId || title} className="inspector-section" open={open}><summary data-hotkey="expand" data-hotkey-label={`Expand or collapse ${hotkeyId || title}`}><ChevronDown size={13}/>{title}<span className="spacer"/>{actions}</summary><div className="section-body">{children}</div></details>;}
export function TrackEditor({label,value,onChange,dimensions=1,frame=0,globalSequences=[],defaultValue=0,integer=false,onlyAnimated=false}){
  const track=value?.Keys?value:null;
  const [expanded,setExpanded]=useState(false);const [keyFrame,setKeyFrame]=useState(Math.round(frame));const [keyValue,setKeyValue]=useState(Array.isArray(defaultValue)?defaultValue.join(', '):String(defaultValue));
  const [error,setError]=useState('');
  const commitTrack=fn=>{const t=structuredClone(track);fn(t);onChange(t);};
  const parse=s=>{const a=s.split(/[\s,]+/).filter(Boolean).map(Number);if(a.length!==dimensions||a.some(n=>!Number.isFinite(n)))throw new Error(`Enter ${dimensions} numeric value${dimensions>1?'s':''}.`);if(integer&&a.some(n=>!Number.isInteger(n)))throw new Error('Values must be integers.');return a;};
  const add=()=>{try{const holder={value:track?structuredClone(track):undefined};setKey(holder,'value',Number(keyFrame),parse(keyValue));onChange(holder.value);setError('');}catch(e){setError(e.message);}};
  return <div data-hotkey-prefix={label} className="track-field"><div className="track-heading"><span>{label}</span>{track?<button data-hotkey="fields:action:1" onClick={()=>setExpanded(!expanded)} className="track-badge"><Diamond size={11}/>{track.Keys.length} keys</button>:<button data-hotkey="fields:action:2" className="subtle tiny" title={'Animate '+label} onClick={()=>{const v=dimensions===1?[Number(value??defaultValue)]:Array.from(value||defaultValue);onChange({LineType:1,Keys:[{Frame:Math.round(frame),Vector:new Float32Array(v)}]});setExpanded(true);}}><Diamond size={12}/>Animate</button>}</div>
  {!track&&!onlyAnimated&&(dimensions===1?<NumberField label="Value" value={typeof value==='number'?value:defaultValue} step={integer?1:'any'} onChange={onChange}/>:<VectorField label="Value" size={dimensions} value={value||defaultValue} onChange={v=>onChange(new Float32Array(v))}/>)}
  {track&&expanded&&<div className="track-editor"><SelectField label="Interpolation" value={track.LineType} options={['Step','Linear','Hermite','Bezier'].map((label,value)=>({label,value}))} onChange={v=>commitTrack(t=>{t.LineType=Number(v);if(t.LineType>=2)for(const k of t.Keys){k.InTan??=new Float32Array(k.Vector);k.OutTan??=new Float32Array(k.Vector);}else for(const k of t.Keys){delete k.InTan;delete k.OutTan;}})}/>
  <SelectField label="Global sequence" value={track.GlobalSeqId??-1} options={[{label:'Local sequence',value:-1},...globalSequences.map((d,i)=>({label:`Global ${displayNumber(i)} · ${d} ms`,value:i}))]} onChange={v=>commitTrack(t=>{if(Number(v)<0)delete t.GlobalSeqId;else t.GlobalSeqId=Number(v);})}/>
  <div className="key-list">{track.Keys.map((k,i)=><div data-hotkey-prefix={`key:${k.Frame}`} className="key-row" key={i}><NumberField label="Time" min={0} step={1} value={k.Frame} onChange={v=>{if(track.Keys.some((o,j)=>j!==i&&o.Frame===v)){setError('A key already exists at that time.');return;}commitTrack(t=>{t.Keys[i].Frame=v;t.Keys.sort((a,b)=>a.Frame-b.Frame);});}}/><TextField label="Value" value={Array.from(k.Vector).map(n=>Number(n.toFixed(5))).join(', ')} onChange={v=>{try{const a=parse(v);commitTrack(t=>t.Keys[i].Vector=integer?new Int32Array(a):new Float32Array(a));setError('');}catch(e){setError(e.message);}}}/><button data-hotkey="fields:action:3" className="icon danger" aria-label={'Delete key '+k.Frame} onClick={()=>commitTrack(t=>t.Keys.splice(i,1))}><Trash2 size={12}/></button>{track.LineType>=2&&<div className="tangents">{['InTan','OutTan'].map(p=><TextField key={p} label={p==='InTan'?'In tangent':'Out tangent'} value={Array.from(k[p]||k.Vector).join(', ')} onChange={v=>{try{const a=parse(v);commitTrack(t=>t.Keys[i][p]=new Float32Array(a));setError('');}catch(e){setError(e.message);}}}/>)}</div>}</div>)}</div>
  <div className="new-key"><NumberField label="New time" min={0} step={1} value={keyFrame} onChange={setKeyFrame}/><button data-hotkey="fields:action:4" className="subtle tiny" onClick={()=>setKeyFrame(Math.round(frame))}>Use playhead</button></div><TextField label="New value" value={keyValue} onChange={setKeyValue}/><button data-hotkey="fields:action:5" className="wide subtle" onClick={add}><Plus size={13}/>Set key</button>
  {!onlyAnimated&&<button data-hotkey="fields:action:6" className="subtle tiny" onClick={()=>{const v=track.Keys[0]?.Vector;onChange(dimensions===1?(v?.[0]??0):new Float32Array(v||defaultValue));}}>Convert to static (first key)</button>}
  {error&&<p className="field-error">{error}</p>}</div>}
  </div>;
}
