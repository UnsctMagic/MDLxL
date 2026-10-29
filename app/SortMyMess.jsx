import React, { useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import { trapTab } from './focus-trap.js';
import { previewPlaybackStep } from './game-preview-capture.js';
import { sortMyMessInventory, applySortMyMess, decisionChanges, describeSortMyMessChanges, verifySortMyMess, visibilityFacts, unionVisibilityOverrides, canMergeMembers } from '../src/sort-my-mess.js';
import { displayNumber as n } from '../src/display-number.js';
import './sort-my-mess.css';

const list = ids => ids.map(n).join(', ');
const KINDS = {
  rgb: ['RGB', 'The parts use different tint colors.'],
  stored: ['Stored defaults', 'Stored default colors differ. Only the unanimated view uses them.'],
  visibility: ['Visibility', 'The parts show or hide in different animations.'],
  material: ['Material', 'The parts use materials with different blending, sides, layers or texture records.'],
  shape: ['Same shape', 'Some parts have exactly the same triangles, often copies that swap between animations.'],
  compat: ['Compatibility', 'Settings that limit or affect merging.'],
  records: ['Records', 'The same texture is imported more than once, or materials are identical copies.'],
};
const blank = group => ({ actions: Object.fromEntries(group.geosets.map(id => [id, 'keep'])), results: {}, opaque: false, twoSided: false, share: false });

function Ids({ ids }) { return <b className="smm-ids">{list(ids)}</b>; }
function Rgb({ rgb }) {
  if (rgb.value === 'none') return <span className="smm-rgb">none</span>;
  const swatch = !rgb.animated && <i className="smm-swatch" style={{ background: `rgb(${rgb.value})` }}/>;
  return <span className="smm-rgb">{swatch}{rgb.animated ? `animated ${rgb.value}` : rgb.value}</span>;
}
function Visibility({ row }) {
  if (row.state === 'global') return <span className="smm-vis">global loop</span>;
  return <span className={`smm-vis smm-vis-${row.state}`}>{row.first}{row.steps.map((step, i) => <React.Fragment key={i}>{' '}<span>{step.fade ? `→ ${step.to} by ${step.frame}` : `→ ${step.to} at ${step.frame}`}</span>{step.final && <>{' '}<span>(final frame)</span></>}</React.Fragment>)}</span>;
}
function Summary({ summary }) {
  const names = summary.names.map((item, i) => <React.Fragment key={i}>{i ? ', ' : ''}<span translate="no">{item.name}</span>{item.timed && <sup title="Shows or hides partway through this animation">*</sup>}</React.Fragment>);
  if (summary.kind === 'except') return <span>all except {names}</span>;
  if (summary.kind === 'only') return <span>only {names}</span>;
  return <span>{{ none: 'no animations', global: 'on a global loop', all: 'all animations', hidden: 'hidden in all animations' }[summary.kind]}</span>;
}
function MaterialLabel({ facts }) {
  return <span>{facts.names.map((name, i) => <React.Fragment key={i}>{i ? ' + ' : ''}<span>{name}</span></React.Fragment>)}{facts.sides && <>, <span>{facts.sides}</span></>}{facts.alpha && <>, <span>{facts.alpha}</span></>}</span>;
}
function DifferenceLine({ kind, line }) {
  const entry = (item, i) => <span key={i} className="smm-entry">
    {kind === 'visibility' ? <Visibility row={item.visibility}/> : kind === 'rgb' ? <Rgb rgb={item.rgb}/> : kind === 'stored' ? <span>{!item.value ? 'none' : item.value.kind === 'unused' ? `unused ${item.value.value}` : `default ${item.value.value}`}</span> : <span>{item.value}</span>}
    {item.materials && <span className="smm-muted" translate="no"> M{list(item.materials)}</span>}: <Ids ids={item.ids}/>
  </span>;
  return <li>
    {line.property && <span className="smm-property">{line.property}:</span>}
    {line.sequences && <span className="smm-property" translate="no">{line.sequences.join(', ')}:</span>}
    {line.entries.map(entry)}
    {line.note && <span className="smm-muted">{line.note}</span>}
  </li>;
}
function Records({ records }) {
  return records.map((record, i) => <li key={i}>{record.type === 'texture'
    ? <><span translate="no">{record.name}</span>{` is imported ${record.textures.length} times: textures ${list(record.textures)}`} <span className="smm-muted">{record.identical ? '(identical)' : '(wrapping or flags differ)'}</span></>
    : <span>{`Materials ${list(record.materials)} are identical`}</span>}</li>);
}
function Proposal({ group }) {
  const steps = group.proposal?.steps || [];
  if (!steps.length && !group.open.length) return <span className="smm-muted">—</span>;
  return <span className="smm-proposal">
    {steps.map((step, i) => <span key={i}>{step.type === 'merge' ? `Merge ${step.ids.map(n).join(' + ')} → ${n(step.target)}` : step.type === 'delete' ? `Delete ${n(step.id)} (copy of ${n(step.copyOf)})` : 'Share identical records'}</span>)}
    {group.open.length > 0 && <span className="smm-decide">{`Decide: ${list(group.open)}`}</span>}
  </span>;
}
function Change({ line }) {
  const what = line.type === 'deleted' ? `deleted (${line.triangles} triangles)` : line.type === 'merged' ? `merged into ${n(line.target)}` : null;
  return <li><Ids ids={line.ids}/>{': '}
    {what && <span>{what}</span>}
    {line.type === 'rgb' && <span>{`RGB ${line.from} → ${line.to}`}</span>}
    {line.type === 'material' && <span>{`Material ${line.from} → ${line.to}`}</span>}
    {line.type === 'visibility' && <><span translate="no">{line.sequence}</span>{': '}<Visibility row={line.to}/> <span className="smm-muted">(was <Visibility row={line.from}/>)</span></>}
  </li>;
}

/** Guided cleanup: list what exists, show what differs, apply only the selected choices. */
export default function SortMyMess({ doc, modelPath, textureAssets, preferences, teamColor, sequenceIndex, frame, onCommit, onClose }) {
  const current = useMemo(() => structuredClone(doc.model), [doc.revision]);
  const inventory = useMemo(() => sortMyMessInventory(current), [current]);
  const [decisions, setDecisions] = useState(() => new Map()), [open, setOpen] = useState(null), [adjusting, setAdjusting] = useState(new Set());
  const [applied, setApplied] = useState(null), [allNumbers, setAllNumbers] = useState(false), [error, setError] = useState('');
  const [sequence, setSequence] = useState(current.Sequences[sequenceIndex] ? sequenceIndex : current.Sequences.length ? 0 : -1);
  const interval = current.Sequences[sequence]?.Interval || [0, 1000];
  const [clock, setClock] = useState(() => { const time = Math.min(interval[1], Math.max(interval[0], frame || interval[0])); return { time, globalTime: time, seekId: 0 }; }), [playing, setPlaying] = useState(false);
  const { time, globalTime, seekId } = clock;
  const seek = value => setClock(previous => ({ time: value, globalTime: value, seekId: previous.seekId + 1 }));
  const camera = useRef({ saved: null, listeners: new Set() }), root = useRef(null);
  const groups = inventory.groups, group = groups.find(item => item.key === open) || null;
  const selected = groups.filter(item => decisionChanges(decisions.get(item.key)));
  const payload = items => items.map(item => ({ geosets: item.geosets, ...decisions.get(item.key) }));
  // The After model: every selected choice applied to a copy of the current model.
  const draft = useMemo(() => {
    const model = structuredClone(current);
    try { return { model, report: applySortMyMess(model, payload(selected)) }; }
    catch (cause) {
      const failing = selected.find(item => { try { applySortMyMess(structuredClone(current), payload([item])); return false; } catch { return true; } });
      return { model: current, report: null, error: cause.message, failing: failing?.key };
    }
  }, [current, decisions]);
  const changes = useMemo(() => group && draft.report ? describeSortMyMessChanges(current, draft.model, draft.report, group.geosets) : null, [group, draft]);
  const afterIds = group && draft.report ? [...new Set(group.geosets.map(id => draft.report.oldToNew[id]).filter(id => id != null))] : group?.geosets;
  // Parts of other groups that receive this group's merges are shown too.
  const beforeIds = group ? [...new Set([...group.geosets, ...Object.values(decisions.get(group.key)?.actions || {}).filter(Number.isInteger)])].sort((a, b) => a - b) : undefined;
  const beforeHidden = useMemo(() => beforeIds ? new Set(current.Geosets.flatMap((_, i) => beforeIds.includes(i) ? [] : [i])) : new Set(), [current, beforeIds?.join(',')]);
  const afterHidden = useMemo(() => afterIds ? new Set(draft.model.Geosets.flatMap((_, i) => afterIds.includes(i) ? [] : [i])) : new Set(), [draft, afterIds?.join(',')]);
  const previewPreferences = useMemo(() => ({ ...preferences, wheelMode: 'rotate' }), [preferences]);

  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);
  useEffect(() => {
    if (!playing) return;
    let request, previous;
    const step = now => { const delta = previous == null ? 0 : Math.min(100, now - previous); previous = now; setClock(value => { const next = previewPlaybackStep(interval, value.time, delta); return { ...value, time: next.frame, globalTime: value.globalTime + next.elapsed }; }); request = requestAnimationFrame(step); };
    request = requestAnimationFrame(step); return () => cancelAnimationFrame(request);
  }, [playing, interval[0], interval[1]]);

  const decisionOf = item => decisions.get(item.key);
  const ownerOf = id => groups.find(entry => entry.geosets.includes(id));
  const globalAction = id => { const decision = decisions.get(ownerOf(id)?.key); return decision && !decision.leave ? decision.actions?.[id] ?? 'keep' : 'keep'; };
  const elsewhere = (item, id) => groups.filter(other => other !== item).flatMap(other => other.geosets.filter(target => globalAction(target) === 'keep' && canMergeMembers(current, id, target)).map(target => ({ id: target, name: other.name })));
  const update = (item, change) => setDecisions(previous => {
    const next = new Map(previous), base = previous.get(item.key);
    const decision = structuredClone(base && !base.leave ? base : blank(item));
    change(decision); next.set(item.key, decision); return next;
  });
  const setAction = (item, id, action) => update(item, decision => {
    // Parts merging into a part that stops being kept follow it.
    for (const [other, value] of Object.entries(decision.actions)) if (value === id) decision.actions[other] = typeof action === 'number' ? action : 'keep';
    decision.actions[id] = action;
    if (action !== 'keep') delete decision.results[id];
    if (typeof action === 'number' && item.geosets.includes(action)) decision.actions[action] = 'keep';
  });
  const setResult = (item, target, change) => update(item, decision => { const result = decision.results[target] ||= {}; change(result); });
  const choose = item => { setOpen(previous => previous === item.key ? null : item.key); setError(''); };
  const acceptProposal = item => setDecisions(previous => new Map(previous).set(item.key, structuredClone({ ...blank(item), ...item.proposal, steps: undefined })));
  const leave = item => setDecisions(previous => new Map(previous).set(item.key, { leave: true }));
  const clear = item => setDecisions(previous => { const next = new Map(previous); next.delete(item.key); return next; });

  const apply = () => {
    setError('');
    if (!selected.length || draft.error) return;
    const before = current, chosen = selected;
    let report;
    try { report = onCommit(payload(chosen)); } catch (cause) { setError(cause.message); return; }
    if (!report) { setError('No change applied.'); return; }
    // Merge targets in other groups receive geometry, so they are not "untouched".
    const after = doc.model, ids = [...chosen.flatMap(item => item.geosets), ...report.merged.map(([, target]) => target)];
    setApplied({
      report, before: { geosets: before.Geosets.length }, after: { geosets: after.Geosets.length },
      verification: verifySortMyMess(before, after, report.oldToNew, ids),
      blends: chosen.some(item => report.merged.some(([id]) => item.geosets.includes(id)) && item.members.some(member => member.materialFacts.layers.some(layer => layer.filter >= 2))),
    });
    // Applied choices are done; "leave as is" marks stay with their groups.
    setDecisions(previous => new Map([...previous].filter(([, decision]) => decision.leave)));
    setAdjusting(new Set()); setAllNumbers(false);
    requestAnimationFrame(() => root.current?.focus());
  };
  const keys = event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (open) setOpen(null); else onClose(); }
    trapTab(event, root.current);
  };

  const statusOf = item => { const decision = decisionOf(item); return decision?.leave ? 'leave' : decisionChanges(decision) ? 'selected' : ''; };
  const details = item => {
    const decision = decisionOf(item)?.leave ? null : decisionOf(item), actionOf = id => decision?.actions?.[id] ?? 'keep';
    const member = id => item.members.find(entry => entry.id === id);
    const kept = item.geosets.filter(id => actionOf(id) === 'keep'), incoming = target => item.geosets.filter(id => actionOf(id) === target);
    const keptFacts = kept.map(member);
    const targets = kept.filter(id => incoming(id).length || adjusting.has(id));
    const draftFacts = id => { const next = draft.report?.oldToNew[id]; return next != null ? visibilityFacts(draft.model, next) : member(id).visibility; };
    const question = (target, field, label, tip, keyOf, render) => {
      const participants = incoming(target).length ? [target, ...incoming(target)] : item.geosets;
      const options = []; for (const id of participants) { const key = keyOf(id); const found = options.find(option => option.key === key); if (found) found.ids.push(id); else options.push({ key, ids: [id] }); }
      if (options.length < 2) return null;
      const chosen = decision?.results?.[target]?.[field] ?? target;
      return <div className="smm-question" role="radiogroup" aria-label={`${label} for geoset ${n(target)}`}><span className="smm-property" title={tip}>{label}:</span>
        {options.map(option => <button key={option.key} role="radio" aria-checked={option.ids.includes(chosen)} className={option.ids.includes(chosen) ? 'active' : ''} title={tip} onClick={() => setResult(item, target, result => { result[field] = option.ids.includes(target) ? target : option.ids[0]; })}><Ids ids={option.ids}/>{' '}{render(option.ids[0])}</button>)}
      </div>;
    };
    return <div className="smm-details">
      <table className="smm-members"><thead><tr><th title="Geoset number as shown in MDLxL">#</th><th>Triangles</th><th>Material</th><th>RGB</th><th>Visible in</th><th title="Keep this part, delete it, or merge its triangles into another kept part of this group">Action</th></tr></thead>
        <tbody>{item.members.map(entry => {
          const action = actionOf(entry.id), canAdjust = action === 'keep' && !incoming(entry.id).length;
          return <tr key={entry.id} className={action === 'delete' ? 'smm-deleted' : ''}>
            <td translate="no">{n(entry.id)}</td><td>{entry.triangles}</td>
            <td><span className="smm-muted" translate="no">M{n(entry.material)} </span><MaterialLabel facts={entry.materialFacts}/></td>
            <td><Rgb rgb={entry.rgb}/></td>
            <td><Summary summary={entry.summary}/></td>
            <td className="smm-action">
              <select aria-label={`Action for geoset ${n(entry.id)}`} disabled={doc.readOnly} value={typeof action === 'number' ? String(action) : action} onChange={event => { const value = event.target.value; setAction(item, entry.id, value === 'keep' || value === 'delete' ? value : Number(value)); }}>
                <option value="keep">Keep</option><option value="delete">Delete</option>
                {item.geosets.filter(other => other !== entry.id && actionOf(other) === 'keep' && canMergeMembers(current, entry.id, other)).map(other => <option key={other} value={String(other)}>{`Merge into ${n(other)}`}</option>)}
                {/* Merging into another texture's part gives this part that part's material. */}
                {elsewhere(item, entry.id).length > 0 && <optgroup label="Other textures (takes that part's material)">{elsewhere(item, entry.id).map(other => <option key={other.id} value={String(other.id)}>{`Merge into ${n(other.id)} · ${other.name}`}</option>)}</optgroup>}
              </select>
              {canAdjust && <button className="smm-small" aria-pressed={adjusting.has(entry.id)} title="Choose this part's material, color or per-animation visibility without merging" onClick={() => setAdjusting(previous => { const next = new Set(previous); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next; })}>Adjust</button>}
            </td>
          </tr>;
        })}</tbody>
      </table>
      {(item.differences.length > 0 || item.records.length > 0) && <ul className="smm-differences">
        {item.differences.map(difference => <li key={difference.kind}><strong title={KINDS[difference.kind][1]}>{KINDS[difference.kind][0]}</strong><ul>{difference.lines.map((line, i) => <DifferenceLine key={i} kind={difference.kind} line={line}/>)}</ul></li>)}
        {item.records.length > 0 && <li><strong title={KINDS.records[1]}>{KINDS.records[0]}</strong><ul><Records records={item.records}/></ul></li>}
      </ul>}
      {targets.map(target => {
        const result = decision?.results?.[target] || {}, overrides = result.overrides || {}, rows = draftFacts(target), from = incoming(target);
        const participants = from.length ? [target, ...from] : item.geosets, globalLoop = member(result.visibility ?? target).globalVisibility;
        const cycle = index => setResult(item, target, value => {
          const overridesNext = { ...(value.overrides || {}) }, override = overridesNext[index];
          if (override === undefined) overridesNext[index] = rows[index].state === 'shown' ? 0 : 1;
          else if (override === 1) overridesNext[index] = 0; else delete overridesNext[index];
          value.overrides = overridesNext;
        });
        return <div key={target} className="smm-result">
          <strong>{from.length ? `Result ${n(target)} ← ${list(from)}` : `Geoset ${n(target)}`}</strong>
          {question(target, 'material', 'Material', 'Which part’s material the result uses', id => member(id).materialFacts.key, id => <MaterialLabel facts={member(id).materialFacts}/>)}
          {question(target, 'color', 'Color', 'Which part’s RGB tint the result uses', id => member(id).rgb.key, id => <Rgb rgb={member(id).rgb}/>)}
          {question(target, 'visibility', 'Visibility from', 'Which part’s per-animation visibility the result starts from', id => item.visibilityKeys.get(id), id => <Summary summary={member(id).summary}/>)}
          {!globalLoop && rows.length > 0 && <div className="smm-chips" role="group" aria-label={`Visibility of geoset ${n(target)} by animation`}>
            {rows.map(row => <button key={row.index} className={`smm-vchip smm-vis-${row.state}${overrides[row.index] !== undefined ? ' smm-chip-set' : ''}`} aria-pressed={row.state !== 'hidden'} title="Click to switch this animation between shown and hidden. Outlined animations are your changes." onClick={() => cycle(row.index)}><span translate="no">{row.name}</span>{row.state === 'timed' && <sup>*</sup>}</button>)}
            {inventory.sequences.some(entry => entry.portrait) && <button className="smm-small" title="Make the result visible in Portrait and Portrait Talk" onClick={() => setResult(item, target, value => { value.overrides = { ...(value.overrides || {}), ...Object.fromEntries(inventory.sequences.filter(entry => entry.portrait).map(entry => [entry.index, 1])) }; })}>Show in portraits</button>}
            {participants.length > 1 && <button className="smm-small" title="In each animation, use the visibility of whichever part shows the most" onClick={() => setResult(item, target, value => { value.overrides = unionVisibilityOverrides(current, participants); })}>Shown where any part shows</button>}
            {Object.keys(overrides).length > 0 && <button className="smm-small" title="Undo your per-animation changes" onClick={() => setResult(item, target, value => { delete value.overrides; })}>Reset</button>}
          </div>}
        </div>;
      })}
      <div className="smm-group-actions">
        {(keptFacts.some(entry => !entry.materialFacts.opaque) || decision?.opaque) && <label title="Draw the bottom layer solid instead of see-through. Upper layers such as team color stay as they are."><input type="checkbox" checked={!!decision?.opaque} onChange={event => update(item, value => { value.opaque = event.target.checked; })}/>Make opaque</label>}
        {(keptFacts.some(entry => !entry.materialFacts.twoSided) || decision?.twoSided) && <label title="Show both faces of every triangle, so parts do not vanish when seen from behind"><input type="checkbox" checked={!!decision?.twoSided} onChange={event => update(item, value => { value.twoSided = event.target.checked; })}/>Make two-sided</label>}
        {item.duplicateRecords && <label title="Point these parts at one copy of identical materials and textures, then remove the unused copies. Appearance does not change."><input type="checkbox" checked={!!decision?.share} onChange={event => update(item, value => { value.share = event.target.checked; })}/>Share identical records</label>}
        <span className="smm-spacer"/>
        {item.proposal && <button title="Fill in the suggested choices for this group. Nothing changes until you click Apply selected." onClick={() => acceptProposal(item)}>Use proposed fix</button>}
        <button aria-pressed={statusOf(item) === 'leave'} title="Mark this group as reviewed. Apply will not touch it." onClick={() => leave(item)}>Leave as is</button>
        <button disabled={!decisionOf(item)} title="Forget the choices for this group" onClick={() => clear(item)}>Clear</button>
      </div>
      {draft.failing === item.key && <p className="smm-error" role="alert">{draft.error}</p>}
      {changes?.lines.length > 0 && <div className="smm-changes"><strong>What changes</strong><ul>{changes.lines.map((line, i) => <Change key={i} line={line}/>)}</ul>
        {draft.report?.merged.some(([id]) => item.geosets.includes(id)) && item.members.some(entry => entry.materialFacts.layers.some(layer => layer.filter >= 2)) && <p className="smm-muted">Merged see-through parts can overlap in a different order. Compare Before and After.</p>}
      </div>}
    </div>;
  };

  const changedNumbers = applied ? applied.report.oldToNew.map((next, old) => ({ old, next })).filter(entry => entry.next !== entry.old) : [];
  const mergedInto = new Map();
  for (const [id, target] of applied?.report.merged || []) mergedInto.set(target, [...(mergedInto.get(target) || [target]), id]);
  const common = { textureAssets, modelPath, preferences: previewPreferences, teamColor, presentation: 'preview', sequenceIndex: sequence, time, seekId, playing: false, syncPlayback: true, playbackRunning: playing, playbackGlobalTime: globalTime, cameraMode: 'rotate', compareCamera: camera.current, preserveCameraView: true, showGrid: false, showAxes: false, showParticles: false };
  return <div className="smm-overlay" onKeyDown={keys}>
    <section className="smm-window" role="dialog" aria-modal="true" aria-label="Sort My Mess" data-hotkey-scope="sort-my-mess" tabIndex={-1} ref={root}>
      <header><strong>Sort My Mess</strong><span className="smm-muted">{`${inventory.counts.geosets} geosets · ${inventory.counts.materials} materials · ${inventory.counts.textures} textures · ${groups.length} texture groups`}</span><button aria-label="Close Sort My Mess" onClick={onClose}>×</button></header>
      <div className="smm-body">
        <div className="smm-left">
          {applied && <div className="smm-applied" role="status">
            <div><strong>{applied.report.decisions === 1 ? 'Applied 1 choice' : `Applied ${applied.report.decisions} choices`}</strong><span>{`· Geosets ${applied.before.geosets} → ${applied.after.geosets}`}</span>{applied.report.materials > 0 && <span>{`· ${applied.report.materials} unused materials removed`}</span>}{applied.report.textures > 0 && <span>{`· ${applied.report.textures} unused textures removed`}</span>}<button className="smm-small" aria-label="Dismiss applied summary" onClick={() => setApplied(null)}>×</button></div>
            {mergedInto.size > 0 && <div><span className="smm-property">Merged:</span>{[...mergedInto].map(([target, ids]) => <span key={target} className="smm-entry" translate="no">{`${[...ids].sort((a, b) => a - b).map(n).join(' + ')} → ${n(applied.report.oldToNew[target])}`}</span>)}</div>}
            {applied.report.deleted.length > 0 && <div><span className="smm-property">Deleted:</span><Ids ids={applied.report.deleted}/></div>}
            {changedNumbers.length > 0 && <div><button className="smm-link" aria-expanded={allNumbers} onClick={() => setAllNumbers(value => !value)}>{allNumbers ? 'Hide old → new numbers' : `Show all ${changedNumbers.length} changed numbers`}</button>
              {allNumbers && <div className="smm-mapping" translate="no">{changedNumbers.map(entry => <span key={entry.old}>{entry.next == null ? `${n(entry.old)} → —` : `${n(entry.old)} → ${n(entry.next)}`}</span>)}</div>}</div>}
            <div className="smm-muted"><span>{`Checked: ${applied.verification.unchanged} other parts unchanged · triangles ${applied.verification.trianglesBefore} → ${applied.verification.trianglesAfter}`}</span>{applied.verification.differing.length > 0 && <b className="smm-error">{`· changed unexpectedly: ${list(applied.verification.differing)}`}</b>}</div>
            <div className="smm-muted">{applied.blends ? 'Not checked here: Warcraft III in game, and overlaps inside merged see-through parts.' : 'Not checked here: Warcraft III in game.'}</div>
          </div>}
          <div className="smm-list" role="table" aria-label="Texture groups">
            <div className="smm-row smm-head" role="row"><span role="columnheader">Texture</span><span role="columnheader" title="Geoset numbers as shown in MDLxL">Geosets</span><span role="columnheader">Materials</span><span role="columnheader">Differences</span><span role="columnheader">Proposed fix</span><span role="columnheader">Choice</span></div>
            {groups.map(item => <React.Fragment key={item.key}>
              <div className={`smm-row${open === item.key ? ' is-open' : ''}`} role="row" aria-expanded={open === item.key} tabIndex={0} onClick={() => choose(item)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(item); } }}>
                <span role="cell" title={item.textures.map(texture => texture.path || texture.name).join('\n')}><span translate="no">{item.name}</span>{item.mixed && <span className="smm-tag" title="These materials mix several textures in their layers">mixed</span>}</span>
                <span role="cell" translate="no">{list(item.geosets)}</span>
                <span role="cell" translate="no">{item.materials.map(id => `M${n(id)}`).join(', ')}</span>
                <span role="cell" className="smm-kinds">{item.kinds.map(kind => <span key={kind} className="smm-tag" title={KINDS[kind][1]}>{KINDS[kind][0]}</span>)}</span>
                <span role="cell"><Proposal group={item}/></span>
                <span role="cell" className={`smm-status smm-status-${statusOf(item) || 'none'}`}>{{ selected: 'Selected', leave: 'Leave as is', '': '—' }[statusOf(item)]}</span>
              </div>
              {open === item.key && details(item)}
            </React.Fragment>)}
          </div>
        </div>
        <div className="smm-side">
          <div className="smm-previews">
            <section aria-label="Before preview"><h2>Before</h2><GamePreview {...common} model={current} isolatedGeosets={beforeIds} hiddenGeosets={beforeHidden}/></section>
            <section aria-label="After preview"><h2>After <span className="smm-muted">{selected.length ? `${selected.length} selected` : 'nothing selected'}</span></h2><GamePreview {...common} model={draft.model} isolatedGeosets={afterIds} hiddenGeosets={afterHidden}/></section>
          </div>
          {sequence >= 0 && <div className="smm-playback"><button aria-label={playing ? 'Pause comparison' : 'Play comparison'} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause' : 'Play'}</button><select aria-label="Comparison animation" value={sequence} onChange={event => { const next = Number(event.target.value); setSequence(next); seek(current.Sequences[next].Interval[0]); }}>{current.Sequences.map((item, i) => <option key={i} value={i} translate="no">{item.Name}</option>)}</select><input type="range" aria-label="Comparison frame" min={interval[0]} max={interval[1]} value={time} onChange={event => { setPlaying(false); seek(Number(event.target.value)); }}/></div>}
          {changes?.sequences.length > 0 && <div className="smm-check"><span className="smm-property" title="Animations where this group's visibility changes. Click one to compare it.">Check:</span>{changes.sequences.map(index => <button key={index} aria-pressed={index === sequence} onClick={() => { setPlaying(false); setSequence(index); seek(current.Sequences[index].Interval[0]); }}><span translate="no">{current.Sequences[index].Name}</span></button>)}</div>}
          <p className="smm-hint smm-muted">{group ? 'Previews show only this group. Drag to rotate; both views turn together.' : 'Click a texture group to see its parts, differences and choices.'}</p>
        </div>
      </div>
      <footer>
        <span role="status" className={error || draft.error ? 'smm-error' : ''}>{error || (draft.error ? `${groups.find(item => item.key === draft.failing)?.name || ''}: ${draft.error}` : selected.length ? `Selected: ${selected.map(item => item.name).join(', ')}` : 'Nothing is selected. Nothing changes until you apply.')}</span>
        <button className={`smm-accept${selected.length && !draft.error ? ' active' : ''}`} disabled={!selected.length || !!draft.error || doc.readOnly} title="Apply every selected choice as one undoable edit, then refresh the list with the new numbers" onClick={apply}>{selected.length ? `Apply ${selected.length} selected` : 'Apply selected'}</button>
        <button onClick={onClose}>Close</button>
      </footer>
    </section>
  </div>;
}
