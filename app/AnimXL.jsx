import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import useMovableWindow from './useMovableWindow.js';
import { ANIMXL_DEFAULTS, animXLNodes, applyAnimXL, buildAnimXL, suggestAnimXLBones } from '../src/anim-xl.js';
import { allNodes } from '../src/animation.js';
import { createSequenceFromCurrent, setSequenceName } from '../src/sequence-editor.js';
import './resource-editors.css';
import './anim-xl.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));

const MOTION = [
  ['ease', 'Ease', 'Linear', 'Snappy', 'Speeds up out of each pose and slows into the next one, instead of moving at one even speed. Your poses stay where they are.'],
  ['overlap', 'Overlap', 'Stiff', 'Loose', 'Parts further from the body follow a moment later: the hips lead, then chest, arms, hands and weapon. The single biggest fix for robotic motion.'],
  ['settle', 'Settle', 'Dead stop', 'Bouncy', 'Parts overshoot a pose slightly and wobble back into it, instead of stopping dead.'],
  ['weight', 'Weight', 'Light', 'Heavy', 'The body is slower to start and stop and lags behind its path, as if it were heavier.'],
  ['anticipation', 'Anticipation', 'None', 'Big wind-up', 'Before each big move, the bones first pull back the other way for a moment, like winding up a swing.'],
  ['exaggerate', 'Exaggerate', 'Subtle', 'Extreme', 'Pushes every pose further than you posed it, for punchier, more readable motion.'],
  ['life', 'Life', 'Still', 'Alive', 'Held poses breathe: small, slow drifts in the body so the unit never freezes dead. Loops seamlessly.'],
  ['poses', 'Hit poses', 'Loose', 'Exact', 'How closely the result lands on your key poses. Exact keeps every pose; Loose lets overlap and settle carry through them.'],
];
const PRESETS = [
  ['Natural', 'A good first pass for most hand-keyed animations', { ease: 50, overlap: 50, settle: 30, weight: 20, poses: 60, anticipation: 30, exaggerate: 10, life: 30 }],
  ['Heavy', 'A big, slow unit: ogre, golem, armoured knight', { ease: 40, overlap: 60, settle: 20, weight: 80, poses: 50, heavy: 85, steps: 70, anticipation: 50, exaggerate: 15, life: 20 }],
  ['Snappy', 'A quick, light unit: rogue, archer, small creature', { ease: 80, overlap: 35, settle: 55, weight: 0, poses: 70, heavy: 35, steps: 15, anticipation: 40, exaggerate: 30, life: 25 }],
  ['Loose', 'A floppy, relaxed feel: undead, drunk, exhausted', { ease: 30, overlap: 80, settle: 55, weight: 40, poses: 30, loose: 80, anticipation: 15, exaggerate: 0, life: 60 }],
];
const storageKey = (path, name) => `mdlxl.animxl.${path || 'unsaved'}.${name}`;
const readSaved = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const writeSaved = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage is optional */ } };
// Your own presets keep slider values only; bones, markers and timing belong to one animation.
const USER_PRESETS = 'mdlxl.animxl.presets';
const PRESET_KEYS = ['ease', 'overlap', 'settle', 'weight', 'anticipation', 'exaggerate', 'life', 'poses', 'heavy', 'loose', 'steps', 'feet', 'thunk', 'flinch', 'flinchBehind'];

function Slider({ id, label, low, high, tip, value, onChange, disabled }) {
  return <label className="ax-slider" title={tip}>
    <span className="ax-slider-row"><span>{label}</span><output>{value}</output></span>
    <input type="range" min="0" max="100" step="1" value={value} aria-label={label} title={tip} disabled={disabled} onChange={event => onChange(id, Number(event.target.value))}/>
    <span className="ax-ends"><span>{low}</span><span>{high}</span></span>
  </label>;
}

// A collapsible group: the title (and a short summary while closed) stays visible.
function Section({ title, note, open = false, children }) {
  return <details className="ax-section" open={open}>
    <summary title={`Show or hide ${title}`}>{title}{note ? <small> · {note}</small> : null}</summary>
    <div className="ax-section-body">{children}</div>
  </details>;
}

