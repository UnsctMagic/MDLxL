import React from 'react';
import { parseDraftNumber, useDraftNumber } from './Fields.jsx';

// Live while the typed number is in range; leaving the box clamps it. Keys stay in the box.
export default function ShowcaseNumber({value,onChange,min,max,...props}) {
  const field=useDraftNumber({value,live:true,onCommit:onChange,format:String,parse:(text,final)=>{
    const number=parseDraftNumber(text);
    if(number===undefined)return undefined;
    return final?Math.max(min,Math.min(max,number)):number>=min&&number<=max?number:undefined;
  }});
  return <input {...props} type="number" min={min} max={max} {...field} onKeyDown={event=>{event.stopPropagation();field.onKeyDown(event);}}/>;
}
