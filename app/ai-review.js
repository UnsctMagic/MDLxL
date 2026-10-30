import { encodeAiValue, decodeAiValue, pointer } from '../src/ai-model.js';
import { ignoreHistoryAlias } from '../src/editor-document.js';
import { createChanges } from '../src/history-store.js';
import { regionBefore, regionSignature, checkRegionEdit } from '../src/ai-regions.js';
import { sampleAiModel } from '../src/ai-sampling.js';
import { prepareModelSaveAsync } from './model-save.js';
import { compareMotion, motionTable } from '../src/ai-motion-compare.js';

export async function aiCheckpoint(
  bridge,
  id,
  { includeBaseline = false, baseline, restore, restoreReview } = {},
) {
  const target = bridge.requireTarget(id);
  if (restore) {
    const { live, session } = bridge.env(target);
    if (
      session.paintProject?.dirty ||
      Object.keys(session.uvPreviews || {}).length ||
      Object.keys(session.animationDrafts || {}).length
    )
      throw Error('Apply or cancel the current preview before resuming this task.');
    if (live) {
      await bridge.host().restoreContext(restore);
      bridge.advance(id, true);
    } else {
      // A tab that is not showing resumes with the task's own selection and view.
      Object.assign(target, {
        selection: structuredClone(restore.selection),
        sequence: restore.sequence,
        globalSequence: restore.globalSequence,
        frame: restore.frame,
        keyframes: structuredClone(restore.keyframes ?? null),
        workplane: restore.workplane,
        restore: structuredClone(restore),
      });
      bridge.host().selectIn(target.documentId, {
        vertices: restore.selection,
        nodeIds: restore.selectedNodeIds,
        geosetIds: restore.checkedGeosets,
        activeGeoset: restore.activeGeoset,
      });
      bridge.advance(id);
    }
  }
  if (baseline)
    target.review = {
      before: decodeAiValue(baseline),
      changed: restoreReview?.changed === true,
      phase: restoreReview?.changed ? 'pending' : 'unchanged',
      changes: restoreReview?.changes || [],
      animation: !!restoreReview?.animation,
      sequences: restoreReview?.sequences || [],
      globalSequences: restoreReview?.globalSequences || [],
    };
  const { doc, session } = bridge.env(target);
  const bytes = target.region ? new TextEncoder().encode(regionSignature(doc.model, target.region)) : (await prepareModelSaveAsync(doc, 'mdx')).bytes;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  bridge.requireTarget(id);
  return {
    fingerprint: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''),
    path: session.path || null,
    name: doc.name,
    context: bridge.context(id),
    review: reviewStatus(target.review),
    ...(includeBaseline && target.review ? { baseline: encodeAiValue(target.review.before) } : {}),
  };
}
export const reviewStatus = review => ({
  changed: !!review?.changed,
  phase: review?.phase || 'unchanged',
  changes: review?.changes || [],
  animation: !!review?.animation,
  sequences: review?.sequences || [],
  globalSequences: review?.globalSequences || [],
  summary: review?.summary || '',
});
export async function beginAiReview(bridge, id, options) {
  const target = bridge.requireTarget(id);
  if (target.review) return target.review;
  const before = structuredClone(bridge.env(target).model);
  // Every job can go back to how the model was before it started.
  bridge.versionStore?.beforeJob(target.documentId, before);
  // No picture is taken now: inspect draws the kept original with the same
  // animation, frame and framing as the edited result, also after a resume.
  return (target.review = {
    before,
    region: target.region,
    changed: false,
    phase: 'unchanged',
    changes: [],
    animation: false,
    sequences: [],
    globalSequences: [],
  });
}
const containsTrack = value =>
  value &&
  typeof value === 'object' &&
  !ArrayBuffer.isView(value) &&
  (Array.isArray(value.Keys) || Object.values(value).some(containsTrack));
