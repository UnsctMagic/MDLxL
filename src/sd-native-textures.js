let catalogue;
export async function nativeTextureCatalogue() {
  catalogue ||= import('../docs/AI-SD-TEXTURE-CATALOGUE.json', {with:{type:'json'}}).then(m=>m.default);
  return catalogue;
}
const normal = s => String(s||'').replaceAll('\\','/').toLowerCase().replace(/^.*:/,'');
export async function nativeTexture(path) {
  const data=await nativeTextureCatalogue(),key=normal(path),qualified=String(path||'').replaceAll('\\','/').toLowerCase();
  if(qualified.includes(':'))return data.entries.find(t=>t.sourcePath.replaceAll('\\','/').toLowerCase()===qualified)||null;
  const matches=data.entries.filter(t=>normal(t.path)===key||normal(t.sourcePath)===String(path).replaceAll('\\','/').toLowerCase());
  return matches.find(t=>!t.sourcePath.split(':').slice(1,-1).length)||matches[0]||null;
}
/** Meaning comes from the checked region labels, then the game path. Unknown
 * regions are never supplied as safe UV rectangles. No runtime download. */
export async function searchNativeTextures({query='',offset=0,limit=20,checkedOnly=false}={}) {
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Choose a catalogue page of 1–100.');
  const stop=new Set(['make','a','an','the','me','this','that','of','with','worthy','properly','please','my']);
  const data=await nativeTextureCatalogue(),words=String(query).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w&&!stop.has(w));
  const scored=data.entries.filter(t=>!checkedOnly||t.checkedByEye).map(t=>{
    const tags=[t.description,...t.tags,...t.regions.flatMap(r=>[r.name,...(r.tags||[])])].join(' ').toLowerCase();
    const path=t.path.toLowerCase();
    return {t,score:words.reduce((s,w)=>s+(tags.includes(w)?3:path.includes(w)?1:0),0)};
  }).filter(x=>!words.length||x.score>0).sort((a,b)=>b.score-a.score||Number(b.t.checkedByEye)-Number(a.t.checkedByEye)||a.t.sourcePath.localeCompare(b.t.sourcePath));
  return {total:scored.length,offset,truncated:offset+limit<scored.length,items:scored.slice(offset,offset+limit).map(x=>x.t)};
}
