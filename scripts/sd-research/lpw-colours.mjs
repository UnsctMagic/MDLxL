/** Read-only sampling of authored tint, separate from source texture paint. */
import fs from 'node:fs';
import path from 'node:path';
import {parseResearchMdx} from './parse-research-model.mjs';
import {convertMdxGeosetColorTracks} from '../../src/geoset-color-codec.js';
import {sampleGeosetAnimation} from '../../src/animation.js';
const root='D:/Codex/sd-research', rows=JSON.parse(fs.readFileSync(root+'/data/lpw-manifest.json')), out=[];
for(const r of rows){
 const b=fs.readFileSync(path.isAbsolute(r.file)?r.file:path.join(root,r.file));
 const m=parseResearchMdx(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 m.GeosetAnims=convertMdxGeosetColorTracks(m.GeosetAnims);
 const measured=JSON.parse(fs.readFileSync(root+'/data/parts/'+r.id+'.json')), sample=measured.sample;
 for(let gi=0;gi<m.Geosets.length;gi++){
  const ga=m.GeosetAnims.find(a=>a.GeosetId===gi), sampled=sampleGeosetAnimation(m,gi,sample.frame,sample.index),g=measured.geosets[gi];
  out.push({modelId:r.id,geoset1:gi+1,sample,tintEnabled:!!(ga?.Flags&2),sampleRgb:sampled.color.map(v=>Math.round(v*1e6)/1e6),sampleAlpha:sampled.alpha,animatedColor:!!ga?.Color?.Keys,colorKeyCount:ga?.Color?.Keys?.length||0,baseRgb:ga?.Color?.Keys?Array.from(ga._MdxDefaults?.Color||[1,1,1]):Array.from(ga?.Color||[1,1,1]),teamColorLayer:g.layers.some(l=>l.textureSlots.some(t=>t.replaceableId===1)),teamGlowLayer:g.layers.some(l=>l.textureSlots.some(t=>t.replaceableId===2)),layerCount:g.layers.length,note:'Authored geoset colour multiplier in RGB. Texture paint, sampled tint, team colour and lighting are separate. Animated MDX KGAC converted BGR→RGB; static GEOA remains RGB.'});
 }
}
fs.writeFileSync(root+'/repo/docs/SD-RESEARCH/data/lpw-authored-colours.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({geosets:out.length,nonwhiteSample:out.filter(x=>x.sampleRgb.some(v=>v!==1)).length,animatedColour:out.filter(x=>x.animatedColor).length,animatedModels:[...new Set(out.filter(x=>x.animatedColor).map(x=>x.modelId))]},null,2));