export function recordAiChange(review, result, model) {
  review.changed = true;
  review.phase = 'pending';
  delete review.inspectedRevision;
  delete review.summary;
  delete review.motionCache;
  const changes = createChanges(review.region ? regionBefore(model, review.before, review.region) : review.before, model, { ignore: ignoreHistoryAlias });
  review.changes = changes.slice(0, 100).map(c => ({ path: pointer(c.path), kind: c.kind }));
  review.animation ||= changes.some(
    c =>
      /\/(?:Sequences|GlobalSequences)(?:\/|$)|\/Keys(?:\/|$)/.test(pointer(c.path)) ||
      /\/(?:GeosetAnims|Materials|Attachments|ParticleEmitters2?|ParticleEmitterPopcorns|RibbonEmitters|Lights)\//.test(pointer(c.path)) && /\/(?:Alpha|Color|Visibility|Flags)(?:\/|$)/.test(pointer(c.path)) ||
      containsTrack(c.before) ||
      containsTrack(c.after),
  );
  Object.assign(review, touchedAnimations(changes, review.before, model));
}
// The animations an edit changed: each sequence whose interval holds a changed
// key, and each global sequence whose track changed. Review compares these,
// whatever animation the user happens to show.
export function touchedAnimations(changes, before, model) {
  const frames = new Set(),
    globals = new Set();
  const selected = new Set();
  let allLocal = false;
  const walk = (value, global, depth = 0) => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || depth > 8) return;
    if (Array.isArray(value.Keys)) global = value.GlobalSeqId >= 0 ? value.GlobalSeqId : null;
    if (Number.isFinite(value.Frame)) {
      if (global == null) frames.add(value.Frame);
      else globals.add(global);
    }
    for (const item of Array.isArray(value) ? value : Object.values(value)) walk(item, global, depth + 1);
  };
  const at = (source, path) => path.reduce((value, key) => value?.[key], source);
  for (const c of changes) {
    if (c.path[0] === 'Sequences') {
      if (Number.isInteger(c.path[1])) selected.add(c.path[1]);
      else allLocal = true;
    }
    const keys = c.path.indexOf('Keys');
    if (keys < 0) {
      walk(c.before, null);
      walk(c.after, null);
      // Changing interpolation/static channels can affect a clip even without
      // changing a key timestamp. Inspect the owning track, not just its value.
      for (const source of [before, model]) for (let n = c.path.length; n > 0; n--) {
        const owner = at(source, c.path.slice(0, n));
        if (Array.isArray(owner?.Keys)) { walk(owner, null); break; }
      }
      if (c.path[0] === 'GlobalSequences' && Number.isInteger(c.path[1])) globals.add(c.path[1]);
      if (['GeosetAnims', 'Materials', 'Attachments', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'Lights'].includes(c.path[0])) allLocal = true;
      continue;
    }
    for (const source of [before, model]) {
      const track = at(source, c.path.slice(0, keys));
      walk(at(source, c.path.slice(0, keys + 2)), track?.GlobalSeqId >= 0 ? track.GlobalSeqId : null);
    }
  }
  const sequences = (model.Sequences || []).flatMap((s, i) =>
    allLocal || selected.has(i) || [...frames].some(f => f >= s.Interval[0] && f <= s.Interval[1]) ? [i] : [],
  );
  return { sequences, globalSequences: [...globals].filter(g => model.GlobalSequences?.[g] > 0) };
}
// One tool result carries at most 16 pictures (ai-mcp.cjs toolContent).
const MAX_REVIEW_PICTURES = 16;
const animationRange = (model, a) =>
  a.globalSequence != null
    ? model.GlobalSequences?.[a.globalSequence] > 0 && [0, model.GlobalSequences[a.globalSequence]]
    : a.sequence >= 0 && model.Sequences[a.sequence]?.Interval;
const animationName = (model, a) =>
  a.globalSequence != null
    ? `global sequence ${a.globalSequence}`
    : a.sequence >= 0
      ? `"${model.Sequences[a.sequence].Name}" (sequence ${a.sequence})`
      : 'no animation';
