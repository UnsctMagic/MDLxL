import React, { useEffect, useRef, useState } from 'react';
import { allNodes } from '../src/animation.js';
import { poseChainBetween, poseChainIds, poseRole, samplePoseChain, suggestPoseChain, suggestPoseRig } from '../src/pose-ik.js';
import { poseSymbols } from './pose-overlay.js';
import useMovableWindow from './useMovableWindow.js';
import './pose-controls.css';

function PartIcon({ part }) {
  if (part === 'Pelvis') return <img src={new URL('./pose-trollface.png', import.meta.url).href} alt="" />;
  const paths = poseSymbols[part] || poseSymbols.Object;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[0]} fill="currentColor"/><path d={paths[1]} fill="none" stroke="var(--ui-panel, #d4d0c8)" strokeWidth="1.8"/></svg>;
}
function SetupWindow({ onClose, children }) {
  const ref = useRef(null), movable = useMovableWindow(ref);
  return <div ref={ref} style={movable.style} className="pose-setup" role="dialog" aria-modal="false" aria-label="POSE setup">
    <header {...movable.handleProps}><strong>Handles</strong><button aria-label="Close POSE setup" onClick={onClose}>×</button></header>{children}
  </div>;
}
const limbParts = new Set(['Hand', 'Foot', 'Hoof', 'Wing', 'Chain']);
const sameTarget = (a, b) => a?.kind === b?.kind && a?.id === b?.id && a?.key === b?.key;

