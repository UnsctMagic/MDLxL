import React, { useEffect, useMemo, useRef, useState } from 'react';
import Dialog from './Dialog.jsx';
import {
  animationTargets, createGeosetAnimations, sampleAnimationProperty,
  readAnimationTrack, setAnimationInlineValues, setAnimationKey, bakeGeosetAnimationSettings,
} from '../src/animation-tracks.js';
import { setSequenceOptions } from '../src/animation.js';
import { clampAlphaPercentText } from '../src/animation-controller-inputs.js';
import { ANIMATION_SPEED_KEY, ANIMATION_SPEED_SECTIONS, animationSpeed, animationSpeedChecked, animationMasterSpeed, setAnimationActualSpeed, setAnimationSpeedChecked } from '../src/animation-speed.js';
import SidebarSection from './SidebarSection.jsx';
import { parseDraftNumber, useDraftNumber } from './Fields.jsx';
import {
  createGlobalSequence, createSequenceFromCurrent, deleteGlobalSequence, deleteSequence,
  setGlobalSequenceDuration, setSequenceInterval, setSequenceMoveSpeed, setSequenceName,
  reorderSequences, reorderGlobalSequences, SEQUENCE_REORDER_SECTIONS,
} from '../src/sequence-editor.js';
import { addAnimationSequence } from './sequence-actions.js';
import './AnimationController.css';

const valuesEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const valueArray = value => typeof value === 'number' ? [value] : Array.from(value || []);

function commonValue(model, targets, time, sequenceIndex, globalSeqId = null) {
  try {
    const values = targets.map(target => valueArray(sampleAnimationProperty(model, target, time, sequenceIndex, globalSeqId)));
    if (!values.length) return null;
    return values.every(value => valuesEqual(value, values[0])) ? values[0] : null;
  } catch { return null; }
}

const enterBlurs = event => { if (event.key === 'Enter') event.currentTarget.blur(); };

const clampSpeed = value => Math.max(1, Math.min(300, Math.round(value)));

/** Retiming rewrites every keyframe and records one undo step, so dragging only
 * moves a local draft. The edit is committed once, when the slider is released
 * (or per arrow key press) or when a typed percent is confirmed. */
const speedPercent = text => { const number = parseDraftNumber(text); return number === undefined ? undefined : clampSpeed(number); };

function SpeedControl({ label, value, disabled, onCommit }) {
  const [draft, setDraft] = useState(null), [busy, setBusy] = useState(false);
  const slider = useRef(null), latest = useRef(null), writing = useRef(false), current = useRef({ value, onCommit });
  current.current = { value, onCommit };
  useEffect(() => { setDraft(null); }, [value]);
  // Resolves false when the edit was refused, so the typed percent goes back.
  function write(percent) {
    if (writing.current) return false;
    if (percent === current.current.value) { setDraft(null); return true; }
    // Retiming blocks the renderer. Paint the progress bar first; its
    // transform animation keeps running on the compositor during the write.
    writing.current = true; setDraft(percent); setBusy(true);
    const started = performance.now();
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
      const accepted = current.current.onCommit(percent) !== false;
      setDraft(null); writing.current = false;
      setTimeout(() => setBusy(false), Math.max(0, 300 - (performance.now() - started)));
      resolve(accepted);
    })));
  }
  const number = useDraftNumber({ value, format: String, parse: speedPercent, onCommit: write, disabled });
  function commit(raw) {
    const percent = speedPercent(raw);
    if (percent === undefined) { if (!writing.current) setDraft(null); return; }
    write(percent);
  }
  latest.current = commit;
  // The native change event fires once on release; React's onChange fires on every move.
  useEffect(() => {
    const input = slider.current, release = event => latest.current(event.target.value);
    input?.addEventListener('change', release);
    return () => input?.removeEventListener('change', release);
  }, []);
  return <div className={`ac-actual-speed${busy ? ' ac-speed-busy' : ''}`} aria-busy={busy} title="Speeds the animation up or slows it down by retiming its keyframes. 100% is the speed when the model was opened.">
    <span>{label}<span className="ac-speed-number"><input aria-label={`${label} percent`} type="number" min="1" max="300" step="1" disabled={disabled} {...number} value={draft === null ? number.value : String(draft)}/>%</span></span>
    <input ref={slider} aria-label={label} type="range" min="1" max="300" step="1" value={draft ?? value} disabled={disabled} onChange={event => { if (!writing.current) setDraft(Number(event.target.value)); }}/>
    {busy && <div className="ac-speed-progress" role="progressbar" aria-label={`Applying ${label}`}/>}
  </div>;
}

