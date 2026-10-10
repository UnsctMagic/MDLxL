import React, { useEffect, useRef, useState } from 'react';
import { allNodes } from '../src/animation.js';
import { poseChainBetween, poseChainIds, poseRole, samplePoseChain, suggestPickedPoseChain, separatePoseChains, suggestPoseRig } from '../src/pose-ik.js';
import { poseSymbols } from './pose-overlay.js';
import useMovableWindow from './useMovableWindow.js';
import './pose-controls.css';

function PartIcon({ part }) {
  if (part === 'Pelvis') return <img src={new URL('./pose-trollface.png', import.meta.url).href} alt="" />;
  const paths = poseSymbols[part] || poseSymbols.Object;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[0]} fill="currentColor"/><path d={paths[1]} fill="none" stroke="var(--ui-panel, #d4d0c8)" strokeWidth="1.8"/></svg>;
}
function SetupWindow({ onClose, title, children }) {
  const ref = useRef(null), movable = useMovableWindow(ref);
  return <div ref={ref} style={movable.style} className="pose-setup" role="dialog" aria-modal="false" aria-label="POSE setup">
    <header {...movable.handleProps}><strong>{title}</strong><button aria-label="Close POSE setup" onClick={onClose}>×</button></header>{children}
  </div>;
}
const limbParts = new Set(['Hand', 'Foot', 'Hoof', 'Wing', 'Chain']);
const sameTarget = (a, b) => a?.kind === b?.kind && a?.id === b?.id && a?.key === b?.key;