function BonePicker({ label, tip, ids, options, onChange, picking, onPick }) {
  const chosen = new Set(ids);
  return <div className="ax-bones" title={tip}>
    <div className="ax-chips">
      {ids.length ? ids.map(id => <button key={id} className="ax-chip" title={`Remove ${options.get(id) ?? id}`} onClick={() => onChange(ids.filter(x => x !== id))}>{options.get(id) ?? `#${id}`} ×</button>) : <small>None picked</small>}
    </div>
    <div className="ax-row">
      <button aria-pressed={picking} title="Show the skeleton in the preview and click bones to add or remove them" onClick={onPick}>{picking ? 'Done picking' : 'Pick in view'}</button>
      <select aria-label={`Add ${label}`} title={tip} value="" onChange={event => { const id = Number(event.target.value); if (Number.isInteger(id) && !chosen.has(id)) onChange([...ids, id]); }}>
        <option value="">Add bone…</option>
        {[...options].filter(([id]) => !chosen.has(id)).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </div>
  </div>;
}

/** AnimXL: shape a hand-keyed animation with a few sliders, see it live, commit as plain keys. */
export default function AnimXL({ doc, edit, sequenceIndex, textureAssets, preferences, teamColor, modelPath, onClose }) {
  const model = doc.model, sequences = model.Sequences || [];
  const [seq, setSeq] = useState(sequenceIndex >= 0 && sequences[sequenceIndex] ? sequenceIndex : 0);
  const fresh = () => ({ ...ANIMXL_DEFAULTS, ...suggestAnimXLBones(model) });
  const keyFor = index => storageKey(modelPath || doc.name, sequences[index]?.Name || index);
  const [settings, setSettings] = useState(() => ({ ...fresh(), ...(readSaved(keyFor(seq)) || {}) }));
  const interval = sequences[seq] ? Array.from(sequences[seq].Interval) : [0, 1000];
  const [time, setTime] = useState(interval[0]), [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(1);
  const [original, setOriginal] = useState(false), [picking, setPicking] = useState(null), [also, setAlso] = useState([]);
  const dialog = useRef(null), movable = useMovableWindow(dialog), touched = useRef(new Set()), drag = useRef(null);
  const history = useRef({ undo: [], redo: [], at: 0 });
  const boneOptions = useMemo(() => new Map(animXLNodes(model).map(node => [node.ObjectId, node.Name || `Bone ${node.ObjectId}`])), [model, doc.revision]);

  useEffect(() => { setTime(interval[0]); setSettings({ ...fresh(), ...(readSaved(keyFor(seq)) || {}) }); history.current = { undo: [], redo: [], at: 0 }; setAlso([]); }, [seq]);
  useEffect(() => { dialog.current?.focus(); }, []);
  useEffect(() => { const id = setTimeout(() => writeSaved(keyFor(seq), settings), 300); return () => clearTimeout(id); }, [settings, seq]);

  // Builds run in a worker so sliders and the preview never stutter, even on
  // long animations of big models. Only the newest request is built; the
  // window falls back to building in place if a worker cannot start.
  const [outcome, setOutcome] = useState({}), worker = useRef(null), jobs = useRef({ next: 0, busy: false, queued: null, latest: 0 });
  const buildHere = (index, values) => {
    try { setOutcome({ result: buildAnimXL(model, index, values), settings: values }); }
    catch (error) { setOutcome({ error: error.message, settings: values }); }
  };
  const send = request => {
    const queue = jobs.current;
    if (queue.busy) { queue.queued = request; return; }
    queue.busy = true; worker.current.postMessage(request);
  };
  useEffect(() => {
    let job = null;
    try { job = new Worker(new URL('./anim-xl.worker.js', import.meta.url), { type: 'module' }); job.postMessage({ model }); }
    catch { job = null; }
    worker.current = job;
    jobs.current = { next: jobs.current.next, busy: false, queued: null, latest: jobs.current.latest, pending: new Map() };
    if (job) {
      job.onmessage = ({ data }) => {
        const queue = jobs.current, values = queue.pending.get(data.id);
        queue.pending.delete(data.id); queue.busy = false;
        if (data.id === queue.latest) setOutcome(data.error ? { error: data.error, settings: values } : { result: data.result, settings: values });
        if (queue.queued) { const next = queue.queued; queue.queued = null; send(next); }
      };
      job.onerror = () => { job.terminate(); if (worker.current === job) { worker.current = null; jobs.current.busy = false; buildHere(seq, settings); } };
    }
    return () => { job?.terminate(); if (worker.current === job) worker.current = null; };
  }, [model, doc.revision]);
  useEffect(() => {
    if (!sequences[seq]) { setOutcome({ error: 'This model has no animations yet. Create one in Movement first.' }); return; }
    const queue = jobs.current, id = ++queue.next;
    queue.latest = id;
    if (!worker.current) { buildHere(seq, settings); return; }
    queue.pending.set(id, settings);
    send({ id, sequence: seq, settings });
  }, [model, doc.revision, seq, settings]);
  const result = outcome.result;
  // Commit always uses a result built from exactly the current settings.
  const currentResult = () => outcome.settings === settings && outcome.result ? outcome.result : buildAnimXL(model, seq, settings);

  // Tracks for the preview: the shaped result, or the originals when comparing.
  const liveTracks = useMemo(() => {
    const byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
    const shaped = original || !result ? [] : result.tracks;
    for (const item of shaped) touched.current.add(`${item.id}:${item.property}`);
    const shapedKeys = new Set(shaped.map(item => `${item.id}:${item.property}`));
    const restore = [...touched.current].filter(key => !shapedKeys.has(key)).map(key => { const [id, property] = key.split(':'); return { id: Number(id), property, track: byId.get(Number(id))?.[property] }; }).filter(item => byId.has(item.id));
    return [...shaped, ...restore];
  }, [result, original, model]);
  // Side by side: the left view always shows the authored tracks.
  const [compare, setCompare] = useState(false), cameraBus = useRef({ saved: null, listeners: new Set() });
  const originalTracks = useMemo(() => {
    const byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
    return [...touched.current].map(key => { const [id, property] = key.split(':'); return { id: Number(id), property, track: byId.get(Number(id))?.[property] }; }).filter(item => byId.has(item.id));
  }, [liveTracks, model]);

  // Undo groups a burst of changes (one slider drag) into one step.
  const remember = old => {
    const h = history.current, now = Date.now();
    if (now - h.at > 500) { h.undo.push(old); if (h.undo.length > 100) h.undo.shift(); h.redo = []; }
    h.at = now;
  };
  const update = fn => setSettings(old => { const next = fn(old); if (next !== old) remember(old); return next; });
  const undoSettings = redo => {
    const h = history.current, from = redo ? h.redo : h.undo, to = redo ? h.undo : h.redo;
    if (!from.length) return;
    const previous = from.pop();
    setSettings(current => { to.push(current); return previous; });
    h.at = 0;
  };
  const change = (key, value) => update(old => ({ ...old, [key]: value }));
  const clampTime = t => Math.round(Math.max(interval[0], Math.min(interval[1], t)));
  const addMarker = key => update(old => ({ ...old, [key]: [...new Set([...old[key], clampTime(time)])].sort((a, b) => a - b) }));
  // Keep the original: copy the animation, shape the copy. Markers and retimed
  // poses move with the copy's time range.
  const commitAsNew = () => {
    if (!result?.tracks.length) return;
    const name = sequences[seq].Name || 'Animation', taken = new Set(sequences.map(s => s.Name));
    let copyName = `${name} (AnimXL)`, n = 2;
    while (taken.has(copyName)) copyName = `${name} (AnimXL ${n++})`;
    let created = -1;
    if (edit(`AnimXL: new animation from ${name}`, ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras'], m => {
      created = createSequenceFromCurrent(m, seq);
      const offset = m.Sequences[created].Interval[0] - m.Sequences[seq].Interval[0];
      setSequenceName(m, created, copyName);
      const shifted = { ...settings, thunks: settings.thunks.map(t => t + offset), flinches: settings.flinches.map(t => t + offset), retime: Object.fromEntries(Object.entries(settings.retime || {}).map(([k, v]) => [Number(k) + offset, v + offset])) };
      applyAnimXL(m, buildAnimXL(m, created, shifted));
    }) === false) return;
    writeSaved(keyFor(seq), null);
    onClose();
  };
  const commit = () => {
    if (!result?.tracks.length) return;
    // Other picked animations get the same sliders and bones; hit markers belong to this animation only.
    const shared = { ...settings, thunks: [], flinches: [], retime: {} }, name = sequences[seq].Name || 'animation';
    const label = also.length ? `AnimXL: ${name} + ${also.length} more` : `AnimXL: ${name}`;
    const shaped = currentResult();
    if (edit(label, ['Nodes'], m => { applyAnimXL(m, shaped); for (const index of also) applyAnimXL(m, buildAnimXL(m, index, shared)); }) === false) return;
    writeSaved(keyFor(seq), null);
    onClose();
  };
  const span = Math.max(1, interval[1] - interval[0]), pct = t => `${((t - interval[0]) / span) * 100}%`;
  const stripTime = (event, box) => clampTime(interval[0] + Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * span);
  const stripDown = event => {
    const box = event.currentTarget.getBoundingClientRect(), x = event.clientX - box.left;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlaying(false);
    const near = t => Math.abs((t - interval[0]) / span * box.width - x) < 7;
    for (const key of ['thunks', 'flinches']) {
      const at = settings[key].find(near);
      if (at !== undefined) { drag.current = { key, at, box }; return; }
    }
    // Inner pose diamonds can be dragged to retime that pose.
    const poses = result?.keyTimes || [], index = poses.findIndex((t, i) => i > 0 && i < poses.length - 1 && near(t));
    if (index > 0) { drag.current = { pose: result.sourceKeyTimes[index], box }; setTime(poses[index]); return; }
    drag.current = { box }; setTime(stripTime(event, box));
  };
  const stripMove = event => {
    const d = drag.current;
    if (!d) return;
    const t = stripTime(event, d.box);
    if (d.key) { update(old => ({ ...old, [d.key]: old[d.key].map(x => x === d.at ? t : x).sort((a, b) => a - b) })); d.at = t; setTime(t); }
    else if (d.pose !== undefined) { update(old => ({ ...old, retime: { ...old.retime, [d.pose]: t } })); setTime(t); }
    else setTime(t);
  };
  const resetPose = event => {
    const box = event.currentTarget.getBoundingClientRect(), x = event.clientX - box.left, poses = result?.keyTimes || [];
    const index = poses.findIndex((t, i) => i > 0 && i < poses.length - 1 && Math.abs((t - interval[0]) / span * box.width - x) < 7);
    if (index > 0) update(old => { const retime = { ...old.retime }; delete retime[result.sourceKeyTimes[index]]; return { ...old, retime }; });
  };
  const movedPoses = Object.keys(settings.retime || {}).length;
  const [userPresets, setUserPresets] = useState(() => readSaved(USER_PRESETS) || []), [naming, setNaming] = useState(null);
  const saveUserPresets = list => { setUserPresets(list); writeSaved(USER_PRESETS, list); };
  const savePreset = () => {
    const name = (naming || '').trim();
    if (!name) return;
    const values = Object.fromEntries(PRESET_KEYS.map(key => [key, settings[key]]));
    saveUserPresets([...userPresets.filter(p => p.name !== name), { name, values }]);
    setNaming(null);
  };
  const pickBone = ids => {
    const id = ids?.at?.(-1);
    if (!picking || !boneOptions.has(id)) return;
    update(old => {
      const list = old[picking], other = picking === 'heavyIds' ? 'looseIds' : 'heavyIds';
      return list.includes(id) ? { ...old, [picking]: list.filter(x => x !== id) } : { ...old, [picking]: [...list, id], [other]: old[other].filter(x => x !== id) };
    });
  };
  const footfalls = result?.footfalls || [];
  const status = outcome.error ? outcome.error : original ? 'Showing the original animation.' : picking ? 'Click bones in the preview to add or remove them.' : result?.tracks.length ? `${new Set(result.tracks.map(t => t.id)).size} bones shaped · ${result.keyCount} keys` : 'Move a slider to shape the animation.';

  return <div className="resource-editor anim-xl" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (picking) setPicking(null); else onClose(); }
    if (event.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName)) { event.preventDefault(); setPlaying(v => !v); }
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { event.preventDefault(); undoSettings(event.key.toLowerCase() === 'y' || event.shiftKey); }
  }}>
    <section ref={dialog} style={movable.style} tabIndex={-1} className="re-window ax-window" role="dialog" aria-modal="true" aria-label="AnimXL">
      <header className="re-caption" {...movable.handleProps}><span>AnimXL</span><button className="re-caption-close" aria-label="Close AnimXL" title="Close without changing the animation" onClick={onClose}>×</button></header>
      <div className="ax-toolbar">
        <label title="The animation to shape">Animation <select aria-label="Animation" value={seq} onChange={event => setSeq(Number(event.target.value))}>{sequences.map((s, i) => <option key={i} value={i}>{s.Name || `Animation ${i + 1}`}</option>)}</select></label>
        <button onClick={() => setPlaying(v => !v)} title="Play or pause the preview (Space)">{playing ? 'Pause' : 'Play'}</button>
        {[1, 0.5, 0.25].map(value => <button key={value} aria-pressed={speed === value} title={`Play at ${value * 100}% speed. This only changes the preview.`} onClick={() => setSpeed(value)}>{value * 100}%</button>)}
        <button aria-pressed={original} disabled={compare} title="Show the animation without AnimXL to compare" onClick={() => setOriginal(v => !v)}>Original</button>
        <button aria-pressed={compare} title="Show the original (left) and the AnimXL version (right) side by side, playing together" onClick={() => { cameraBus.current = { saved: null, listeners: new Set() }; setCompare(v => !v); setOriginal(false); }}>Side by side</button>
        <span className="ax-time" title="Current time in this animation">{Math.round(time - interval[0])} / {span} ms</span>
      </div>
      <div className="ax-body">
        <div className="ax-preview-pane">
          <div className={compare ? 'ax-previews ax-compare' : 'ax-previews'}>
          {compare && <div className="ax-preview" aria-label="Original animation">
            <span className="ax-badge">Original</span>
            <Suspense fallback={<span>Loading preview…</span>}>
              <GamePreview presentation="preview" interactivePreview fitModel model={model} revision={doc.revision} textureAssets={textureAssets} modelPath={modelPath} preferences={preferences} teamColor={teamColor} sequenceIndex={seq} time={time} playing={playing} playbackSpeed={speed} liveNodeTracks={originalTracks} compareCamera={cameraBus.current} preserveCameraView/>
            </Suspense>
          </div>}
          <div className="ax-preview" aria-label="AnimXL animation">
            {compare && <span className="ax-badge ax-badge-new">AnimXL</span>}
            <Suspense fallback={<span>Loading preview…</span>}>
              <GamePreview key={compare ? 'compare' : 'single'} presentation="preview" interactivePreview fitModel model={model} revision={doc.revision} textureAssets={textureAssets} modelPath={modelPath} preferences={preferences} teamColor={teamColor} sequenceIndex={seq} time={time} playing={playing} playbackSpeed={speed} onTimeChange={setTime} liveNodeTracks={liveTracks} {...(compare ? { compareCamera: cameraBus.current, preserveCameraView: true } : {})}
                {...(picking ? { cleanAnimationPreview: true, overlays: { bones: true }, selectedNodeIds: [], onSelectNodes: pickBone } : {})}/>
            </Suspense>
          </div>
          </div>
          <div className="ax-strip" role="slider" aria-label="Animation time" aria-valuemin={interval[0]} aria-valuemax={interval[1]} aria-valuenow={Math.round(time)} title="Diamonds: your key poses. Green ticks: footfalls. Stars: THUNKs. Red marks: flinches. Click to jump. Drag a diamond to change when that pose happens (double-click it to put it back); drag a star or red mark to move it." onPointerDown={stripDown} onPointerMove={stripMove} onPointerUp={() => { drag.current = null; }} onDoubleClick={resetPose}>
            {(result?.keyTimes || []).map((t, i) => <i key={'k' + i} className={t !== result.sourceKeyTimes[i] ? 'ax-key ax-key-moved' : 'ax-key'} style={{ left: pct(t) }}/>)}
            {settings.steps > 0 && footfalls.map(t => <i key={'f' + t} className="ax-foot" style={{ left: pct(t) }}/>)}
            {settings.thunks.map(t => <i key={'t' + t} className="ax-thunk" style={{ left: pct(t) }}>★</i>)}
            {settings.flinches.map(t => <i key={'x' + t} className="ax-flinch" style={{ left: pct(t) }}>✕</i>)}
            <i className="ax-head" style={{ left: pct(clampTime(time)) }}/>
          </div>
        </div>
        <div className="ax-controls">
          {result?.dense && <p className="ax-note ax-dense" title="AnimXL treats the moments where the body slows to a stop as the poses.">This animation is already keyed in detail. AnimXL works best on a few hand-made poses, but you can still shape it.</p>}
          <Section title="Quick start" open>
            <div className="ax-row ax-presets">{PRESETS.map(([name, tip, values]) => <button key={name} title={tip} onClick={() => update(old => ({ ...old, ...values }))}>{name}</button>)}</div>
            {userPresets.length > 0 && <div className="ax-row ax-presets">{userPresets.map(preset => <span key={preset.name} className="ax-user-preset"><button title={`Use your preset "${preset.name}"`} onClick={() => update(old => ({ ...old, ...preset.values }))}>{preset.name}</button><button className="ax-chip" aria-label={`Delete preset ${preset.name}`} title={`Delete your preset "${preset.name}"`} onClick={() => saveUserPresets(userPresets.filter(p => p !== preset))}>×</button></span>)}</div>}
            {naming === null
              ? <button title="Remember the current slider settings as your own preset, for any model" onClick={() => setNaming('')}>Save as preset…</button>
              : <div className="ax-row"><input aria-label="Preset name" placeholder="Preset name" value={naming} maxLength={24} autoFocus onChange={event => setNaming(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') savePreset(); if (event.key === 'Escape') { event.stopPropagation(); setNaming(null); } }}/><button disabled={!naming.trim()} onClick={savePreset}>Save</button><button onClick={() => setNaming(null)}>Cancel</button></div>}
          </Section>
          <Section title="Motion" open>{MOTION.slice(0, 4).map(([id, label, low, high, tip]) => <Slider key={id} {...{ id, label, low, high, tip }} value={settings[id]} onChange={change}/>)}</Section>
          <Section title="More motion" note={MOTION.slice(4).filter(([id]) => settings[id] !== ANIMXL_DEFAULTS[id]).map(([, label]) => label).join(', ')}>{MOTION.slice(4).map(([id, label, low, high, tip]) => <Slider key={id} {...{ id, label, low, high, tip }} value={settings[id]} onChange={change}/>)}</Section>
          <Section title="Heavy bones" open note={settings.heavyIds.length ? `${settings.heavyIds.length} picked` : ''}>
            <BonePicker label="heavy bones" tip="Picked bones (usually the weapon) trail behind the swing and drag the arm holding them." ids={settings.heavyIds} options={boneOptions} onChange={ids => change('heavyIds', ids)} picking={picking === 'heavyIds'} onPick={() => setPicking(p => p === 'heavyIds' ? null : 'heavyIds')}/>
            <label className="ax-check" title="If the other hand holds the weapon too (a two-handed grip), it stays on the weapon while the weapon drags."><input type="checkbox" checked={settings.grip !== false} onChange={event => change('grip', event.target.checked)}/> Keep both hands on the weapon</label>
            <Slider id="heavy" label="Heaviness" low="Dagger" high="Greatsword" tip="How heavy the picked bones are. Heavier parts lag more and overshoot further." value={settings.heavy} onChange={change}/>
          </Section>
          <Section title="Loose bones" note={settings.looseIds.length ? `${settings.looseIds.length} picked` : ''}>
            <BonePicker label="loose bones" tip="Picked bones (cape, hair, tail, plume) swing loosely on their own." ids={settings.looseIds} options={boneOptions} onChange={ids => change('looseIds', ids)} picking={picking === 'looseIds'} onPick={() => setPicking(p => p === 'looseIds' ? null : 'looseIds')}/>
            <Slider id="loose" label="Looseness" low="Stiff" high="Floppy" tip="How freely the picked bones swing and wobble." value={settings.loose} onChange={change}/>
          </Section>
          <Section title="Timing" note={movedPoses ? `${movedPoses} pose${movedPoses > 1 ? 's' : ''} moved` : ''}>
            <small className="ax-note">Drag a diamond on the strip to change when that pose happens: earlier makes the move into it faster, later holds the pose before it longer. Double-click a diamond to put it back.</small>
            <button disabled={!movedPoses} onClick={() => update(old => ({ ...old, retime: {} }))} title="Put every pose back at its original time">Reset timing</button>
          </Section>
          <Section title="Feet" note={[settings.feet !== false && 'planted', settings.steps && 'Heavy steps ' + settings.steps].filter(Boolean).join(', ')}>
            <label className="ax-check" title="Feet stay exactly where your animation puts them. The body still sinks and sways; the knees bend to make up the difference. Legs that never touch the ground (a rider's) are left free."><input type="checkbox" checked={settings.feet !== false} onChange={event => change('feet', event.target.checked)}/> Keep feet planted</label>
            <Slider id="steps" label="Heavy steps" low="Off" high="Stomp" tip="Each time a foot lands, the body drops into the step and the chest and head nod. Footfalls are found from the feet touching the ground." value={settings.steps} onChange={change}/>
            {settings.steps > 0 && <small className="ax-note">{footfalls.length ? `${footfalls.length} footfall${footfalls.length > 1 ? 's' : ''} found (green ticks)` : 'No feet touch the ground in this animation.'}</small>}
          </Section>
          <Section title="Hits" note={[settings.thunks.length && `★${settings.thunks.length}`, settings.flinches.length && `✕${settings.flinches.length}`].filter(Boolean).join(' ')}>
            <div className="ax-chips">{settings.thunks.map(t => <button key={t} className="ax-chip" title="Remove this THUNK" onClick={() => change('thunks', settings.thunks.filter(x => x !== t))}>★ {t - interval[0]} ms ×</button>)}</div>
            <button onClick={() => addMarker('thunks')} title="Your weapon connects here: the animation holds this pose for a beat and heavy bones bounce back.">Add THUNK here</button>
            <Slider id="thunk" label="THUNK" low="Light" high="Brutal" tip="How long the hit holds and how hard the heavy bones bounce back." value={settings.thunk} onChange={change}/>
            <div className="ax-chips">{settings.flinches.map(t => <button key={t} className="ax-chip ax-chip-flinch" title="Remove this flinch" onClick={() => change('flinches', settings.flinches.filter(x => x !== t))}>✕ {t - interval[0]} ms ×</button>)}</div>
            <button onClick={() => addMarker('flinches')} title="The unit gets hit from the front here: the body is knocked back and the torso snaps back, then recovers.">Add flinch here</button>
            <label className="ax-check" title="Flinches come from behind: the body is pushed forward and the torso snaps forward instead of back."><input type="checkbox" checked={settings.flinchBehind} onChange={event => change('flinchBehind', event.target.checked)}/> Hit from behind</label>
            <Slider id="flinch" label="Flinch" low="Tap" high="Wrecked" tip="How hard the unit is knocked back by each flinch." value={settings.flinch} onChange={change}/>
          </Section>
          <Section title="Also apply to" note={also.length ? `${also.length} more` : ''}>
            <small className="ax-note">Commit shapes these animations too, with the same sliders and bones. THUNKs and flinches stay on this animation.</small>
            <div className="ax-also">{sequences.map((s, i) => i === seq ? null : <label key={i} title={`Shape ${s.Name || 'this animation'} too when you commit`}><input type="checkbox" checked={also.includes(i)} onChange={event => setAlso(list => event.target.checked ? [...list, i] : list.filter(x => x !== i))}/> {s.Name || `Animation ${i + 1}`}</label>)}</div>
          </Section>
        </div>
      </div>
      <footer className="ax-footer">
        <span className="ax-status" role="status">{status}</span>
        <button onClick={() => undoSettings(false)} title="Undo the last slider change (Ctrl+Z). Ctrl+Y redoes it.">Undo</button>
        <button onClick={() => update(old => ({ ...ANIMXL_DEFAULTS, heavyIds: old.heavyIds, looseIds: old.looseIds }))} title="Set every slider back to its start and remove all THUNKs and flinches">Reset</button>
        <button disabled={!result?.tracks.length || doc.readOnly} onClick={commitAsNew} title={`Keep ${sequences[seq]?.Name || 'this animation'} as it is and add the shaped version as a new animation named "${sequences[seq]?.Name || 'Animation'} (AnimXL)". Rename it in Animations if you want the game to use it.`}>Commit as new</button>
        <button disabled={!result?.tracks.length || doc.readOnly} onClick={commit} title="Write the shaped animation as ordinary keyframes. One Undo reverts it.">{also.length ? `Commit ${also.length + 1} animations` : 'Commit'}</button>
        <button onClick={onClose} title="Close without changing the animation. Your slider settings are remembered for this animation.">Cancel</button>
      </footer>
    </section>
  </div>;
}
