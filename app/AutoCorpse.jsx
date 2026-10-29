import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import CorpseStageTools, { pieceMarks } from './CorpseStageTools.jsx';
import { autoCorpse } from '../src/auto-corpse.js';
import { createVisibilityGeosetAnimation } from '../src/geoset-animation-defaults.js';
import { updateBounds } from '../src/mesh-tools.js';
import { BLOOD_KINDS, BLOOD_RACES, deathBlood, isBloodSpray, parseSplat, splatCode, sprayKind } from '../src/corpse-blood.js';
import { loadEventCatalog } from './node-event-data.js';
import './attachemator.css';
import './particle-editor.css';
import './auto-corpse.css';
import { RangeField } from './Fields.jsx';
import ToolWindow from './ToolWindow.jsx';

const seconds = ms => (ms / 1000).toFixed(2) + ' s';
const OVERLAYS = { attachments: false, bones: false, helpers: false, nodes: false, particles: false, sounds: false, events: false, skeleton: false, focusedSkeleton: false };
// Blood: splats and sprays play, without extra node markers.
const BLOOD_OVERLAYS = { ...OVERLAYS, events: true };
// New pieces: gutz atlas region, length and half-width as shares of the body.
const ADD = {
  skull: { label: 'Skull', length: .1, half: .04, rect: [.69, 0, 1, .45] },
  torso: { label: 'Ribs', length: .25, half: .08, rect: [.634, .505, .999, .995] },
  branch: { label: 'Bone', length: .15, half: .025, rect: [.006, .005, .31, .495] },
  hand: { label: 'Hand', length: .08, half: .03, rect: [.315, .75, .625, .5] },
};