// The same animation in another model: same index and name, else the same name.
function sameAnimation(source, model, a) {
  if (a.globalSequence != null) return source.GlobalSequences?.[a.globalSequence] > 0 ? a : null;
  if (a.sequence < 0) return a;
  const name = String(model.Sequences[a.sequence]?.Name || '').trim().toLowerCase(),
    named = s => String(s?.Name || '').trim().toLowerCase() === name;
  if (named(source.Sequences?.[a.sequence])) return a;
  const index = (source.Sequences || []).findIndex(named);
  return index < 0 ? null : { sequence: index };
}
function checkAnimation(model, a, what) {
  if (a.globalSequence != null && !(model.GlobalSequences?.[a.globalSequence] > 0))
    throw Error(`${what}: global animation index is out of range.`);
  if (a.globalSequence == null && (!Number.isInteger(a.sequence) || a.sequence < -1 || a.sequence >= model.Sequences.length))
    throw Error(`${what}: animation index is out of range.`);
}
// Corners of the posed, visible model at one frame, so a picture pair can share one framing.
function posedCorners(model, a, frame, hidden) {
  const vertices = {};
  model.Geosets.forEach((g, i) => {
    if (!hidden.has(i) && g.Vertices.length) vertices[i] = Array.from({ length: g.Vertices.length / 3 }, (_, v) => v);
  });
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  const add = p => p.forEach((v, i) => ((min[i] = Math.min(min[i], v)), (max[i] = Math.max(max[i], v))));
  if (a.sequence < 0 && a.globalSequence == null)
    for (const gi of Object.keys(vertices)) for (let i = 0; i < model.Geosets[gi].Vertices.length; i += 3) add(model.Geosets[gi].Vertices.subarray(i, i + 3));
  else {
    const count = Math.max(0, ...Object.values(vertices).map(v => v.length));
    for (let offset = 0; offset < count; offset += 1000)
      for (const g of sampleAiModel(model, { frame, sequence: -1, selectedNodeIds: [] }, { sequence: a.sequence ?? -1, globalSequence: a.globalSequence ?? null, frames: [frame], vertices, offset, limit: 1000 }).samples[0].geosets)
        for (const p of g.selected.positions) add(p.position);
  }
  if (!Number.isFinite(min[0])) return [];
  return [0, 1, 2, 3, 4, 5, 6, 7].flatMap(c => [c & 1 ? max[0] : min[0], c & 2 ? max[1] : min[1], c & 4 ? max[2] : min[2]]);
}
// Pictures that compare like with like: the kept original and the edited model,
// and a donor when the task copies from one, drawn at the same animation phase
// with the same view, display settings and framing. The user's view never decides.
async function comparisonPictures(bridge, id, review, before, args) {
  const target = bridge.requireTarget(id),
    { model, state } = bridge.env(target),
    hidden = new Set(state.hiddenGeosets || []);
  // The animation compared: the one named, else the one the edit changed, else the task's own.
  const own = target.globalSequence != null ? { globalSequence: target.globalSequence } : { sequence: target.sequence ?? -1 };
  const touched = [...(review.sequences || []).map(sequence => ({ sequence })), ...(review.globalSequences || []).map(globalSequence => ({ globalSequence }))];
  const same = (x, y) => (x.globalSequence ?? null) === (y.globalSequence ?? null) && (x.sequence ?? -1) === (y.sequence ?? -1);
  const shown =
    args.globalSequence != null
      ? { globalSequence: args.globalSequence }
      : args.sequence !== undefined
        ? { sequence: args.sequence }
        : touched.some(t => same(t, own)) || touched.length !== 1
          ? own
          : touched[0];
  checkAnimation(model, shown, 'Review');
  const range = animationRange(model, shown);
  const original = sameAnimation(before, model, shown),
    originalRange = original && animationRange(before, original);
  let donor = null;
  if (args.donor) {
    const session = bridge.referenceSessions(target).find(s => s.id === args.donor.documentId);
    if (!session || session.id === target.documentId) throw Error('donor.documentId must be a reference attached to this chat (see references in the context).');
    const explicit = args.donor.globalSequence != null ? { globalSequence: args.donor.globalSequence } : args.donor.sequence !== undefined ? { sequence: args.donor.sequence } : null;
    if (explicit) checkAnimation(session.doc.model, explicit, 'Donor');
    const animation = explicit || sameAnimation(session.doc.model, model, shown);
    if (!animation)
      throw Error(`The donor ${session.doc.name} has no animation named like ${animationName(model, shown)}. Give donor.sequence.`);
    donor = { id: session.id, name: session.doc.name, model: session.doc.model, animation, range: animationRange(session.doc.model, animation) };
  }
  // Animation edits compare 3–8 phases; other edits compare one still at the task's frame.
  let frames = [];
  if (review.animation) {
    if (!range) throw Error('Animation verification needs an animation. Give sequence or globalSequence.');
    frames = args.frames || [range[0], (range[0] + range[1]) / 2, range[1]];
    if (new Set(frames).size < 3) throw Error('Animation verification needs at least three distinct frames. Provide frames in the edited animation.');
    if (frames.some(f => f < range[0] || f > range[1])) throw Error(`frames must lie inside ${animationName(model, shown)}: ${range[0]}–${range[1]}.`);
  } else frames = [same(shown, own) ? (target.frame ?? range?.[0] ?? 0) : (range?.[0] ?? 0)];
  const perFrame = 2 + (donor ? 1 : 0);
  if (frames.length * perFrame + (args.turnaround ? 4 : 0) > MAX_REVIEW_PICTURES)
    throw Error(`That is more than ${MAX_REVIEW_PICTURES} pictures. Use fewer frames.`);
  const images = [],
    missing = [];
  if (!original) missing.push(`The original model has no ${animationName(model, shown)}, so there are no original pictures to compare.`);
  const sample = a => (a.globalSequence != null ? { globalSequence: a.globalSequence } : { sequence: a.sequence });
  for (const frame of frames) {
    bridge.requireTarget(id);
    const phase = range && range[1] > range[0] ? (frame - range[0]) / (range[1] - range[0]) : null;
    const at = r => (phase == null || !r ? (r?.[0] ?? frame) : Math.round(r[0] + phase * (r[1] - r[0])));
    const group = review.animation ? `frame ${frame}` : 'still',
      when = `${phase == null ? '' : `${Math.round(phase * 100)}% through; `}frame `;
    // One framing for the pair: both posed models fit inside it.
    const originalFrame = original && at(originalRange);
    const focus = [
      ...posedCorners(model, shown, frame, hidden),
      ...(original ? posedCorners(before, original, originalFrame, before.Geosets.length === model.Geosets.length ? hidden : new Set()) : []),
    ];
    if (original)
      images.push({
        role: 'original', group,
        label: `Original target ${args.baseline ? `version "${args.baseline}"` : 'before the task'}; ${animationName(before, original)}; ${when}${originalFrame}`,
        image: (await bridge.picture(id, { ...sample(original), frame: originalFrame }, { model: before, focus })).image,
      });
    images.push({
      role: 'edited', group,
      label: `Edited target; ${animationName(model, shown)}; ${when}${frame}`,
      image: (await bridge.picture(id, { ...sample(shown), frame }, { focus })).image,
    });
    if (donor) {
      const donorFrame = at(donor.range);
      images.push({
        role: 'donor', group,
        label: `Donor ${donor.name}; ${animationName(donor.model, donor.animation)}; ${when}${donorFrame}`,
        image: (await bridge.picture(id, { ...sample(donor.animation), frame: donorFrame }, { documentId: donor.id, focus: posedCorners(donor.model, donor.animation, donorFrame, new Set()) })).image,
      });
    }
  }
  // Side views show the edited result at the middle compared frame.
  const pose = { ...sample(shown), frame: frames[Math.floor(frames.length / 2)] };
  return { images, frames, shown, pose, missing, compared: { animation: animationName(model, shown), original: original ? animationName(before, original) : null, donor: donor ? `${donor.name}: ${animationName(donor.model, donor.animation)}` : null } };
}
export async function reviewAiModel(bridge, args, options) {
  const target = bridge.requireTarget(args.target),
    review = target.review;
  if (args.action === 'status') return reviewStatus(review);
  if (!review?.changed) return { changed: false, phase: 'unchanged' };
  if (args.action === 'finish') {
    if (typeof args.summary !== 'string' || !args.summary.trim()) throw Error('Explain the review result.');
    if (
      args.outcome === 'passed' && !args.acceptedByUser &&
      (review.phase !== 'inspected' ||
        (target.region ? review.inspectedRegion !== regionSignature(bridge.env(target).model, target.region) : review.inspectedRevision !== bridge.env(target).doc.revision) ||
        !review.passed)
    )
      throw Error('Inspect and pass the current model checks and images before completing the task.');
    review.phase =
      args.outcome === 'passed' ? 'verified' : args.outcome === 'needs-correction' ? 'correcting' : 'blocked';
    review.summary = args.summary;
    if (args.acceptedByUser) review.acceptedByUser = true;
    if (Array.isArray(args.criteria)) review.criteria = args.criteria;
    return reviewStatus(review);
  }
  if (args.action !== 'inspect') throw Error('Unknown review action.');
  if (typeof args.checksCode !== 'string' || !args.checksCode.trim())
    throw Error(
      'Provide read-only checksCode returning [{name,passed,actual?,expected?}] for the requested result. The original model is available as before.',
    );
  const env = bridge.env(target),
    revision = env.doc.revision,
    state = env.state;
  const baseline = args.baseline !== undefined ? bridge.versionStore.get(target.documentId, args.baseline) : review.before;
  const before = target.region ? regionBefore(state.model, baseline, target.region) : baseline;
  const inspectedRegion = target.region && regionSignature(state.model, target.region);
  const tested = await window.desktop.aiScript({
    requestId: options.requestId,
    code: args.checksCode,
    model: structuredClone(state.model),
    before: structuredClone(before),
    selection: structuredClone(target.selection),
    context: bridge.contextFor(args.target),
    references: Object.fromEntries((bridge.versionStore?.names(target.documentId) || [])
      .map(name => ['version:' + name, { name: 'Version ' + name, model: structuredClone(bridge.versionStore.get(target.documentId, name)) }])),
  });
  bridge.requireTarget(args.target);
  if (
    createChanges(state.model, tested.model, { ignore: ignoreHistoryAlias }).length ||
    createChanges(before, tested.before, { ignore: ignoreHistoryAlias }).length
  )
    throw Error(
      'Verification code must inspect model and before without changing either. Use an edit tool to correct the result, then inspect again.',
    );
  const checks = encodeAiValue(tested.value);
  if (
    !Array.isArray(checks) ||
    !checks.length ||
    checks.length > 100 ||
    checks.some(c => !c || typeof c.name !== 'string' || !c.name.trim() || typeof c.passed !== 'boolean')
  )
    throw Error('Verification must return 1–100 named checks with boolean passed results.');
  const validation = await bridge.dispatch(
    'mdlxl_document',
    { target: args.target, action: 'validate' },
    options,
  );
  const poses = [];
  if (review.animation) {
    const touched = args.baseline !== undefined ? touchedAnimations(createChanges(before, state.model, { ignore: ignoreHistoryAlias }), before, state.model) : review;
    const sequences = [...(touched.sequences || []), ...(touched.globalSequences || []).map(globalSequence => ({ globalSequence }))];
    const key = JSON.stringify(sequences);
    if (review.motionCache?.revision !== revision || review.motionCache?.before !== before || review.motionCache?.key !== key)
      review.motionCache = { revision, before, key, value: compareMotion(before, state.model, { sequences }) };
  }
  const comparison = await comparisonPictures(bridge, args.target, review, before, args),
    images = comparison.images;
  if (args.turnaround)
    // The result from every side: a part that only works from the front shows here.
    // Drawn off-screen, so the user's own view and camera never move.
    for (const side of ['front', 'back', 'left', 'right']) {
      bridge.requireTarget(args.target);
      images.push({
        role: 'edited',
        group: `${side} view`,
        label: `Edited target; ${side} view`,
        image: (await bridge.picture(args.target, { ...comparison.pose, view: side })).image,
      });
    }
  if (review.animation) {
    const { shown } = comparison;
    poses.push(
      await bridge.dispatch(
        'mdlxl_sample',
        { target: args.target, frames: comparison.frames, ...(shown.globalSequence != null ? { globalSequence: shown.globalSequence } : { sequence: shown.sequence, globalSequence: null }) },
        options,
      ),
    );
  }
  bridge.requireTarget(args.target);
  const current = bridge.env(target);
  const drafts =
    !!current.session.paintProject?.dirty ||
    Object.keys(current.session.uvPreviews || {}).length > 0 ||
    Object.keys(current.session.animationDrafts || {}).length > 0;
  const structural = validation.results.every(
    r => !r.error && !r.readOnly && !r.diagnostics?.some(d => d.severity === 'error'),
  );
  review.passed = checks.every(c => c.passed) && structural && !drafts && (target.region ? regionSignature(current.model, target.region) === inspectedRegion : current.doc.revision === revision);
  review.inspectedRegion = inspectedRegion;
  review.phase = 'inspected';
  review.inspectedRevision = revision;
  return {
    review: {
      ...reviewStatus(review),
      passed: review.passed,
      checks,
      validation,
      poses,
      ...(args.baseline !== undefined ? { baseline: args.baseline } : {}),
      ...(review.animation ? { motion: motionTable(review.motionCache.value) } : {}),
      compared: comparison.compared,
      ...(comparison.missing.length ? { missingEvidence: comparison.missing } : {}),
      pendingPreviews: !!drafts,
      next: args.turnaround
        ? 'Inspect every image, including each side view. Name the weakest visible spot from each side (gaps, clipping, flat or floating parts, unpainted or noisy texture). Correct failures, or call mdlxl_review finish with outcome passed and a short visual assessment. Structural checks do not prove appearance.'
        : 'Inspect the images. Correct failures, or call mdlxl_review finish with outcome passed and a short visual assessment. Structural checks do not prove appearance.',
    },
    images,
  };
}

