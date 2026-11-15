// Offline research only. Summarizes optimizexl-protected-turn-study.mjs output.
// Usage: node optimizexl-protected-turn-summary.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
const out=process.argv[2],dir=path.join(out,'models');
const models=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const ok=models.filter(m=>m.status==='ok'),failed=models.filter(m=>m.status!=='ok');
const keys=ok.flatMap(m=>m.keys),tracks=ok.flatMap(m=>m.tracks),unsupported=ok.flatMap(m=>m.unsupported);
const w=(name,rows)=>fs.writeFileSync(path.join(out,name),rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':''));
w('keys.jsonl',keys);w('tracks.jsonl',tracks);w('unsupported.jsonl',unsupported);
const FLAGS=['global','overlap','cubic','nonUnitQuaternion','billboarded','invalidKeyOrder','notVersion800'];
const meshBillboard=r=>r.meshCameraDependent;
const clean=r=>!r.flags.checkerThrew&&!FLAGS.some(f=>f==='billboarded'?false:r.flags[f])&&!meshBillboard(r);
const pct=(values,p)=>{const v=values.filter(x=>x!=null&&Number.isFinite(x)).sort((a,b)=>a-b);if(!v.length)return null;return v[Math.min(v.length-1,Math.max(0,Math.ceil(p/100*v.length)-1))];};
const P=[50,90,99,99.9,100];
const dist=(rows,f)=>{const v=rows.map(f);return {n:v.filter(x=>x!=null&&Number.isFinite(x)).length,...Object.fromEntries(P.map(p=>[p===100?'max':'p'+p,pct(v,p)]))};};
const metrics={partPct:r=>r.partPct,modelPct:r=>r.modelPct,units:r=>r.maxUnits,speedChangePctOfVertexPeak:r=>r.speedChangePctOfPeak,speedChangePctOfPartPeak:r=>r.speedChangePctOfPartPeak,nonMeshPivotUnits:r=>r.nonMeshPivots?.length?r.nonMeshMax:null};
const distributions=rows=>Object.fromEntries(Object.entries(metrics).map(([k,f])=>[k,dist(rows,f)]));
const turn=rows=>Object.fromEntries(['Rotation','Translation','Scaling'].map(p=>[p,dist(rows.filter(r=>r.property===p),r=>r.turnAtKey)]));
const LIMITS=[.1,.25,.5,1];
const clears=(r,L)=>r.partPct!=null?r.partPct<=L:(r.maxUnits===0&&(r.nonMeshMax||0)===0);
const budgetClears=(r,strength)=>r.maxUnits<=r.worldBudgetAtMaxStrength*(strength/100)**2;
function clearance(keyRows,trackRows,modelSet,test){
 const byModel=new Map();for(const m of modelSet)byModel.set(m.sha256,{tracks:[],blocked:m.unsupported.length>0});
 for(const t of trackRows)byModel.get(t.sha256)?.tracks.push(t);
 const withNotices=[...byModel.values()].filter(x=>x.tracks.length||x.blocked);
 return {keysSingle:keyRows.filter(test).length,keysTotal:keyRows.length,
  keysInClearedTracks:trackRows.filter(test).reduce((s,t)=>s+t.protectedKeys,0),keysInTracks:trackRows.reduce((s,t)=>s+t.protectedKeys,0),tracksCleared:trackRows.filter(test).length,tracksTotal:trackRows.length,
  modelsFullyCleared:withNotices.filter(x=>!x.blocked&&x.tracks.every(test)).length,modelsWithNotices:withNotices.length};
}
function group(name,keyRows,trackRows,modelSet){
 return {name,models:new Set(keyRows.map(r=>r.sha256)).size,keys:keyRows.length,tracks:trackRows.length,
  byProperty:Object.fromEntries(['Rotation','Translation','Scaling'].map(p=>[p,keyRows.filter(r=>r.property===p).length])),
  authoredTurn:keyRows.filter(r=>r.authoredTurn).length,
  single:distributions(keyRows),cumulative:distributions(trackRows),turnSize:turn(keyRows),
  partLimits:Object.fromEntries(LIMITS.map(L=>[L+'%',clearance(keyRows,trackRows,modelSet,r=>clears(r,L))])),
  worldBudget:Object.fromEntries([0,50,100].map(s=>[`strength ${s}`,clearance(keyRows,trackRows,modelSet,r=>budgetClears(r,s))]))};
}
const checkerOk=ok.filter(m=>!m.checkerError),checkerThrew=ok.filter(m=>m.checkerError);
const kOk=keys.filter(r=>!r.flags.checkerThrew),tOk=tracks.filter(r=>!r.flags.checkerThrew);
const kClean=kOk.filter(clean),tClean=tOk.filter(clean);
const kid=(r,frame)=>[r.sha256,r.path.join('.'),r.sequenceName,frame].join(':'),authoredSet=new Set(keys.filter(r=>r.authoredTurn).map(r=>kid(r,r.frame)));
for(const t of tracks)t.allAuthoredTurn=t.protectedFrames.every(fr=>authoredSet.has(kid(t,fr)));
const otherReason=r=>r.flags.overlap?'overlapping sequence':r.flags.invalidKeyOrder?'invalid key order':r.flags.global?'global (curve check)':r.flags.cubic?'curve check failed (cubic)':'curve check failed (linear)';
const kAuth=kOk.filter(r=>r.authoredTurn),tAuth=tOk.filter(t=>t.allAuthoredTurn),kOther=kOk.filter(r=>!r.authoredTurn),tOther=tOk.filter(t=>!t.allAuthoredTurn);
const flagCounts=rows=>Object.fromEntries([...FLAGS,'meshBillboarded','checkerThrew'].map(f=>[f,rows.filter(r=>f==='meshBillboarded'?r.meshCameraDependent:r.flags[f]).length]));
const lahmian=keys.filter(r=>r.sha256==='7301332715e50dfadf5ce9a049a8cd262bd6a1ba387ea394c22ccda69db54488');
const rank=(rows,f,v)=>{const a=rows.map(f).filter(x=>x!=null&&Number.isFinite(x));return a.length?a.filter(x=>x<=v).length/a.length*100:null;};
const lahmianPlacement=lahmian.map(r=>({node:r.nodeName,sequence:r.sequenceName,frame:r.frame,units:r.maxUnits,partPct:r.partPct,modelPct:r.modelPct,speedPctPartPeak:r.speedChangePctOfPartPeak,
 percentileUnits:rank(kAuth,x=>x.maxUnits,r.maxUnits),percentilePartPct:r.partPct==null?null:rank(kAuth,x=>x.partPct,r.partPct),percentileModelPct:rank(kAuth,x=>x.modelPct,r.modelPct)}));
const brief=r=>({model:r.model,node:r.nodeName,collection:r.collection,track:r.path.join('.'),property:r.property,sequence:r.sequenceName,frame:r.frame,lineType:r.lineType,authoredTurn:r.authoredTurn,
 units:r.maxUnits,partPct:r.partPct,modelPct:r.modelPct,partSize:r.partSize,vertices:r.vertices,turnAtKey:r.turnAtKey,speedPctVertexPeak:r.speedChangePctOfPeak,speedPctPartPeak:r.speedChangePctOfPartPeak,nonMeshMax:r.nonMeshMax,worstVisible:r.worstVisible,
 flags:Object.entries({...r.flags,meshBillboarded:r.meshCameraDependent}).filter(([,v])=>v).map(([k])=>k)});
const worstAuthPart=[...kAuth].filter(r=>r.partPct!=null).sort((a,b)=>b.partPct-a.partPct).slice(0,20).map(brief);
const worstPart=[...kOk].filter(r=>r.partPct!=null).sort((a,b)=>b.partPct-a.partPct).slice(0,20).map(brief);
const worstUnits=[...kOk].sort((a,b)=>b.maxUnits-a.maxUnits).slice(0,20).map(brief);
// Six worst real cases a 0.5% part limit would still allow: checker-confirmed,
// ranked by absolute units, one per model; list every key that limit would delete there.
const allowed=kAuth.filter(r=>r.partPct!=null&&r.partPct<=.5).sort((a,b)=>b.maxUnits-a.maxUnits),seen=new Set(),six=[];
for(const r of allowed){const sig=[r.nodeName,r.path.join('.'),r.sequenceName,r.frame,r.maxUnits.toFixed(6)].join('|');if(seen.has(r.sha256)||seen.has(sig))continue;seen.add(r.sha256);seen.add(sig);/* skip texture-variant copies with identical animation */
 const modelKeys=kAuth.filter(k=>k.sha256===r.sha256&&k.partPct!=null&&k.partPct<=.5),modelTracks=tAuth.filter(t=>t.sha256===r.sha256&&t.partPct!=null&&t.partPct<=.5);
 six.push({model:r.model,sha256:r.sha256,inputPath:`D:\\Claude\\MDLxL-TestModels\\${r.model.replace(/\//g,'\\')}`,worst:brief(r),
  keysSingleUnderLimit:modelKeys.map(k=>({path:k.path,node:k.nodeName,sequence:k.sequenceName,frame:k.frame,units:k.maxUnits,partPct:k.partPct})),
  tracksUnderLimitCumulative:modelTracks.map(t=>({path:t.path,node:t.nodeName,sequence:t.sequenceName,deletedFrames:t.deletedFrames,units:t.maxUnits,partPct:t.partPct}))});
 if(six.length===6)break;}
const reasons={};for(const u of unsupported){const k=`${u.reason}${u.collection?':'+u.collection:''}${u.flags?.checkerThrew||u.checkerThrew?' (checker threw)':''}`;reasons[k]=(reasons[k]||0)+1;}
const summary={generated:new Date().toISOString(),
 counts:{uniqueInputs:models.length,loaded:ok.length,loadFailed:failed.length,loadFailures:failed.map(m=>({model:m.relativePath,error:m.error})),
  checkerOk:checkerOk.length,checkerThrew:checkerThrew.length,checkerThrewByVersion:checkerThrew.reduce((o,m)=>(o[m.version]=(o[m.version]||0)+1,o),{}),
  modelsWithProtectedNodeTrsNotices:new Set(keys.map(r=>r.sha256)).size,keysMeasured:keys.length,tracksMeasured:tracks.length,
  keysMeasuredCheckerOk:kOk.length,keysMeasuredCheckerThrew:keys.length-kOk.length,unsupported:unsupported.length,unsupportedByReason:reasons,
  flagsCheckerOk:flagCounts(kOk),flagsCheckerThrew:flagCounts(keys.filter(r=>r.flags.checkerThrew)),
  partSizeZeroOrNoMesh:kOk.filter(r=>r.partPct==null).length,partSizePivotReach:kOk.filter(r=>r.partSizeSource==='pivot-reach').length,staticVerticesChangedKeys:kOk.filter(r=>r.staticVerticesChanged>0).length,
  totalSeconds:ok.reduce((s,m)=>s+m.seconds,0)},
 groups:{authoredTurn:group('checker-confirmed authoredTurn-protected',kAuth,tAuth,checkerOk),authoredTurnClean:group('authoredTurn, no flag',kAuth.filter(clean),tAuth.filter(clean),checkerOk),
  otherRemaining:{...group('checker-confirmed remaining for other reasons',kOther,tOther,checkerOk),reasons:kOther.reduce((o,r)=>(o[otherReason(r)]=(o[otherReason(r)]||0)+1,o),{})},
  checkerConfirmed:group('checker-confirmed, all flags',kOk,tOk,checkerOk),checkerConfirmedClean:group('checker-confirmed, no flag',kClean,tClean,checkerOk),
  checkerThrewMirror:group('checker threw; OptimizeXL mirror notices only',keys.filter(r=>r.flags.checkerThrew),tracks.filter(r=>r.flags.checkerThrew),checkerThrew)},
 lahmianPlacement,worstAuthoredTurnByPartPct:worstAuthPart,worstByPartPct:worstPart,worstByUnits:worstUnits,sixWorstAllowedAtHalfPercent:six};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,1));