// The shared slider look: label and value above, plain-language ends below.
function Slider({ label, low, high, tip, value, onChange, onStart }) {
  return <RangeField className="ax-slider" title={tip} label={label} output={`${value}%`} ends={[low, high]} min="25" max="200" step="5" value={value} inputProps={{ title: tip, onPointerDown: onStart, onKeyDown: onStart }} onChange={onChange}/>;
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
  const [size, setSize] = useState(100), [height, setHeight] = useState(100), [rgb, setRgb] = useState([255, 255, 255]);
  const [pieces, setPieces] = useState(null), [selected, setSelected] = useState(null), [outline, setOutline] = useState(true), [withBody, setWithBody] = useState(false), [error, setError] = useState(''), [snapshot, setSnapshot] = useState(null);
  // Blood tab: null means the Death animation's own blood is left untouched.
  const deathIndex = useMemo(() => current.Sequences.findIndex(seq => /(?:^|\s)death(?:\s|$)/i.test(seq.Name)), [current]);
  const ownBlood = useMemo(() => deathIndex >= 0 ? deathBlood(current, deathIndex) : [], [current, deathIndex]);
  const [tab, setTab] = useState('corpse'), [blood, setBlood] = useState(null), [bloodSelected, setBloodSelected] = useState(null), [sprays, setSprays] = useState([]);
  const [race, setRace] = useState(() => parseSplat(ownBlood.find(row => row.type === 'SPL')?.id)?.race || 'H'), [bloodTime, setBloodTime] = useState(0), [playing, setPlaying] = useState(false);
  const rows = blood || ownBlood;
  const color = rgb.map(value => Math.min(255, Math.max(0, Number(value) || 0)) / 255);
  const options = useDeferredValue(useMemo(() => ({ size: size / 100, height: height / 100, color, pieces, ...(blood ? { blood } : {}) }), [size, height, rgb.join(), pieces, blood]));
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
  const deathStart = corpse ? draft.model.Sequences[corpse.death].Interval[0] : 0, deathLength = corpse ? draft.model.Sequences[corpse.death].Interval[1] - deathStart : 0;
  // Corpse: the start of Decay Bone. Blood: the Death animation, played or scrubbed.
  const bloodTab = tab === 'blood', sequenceIndex = corpse ? (bloodTab ? corpse.death : withBody ? corpse.flesh : corpse.bone) : -1;
  // Show body: the body over the corpse just after it switches on in Decay Flesh.
  const corpseSequence = corpse ? (withBody ? corpse.flesh : corpse.bone) : -1;
  const time = corpse ? (bloodTab ? deathStart + bloodTime : draft.model.Sequences[corpseSequence].Interval[0] + (withBody ? 200 : 0)) : 0;
  // Pieces are planned before Size scales the corpse about the body's centre.
  const show = point => { const c = corpse?.sizeCenter || [0, 0], s = size / 100; return [c[0] + (point[0] - c[0]) * s, c[1] + (point[1] - c[1]) * s, Math.max(2, (corpse?.span || 0) * .025) * height / 100]; };
  const bloodPoints = rows.map(row => ({ start: row.position, end: row.position, half: 0 }));
  const marks = useMemo(() => !corpse ? undefined : bloodTab ? pieceMarks(bloodPoints, bloodSelected, point => [point[0], point[1], point[2] || 0]) : pieceMarks(shown, selected, show), [shown, selected, corpse, size, bloodTab, rows, bloodSelected]);

  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);
  // Ctrl+Z / Ctrl+Y inside the window step through its own changes.
  const past = useRef([]), future = useRef([]), dragging = useRef(false), latest = useRef(null);
  latest.current = { size, height, rgb, pieces, blood };
  const remember = () => { past.current.push(latest.current); if (past.current.length > 200) past.current.shift(); future.current = []; };
  const restore = state => { setSize(state.size); setHeight(state.height); setRgb(state.rgb); setPieces(state.pieces); setBlood(state.blood); };
  const step = (from, to) => { if (!from.current.length) return; to.current.push(latest.current); restore(from.current.pop()); };
  const drag = active => { if (active) { remember(); setPlaying(false); } dragging.current = active; };
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
  const edit = (index, piece) => { if (!dragging.current) remember(); setPieces(list => (list || corpse.pieces).map((value, i) => i === index ? piece : value)); };
  const remove = index => { remember(); setPieces(list => (list || corpse.pieces).filter((_, i) => i !== index)); setSelected(null); };
  const add = kind => {
    if (!corpse) return;
    remember();
    const spec = ADD[kind], [cx, cy] = corpse.sizeCenter, length = corpse.span * spec.length, list = pieces || corpse.pieces;
    setPieces([...list, { kind, start: [cx - length / 2, cy, 0], end: [cx + length / 2, cy, 0], half: corpse.span * spec.half, rect: spec.rect, ids: [], free: true }]);
    setSelected(list.length);
  };
  useEffect(() => {
    if (!window.desktop?.resolveEventResources) return;
    let active = true;
    loadEventCatalog(modelPath).then(catalog => { if (active) setSprays(catalog.SPN.filter(row => isBloodSpray(row.id) && row.definition?.resourcePath)); }).catch(() => {});
    return () => { active = false; };
  }, [modelPath]);
  const editBlood = (index, change) => { if (!dragging.current) remember(); setBlood(list => (list || ownBlood).map((row, i) => i === index ? { ...row, ...change } : row)); };
  const removeBlood = index => { remember(); setBlood(list => (list || ownBlood).filter((_, i) => i !== index)); setBloodSelected(null); };
  const addBlood = type => {
    if (!corpse) return;
    remember();
    const [cx, cy] = corpse.sizeCenter, list = rows, spread = corpse.span * .15, angle = list.length * 2.4;
    const id = type === 'SPL' ? splatCode(BLOOD_RACES[race] ? race : 'H', 'S', list.filter(row => row.type === 'SPL').length % 4) : firstSpray(race)?.id || sprays[0]?.id || 'HBS0';
    setBlood([...list, { type, id, time: bloodTime, position: [cx + Math.cos(angle) * spread * (type === 'SPL' ? 1 : 0), cy + Math.sin(angle) * spread * (type === 'SPL' ? 1 : 0), 0], parent: null }]);
    setBloodSelected(list.length);
  };
  // Each splat and spray has its own kind (human red, undead, demon green...).
  // A spray's kind narrows its list to that kind's sprays.
  // Start a kind with its plain small spray (HumanBloodSmall0) rather than a unit's own.
  const firstSpray = kind => { const list = sprays.filter(item => sprayKind(item.id) === kind); return list.find(item => /small/i.test(sprayLabel(item.id))) || list[0]; };
  const kindOf = row => row.type === 'SPL' ? parseSplat(row.id)?.race : sprayKind(row.id);
  const changeKind = (index, kind) => {
    const row = rows[index]; setRace(kind);
    if (row.type === 'SPL') { const p = parseSplat(row.id); editBlood(index, { id: splatCode(kind, p.size, p.variant) }); }
    else { const first = firstSpray(kind); if (first) editBlood(index, { id: first.id }); }
  };
  // Catalog labels are model paths: show the model's own name.
  const sprayLabel = id => { const row = sprays.find(item => item.id === id), name = row?.definition?.resourcePath || row?.label?.replace(/ · [A-Z0-9]{4}$/, '') || id; return name.split(/[\\/]/).pop().replace(/\.md[lx]$/i, '') || id; };
  const kindName = row => (BLOOD_KINDS[kindOf(row)] || '').replace(/ \(.*\)$/, '');
  const bloodLabel = row => row.type === 'SPL' ? `Splat · ${kindName(row)} · ${parseSplat(row.id)?.size === 'L' ? 'Large' : 'Small'} ${(parseSplat(row.id)?.variant ?? 0) + 1} · ${seconds(row.time)}` : `Spray · ${kindName(row)} · ${sprayLabel(row.id)} · ${seconds(row.time)}`;
  const reset = () => { remember(); setSize(100); setHeight(100); setRgb([255, 255, 255]); setPieces(null); setSelected(null); setBlood(null); setBloodSelected(null); };
  const commit = () => {
    setError('');
    try { if (onCommit(options)) onClose(); else setError('This exact corpse is already in the model.'); }
    catch (cause) { setError(cause.message); }
  };
  const keys = event => {
    event.stopPropagation();
    const typing = event.target.matches?.('input[type=number],input[type=text],textarea');
    if ((event.ctrlKey || event.metaKey) && !typing && /^[zy]$/i.test(event.key)) { event.preventDefault(); if (event.key.toLowerCase() === 'y' || event.shiftKey) step(future, past); else step(past, future); return; }
    if (event.key === 'Escape') { event.preventDefault(); onClose(); } if (event.key === 'Delete' && event.target === root.current) { if (bloodTab && bloodSelected != null) removeBlood(bloodSelected); else if (!bloodTab && selected != null) remove(selected); } };
  // Double-click a body part (or blood) in the preview to grab it; double-click empty ground to let go.
  const pick = event => {
    const marks = snapshot?.marks, box = event.currentTarget.getBoundingClientRect();
    if (!marks) return;
    const x = event.clientX - box.left, y = event.clientY - box.top, count = bloodTab ? rows.length : shown.length;
    const gap = k => { const a = marks[k + 's'], b = marks[k + 'e']; if (!a || !b) return Infinity; const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t); };
    let best = null, near = 28;
    for (let k = 0; k < count; k++) { const d = gap(k); if (d < near) { near = d; best = k; } }
    if (bloodTab) { setBloodSelected(best); setPlaying(false); } else setSelected(best);
  };
  const changed = size !== 100 || height !== 100 || rgb.join() !== '255,255,255' || pieces || blood;

  return <ToolWindow title="Auto Corpse" overlayClass="atm-overlay" className="atm-window acp-window" windowRef={root} onClose={onClose} onKeyDown={keys} sectionProps={{ 'data-hotkey-scope': 'autoCorpse' }}
    caption={<><strong title="Fits a corpse under the last Death frame, then adds Decay Flesh and Decay Bone.">Auto Corpse</strong>
        <div className="acp-tabs" role="tablist" aria-label="Auto Corpse editors">
          <button role="tab" aria-selected={!bloodTab} title="Fit the corpse that lies under the body" onClick={() => { setTab('corpse'); setPlaying(false); }}>Corpse Editor</button>
          <button role="tab" aria-selected={bloodTab} title="Blood splats on the ground and a blood spray during the Death animation" onClick={() => setTab('blood')}>Blood Editor</button>
        </div><span className="atm-spacer"/></>}>
      <div className="atm-body acp-body">
        {bloodTab ? <div className="acp-controls" role="tabpanel" aria-label="Blood Editor">
          <div className="atm-list acp-pieces" role="listbox" aria-label="Death blood">
            {rows.map((row, index) => <div key={index} role="option" aria-selected={bloodSelected === index} className={`atm-row acp-piece${bloodSelected === index ? ' is-selected' : ''}`} onClick={() => { setBloodSelected(index); setPlaying(false); setBloodTime(row.time); }}>
              <span translate="no">{bloodLabel(row)}</span>
              <button className="atm-small" aria-label={`Remove ${bloodLabel(row)}`} title="Remove this blood" onClick={event => { event.stopPropagation(); removeBlood(index); }}>×</button>
            </div>)}
            {!rows.length && <p className="atm-muted atm-empty">No blood yet. Add a splat or a spray.</p>}
          </div>
          {rows[bloodSelected] && <div className="acp-blood-row">
            <label className="acp-field" title="Whose blood: the colour of a splat, the game's sprays made for that kind of unit">Kind<select aria-label="Blood kind" value={kindOf(rows[bloodSelected]) || 'H'} onChange={event => changeKind(bloodSelected, event.target.value)}>
              {Object.entries(rows[bloodSelected].type === 'SPL' ? BLOOD_RACES : BLOOD_KINDS).filter(([key]) => rows[bloodSelected].type === 'SPL' || sprays.some(item => sprayKind(item.id) === key)).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select></label>
            {rows[bloodSelected].type === 'SPL' ? <>
              <label className="acp-field" title="Small or large blood stain on the ground">Size<select aria-label="Splat size" value={parseSplat(rows[bloodSelected].id)?.size} onChange={event => { const p = parseSplat(rows[bloodSelected].id); editBlood(bloodSelected, { id: splatCode(p.race, event.target.value, p.variant) }); }}><option value="S">Small</option><option value="L">Large</option></select></label>
              <label className="acp-field" title="One of the game's four stain shapes">Shape<select aria-label="Splat shape" value={parseSplat(rows[bloodSelected].id)?.variant} onChange={event => { const p = parseSplat(rows[bloodSelected].id); editBlood(bloodSelected, { id: splatCode(p.race, p.size, Number(event.target.value)) }); }}>{[0, 1, 2, 3].map(v => <option key={v} value={v}>{v + 1}</option>)}</select></label>
            </> : <label className="acp-field" title="The game's blood spray made for this unit type">Spray<select aria-label="Blood spray" value={rows[bloodSelected].id} onChange={event => editBlood(bloodSelected, { id: event.target.value })}>{(sprays.some(row => row.id === rows[bloodSelected].id) ? sprays : [{ id: rows[bloodSelected].id, label: rows[bloodSelected].id }, ...sprays]).filter(row => row.id === rows[bloodSelected].id || sprayKind(row.id) === kindOf(rows[bloodSelected])).map(row => <option key={row.id} value={row.id} translate="no">{sprayLabel(row.id)}</option>)}</select></label>}
            <label className="acp-field" title="When in the Death animation it appears">Time<input aria-label="Blood time in seconds" type="number" min="0" max={deathLength / 1000} step="0.05" value={(rows[bloodSelected].time / 1000).toFixed(2)} onChange={event => editBlood(bloodSelected, { time: Math.max(0, Math.min(deathLength, Math.round(Number(event.target.value) * 1000) || 0)) })}/>
              <button className="atm-small" title="Use the time shown in the preview" onClick={() => editBlood(bloodSelected, { time: Math.round(bloodTime) })}>Now</button></label>
          </div>}
          <div className="acp-add" role="group" aria-label="Add blood" title="Adds blood at the time shown in the preview; drag it into place.">
            <button onClick={() => addBlood('SPL')}>+ Splat</button><button onClick={() => addBlood('SPN')}>+ Spray</button>
          </div>
          <div className="acp-transport" title="Play or scrub the Death animation to see the blood">
            <button aria-label={playing ? 'Pause Death' : 'Play Death'} onClick={() => setPlaying(value => !value)}>{playing ? '❚❚' : '▶'}</button>
            <input type="range" aria-label="Death time" min="0" max={deathLength} step="10" value={Math.min(deathLength, Math.round(bloodTime))} onChange={event => { setPlaying(false); setBloodTime(Number(event.target.value)); }}/>
            <output>{seconds(bloodTime)}</output>
          </div>
          <button disabled={!changed} title="Back to the fitted corpse and the model's own blood" onClick={reset}>Reset</button>
        </div> : <div className="acp-controls" role="tabpanel" aria-label="Corpse Editor">
          <Slider label="Size" low="Smaller" high="Bigger" value={size} onChange={setSize} onStart={remember}
            tip="Scales the whole corpse. 100% fits it under the body. Bigger corpses can show around the body while it sinks."/>
          <Slider label="Height" low="Flatter" high="Taller" value={height} onChange={setHeight} onStart={remember}
            tip="How high the bones rise off the ground. Above 100% they can poke through the body while it sinks."/>
          <div className="acp-color" title="Tints the whole corpse, like Color Tint in Animations."><span>Color Tint:</span><div className="acp-rgb">{['R', 'G', 'B'].map((channel, index) => <label className={`channel-${channel.toLowerCase()}`} key={channel}>{channel}<input aria-label={`Corpse ${channel}`} type="number" min="0" max="255" step="1" value={rgb[index]} onFocus={remember} onChange={event => setRgb(previous => previous.map((value, i) => i === index ? event.target.value : value))}/></label>)}</div></div>
          <div className="acp-add" role="group" aria-label="Add a piece" title="Adds a piece at the middle of the body; drag it into place in the preview.">
            {Object.entries(ADD).map(([kind, spec]) => <button key={kind} onClick={() => add(kind)}>+ {spec.label}</button>)}
          </div>
          <label className="check" title="A chalk line around where the body lies, so you can fit the corpse to it.">
            <input type="checkbox" checked={outline} onChange={event => setOutline(event.target.checked)}/>Body outline
          </label>
          <label className="check" title="Shows the dead body lying over the corpse, as the game first shows it.">
            <input type="checkbox" checked={withBody} onChange={event => setWithBody(event.target.checked)}/>Show body
          </label>
          <button disabled={!changed} title="Back to the fitted corpse" onClick={reset}>Reset</button>
        </div>}
        <section className="atm-preview acp-preview" aria-label="Auto Corpse preview" onDoubleClick={pick}>
          <GamePreview presentation="preview" interactivePreview fitModel fitSequenceExtent model={draft.model} revision={drafts.current} textureAssets={textureAssets} modelPath={modelPath} preferences={preferences} teamColor={teamColor}
            sequenceIndex={sequenceIndex} time={time} playing={bloodTab && playing} loop onTimeChange={value => { if (bloodTab) setBloodTime(Math.max(0, value - deathStart)); }} showGrid showParticles={bloodTab} overlays={bloodTab ? BLOOD_OVERLAYS : OVERLAYS} compareCamera={camera.current} preserveCameraView
            onParticleStage={setSnapshot} particleStageMarks={marks} onCaptureReady={preview => { api.current = preview; frame(); }}/>
          {bloodTab ? <CorpseStageTools snapshot={snapshot} pieces={bloodPoints} selected={bloodSelected} moveOnly onSelect={index => { setBloodSelected(index); setPlaying(false); }} onChange={(index, point) => editBlood(index, { position: point.start })} onDrag={drag}/>
            : <CorpseStageTools snapshot={snapshot} pieces={shown} selected={selected} scale={size / 100} onSelect={setSelected} onChange={edit} onDrag={drag}/>}
        </section>
      </div>
      <footer>
        <span role="status" className={error || draft.error ? 'atm-error' : 'atm-muted'}>{error || draft.error || (bloodTab ? (bloodSelected != null ? 'Drag the handle to move this blood. Delete removes it.' : 'Double-click blood to move it, or add a splat or spray. Play to see it.') : selected != null ? 'Drag the handles to move, stretch or widen this part. Delete removes it. Ctrl+Z undoes.' : 'Double-click a body part to move or stretch it. Drag to turn the camera.')}</span>
        <button className="atm-commit active" disabled={!!draft.error || doc.readOnly} title="Make this corpse and its decay animations as one undoable edit" onClick={commit}>Create</button>
        <button onClick={onClose}>Close</button>
      </footer>
  </ToolWindow>;
}
