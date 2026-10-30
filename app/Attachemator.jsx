import { useWindowKeyClaim } from './Hotkeys.jsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import ToolWindow from './ToolWindow.jsx';
import { planAttachments, applyAttachmentPlan, attachematorStandSequence } from '../src/attachemator.js';
import { sampleGeosetAnimation } from '../src/animation.js';
import { applyMovementTransform } from '../src/movement.js';
import './attachemator.css';

// Points only; the selected point's bone shows through Focused Skeleton.
const OVERLAYS = { attachments: true, bones: false, helpers: false, nodes: false, particles: false, sounds: false, events: false, skeleton: false, focusedSkeleton: true };
const PICKING = { ...OVERLAYS, bones: true, helpers: true };

/** Places the standard attachment points like Blizzard's own units. Every
 * point can be dragged, given another bone, or unticked to stay as it is;
 * Commit applies the ticked points as one undoable edit. */
export default function Attachemator({ doc, modelPath, textureAssets, teamColor, onCommit, onClose }) {
  const current = useMemo(() => structuredClone(doc.model), [doc.revision]);
  const plan = useMemo(() => { try { return planAttachments(current); } catch (cause) { return { rows: [], others: [], error: cause.message }; } }, [current]);
  const [chosen, setChosen] = useState(() => new Set(plan.rows.filter(row => row.state === 'new' || row.state === 'change').map(row => row.key)));
  const [selected, setSelected] = useState(null), [parents, setParents] = useState({}), [picking, setPicking] = useState(null), [error, setError] = useState('');
  // Drags already moved the preview's own copy; rebuilding it for every drag
  // would flash the view, so dragged spots live in a ref the draft reads.
  const pivots = useRef({}), root = useRef(null), camera = useRef({ saved: null, listeners: new Set() });
  const [, setDragged] = useState(0);
  const draft = useMemo(() => {
    const model = structuredClone(current);
    try { return { model, ...applyAttachmentPlan(model, plan.rows, { chosen, pivots: pivots.current, parents }) }; }
    catch (cause) { return { model: current, ids: {}, error: cause.message }; }
  }, [current, plan, chosen, parents]);
  const keyOf = id => Object.keys(draft.ids).find(key => draft.ids[key] === id);
  const bones = useMemo(() => [...(current.Bones || []), ...(current.Helpers || [])].sort((a, b) => String(a.Name).localeCompare(String(b.Name))), [current]);
  // Show the unit as it stands in game: spare bodies and effect parts that the
  // Stand animation hides would bury the points.
  const hidden = useMemo(() => {
    const sequence = attachematorStandSequence(current), frame = current.Sequences?.[sequence]?.Interval[0] ?? 0;
    return sequence < 0 ? [] : (current.Geosets || []).flatMap((_, index) => sampleGeosetAnimation(current, index, frame, sequence, frame).alpha <= .01 ? [index] : []);
  }, [current]);
  const boneOf = row => chosen.has(row.key) ? (row.key in parents ? parents[row.key] : row.parent) : row.id != null ? row.currentParent ?? null : row.parent;
  const selectedId = selected != null ? draft.ids[selected] : null;
  const labels = useMemo(() => {
    const ids = new Set(plan.rows.filter(row => row.state !== 'other' && draft.ids[row.key] != null).map(row => draft.ids[row.key]));
    const parent = selectedId != null ? draft.model.Attachments?.find(node => node.ObjectId === selectedId)?.Parent : null;
    if (parent != null) ids.add(parent);
    return ids;
  }, [draft, plan, selectedId]);
  const toChange = plan.rows.filter(row => chosen.has(row.key) && (row.state === 'new' || row.state === 'change' || pivots.current[row.key] || row.key in parents));

  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);

  const tick = key => setChosen(previous => previous.has(key) ? previous : new Set(previous).add(key));
  const toggle = key => setChosen(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const select = key => { setSelected(key); setError(''); };
  const attach = (key, parent) => { setParents(previous => ({ ...previous, [key]: parent })); tick(key); setPicking(null); };
  const move = change => {
    const id = change.nodeIds?.at(-1), key = keyOf(id);
    if (!key) return false;
    try {
      applyMovementTransform(draft.model, change.nodeIds, change.time, change.sequenceIndex, { ...change, restPose: true });
      const node = draft.model.Attachments.find(item => item.ObjectId === id);
      pivots.current = { ...pivots.current, [key]: Array.from(node.PivotPoint) };
      setDragged(value => value + 1); tick(key);
      return true;
    } catch (cause) { setError(cause.message); return false; }
  };
  const commit = () => {
    setError('');
    try { if (onCommit({ rows: plan.rows, chosen, pivots: pivots.current, parents }) !== false) onClose(); }
    catch (cause) { setError(cause.message); }
  };
  // Escape leaves bone picking (and nothing else) before the window's Close takes the key.
  useWindowKeyClaim(({event, localWindow}) => { if (localWindow !== root.current || event.key !== 'Escape' || !picking) return false; setPicking(null); return true; });

  return <ToolWindow title="Attachemator" overlayClass="atm-overlay" className="atm-window" windowRef={root} onClose={onClose} sectionProps={{ 'data-hotkey-scope': 'attachemator' }}
    caption={<><strong title="Places the standard attachment points where Blizzard's own units have them, on the right bones.">Attachemator</strong><span className="atm-spacer"/></>}>
      <div className="atm-body">
        <div className="atm-list" role="table" aria-label="Attachment points">
          {plan.rows.map(row => {
            const bone = boneOf(row), placed = draft.ids[row.key] != null;
            return <div key={row.key} role="row" className={`atm-row${selected === row.key ? ' is-selected' : ''}${chosen.has(row.key) ? '' : ' is-vetoed'}`} onClick={() => select(row.key)}>
              <span role="cell" onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`Use ${row.name}`} title="Ticked points are placed by Attachemator. Untick one to leave it exactly as it is." checked={chosen.has(row.key)} onChange={() => toggle(row.key)}/></span>
              <span role="cell" title={row.tip} translate="no">{row.name}</span>
              <span role="cell" className="atm-bone" onClick={event => event.stopPropagation()}>
                <select aria-label={`Bone for ${row.name}`} title="The bone this point follows when the unit moves" value={bone ?? ''} onChange={event => { select(row.key); attach(row.key, event.target.value === '' ? null : Number(event.target.value)); }}>
                  <option value="">(none)</option>
                  {bones.map(node => <option key={node.ObjectId} value={node.ObjectId} translate="no">{node.Name}</option>)}
                </select>
                <button className="atm-small" aria-pressed={picking === row.key} disabled={!placed && !chosen.has(row.key)} title="Click, then click a bone in the preview to attach this point to it (Esc cancels)" onClick={() => { select(row.key); tick(row.key); setPicking(value => value === row.key ? null : row.key); }}>Pick</button>
              </span>
            </div>;
          })}
          {!plan.rows.length && <p className="atm-muted atm-empty">{plan.error || 'This model has nothing to attach points to.'}</p>}
        </div>
        <section className="atm-preview" aria-label="Attachemator preview">
          <GamePreview textureAssets={textureAssets} modelPath={modelPath} teamColor={teamColor} model={draft.model}
            hiddenGeosets={hidden} restPose sequenceIndex={-1} time={0} playing={false} showGrid fitModel showAxes={false} showParticles={false} overlays={picking ? PICKING : OVERLAYS}
            cameraMode="work" emptyDragRotates markersOnTop nodeLabels={labels} transformMode="move" transformSpace="world" compareCamera={camera.current} preserveCameraView
            selectedNodeIds={selectedId != null ? [selectedId] : []} onSelectNodes={ids => { const key = keyOf(ids.at(-1)); if (key) select(key); }}
            attachSourceIds={picking && draft.ids[picking] != null ? [draft.ids[picking]] : []} onAttachTarget={parent => { if (picking) attach(picking, parent); }} onCancelAttach={() => setPicking(null)}
            onNodeTransform={doc.readOnly ? undefined : move}/>
        </section>
      </div>
      <footer>
        <span role="status" className={error || draft.error ? 'atm-error' : 'atm-muted'}>{error || draft.error || (picking ? 'Click a bone in the preview.' : 'Drag a point to move it. Drag empty space to turn the camera.')}</span>
        <button className={`atm-commit${toChange.length ? ' active' : ''}`} disabled={!toChange.length || !!draft.error || doc.readOnly} title="Apply the ticked points as one undoable edit" onClick={commit}>Commit</button>
        <button onClick={onClose}>Close</button>
      </footer>
  </ToolWindow>;
}
