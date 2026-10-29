import { useWindowHotkeys, useWindowKeyClaim } from './Hotkeys.jsx';
import { windowCommandActions } from '../src/commands.js';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ToolWindow from './ToolWindow.jsx';
import { RangeField, Section } from './Fields.jsx';
import { isTypingTarget } from '../src/preferences.js';
import { readStored, writeStored } from '../src/local-store.js';
import { ANIMXL_DEFAULTS, animXLNodes, applyAnimXL, buildAnimXL, suggestAnimXLBones } from '../src/anim-xl.js';
import { allNodes, nodePivot, sampleNodeMatrices, sampleTrack } from '../src/animation.js';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { createSequenceFromCurrent, setSequenceName } from '../src/sequence-editor.js';
import { createNode } from '../src/editor-document.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { vertexBones } from '../src/part-bones.js';
import { uniqueName } from '../src/node-hierarchy.js';
import { loadEventCatalog, resolveEventSound } from './node-event-data.js';
import './resource-editors.css';
import './anim-xl.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));

// The effects, as cards. `key` is the setting the card's slider drives and `on` the value
// a card starts at when you switch it on. `bones` names the bones the card moves, which
// light up in the preview while you point at the card.
const EFFECTS = [
  { id: 'smooth', name: 'Easing', hint: 'Slow in and slow out of each pose', key: 'ease', on: 50, low: 'Linear', high: 'Strong', tip: 'Accelerates out of each key pose and decelerates into the next, instead of moving at constant speed. Key poses keep their timing.' },
  { id: 'follow', name: 'Overlap', hint: 'Child bones lag behind their parents', key: 'overlap', on: 50, low: 'Tight', high: 'Loose', tip: 'Overlapping action: each bone follows its parent with a short delay, so motion travels outward from the hips to the extremities.' },
  { id: 'wobble', name: 'Settle', hint: 'Overshoot and settle into poses', key: 'settle', on: 40, low: 'Damped', high: 'Springy', tip: 'Bones overshoot each key pose slightly and settle back into it instead of stopping abruptly.' },
  { id: 'weight', name: 'Weight', hint: 'Body mass and inertia', key: 'weight', on: 50, low: 'Low', high: 'High', bones: 'body', tip: 'Adds inertia to the body: slower to accelerate and to stop, lagging behind its path.' },
  { id: 'weapon', name: 'Drag', hint: 'Heavy parts trail the motion', key: 'heavy', on: 60, low: 'Low', high: 'High', bones: 'heavyIds', tip: 'Weapons and other heavy parts trail behind the motion and pull on the limb holding them. In Auto, AnimXL detects the weapon; with Selected, it applies to your selection.' },
  { id: 'cloth', name: 'Secondary Motion', hint: 'Cloth, hair and tails follow freely', key: 'loose', on: 60, low: 'Stiff', high: 'Loose', bones: 'looseIds', tip: 'Free secondary motion for cloth, hair, tails and plumes. In Auto, AnimXL detects them; with Selected, it applies to your selection.' },
  { id: 'steps', name: 'Footfall Impact', hint: 'The body reacts to each footfall', key: 'steps', on: 60, low: 'Soft', high: 'Hard', bones: 'feet', tip: 'At each footfall the body compresses into the step and the upper body reacts. Footfalls are detected from the feet.' },
  { id: 'windup', name: 'Anticipation', hint: 'Counter-movement before each move', key: 'anticipation', on: 50, low: 'None', high: 'Strong', tip: 'Before each large move, bones briefly move in the opposite direction.' },
  { id: 'punch', name: 'Exaggeration', hint: 'Amplifies the key poses', key: 'exaggerate', on: 40, low: 'Subtle', high: 'Strong', tip: 'Pushes each key pose further from the neutral pose for clearer, more readable motion.' },
  { id: 'breathe', name: 'Idle Motion', hint: 'Subtle drift in held poses', key: 'life', on: 50, low: 'Still', high: 'Active', tip: 'Adds slow, subtle drift so held poses never freeze. Loops seamlessly.' },
  { id: 'hits', name: 'Hit Stop & Reaction', hint: 'Impact holds and hit reactions', tip: 'Hit stop: a brief hold at the moment of impact, with recoil on heavy parts. Hit reaction: the body is knocked back and recovers. Both are placed on the timeline.' },
  { id: 'collapse', name: 'Fall Simulation', hint: 'Physics-based fall', key: 'collapse', on: 100, low: 'Off', high: 'Full', bones: 'all', tip: 'From a chosen time the unit dies: a death type poses it (knees buckle, the torso leans), then it loses muscle tension and falls under gravity. Full drops it to the ground; lower values keep some strength, so it sags, buckles or kneels. Intended for building a death from a standing pose; use Commit as new to keep the original.' },
];// Little pictures of each effect.
const ICONS = {
  smooth: <path d="M4 26C20 26 24 4 40 4"/>,
  follow: <><path d="M4 24Q14 4 24 24"/><path d="M12 26Q22 8 32 26" opacity=".6"/><path d="M20 27Q30 12 40 27" opacity=".35"/></>,
  wobble: <path d="M4 22L14 22Q17 4 20 22T26 22Q28 15 30 22T34 22L40 22"/>,
  weight: <><path d="M22 3V15"/><path d="M17 11L22 16L27 11"/><rect x="14" y="18" width="16" height="9" rx="2" className="ax-fill"/></>,
  weapon: <><path d="M10 27L34 5"/><path d="M5 19Q12 6 27 3" strokeDasharray="3 3" opacity=".6"/><path d="M28 9L33 14"/></>,
  cloth: <><path d="M12 4V27"/><path d="M12 5Q22 3 28 7T40 9Q34 14 38 21Q28 18 22 22T12 20"/></>,
  steps: <><ellipse cx="14" cy="13" rx="4" ry="6" className="ax-fill"/><ellipse cx="29" cy="18" rx="4" ry="6" className="ax-fill"/><path d="M4 27H40"/></>,
  windup: <><path d="M36 20H10"/><path d="M10 20Q3 20 5 12"/><path d="M30 15L36 20L30 25"/></>,
  punch: <path d="M22 3L25 12L35 9L28 16L38 22L26 21L25 29L20 21L9 25L16 16L6 9L18 12Z"/>,
  breathe: <path d="M4 16Q13 6 22 16T40 16"/>,
  hits: <><path d="M15 6L17 12L23 12L18 16L20 22L15 18L10 22L12 16L7 12L13 12Z" className="ax-fill"/><path d="M28 8L38 18M38 8L28 18"/></>,
  collapse: <><circle cx="11" cy="8" r="3"/><path d="M13 11L24 21L36 22"/><path d="M18 15L14 24"/><path d="M4 27H40"/></>,
};
// Death types (the engine's DEATH_STYLES), by the names the Fall Simulation card shows.
const DEATH_NAMES = { knees: 'Knees then fall', back: 'Fall backwards', forward: 'Fall forwards', side: 'Onto the side', limp: 'Limp' };
const PRESETS = [
  ['Default', 'A balanced starting point for most hand-keyed animations', { ease: 40, overlap: 40, settle: 9, weight: 20, poses: 60, anticipation: 20, exaggerate: 10, life: 30, heavy: 45, loose: 50, steps: 0, collapse: 0 }],
  ['Heavy', 'Large, slow units: ogres, golems, armoured knights', { ease: 40, overlap: 48.8, settle: 4, weight: 80, poses: 50, heavy: 85, loose: 40, steps: 70, anticipation: 50, exaggerate: 15, life: 20, collapse: 0 }],
  ['Agile', 'Quick, light units: rogues, archers, small creatures', { ease: 80, overlap: 29.8, settle: 30, weight: 0, poses: 70, heavy: 35, loose: 40, steps: 15, anticipation: 40, exaggerate: 30, life: 25, collapse: 0 }],
  ['Relaxed', 'Loose, low-tension motion: undead, exhausted or wounded units', { ease: 30, overlap: 71.2, settle: 30, weight: 40, poses: 30, loose: 80, heavy: 40, steps: 0, anticipation: 15, exaggerate: 0, life: 60, collapse: 0 }],
  ['Fall', 'Fall Simulation from the current pose, for building a death. Use Commit as new to keep the original.', { ease: 30, overlap: 32.8, settle: 9, weight: 0, poses: 30, heavy: 60, loose: 70, steps: 0, anticipation: 0, exaggerate: 0, life: 0, collapse: 100, collapseAt: 20, collapseStyle: 'auto', bounce: 30 }],
];// How strongly a bone changed, as a colour: blue untouched, yellow some, red a lot.
const heat = share => share < 0.004 ? '#4fc3ff' : share < 0.02 ? '#ffd23f' : share < 0.05 ? '#ff8a2a' : '#ff3b30';
const storageKey = (path, name) => `mdlxl.animxl.${path || 'unsaved'}.${name}`;
const readSaved = key => readStored(key, null);
const writeSaved = (key, value) => { writeStored(key, value); };
// Your own presets keep slider values only; bones, markers and timing belong to one animation.
const USER_PRESETS = 'mdlxl.animxl.presets';
const PRESET_KEYS = ['ease', 'overlap', 'settle', 'weight', 'anticipation', 'exaggerate', 'life', 'poses', 'heavy', 'loose', 'steps', 'feet', 'thunk', 'flinch', 'flinchBehind', 'collapse', 'collapseAt', 'collapseDir', 'collapseStyle', 'bounce'];