export default function PoseControls({ model, revision, config, onChange, onSelect, selectedNodeIds, frame, sequence, disabled }) {
  const [open, setOpen] = useState(false), [editor, setEditor] = useState(null), [slot, setSlot] = useState('end'), [error, setError] = useState('');
  const anchor = useRef(null), names = new Map(allNodes(model).map(node => [node.ObjectId, node.Name || 'Bone']));
  const latest = useRef({ config, onChange }); latest.current = { config, onChange };
  useEffect(() => () => { const { config, onChange } = latest.current; if (config.picking) onChange({ ...config, picking: null, inspectIds: [] }); }, []);
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
    const next = { ...previous, [slot]: id, excluded: [], replacements: undefined, manualRoot: previous.manualRoot || slot === 'root' };
    if (slot === 'end' && !previous.manualRoot && limbParts.has(previous.part)) {
      next.root = null;
      try {
        const suggestion = suggestPickedPoseChain(model, id), path = poseChainIds(poseChainBetween(model, suggestion.root, id));
        next.root = suggestion.root; next.excluded = path.filter(joint => !poseChainIds(suggestion).includes(joint));
      } catch { /* Keep the selected end; Start remains available for a manual pick. */ }
    }
    return next;
  });
  useEffect(() => {
    if (open && editor && config.pickSerial && selectedNodeIds.length === 1) { setError(''); pick(selectedNodeIds[0]); }
  }, [config.pickSerial]);
  const part = editor?.part, isChain = limbParts.has(part);
  let draft = null, path = [], hint = '', conflict, repair;
  if (editor) {
    try {
      if (isChain) {
        if (editor.root != null && editor.end != null) {
          path = poseChainIds(poseChainBetween(model, editor.root, editor.end));
          draft = { ...poseChainBetween(model, editor.root, editor.end, editor.excluded), kind: ['Foot','Hoof'].includes(part) ? 'leg' : 'arm', ...(['Hoof','Wing','Chain'].includes(part) ? { label: part } : {}) };
          const originalChain = config.chains.find(chain => chain.key === editor.original?.key);
          if (originalChain?.end === editor.end && originalChain.grip) draft.grip = originalChain.grip;
          if (model.Sequences?.[sequence]) samplePoseChain(model, draft, frame, sequence);
          const otherChains = config.chains.filter(chain => !editor.replacements?.some(item => item.key === chain.key));
          conflict = otherChains.find(chain => chain.key !== editor.original?.key && chain.end !== draft.end && poseChainIds(chain).some(id => poseChainIds(draft).includes(id)));
          if (conflict) {
            repair = separatePoseChains(model, draft, otherChains.filter(chain => chain.key !== editor.original?.key && chain.end !== draft.end));
            throw new Error(repair ? 'Both chains start in the body. I can give each limb its own start.' : `This overlaps ${names.get(conflict.end)}. Pick a start farther down this limb.`);
          }
        }
      } else if (editor.end != null) draft = { id: editor.end };
    } catch (cause) { draft = null; hint = /uniform|shear/i.test(cause.message) ? 'This chain has uneven scale. Its normal bone controls still work.' : cause.message; }
  }
  const inspected = draft ? isChain ? poseChainIds(draft) : [draft.id] : path.length ? path.filter(id => id === editor.root || id === editor.end || !editor.excluded.includes(id)) : [editor?.root, editor?.end].filter(id => id != null);
  useEffect(() => { if (JSON.stringify(config.inspectIds || []) !== JSON.stringify(inspected)) onChange({ ...config, inspectIds: inspected }); }, [JSON.stringify(inspected)]);
  const choose = role => { setEditor({ part: role, root: null, end: null, excluded: [], original: null, manualRoot: false }); setSlot('end'); setError(''); onChange({ ...config, picking: role, inspectIds: [] }); };
  const mappings = [ ...(config.body == null ? [] : [{ part: 'Body', id: config.body, target: { kind: 'body' } }]),
    ...(config.nodes || []).filter(id => id !== config.body && !config.chains.some(chain => chain.end === id)).map(id => ({ part: poseRole(model, config, id), id, target: { kind: 'node', id } })),
    ...config.chains.map(chain => ({ part: chain.label || (chain.kind === 'leg' ? 'Foot' : 'Hand'), id: chain.end, chain, target: { kind: 'endpoint', key: chain.key } })) ];
  const edit = item => {
    setOpen('setup');
    let path = [], problem = '';
    if (item.chain) { try { path = poseChainIds(poseChainBetween(model, item.chain.root, item.chain.end)); } catch (cause) { path = poseChainIds(item.chain); problem = cause.message; } }
    setEditor({ part: item.part, root: item.chain?.root ?? null, end: item.id, excluded: path.filter(id => !poseChainIds(item.chain).includes(id)), original: item.target, manualRoot: true });
    setSlot('end'); setError(problem); onChange({ ...config, target: item.target, picking: item.part, inspectIds: path.length ? path : [item.id] });
  };
  const showSetup = () => { setOpen('setup'); const item = mappings.find(item => sameTarget(item.target, config.target)); if (item) edit(item); };
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
    if (editor.replacements) {
      next.chains = next.chains.map(chain => editor.replacements.find(item => item.key === chain.key) || chain);
      next.bends = { ...next.bends }; for (const chain of editor.replacements) delete next.bends[chain.key];
    }
    if (isChain) {
      const chain = { ...draft, key: `limb:${draft.end}` };
      next = without(next, { kind: 'endpoint', key: chain.key }); next.chains = [...next.chains, chain]; if (config.pins.includes(chain.key)) next.pins = [...next.pins,chain.key]; target = { kind: 'endpoint', key: chain.key };
    } else if (part === 'Body') { next.body = draft.id; target = { kind: 'body' }; }
    else { next.nodes = [...new Set([...(next.nodes || []), draft.id])]; next.roles = { ...next.roles, [draft.id]: part }; target = { kind: 'node', id: draft.id }; }
    onChange({ ...next, target }); onSelect?.(target); setEditor(null); setError('');
  };
  const repairSharedStart = () => {
    if (!repair) return;
    setEditor(previous => ({ ...previous, root: repair.draft.root, excluded: poseChainIds(poseChainBetween(model, repair.draft.root, repair.draft.end)).filter(id => !poseChainIds(repair.draft).includes(id)), replacements: repair.replacements, manualRoot: true }));
  };
  const remove = () => { onChange({ ...without(config, editor.original), picking: null, inspectIds: [] }); setEditor(null); setError(''); };
  const pickSlot = key => { setSlot(key); onChange({ ...config, picking: part }); };
  return <div className="pose-controls" ref={anchor} data-pose-revision={revision}>
    <button type="button" aria-label="POSE" aria-pressed={config.enabled} disabled={disabled} title="Pose with Move, Rotate and Scale" onClick={enable}>POSE</button>
    {config.enabled && <>
      <button type="button" aria-label="Add POSE handle" aria-expanded={open === 'add'} disabled={disabled} onClick={() => { back(); setOpen('add'); }}>Add</button>
      <button type="button" aria-label="POSE setup" aria-expanded={open === 'setup'} disabled={disabled} onClick={() => open === 'setup' ? close() : showSetup()}>Setup</button>
      <button type="button" className="pose-crosshair" aria-label="Blocker crosshair" aria-pressed={config.crosshair !== false} disabled={disabled} title="Show the handle blocking a move" onClick={() => onChange({ ...config, crosshair: config.crosshair === false })}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 1v7m0 8v7M1 12h7m8 0h7"/></svg>
      </button>
    </>}
    {open && config.enabled && <SetupWindow onClose={close} title={open === 'add' ? 'Add handle' : 'Setup'}>
      {editor ? <>
        <div className="pose-edit-heading"><button onClick={back}>{open === 'add' ? 'Back' : 'Handles'}</button><PartIcon part={part}/><strong>{part}</strong></div>
        <p>{editor.end == null ? 'Click the bone you want to grab.' : draft ? 'Ready. The connected bones are highlighted.' : 'Choose the bones in the view.'}</p>
        <button className="pose-use-selected" aria-label="Pick endpoint" onClick={() => pickSlot('end')}>{names.get(editor.end) || 'Pick a bone...'}</button>
        {selectedNodeIds.length === 1 && editor[slot] !== selectedNodeIds[0] && <button className="pose-use-selected" onClick={() => pick(selectedNodeIds[0])}>Use selected bone</button>}
        <details className="pose-adjust"><summary>{isChain ? 'Adjust chain' : 'Change bone'}</summary>
        <div className="pose-bounds">{(isChain ? ['root','end'] : ['end']).map(key => <button key={key} aria-label={`Pick ${isChain ? key === 'root' ? 'Start' : 'End' : 'Bone'}`} aria-pressed={slot === key} onClick={() => pickSlot(key)}><b>{isChain ? key === 'root' ? 'Start' : 'End' : 'Bone'}</b><span>{names.get(editor[key]) || 'Click a bone…'}</span></button>)}</div>
        <p className="pose-pick-prompt">Picking {isChain ? slot === 'root' ? 'Start' : 'End' : 'Bone'} · click again to cycle overlaps.</p>
        {path.length > 2 && <><p>Bending joints</p><div className="pose-chain" aria-label="Bending joints">{path.slice(1,-1).map(id => <label key={id} title={names.get(id)}><input type="checkbox" aria-label={`Use joint ${names.get(id)}`} checked={!editor.excluded.includes(id)} onChange={() => setEditor(previous => ({ ...previous, excluded: previous.excluded.includes(id) ? previous.excluded.filter(value => value !== id) : [...previous.excluded,id] }))}/><span>{names.get(id)}</span></label>)}</div></>}
        </details>
        {hint && <p role="status" className="pose-setup-hint">{hint}</p>}
        {repair && <button className="pose-new-chain" onClick={repairSharedStart}>Use separate limbs</button>}
        {conflict && !repair && <button onClick={() => edit(mappings.find(item => item.chain?.key === conflict.key))}>Edit {names.get(conflict.end)}</button>}
        <div className="pose-actions"><button disabled={!draft || disabled} onClick={save}>{editor.original ? 'Save changes' : isChain && config.chains.some(chain => chain.end === draft?.end) ? 'Replace handle' : 'Add handle'}</button><button onClick={back}>Cancel</button></div>
        {editor.original && <button className="pose-remove" onClick={remove}>Remove handle</button>}
      </> : open === 'add' ? <>
        <div className="pose-parts">{['Hand','Foot','Hoof','Wing','Head','Chest','Pelvis','Body','Tail','Object'].map(role => <button key={role} title={role} aria-label={`Map ${role}`} onClick={() => choose(role)}><PartIcon part={role}/><span>{role}</span></button>)}</div>
        <button className="pose-new-chain" onClick={() => choose('Chain')}>+ New bone chain</button>
      </> : <>
        {!mappings.length && <p>No handles yet.</p>}
        <div className="pose-mapped" aria-label="Mapped handles">{mappings.map(item => <button key={`${item.target.kind}:${item.id}`} title={`${item.part}: ${names.get(item.id)}`} aria-label={`Edit ${item.part}: ${names.get(item.id)}`} onClick={() => edit(item)}><PartIcon part={item.part}/><span><b>{item.part}</b><small>{names.get(item.id)}</small></span></button>)}</div>
      </>}
      {error && <p role="alert">{error}</p>}
    </SetupWindow>}
    {!open && error && <span role="alert" className="pose-error">{error}</span>}
  </div>;
}
