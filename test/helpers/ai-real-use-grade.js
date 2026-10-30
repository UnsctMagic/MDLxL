// Pure, provider-independent measurements. Scores describe observations, never acceptance.
const clamp = n => Math.max(0, Math.min(1, n));
const array = v => Array.from(v?.$data ?? v ?? []);
const finite = v => typeof v === 'number' && Number.isFinite(v);
const average = a => a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
const dist = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
const dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);
const sub = (a, b) => a.map((n, i) => n - b[i]);
const mix = (points, weights) => points[0].map((_, i) => points.reduce((s, p, j) => s + p[i] * weights[j], 0));
export function snapshotModel(model) {
  return {
    textures: (model.Textures || []).map(t => ({ path: t.Image || '', replaceable: t.ReplaceableId, flags: t.Flags })),
    materials: JSON.parse(JSON.stringify(model.Materials || [])),
    meshes: (model.Geosets || []).map(g => ({ vertices: array(g.Vertices), faces: array(g.Faces), uv: (g.TVertices || []).map(array), normals: array(g.Normals), groups: array(g.VertexGroup), bindings: g.Groups || [], skin: array(g.SkinWeights), material: g.MaterialID })),
  };
}
const points = mesh => Array.from({ length: mesh.vertices.length / 3 }, (_, i) => mesh.vertices.slice(i * 3, i * 3 + 3));
const triangles = meshes => meshes.flatMap((mesh, gi) => {
  const p = points(mesh);
  return Array.from({ length: mesh.faces.length / 3 }, (_, f) => {
    const ids = mesh.faces.slice(f * 3, f * 3 + 3);
    return { p: ids.map(i => p[i]), uv: mesh.uv.map(layer => ids.map(i => layer.slice(i * 2, i * 2 + 2))), gi, material: mesh.material };
  });
});
function bounds(meshes) {
  const p = meshes.flatMap(points);
  if (!p.length) return null;
  return [0, 1].map(side => [0, 1, 2].map(axis => p.reduce((n, v) => side ? Math.max(n, v[axis]) : Math.min(n, v[axis]), side ? -Infinity : Infinity)));
}
// Closest point on a filled triangle, including edges; barycentrics also compare texture wrap.
function closest(p, t) {
  const [a, b, c] = t, ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d00 = dot(ab, ab), d01 = dot(ab, ac), d11 = dot(ac, ac), d20 = dot(ap, ab), d21 = dot(ap, ac), den = d00 * d11 - d01 * d01;
  const candidates = [];
  if (Math.abs(den) > 1e-18) {
    const v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
    if (v >= 0 && w >= 0 && v + w <= 1) candidates.push([1 - v - w, v, w]);
  }
  for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
    const delta = sub(t[j], t[i]), q = clamp(dot(sub(p, t[i]), delta) / (dot(delta, delta) || 1));
    const weights = [0, 0, 0]; weights[i] = 1 - q; weights[j] = q; candidates.push(weights);
  }
  return candidates.map(weights => ({ weights, distance: dist(p, mix(t, weights)) })).sort((x, y) => x.distance - y.distance)[0];
}
function surfaceDelta(from, to, scale) {
  let max = 0, uvMax = 0, uvMissing = 0, samples = 0;
  for (const t of from) for (const weights of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1/3, 1/3, 1/3]]) {
    samples++;
    const p = mix(t.p, weights), near = to.map(other => ({ other, ...closest(p, other.p) })).sort((a, b) => a.distance - b.distance);
    if (!near.length) return { max: scale, uvMax: null, uvMissing: samples, samples };
    max = Math.max(max, near[0].distance);
    let uv = Infinity;
    for (const n of near) {
      if (n.distance > near[0].distance + scale * 1e-6) break;
      if (n.other.material !== t.material || n.other.uv.length !== t.uv.length) continue;
      uv = Math.min(uv, Math.max(0, ...t.uv.map((layer, i) => dist(mix(layer, weights), mix(n.other.uv[i], n.weights)))));
    }
    if (!finite(uv)) uvMissing++; else uvMax = Math.max(uvMax, uv);
  }
  return { max, uvMax, uvMissing, samples };
}
function silhouette(ts, box, axes, resolution) {
  const mask = new Set(), [u, v] = axes;
  for (const t of ts) {
    const p = t.p.map(q => [ (q[u] - box[0][u]) / ((box[1][u] - box[0][u]) || 1) * resolution, (q[v] - box[0][v]) / ((box[1][v] - box[0][v]) || 1) * resolution ]);
    const area = (p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]);
    if (Math.abs(area) < 1e-10) continue;
    for (let x = Math.max(0, Math.floor(Math.min(...p.map(q=>q[0])))); x < Math.min(resolution, Math.ceil(Math.max(...p.map(q=>q[0])))); x++)
      for (let y = Math.max(0, Math.floor(Math.min(...p.map(q=>q[1])))); y < Math.min(resolution, Math.ceil(Math.max(...p.map(q=>q[1])))); y++) {
        const cross = p.map((a, i) => {const b=p[(i+1)%3]; return (b[0]-a[0])*(y+.5-a[1])-(b[1]-a[1])*(x+.5-a[0]);});
        if (cross.every(n=>n>=-1e-9) || cross.every(n=>n<=1e-9)) mask.add(y*resolution+x);
      }
  }
  return mask;
}
export function measureDrift(before, after, resolution = 64) {
  const a = bounds(before.meshes), b = bounds(after.meshes);
  if (!a || !b) return { available: false, reason: 'Missing surface geometry' };
  const scale = dist(a[0], a[1]) || 1, box = a.map((p, side) => p.map((n, i) => side ? Math.max(n,b[side][i])+scale*.001 : Math.min(n,b[side][i])-scale*.001));
  const ta = triangles(before.meshes), tb = triangles(after.meshes), ab = surfaceDelta(ta,tb,scale), ba = surfaceDelta(tb,ta,scale);
  const silhouetteIoU = [[0,1],[0,2],[1,2]].map(axes => {
    const aa=silhouette(ta,box,axes,resolution),bb=silhouette(tb,box,axes,resolution),both=[...aa].filter(n=>bb.has(n)).length;
    return { axes, iou: aa.size+bb.size === 0 ? 1 : both / (aa.size+bb.size-both) };
  });
  return { available: true, boundsDelta: Math.max(...a.flatMap((p,s)=>p.map((n,i)=>Math.abs(n-b[s][i])))), boundsRelative: Math.max(...a.flatMap((p,s)=>p.map((n,i)=>Math.abs(n-b[s][i]))))/scale,
    surfaceMax: Math.max(ab.max,ba.max), surfaceRelative: Math.max(ab.max,ba.max)/scale, uvMax: Math.max(ab.uvMax||0,ba.uvMax||0), uvUnmatchedSamples: ab.uvMissing+ba.uvMissing,
    texturePathsChanged: JSON.stringify(before.textures)!==JSON.stringify(after.textures), materialsChanged: JSON.stringify(before.materials)!==JSON.stringify(after.materials), silhouetteIoU, silhouetteMean: average(silhouetteIoU.map(s=>s.iou)), sampleCount: ab.samples+ba.samples };
}
export function componentTriangles(mesh) {
  if (!mesh) return [];
  const positions=points(mesh), parent=positions.map((_,i)=>i), samePosition=new Map();
  positions.forEach((p,i)=>{const key=p.map(n=>n.toFixed(6)).join(',');if(samePosition.has(key))parent[i]=samePosition.get(key);else samePosition.set(key,i);});
  const find=i=>{while(parent[i]!==i)i=parent[i];return i;};
  for(let f=0;f<mesh.faces.length;f+=3){const ids=mesh.faces.slice(f,f+3);for(const i of ids)parent[find(i)]=find(ids[0]);}
  const count=new Map();for(let f=0;f<mesh.faces.length;f+=3){const k=find(mesh.faces[f]);count.set(k,(count.get(k)||0)+1);}
  return [...count.values()].sort((a,b)=>a-b);
}
// New protruding face patches also detect studs extruded into the existing band.
export function addedSurfaceComponents(before, after) {
  const surface=triangles(before.meshes), box=bounds(before.meshes);
  if(!box||!surface.length)return [];
  const tolerance=dist(box[0],box[1])*.001;
  return after.meshes.flatMap(mesh=>{
    const outside=points(mesh).map(p=>!surface.some(t=>closest(p,t.p).distance<=tolerance));
    const faces=[];
    for(let f=0;f<mesh.faces.length;f+=3){const ids=mesh.faces.slice(f,f+3);if(ids.some(i=>outside[i]))faces.push(...ids);}
    return componentTriangles({...mesh,faces});
  });
}
// Attribute-compatible coincident groups, independent of vertex ordering / reindexing.
export function duplicateGroups(mesh) {
  if (!mesh) return [];
  const groups=new Map();
  points(mesh).forEach((p,i)=>{
    const key=JSON.stringify([p,mesh.normals.slice(i*3,i*3+3),mesh.uv.map(u=>u.slice(i*2,i*2+2)),mesh.bindings[mesh.groups[i]],mesh.skin.slice(i*8,i*8+8)]);
    if(!groups.has(key))groups.set(key,{key,position:p,count:0,indices:[]});const g=groups.get(key);g.count++;g.indices.push(i);
  });
  return [...groups.values()].filter(g=>g.count>1);
}
export function gradeExample(before, after, meshIndex=0) {
  const eligible=duplicateGroups(before.meshes[meshIndex]), remaining=new Map(duplicateGroups(after.meshes[meshIndex]).map(g=>[g.key,g]));
  const expected=eligible.reduce((n,g)=>n+g.count-1,0), left=eligible.reduce((n,g)=>n+Math.min(g.count-1,(remaining.get(g.key)?.count||1)-1),0);
  const oldPoints=new Set(points(before.meshes[meshIndex]).map(p=>JSON.stringify(p))), newPoints=new Set(points(after.meshes[meshIndex]||{vertices:[]}).map(p=>JSON.stringify(p)));
  const retained=[...oldPoints].filter(p=>newPoints.has(p)).length / (oldPoints.size||1);
  // Coverage alone could reward deleting the region: require its actual surface to remain.
  const local=measureDrift({...before,meshes:[before.meshes[meshIndex]]},{...after,meshes:after.meshes[meshIndex]?[after.meshes[meshIndex]]:[]},32);
  const preserved=local.available && local.surfaceRelative<1e-6 && local.uvUnmatchedSamples===0 && local.uvMax<1e-6 && !local.materialsChanged && !local.texturePathsChanged;
  return { eligibleGroups:eligible.length, eligibleVertices:expected, remainingVertices:left, coverage:expected ? (expected-left)/expected : null, patternSimilarity:preserved ? retained : 0, surfacePreserved:!!preserved };
}
export function gradeWorkflow({ transcript=[], task, turns=[], externalChanges=0, error=null }) {
  const assistants=transcript.filter(m=>m.role==='assistant');
  const text=assistants.map(m=>[m.text,m.error,...(m.parts||[]).filter(p=>p.type==='tool'?p.status==='error':p.type==='provider-notice').map(p=>p.summary||p.detail||p.text||'')].join('\n')).join('\n');
  const observedErrors=[...new Set([...assistants.map(m=>m.error),...turns.map(t=>t.consoleError)].filter(Boolean))];
  const resumes=turns.filter(t=>t.resume || /^Resume task\s*$/i.test(t.prompt||'')).length;
  const refusals=(text.match(/(?:the )?model or selection (?:has )?changed/gi)||[]).length;
  const stoppedObserved=assistants.some(m=>/\bStopped\./.test(m.text||''));
  const timedOut=turns.some(t=>t.timedOut);
  const stoppedCutoff=stoppedObserved&&(!timedOut||turns.some(t=>t.stoppedBeforeCancel));
  const complete=task?.status==='complete' && !error && !turns.some(t=>t.timedOut);
  return { finalState:task?.status||'unknown', summary:task?.summary||null, reachedFinal:complete, resumes, resumeLoop:resumes>=2, stoppedObserved, stoppedCutoff, harnessStoppedCutoff:stoppedObserved&&!stoppedCutoff, staleRefusalMentions:refusals, falseStaleRefusal:refusals>0&&externalChanges===0, externalChanges, error, observedErrors, timedOut:turns.some(t=>t.timedOut), score:Math.round(100*average([complete?1:0,1/(1+resumes),stoppedCutoff?0:1,refusals&&externalChanges===0?0:1])) };
}
export function transcriptUsage(transcript) {
  const costs=transcript.filter(m=>m.role==='assistant'&&m.cost).map(m=>m.cost);
  return { tokens: costs.length&&costs.every(c=>finite(c.tokens))?costs.reduce((n,c)=>n+c.tokens,0):null, usd:costs.length&&costs.every(c=>finite(c.usd))?costs.reduce((n,c)=>n+c.usd,0):null, source:'saved transcript costs; worker totals are not added twice', outsideCheckCalls:costs.length?costs.reduce((n,c)=>n+(c.roles?.['outside check']?.calls||0),0):null, knownTokenReplies:costs.filter(c=>finite(c.tokens)).length };
}
const total = s => s.meshes.reduce((n,m)=>n+m.faces.length/3,0);
const vertices = s => s.meshes.reduce((n,m)=>n+m.vertices.length/3,0);
export function gradeScenario({ scenario, before, after, transcript=[], task, turns=[], externalChanges=0, error=null, seconds=0 }) {
  const workflow=gradeWorkflow({transcript,task,turns,externalChanges,error}), drift=measureDrift(before,after), usage=transcriptUsage(transcript);
  const shape=drift.available?average([drift.silhouetteMean,1-clamp(drift.surfaceRelative/.01),1-clamp(drift.boundsRelative/.01)]):0;
  const wrap=drift.available&&drift.uvUnmatchedSamples===0?1-clamp(drift.uvMax/.01):0;
  const look=average([shape,wrap,drift.texturePathsChanged||drift.materialsChanged?0:1]);
  const triangle={before:total(before),after:total(after),requested:scenario.trianglesPerStud??null,perComponent:scenario.trianglesPerStud!==undefined?componentTriangles(after.meshes[scenario.meshIndex]):[]};
  triangle.targetScore=triangle.requested&&triangle.perComponent.length?average(triangle.perComponent.map(n=>clamp(1-Math.abs(n-triangle.requested)/triangle.requested))):null;
  const example=scenario.kind==='example'?gradeExample(before,after,scenario.meshIndex):null;
  let objective=null, addedSurfaces=null;
  if(scenario.kind==='reduce')objective=triangle.targetScore??0;
  if(scenario.kind==='simplify')objective=vertices(after)<vertices(before)||total(after)<total(before)?1:0;
  if(scenario.kind==='example')objective=(example.coverage??0)*example.patternSimilarity;
  if(scenario.kind==='thicken') {
    const a=bounds([before.meshes[scenario.meshIndex]]),b=after.meshes[scenario.meshIndex]&&bounds([after.meshes[scenario.meshIndex]]);
    objective=a&&b?clamp(average([0,1].map(axis=>(b[1][axis]-b[0][axis])-(a[1][axis]-a[0][axis])))/.4):0;
  }
  if(scenario.kind==='studs') {
    addedSurfaces=addedSurfaceComponents(before,after);
    objective=total(after)>total(before)?clamp(1-Math.abs(addedSurfaces.length-scenario.addStuds)/scenario.addStuds):0;
  }
  const quality=average([...(objective===null?[]:[objective]),...(scenario.keepLook?[look]:[])]);
  return { id:scenario.id, workflow, qualityScore:quality===null?null:Math.round(100*quality), objectiveScore:objective===null?null:Math.round(100*objective), lookScore:Math.round(100*look), drift, example, triangle, addedSurfaces, vertices:{before:vertices(before),after:vertices(after)}, seconds, ...usage };
}
export function distribution(values) {
  const v=values.filter(finite);return { n:v.length, mean:average(v), min:v.length?Math.min(...v):null, max:v.length?Math.max(...v):null };
}
export function summarize(runs) {
  return [...new Set(runs.map(r=>r.id))].map(id=>{
    const rows=runs.filter(r=>r.id===id), rate=key=>rows.filter(r=>r.workflow[key]).length/rows.length;
    return { id, runs:rows.length, workflowScore:distribution(rows.map(r=>r.workflow.score)), qualityScore:distribution(rows.map(r=>r.qualityScore)), resumes:distribution(rows.map(r=>r.workflow.resumes)), seconds:distribution(rows.map(r=>r.seconds)), tokens:distribution(rows.map(r=>r.tokens)), outsideChecks:distribution(rows.map(r=>r.outsideCheckCalls)), usd:distribution(rows.map(r=>r.usd)), completionRate:rate('reachedFinal'), resumeLoopRate:rate('resumeLoop'), stoppedRate:rate('stoppedCutoff'), falseStaleRate:rate('falseStaleRefusal'), timeoutRate:rate('timedOut') };
  });
}
export function markdownReport(report) {
  const fmt=n=>n===null||n===undefined?'unknown':Number(n.toFixed(2));
  const range=d=>`${fmt(d.mean)} / ${fmt(d.min)} / ${fmt(d.max)} (n=${d.n})`;
  return `# AI real-use measurements\n\nMode: ${report.mode}. Model: ${report.model}. Effort: ${report.mode==='live'?'low':'not applicable (stand-in)'}. Repeats requested: ${report.repeats}.${report.repeats===1?' Each distribution is one observation.':''}\n\nPackage commit: ${report.commit}. ${report.note||''}\n\nScores are 0–100 observations, not a pass/fail verdict. Distributions below are mean / min / max. A missing price is unknown, never zero. Token totals are the app-recorded transcript usage, including cached input where the provider counts it.\n\n| Scenario | Runs | Workflow | Edit quality | Seconds | Tokens | Completed | Resume loops | Stopped | False stale |\n|---|---:|---|---|---|---|---:|---:|---:|---:|\n`+
    report.summary.map(s=>`| ${s.id} | ${s.runs} | ${range(s.workflowScore)} | ${range(s.qualityScore)} | ${range(s.seconds)} | ${range(s.tokens)} | ${fmt(100*s.completionRate)}% | ${fmt(100*s.resumeLoopRate)}% | ${fmt(100*s.stoppedRate)}% | ${fmt(100*s.falseStaleRate)}% |`).join('\n')+
    '\n\n## Per-scenario observations\n\n'+report.runs.map(r=>`- Repeat ${r.repeat}, ${r.id}: state ${r.workflow.finalState}; resumes ${r.workflow.resumes}; outside checks ${r.outsideCheckCalls??'unknown'}; triangles ${r.triangle.before} → ${r.triangle.after}${r.triangle.requested?'; per stud target '+r.triangle.requested+', observed ['+r.triangle.perComponent.join(', ')+']':''}${r.addedSurfaces?'; added stud patches '+r.addedSurfaces.length:''}; surface drift ${fmt(r.drift.surfaceMax)} units; UV drift ${fmt(r.drift.uvMax)}; texture/material changed ${!!(r.drift.texturePathsChanged||r.drift.materialsChanged)}; example coverage ${r.example?fmt(r.example.coverage):'not applicable'}; cost USD ${fmt(r.usd)}.${r.workflow.summary?' Task note: '+r.workflow.summary:''}${r.workflow.error?' Error: '+r.workflow.error:r.workflow.observedErrors?.length?' Reported: '+r.workflow.observedErrors.join(' | '):''}`).join('\n')+
    '\n\n## How to read this\n\nWorkflow is the mean of completion, 1/(1+resumes), no provider cutoff, and no false stale refusal. Harness cancellations are reported as timeouts rather than provider cutoffs. Edit quality is the mean of the requested operation score and, when requested, look preservation. Scores describe closeness and can award partial credit. Simplification must actually reduce geometry. Weld coverage measures remaining compatible duplicate points across the requested geoset; pattern similarity requires the demonstrated surface and UVs to survive. Triangle targets are checked per connected stud, not against the entire helmet.\n\nKeep-the-look checks compare bounds, bidirectional sampled triangle surfaces, three 64×64 orthographic silhouette projections, texture paths/materials and interpolated UVs at corresponding surface points. They tolerate reindexing and exact coplanar retriangulation. They are measurements, not proof of visual identity: finite samples can miss small details, and they do not grade lighting, shading or artistic photo resemblance. Stud addition counts connected patches of faces protruding beyond the old surface, including studs extruded into the band; placement and resemblance still need human review. The test does not verify Warcraft III acceptance.\n\nDry runs use an explicitly inert stand-in provider and measure plumbing only. They are never live-model quality evidence. Harness timeouts/resume budgets stop measurement only and add no product limits.\n';
}