/** Screenshot-faithful Animations toolbox. Movement remains in its own tab. */
export default function AnimationController({
  model, revision = 0, sequenceIndex = -1, globalSeqId = null, time = 0,
  selectedGeosets = [], selectedNodeIds = [], materialVisibility = null, onEdit, onSeek, onTimelineChange,
  disabled = false,
}) {
  const [speedMenu, setSpeedMenu] = useState(false);
  const [reorder, setReorder] = useState(null);
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [moveSpeedDrafts, setMoveSpeedDrafts] = useState({});
  const sequenceNameInput = useRef(null);
  const globalDomain = Number.isInteger(globalSeqId) && globalSeqId >= 0 && model.GlobalSequences?.[globalSeqId] > 0;
  const sequence = globalDomain ? null : model.Sequences?.[sequenceIndex];
  const frame = Math.round(time);
  // The animation editor is model-level. A cleared vertex/geoset selection
  // must not leave its controls unusable: use the whole model until a scope is
  // explicitly checked again.
  const geosetIds = useMemo(() => {
    const selected = [...new Set(selectedGeosets)].filter(id => model.Geosets?.[id]);
    return selected.length ? selected : (model.Geosets || []).map((_, id) => id);
  }, [selectedGeosets.join(','), model.Geosets?.length]);
  const nodeSelection = selectedNodeIds.length > 0 || !!materialVisibility;
  const missingGeosets = nodeSelection ? [] : geosetIds.filter(id => !(model.GeosetAnims || []).some(animation => animation.GeosetId === id));
  const targets = animationTargets(model, { geosetIds });
  const alphaTargets = materialVisibility ? [materialVisibility] : nodeSelection ? animationTargets(model, { nodeIds: selectedNodeIds }).filter(target => target.property === 'Visibility') : targets.filter(target => target.property === 'Alpha');
  const visibilitySections = materialVisibility ? ['Materials'] : nodeSelection ? ['Nodes'] : ['GeosetAnims', 'Info'];
  const colorTargets = targets.filter(target => target.property === 'Color');
  useEffect(() => {
    if (!nodeSelection) return;
    const clocks = new Set(alphaTargets.map(target => {
      const track = readAnimationTrack(model, target);
      return Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0 ? track.GlobalSeqId : null;
    }));
    if (clocks.size !== 1) return;
    const clock = [...clocks][0];
    if (clock !== null && clock !== globalSeqId) onTimelineChange?.(`global:${clock}`);
    else if (clock === null && globalSeqId !== null) onTimelineChange?.(model.Sequences.length ? 0 : -1);
  }, [model, selectedNodeIds.join(','), materialVisibility?.id, materialVisibility?.layer]);
  const inlineColorTargets = colorTargets.filter(target => !readAnimationTrack(model, target)?.Keys);
  const keyedColorTargets = colorTargets.filter(target => !inlineColorTargets.includes(target));
  const sampledAlpha = commonValue(model, alphaTargets, frame, sequenceIndex, globalDomain ? globalSeqId : null);
  const sampledColor = geosetIds.length ? commonValue(model, colorTargets, frame, sequenceIndex, globalDomain ? globalSeqId : null) : null;
  // "All line" is the authored static-property view.  It must show the
  // inline Color value itself, not a sampled keyframe from a local sequence.
  const inlineColor = geosetIds.length && !sequence && !globalDomain
    ? commonValue(model, colorTargets, 0, -1) : null;
  const displayedColor = inlineColor || sampledColor;
  const alphaStamp = JSON.stringify(sampledAlpha), colorStamp = JSON.stringify(displayedColor);
  const [alpha, setAlpha] = useState(''), [rgb, setRgb] = useState(['', '', '']);
  const [startText, setStartText] = useState(''), [endText, setEndText] = useState('');
  const [moveSpeedText, setMoveSpeedText] = useState('');
  const [sequenceNameText, setSequenceNameText] = useState('');

  useEffect(() => {
    const stored = moveSpeedDrafts[sequenceIndex];
    setMoveSpeedText(sequence ? String(sequence.MoveSpeed > 0 ? sequence.MoveSpeed : stored ?? 0) : '');
  }, [sequenceIndex, globalSeqId, sequence?.MoveSpeed, revision]);
  useEffect(() => setSequenceNameText(globalDomain ? String(model.GlobalSequences[globalSeqId]) : sequence?.Name ?? (sequenceIndex < 0 ? 'All line' : '')), [sequenceIndex, globalSeqId, globalDomain, sequence?.Name, model.GlobalSequences?.[globalSeqId], revision]);
  useEffect(() => {
    const owner = sequenceNameInput.current?.ownerDocument;
    if (!owner) return;
    const release = event => { const input = sequenceNameInput.current; if (input && owner.activeElement === input && event.target !== input) input.blur(); };
    owner.addEventListener('pointerdown', release, true);
    return () => owner.removeEventListener('pointerdown', release, true);
  }, []);
  useEffect(() => setAlpha(sampledAlpha ? String(Math.round(sampledAlpha[0] * 100)) : ''), [alphaStamp, frame, geosetIds.join(','), revision]);
  useEffect(() => setRgb(displayedColor ? displayedColor.map(value => String(Math.round(value * 255))) : ['', '', '']), [colorStamp, frame, geosetIds.join(','), revision]);
  useEffect(() => {
    if (globalDomain) { setStartText('0'); setEndText(String(model.GlobalSequences[globalSeqId])); }
    else if (sequence?.Interval) { setStartText(String(sequence.Interval[0])); setEndText(String(sequence.Interval[1])); }
    else { setStartText(''); setEndText(''); }
  }, [sequenceIndex, globalSeqId, globalDomain, sequence?.Interval?.[0], sequence?.Interval?.[1], model.GlobalSequences?.[globalSeqId], revision]);

  function commit(label, sections, mutate, success) {
    let cause;
    try {
      const result = onEdit(label, sections, current => {
        try { return mutate(current); } catch (failure) { cause = failure; throw failure; }
      });
      if (cause) throw cause;
      setError(''); setNotice(result === false ? 'Values are already up to date.' : success); return true;
    } catch (failure) { setError(failure.message); setNotice(''); return false; }
  }

  function changeSequence(patch) {
    commit('Edit animation sequence properties', ['Sequences'], current => setSequenceOptions(current, sequenceIndex, patch), 'Sequence properties updated.');
  }

  function changeActualSpeed(index, percent) {
    const interval = model.Sequences?.[sequenceIndex]?.Interval;
    const progress = interval ? Math.max(0, Math.min(1, (time - interval[0]) / Math.max(1, interval[1] - interval[0]))) : 0;
    if (!commit('Adjust animation actual speed', ANIMATION_SPEED_SECTIONS, current => setAnimationActualSpeed(current, index, percent), '')) return false;
    const updated = model.Sequences?.[sequenceIndex]?.Interval;
    if (updated) onSeek?.(updated[0] + Math.round(progress * (updated[1] - updated[0])));
    return true;
  }

  function commitInterval() {
    if (globalDomain) {
      const duration = Number(endText);
      if (commit('Set global sequence interval', ['GlobalSequences'], current => setGlobalSequenceDuration(current, globalSeqId, duration), 'Global sequence interval updated.')) onSeek?.(Math.max(0, Math.min(duration, frame)));
      else { setStartText('0'); setEndText(String(model.GlobalSequences[globalSeqId])); }
      return;
    }
    if (!sequence) return;
    const start = Number(startText), end = Number(endText);
    if (commit('Set animation frame interval', ['Sequences'], current => setSequenceInterval(current, sequenceIndex, start, end), 'Frame interval updated.')) onSeek?.(Math.max(start, Math.min(end, frame)));
    else { setStartText(String(sequence.Interval[0])); setEndText(String(sequence.Interval[1])); }
  }

  function addSequence() {
    return addAnimationSequence({ onEdit, onTimelineChange, onSeek, onNotice: setNotice, onError: setError });
  }

  function openReorder(global = globalDomain) {
    const items = global ? model.GlobalSequences : model.Sequences;
    setError('');
    setReorder({ global, order: (items || []).map((_, index) => index), selected: Math.max(0, global ? globalSeqId ?? 0 : sequenceIndex), revision });
  }

  function moveReorder(destination) {
    setReorder(current => {
      const order = [...current.order], from = order.indexOf(current.selected);
      order.splice(destination, 0, order.splice(from, 1)[0]);
      return { ...current, order };
    });
  }

  function applyReorder() {
    if (revision !== reorder.revision) { setError('The model changed. Close and reopen Reorder before applying.'); return; }
    const { order, global } = reorder;
    const offset = sequence ? Math.max(0, Math.min(time - sequence.Interval[0], sequence.Interval[1] - sequence.Interval[0])) : 0;
    const nextSequence = order.indexOf(sequenceIndex), nextGlobal = order.indexOf(globalSeqId);
    if (!commit(global ? 'Reorder global sequences' : 'Reorder animations', global ? ['GlobalSequences', ...SEQUENCE_REORDER_SECTIONS] : SEQUENCE_REORDER_SECTIONS,
      current => global ? reorderGlobalSequences(current, order) : reorderSequences(current, order), 'Animation order updated.')) return;
    if (global && globalDomain) { onTimelineChange?.(`global:${nextGlobal}`); onSeek?.(time); }
    else if (!global) {
      setMoveSpeedDrafts(previous => Object.fromEntries(order.flatMap((old, index) => previous[old] === undefined ? [] : [[index, previous[old]]])));
      if (!globalDomain && nextSequence >= 0) { onTimelineChange?.(nextSequence); onSeek?.(model.Sequences[nextSequence].Interval[0] + offset); }
    }
    setReorder(null);
  }

  function copyCurrentSequence() {
    let index = -1, start = 0;
    if (commit('Create animation from current', ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras'], current => {
      index = createSequenceFromCurrent(current, sequenceIndex); start = current.Sequences[index].Interval[0]; return index;
    }, 'Current animation copied.')) { onTimelineChange?.(index); onSeek?.(start); }
  }

  function addGlobal() {
    let index = -1;
    if (commit('Create global sequence', ['GlobalSequences'], current => { index = createGlobalSequence(current); return index; }, 'One-second global sequence created.')) {
      onTimelineChange?.(`global:${index}`); onSeek?.(0);
    }
  }

  function removeCurrent() {
    if (globalDomain) {
      if (commit('Delete global sequence and its keyframes', ['GlobalSequences', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras', 'Info'], current => deleteGlobalSequence(current, globalSeqId), 'Global sequence and its keyframes deleted.')) {
        const next = model.GlobalSequences.length ? `global:${Math.min(globalSeqId, model.GlobalSequences.length - 1)}` : model.Sequences.length ? 0 : -1;
        onTimelineChange?.(next);
      }
      return;
    }
    if (!sequence) return;
    if (commit('Delete sequence and its keyframes', ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras', 'Info'], current => deleteSequence(current, sequenceIndex), 'Sequence, contained keyframes, and node events deleted.')) {
      setMoveSpeedDrafts(previous => Object.fromEntries(Object.entries(previous).flatMap(([key, value]) => Number(key) < sequenceIndex ? [[key, value]] : Number(key) > sequenceIndex ? [[Number(key) - 1, value]] : [])));
      const next = model.Sequences.length ? Math.min(sequenceIndex, model.Sequences.length - 1) : model.GlobalSequences.length ? 'global:0' : -1;
      onTimelineChange?.(next);
    }
  }

  function createVisibility() {
    commit('Create geoset visibility', ['GeosetAnims', 'Info'], current => createGeosetAnimations(current, missingGeosets), 'Visibility created at 100% alpha.');
  }

  function setVisibility(visible) {
    const value = visible ? 1 : 0;
    setAlpha(visible ? '100' : '0');
    commit('Set visibility keyframe', visibilitySections, current => writeVisibility(current, value), '');
  }

  function writeVisibility(current, value) {
    if (nodeSelection) for (const target of alphaTargets) {
      const track = readAnimationTrack(current, target);
      const clock = Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0 ? track.GlobalSeqId : null;
      if (track?.Keys && clock !== (globalDomain ? globalSeqId : null)) throw new Error(clock === null ? 'Visibility uses model sequences.' : `Visibility uses Global sequence ${clock + 1}.`);
    }
    return setAnimationKey(current, alphaTargets, frame, value, sequenceIndex, globalDomain ? globalSeqId : null);
  }

  function commitAlpha() {
    if ((!sequence && !globalDomain) || !alphaTargets.length || alpha === '') return;
    const numeric = Number(alpha);
    if (!Number.isFinite(numeric)) { setError('Alpha must be a number from 0 to 100.'); setNotice(''); return; }
    const value = Math.max(0, Math.min(100, numeric));
    setAlpha(String(value));
    commit('Set alpha keyframe', visibilitySections, current => writeVisibility(current, value / 100), '');
  }

  function rgbValue() {
    if (rgb.some(value => value.trim() === '' || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 255)) throw new Error('R, G and B must be whole numbers from 0 to 255.');
    return rgb.map(value => Number(value) / 255);
  }

  function commitRgb() {
    if (!geosetIds.length) return;
    let value;
    try { value = rgbValue(); } catch (failure) { setError(failure.message); setNotice(''); return; }
    if (globalDomain) {
      commit('Set global sequence geoset RGB', ['GeosetAnims', 'Info'], current => setAnimationKey(current, colorTargets, frame, value, sequenceIndex, globalSeqId), 'Global sequence color tint keyframe updated.');
      return;
    }
    if (!sequence) {
      if (inlineColorTargets.length !== colorTargets.length) return;
      commit('Set inline geoset RGB', ['GeosetAnims', 'Info'], current => setAnimationInlineValues(current, colorTargets, value), 'Inline color tint updated.');
      return;
    }
    commit('Set geoset RGB', ['GeosetAnims', 'Info'], current => {
      if (inlineColorTargets.length) setAnimationInlineValues(current, inlineColorTargets, value);
      if (keyedColorTargets.length) setAnimationKey(current, keyedColorTargets, frame, value, sequenceIndex);
    }, inlineColorTargets.length ? 'Inline color tint updated.' : 'Color tint keyframe updated.');
  }

  function bakeRgb(all) {
    let value, visibility;
    try {
      value = rgbValue();
      if (alpha.trim() === '' || !Number.isFinite(Number(alpha))) throw new Error('Alpha must be a number from 0 to 100.');
      visibility = Math.max(0, Math.min(100, Number(alpha))) / 100;
    } catch (failure) { setError(failure.message); setNotice(''); return; }
    commit(all ? 'Bake RGB in all sequences' : 'Bake RGB in selected sequence', ['GeosetAnims', 'Info'],
      current => bakeGeosetAnimationSettings(current, { geosetIds, alpha: visibility, color: value, sequenceIndices: all ? null : [sequenceIndex] }),
      all ? 'RGB baked at the beginning and end of every sequence.' : 'RGB baked at the beginning and end of this sequence.');
  }

  function toggleMoveSpeed(checked) {
    if (!sequence) return;
    const current = Number(sequence.MoveSpeed) || 0;
    if (!checked && current > 0) setMoveSpeedDrafts(previous => ({ ...previous, [sequenceIndex]: current }));
    const restored = Number(moveSpeedText) > 0 ? Number(moveSpeedText) : Number(moveSpeedDrafts[sequenceIndex]) > 0 ? Number(moveSpeedDrafts[sequenceIndex]) : 1;
    const value = checked ? restored : 0;
    if (commit('Set sequence move speed', ['Sequences'], model => setSequenceMoveSpeed(model, sequenceIndex, value), checked ? 'MoveSpeed enabled.' : 'MoveSpeed disabled.')) setMoveSpeedText(String(checked ? value : restored));
  }

  function commitMoveSpeed() {
    if (!moveApplied || !sequence) return;
    const speed = Number(moveSpeedText);
    if (!Number.isFinite(speed) || speed <= 0) {
      setError('Move speed must be a number greater than 0.'); setNotice(''); setMoveSpeedText(String(sequence.MoveSpeed)); return;
    }
    if (commit('Set sequence move speed', ['Sequences'], current => setSequenceMoveSpeed(current, sequenceIndex, speed), 'MoveSpeed updated.')) setMoveSpeedDrafts(previous => ({ ...previous, [sequenceIndex]: speed }));
  }

  function commitSequenceName() {
    if (!sequence || sequenceNameText === sequence.Name) return;
    if (!commit('Rename animation sequence', ['Sequences'], current => setSequenceName(current, sequenceIndex, sequenceNameText), 'Sequence renamed.')) setSequenceNameText(sequence.Name);
  }

  const noLocalSequence = disabled || !sequence || globalDomain;
  const moveApplied = !globalDomain && !!sequence && Number(sequence.MoveSpeed) > 0;
  // setAnimationKey/setAnimationSequences create a missing geoset animation
  // and convert inline RGB to keys. Do not make that capability depend on a
  // pre-existing animation record.
  const colorBlocked = disabled || !alphaTargets.length || !sequence && !globalDomain;
  const inlineRgbEditable = !sequence && !globalDomain && inlineColorTargets.length === colorTargets.length;
  const rgbBlocked = disabled || nodeSelection || !geosetIds.length || (!sequence && !globalDomain && !inlineRgbEditable);
  const alphaNumber = alpha === '' ? NaN : Number(alpha);
  const visibleChecked = Number.isFinite(alphaNumber) && alphaNumber > 0;
  const mixedOrPartial = alpha === '' || Number.isFinite(alphaNumber) && alphaNumber !== 0 && alphaNumber !== 100;
  const currentValue = globalDomain ? `global:${globalSeqId}` : sequenceIndex;
  return <section className="animation-controller" aria-label="Animations toolbox">
    <SidebarSection title="Current Sequence"><label className="ac-current"><span className="ac-sequence-combo"><input ref={sequenceNameInput} aria-label="Animation sequence name" className={globalDomain ? 'global-sequence-value' : ''} value={sequenceNameText} disabled={!sequence} readOnly={globalDomain || !sequence} onChange={event => setSequenceNameText(event.target.value)} onBlur={commitSequenceName} onKeyDown={enterBlurs}/><select data-hotkey="animationSequence" aria-label="Choose animation sequence" value={currentValue} onChange={event => onTimelineChange?.(event.target.value)} title="Choose animation sequence">
      <option value={-1}>All line</option>
      {(model.Sequences || []).map((item, index) => <option key={index} value={index} translate="no">{item.Name}</option>)}
      {(model.GlobalSequences || []).map((duration, index) => <option className="global-sequence-value" style={{ color: '#d00000' }} key={`global:${index}`} value={`global:${index}`}>{duration}</option>)}
    </select></span></label></SidebarSection>
    <SidebarSection title="Sequence Properties">
    <div className="ac-caption">Sequence properties:</div>
    <div className="ac-properties">
      <label><input type="checkbox" checked={!!sequence && !sequence.NonLooping} disabled={noLocalSequence} onChange={event => changeSequence({ nonLooping: !event.target.checked })}/>Loop</label>
      <label><input type="checkbox" checked={(sequence?.Rarity || 0) > 0} disabled={noLocalSequence} onChange={event => changeSequence({ rarity: event.target.checked ? 1 : 0 })}/>Use Rarity</label>
      <label className="ac-rarity">Rarity =<input aria-label="Sequence rarity" type="number" min="1" max="40" step="1" disabled={noLocalSequence || !(sequence?.Rarity > 0)} value={sequence?.Rarity > 0 ? sequence.Rarity : ''} onChange={event => { if (event.target.value !== '') changeSequence({ rarity: Number(event.target.value) }); }}/></label>
      <SpeedControl label="Animation Actual Speed" value={animationSpeed(sequence)} disabled={noLocalSequence} onCommit={percent => changeActualSpeed(sequenceIndex, percent)}/>
      <button disabled={disabled || !model.Sequences?.length} onClick={() => { setError(''); setSpeedMenu(true); }}>Adjust All Speed</button>
      <label title="Enable the sequence MoveSpeed ground-speed value."><input type="checkbox" checked={moveApplied} disabled={noLocalSequence} onChange={event => toggleMoveSpeed(event.target.checked)}/>Apply Move Speed</label>
      {moveApplied && <label className="ac-move-speed">Speed=<input aria-label="Sequence move speed" type="number" min="0.001" step="any" disabled={noLocalSequence} value={moveSpeedText} onChange={event => setMoveSpeedText(event.target.value)} onBlur={commitMoveSpeed} onKeyDown={enterBlurs}/></label>}
    </div>
    <div className="ac-caption ac-interval-caption">Frame interval:</div>
    <div className={`ac-interval${globalDomain ? ' global-sequence-value' : ''}`}>
      <input aria-label="Sequence first frame" type="number" min="0" step="1" disabled={disabled || !sequence || globalDomain} value={startText} onChange={event => setStartText(event.target.value)} onBlur={commitInterval} onKeyDown={enterBlurs}/><span>–</span>
      <input aria-label="Sequence last frame" type="number" min={globalDomain ? 1 : Math.max(0, Number(startText) || 0)} step="1" disabled={disabled || !sequence && !globalDomain} value={endText} onChange={event => setEndText(event.target.value)} onBlur={commitInterval} onKeyDown={enterBlurs}/>
    </div>
    <div className="ac-sequence-actions"><button disabled={disabled} onClick={addSequence}>Create</button><button disabled={disabled} onClick={addGlobal}>Global</button><button className="ac-copy-sequence" disabled={noLocalSequence} onClick={copyCurrentSequence}>Create from current</button><button disabled={disabled || !sequence && !globalDomain} onClick={removeCurrent}>Delete</button><button disabled={disabled || Math.max(model.Sequences?.length || 0, model.GlobalSequences?.length || 0) < 2} onClick={() => openReorder()}>Reorder</button></div>
    </SidebarSection>
    <SidebarSection title="Visibility & Color">
    {materialVisibility && <div className="ac-caption">Material {materialVisibility.id+1} · Layer {materialVisibility.layer+1}</div>}
    <div className="ac-geoset-animation">
      <div className="ac-visibility"><span>Visibility:</span>{missingGeosets.length ? <button className="ac-create-visibility" disabled={disabled || !geosetIds.length} onClick={createVisibility}>Create Visibility</button> : <label><input type="checkbox" aria-label="Visible at current frame" checked={visibleChecked} ref={input => { if (input) input.indeterminate = mixedOrPartial; }} disabled={colorBlocked} onChange={event => setVisibility(event.target.checked)}/>On</label>}
        <label className="ac-alpha">Alpha:<input aria-label="Visibility alpha percent" type="number" min="0" max="100" step="1" placeholder={geosetIds.length ? 'Mixed' : ''} disabled={colorBlocked} value={alpha} onChange={event => setAlpha(clampAlphaPercentText(event.target.value))} onBlur={commitAlpha} onKeyDown={enterBlurs}/></label>
      </div>
      <div className="ac-color"><span>Color Tint:</span><div className="ac-rgb">{['R', 'G', 'B'].map((label, index) => <label className={`channel-${label.toLowerCase()}`} key={label}>{label}<input aria-label={`Animation ${label}`} type="number" min="0" max="255" step="1" placeholder={geosetIds.length ? 'Mixed' : ''} disabled={rgbBlocked} value={rgb[index]} onChange={event => setRgb(previous => previous.map((value, i) => i === index ? event.target.value : value))} onBlur={commitRgb} onKeyDown={enterBlurs}/></label>)}</div></div>
    </div>
    <button disabled={nodeSelection || noLocalSequence || !geosetIds.length} onClick={() => bakeRgb(false)}>Bake Sequence RGB</button>
    <button disabled={nodeSelection || disabled || globalDomain || !model.Sequences?.length || !geosetIds.length} onClick={() => bakeRgb(true)}>Bake All RGB</button>
    </SidebarSection>
    {error && !speedMenu && !reorder && <p className="ac-error" role="alert">{error}</p>}{notice && <p className="ac-notice" role="status">{notice}</p>}
    {reorder && <Dialog title="Reorder Animations" onClose={() => setReorder(null)} overlayClass="ac-reorder-menu" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setReorder(null); }} footer={<><button onClick={() => setReorder(null)}>Cancel</button><button disabled={disabled || reorder.order.every((index, position) => index === position)} onClick={applyReorder}>Apply</button></>}>
      <select aria-label="Animation order type" value={reorder.global ? 'global' : 'local'} onChange={event => openReorder(event.target.value === 'global')}><option value="local">Animations</option><option value="global">Global sequences</option></select>
      <select className="ac-reorder-list" aria-label="Animation order" size="10" value={reorder.selected} onChange={event => setReorder(current => ({ ...current, selected: Number(event.target.value) }))}>
        {reorder.order.map((index, position) => <option key={index} value={index} translate="no">{position + 1}. {reorder.global ? `${model.GlobalSequences[index]} ms (${index + 1})` : model.Sequences[index]?.Name}</option>)}
      </select>
      <div className="ac-reorder-actions">
        <button disabled={reorder.order.indexOf(reorder.selected) <= 0} onClick={() => moveReorder(0)}>Move to top</button>
        <button disabled={reorder.order.indexOf(reorder.selected) <= 0} onClick={() => moveReorder(reorder.order.indexOf(reorder.selected) - 1)}>Up</button>
        <button disabled={reorder.order.indexOf(reorder.selected) < 0 || reorder.order.indexOf(reorder.selected) >= reorder.order.length - 1} onClick={() => moveReorder(reorder.order.indexOf(reorder.selected) + 1)}>Down</button>
        <button disabled={reorder.order.indexOf(reorder.selected) < 0 || reorder.order.indexOf(reorder.selected) >= reorder.order.length - 1} onClick={() => moveReorder(reorder.order.length - 1)}>Move to bottom</button>
      </div>
      <p>{reorder.global ? 'Global sequence references follow the new order. Their timing stays unchanged.' : 'Keyframes and events move with each animation. Durations and global timing stay unchanged.'}</p>
      {!reorder.global && <p>Animation indices change to match this order.</p>}
      {error && <p className="ac-error" role="alert">{error}</p>}
    </Dialog>}
    {speedMenu && <Dialog title="Adjust All Speed" onClose={() => setSpeedMenu(false)} overlayClass="ac-speed-menu" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setSpeedMenu(false); }}>
      <SpeedControl label="Master Controller" value={animationMasterSpeed(model)} disabled={disabled} onCommit={percent => changeActualSpeed(null, percent)}/>
      <div className="ac-speed-list">{(model.Sequences || []).map((item, index) => <div className="ac-speed-row" key={index}>
        <label className="ac-speed-name"><input type="checkbox" aria-label={`Include ${item.Name} in Master Controller`} checked={animationSpeedChecked(item)} disabled={disabled} onChange={event => commit('Select animation for Master Controller', ['Sequences', ANIMATION_SPEED_KEY], current => setAnimationSpeedChecked(current, index, event.target.checked), '')}/><span translate="no">{item.Name}</span></label>
        <SpeedControl label={`${item.Name} speed`} value={animationSpeed(item)} disabled={disabled} onCommit={percent => changeActualSpeed(index, percent)}/>
      </div>)}</div>
      {error && <p className="ac-error" role="alert">{error}</p>}
    </Dialog>}
  </section>;
}
