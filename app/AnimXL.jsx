import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import useMovableWindow from './useMovableWindow.js';
import { ANIMXL_DEFAULTS, animXLNodes, applyAnimXL, buildAnimXL, suggestAnimXLBones } from '../src/anim-xl.js';
import { allNodes } from '../src/animation.js';
import './resource-editors.css';
import './anim-xl.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));

const SLIDERS = [
  ['ease', 'Ease', 'Linear', 'Snappy', 'Speeds up out of each pose and slows into the next one, instead of moving at one even speed. Your poses stay where they are.'],
  ['overlap', 'Overlap', 'Stiff', 'Loose', 'Parts further from the body follow a moment later: the hips lead, then chest, arms, hands and weapon. The single biggest fix for robotic motion.'],
  ['settle', 'Settle', 'Dead stop', 'Bouncy', 'Parts overshoot a pose slightly and wobble back into it, instead of stopping dead.'],
  ['weight', 'Weight', 'Light', 'Heavy', 'The whole body is slower to start and stop moving, as if it were heavier.'],
];

function Slider({ id, label, low, high, tip, value, onChange }) {
  return <label className="ax-slider" title={tip}>
    <span className="ax-slider-row"><span>{label}</span><output>{value}</output></span>
    <input type="range" min="0" max="100" step="1" value={value} aria-label={label} title={tip} onChange={event => onChange(id, Number(event.target.value))}/>
    <span className="ax-ends"><span>{low}</span><span>{high}</span></span>
  </label>;
}