fs.writeFileSync(path.join(out,'before-after-candidates.json'),JSON.stringify(six,null,1));
const f=(x,d=3)=>x==null?'-':Number.isFinite(x)?(Math.abs(x)>=1000?x.toFixed(0):x.toPrecision(d)):String(x);
const c=summary.counts,G=summary.groups,md=[];
md.push('# Protected-turn deletion study','',`Generated ${summary.generated}. Offline research; no production code changed. Inputs: frozen corpus manifest (D:\\Codex\\optixl-unused-study-20261114\\report\\corpus-manifest.json), deduplicated by SHA-256.`,'');
md.push('## Counts','',`- Unique inputs ${c.uniqueInputs}; loaded ${c.loaded}; load/process failures ${c.loadFailed}.`,`- Bundled checker ran on ${c.checkerOk}; threw on ${c.checkerThrew} (by version: ${JSON.stringify(c.checkerThrewByVersion)}).`,
 `- Protected node-TRS notices measured: ${c.keysMeasured} keys in ${c.modelsWithProtectedNodeTrsNotices} models (${c.keysMeasuredCheckerOk} checker-confirmed; ${c.keysMeasuredCheckerThrew} from OptimizeXL's mirror where the checker threw), ${c.tracksMeasured} track/domain cumulative runs.`,
 `- Unsupported/not measured: ${c.unsupported} - ${Object.entries(c.unsupportedByReason).map(([k,v])=>`${k} ${v}`).join('; ')||'none'}.`,
 `- Flags among checker-confirmed keys: ${Object.entries(c.flagsCheckerOk).map(([k,v])=>`${k} ${v}`).join(', ')}. (billboarded = any camera-facing node in the influence chain incl. effect children; meshBillboarded = camera-facing node among skinned bones/ancestors.)`,
 `- Part size fell back to pivot reach (single-point part) for ${c.partSizePivotReach} keys; ${c.partSizeZeroOrNoMesh} keys have no part % (no influenced vertices, effect/attachment-only nodes); keys where a vertex static in the whole sequence moved: ${c.staticVerticesChangedKeys}.`,'');
