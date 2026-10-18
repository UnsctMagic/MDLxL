import React,{useMemo,useState} from 'react';
import {ribbonMdlText,parseRibbonMdlText,applyRibbonNode} from '../src/ribbon-text.js';

/** Adjust Manually: the exact MDL text this ribbon saves as, read back with the model's own MDL reader. */
export default function RibbonTextDialog({doc,id,onEdit,onClose}){
 const original=useMemo(()=>{try{return ribbonMdlText(doc,id).block;}catch(error){return null;}},[doc,id]);
 const [text,setText]=useState(original||''),[error,setError]=useState(original==null?'The ribbon text could not be read.':'');
 const apply=()=>{
  try{const parsed=parseRibbonMdlText(doc,id,text);if(onEdit('Adjust ribbon manually',['Nodes'],m=>{applyRibbonNode(m,id,parsed);})!==false)onClose();}
  catch(problem){setError(problem.message);}
 };
 return <div className="classic-modal" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();}}>
  <section className="classic-modal-window ribbon-text-dialog" role="dialog" aria-label="Adjust ribbon manually">
   <div className="ribbon-box-heading"><b>Adjust Manually</b><span>Exact MDL text of this ribbon</span><button aria-label="Close manual ribbon text" onClick={onClose}>×</button></div>
   <p className="ribbon-text-help">This is exactly what the model saves for this ribbon. Keyframes are <code>frame: value,</code> lines. Colors are written Blue, Green, Red. Apply checks the text like opening an SD model; Ctrl+Z undoes it.</p>
   <textarea aria-label="Ribbon MDL text" spellCheck={false} value={text} onChange={e=>{setText(e.target.value);setError('');}} autoFocus/>
   {error&&<p className="ribbon-text-error" role="alert">{error}</p>}
   <div className="ribbon-box-actions"><button onClick={apply} disabled={!original}>Apply</button><button onClick={()=>{setText(original||'');setError('');}}>Reset</button><button onClick={onClose}>Cancel</button></div>
  </section>
 </div>;
}