export default function PoseControls({ model, revision, config, onChange, onSelect, selectedNodeIds, frame, sequence, disabled }) {
  const [open, setOpen] = useState(false), [editor, setEditor] = useState(null), [slot, setSlot] = useState('end'), [error, setError] = useState('');
  const anchor = useRef(null), names = new Map(allNodes(model).map(node => [node.ObjectId, node.Name || 'Bone']));
  const latest = useRef({ config, onChange }); latest.current = { config, onChange };
  useEffect(() => () => { const { config, onChange } = latest.current; if (config.picking) onChange({ ...config, picking: null, inspectIds: [] }); }, []);
  const active = config.chains.find(chain => chain.key === config.target?.key);
  const back = () => { setEditor(null); setError(''); onChange({ ...config, picking: null, inspectIds: [] }); };
  const close = () => { setOpen(false); back(); };
  useEffect(() => {
    if (!open) return;
    const document = anchor.current?.ownerDocument;
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    document?.addEventListener('keydown', escape, true);
    return () => document?.removeEventListener('keydown', escape, true);
  }, [open, config]);
  const pick = id => setEditor(previous => {
    if (!previous || id == null) return previous;
    const next = { ...previous, [slot]: id, excluded: [] };
    if (slot === 'end' && previous.root == null && limbParts.has(previous.part) && previous.part !== 'Chain') {
      try {
        const suggestion = suggestPoseChain(model, id), path = poseChainIds(poseChainBetween(model, suggestion.root, id));
        next.root = suggestion.root; next.excluded = path.filter(joint => !poseChainIds(suggestion).includes(joint));
      } catch { /* Keep the selected end; Start remains available for a manual pick. */ }
    }
    return next;
  });
  useEffect(() => {
    if (open && editor && config.pickSerial && selectedNodeIds.length === 1) { setError(''); pick(selectedNodeIds[0]); }
  }, [config.pickSerial]);
  const part = editor?.part, isChain = limbParts.has(part);
  let draft = null, path = [], hint = '', conflict;
  if (editor) {
    try {
      if (isChain) {
        if (editor.root != null && editor.end != null) {
          path = poseChainIds(poseChainBetween(model, editor.root, editor.end));
          draft = { ...poseChainBetween(model, editor.root, editor.end, editor.excluded), kind: ['Foot','Hoof'].includes(part) ? 'leg' : 'arm', ...(['Hoof','Wing','Chain'].includes(part) ? { label: part } : {}) };
          if (model.Sequences?.[sequence]) samplePoseChain(model, draft, frame, sequence);
          conflict = config.chains.find(chain => chain.key !== editor.original?.key && chain.end !== draft.end && poseChainIds(chain).some(id => poseChainIds(draft).includes(id)));
          if (conflict) throw new Error(`Shares a joint with ${names.get(conflict.end)}. Edit that handle or choose another branch.`);
        }
      } else if (editor.end != null) draft = { id: editor.end };
    } catch (cause) { draft = null; hint = /uniform|shear/i.test(cause.message) ? 'This chain has uneven scale. Its normal bone controls still work.' : cause.message; }
  }
  const inspected = draft ? isChain ? poseChainIds(draft) : [draft.id] : path.length ? path.filter(id => id === editor.root || id === editor.end || !editor.excluded.includes(id)) : [editor?.root, editor?.end].filter(id => id != null);
  useEffect(() => { if (JSON.stringify(config.inspectIds || []) !== JSON.stringify(inspected)) onChange({ ...config, inspectIds: inspected }); }, [JSON.stringify(inspected)]);
  const choose = role => { setEditor({ part: role, root: null, end: null, excluded: [], original: null }); setSlot(role === 'Chain' ? 'root' : 'end'); setError(''); onChange({ ...config, picking: role, inspectIds: [] }); };
  const mappings = [ ...(config.body == null ? [] : [{ part: 'Body', id: config.body, target: { kind: 'body' } }]),
    ...(config.nodes || []).filter(id => id !== config.body && !config.chains.some(chain => chain.end === id)).map(id => ({ part: poseRole(model, config, id), id, target: { kind: 'node', id } })),
    ...config.chains.map(chain => ({ part: chain.label || (chain.kind === 'leg' ? 'Foot' : 'Hand'), id: chain.end, chain, target: { kind: 'endpoint', key: chain.key } })) ];
  const edit = item => {
    let path = [], problem = '';
    if (item.chain) { try { path = poseChainIds(poseChainBetween(model, item.chain.root, item.chain.end)); } catch (cause) { path = poseChainIds(item.chain); problem = cause.message; } }
    setEditor({ part: item.part, root: item.chain?.root ?? null, end: item.id, excluded: path.filter(id => !poseChainIds(item.chain).includes(id)), original: item.target });
    setSlot(item.chain ? 'root' : 'end'); setError(problem); onChange({ ...config, target: item.target, picking: item.part, inspectIds: path.length ? path : [item.id] });
  };
  const showSetup = () => { setOpen(true); const item = mappings.find(item => sameTarget(item.target, config.target)); if (item) edit(item); };
  const enable = () => {
    let next = { ...config, enabled: !config.enabled, target: null, picking: null, inspectIds: [] };
    if (next.enabled && !config.initialized) next = { ...next, ...suggestPoseRig(model, frame, sequence), initialized: true };
    onChange(next); setOpen(false); setEditor(null);
  };
  const without = (value, target) => {
    if (!target) return value;
    const next = { ...value, target: null };
    if (target.kind === 'body') next.body = null;
    if (target.kind === 'node') { next.nodes = (value.nodes || []).filter(id => id !== target.id); next.roles = { ...value.roles }; delete next.roles[target.id]; }
    if (target.kind === 'endpoint') {
      next.chains = value.chains.filter(chain => chain.key !== target.key); next.pins = value.pins.filter(key => key !== target.key);
      for (const key of ['targets','bends']) { next[key] = { ...value[key] }; delete next[key][target.key]; }
    }
    return next;
  };
  const save = () => {
    if (!draft) return;
    let next = { ...without(config, editor.original), picking: null, inspectIds: [], targets: {} }, target;
    if (isChain) {
      const chain = { ...draft, key: `limb:${draft.end}` };
      next = without(next, { kind: 'endpoint', key: chain.key }); next.chains = [...next.chains, chain]; if (config.pins.includes(chain.key)) next.pins = [...next.pins,chain.key]; target = { kind: 'endpoint', key: chain.key };
    } else if (part === 'Body') { next.body = draft.id; target = { kind: 'body' }; }
    else { next.nodes = [...new Set([...(next.nodes || []), draft.id])]; next.roles = { ...next.roles, [draft.id]: part }; target = { kind: 'node', id: draft.id }; }
    onChange({ ...next, target }); onSelect?.(target); setEditor(null); setError('');
  };
  const pin = () => {
    try {
      samplePoseChain(model, active, frame, sequence);
      const targets = { ...config.targets }; delete targets[active.key];
      onChange({ ...config, targets, pins: config.pins.includes(active.key) ? config.pins.filter(key => key !== active.key) : [...config.pins, active.key] });
    } catch { setError('Choose another frame for this pin.'); }
  };
  const remove = () => { onChange({ ...without(config, editor.original), picking: null, inspectIds: [] }); setEditor(null); setError(''); };
  const pickSlot = key => { setSlot(key); onChange({ ...config, picking: part }); };
  return <div className="pose-controls" ref={anchor} data-pose-revision={revision}>
    <button type="button" aria-label="POSE" aria-pressed={config.enabled} disabled={disabled} title="Pose with Move, Rotate and Scale" onClick={enable}>POSE</button>
    {config.enabled && <>
      <button type="button" aria-label="POSE setup" aria-expanded={open} disabled={disabled} onClick={() => open ? close() : showSetup()}>Setup…</button>
      {active && config.target?.kind === 'endpoint' && <button type="button" aria-label={active.kind === 'leg' ? 'Pin selected foot' : 'Pin selected hand'} aria-pressed={config.pins.includes(active.key)} disabled={disabled} title="Keep this hand or foot in place" onClick={pin}>{config.pins.includes(active.key) ? 'Pinned' : 'Pin'}</button>}
    </>}
    {open && config.enabled && <SetupWindow onClose={close}>
      {editor ? <>
        <div className="pose-edit-heading"><button onClick={back}>‹ Handles</button><PartIcon part={part}/><strong>{part}</strong></div>
        <p>Click a field, then its bone in the view.</p>
        <div className="pose-bounds">{(isChain ? ['root','end'] : ['end']).map(key => <button key={key} aria-label={`Pick ${isChain ? key === 'root' ? 'Start' : 'End' : 'Bone'}`} aria-pressed={slot === key} onClick={() => pickSlot(key)}><b>{isChain ? key === 'root' ? 'Start' : 'End' : 'Bone'}</b><span>{names.get(editor[key]) || 'Click a bone…'}</span></button>)}</div>
        <p className="pose-pick-prompt">Picking {isChain ? slot === 'root' ? 'Start' : 'End' : 'Bone'} · click again to cycle overlaps.</p>
        {selectedNodeIds.length === 1 && editor[slot] !== selectedNodeIds[0] && <button className="pose-use-selected" onClick={() => pick(selectedNodeIds[0])}>Use selected bone</button>}
        {path.length > 2 && <><p>Bending joints</p><div className="pose-chain" aria-label="Bending joints">{path.slice(1,-1).map(id => <label key={id} title={names.get(id)}><input type="checkbox" aria-label={`Use joint ${names.get(id)}`} checked={!editor.excluded.includes(id)} onChange={() => setEditor(previous => ({ ...previous, excluded: previous.excluded.includes(id) ? previous.excluded.filter(value => value !== id) : [...previous.excluded,id] }))}/><span>{names.get(id)}</span></label>)}</div></>}
        {hint && <p role="status" className="pose-setup-hint">{hint}</p>}
        {conflict && <button onClick={() => edit(mappings.find(item => item.chain?.key === conflict.key))}>Edit {names.get(conflict.end)}</button>}
        <div className="pose-actions"><button disabled={!draft || disabled} onClick={save}>{editor.original ? 'Save changes' : isChain && config.chains.some(chain => chain.end === draft?.end) ? 'Replace handle' : 'Add handle'}</button><button onClick={back}>Cancel</button></div>
        {editor.original && <button className="pose-remove" onClick={remove}>Remove handle</button>}
      </> : <>
        <button className="pose-new-chain" onClick={() => choose('Chain')}>+ New bone chain</button>
        <div className="pose-parts">{['Hand','Foot','Hoof','Wing','Head','Chest','Pelvis','Body','Tail','Object'].map(role => <button key={role} title={role} aria-label={`Map ${role}`} onClick={() => choose(role)}><PartIcon part={role}/><span>{role}</span></button>)}</div>
        <p>Click a handle to edit its bones.</p>
        <div className="pose-mapped" aria-label="Mapped handles">{mappings.map(item => <button key={`${item.target.kind}:${item.id}`} title={`${item.part}: ${names.get(item.id)}`} aria-label={`Edit ${item.part}: ${names.get(item.id)}`} onClick={() => edit(item)}><PartIcon part={item.part}/><span><b>{item.part}</b><small>{names.get(item.id)}</small></span></button>)}</div>
      </>}
      {error && <p role="alert">{error}</p>}
    </SetupWindow>}
    {!open && error && <span role="alert" className="pose-error">{error}</span>}
  </div>;
}
