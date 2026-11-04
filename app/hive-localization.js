import {getLanguage,translate} from '../src/localization.js';
import templates from '../src/hive-diagnostic-templates.json' with {type:'json'};
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=templates.map(key=>{
 const ids=[];const source=key.split(/(\{\d+\})/).map(part=>/^\{\d+\}$/.test(part)?(ids.push(part),'(.*?)'):escape(part)).join('');
 return {key,ids,regex:new RegExp('^'+source+'$'),weight:key.replace(/\{\d+\}/g,'').length};
}).sort((a,b)=>b.weight-a.weight);
// Only checker prose is UI. Captured names, paths, IDs and field values stay literal.
export function localizedHiveMessage(message,locale=getLanguage()){
 if(typeof message!=='string')return message;
 for(const pattern of patterns){const match=pattern.regex.exec(message);if(!match)continue;
  return translate(pattern.key,locale,3).replace(/\{\d+\}/g,token=>match[pattern.ids.indexOf(token)+1]??token);
 }
 return message;
}
