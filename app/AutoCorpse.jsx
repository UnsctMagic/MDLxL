import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import CorpseStageTools, { pieceMarks } from './CorpseStageTools.jsx';
import { autoCorpse } from '../src/auto-corpse.js';
import { allNodes } from '../src/animation.js';
import { createVisibilityGeosetAnimation } from '../src/geoset-animation-defaults.js';
import { updateBounds } from '../src/mesh-tools.js';
import './attachemator.css';
import './particle-editor.css';
import './auto-corpse.css';

const OVERLAYS = { attachments: false, bones: false, helpers: false, nodes: false, particles: false, sounds: false, events: false, skeleton: false, focusedSkeleton: false };
const NAMES = { torso: 'Ribs', skull: 'Skull', arm: 'Arm', leg: 'Leg', hand: 'Hand', foot: 'Foot', branch: 'Bone', 'rigid remnant': 'Remnant' };
// New pieces: gutz atlas region, length and half-width as shares of the body.
const ADD = {
  skull: { label: 'Skull', length: .1, half: .04, rect: [.69, 0, 1, .45] },
  torso: { label: 'Ribs', length: .25, half: .08, rect: [.634, .505, .999, .995] },
  branch: { label: 'Bone', length: .15, half: .025, rect: [.006, .005, .31, .495] },
  hand: { label: 'Hand', length: .08, half: .03, rect: [.315, .75, .625, .5] },
};

// Same slider look as AnimXL: label and value above, plain-language ends below.
function Slider({ label, low, high, tip, value, onChange }) {
  return <label className="ax-slider" title={tip}>
    <span className="ax-slider-row"><span>{label}</span><output>{value}%</output></span>
    <input type="range" min="25" max="200" step="5" value={value} aria-label={label} title={tip} onChange={event => onChange(Number(event.target.value))}/>
    <span className="ax-ends"><span>{low}</span><span>{high}</span></span>
  </label>;
}

/** A chalk line around the dead body on the ground, for the preview only: the
 * corpse stays visible through it. */
function addChalkOutline(model, corpse) {
  const bone = model.Bones.find(node => node.Name === 'MDLxL Corpse 0');
  if (!bone || !corpse.outline?.length) return;
  const width = Math.max(corpse.span * .004, .4), z = .3, vertices = [], faces = [];
  for (const ring of corpse.outline) for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 1e-6) continue;
    const n = [(q[1] - p[1]) / len * width, -(q[0] - p[0]) / len * width], k = vertices.length / 3;
    vertices.push(p[0] - n[0], p[1] - n[1], z, p[0] + n[0], p[1] + n[1], z, q[0] - n[0], q[1] - n[1], z, q[0] + n[0], q[1] + n[1], z);
    faces.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  if (!faces.length) return;
  let texture = model.Textures.findIndex(t => /^textures[\\/]white\.blp$/i.test(t.Image));
  if (texture < 0) { texture = model.Textures.length; model.Textures.push({ Image: 'Textures\\white.blp', ReplaceableId: 0, Flags: 0 }); }
  model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Shading: 17, TextureID: texture, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] });
  const g = { Vertices: new Float32Array(vertices), Normals: new Float32Array(vertices.length).map((_, i) => i % 3 === 2 ? 1 : 0), TVertices: [new Float32Array(vertices.length / 3 * 2)], Faces: new Uint16Array(faces), VertexGroup: new Uint8Array(vertices.length / 3), Groups: [[bone.ObjectId]], TotalGroupsCount: 1, MaterialID: model.Materials.length - 1, SelectionGroup: 0, Unselectable: false, Anims: [] };
  updateBounds(g); model.Geosets.push(g); model.GeosetAnims.push(createVisibilityGeosetAnimation(model.Geosets.length - 1));
}

/** Shows the fitted corpse before it is made. Pieces are dragged like EMTR
 * emitters; Size, Height and colour apply to the whole corpse. Create applies
 * it as one undoable edit. */