function Slider({ id, label, low, high, tip, value, onChange, disabled }) {
  return <RangeField className="ax-slider" title={tip} label={label} output={Math.round(value)} ends={[low, high]} min="0" max="100" step="1" value={value} disabled={disabled} inputProps={{ title: tip }} onChange={next => onChange(id, next)}/>;
}


// One effect: its picture, name and what it does. Clicking it opens its controls (and
// switches it on); the corner switch turns it off and on again.
function EffectCard({ effect, value, active, selected, onSelect, onToggle, onHover }) {
  return <div className={`ax-card${active ? ' ax-card-on' : ''}${selected ? ' ax-card-selected' : ''}`} onPointerEnter={() => onHover(effect.id)} onPointerLeave={() => onHover(null)}>
    <button className="ax-card-main" aria-pressed={selected} title={effect.tip} onClick={onSelect}>
      <svg viewBox="0 0 44 30" className="ax-icon" aria-hidden="true">{ICONS[effect.id]}</svg>
      <span className="ax-card-text"><b>{effect.name}</b><small>{effect.hint}</small></span>
    </button>
    {effect.key && <button className="ax-card-switch" role="switch" aria-checked={active} aria-label={`${effect.name} on`} title={active ? `Turn ${effect.name} off` : `Turn ${effect.name} on`} onClick={onToggle}>{active ? Math.round(value) : ''}</button>}
  </div>;
}

// The model with some node tracks swapped in (no deep copy).
function withTracks(model, tracks) {
  if (!tracks.length) return model;
  const byId = new Map();
  for (const item of tracks) (byId.get(item.id) || byId.set(item.id, []).get(item.id)).push(item);
  const patch = node => { const items = byId.get(node.ObjectId); if (!items) return node; const copy = { ...node }; for (const item of items) copy[item.property] = item.track; return copy; };
  return { ...model, Bones: (model.Bones || []).map(patch), Helpers: (model.Helpers || []).map(patch) };
}

