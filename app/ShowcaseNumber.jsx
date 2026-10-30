import React from 'react';
import { parseDraftNumber, useDraftNumber } from './Fields.jsx';

// Apply on Enter or leaving the box; Escape restores the old value. Keys stay in the box.
export default function ShowcaseNumber({value,onChange,min,max,...props}) {
  const field=useDraftNumber({value,onCommit:onChange,format:String,parse:(text,final)=>{
    const number=parseDraftNumber(text);
    if(number===undefined)return undefined;
    return final?Math.max(min??-Infinity,Math.min(max??Infinity,number)):number>=min&&number<=max?number:undefined;
  }});
  return <input {...props} type="number" min={min} max={max} {...field} onKeyDown={event=>{event.stopPropagation();field.onKeyDown(event);}}/>;
}