function BonePicker({ label, tip, ids, options, onChange }) {
  const chosen = new Set(ids);
  return <div className="ax-bones" title={tip}>
    <span>{label}</span>
    <div className="ax-chips">
      {ids.length ? ids.map(id => <button key={id} className="ax-chip" title={`Remove ${options.get(id) ?? id}`} onClick={() => onChange(ids.filter(x => x !== id))}>{options.get(id) ?? `#${id}`} ×</button>) : <small>None picked</small>}
    </div>
    <select aria-label={`Add ${label.toLowerCase()}`} title={tip} value="" onChange={event => { const id = Number(event.target.value); if (Number.isInteger(id) && !chosen.has(id)) onChange([...ids, id]); }}>
      <option value="">Add bone…</option>
      {[...options].filter(([id]) => !chosen.has(id)).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
  </div>;
}

/** AnimXL: shape a hand-keyed animation with a few sliders, see it live, commit as plain keys. */
export default function AnimXL({ doc, edit, sequenceIndex, textureAssets, preferences, teamColor, modelPath, onClose }) {
  const model = doc.model, sequences = model.Sequences || [];
  const [seq, setSeq] = useState(sequenceIndex >= 0 && sequences[sequenceIndex] ? sequenceIndex : 0);
  const [settings, setSettings] = useState(() => ({ ...ANIMXL_DEFAULTS, ...suggestAnimXLBones(model) }));
  const interval = sequences[seq] ? Array.from(sequences[seq].Interval) : [0, 1000];
  const [time, setTime] = useState(interval[0]), [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(1);
  const [original, setOriginal] = useState(false);
  const dialog = useRef(null), movable = useMovableWindow(dialog), touched = useRef(new Set());
  const boneOptions = useMemo(() => new Map(animXLNodes(model).map(node => [node.ObjectId, node.Name || `Bone ${node.ObjectId}`])), [model, doc.revision]);

  useEffect(() => { setTime(interval[0]); }, [seq]);
  useEffect(() => { dialog.current?.focus(); }, []);

  const outcome = useMemo(() => {
    if (!sequences[seq]) return { error: 'This model has no animations yet. Create one in Movement first.' };
    try { return { result: buildAnimXL(model, seq, settings) }; }
    catch (error) { return { error: error.message }; }
  }, [model, doc.revision, seq, settings]);
  const result = outcome.result;

  // Tracks for the preview: the shaped result, or the originals when comparing.
  const liveTracks = useMemo(() => {
    const byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
    const shaped = original || !result ? [] : result.tracks;
    for (const item of shaped) touched.current.add(item.id);
    const shapedIds = new Set(shaped.map(item => item.id));
    const restore = [...touched.current].filter(id => !shapedIds.has(id) && byId.has(id)).map(id => ({ id, property: 'Rotation', track: byId.get(id).Rotation }));
    return [...shaped, ...restore];
  }, [result, original, model]);

  const change = (key, value) => setSettings(old => ({ ...old, [key]: value }));
  const addThunk = () => {
    const at = Math.round(Math.max(interval[0], Math.min(interval[1], time)));
    setSettings(old => ({ ...old, thunks: [...new Set([...old.thunks, at])].sort((a, b) => a - b) }));
  };
  const commit = () => {
    if (!result?.tracks.length) return;
    if (edit(`AnimXL: ${sequences[seq].Name || 'animation'}`, ['Nodes'], m => applyAnimXL(m, result)) === false) return;
    onClose();
  };
  const span = Math.max(1, interval[1] - interval[0]), pct = t => `${((t - interval[0]) / span) * 100}%`;
  const scrub = event => {
    const box = event.currentTarget.getBoundingClientRect(), u = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    setPlaying(false); setTime(Math.round(interval[0] + u * span));
  };

  return <div className="resource-editor anim-xl" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName)) { event.preventDefault(); setPlaying(v => !v); }
  }}>
    <section ref={dialog} style={movable.style} tabIndex={-1} className="re-window ax-window" role="dialog" aria-modal="true" aria-label="AnimXL">
      <header className="re-caption" {...movable.handleProps}><span>AnimXL</span><button className="re-caption-close" aria-label="Close AnimXL" title="Close without changing the animation" onClick={onClose}>×</button></header>
      <div className="ax-toolbar">
        <label title="The animation to shape">Animation <select aria-label="Animation" value={seq} onChange={event => setSeq(Number(event.target.value))}>{sequences.map((s, i) => <option key={i} value={i}>{s.Name || `Animation ${i + 1}`}</option>)}</select></label>
        <button onClick={() => setPlaying(v => !v)} title="Play or pause the preview (Space)">{playing ? 'Pause' : 'Play'}</button>
        {[1, 0.5, 0.25].map(value => <button key={value} aria-pressed={speed === value} title={`Play at ${value * 100}% speed. This only changes the preview.`} onClick={() => setSpeed(value)}>{value * 100}%</button>)}
        <button aria-pressed={original} title="Show the animation without AnimXL to compare" onClick={() => setOriginal(v => !v)}>Original</button>
      </div>
      <div className="ax-body">
        <div className="ax-preview-pane">
          <div className="ax-preview">
            <Suspense fallback={<span>Loading preview…</span>}>
              <GamePreview presentation="preview" interactivePreview fitModel model={model} revision={doc.revision} textureAssets={textureAssets} modelPath={modelPath} preferences={preferences} teamColor={teamColor} sequenceIndex={seq} time={time} playing={playing} playbackSpeed={speed} onTimeChange={setTime} liveNodeTracks={liveTracks}/>
            </Suspense>
          </div>
          <div className="ax-strip" role="slider" aria-label="Animation time" aria-valuemin={interval[0]} aria-valuemax={interval[1]} aria-valuenow={Math.round(time)} title="Your key poses (diamonds) and THUNKs (stars). Click to jump to a moment." onPointerDown={scrub}>
            {(result?.keyTimes || []).map(t => <i key={'k' + t} className="ax-key" style={{ left: pct(t) }}/>)}
            {settings.thunks.map(t => <i key={'t' + t} className="ax-thunk" style={{ left: pct(t) }}>★</i>)}
            <i className="ax-head" style={{ left: pct(Math.max(interval[0], Math.min(interval[1], time))) }}/>
          </div>
        </div>
        <div className="ax-controls">
          <fieldset><legend>Motion</legend>{SLIDERS.map(([id, label, low, high, tip]) => <Slider key={id} {...{ id, label, low, high, tip }} value={settings[id]} onChange={change}/>)}</fieldset>
          <fieldset><legend>Heavy bones</legend>
            <BonePicker label="Bones" tip="Picked bones (usually the weapon) trail behind the swing and drag the arm holding them." ids={settings.heavyIds} options={boneOptions} onChange={ids => change('heavyIds', ids)}/>
            <Slider id="heavy" label="Heaviness" low="Dagger" high="Greatsword" tip="How heavy the picked bones are. Heavier parts lag more and overshoot further." value={settings.heavy} onChange={change}/>
          </fieldset>
          <fieldset><legend>Loose bones</legend>
            <BonePicker label="Bones" tip="Picked bones (cape, hair, tail, plume) swing loosely on their own." ids={settings.looseIds} options={boneOptions} onChange={ids => change('looseIds', ids)}/>
            <Slider id="loose" label="Looseness" low="Stiff" high="Floppy" tip="How freely the picked bones swing and wobble." value={settings.loose} onChange={change}/>
          </fieldset>
          <fieldset><legend>THUNK</legend>
            <div className="ax-chips">{settings.thunks.length ? settings.thunks.map(t => <button key={t} className="ax-chip" title="Remove this THUNK" onClick={() => change('thunks', settings.thunks.filter(x => x !== t))}>★ {t} ms ×</button>) : <small>No THUNKs. Pause on the hit and add one.</small>}</div>
            <button onClick={addThunk} title="Add a THUNK at the current moment: the animation holds this pose for a beat and heavy bones bounce back.">Add THUNK here</button>
            <Slider id="thunk" label="Hit" low="Light" high="Brutal" tip="How long the hit holds and how hard the heavy bones bounce back." value={settings.thunk} onChange={change}/>
          </fieldset>
        </div>
      </div>
      <footer className="ax-footer">
        <span className="ax-status" role="status">{outcome.error ? outcome.error : original ? 'Showing the original animation.' : result?.tracks.length ? `${result.tracks.length} bones shaped · ${result.keyCount} keys` : 'Move a slider to shape the animation.'}</span>
        <button onClick={() => setSettings(old => ({ ...ANIMXL_DEFAULTS, heavyIds: old.heavyIds, looseIds: old.looseIds }))} title="Set every slider back to zero and remove all THUNKs">Reset</button>
        <button disabled={!result?.tracks.length || doc.readOnly} onClick={commit} title="Write the shaped animation as ordinary keyframes. One Undo reverts it.">Commit</button>
        <button onClick={onClose} title="Close without changing the animation">Cancel</button>
      </footer>
    </section>
  </div>;
}
