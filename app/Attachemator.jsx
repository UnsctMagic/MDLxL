import React, { useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import { planAttachments, applyAttachmentPlan } from '../src/attachemator.js';
import { applyMovementTransform } from '../src/movement.js';
import './attachemator.css';

const OVERLAYS = { attachments: true, bones: false, helpers: false, nodes: false, particles: false, sounds: false, events: false, skeleton: true };
const near = value => Math.round(value);

/** Places the standard attachment points like Blizzard's own units. Preview,
 * adjust by dragging, veto per point, then Commit as one undoable edit. */
export default function Attachemator({ doc, modelPath, textureAssets, preferences, teamColor, onCommit, onClose }) {
  const current = useMemo(() => structuredClone(doc.model), [doc.revision]);
  const plan = useMemo(() => { try { return planAttachments(current); } catch (cause) { return { rows: [], others: [], error: cause.message }; } }, [current]);
  const [chosen, setChosen] = useState(() => new Set(plan.rows.filter(row => row.state !== 'right').map(row => row.key)));
  const [selected, setSelected] = useState(null), [adjusted, setAdjusted] = useState({}), [reset, setReset] = useState(0), [error, setError] = useState('');
  // Drags already moved the preview's own copy; rebuilding it for every drag
  // would flash the view, so adjustments live in a ref the draft reads.
  const pivots = useRef({}), root = useRef(null), camera = useRef({ saved: null, listeners: new Set() });
  const draft = useMemo(() => {
    const model = structuredClone(current);
    try { return { model, ...applyAttachmentPlan(model, plan.rows, { chosen, pivots: pivots.current }) }; }
    catch (cause) { return { model: current, ids: {}, error: cause.message }; }
  }, [current, plan, chosen, reset]);
  const keyOf = id => Object.keys(draft.ids).find(key => draft.ids[key] === id);
  const names = useMemo(() => new Map([...(current.Bones || []), ...(current.Helpers || [])].map(node => [node.ObjectId, node.Name])), [current]);
  const previewPreferences = useMemo(() => ({ ...preferences, wheelMode: 'zoom' }), [preferences]);
  const toChange = plan.rows.filter(row => chosen.has(row.key) && (row.state !== 'right' || adjusted[row.key]));

  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);

  const toggle = key => setChosen(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const select = key => { setSelected(key); setError(''); };
  const move = change => {
    const id = change.nodeIds?.at(-1), key = keyOf(id);
    if (!key) return false;
    try {
      applyMovementTransform(draft.model, change.nodeIds, change.time, change.sequenceIndex, { ...change, restPose: true });
      const node = draft.model.Attachments.find(item => item.ObjectId === id);
      pivots.current = { ...pivots.current, [key]: Array.from(node.PivotPoint) };
      setAdjusted(previous => ({ ...previous, [key]: true }));
      setChosen(previous => previous.has(key) ? previous : new Set(previous).add(key));
      return true;
    } catch (cause) { setError(cause.message); return false; }
  };
  const undoAdjust = key => { const next = { ...pivots.current }; delete next[key]; pivots.current = next; setAdjusted(previous => { const value = { ...previous }; delete value[key]; return value; }); setReset(value => value + 1); };
  const commit = () => {
    setError('');
    try { if (onCommit({ rows: plan.rows, chosen, pivots: pivots.current }) !== false) onClose(); }
    catch (cause) { setError(cause.message); }
  };
  const keys = event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  };
  const what = row => {
    if (row.state === 'right' && !adjusted[row.key]) return 'Already right';
    if (!chosen.has(row.key)) return row.id == null ? 'Not added' : 'Keep as is';
    const parts = [];
    if (row.state === 'new') parts.push('Add');
    if (row.state === 'change' && row.reparent) parts.push(`Attach to ${row.parent == null ? 'nothing' : names.get(row.parent)}`);
    if (row.state === 'change' && row.moves >= .5) parts.push(`Move ${near(row.moves)}`);
    if (adjusted[row.key]) parts.push('adjusted');
    return parts.join(' · ') || 'Tidy up';
  };

  return <div className="atm-overlay" onKeyDown={keys}>
    <section className="atm-window" role="dialog" aria-modal="true" aria-label="Attachemator" data-hotkey-scope="attachemator" tabIndex={-1} ref={root}>
      <header><strong>Attachemator</strong><span className="atm-muted">Places the standard attachment points where Blizzard's own units have them, measured in the Stand pose.</span><button aria-label="Close Attachemator" onClick={onClose}>×</button></header>
      <div className="atm-body">
        <div className="atm-left">
          <div className="atm-list" role="table" aria-label="Attachment points">
            <div className="atm-row atm-head" role="row"><span role="columnheader" title="Untick a point to leave it exactly as it is (or not add it)">Use</span><span role="columnheader">Point</span><span role="columnheader">What happens</span><span role="columnheader" title="The bone the point follows when the unit moves">Attached to</span></div>
            {plan.rows.map(row => <div key={row.key} role="row" className={`atm-row${selected === row.key ? ' is-selected' : ''}${chosen.has(row.key) ? '' : ' is-vetoed'}`} title={row.why} onClick={() => select(row.key)}>
              <span role="cell" onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`Use ${row.name}`} checked={chosen.has(row.key)} disabled={row.state === 'right' && !adjusted[row.key]} onChange={() => toggle(row.key)}/></span>
              <span role="cell" title={row.tip} translate="no">{row.name}</span>
              <span role="cell">{what(row)}{row.animated && chosen.has(row.key) && <span className="atm-muted" title="This point has its own movement keys. They stay, now starting from the new spot."> · animated</span>}{adjusted[row.key] && <button className="atm-small" title="Go back to the calculated spot" onClick={event => { event.stopPropagation(); undoAdjust(row.key); }}>Reset</button>}</span>
              <span role="cell" translate="no">{chosen.has(row.key) || row.id == null ? (row.parent == null ? '—' : names.get(row.parent)) : (row.currentParent == null ? '—' : names.get(row.currentParent))}</span>
            </div>)}
          </div>
          {plan.others.length > 0 && <p className="atm-muted atm-others" translate="no">{`Left alone: ${plan.others.join(', ')}`}</p>}
          <p className="atm-muted atm-hint">{selected ? 'Drag the selected point in the preview to adjust it. Drag empty space to turn the camera.' : 'Click a point to adjust it. Drag empty space to turn the camera.'}</p>
        </div>
        <section className="atm-preview" aria-label="Attachemator preview">
          <GamePreview textureAssets={textureAssets} modelPath={modelPath} preferences={previewPreferences} teamColor={teamColor} model={draft.model}
            restPose sequenceIndex={-1} time={0} playing={false} showGrid fitModel showAxes={false} showParticles={false} overlays={OVERLAYS}
            cameraMode="work" emptyDragRotates transformMode="move" transformSpace="world" compareCamera={camera.current} preserveCameraView
            selectedNodeIds={selected && draft.ids[selected] != null ? [draft.ids[selected]] : []} onSelectNodes={ids => { const key = keyOf(ids.at(-1)); if (key) select(key); }}
            onNodeTransform={doc.readOnly ? undefined : move}/>
        </section>
      </div>
      <footer>
        <span role="status" className={error || plan.error || draft.error ? 'atm-error' : ''}>{error || plan.error || draft.error || (toChange.length ? `${toChange.length} point${toChange.length === 1 ? '' : 's'} will change. Nothing changes until you click Commit.` : 'Every point is already where it belongs.')}</span>
        <button className={`atm-commit${toChange.length ? ' active' : ''}`} disabled={!toChange.length || !!draft.error || doc.readOnly} title="Apply the ticked points as one undoable edit" onClick={commit}>Commit</button>
        <button onClick={onClose}>Close</button>
      </footer>
    </section>
  </div>;
}
