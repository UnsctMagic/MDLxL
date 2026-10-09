import React, { useEffect, useRef, useState } from 'react';
import { allNodes } from '../src/animation.js';
import { samplePoseChain, suggestPoseBody, suggestPoseChain, validatePoseBody, validatePoseChain } from '../src/pose-ik.js';
import './pose-controls.css';

export default function PoseControls({ model, revision, config, onChange, onSelect, selectedNodeIds, frame, sequence, disabled }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState({ root: '', middle: '', end: '', kind: 'arm' }), [body, setBody] = useState(''), [error, setError] = useState('');
  const anchor = useRef(null), nodes = [...(model.Bones || []), ...(model.Helpers || [])];
  const names = new Map(allNodes(model).map(node => [node.ObjectId, node.Name || `Node ${node.ObjectId}`]));
  const legs = config.chains.filter(chain => chain.kind === 'leg'), active = config.chains.find(chain => chain.key === config.target?.key);
  useEffect(() => {
    if (!open) return;
    const document = anchor.current?.ownerDocument;
    const outside = event => { if (!anchor.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } };
    document?.addEventListener('pointerdown', outside, true); document?.addEventListener('keydown', escape, true);
    return () => { document?.removeEventListener('pointerdown', outside, true); document?.removeEventListener('keydown', escape, true); };
  }, [open]);
  useEffect(() => {
    const ids = open ? [...new Set([...([draft.root, draft.middle, draft.end].filter(value => value !== '').map(Number)), ...(body === '' ? [] : [Number(body), ...legs.map(chain => chain.root)])])] : [];
    if (JSON.stringify(config.inspectIds || []) !== JSON.stringify(ids)) onChange({ ...config, inspectIds: ids });
  }, [open, draft.root, draft.middle, draft.end, body, config]);
  const run = operation => { setError(''); try { operation(); } catch (cause) { setError(cause.message); } };
  const suggest = () => run(() => { setDraft(prior => ({ ...prior, ...suggestPoseChain(model, selectedNodeIds.at(-1)) })); });
  const showSetup = () => { setOpen(value => !value); setBody(config.body ?? ''); if (!open && selectedNodeIds.length === 1) suggest(); };
  const add = () => run(() => {
    const chain = { ...draft, root: Number(draft.root), middle: Number(draft.middle), end: Number(draft.end), key: crypto.randomUUID() };
    if ([draft.root, draft.middle, draft.end].some(value => value === '')) throw new Error('Choose the three joints first.');
    validatePoseChain(model, chain); samplePoseChain(model, chain, frame, sequence);
    if (config.chains.some(item => item.end === chain.end)) throw new Error('This endpoint already has a POSE handle.');
    onChange({ ...config, chains: [...config.chains, chain], target: { kind: 'endpoint', key: chain.key } }); onSelect?.({ kind: 'endpoint', key: chain.key });
  });
  const setBodyMapping = () => run(() => { if (body === '') throw new Error('Choose a body node.'); validatePoseBody(model, Number(body), legs); onChange({ ...config, body: Number(body) }); });
  const select = target => { onChange({ ...config, target }); onSelect?.(target); };
  const remove = key => onChange({ ...config, chains: config.chains.filter(chain => chain.key !== key), pins: config.pins.filter(pin => pin !== key), target: config.target?.key === key ? null : config.target });
  const pin = () => run(() => {
    if (config.pins.includes(active.key)) { onChange({ ...config, pins: config.pins.filter(key => key !== active.key) }); return; }
    validatePoseBody(model, config.body, legs); samplePoseChain(model, active, frame, sequence);
    onChange({ ...config, pins: [...config.pins, active.key] });
  });
  let invalid = '';
  try { for (const chain of config.chains) { validatePoseChain(model, chain); if (open) samplePoseChain(model, chain, frame, sequence); } if (config.body != null) validatePoseBody(model, config.body, legs); } catch (cause) { invalid = cause.message; }
  return <div className="pose-controls" ref={anchor} data-pose-revision={revision}>
    <button type="button" aria-label="POSE" aria-pressed={config.enabled} disabled={disabled} title="Show session-only hand, foot and body posing handles" onClick={() => { onChange({ ...config, enabled: !config.enabled, target: null }); setOpen(false); }}>POSE</button>
    {config.enabled && <>
      <button type="button" aria-label="POSE setup" aria-expanded={open} disabled={disabled} onClick={showSetup}>Setup…</button>
      {active?.kind === 'leg' && <button type="button" aria-label="Pin selected foot" aria-pressed={config.pins.includes(active.key)} disabled={disabled || !config.pins.includes(active.key) && (config.body == null || !!invalid)} title="Keep this foot at the current pose during body Move" onClick={pin}>{config.pins.includes(active.key) ? 'Pinned' : 'Pin foot'}</button>}
      {config.target && <span className="pose-target" title={config.target.kind === 'body' ? names.get(config.body) : names.get(active?.end)}>{config.target.kind === 'body' ? 'Body' : config.target.kind === 'bend' ? 'Bend' : active?.kind === 'leg' ? 'Foot' : 'Hand'}</span>}
    </>}
    {open && config.enabled && <div className="pose-setup" role="dialog" aria-modal="false" aria-label="POSE setup">
      <header><strong>POSE setup</strong><button aria-label="Close POSE setup" onClick={() => setOpen(false)}>×</button></header>
      <p>Select the hand or foot in the Object picker, then suggest its parent chain. Confirm all three joints.</p>
      <button disabled={disabled || selectedNodeIds.length !== 1} onClick={suggest}>Suggest selected chain</button>
      <label>Handle<select aria-label="POSE limb kind" value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })}><option value="arm">Hand</option><option value="leg">Foot</option></select></label>
      {['root', 'middle', 'end'].map((joint, index) => <label key={joint}>{['Upper joint', 'Elbow / knee', 'Hand / foot'][index]}<select aria-label={`POSE ${joint}`} value={draft[joint]} onChange={event => setDraft({ ...draft, [joint]: event.target.value })}><option value="">Choose…</option>{nodes.map(node => <option key={node.ObjectId} value={node.ObjectId}>{names.get(node.ObjectId)}</option>)}</select></label>)}
      <button disabled={disabled} onClick={add}>Add handle</button>
      {config.chains.map(chain => <div className="pose-mapping" key={chain.key}><button title={`${names.get(chain.root)} → ${names.get(chain.middle)} → ${names.get(chain.end)}`} onClick={() => select({ kind: 'endpoint', key: chain.key })}>{chain.kind === 'leg' ? 'Foot' : 'Hand'}: {names.get(chain.end)}</button><button aria-label={`Remove POSE ${names.get(chain.end)}`} onClick={() => remove(chain.key)}>×</button></div>)}
      {!!legs.length && <>
        <p>Body Move drives these leg roots. Pin each foot deliberately. Pins rebase after bone edits or a new frame.</p>
        <label>Body<select aria-label="POSE body node" value={body} onChange={event => setBody(event.target.value)}><option value="">Choose…</option>{nodes.map(node => <option key={node.ObjectId} value={node.ObjectId}>{names.get(node.ObjectId)}</option>)}</select></label>
        <div className="pose-mapping"><button onClick={() => run(() => setBody(suggestPoseBody(model, legs)))}>Suggest body</button><button onClick={setBodyMapping}>Confirm body</button></div>
        {config.body != null && <button disabled={!!invalid} onClick={() => select({ kind: 'body' })}>Select body handle</button>}
      </>}
      <p>Move places a hand/foot; Rotate turns it. Drag Bend to steer the elbow/knee. Body handles support Move. Use the Object picker for ordinary bone Rotate/Resize.</p>
      {(error || invalid) && <p role="alert">{error || invalid}</p>}
    </div>}
    {!open && error && <span role="alert" className="pose-error">{error}</span>}
  </div>;
}
