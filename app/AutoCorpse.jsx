import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import { autoCorpse } from '../src/auto-corpse.js';
import './attachemator.css';
import './auto-corpse.css';

const OVERLAYS = { attachments: false, bones: false, helpers: false, nodes: false, particles: false, sounds: false, events: false, skeleton: false, focusedSkeleton: false };

// Same slider look as AnimXL: label and value above, plain-language ends below.
function Slider({ label, low, high, tip, value, onChange }) {
  return <label className="ax-slider" title={tip}>
    <span className="ax-slider-row"><span>{label}</span><output>{value}%</output></span>
    <input type="range" min="25" max="200" step="5" value={value} aria-label={label} title={tip} onChange={event => onChange(Number(event.target.value))}/>
    <span className="ax-ends"><span>{low}</span><span>{high}</span></span>
  </label>;
}

/** Shows the fitted corpse before it is made. Size and Height scale it; Create
 * applies it as one undoable edit, exactly like a plain CORP click did. */
export default function AutoCorpse({ doc, modelPath, textureAssets, preferences, teamColor, onCommit, onClose }) {
  const current = useMemo(() => structuredClone(doc.model), [doc.revision]);
  const [size, setSize] = useState(100), [height, setHeight] = useState(100), [withBody, setWithBody] = useState(false), [error, setError] = useState('');
  const options = useDeferredValue(useMemo(() => ({ size: size / 100, height: height / 100 }), [size, height]));
  const root = useRef(null), camera = useRef({ saved: null, listeners: new Set() }), drafts = useRef(0);
  const draft = useMemo(() => {
    const model = structuredClone(current);
    try { const result = autoCorpse(model, options); drafts.current++; return { model, corpse: result.corpses[0] }; }
    catch (cause) { return { model: current, error: cause.message }; }
  }, [current, options]);
  const { corpse } = draft, flesh = corpse && draft.model.Sequences[corpse.flesh], bone = corpse && draft.model.Sequences[corpse.bone];
  // The corpse alone as it starts to decay, or hidden under the body just
  // after it switches on, as the game first shows it.
  const sequenceIndex = corpse ? (withBody ? corpse.flesh : corpse.bone) : -1, time = corpse ? (withBody ? flesh.Interval[0] + 200 : bone.Interval[0]) : 0;

  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);
  const commit = () => {
    setError('');
    try { if (onCommit(options)) onClose(); else setError('This exact corpse is already in the model.'); }
    catch (cause) { setError(cause.message); }
  };
  const keys = event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onClose(); } };

  return <div className="atm-overlay" onKeyDown={keys}>
    <section className="atm-window acp-window" role="dialog" aria-modal="true" aria-label="Auto Corpse" data-hotkey-scope="autoCorpse" tabIndex={-1} ref={root}>
      <header><strong title="Fits a corpse under the last Death frame, then adds Decay Flesh and Decay Bone.">Auto Corpse</strong><span className="atm-spacer"/><button aria-label="Close Auto Corpse" onClick={onClose}>×</button></header>
      <div className="atm-body acp-body">
        <div className="acp-controls">
          <Slider label="Size" low="Smaller" high="Bigger" value={size} onChange={setSize}
            tip="Scales the whole corpse. 100% fits it under the body. Bigger corpses can show around the body while it sinks."/>
          <Slider label="Height" low="Flatter" high="Taller" value={height} onChange={setHeight}
            tip="How high the bones rise off the ground. Above 100% they can poke through the body while it sinks."/>
          <label className="check" title="Show the body lying over the corpse, as the game first shows it after Death.">
            <input type="checkbox" checked={withBody} onChange={event => setWithBody(event.target.checked)}/>Show body
          </label>
          <button disabled={size === 100 && height === 100} title="Back to the fitted size" onClick={() => { setSize(100); setHeight(100); }}>Reset</button>
        </div>
        <section className="atm-preview" aria-label="Auto Corpse preview">
          <GamePreview presentation="preview" interactivePreview fitModel fitSequenceExtent model={draft.model} revision={drafts.current} textureAssets={textureAssets} modelPath={modelPath} preferences={preferences} teamColor={teamColor}
            sequenceIndex={sequenceIndex} time={time} playing={false} showGrid showParticles={false} overlays={OVERLAYS} compareCamera={camera.current} preserveCameraView/>
        </section>
      </div>
      <footer>
        <span role="status" className={error || draft.error ? 'atm-error' : 'atm-muted'}>{error || draft.error || 'Drag to turn the camera.'}</span>
        <button className="atm-commit active" disabled={!!draft.error || doc.readOnly} title="Make this corpse and its decay animations as one undoable edit" onClick={commit}>Create</button>
        <button onClick={onClose}>Close</button>
      </footer>
    </section>
  </div>;
}
