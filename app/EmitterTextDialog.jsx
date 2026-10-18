import React,{useMemo,useRef,useState} from 'react';
import {emitterMdlText,parseEmitterMdlText,applyEmitterNode} from '../src/emitter-text.js';
import {mdlHoverPieces} from '../src/mdl-glossary.js';

const TAB=4;
/** Each explained piece as line and column ranges, with tabs expanded the way the editor shows them. */
function hoverIndex(pieces){
 const lines=[[]];let line=0,column=0;
 for(const piece of pieces){
  const from=column,fromLine=line;
  for(const c of piece.text){if(c==='\n'){line++;column=0;lines[line]=[];}else column=c==='\t'?(Math.floor(column/TAB)+1)*TAB:column+1;}
  if(piece.tip&&line===fromLine)lines[line].push({from,to:column,tip:piece.tip});
 }
 return lines;
}

/**
 * Adjust Manually: the exact MDL text this emitter saves as, read back with the model's own MDL reader.
 * The text uses a fixed-width font, so the word under the mouse follows from its line and column.
 */
export default function EmitterTextDialog({doc,id,onEdit,onClose}){
 const original=useMemo(()=>{try{return emitterMdlText(doc,id);}catch(error){return null;}},[doc,id]);
 const [text,setText]=useState(original?.block||''),[error,setError]=useState(original?'':'The emitter text could not be read.'),[tip,setTip]=useState(null);
 const mirror=useRef(null),pieces=useMemo(()=>mdlHoverPieces(text,original?.family),[text,original?.family]),index=useMemo(()=>hoverIndex(pieces),[pieces]);
 const apply=()=>{
  try{const parsed=parseEmitterMdlText(doc,id,text);if(onEdit('Adjust emitter manually',['Nodes'],m=>{applyEmitterNode(m,id,parsed);})!==false)onClose();}
  catch(problem){setError(problem.message);}
 };
 const hover=event=>{
  const area=event.currentTarget,style=getComputedStyle(area),rect=area.getBoundingClientRect();
  const context=hover.canvas||(hover.canvas=document.createElement('canvas').getContext('2d'));context.font=style.font;
  const width=context.measureText('0000000000').width/10,height=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.45;
  const line=Math.floor((event.clientY-rect.top-parseFloat(style.paddingTop)+area.scrollTop)/height),column=Math.floor((event.clientX-rect.left-parseFloat(style.paddingLeft)+area.scrollLeft)/width);
  const found=index[line]?.find(piece=>column>=piece.from&&column<piece.to),box=area.parentElement.getBoundingClientRect();
  setTip(found?{text:found.tip,x:Math.min(event.clientX-box.left+14,box.width-330),y:event.clientY-box.top+18}:null);
 };
 return <div className="classic-modal" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();}}>
  <section className="classic-modal-window emitter-text-dialog" role="dialog" aria-label="Adjust emitter manually">
   <div className="emitter-text-heading"><b>Adjust Manually</b><span>Exact MDL text of this emitter</span><button aria-label="Close manual emitter text" onClick={onClose}>×</button></div>
   <p className="emitter-text-help">Hover over a highlighted word to see what it does. Keyframes are <code>frame: value,</code> lines. Apply checks the text like opening an SD model; Ctrl+Z undoes it.</p>
   <div className="emitter-text-editor">
    <pre ref={mirror} className="emitter-text-mirror" aria-hidden="true">{pieces.map((piece,i)=>piece.tip?<span key={i}>{piece.text}</span>:piece.text)}{'\n'}</pre>
    <textarea aria-label="Emitter MDL text" spellCheck={false} wrap="off" value={text} autoFocus
     onChange={e=>{setText(e.target.value);setError('');}} onMouseMove={hover} onMouseLeave={()=>setTip(null)}
     onScroll={e=>{if(mirror.current){mirror.current.scrollTop=e.currentTarget.scrollTop;mirror.current.scrollLeft=e.currentTarget.scrollLeft;}setTip(null);}}/>
    {tip&&<div className="emitter-text-tip" role="tooltip" style={{left:Math.max(4,tip.x),top:tip.y}}>{tip.text}</div>}
   </div>
   {error&&<p className="emitter-text-error" role="alert">{error}</p>}
   <div className="emitter-text-actions"><button onClick={apply} disabled={!original}>Apply</button><button onClick={()=>{setText(original?.block||'');setError('');}}>Reset</button><button onClick={onClose}>Cancel</button></div>
  </section>
 </div>;
}
