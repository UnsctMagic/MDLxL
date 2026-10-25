import fs from 'node:fs';
import {analyze} from './measure-models.mjs';
const root='D:/Codex/sd-research',rows=JSON.parse(fs.readFileSync(root+'/data/native-manifest.json'));
const names=['footman','grunt','skeleton','archer','heroblademaster','heromountainking','herodeathknight','cryptfiend','magnataur','felguard','skeletonarcher','bandit','knight','rifleman','peasant','peon','tauren','dryad','huntress','herodemonhunter','herolich','ghoul','gargoyle','necromancer','druidoftheclaw','witchdoctor','headhunter','shaman'];
for(const r of rows.filter(r=>r.tier==='sd'&&names.includes(r.logicalPath.toLowerCase().split('\\').at(-1).replace('.mdx','')))){
 const result=analyze(r,fs.readFileSync(r.file));fs.writeFileSync(root+'/data/parts/'+r.id+'.json',JSON.stringify(result));
 console.log(JSON.stringify({id:r.id,path:r.logicalPath,triangles:result.triangles,visible:result.visibleTriangles,components:result.parts.length,sheets:result.sheets,parts:result.parts.filter(p=>p.visible&&!p.heroGlow).map(p=>({g:p.geoset1,c:p.component1,t:p.triangles,shape:p.shapeClass,bones:p.bones.slice(0,3).map(x=>x.name),box:p.bindBounds.size,uv:p.uv?.bounds}))}));
}