const distTable=(title,g)=>{md.push(`### ${title}`,'',`${g.keys} keys, ${g.tracks} track runs, ${g.models} models (Rotation ${g.byProperty.Rotation}, Translation ${g.byProperty.Translation}, Scaling ${g.byProperty.Scaling}; authoredTurn ${g.authoredTurn}).`,'','| metric | scope | n | p50 | p90 | p99 | p99.9 | max |','|---|---|---|---|---|---|---|---|');
 for(const [scope,d] of [['single key',g.single],['cumulative track',g.cumulative]])for(const [k,v] of Object.entries(d))md.push(`| ${k} | ${scope} | ${v.n} | ${f(v.p50)} | ${f(v.p90)} | ${f(v.p99)} | ${f(v['p99.9'])} | ${f(v.max)} |`);
 for(const [p,v] of Object.entries(g.turnSize))if(v.n)md.push(`| turn at key (${p==='Rotation'?'deg':p==='Translation'?'units':'ratio'}) | ${p} | ${v.n} | ${f(v.p50)} | ${f(v.p90)} | ${f(v.p99)} | ${f(v['p99.9'])} | ${f(v.max)} |`);
 md.push('','| limit | keys cleared (single) | keys in cleared tracks (cumulative) | tracks cleared | models fully cleared |','|---|---|---|---|---|');
 for(const [k,v] of [...Object.entries(g.partLimits).map(([k,v])=>[`${k} of part`,v]),...Object.entries(g.worldBudget).map(([k,v])=>[`world budget, ${k}`,v])])md.push(`| ${k} | ${v.keysSingle}/${v.keysTotal} | ${v.keysInClearedTracks}/${v.keysInTracks} | ${v.tracksCleared}/${v.tracksTotal} | ${v.modelsFullyCleared}/${v.modelsWithNotices} |`);
 md.push('');};