// The weapon's tip: the point of its mesh furthest from its pivot (bind pose).
function weaponTip(model, weaponId) {
  const node = allNodes(model).find(n => n.ObjectId === weaponId);
  const pivot = new Vector3().fromArray(nodePivot(model, node, weaponId));
  if (!node) return pivot;
  let tip = pivot.clone(), far = 0;
  const point = new Vector3();
  for (const geo of model.Geosets || []) {
    const count = geo.Vertices.length / 3;
    for (let v = 0; v < count; v++) {
      if (!vertexBones(geo, v).includes(weaponId)) continue;
      const d = point.fromArray(geo.Vertices, v * 3).distanceTo(pivot);
      if (d > far) { far = d; tip = point.clone(); }
    }
  }
  return tip;
}
// Pick a game sound by searching its name; hearing it is one click away.
function SoundPicker({ label, tip, value, sounds, onOpen, onPlay, onChange }) {
  const [filter, setFilter] = useState('');
  const all = sounds?.SND || [], words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length ? all.filter(sound => words.every(word => sound.label.toLowerCase().includes(word))).slice(0, 300) : all;
  return <div className="ax-sound" title={tip}>
    <span>{label}</span>
    <div className="ax-row">
      <input aria-label={`Search ${label}`} placeholder="Search sounds" value={filter} onFocus={onOpen} onChange={event => setFilter(event.target.value)}/>
      <button aria-label={`Play ${label}`} title="Play the chosen sound" disabled={!value || !all.length} onClick={() => onPlay(value)}>▶</button>
    </div>
    <select aria-label={label} value={value || ''} onFocus={onOpen} onPointerDown={onOpen} onChange={event => { onChange(event.target.value); if (event.target.value) onPlay(event.target.value); }}>
      <option value="">None</option>
      {sounds?.loading && <option disabled>Loading sounds…</option>}
      {shown.map(sound => <option key={sound.id} value={sound.id}>{sound.label}</option>)}
      {value && !shown.some(sound => sound.id === value) && <option value={value}>{all.find(sound => sound.id === value)?.label || value}</option>}
    </select>
  </div>;
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
export default function AnimXL({ doc, edit, sequenceIndex, textureAssets, teamColor, modelPath, selectedNodeIds = [], poseRig = null, onClose }) {
  const model = doc.model, sequences = model.Sequences || [];
  const [seq, setSeq] = useState(sequenceIndex >= 0 && sequences[sequenceIndex] ? sequenceIndex : 0);
  const fresh = () => ({ ...ANIMXL_DEFAULTS, ...suggestAnimXLBones(model) });
  const keyFor = index => storageKey(modelPath || doc.name, sequences[index]?.Name || index);
  const [settings, setSettings] = useState(() => ({ ...fresh(), ...(readSaved(keyFor(seq)) || {}) }));
  const interval = sequences[seq] ? Array.from(sequences[seq].Interval) : [0, 1000];
  // Section: the part of the timeline AnimXL works on; none means the whole animation.
  // After a section commit it is empty (nothing shaped) until the next one is dragged.
  const [armed, setArmed] = useState(false), [draft, setDraft] = useState(null);
  const sectionOn = Array.isArray(settings.range) && settings.range[1] > settings.range[0];
  const sectionDone = Array.isArray(settings.range) && !sectionOn;
  const [time, setTime] = useState(interval[0]), [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(100);
  const [original, setOriginal] = useState(false), [picking, setPicking] = useState(null), [also, setAlso] = useState([]);
  const dialog = useRef(null), touched = useRef(new Set()), drag = useRef(null);
  const history = useRef({ undo: [], redo: [], at: 0 });
  const boneOptions = useMemo(() => new Map(animXLNodes(model).map(node => [node.ObjectId, node.Name || `Bone ${node.ObjectId}`])), [model, doc.revision]);
  // Apply to: Auto (AnimXL picks the weapon, cloth and so on) or Selected (bones and POSE
  // handles clicked in the preview; every effect then shapes only those bones). AnimXL opens
  // in Auto; bones selected in the editor are already in the selection when you switch.
  const [target, setTarget] = useState('auto');
  const [selection, setSelection] = useState(() => (selectedNodeIds || []).filter(id => boneOptions.has(id)));
  const shaping = useMemo(() => target !== 'selected' ? settings : { ...settings, only: selection, heavyIds: settings.heavy > 0 ? selection : [], looseIds: settings.heavy > 0 ? [] : selection }, [settings, target, selection]);
  // POSE handles in the preview: your POSE setup if you made one, otherwise AnimXL's own reading of the rig.
  // Clicking a handle selects its limb (or the body); clicking it again deselects it.
  const poseBase = useMemo(() => { if (poseRig) return poseRig; try { return suggestPoseRig(model, interval[0], seq); } catch { return null; } }, [poseRig, model, doc.revision, seq]);
  const [poseTarget, setPoseTarget] = useState(null);
  const poseConfig = target === 'selected' && poseBase ? { ...poseBase, enabled: true, picking: null, pins: poseBase.pins || [], target: poseTarget } : null;
  const handleBones = t => {
    if (!t || !poseBase) return [];
    if (t.kind === 'node') return [t.id];
    if (t.kind === 'body') return [poseBase.body];
    const chain = (poseBase.chains || []).find(c => c.key === t.key);
    return chain ? [chain.root, chain.middle, chain.end] : [];
  };
  const toggleBones = ids => {
    const valid = ids.filter(id => boneOptions.has(id));
    if (valid.length) setSelection(old => valid.every(id => old.includes(id)) ? old.filter(id => !valid.includes(id)) : [...new Set([...old, ...valid])]);
  };
  const selectFromPreview = ids => ids.length === 1 ? toggleBones(ids) : setSelection(ids.filter(id => boneOptions.has(id)));
  const selectHandle = t => { setPoseTarget(t); toggleBones(handleBones(t)); };

  useEffect(() => { setTime(interval[0]); setSettings({ ...fresh(), ...(readSaved(keyFor(seq)) || {}) }); history.current = { undo: [], redo: [], at: 0 }; setAlso([]); }, [seq]);
  useEffect(() => { dialog.current?.focus(); }, []);
  useEffect(() => { const id = setTimeout(() => writeSaved(keyFor(seq), settings), 300); return () => clearTimeout(id); }, [settings, seq]);

  // Builds run in a worker so sliders and the preview never stutter, even on
  // long animations of big models. Only the newest request is built; the
  // window falls back to building in place if a worker cannot start.
  // One request is in flight at a time and only the newest waiting one is kept.
  // Every result remembers the request (animation, settings, model revision) it was built from.
  const [outcome, setOutcome] = useState({}), worker = useRef(null), jobs = useRef({ next: 0, busy: null, queued: null, latest: null });
  const buildHere = request => {
    try { setOutcome({ result: buildAnimXL(model, request.sequence, request.settings), request }); }
    catch (error) { setOutcome({ error: error.message, request }); }
  };
  const send = request => {
    const queue = jobs.current;
    if (queue.busy) { queue.queued = request; return; }
    queue.busy = request; worker.current.postMessage({ id: request.id, sequence: request.sequence, settings: request.settings });
  };
  useEffect(() => {
    let job = null;
    try { job = new Worker(new URL('./anim-xl.worker.js', import.meta.url), { type: 'module' }); job.postMessage({ model }); }
    catch { job = null; }
    worker.current = job;
    jobs.current = { next: jobs.current.next, busy: null, queued: null, latest: null };
    if (job) {
      job.onmessage = ({ data }) => {
        const queue = jobs.current, request = queue.busy;
        queue.busy = null;
        if (request && data.id === request.id && request === queue.latest) setOutcome(data.error ? { error: data.error, request } : { result: data.result, request });
        if (queue.queued) { const next = queue.queued; queue.queued = null; send(next); }
      };
      job.onerror = () => {
        job.terminate();
        if (worker.current !== job) return;
        worker.current = null;
        const queue = jobs.current; queue.busy = null; queue.queued = null;
        if (queue.latest) buildHere(queue.latest);
      };
    }
    return () => { job?.terminate(); if (worker.current === job) worker.current = null; };
  }, [model, doc.revision]);
  useEffect(() => {
    if (!sequences[seq]) { setOutcome({ error: 'This model has no animations yet. Create one in Movement first.' }); return; }
    const queue = jobs.current, request = { id: ++queue.next, sequence: seq, settings: shaping, revision: doc.revision };
    queue.latest = request;
    if (!worker.current) buildHere(request); else send(request);
  }, [model, doc.revision, seq, shaping]);
  const result = outcome.result;
  // Commit always uses a result built from exactly the current animation, settings and model.
  const currentResult = () => {
    const built = outcome.request;
    return outcome.result && built?.settings === shaping && built.sequence === seq && built.revision === doc.revision ? outcome.result : buildAnimXL(model, seq, shaping);
  };

  // ×3: the preview shows every change three times as strong, so subtle shaping on an
  // already-animated unit is easy to see. Preview only; Commit writes the real result.
  const [magnify, setMagnify] = useState(false), [ghost, setGhost] = useState(true), [hover, setHover] = useState(null), [selected, setSelected] = useState(null);
  const magnified = useMemo(() => {
    if (!magnify || !result?.tracks.length) return null;
    const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), [from, to] = interval, frames = [];
    for (let f = from; f < to; f += 1000 / 30) frames.push(Math.round(f));
    frames.push(to);
    const opts = { interval, globalSequences: model.GlobalSequences || [] };
    return result.tracks.map(item => {
      const rotation = item.property === 'Rotation', before = byId.get(item.id)?.[item.property];
      const read = (track, f) => track?.Keys ? sampleTrack(track, f, rotation ? { ...opts, quaternion: true, fallback: [0, 0, 0, 1] } : { ...opts, fallback: [0, 0, 0] }) : rotation ? [0, 0, 0, 1] : [0, 0, 0];
      const keys = frames.map(Frame => {
        const now = read(item.track, Frame), was = read(before, Frame);
        if (!rotation) return { Frame, Vector: new Float32Array(was.map((v, i) => v + (now[i] - v) * 3)) };
        const a = new Quaternion(...was).normalize(), b = new Quaternion(...now).normalize(), d = a.clone().invert().multiply(b);
        if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
        const sin = Math.hypot(d.x, d.y, d.z), angle = Math.min(2 * Math.atan2(sin, d.w) * 3, Math.PI * 0.95);
        if (sin < 1e-7) return { Frame, Vector: new Float32Array(b.toArray()) };
        const k = Math.sin(angle / 2) / sin;
        return { Frame, Vector: new Float32Array(a.multiply(new Quaternion(d.x * k, d.y * k, d.z * k, Math.cos(angle / 2))).toArray()) };
      });
      const others = item.track.Keys.filter(key => key.Frame < from || key.Frame > to).map(key => ({ Frame: key.Frame, Vector: key.Vector }));
      return { ...item, track: { ...item.track, LineType: 1, Keys: [...others, ...keys].sort((x, y) => x.Frame - y.Frame) } };
    });
  }, [magnify, result, model, interval[0], interval[1]]);

  // Tracks for the preview: the shaped result, or the originals when comparing.
  const liveTracks = useMemo(() => {
    const byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
    const shaped = original || !result ? [] : magnified || result.tracks;
    for (const item of shaped) touched.current.add(`${item.id}:${item.property}`);
    const shapedKeys = new Set(shaped.map(item => `${item.id}:${item.property}`));
    const restore = [...touched.current].filter(key => !shapedKeys.has(key)).map(key => { const [id, property] = key.split(':'); return { id: Number(id), property, track: byId.get(Number(id))?.[property] }; }).filter(item => byId.has(item.id));
    return [...shaped, ...restore];
  }, [result, magnified, original, model]);
  // Side by side: the left view always shows the authored tracks.
  const [compare, setCompare] = useState(false), cameraBus = useRef({ saved: null, listeners: new Set() });
  // Arcs: the path the weapon's tip draws through the animation, original
  // (dashed) and shaped (solid), with a dot at the current moment.
  const [arcs, setArcs] = useState(false), [arcPick, setArcPick] = useState(null);
  // Any heavy, loose or foot bone can show its arc; the weapon is the default.
  const arcChoices = [...new Set([...settings.heavyIds, ...settings.looseIds, ...(result?.rig?.feet || [])])].filter(id => boneOptions.has(id));
  const arcWeapon = arcChoices.includes(arcPick) ? arcPick : arcChoices[0] ?? null;
  const arcStep = 25, arcFrames = useMemo(() => { const list = []; for (let f = interval[0]; f <= interval[1]; f += arcStep) list.push(f); return list; }, [interval[0], interval[1]]);
  const tipOf = useMemo(() => weaponTip(model, arcWeapon), [model, doc.revision, arcWeapon]);
  const originalArc = useMemo(() => arcs && arcWeapon != null ? arcFrames.map(f => tipOf.clone().applyMatrix4(sampleNodeMatrices(model, f, seq).get(arcWeapon) || new Matrix4()).toArray()) : null, [arcs, arcWeapon, tipOf, arcFrames, model, doc.revision, seq]);
  const shapedArc = useMemo(() => {
    if (!arcs || arcWeapon == null) return null;
    const shaped = withTracks(model, result?.tracks || []);
    return arcFrames.map(f => tipOf.clone().applyMatrix4(sampleNodeMatrices(shaped, f, seq).get(arcWeapon) || new Matrix4()).toArray());
  }, [arcs, arcWeapon, tipOf, arcFrames, result, model, seq]);
  const arcMarker = Math.max(0, Math.min(arcFrames.length - 1, Math.round((time - interval[0]) / arcStep)));
  const originalPath = originalArc && { points: originalArc, color: '#9fb4c8', width: 2, dash: [6, 4], alpha: 0.95, marker: arcMarker };
  const shapedPath = shapedArc && { points: shapedArc, color: '#ff8a2a', width: 2.5, marker: arcMarker };
  // Ghost: the original skeleton (faint white) under the AnimXL skeleton, each bone
  // coloured by how far it moved from the original. Pointing at a card lights up its bones.
  const skeleton = useMemo(() => {
    const nodes = allNodes(model).filter(n => (model.Bones || []).includes(n) || (model.Helpers || []).includes(n)), ids = new Set(nodes.map(n => n.ObjectId)), children = new Map();
    for (const n of nodes) if (ids.has(n.Parent)) (children.get(n.Parent) || children.set(n.Parent, []).get(n.Parent)).push(n.ObjectId);
    const pivots = new Map(nodes.map(n => [n.ObjectId, new Vector3().fromArray(nodePivot(model, n))]));
    const xs = [...pivots.values()], extent = axis => Math.max(...xs.map(p => p[axis])) - Math.min(...xs.map(p => p[axis]));
    return { links: nodes.filter(n => ids.has(n.Parent)).map(n => [n.Parent, n.ObjectId]), children, parent: new Map(nodes.map(n => [n.ObjectId, n.Parent])), pivots, size: Math.max(20, ...['x', 'y', 'z'].map(extent)) };
  }, [model, doc.revision]);
  const litEffect = hover || selected;
  const litIds = useMemo(() => {
    const kind = EFFECTS.find(e => e.id === litEffect)?.bones;
    if (!kind) return new Set();
    if (kind === 'all') return new Set(skeleton.pivots.keys());
    const below = start => { const out = new Set(), stack = [...start]; while (stack.length) { const id = stack.pop(); if (out.has(id)) continue; out.add(id); stack.push(...(skeleton.children.get(id) || [])); } return out; };
    if (kind === 'body') { const body = result?.rig?.body; return body == null ? new Set() : new Set([body, ...(skeleton.children.get(body) || [])]); }
    if (kind === 'feet') return new Set((result?.rig?.feet || []).flatMap(foot => { const knee = skeleton.parent.get(foot); return [foot, knee, skeleton.parent.get(knee)]; }).filter(id => id != null));
    return below(settings[kind] || []);
  }, [litEffect, skeleton, result, settings.heavyIds, settings.looseIds]);
  const ghostPaths = useMemo(() => {
    if (compare || picking || original || !result || (!ghost && !litIds.size)) return [];
    const t = Math.round(Math.max(interval[0], Math.min(interval[1], time))), was = sampleNodeMatrices(model, t, seq), now = sampleNodeMatrices(withTracks(model, magnified || result.tracks), t, seq);
    const at = (matrices, id) => skeleton.pivots.get(id).clone().applyMatrix4(matrices.get(id) || new Matrix4());
    const paths = [];
    for (const [p, c] of skeleton.links) if (litIds.has(c)) paths.push({ points: [at(now, p).toArray(), at(now, c).toArray()], color: '#ffe14d', width: 7, alpha: 0.55 });
    // Only the bones that moved most are drawn, so the unit itself stays easy to see.
    if (ghost) {
      const moved = skeleton.links.map(([p, c]) => { const b = at(was, c), b2 = at(now, c); return { p, c, b, b2, share: b2.distanceTo(b) / skeleton.size }; }).filter(link => link.share >= 0.006).sort((x, y) => y.share - x.share).slice(0, 12);
      for (const { p, c, b, b2, share } of moved) {
        paths.push({ points: [at(was, p).toArray(), b.toArray()], color: '#ffffff', width: 1.5, dash: [4, 3], alpha: 0.7 });
        paths.push({ points: [at(now, p).toArray(), b2.toArray()], color: heat(share), width: 3.5, alpha: 0.95, marker: 1 });
      }
    }
    return paths;
  }, [ghost, compare, picking, original, result, magnified, litIds, skeleton, time, seq, model]);
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
  // Cards: clicking one opens its controls and switches it on; the switch turns it off,
  // and on again at the value it had.
  const lastOn = useRef({});
  const effectActive = e => e.key ? settings[e.key] > 0 : settings.thunks.length + settings.flinches.length > 0;
  const toggleEffect = e => { if (settings[e.key] > 0) { lastOn.current[e.key] = settings[e.key]; change(e.key, 0); } else change(e.key, lastOn.current[e.key] || e.on); };
  const selectEffect = e => { setSelected(s => s === e.id ? null : e.id); if (e.key && !(settings[e.key] > 0)) change(e.key, lastOn.current[e.key] || e.on); };
  const clampTime = t => Math.round(Math.max(interval[0], Math.min(interval[1], t)));
  const addMarker = key => update(old => ({ ...old, [key]: [...new Set([...old[key], clampTime(time)])].sort((a, b) => a - b) }));
  // THUNK sound: chosen from the game's own sound list, heard in the preview at
  // each THUNK, and written as a sound event so it plays in game.
  const [sounds, setSounds] = useState(null), [soundError, setSoundError] = useState(''), audio = useRef(new Map()), lastTime = useRef(time);
  const loadSounds = () => {
    if (sounds || soundError) return;
    if (!window.desktop?.resolveEventResources) { setSoundError('The sound list needs the desktop app and your Warcraft III game files (Settings).'); return; }
    setSounds({ SND: [], loading: true });
    loadEventCatalog(modelPath).then(catalog => { setSounds(catalog); if (!catalog.SND.length) setSoundError('No sounds found in the configured game files.'); }, cause => { setSounds(null); setSoundError(cause.message); });
  };
  const soundFor = async id => {
    if (audio.current.has(id)) return audio.current.get(id);
    const file = sounds?.SND?.find(sound => sound.id === id)?.files?.[0];
    if (!file) return null;
    const { bytes, mime } = await resolveEventSound(window.desktop.resolveEventResources, file, modelPath);
    const element = new Audio(URL.createObjectURL(new Blob([bytes], { type: mime })));
    audio.current.set(id, element);
    return element;
  };
  const playSound = async id => { try { const element = await soundFor(id); if (element) { element.currentTime = 0; await element.play(); } } catch (cause) { setSoundError(cause.message); } };
  // Sounds play in the preview whenever playback passes a THUNK or a flinch.
  useEffect(() => {
    const before = lastTime.current; lastTime.current = time;
    if (!playing || original) return;
    const passed = list => list.some(at => (before <= time ? at > before && at <= time : at > before || at <= time));
    if (settings.thunkSound && passed(settings.thunks)) playSound(settings.thunkSound);
    if (settings.flinchSound && passed(settings.flinches)) playSound(settings.flinchSound);
  }, [time]);
  // Each sound becomes a sound event so it plays in game: THUNKs on the weapon,
  // flinches on the body that takes the hit.
  const soundEvents = (thunks, flinches) => [
    settings.thunkSound && thunks.length && { id: settings.thunkSound, frames: thunks, on: settings.heavyIds },
    settings.flinchSound && flinches.length && { id: settings.flinchSound, frames: flinches, on: [result?.rig?.body].filter(id => id != null) },
  ].filter(Boolean);
  const withSound = soundEvents(settings.thunks, settings.flinches).length > 0;
  const addSoundEvent = (m, { id, frames, on }) => {
    const nodes = allNodes(m), holderId = on.find(candidate => nodes.some(node => node.ObjectId === candidate));
    const event = createNode(m, 'EventObject');
    event.Name = `SNDx${id}`;
    if (holderId != null) {
      const holder = nodes.find(node => node.ObjectId === holderId), pivot = new Float32Array(nodePivot(m, holder, holderId));
      event.Parent = holderId; event.PivotPoint = pivot; m.PivotPoints[event.ObjectId] = pivot;
    }
    event.EventTrack = new Uint32Array([...new Set(frames)].sort((a, b) => a - b));
  };
  // Keep the original: copy the animation, shape the copy. Markers and retimed
  // poses move with the copy's time range.
  const commitAsNew = () => {
    if (!result?.tracks.length) return;
    const name = sequences[seq].Name || 'Animation', taken = new Set(sequences.map(s => s.Name));
    const copyName = uniqueName(`${name} (AnimXL)`, taken, n => `${name} (AnimXL ${n})`);
    let created = -1;
    const sections = ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras', ...(withSound ? ['EventObjects', 'PivotPoints', 'Info'] : [])];
    if (edit(`AnimXL: new animation from ${name}`, sections, m => {
      created = createSequenceFromCurrent(m, seq);
      const offset = m.Sequences[created].Interval[0] - m.Sequences[seq].Interval[0];
      setSequenceName(m, created, copyName);
      const shifted = { ...shaping, range: settings.range ? settings.range.map(t => t + offset) : null, thunks: settings.thunks.map(t => t + offset), flinches: settings.flinches.map(t => t + offset), retime: Object.fromEntries(Object.entries(settings.retime || {}).map(([k, v]) => [Number(k) + offset, v + offset])) };
      applyAnimXL(m, buildAnimXL(m, created, shifted));
      for (const sound of soundEvents(shifted.thunks, shifted.flinches)) addSoundEvent(m, sound);
    }) === false) return;
    writeSaved(keyFor(seq), null);
    onClose();
  };
  const commit = () => {
    if (!result?.tracks.length) return;
    // Other picked animations get the same sliders and bones; hit markers belong to this animation only.
    const shared = { ...shaping, thunks: [], flinches: [], retime: {}, range: null }, name = sequences[seq].Name || 'animation';
    const label = also.length ? `AnimXL: ${name} + ${also.length} more` : `AnimXL: ${name}`;
    const shaped = currentResult();
    const sections = withSound ? ['Nodes', 'EventObjects', 'PivotPoints', 'Info'] : ['Nodes'];
    if (edit(label, sections, m => {
      applyAnimXL(m, shaped);
      for (const index of also) applyAnimXL(m, buildAnimXL(m, index, shared));
      for (const sound of soundEvents(settings.thunks, settings.flinches)) addSoundEvent(m, sound);
    }) === false) return;
    // A section commit keeps AnimXL open with the same cards, ready for the next section.
    if (sectionOn) { setSettings(old => ({ ...old, range: [old.range[1], old.range[1]] })); return; }
    writeSaved(keyFor(seq), null);
    onClose();
  };
  const span = Math.max(1, interval[1] - interval[0]), pct = t => `${((t - interval[0]) / span) * 100}%`;
  const stripTime = (event, box) => clampTime(interval[0] + Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * span);
  const stripDown = event => {
    const box = event.currentTarget.getBoundingClientRect(), x = event.clientX - box.left;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlaying(false);
    // Shift-drag (or Pick section, then drag) marks the section to shape.
    if (event.shiftKey || armed) { const t = stripTime(event, box); drag.current = { section: t, box }; setDraft([t, t]); return; }
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
    if (d.section !== undefined) { setDraft(d.section < t ? [d.section, t] : [t, d.section]); setTime(t); return; }
    if (d.key) { update(old => ({ ...old, [d.key]: old[d.key].map(x => x === d.at ? t : x).sort((a, b) => a - b) })); d.at = t; setTime(t); }
    else if (d.pose !== undefined) { update(old => ({ ...old, retime: { ...old.retime, [d.pose]: t } })); setTime(t); }
    else setTime(t);
  };
  const stripUp = () => {
    const d = drag.current; drag.current = null;
    if (d?.section === undefined) return;
    if (draft && draft[1] - draft[0] >= 30) update(old => ({ ...old, range: draft }));
    setDraft(null); setArmed(false);
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
      if (list.includes(id)) return { ...old, [picking]: list.filter(x => x !== id) };
      // A bone is either heavy or loose, never both; feet are independent.
      return picking === 'footIds' || picking === 'stiffIds' ? { ...old, [picking]: [...list, id] } : { ...old, [picking]: [...list, id], [other]: old[other].filter(x => x !== id) };
    });
  };
  // Motion graph on the strip: how much the whole unit moves over time, the original as a
  // grey line and AnimXL as an orange area. Easing, wind-ups, holds and falls show as shapes.
  const graph = useMemo(() => {
    const m = result?.motion;
    if (!m?.frames?.length) return null;
    const top = Math.max(1e-6, ...m.original, ...m.shaped), x = f => ((f - interval[0]) / span * 1000).toFixed(1), y = v => (96 - v / top * 88).toFixed(1);
    const line = values => values.map((v, i) => `${i ? 'L' : 'M'}${x(m.frames[i])} ${y(v)}`).join('');
    return { original: line(m.original), shaped: `${line(m.shaped)}L${x(m.frames.at(-1))} 100L${x(m.frames[0])} 100Z` };
  }, [result, interval[0], span]);
  const footfalls = result?.footfalls || [];
  const selectedEffect = EFFECTS.find(e => e.id === selected);
  const status = outcome.error ? outcome.error : sectionDone ? 'Section committed. Drag over the next part of the timeline to shape it.' : target === 'selected' && !selection.length ? 'Click bones or POSE handles in the preview to choose what to shape.' : original ? 'Showing the original animation.' : picking ? 'Click bones in the preview to add or remove them.' : result?.tracks.length ? `${new Set(result.tracks.map(t => t.id)).size} bones shaped · ${result.keyCount} keys` : 'Switch an effect on to shape the animation.';

  useWindowHotkeys('animxl', windowCommandActions('animxl', 'AnimXL', {undo: () => undoSettings(false), redo: () => undoSettings(true), play: () => setPlaying(v => !v)}).map(action => ({...action, allowInInput: action.bindingCommand !== 'play'})));
  useWindowKeyClaim(({event, localWindow}) => {
    if (localWindow !== dialog.current || event.key !== 'Escape') return false;
    if (naming != null && event.target.closest('[aria-label="Preset name"]')) { setNaming(null); return true; }
    if (picking) { setPicking(null); return true; }
    return false;
  });
  return <ToolWindow title="AnimXL" overlayClass="resource-editor anim-xl" className="re-window ax-window" headerClass="re-caption" closeClass="re-caption-close" closeTitle="Close without changing the animation" windowRef={dialog} onClose={onClose} sectionProps={{'data-hotkey-prefix':'animxl', 'data-hotkey-scope':'animxl'}}>
      <div className="ax-toolbar">
        <label title="The animation to shape">Animation <select aria-label="Animation" value={seq} onChange={event => setSeq(Number(event.target.value))}>{sequences.map((s, i) => <option key={i} value={i}>{s.Name || `Animation ${i + 1}`}</option>)}</select></label>
        <button data-hotkey="animxl:play" data-hotkey-absolute onClick={() => setPlaying(v => !v)} title="Play or pause the preview">{playing ? 'Pause' : 'Play'}</button>
        {/* The preview's speed is a percentage: 100 plays in real time. */}
        {[100, 50, 25].map(value => <button key={value} aria-pressed={speed === value} title={`Play at ${value}% speed. This only changes the preview.`} onClick={() => setSpeed(value)}>{value}%</button>)}
        <button aria-pressed={original} disabled={compare} title="Show the animation without AnimXL to compare" onClick={() => setOriginal(v => !v)}>Original</button>
        <button aria-pressed={arcs} disabled={arcWeapon == null} title={arcWeapon == null ? 'Pick a heavy or loose bone to see the arc it draws' : 'Draw the arc the chosen bone\'s tip follows: dashed for the original, orange for the AnimXL version'} onClick={() => setArcs(v => !v)}>Arcs</button>
        {arcs && arcChoices.length > 1 && <select aria-label="Arc bone" title="Which bone's arc to draw" value={arcWeapon ?? ''} onChange={event => setArcPick(Number(event.target.value))}>{arcChoices.map(id => <option key={id} value={id}>{boneOptions.get(id)}</option>)}</select>}
        <button aria-pressed={compare} title="Show the original (left) and the AnimXL version (right) side by side, playing together" onClick={() => { cameraBus.current = { saved: null, listeners: new Set() }; setCompare(v => !v); setOriginal(false); }}>Side by side</button>
        <button aria-pressed={ghost} title="Ghost: the original skeleton (dashed white) under the AnimXL skeleton. Bones turn yellow, orange and red the more AnimXL moved them." onClick={() => setGhost(v => !v)}>Ghost</button>
        <button aria-pressed={magnify} className="ax-magnify" title="Show every change three times as strong, so small differences are easy to see. Only the preview; Commit writes the real result." onClick={() => setMagnify(v => !v)}>×3</button>
        <span className="ax-time" title="Current time in this animation">{Math.round(time - interval[0])} / {span} ms</span>
      </div>
      <div className="ax-body">
        <div className="ax-preview-pane">
          <div className={compare ? 'ax-previews ax-compare' : 'ax-previews'}>
          {compare && <div className="ax-preview" aria-label="Original animation">
            <span className="ax-badge">Original</span>
            <Suspense fallback={<span>Loading preview…</span>}>
              <GamePreview presentation="preview" interactivePreview fitModel model={model} revision={doc.revision} textureAssets={textureAssets} modelPath={modelPath} teamColor={teamColor} sequenceIndex={seq} time={time} playing={playing} playbackSpeed={speed} liveNodeTracks={originalTracks} compareCamera={cameraBus.current} preserveCameraView overlayPaths={originalPath ? [originalPath] : undefined}/>
            </Suspense>
          </div>}
          <div className="ax-preview" aria-label="AnimXL animation">
            {compare && <span className="ax-badge ax-badge-new">AnimXL</span>}
            <Suspense fallback={<span>Loading preview…</span>}>
              <GamePreview key={compare ? 'compare' : 'single'} presentation="preview" interactivePreview fitModel model={model} revision={doc.revision} textureAssets={textureAssets} modelPath={modelPath} teamColor={teamColor} sequenceIndex={seq} time={time} playing={playing} playbackSpeed={speed} onTimeChange={setTime} liveNodeTracks={liveTracks} overlayPaths={compare ? (shapedPath ? [shapedPath] : undefined) : [...ghostPaths, originalPath, shapedPath].filter(Boolean)} {...(compare ? { compareCamera: cameraBus.current, preserveCameraView: true } : {})}
                {...(target === 'selected' && !picking && !compare ? { cleanAnimationPreview: true, overlays: { bones: true }, selectedNodeIds: selection, onSelectNodes: selectFromPreview, multiple: true, transformMode: 'select', poseConfig, poseDocumentModel: model, onPoseSelect: selectHandle, onPoseCommit: () => {} } : {})}
                {...(picking ? { cleanAnimationPreview: true, overlays: { bones: true }, selectedNodeIds: [], onSelectNodes: pickBone } : {})}/>
            </Suspense>
          </div>
          </div>
          <div className="ax-section-bar">
            <button aria-pressed={armed} onClick={() => setArmed(v => !v)} title="Then drag on the timeline over the part you want to shape. Shift-drag on the timeline works too.">Pick section</button>
            {sectionOn ? <span className="ax-section-on">Section {Math.round(settings.range[0] - interval[0])}–{Math.round(settings.range[1] - interval[0])} ms</span>
              : sectionDone ? <span>Drag the next section on the timeline</span>
              : <span>Whole animation</span>}
            {settings.range && <button onClick={() => change('range', null)} title="Shape the whole animation again">Whole animation</button>}
            {armed && <small>Drag on the timeline now</small>}
          </div>
          <div className={`ax-strip${armed ? ' ax-strip-picking' : ''}`} role="slider" aria-label="Animation time" aria-valuemin={interval[0]} aria-valuemax={interval[1]} aria-valuenow={Math.round(time)} title="Diamonds: your key poses. Green ticks: footfalls. Stars: hit stops. Red marks: hit reactions. Click to jump. Drag a diamond to change when that pose happens (double-click it to put it back); drag a star or red mark to move it. Shift-drag to pick a section to shape on its own." onPointerDown={stripDown} onPointerMove={stripMove} onPointerUp={stripUp} onDoubleClick={resetPose}>
            {(draft || sectionOn) && (([a, b]) => <>
              <i className="ax-dim" style={{ left: 0, width: pct(a) }}/>
              <i className="ax-band" style={{ left: pct(a), width: `${(b - a) / span * 100}%` }}/>
              <i className="ax-dim" style={{ left: pct(b), right: 0 }}/>
            </>)(draft || settings.range)}
            {graph && <svg className="ax-graph" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
              <path className="ax-graph-shaped" d={graph.shaped}/>
              <path className="ax-graph-original" d={graph.original}/>
            </svg>}
            {(result?.keyTimes || []).map((t, i) => <i key={'k' + i} className={t !== result.sourceKeyTimes[i] ? 'ax-key ax-key-moved' : 'ax-key'} style={{ left: pct(t) }}/>)}
            {settings.steps > 0 && footfalls.map(t => <i key={'f' + t} className="ax-foot" style={{ left: pct(t) }}/>)}
            {settings.thunks.map(t => <i key={'t' + t} className="ax-thunk" style={{ left: pct(t) }}>★</i>)}
            {settings.flinches.map(t => <i key={'x' + t} className="ax-flinch" style={{ left: pct(t) }}>✕</i>)}
            <i className="ax-head" style={{ left: pct(clampTime(time)) }}/>
          </div>
        </div>
        <div className="ax-controls">
          {result?.dense && <p className="ax-note ax-dense" title="AnimXL treats the moments where the body slows to a stop as the poses.">This animation is already keyed in detail, so changes are subtle. Turn on ×3 to see them clearly.</p>}
          <div className="ax-presets" role="group" aria-label="Quick start">
            {PRESETS.map(([name, tip, values]) => <button key={name} className="ax-preset" title={tip} onClick={() => update(old => ({ ...old, ...values }))}>{name}</button>)}
            {userPresets.map(preset => <span key={preset.name} className="ax-user-preset"><button className="ax-preset" title={`Use your preset "${preset.name}"`} onClick={() => update(old => ({ ...old, ...preset.values }))}>{preset.name}</button><button className="ax-chip" aria-label={`Delete preset ${preset.name}`} title={`Delete your preset "${preset.name}"`} onClick={() => saveUserPresets(userPresets.filter(p => p !== preset))}>×</button></span>)}
          </div>
          <div className="ax-target" role="group" aria-label="Apply to">
            <span>Apply to</span>
            <button aria-pressed={target === 'auto'} onClick={() => setTarget('auto')} title="AnimXL decides which bones each effect moves: it detects the weapon, cloth, feet and body.">Auto</button>
            <button aria-pressed={target === 'selected'} onClick={() => setTarget('selected')} title="Effects shape only the bones you select. Click bones or POSE handles in the preview; click again to deselect.">Selected bones</button>
            {target === 'selected' && <b>{selection.length}</b>}
            {target === 'selected' && selection.length > 0 && <button onClick={() => setSelection([])} title="Deselect all bones">Clear</button>}
          </div>
          {target === 'selected' && <small className="ax-note ax-selection">{selection.length ? selection.map(id => boneOptions.get(id)).join(', ') : 'Click bones or POSE handles in the preview to select them. Click again to deselect.'}</small>}
          <div className="ax-cards">
            {EFFECTS.map(e => <EffectCard key={e.id} effect={e} value={e.key ? settings[e.key] : 0} active={effectActive(e)} selected={selected === e.id} onSelect={() => selectEffect(e)} onToggle={() => toggleEffect(e)} onHover={setHover}/>)}
          </div>
          {selectedEffect
            ? <div className="ax-tray" role="group" aria-label={`${selectedEffect.name} settings`}>
                <div className="ax-tray-title"><b>{selectedEffect.name}</b><small>{selectedEffect.tip}</small></div>
                {selectedEffect.key && <Slider id={selectedEffect.key} label={selectedEffect.name} low={selectedEffect.low} high={selectedEffect.high} tip={selectedEffect.tip} value={settings[selectedEffect.key]} onChange={change}/>}
                {selectedEffect.id === 'weapon' && <>
                  <small className="ax-note">{target === 'selected' ? 'Applies to your selected bones.' : `Detected: ${settings.heavyIds.map(id => boneOptions.get(id)).filter(Boolean).join(', ') || 'none'}. Switch Apply to Selected bones to choose others.`}</small>
                  <label className="ax-check" title="If the other hand holds the weapon too (a two-handed grip), it stays on the weapon while the weapon drags."><input type="checkbox" checked={settings.grip !== false} onChange={event => change('grip', event.target.checked)}/> Keep both hands on the weapon</label>
                </>}
                {selectedEffect.id === 'cloth' && <small className="ax-note">{target === 'selected' ? (settings.heavy > 0 ? 'Drag is on, so your selected bones drag instead. Turn Drag off to use Secondary Motion on them.' : 'Applies to your selected bones.') : `Detected: ${settings.looseIds.map(id => boneOptions.get(id)).filter(Boolean).join(', ') || 'none'}. Switch Apply to Selected bones to choose others.`}</small>}
                {selectedEffect.id === 'steps' && <small className="ax-note">{footfalls.length ? `${footfalls.length} footfall${footfalls.length > 1 ? 's' : ''} found: the green ticks on the timeline.` : 'No feet touch the ground in this animation. Pick the feet under Fine-tune.'}</small>}
                {selectedEffect.id === 'hits' && <>
                  <small className="ax-note">Pause where the hit lands, then add it. Drag a mark on the timeline to move it.</small>
                  <div className="ax-chips">{settings.thunks.map(t => <button key={t} className="ax-chip" title="Remove this hit stop" onClick={() => change('thunks', settings.thunks.filter(x => x !== t))}>★ {t - interval[0]} ms ×</button>)}</div>
                  <button onClick={() => addMarker('thunks')} title="Hit stop at the current time: the pose holds briefly at the moment of impact and heavy parts recoil.">Add hit stop here</button>
                  <Slider id="thunk" label="Hit stop" low="Short" high="Long" tip="How long the hit stop holds and how strongly heavy parts recoil." value={settings.thunk} onChange={change}/>
                  <SoundPicker label="Hit stop sound" tip="A sound played at each hit stop: heard in the preview, and written as a sound event on the weapon on Commit so it plays in game." value={settings.thunkSound} sounds={sounds} onOpen={loadSounds} onPlay={playSound} onChange={id => change('thunkSound', id)}/>
                  {soundError && <small className="ax-note">{soundError}</small>}
                  <div className="ax-chips">{settings.flinches.map(t => <button key={t} className="ax-chip ax-chip-flinch" title="Remove this hit reaction" onClick={() => change('flinches', settings.flinches.filter(x => x !== t))}>✕ {t - interval[0]} ms ×</button>)}</div>
                  <button onClick={() => addMarker('flinches')} title="Hit reaction at the current time: the body is knocked back and the torso recoils, then recovers.">Add hit reaction here</button>
                  <label className="ax-check" title="Hit reactions come from behind: the body is pushed forward instead of back."><input type="checkbox" checked={settings.flinchBehind} onChange={event => change('flinchBehind', event.target.checked)}/> Hit from behind</label>
                  <Slider id="flinch" label="Hit reaction" low="Weak" high="Strong" tip="How strongly the unit is knocked back by each hit reaction." value={settings.flinch} onChange={change}/>
                  <SoundPicker label="Reaction sound" tip="A sound played at each hit reaction: heard in the preview, and written as a sound event on the body on Commit so it plays in game." value={settings.flinchSound} sounds={sounds} onOpen={loadSounds} onPlay={playSound} onChange={id => change('flinchSound', id)}/>
                </>}
                {selectedEffect.id === 'collapse' && <>
                  <Slider id="collapseAt" label="Start time" low="Start" high="End" tip="When the fall begins, as a share of the animation. Before it the animation plays as keyed." value={settings.collapseAt} onChange={change}/>
                  <label className="ax-field" title="How the unit dies. Each type first poses the body the way Warcraft III deaths do (knees buckle, the torso leans), then gravity takes over for the fall and landing. Limp only goes slack and drops.">Death type
                    <select aria-label="Death type" value={settings.collapseStyle} onChange={event => change('collapseStyle', event.target.value)}>
                      <option value="auto">Auto{result?.rig?.deathStyle && settings.collapseStyle === 'auto' ? ` (${DEATH_NAMES[result.rig.deathStyle]})` : ''}</option>
                      {Object.entries(DEATH_NAMES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                    </select>
                  </label>
                  {['limp', 'side'].includes(result?.rig?.deathStyle ?? 'limp') && <label className="ax-field" title={result?.rig?.deathStyle === 'side' ? 'The side the unit falls onto.' : 'The direction the unit falls in.'}>Direction
                    <select aria-label="Fall direction" value={settings.collapseDir} onChange={event => change('collapseDir', event.target.value)}>
                      <option value="auto">Natural</option>{result?.rig?.deathStyle !== 'side' && <><option value="back">Backwards</option><option value="forward">Forwards</option></>}<option value="left">To its left</option><option value="right">To its right</option>
                    </select>
                  </label>}
                  <Slider id="bounce" label="Bounce" low="None" high="High" tip="How much the body rebounds on impact with the ground." value={settings.bounce} onChange={change}/>
                  {result?.rig?.machine ? <small className="ax-note">AnimXL found no legs or arms on this rig, so Fall Simulation has nothing to buckle and leaves it as it is.</small> : <small className="ax-note">Auto: knees then fall on two legs; on four or more legs Limp, which falls onto the side. Use Commit as new to keep the original and add the fall as a new animation.</small>}
                  {result?.rig?.shortFall && !result?.rig?.machine && <small className="ax-note">Less than 1.3 seconds are left after Start time, so the fall may not finish landing. Move Start time earlier or use a longer animation.</small>}
                </>}
              </div>
            : <p className="ax-note ax-hint">Click a card to switch an effect on and tune it. Point at a card to light up the bones it moves.</p>}
          <Section className="ax-section" defaultOpen={false} title="Fine-tune" note={[movedPoses && `${movedPoses} pose${movedPoses > 1 ? 's' : ''} moved`, settings.stiffIds.length && `${settings.stiffIds.length} stiff`, also.length && `${also.length} more animations`].filter(Boolean).join(', ')}>
            <Slider id="poses" label="Stick to my poses" low="Loose" high="Exact" tip="How closely the result lands on your key poses. Exact keeps every pose; Loose lets follow-through and wobble carry through them." value={settings.poses} onChange={change}/>
            <small className="ax-note">Timing: drag a diamond on the timeline to change when that pose happens; double-click it to put it back.</small>
            <button disabled={!movedPoses} onClick={() => update(old => ({ ...old, retime: {} }))} title="Put every pose back at its original time">Reset timing</button>
            <label className="ax-check" title="Feet stay exactly where your animation puts them. The body still sinks and sways; the knees bend to make up the difference. Legs that never touch the ground (a rider's) are left free."><input type="checkbox" checked={settings.feet !== false} onChange={event => change('feet', event.target.checked)}/> Keep feet planted</label>
            <label className="ax-field" title="The bone that carries the body's weight (usually the pelvis or root). Weight, Heavy steps, Flinch and Collapse move it.">Body
              <select aria-label="Body bone" value={settings.bodyId ?? ''} onChange={event => change('bodyId', event.target.value === '' ? null : Number(event.target.value))}>
                <option value="">Found: {boneOptions.get(result?.rig?.body) || 'none'}</option>
                {[...boneOptions].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <span className="ax-note" title="The feet AnimXL keeps planted and listens to for footfalls.">Feet{settings.footIds.length ? ' (your picks)' : `: found ${(result?.rig?.feet || []).map(id => boneOptions.get(id)).filter(Boolean).join(', ') || 'none'}`}</span>
            <BonePicker label="feet" tip="Pick each foot (ankle) bone if AnimXL did not find the right ones. Its leg is the foot and its two parent bones." ids={settings.footIds} options={boneOptions} onChange={ids => change('footIds', ids)} picking={picking === 'footIds'} onPick={() => setPicking(p => p === 'footIds' ? null : 'footIds')}/>
            <small className="ax-note">Stiff bones and everything below them follow exactly: no lag, wobble or drag. For example a mount's legs, or face and portrait bones.</small>
            <BonePicker label="stiff bones" tip="Pick bones to keep exact; everything below them stays exact too." ids={settings.stiffIds} options={boneOptions} onChange={ids => change('stiffIds', ids)} picking={picking === 'stiffIds'} onPick={() => setPicking(p => p === 'stiffIds' ? null : 'stiffIds')}/>
            <small className="ax-note">Also apply to: Commit shapes these animations too, with the same settings. THUNKs and flinches stay on this animation.</small>
            <div className="ax-also">{sequences.map((s, i) => i === seq ? null : <label key={i} title={`Shape ${s.Name || 'this animation'} too when you commit`}><input type="checkbox" checked={also.includes(i)} onChange={event => setAlso(list => event.target.checked ? [...list, i] : list.filter(x => x !== i))}/> {s.Name || `Animation ${i + 1}`}</label>)}</div>
            {naming === null
              ? <button title="Remember the current settings as your own preset button, for any model" onClick={() => setNaming('')}>Save as preset…</button>
              : <div className="ax-row"><input aria-label="Preset name" placeholder="Preset name" value={naming} maxLength={24} autoFocus onChange={event => setNaming(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') savePreset(); }}/><button disabled={!naming.trim()} onClick={savePreset}>Save</button><button onClick={() => setNaming(null)}>Cancel</button></div>}
          </Section>
        </div>
      </div>
      <footer className="ax-footer">
        <span className="ax-status" role="status">{status}</span>
        <button data-hotkey="animxl:undo" data-hotkey-absolute onClick={() => undoSettings(false)} title="Undo the last slider change">Undo</button>
        <button onClick={() => update(old => ({ ...ANIMXL_DEFAULTS, heavyIds: old.heavyIds, looseIds: old.looseIds }))} title="Set every slider back to its start and remove all THUNKs and flinches">Reset</button>
        <button disabled={!result?.tracks.length || doc.readOnly} onClick={commitAsNew} title={`Keep ${sequences[seq]?.Name || 'this animation'} as it is and add the shaped version as a new animation named "${sequences[seq]?.Name || 'Animation'} (AnimXL)". Rename it in Animations if you want the game to use it.`}>Commit as new</button>
        <button disabled={!result?.tracks.length || doc.readOnly} onClick={commit} title="Write the shaped animation as ordinary keyframes. One Undo reverts it.">{sectionOn ? 'Commit section' : also.length ? `Commit ${also.length + 1} animations` : 'Commit'}</button>
        <button onClick={onClose} title="Close without changing the animation. Your slider settings are remembered for this animation.">Cancel</button>
      </footer>
  </ToolWindow>;
}
