import React, { useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import ToolWindow from './ToolWindow.jsx';
import { BONE_PARTS, planBoneNames, nameBones, applyBoneNames } from '../src/bone-namer.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { sampleGeosetAnimation } from '../src/animation.js';
import { nodeIndex, uniqueName } from '../src/node-hierarchy.js';
import './attachemator.css';
import './bone-namer.css';

const OVERLAYS = { attachments: false, bones: true, helpers: true, nodes: false, particles: false, sounds: false, events: false, skeleton: true, focusedSkeleton: true };
const PART_LABELS = ['Root', 'Pelvis', 'Spine', 'Chest', 'Neck', 'Head', 'Arm', 'Hand', 'Leg', 'Foot', 'Hoof', 'Tail', 'Wing', 'Mesh piece', 'Keep name'];
const KINDS = { main: 'Main', mount: 'Mount', extra: 'Extra', copy: 'Copy' };
const SIDED = new Set(['arm', 'hand', 'leg', 'foot', 'hoof', 'wing']);
const LEGS = new Set(['leg', 'foot', 'hoof']);
const family = part => ['root', 'pelvis', 'spine', 'chest', 'neck', 'head'].includes(part) ? 'trunk' : ['arm', 'hand'].includes(part) ? 'arm' : LEGS.has(part) ? 'leg' : part;
const PART_TIP = 'The body part this bone is. Arm and leg bones are numbered from the body outward (Arm1 upper arm, Arm2 forearm, then Hand); numbers update by themselves.';
const MESH_TIP = 'A mesh piece takes the name of the bone it hangs on, with Mesh_ in front.';
const SIDE_TIP = 'Left and right as the unit sees it: it faces +X, its left is +Y.';
const ACTOR_TIP = "Which body this group of bones belongs to. Main has no prefix; a mount's bones start with Bone_Mount_.";
const EMPTY = 'No body parts recognised. Choose a part for each bone you want renamed.';

export default function BoneNamer({ doc, modelPath, textureAssets, teamColor, onCommit, onClose }) {
  const current = useMemo(() => structuredClone(doc.model), [doc.model, doc.revision]);
  const plan = useMemo(() => {
    try { return planBoneNames(current); }
    catch (cause) { return { actors: [], rows: [], error: cause.message }; }
  }, [current]);
  const [parts, setParts] = useState({}), [sides, setSides] = useState({}), [actors, setActors] = useState({}), [ticks, setTicks] = useState({});
  const [selected, setSelected] = useState(null), [error, setError] = useState('');
  const root = useRef(null), rowElements = useRef(new Map()), camera = useRef({ saved: null, listeners: new Set() });
  const proposal = useMemo(() => {
    try { return { rows: nameBones(current, plan, { parts, sides, actors }) }; }
    catch (cause) { return { rows: plan.rows, error: cause.message }; }
  }, [current, plan, parts, sides, actors]);
  const chosen = useMemo(() => new Set(proposal.rows.filter(row => row.part !== 'keep' && (ticks[row.id] ?? row.name !== row.current)).map(row => row.id)), [proposal, ticks]);
  // Unticked bones reserve their old names too. The list, preview and commit
  // share these exact collision-resolved names; there is no surprise at Commit.
  const rows = useMemo(() => {
    const used = new Set([...nodeIndex(current).byId.values()].filter(node => !chosen.has(node.ObjectId)).map(node => node.Name));
    return proposal.rows.map(row => {
      if (!chosen.has(row.id)) return row;
      const name = uniqueName(row.name, used, n => `${row.name}_${n}`); used.add(name);
      return { ...row, name };
    });
  }, [current, proposal, chosen]);
  const draft = useMemo(() => {
    const model = structuredClone(current);
    try { applyBoneNames(model, rows, chosen); return { model }; }
    catch (cause) { return { model: current, error: cause.message }; }
  }, [current, rows, chosen]);
  const hidden = useMemo(() => {
    const sequence = standSequenceIndex(current), frame = current.Sequences?.[sequence]?.Interval?.[0] ?? 0;
    return sequence < 0 ? [] : (current.Geosets || []).flatMap((_, index) => sampleGeosetAnimation(current, index, frame, sequence, frame).alpha <= .01 ? [index] : []);
  }, [current]);
  const labels = useMemo(() => {
    const row = rows.find(item => item.id === selected);
    if (!row) return new Set();
    if (row.part === 'keep') return new Set([row.id]);
    return new Set(rows.filter(other => other.actor === row.actor && family(other.part) === family(row.part) && other.side === row.side && other.position === row.position).map(other => other.id));
  }, [rows, selected]);
  const initial = new Set(plan.rows.filter(row => row.name !== row.current).map(row => row.id));
  const unapplied = Object.entries(parts).some(([id, value]) => plan.rows.find(row => row.id === Number(id))?.part !== value)
    || Object.entries(sides).some(([id, value]) => { const row = plan.rows.find(row => row.id === Number(id)); return value.side !== row?.side || value.position !== row?.position; })
    || Object.entries(actors).some(([id, value]) => plan.actors.find(actor => actor.body === Number(id))?.kind !== value)
    || chosen.size !== initial.size || [...chosen].some(id => !initial.has(id));
  const toChange = rows.filter(row => chosen.has(row.id) && row.name !== row.current);
  const issue = error || plan.error || proposal.error || draft.error;

  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);
  const select = id => { setSelected(id); setError(''); };
  const tick = (id, value) => setTicks(previous => ({ ...previous, [id]: value }));
  const partChange = (row, part) => { setParts(previous => ({ ...previous, [row.id]: part })); tick(row.id, part !== 'keep'); select(row.id); };
  const sideChange = (row, value) => {
    const [side, position] = value.split(':');
    setSides(previous => ({ ...previous, [row.id]: { side, position: position || null } })); tick(row.id, true); select(row.id);
  };
  const kindOf = body => {
    const named = proposal.rows.find(row => row.actor === body && row.part !== 'keep');
    if (named) {
      if (/_(Death|Portrait|Copy)[0-9]*(?:_[0-9]+)?$/.test(named.name)) return 'copy';
      if (/^(?:Bone|Mesh)_Mount[0-9]*_/.test(named.name)) return 'mount';
      if (/^(?:Bone|Mesh)_Extra[0-9]*_/.test(named.name)) return 'extra';
      return 'main';
    }
    return plan.actors.find(actor => actor.body === body)?.kind || 'main';
  };
  const actorChange = (body, kind) => {
    const next = { ...actors, [body]: kind }, oldKind = kindOf(body), main = plan.actors.find(actor => kindOf(actor.body) === 'main');
    if (kind === 'main' && main && main.body !== body) next[main.body] = oldKind;
    else if (oldKind === 'main' && kind !== 'main') { const other = plan.actors.find(actor => actor.body !== body); if (other) next[other.body] = 'main'; }
    setActors(next); setError('');
  };
  const commit = () => {
    setError('');
    try { if (onCommit({ rows, chosen }) !== false) onClose(); }
    catch (cause) { setError(cause.message); }
  };
  const groups = [];
  for (const row of rows) {
    const key = row.part === 'keep' ? 'keep' : row.actor;
    let group = groups.find(item => item.key === key);
    if (!group) { group = { key, rows: [] }; groups.push(group); }
    group.rows.push(row);
  }
  const renderRow = row => {
    const positions = [...new Set(proposal.rows.filter(other => other.actor === row.actor && LEGS.has(other.part)).map(other => other.position).filter(Boolean))];
    const sideOptions = [{ side: 'L', position: null, label: 'Left' }, { side: 'R', position: null, label: 'Right' }];
    if (LEGS.has(row.part)) for (const position of positions) for (const side of ['L', 'R']) sideOptions.push({ side, position, label: `${position.replace(/^Middle([0-9]+)$/, 'Middle $1')} ${side === 'L' ? 'Left' : 'Right'}` });
    return <div key={row.id} ref={element => { if (element) rowElements.current.set(row.id, element); else rowElements.current.delete(row.id); }} role="row" className={`atm-row bnm-row${selected === row.id ? ' is-selected' : ''}${chosen.has(row.id) ? '' : ' is-vetoed'}`} onClick={() => select(row.id)}>
      <span role="cell" onClick={event => event.stopPropagation()}><input type="checkbox" aria-label="Rename bone" title="Ticked bones are renamed. Untick one to keep its current name." disabled={row.part === 'keep'} checked={chosen.has(row.id)} onChange={() => tick(row.id, !chosen.has(row.id))}/></span>
      <span role="cell" translate="no">{row.current}</span><span role="cell" translate="no">{row.name}</span>
      <span role="cell" className="atm-bone"><select aria-label="Part" title={row.part === 'mesh' ? MESH_TIP : PART_TIP} value={row.part} onChange={event => partChange(row, event.target.value)}>{BONE_PARTS.map((part, index) => <option key={part} value={part} title={part === 'mesh' ? MESH_TIP : undefined}>{PART_LABELS[index]}</option>)}</select></span>
      <span role="cell" className="atm-bone"><select aria-label="Side" title={SIDE_TIP} disabled={!SIDED.has(row.part)} value={row.side ? `${row.side}:${row.position || ''}` : ''} onChange={event => sideChange(row, event.target.value)}>{!row.side && <option value="">—</option>}{sideOptions.map(option => <option key={`${option.side}:${option.position || ''}`} value={`${option.side}:${option.position || ''}`}>{option.label}</option>)}</select></span>
    </div>;
  };
  return <ToolWindow title="Bone Namer" overlayClass="atm-overlay" className="atm-window bnm-window" windowRef={root} onClose={onClose} unapplied={unapplied} sectionProps={{ 'data-hotkey-scope': 'boneNamer' }}
    caption={<><strong>Bone Namer</strong><span className="atm-spacer"/></>}>
    <div className="atm-body bnm-body">
      <div className="atm-list" role="table" aria-label="Bone names">
        <div className="atm-row atm-head bnm-row" role="row"><span/><span role="columnheader">Current name</span><span role="columnheader">New name</span><span role="columnheader">Part</span><span role="columnheader">Side</span></div>
        {groups.map(group => <React.Fragment key={group.key ?? 'unassigned'}>
          {group.key === 'keep' ? <div className="bnm-group">Not recognised</div> : plan.actors.length > 1 && <div className="bnm-group"><strong>{KINDS[kindOf(group.key)]}</strong><span className="atm-bone"><select aria-label="Actor" title={ACTOR_TIP} value={kindOf(group.key)} onChange={event => actorChange(group.key, event.target.value)}>{Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></div>}
          {group.rows.map(renderRow)}
        </React.Fragment>)}
      </div>
      <section className="atm-preview" aria-label="Bone Namer preview">
        <GamePreview textureAssets={textureAssets} modelPath={modelPath} teamColor={teamColor} model={draft.model}
          hiddenGeosets={hidden} restPose sequenceIndex={-1} time={0} playing={false} showGrid fitModel showAxes={false} showParticles={false} overlays={OVERLAYS}
          cameraMode="work" emptyDragRotates markersOnTop nodeLabels={labels} transformMode="move" transformSpace="world" compareCamera={camera.current} preserveCameraView
          selectedNodeIds={selected != null ? [selected] : []} onSelectNodes={ids => { const id = ids.at(-1); select(rows.some(row => row.id === id) ? id : null); rowElements.current.get(id)?.scrollIntoView({ block: 'nearest' }); }}/>
      </section>
    </div>
    <footer><span role="status" className={issue ? 'atm-error' : 'atm-muted'}>{issue || (!plan.rows.some(row => row.part !== 'keep') ? EMPTY : 'Click a row or a bone to see its name. Drag empty space to turn the camera.')}</span>
      <button className={`atm-commit${toChange.length ? ' active' : ''}`} disabled={!toChange.length || !!issue || doc.readOnly} title="Rename the ticked bones as one undoable edit" onClick={commit}>Commit</button>
      <button onClick={onClose}>Close</button>
    </footer>
  </ToolWindow>;
}