md.push('## Distributions and candidate limits','','Units are model units. part % = worst vertex displacement / bind-pose bbox diagonal of every vertex the node influences (incl. descendants, blended, hidden geosets). model % uses `dimensions()` (the world reducer\'s size). Speed change = max per-ms velocity-difference magnitude, as % of that vertex\'s own peak sequence speed, and as % of the fastest influenced vertex. A model is "fully cleared" only if every cumulative track run passes and it has no unsupported notice. World budget = `sequenceWorldBudget(meshPeak,size,maximum)` with maximum = `simpleSettings` worldTolerance = size*1%*(strength/100)^2; the app opens at strength 0, so the default maximum is 0.','');
distTable('A. authoredTurn-protected keys, checker-confirmed (headline)',G.authoredTurn);distTable('B. authoredTurn-protected, no flag',G.authoredTurnClean);md.push('Other remaining reasons: '+Object.entries(G.otherRemaining.reasons).map(([k,v])=>k+' '+v).join('; ')+'.','');distTable('C. Remaining for other reasons (owner curve check / overlap / order), checker-confirmed',G.otherRemaining);distTable('D. All checker-confirmed remaining notices',G.checkerConfirmed);distTable('Checker-confirmed, no flag',G.checkerConfirmedClean);distTable('Checker threw - OptimizeXL mirror notices (unverified by checker)',G.checkerThrewMirror);
md.push('## Accepted Lahmian keys','','Percentile ranks are within group A (authoredTurn keys).','','| node | sequence | frame | units | part % | model % | speed % part peak | pct-rank units | pct-rank part % |','|---|---|---|---|---|---|---|---|---|');
for(const r of summary.lahmianPlacement)md.push(`| ${r.node} | ${r.sequence} | ${r.frame} | ${f(r.units)} | ${f(r.partPct)} | ${f(r.modelPct)} | ${f(r.speedPctPartPeak)} | ${f(r.percentileUnits)} | ${f(r.percentilePartPct)} |`);
md.push('','## 20 worst authoredTurn keys by part %','','| # | model | node | track | sequence | frame | units | part % | model % | turn | speed % part peak | flags |','|---|---|---|---|---|---|---|---|---|---|---|---|');
summary.worstAuthoredTurnByPartPct.forEach((r,i)=>md.push(`| ${i+1} | ${r.model} | ${r.node} | ${r.track} | ${r.sequence} | ${r.frame} | ${f(r.units)} | ${f(r.partPct)} | ${f(r.modelPct)} | ${f(r.turnAtKey)} | ${f(r.speedPctPartPeak)} | ${r.flags.join(' ')} |`));
md.push('','## 20 worst of all remaining notices by part % (checker-confirmed)','','| # | model | node | track | sequence | frame | units | part % | model % | turn | speed % part peak | flags |','|---|---|---|---|---|---|---|---|---|---|---|---|');
summary.worstByPartPct.forEach((r,i)=>md.push(`| ${i+1} | ${r.model} | ${r.node} | ${r.track} | ${r.sequence} | ${r.frame} | ${f(r.units)} | ${f(r.partPct)} | ${f(r.modelPct)} | ${f(r.turnAtKey)} | ${f(r.speedPctPartPeak)} | ${r.flags.join(' ')} |`));
md.push('','## 20 worst by units (checker-confirmed)','','| # | model | node | track | sequence | frame | units | part % | model % | turn | flags |','|---|---|---|---|---|---|---|---|---|---|---|');
summary.worstByUnits.forEach((r,i)=>md.push(`| ${i+1} | ${r.model} | ${r.node} | ${r.track} | ${r.sequence} | ${r.frame} | ${f(r.units)} | ${f(r.partPct)} | ${f(r.modelPct)} | ${f(r.turnAtKey)} | ${r.flags.join(' ')} |`));
md.push('','## Six worst cases a 0.5% part limit would still allow','','authoredTurn keys only, ranked by absolute units, one per model, identical texture-variant copies skipped; full key lists in `before-after-candidates.json` (not built).','','| model | worst node | track | sequence | frame | units | part % | keys under limit |','|---|---|---|---|---|---|---|---|');
for(const s of six)md.push(`| ${s.model} | ${s.worst.node} | ${s.worst.track} | ${s.worst.sequence} | ${s.worst.frame} | ${f(s.worst.units)} | ${f(s.worst.partPct)} | ${s.keysSingleUnderLimit.length} |`);
md.push('','## Not measured','','- Warcraft III runtime / in-game rendering; camera-facing (billboard) transforms are omitted by the CPU matrices - such keys are flagged, their numbers are approximate.','- Global-sequence keys: measured with every sequence track held at the first frame of sequence 0; global speed peaks use that same pose.','- Overlapping sequences: measured only in the notice\'s own sequence.','- Rescan rounds after the first use OptimizeXL\'s own mirror of the checker rule, not the checker. Cumulative runs also delete the owner\'s ordinary (`frames`) deletions on that track.','- Non-node tracks (geoset alpha, layers, texture animations, emitter properties, cameras) are counted under unsupported, not measured.','- Particle/ribbon output, light colour, event timing: only effect-node pivot displacement is measured.','- No visual owner judgement; no Before/After files built.');
fs.writeFileSync(path.join(out,'SUMMARY.md'),md.join('\n')+'\n');
console.log(JSON.stringify(summary.counts,null,1));