export default function AutoCorpse({ doc, modelPath, textureAssets, preferences, teamColor, onCommit, onClose }) {
  const current = useMemo(() => structuredClone(doc.model), [doc.revision]);
  const names = useMemo(() => new Map(allNodes(current).map(node => [node.ObjectId, node.Name])), [current]);
  const [size, setSize] = useState(100), [height, setHeight] = useState(100), [rgb, setRgb] = useState([255, 255, 255]);
  const [pieces, setPieces] = useState(null), [selected, setSelected] = useState(null), [outline, setOutline] = useState(false), [error, setError] = useState(''), [snapshot, setSnapshot] = useState(null);
  const color = rgb.map(value => Math.min(255, Math.max(0, Number(value) || 0)) / 255);
  const options = useDeferredValue(useMemo(() => ({ size: size / 100, height: height / 100, color, pieces }), [size, height, rgb.join(), pieces]));
  const root = useRef(null), camera = useRef({ saved: null, listeners: new Set() }), drafts = useRef(0), api = useRef(null), framed = useRef(false);
  const draft = useMemo(() => {
    const model = structuredClone(current);
    try {
      const corpse = autoCorpse(model, options).corpses[0];
      if (outline) addChalkOutline(model, corpse);
      drafts.current++; return { model, corpse };
    } catch (cause) { return { model: current, error: cause.message }; }
  }, [current, options, outline]);
  const { corpse } = draft, shown = pieces || corpse?.pieces || [];
  const sequenceIndex = corpse ? corpse.bone : -1, time = corpse ? draft.model.Sequences[corpse.bone].Interval[0] : 0;
  // Pieces are planned before Size scales the corpse about the body's centre.
  const show = point => { const c = corpse?.sizeCenter || [0, 0], s = size / 100; return [c[0] + (point[0] - c[0]) * s, c[1] + (point[1] - c[1]) * s, (corpse?.ground || 0) * 1.5]; };
  const marks = useMemo(() => corpse ? pieceMarks(shown, selected, show) : undefined, [shown, selected, corpse, size]);
  const label = piece => `${NAMES[piece.kind] || 'Bone'}${piece.ids?.length ? ' · ' + names.get(piece.ids.at(-1)) : ''}${piece.free ? ' *' : ''}`;

  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);
  // Frame the corpse itself once, close enough to grab its handles.
  const frame = () => {
    const g = corpse && draft.model.Geosets[corpse.corpseGeoset], preview = api.current;
    if (!g || !preview || framed.current) return;
    framed.current = true;
    const [a, b] = [g.MinimumExtent, g.MaximumExtent];
    preview.whenReady().then(() => { if (api.current === preview) preview.fit([a[0], a[1], 0, b[0], b[1], b[2]]); }).catch(() => {});
  };
  useEffect(frame, [corpse]);
  // New handle points are projected on the preview's next draw.
  useEffect(() => { api.current?.invalidate(); }, [marks]);
  const edit = (index, piece) => setPieces(list => (list || corpse.pieces).map((value, i) => i === index ? piece : value));
  const remove = index => { setPieces(list => (list || corpse.pieces).filter((_, i) => i !== index)); setSelected(null); };
  const add = kind => {
    if (!corpse) return;
    const spec = ADD[kind], [cx, cy] = corpse.sizeCenter, length = corpse.span * spec.length, list = pieces || corpse.pieces;
    setPieces([...list, { kind, start: [cx - length / 2, cy, 0], end: [cx + length / 2, cy, 0], half: corpse.span * spec.half, rect: spec.rect, ids: [], free: true }]);
    setSelected(list.length);
  };
  const reset = () => { setSize(100); setHeight(100); setRgb([255, 255, 255]); setPieces(null); setSelected(null); };
  const commit = () => {
    setError('');
    try { if (onCommit(options)) onClose(); else setError('This exact corpse is already in the model.'); }
    catch (cause) { setError(cause.message); }
  };
  const keys = event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onClose(); } if (event.key === 'Delete' && selected != null && event.target === root.current) remove(selected); };
  const changed = size !== 100 || height !== 100 || rgb.join() !== '255,255,255' || pieces;

  return <div className="atm-overlay" onKeyDown={keys}>
    <section className="atm-window acp-window" role="dialog" aria-modal="true" aria-label="Auto Corpse" data-hotkey-scope="autoCorpse" tabIndex={-1} ref={root}>
      <header><strong title="Fits a corpse under the last Death frame, then adds Decay Flesh and Decay Bone.">Auto Corpse</strong><span className="atm-spacer"/><button aria-label="Close Auto Corpse" onClick={onClose}>×</button></header>
      <div className="atm-body acp-body">
        <div className="acp-controls">
          <Slider label="Size" low="Smaller" high="Bigger" value={size} onChange={setSize}
            tip="Scales the whole corpse. 100% fits it under the body. Bigger corpses can show around the body while it sinks."/>
          <Slider label="Height" low="Flatter" high="Taller" value={height} onChange={setHeight}
            tip="How high the bones rise off the ground. Above 100% they can poke through the body while it sinks."/>
          <div className="acp-color" title="Tints the whole corpse, like Color Tint in Animations."><span>Color Tint:</span><div className="acp-rgb">{['R', 'G', 'B'].map((channel, index) => <label className={`channel-${channel.toLowerCase()}`} key={channel}>{channel}<input aria-label={`Corpse ${channel}`} type="number" min="0" max="255" step="1" value={rgb[index]} onChange={event => setRgb(previous => previous.map((value, i) => i === index ? event.target.value : value))}/></label>)}</div></div>
          <div className="atm-list acp-pieces" role="listbox" aria-label="Corpse pieces">
            {shown.map((piece, index) => <div key={index} role="option" aria-selected={selected === index} className={`atm-row acp-piece${selected === index ? ' is-selected' : ''}`} onClick={() => setSelected(index)}>
              <span translate="no" title={piece.free ? 'Moved, stretched or added by you' : 'Fitted to the body'}>{label(piece)}</span>
              <button className="atm-small" aria-label={`Remove ${label(piece)}`} title="Remove this piece" onClick={event => { event.stopPropagation(); remove(index); }}>×</button>
            </div>)}
          </div>
          <div className="acp-add" role="group" aria-label="Add a piece" title="Adds a piece at the middle of the body; drag it into place in the preview.">
            {Object.entries(ADD).map(([kind, spec]) => <button key={kind} onClick={() => add(kind)}>+ {spec.label}</button>)}
          </div>
          <label className="check" title="A chalk line around where the body lies, so you can fit the corpse to it.">
            <input type="checkbox" checked={outline} onChange={event => setOutline(event.target.checked)}/>Body outline
          </label>
          <button disabled={!changed} title="Back to the fitted corpse" onClick={reset}>Reset</button>
        </div>
        <section className="atm-preview acp-preview" aria-label="Auto Corpse preview">
          <GamePreview presentation="preview" interactivePreview fitModel fitSequenceExtent model={draft.model} revision={drafts.current} textureAssets={textureAssets} modelPath={modelPath} preferences={preferences} teamColor={teamColor}
            sequenceIndex={sequenceIndex} time={time} playing={false} showGrid showParticles={false} overlays={OVERLAYS} compareCamera={camera.current} preserveCameraView
            onParticleStage={setSnapshot} particleStageMarks={marks} onCaptureReady={preview => { api.current = preview; frame(); }}/>
          <CorpseStageTools snapshot={snapshot} pieces={shown} selected={selected} scale={size / 100} onSelect={setSelected} onChange={edit}/>
        </section>
      </div>
      <footer>
        <span role="status" className={error || draft.error ? 'atm-error' : 'atm-muted'}>{error || draft.error || (selected != null ? 'Drag the handles to move, stretch or widen this piece. Delete removes it.' : 'Click a piece to fit it by hand. Drag empty space to turn the camera.')}</span>
        <button className="atm-commit active" disabled={!!draft.error || doc.readOnly} title="Make this corpse and its decay animations as one undoable edit" onClick={commit}>Create</button>
        <button onClick={onClose}>Close</button>
      </footer>
    </section>
  </div>;
}