// One deterministic combined review: every committed delta remains inside the
// union of owned regions, cross-geoset boundary seams keep their posed positions,
// and the normal serializers reopen both formats. Individual birds inspect pictures.
export async function reviewRegionBatch(bridge, id, before, regions, options) {
  const target = bridge.requireTarget(id), model = bridge.env(target).model;
  const changes = createChanges(before, model, { ignore: ignoreHistoryAlias });
  const editing = regions.filter(r => !r.readOnly);
  if (editing.length) checkRegionEdit(before, model, { scope: editing.flatMap(r => r.scope), dependencies: [], structural: editing.some(r => r.structural), readOnly: false }, changes);
  else if (changes.length) throw Error('The read-only batch changed the model.');
  const vertices = {}, points = new Map(), pairs = [];
  const owned = [...new Set(editing.flatMap(r => r.scope.map(p => /^\/Geosets\/(\d+)/.exec(p)?.[1]).filter(v => v !== undefined)).map(Number))];
  for (let gi = 0; gi < before.Geosets.length; gi++) {
    const g=before.Geosets[gi]; if (!g || !model.Geosets[gi] || g.Vertices.length !== model.Geosets[gi].Vertices.length) continue;
    const edges=new Map();
    for(let i=0;i<g.Faces.length;i+=3) for(let j=0;j<3;j++){ const a=g.Faces[i+j],b=g.Faces[i+(j+1)%3],key=[a,b].sort((x,y)=>x-y).join(','); edges.set(key,(edges.get(key)||0)+1); }
    const boundary=new Set([...edges].filter(([,n])=>n===1).flatMap(([key])=>key.split(',').map(Number)));
    for(const vi of boundary){ const key=Array.from(g.Vertices.subarray(vi*3,vi*3+3)).join(',');
      for(const other of points.get(key)||[]) if(other[0]!==gi && (owned.includes(gi) || owned.includes(other[0]))) pairs.push([other,[gi,vi]]);
      if(!points.has(key))points.set(key,[]); points.get(key).push([gi,vi]);
    }
  }
  for(const pair of pairs)for(const [gi,vi] of pair){vertices[gi]||=[];if(!vertices[gi].includes(vi))vertices[gi].push(vi);}
  let samples=0; const failures=[];
  const poses=[{sequence:-1,frames:[0]}, ...(before.Sequences||[]).map((s,sequence)=>({sequence,frames:[s.Interval[0],(s.Interval[0]+s.Interval[1])/2,s.Interval[1]]})), ...(before.GlobalSequences||[]).map((duration,globalSequence)=>({sequence:-1,globalSequence,frames:[0,duration/2,duration]}))];
  if (pairs.length) for(const pose of poses) {
    const positions = source => {
      const map=new Map(), count=Math.max(...Object.values(vertices).map(v=>v.length));
      for(let offset=0;offset<count;offset+=1000) for(const frame of sampleAiModel(source,{frame:0,sequence:-1,selection:{}},{...pose,vertices,offset,limit:1000}).samples)
        for(const g of frame.geosets)for(const p of g.selected.positions)map.set(frame.frame+':'+g.id+':'+p.id,p.position);
      return map;
    };
    const a=positions(before), b=positions(model);
    for(const frame of pose.frames)for(const [x,y]of pairs){
      const distance=map=>{const p=map.get(frame+':'+x.join(':')),q=map.get(frame+':'+y.join(':'));return Math.hypot(...p.map((v,i)=>v-q[i]));};
      if(distance(b)>distance(a)+0.001) failures.push({sequence:pose.sequence,frame,pair:[x,y]}); samples++;
    }
  }
  const validation=await bridge.dispatch('mdlxl_document',{target:id,action:'validate'},options);
  bridge.requireTarget(id);
  const passed=!failures.length && validation.results.every(r=>!r.error&&!r.readOnly&&!r.diagnostics?.some(d=>d.severity==='error'));
  return { passed, seams: pairs.length, posedSeamChecks: samples, failures: failures.slice(0,20), validation, gameplayTested:false };
}
