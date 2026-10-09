import React, { useEffect, useRef, useState } from 'react';
import { allNodes } from '../src/animation.js';
import { poseNodeRole, samplePoseChain, suggestPoseBody, suggestPoseChain, suggestPoseRig, validatePoseBody, validatePoseChain } from '../src/pose-ik.js';
import './pose-controls.css';

export default function PoseControls({ model, revision, config, onChange, onSelect, selectedNodeIds, frame, sequence, disabled }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState({ root: '', middle: '', end: '', kind: 'arm' }), [body, setBody] = useState(''), [object, setObject] = useState(''), [error, setError] = useState('');
  const anchor = useRef(null), nodes = allNodes(model), joints = [...(model.Bones || []), ...(model.Helpers || [])];
  const names = new Map(allNodes(model).map(node => [node.ObjectId, node.Name || `Node ${node.ObjectId}`]));
  const legs = config.chains.filter(chain => chain.kind === 'leg'), active = config.chains.find(chain => chain.key === config.target?.key);
  useEffect(() => {
    if (!open) return;
    const document = anchor.current?.ownerDocument;
    const outside = event => { if (!anchor.current?.contains(event.target) && !event.target.closest?.('.movement-object, .game-preview-root')) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } };
    document?.addEventListener('pointerdown', outside, true); document?.addEventListener('keydown', escape, true);
    return () => { document?.removeEventListener('pointerdown', outside, true); document?.removeEventListener('keydown', escape, true); };
  }, [open]);
  useEffect(() => { if (open && selectedNodeIds.length === 1) setObject(String(selectedNodeIds[0])); }, [open, selectedNodeIds.join(',')]);
  useEffect(() => {
    const ids = open ? [...new Set([...([draft.root, draft.middle, draft.end].filter(value => value !== '').map(Number)), ...(body === '' ? [] : [Number(body), ...legs.map(chain => chain.root)])])] : [];
    if (JSON.stringify(config.inspectIds || []) !== JSON.stringify(ids)) onChange({ ...config, inspectIds: ids });
  }, [open, draft.root, draft.middle, draft.end, body, config]);
  const run = operation => { setError(''); try { operation(); } catch (cause) { setError(cause.message); } };
  const suggest = () => run(() => {
    // React may defer a state updater until rendering. Validate in this event,
    // before the updater, so a bad selection stays inside this popup.
    setDraft(prior => ({ ...prior, root: '', middle: '', end: '' }));
    const chain = suggestPoseChain(model, selectedNodeIds.at(-1));
    setDraft(prior => ({ ...prior, ...chain, kind: poseNodeRole(nodes.find(node => node.ObjectId === chain.end)) === 'Foot' ? 'leg' : 'arm' }));
  });
  const showSetup = () => { setError(''); setOpen(value => !value); setBody(config.body ?? ''); };
  const enable = () => run(() => {
    let next = { ...config, enabled: !config.enabled, target: null };
    if (next.enabled && !config.initialized) {
      const suggested = suggestPoseRig(model, frame, sequence);
      next = { ...next, chains: config.chains.length ? config.chains : suggested.chains, body: config.body ?? suggested.body, nodes: [...new Set([...(config.nodes || []), ...suggested.nodes])], initialized: true };
    }
    onChange(next); setOpen(false);
  });
  const addObject = () => run(() => {
    const id = object === '' ? selectedNodeIds.at(-1) : Number(object);
    if (!nodes.some(node => node.ObjectId === id)) throw new Error('Select an object in the view or Object picker.');
    onChange({ ...config, nodes: [...new Set([...(config.nodes || []), id])] }); onSelect?.({ kind: 'node', id });
  });
  const add = () => run(() => {
    const chain = { ...draft, root: Number(draft.root), middle: Number(draft.middle), end: Number(draft.end), key: crypto.randomUUID() };
    if ([draft.root, draft.middle, draft.end].some(value => value === '')) throw new Error('Choose the three joints first.');
    validatePoseChain(model, chain); if (model.Sequences?.[sequence]) samplePoseChain(model, chain, frame, sequence);
    onChange({ ...config, chains: [...config.chains.filter(item => item.end !== chain.end), chain], target: { kind: 'endpoint', key: chain.key } }); onSelect?.({ kind: 'endpoint', key: chain.key });
  });
  const setBodyMapping = () => run(() => { if (body === '') throw new Error('Choose a body node.'); validatePoseBody(model, Number(body), legs); onChange({ ...config, body: Number(body) }); });
  const select = target => { onChange({ ...config, target }); onSelect?.(target); };
  const remove = key => onChange({ ...config, chains: config.chains.filter(chain => chain.key !== key), pins: config.pins.filter(pin => pin !== key), target: config.target?.key === key ? null : config.target });
  const pin = () => run(() => {
    const targets = { ...config.targets }; delete targets[active.key];
    if (config.pins.includes(active.key)) { onChange({ ...config, targets, pins: config.pins.filter(key => key !== active.key) }); return; }
    samplePoseChain(model, active, frame, sequence);
    onChange({ ...config, targets, pins: [...config.pins, active.key] });
  });
  let invalid = '';
  try { for (const chain of config.chains) { validatePoseChain(model, chain); if (open) samplePoseChain(model, chain, frame, sequence); } if (config.body != null) validatePoseBody(model, config.body, legs); } catch (cause) { invalid = cause.message; }
  return <div className="pose-controls" ref={anchor} data-pose-revision={revision}>
    <button type="button" aria-label="POSE" aria-pressed={config.enabled} disabled={disabled} title="Pose with the existing Move, Rotate and Scale tools" onClick={enable}>POSE</button>
    {config.enabled && <>
      <button type="button" aria-label="POSE setup" aria-expanded={open} disabled={disabled} onClick={showSetup}>Setup…</button>
      {active && config.target?.kind === 'endpoint' && <button type="button" aria-label={active.kind === 'leg' ? 'Pin selected foot' : 'Pin selected hand'} aria-pressed={config.pins.includes(active.key)} disabled={disabled} title="Keep this endpoint in place when its ancestors move" onClick={pin}>{config.pins.includes(active.key) ? 'Pinned' : 'Pin'}</button>}
      {config.target && <span className="pose-target" title={config.target.kind === 'node' ? names.get(config.target.id) : config.target.kind === 'body' ? names.get(config.body) : names.get(active?.end)}>{config.target.kind === 'node' ? poseNodeRole(nodes.find(node => node.ObjectId === config.target.id)) : config.target.kind === 'body' ? 'Body' : config.target.kind === 'bend' ? 'Bend' : active?.kind === 'leg' ? 'Foot' : 'Hand'}</span>}
    </>}
    {open && config.enabled && <div className="pose-setup" role="dialog" aria-modal="false" aria-label="POSE setup">
      <header><strong>POSE setup</strong><button aria-label="Close POSE setup" onClick={() => setOpen(false)}>×</button></header>
      <p>Hands and feet are suggested from this rig. Use Move, Rotate or Scale. Select any other object to pose it directly.</p>
      {config.body != null && <div className="pose-mapping"><button onClick={() => select({ kind: 'body' })}>Body: {names.get(config.body)}</button></div>}
      {(config.nodes || []).filter(id => id !== config.body && !config.chains.some(chain => chain.end === id)).map(id => <div className="pose-mapping" key={id}><button onClick={() => select({ kind: 'node', id })}>{poseNodeRole(nodes.find(node => node.ObjectId === id))}: {names.get(id)}</button><button aria-label={`Remove POSE ${names.get(id)}`} onClick={() => onChange({ ...config, nodes: config.nodes.filter(value => value !== id) })}>×</button></div>)}
      <label>Object<select aria-label="POSE object" value={object} onChange={event => setObject(event.target.value)}><option value="">Selected object</option>{nodes.map(node => <option key={node.ObjectId} value={node.ObjectId}>{names.get(node.ObjectId)}</option>)}</select></label>
      <button disabled={disabled} onClick={addObject}>Add object handle</button>
      <details className="pose-custom"><summary>Custom limb…</summary>
      <p>For unnamed or unusual rigs, choose the limb yourself. A reference / attachment can supply its endpoint.</p>
      <button disabled={disabled || selectedNodeIds.length !== 1} onClick={suggest}>Suggest selected chain</button>
      <label>Handle<select aria-label="POSE limb kind" value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })}><option value="arm">Hand</option><option value="leg">Foot</option></select></label>
      {['root', 'middle', 'end'].map((joint, index) => <label key={joint}>{['Upper joint', 'Elbow / knee', 'Hand / foot'][index]}<select aria-label={`POSE ${joint}`} value={draft[joint]} onChange={event => setDraft({ ...draft, [joint]: event.target.value })}><option value="">Choose…</option>{(joint === 'end' ? nodes : joints).map(node => <option key={node.ObjectId} value={node.ObjectId}>{names.get(node.ObjectId)}</option>)}</select></label>)}
      <button disabled={disabled} onClick={add}>Add handle</button>
      </details>
      {config.chains.map(chain => <div className="pose-mapping" key={chain.key}><button title={`${names.get(chain.root)} → ${names.get(chain.middle)} → ${names.get(chain.end)}`} onClick={() => select({ kind: 'endpoint', key: chain.key })}>{chain.kind === 'leg' ? 'Foot' : 'Hand'}: {names.get(chain.end)}</button><button aria-label={`Remove POSE ${names.get(chain.end)}`} onClick={() => remove(chain.key)}>×</button></div>)}
      <details className="pose-custom"><summary>Body node…</summary>
        <label>Body<select aria-label="POSE body node" value={body} onChange={event => setBody(event.target.value)}><option value="">Choose…</option>{nodes.map(node => <option key={node.ObjectId} value={node.ObjectId}>{names.get(node.ObjectId)}</option>)}</select></label>
        <div className="pose-mapping"><button onClick={() => run(() => setBody(suggestPoseBody(model, config.chains)))}>Suggest body</button><button onClick={setBodyMapping}>Confirm body</button></div>
        {config.body != null && <button disabled={!!invalid} onClick={() => select({ kind: 'body' })}>Select body handle</button>}
      </details>
      <p>Move Body, Pelvis or Chest to pose their limbs automatically. Hands and feet stay in place while reachable, then follow the body. Pin keeps a hand or foot fixed; release it with Pinned. Drag Bend to steer an elbow / knee.</p>
      {(error || invalid) && <p role="alert">{error || invalid}</p>}
    </div>}
    {!open && error && <span role="alert" className="pose-error">{error}</span>}
  </div>;
}
