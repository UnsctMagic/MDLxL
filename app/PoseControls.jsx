import React, { useEffect, useRef, useState } from 'react';
import { allNodes } from '../src/animation.js';
import { poseChainIds, poseRole, samplePoseChain, suggestPoseChain, suggestPoseRig, validatePoseChain } from '../src/pose-ik.js';
import { poseSymbols } from './pose-overlay.js';
import './pose-controls.css';

function PartIcon({ part }) {
  if (part === 'Pelvis') return <img src={new URL('./pose-trollface.png', import.meta.url).href} alt="" />;
  const paths = poseSymbols[part] || poseSymbols.Object;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[0]} fill="currentColor"/><path d={paths[1]} fill="none" stroke="var(--ui-panel, #d4d0c8)" strokeWidth="1.8"/></svg>;
}
const limbParts = new Set(['Hand', 'Foot', 'Hoof', 'Wing']);

export default function PoseControls({ model, revision, config, onChange, onSelect, selectedNodeIds, frame, sequence, disabled }) {
  const [open, setOpen] = useState(false), [part, setPart] = useState(null), [picked, setPicked] = useState([]), [manual, setManual] = useState(false), [step, setStep] = useState(0), [error, setError] = useState('');
  const anchor = useRef(null), names = new Map(allNodes(model).map(node => [node.ObjectId, node.Name || 'Bone']));
  const latest = useRef({ config, onChange }); latest.current = { config, onChange };
  useEffect(() => () => { const { config, onChange } = latest.current; if (config.picking) onChange({ ...config, picking: null, inspectIds: [] }); }, []);
  const active = config.chains.find(chain => chain.key === config.target?.key);
  const close = () => { setOpen(false); setPart(null); setPicked([]); setError(''); onChange({ ...config, picking: null, inspectIds: [] }); };
  useEffect(() => {
    if (!open) return;
    const document = anchor.current?.ownerDocument;
    const outside = event => { if (!anchor.current?.contains(event.target) && !event.target.closest?.('.movement-object, .game-preview-root')) close(); };
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    document?.addEventListener('pointerdown', outside, true); document?.addEventListener('keydown', escape, true);
    return () => { document?.removeEventListener('pointerdown', outside, true); document?.removeEventListener('keydown', escape, true); };
  }, [open, config]);
  useEffect(() => {
    if (!part || !open || !config.pickSerial || selectedNodeIds.length !== 1) return;
    setError(''); setPicked(previous => { if (!manual) return [selectedNodeIds[0]]; const next=previous.slice(); next[step]=selectedNodeIds[0]; return next; });
  }, [config.pickSerial]);
  let draft = null, hint = '';
  if (part && picked.length) {
    try {
      if (limbParts.has(part)) {
        if (!manual || picked.length === 3) {
          draft = { ...(manual ? { root: picked[0], middle: picked[1], end: picked[2] } : suggestPoseChain(model, picked[0])), kind: ['Hand','Wing'].includes(part) ? 'arm' : 'leg', ...(['Hoof','Wing'].includes(part) ? { label: part } : {}) };
          validatePoseChain(model, draft); if (model.Sequences?.[sequence]) samplePoseChain(model, draft, frame, sequence);
          if (config.chains.some(chain => chain.end !== draft.end && poseChainIds(chain).some(id => poseChainIds(draft).includes(id)))) throw new Error('That joint already belongs to another handle.');
        }
      } else draft = { id: picked[0] };
    } catch (cause) { draft = null; hint = /uniform|shear/i.test(cause.message) ? 'This limb has uneven scale. Its normal bone controls still work.' : /already belongs/.test(cause.message) ? 'This bone already belongs to another handle.' : 'Try its end bone, or pick the joints below.'; }
  }
  const inspected = draft ? limbParts.has(part) ? poseChainIds(draft) : [draft.id] : picked;
  useEffect(() => { if (JSON.stringify(config.inspectIds || []) !== JSON.stringify(inspected)) onChange({ ...config, inspectIds: inspected }); }, [JSON.stringify(inspected)]);
  const choose = (role, useJoints = false) => { setPart(role); setManual(useJoints); setStep(0); setPicked([]); setError(''); onChange({ ...config, picking: role, inspectIds: [] }); };
  const enable = () => {
    let next = { ...config, enabled: !config.enabled, target: null, picking: null, inspectIds: [] };
    if (next.enabled && !config.initialized) next = { ...next, ...suggestPoseRig(model, frame, sequence), initialized: true };
    onChange(next); setOpen(false); setPart(null); setPicked([]);
  };
  const add = () => {
    if (!draft) return;
    let next = { ...config, picking: null, inspectIds: [], targets: {} }, target;
    if (limbParts.has(part)) {
      const chain = { ...draft, key: `limb:${draft.end}` };
      next.chains = [...config.chains.filter(item => item.end !== chain.end), chain]; target = { kind: 'endpoint', key: chain.key };
    } else if (part === 'Body') { next.body = draft.id; target = { kind: 'body' }; }
    else { next.nodes = [...new Set([...(config.nodes || []), draft.id])]; next.roles = { ...config.roles, [draft.id]: part }; target = { kind: 'node', id: draft.id }; }
    onChange({ ...next, target }); onSelect?.(target); setPart(null); setPicked([]); setError('');
  };
  const pin = () => {
    try {
      samplePoseChain(model, active, frame, sequence);
      const targets = { ...config.targets }; delete targets[active.key];
      onChange({ ...config, targets, pins: config.pins.includes(active.key) ? config.pins.filter(key => key !== active.key) : [...config.pins, active.key] });
    } catch { setError('Choose another frame for this pin.'); }
  };
  const mappings = [ ...(config.body == null ? [] : [{ part: 'Body', id: config.body, target: { kind: 'body' } }]),
    ...(config.nodes || []).filter(id => id !== config.body && !config.chains.some(chain => chain.end === id)).map(id => ({ part: poseRole(model, config, id), id, target: { kind: 'node', id } })),
    ...config.chains.map(chain => ({ part: chain.label || (chain.kind === 'leg' ? 'Foot' : 'Hand'), id: chain.end, target: { kind: 'endpoint', key: chain.key } })) ];
  const remove = () => {
    const target = config.target;
    onChange({ ...config, target: null, body: target?.kind === 'body' ? null : config.body,
      nodes: target?.kind === 'node' ? config.nodes.filter(id => id !== target.id) : config.nodes,
      chains: config.chains.filter(chain => chain.key !== target?.key), pins: config.pins.filter(key => key !== target?.key) });
  };
  return <div className="pose-controls" ref={anchor} data-pose-revision={revision}>
    <button type="button" aria-label="POSE" aria-pressed={config.enabled} disabled={disabled} title="Pose with Move, Rotate and Scale" onClick={enable}>POSE</button>
    {config.enabled && <>
      <button type="button" aria-label="POSE setup" aria-expanded={open} disabled={disabled} onClick={() => open ? close() : setOpen(true)}>Setup…</button>
      {active && config.target?.kind === 'endpoint' && <button type="button" aria-label={active.kind === 'leg' ? 'Pin selected foot' : 'Pin selected hand'} aria-pressed={config.pins.includes(active.key)} disabled={disabled} title="Keep this hand or foot in place" onClick={pin}>{config.pins.includes(active.key) ? 'Pinned' : 'Pin'}</button>}
    </>}
    {open && config.enabled && <div className="pose-setup" role="dialog" aria-modal="false" aria-label="POSE setup">
      <header><strong>Handles</strong><button aria-label="Close POSE setup" onClick={close}>×</button></header>
      <p>Choose a symbol, then click its bone.</p>
      <div className="pose-parts">{['Hand','Foot','Hoof','Wing','Head','Chest','Pelvis','Body','Tail','Object'].map(role => <button key={role} title={role} aria-label={`Map ${role}`} aria-pressed={part === role} onClick={() => choose(role)}><PartIcon part={role}/></button>)}</div>
      {part && <div className="pose-pick">
        <p>{manual ? ['Click the shoulder / hip.', 'Click the elbow / knee.', 'Click the hand / foot.', 'Check the highlighted joints.'][step] : `Click the ${part.toLowerCase()} bone in the view.`}</p>
        <div className="pose-chain" aria-label="Picked bones">{(limbParts.has(part) ? [0,1,2] : [0]).map((_,i) => <button type="button" key={i} title={names.get(inspected[i])} aria-label={['Pick shoulder or hip','Pick elbow or knee','Pick hand or foot'][i]} aria-pressed={manual && step === i} disabled={!manual} onClick={() => setStep(i)} data-filled={inspected[i] != null}>●</button>)}</div>
        <p className="pose-pick-name">{picked.length ? names.get(picked[manual ? step : 0]) : 'Click again to cycle overlapping bones.'}</p>
        {hint && <p role="status">{hint}</p>}
        <div className="pose-actions">{manual && step < 2 ? <button disabled={picked[step] == null} onClick={() => setStep(step+1)}>Next joint</button> : <button disabled={!draft || disabled} onClick={add}>{config.chains.some(chain => chain.end === draft?.end) ? 'Replace handle' : 'Add handle'}</button>}<button onClick={() => { setPart(null); setPicked([]); onChange({ ...config, picking: null, inspectIds: [] }); }}>Cancel</button></div>
        {limbParts.has(part) && <button className="pose-joints" onClick={() => choose(part,!manual)}>{manual ? 'Pick end bone' : 'Pick joints'}</button>}
      </div>}
      {!part && <><div className="pose-mapped" aria-label="Mapped handles">{mappings.map(item => <button key={`${item.target.kind}:${item.id}`} title={`${item.part}: ${names.get(item.id)}`} aria-label={`Select ${item.part}: ${names.get(item.id)}`} aria-pressed={JSON.stringify(config.target) === JSON.stringify(item.target)} onClick={() => onSelect?.(item.target)}><PartIcon part={item.part}/></button>)}</div>
      {config.target && <button className="pose-remove" onClick={remove}>Remove selected handle</button>}</>}
      {error && <p role="alert">{error}</p>}
    </div>}
    {!open && error && <span role="alert" className="pose-error">{error}</span>}
  </div>;
}
