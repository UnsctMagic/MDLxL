import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import ToolWindow from './ToolWindow.jsx';
import { RangeField } from './Fields.jsx';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import { usePreferencesContext } from './PreferencesContext.jsx';
import { sampleGeosetAnimation } from '../src/animation.js';
import { attachematorStandSequence } from '../src/attachemator.js';
import { BIND_DEFAULTS, analyzeBinding, boneColors, defaultExcludedBones, pieceAt, planBinding, previewBinding } from '../src/bind-xl.js';
import './attachemator.css';
import './auto-corpse.css';
import './bind-xl.css';

// The skeleton shows as lines; joint markers appear only while picking a
// bone. Selected parts show their vertices.
const OVERLAYS = { attachments: false, bones: false, helpers: false, nodes: false, particles: false, sounds: false, events: false, skeleton: true, focusedSkeleton: false, selectedVerticesOnly: true };
const PICKING = { ...OVERLAYS, bones: true, helpers: true };
const PLAIN = { ...OVERLAYS, skeleton: false };
const FLEX = 'flex';
// Opens facing the model, fitted to what the animation shows.
const FRONT = 'front';
const percent = value => Math.round(value * 100);
const MODES = [
  ['auto', 'Auto', 'BindXL decides from the sliders.'],
  ['plate', 'Stiff', 'Moves as one piece with one bone, like an armour plate.'],
  ['bend', 'Bend', 'Bends with the bones it sits on, like skin or cloth.'],
  ['keep', 'Current', 'Keeps the binding it has now.'],
];

function Slider({ label, low, high, tip, value, onChange }) {
  return <RangeField className="ax-slider" title={tip} label={label} output={`${value}%`} ends={[low, high]} min="0" max="100" step="5" value={value} inputProps={{ title: tip }} onChange={onChange}/>;
}

/** Walk first (legs and arms both move), then attacks and spells. */
function defaultMotion(model) {
  const names = (model.Sequences || []).map(sequence => sequence.Name || '');
  for (const pattern of [/^walk/i, /walk/i, /attack/i, /spell/i]) { const index = names.findIndex(name => pattern.test(name)); if (index >= 0) return index; }
  return names.length ? 0 : FLEX;
}

const css = rgb => `rgb(${rgb.map(value => Math.round(value * 255)).join(',')})`;

/** Binds vertices to bones from where they sit around the skeleton, live on
 * a moving model. Parts are clicked on the model to make them stiff, bending,
 * kept or held by a chosen bone. Commit applies it as one undoable edit. */
export default function BindXL({ doc, modelPath, textureAssets, teamColor, onCommit, onClose }) {
  const current = useMemo(() => structuredClone(doc.model), [doc.revision]);
  const analysis = useMemo(() => { try { return analyzeBinding(current); } catch (cause) { return { error: cause.message, bones: [], pieces: [] }; } }, [current]);
  const startExcluded = useMemo(() => analysis.error ? new Set() : defaultExcludedBones(current, analysis), [current, analysis]);
  const [excluded, setExcluded] = useState(startExcluded);
  const [rebind, setRebind] = useState(percent(BIND_DEFAULTS.rebind)), [soft, setSoft] = useState(percent(BIND_DEFAULTS.soft));
  const [plates, setPlates] = useState(percent(BIND_DEFAULTS.plates)), [glue, setGlue] = useState(percent(BIND_DEFAULTS.glue));
  const [marks, setMarks] = useState({}), [selected, setSelected] = useState([]), [bone, setBone] = useState(null), [picking, setPicking] = useState(false);
  const [motion, setMotion] = useState(() => defaultMotion(current)), [playing, setPlaying] = useState(true);
  const [colors, setColors] = useState(true), [skeleton, setSkeleton] = useState(true), [flexIndex, setFlexIndex] = useState(0), [error, setError] = useState('');
  const root = useRef(null), camera = useRef({ saved: null, listeners: new Set() }), framed = useRef(false);
  const [preset, setPreset] = useState(null);
  const ready = useCallback(api => { if (api && !framed.current) { framed.current = true; setPreset({ name: FRONT, fit: true, revision: 1 }); } }, []);
  // Small joint markers, so the bone colours stay readable.
  const { preferences } = usePreferencesContext();
  const previewPreferences = useMemo(() => preferences && { ...preferences, visuals: { ...preferences.visuals, helperSize: 5 } }, [preferences]);

  const plan = useMemo(() => {
    if (analysis.error) return { error: analysis.error };
    try { return planBinding(analysis, { rebind: rebind / 100, soft: soft / 100, plates: plates / 100, glue: glue / 100, excluded, marks }); }
    catch (cause) { return { error: cause.message }; }
  }, [analysis, rebind, soft, plates, glue, excluded, marks]);
  const draft = useMemo(() => { if (plan.error) return current; try { return previewBinding(current, analysis, plan); } catch (cause) { return current; } }, [current, analysis, plan]);
  const colorMap = useMemo(() => analysis.error ? null : boneColors(analysis), [analysis]);
  const regionOf = id => analysis.bones.findIndex(region => region.ids.includes(id) || region.driver === id);
  const joints = useMemo(() => new Set(analysis.bones.filter(region => region.ids.some(id => !excluded.has(id))).map(region => region.driver)), [analysis, excluded]);
  const everyGeoset = useMemo(() => new Set((current.Geosets || []).map((_, index) => index)), [current]);
  const bones = useMemo(() => [...(current.Bones || [])].sort((a, b) => String(a.Name).localeCompare(String(b.Name))), [current]);

  // Flex swings one bone at a time in the rest pose, for models without animations.
  const flex = motion === FLEX;
  const flexBones = useMemo(() => analysis.bones.filter(region => region.ids.some(id => !excluded.has(id))).map(region => region.driver), [analysis, excluded]);
  useEffect(() => {
    if (!flex || !playing || flexBones.length < 2) return undefined;
    const timer = setInterval(() => setFlexIndex(index => (index + 1) % flexBones.length), 1600);
    return () => clearInterval(timer);
  }, [flex, playing, flexBones.length]);
  const flexBone = flex && flexBones.length ? flexBones[flexIndex % flexBones.length] : null;
  const wiggle = useMemo(() => flexBone != null && playing ? [flexBone] : undefined, [flexBone, playing]);

  // Only the geosets the chosen animation shows: portrait backdrops, corpse
  // parts and spare bodies stay hidden and out of the framing.
  const shown = useMemo(() => {
    const index = flex ? attachematorStandSequence(current) : motion, sequence = current.Sequences?.[index];
    const visible = (current.Geosets || []).map((_, geoset) => geoset).filter(geoset => {
      if (!sequence) return true;
      const [start, end] = sequence.Interval;
      return [0, .25, .5, .75, 1].some(t => { const frame = Math.round(start + (end - start) * t); return sampleGeosetAnimation(current, geoset, frame, index, frame).alpha > .01; });
    });
    return { visible, hidden: (current.Geosets || []).map((_, geoset) => geoset).filter(geoset => !visible.includes(geoset)) };
  }, [current, motion, flex]);
  // Dots on the selected parts, or (with no part selected) on the clicked bone's vertices.
  const selection = useMemo(() => {
    const byGeoset = {}, add = flat => (byGeoset[analysis.geosetOf[flat]] ||= []).push(analysis.vertexOf[flat]);
    if (selected.length) for (const index of selected) for (const flat of analysis.pieces[index]?.vertices || []) add(flat);
    else if (bone != null && plan.groups) for (let flat = 0; flat < analysis.count; flat++) if (plan.groups[flat].includes(bone)) add(flat);
    return byGeoset;
  }, [selected, bone, plan, analysis]);
  // The bones the selected parts follow (or the clicked bone) are labelled.
  const followed = useMemo(() => {
    const ids = new Set();
    if (!plan.groups) return ids;
    for (const index of selected) for (const flat of analysis.pieces[index]?.vertices || []) for (const id of plan.groups[flat]) ids.add(id);
    return ids;
  }, [selected, plan, analysis]);
  const labels = useMemo(() => {
    const ids = new Set();
    for (const id of [...followed, ...(bone != null ? [bone] : []), ...(flexBone != null ? [flexBone] : [])]) { const region = analysis.bones[regionOf(id)]; ids.add(region ? region.driver : id); }
    return ids;
  }, [followed, bone, flexBone, analysis]);

  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);
  useWindowKeyClaim(({ event, localWindow }) => { if (localWindow !== root.current || event.key !== 'Escape' || !picking) return false; setPicking(false); return true; });

  const pickPart = (hit, { shift, ctrl }) => {
    setError('');
    if (!hit) { if (!shift && !ctrl) { setSelected([]); setBone(null); setPicking(false); } return; }
    const piece = pieceAt(analysis, hit.geosetIndex, hit.vertexIndex);
    if (piece < 0) return;
    setBone(null);
    setSelected(previous => ctrl ? previous.filter(index => index !== piece) : shift ? [...new Set([...previous, piece])] : [piece]);
  };
  const markSelected = mark => setMarks(previous => {
    const next = { ...previous };
    for (const index of selected) { const key = analysis.pieces[index].key; if (mark) next[key] = mark; else delete next[key]; }
    return next;
  });
  const pickBone = ids => {
    const id = ids.at(-1);
    if (id == null) { setBone(null); return; }
    const region = analysis.bones[regionOf(id)];
    const boneId = region ? region.ids.find(other => !excluded.has(other)) ?? region.id : id;
    if (picking && selected.length) { markSelected({ mode: 'plate', bone: boneId }); setPicking(false); return; }
    setBone(boneId);
  };
  const toggleBone = (id, use) => setExcluded(previous => {
    const next = new Set(previous), region = analysis.bones[regionOf(id)];
    for (const other of region ? region.ids : [id]) { if (use) next.delete(other); else next.add(other); }
    return next;
  });
  const reset = () => {
    setRebind(percent(BIND_DEFAULTS.rebind)); setSoft(percent(BIND_DEFAULTS.soft)); setPlates(percent(BIND_DEFAULTS.plates)); setGlue(percent(BIND_DEFAULTS.glue));
    setMarks({}); setExcluded(startExcluded); setPicking(false);
  };
  const commit = () => {
    setError('');
    try { if (onCommit({ analysis, plan }) !== false) onClose(); }
    catch (cause) { setError(cause.message); }
  };

  const selectedMarks = selected.map(index => marks[analysis.pieces[index].key]?.mode || 'auto');
  const sharedMark = selectedMarks.length && selectedMarks.every(mode => mode === selectedMarks[0]) ? selectedMarks[0] : null;
  const markBone = selected.length && selected.every(index => marks[analysis.pieces[index].key]?.bone === marks[analysis.pieces[selected[0]].key]?.bone) ? marks[analysis.pieces[selected[0]].key]?.bone ?? '' : '';
  const nameOf = id => current.Nodes?.[id]?.Name ?? (current.Bones || []).find(node => node.ObjectId === id)?.Name ?? `Bone ${id}`;
  const chip = id => <button type="button" key={id} className="bxl-chip" translate="no" aria-pressed={bone === id} title="Show this bone" onClick={() => setBone(id)}><i style={{ background: colorMap?.get(id) ? css(colorMap.get(id)) : '#999' }}/>{nameOf(id)}</button>;
  const sequence = flex ? null : current.Sequences?.[motion];
  const status = error || plan.error || (picking ? 'Click a bone in the preview.' : flex && flexBone != null ? `Flex: ${nameOf(analysis.bones[regionOf(flexBone)]?.id ?? flexBone)}` : 'Click a part to change how it moves. Drag to turn the camera.');

  return <ToolWindow title="BindXL" overlayClass="atm-overlay" className="atm-window bxl-window" windowRef={root} onClose={onClose} sectionProps={{ 'data-hotkey-scope': 'bindXL' }}
    caption={<><strong title="Binds vertices to bones from where they sit around the skeleton, on a moving model.">BindXL</strong><span className="atm-spacer"/></>}>
      <div className="atm-body bxl-body">
        <div className="acp-controls bxl-controls">
          <div className="acp-transport bxl-motion" title="The animation the preview plays. Flex swings each bone in turn.">
            <select aria-label="Animation" value={motion} onChange={event => { setMotion(event.target.value === FLEX ? FLEX : Number(event.target.value)); setPlaying(true); }}>
              {(current.Sequences || []).map((item, index) => <option key={index} value={index} translate="no">{item.Name}</option>)}
              <option value={FLEX}>Flex</option>
            </select>
            <button aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(value => !value)}>{playing ? '❚❚' : '▶'}</button>
          </div>
          <Slider label="Rebind" low="Current" high="Skeleton" value={rebind} onChange={setRebind}
            tip="How much to rebind from the skeleton. At Current, only torn seams, stray vertices and vertices bound to far-away bones change. At Skeleton, everything is bound by where it sits."/>
          <Slider label="Soft joints" low="Sharp" high="Smooth" value={soft} onChange={setSoft}
            tip="How far bending parts blend between two bones around a joint. Sharp: every vertex follows one bone."/>
          <Slider label="Plates" low="Bend" high="Stiff" value={plates} onChange={setPlates}
            tip="How readily a separate part moves stiffly with one bone, like an armour plate, instead of bending."/>
          <Slider label="Seams" low="Touching" high="Near" value={glue} onChange={setGlue}
            tip="Vertices of different parts closer than this share one binding, so seams never tear open."/>
          <div className="bxl-checks">
            <label className="check" title="Colours every part by the bones it follows. Blended areas mix the colours."><input type="checkbox" checked={colors} onChange={event => setColors(event.target.checked)}/>Bone colours</label>
            <label className="check" title="Shows the bones as lines. Pick shows their joints to click."><input type="checkbox" checked={skeleton} onChange={event => setSkeleton(event.target.checked)}/>Skeleton</label>
          </div>
          {selected.length > 0 && <section className="bxl-panel" aria-label="Selected parts">
            <div className="bxl-panel-head">{selected.length === 1 ? 'Part' : `${selected.length} parts`}<span className="bxl-chips">{[...followed].map(chip)}</span></div>
            <div className="bxl-modes" role="group" aria-label="How the selected parts move">
              {MODES.map(([mode, label, tip]) => <button key={mode} aria-pressed={sharedMark === mode} title={tip} onClick={() => markSelected(mode === 'auto' ? null : { mode })}>{label}</button>)}
            </div>
            <div className="acp-field bxl-bone" title="Makes the selected parts stiff and held by this bone.">
              <select aria-label="Bone for the selected parts" value={markBone} onChange={event => markSelected(event.target.value === '' ? null : { mode: 'plate', bone: Number(event.target.value) })}>
                <option value="">Bone…</option>
                {bones.map(node => <option key={node.ObjectId} value={node.ObjectId} translate="no">{node.Name}</option>)}
              </select>
              <button className="atm-small" aria-pressed={picking} title="Click, then click a bone in the preview to hold the selected parts with it (Esc cancels)" onClick={() => setPicking(value => !value)}>Pick</button>
            </div>
          </section>}
          {bone != null && <section className="bxl-panel" aria-label="Selected bone">
            <div className="bxl-panel-head">{chip(bone)}</div>
            <label className="check" title="Untick to keep vertices off this bone. Parts held only by unticked bones keep their binding."><input type="checkbox" checked={!excluded.has(bone)} onChange={event => toggleBone(bone, event.target.checked)}/>Bind to this bone</label>
          </section>}
          <button className="bxl-reset" title="Back to the starting sliders and no marked parts" onClick={reset}>Reset</button>
        </div>
        <section className="atm-preview bxl-preview" aria-label="BindXL preview">
          <GamePreview textureAssets={textureAssets} modelPath={modelPath} teamColor={teamColor} model={draft} revision={doc.revision}
            sequenceIndex={flex ? -1 : motion} time={sequence?.Interval?.[0] ?? 0} playing={playing && !flex} loop restPose={flex} wiggleNodeIds={wiggle}
            hiddenGeosets={shown.hidden} showGrid fitModel showAxes={false} showParticles={false} overlays={picking ? PICKING : skeleton ? OVERLAYS : PLAIN} markerNodeIds={joints} markersOnTop nodeLabels={labels}
            cameraMode="work" emptyDragRotates compareCamera={camera.current} preserveCameraView cameraPresetRequest={preset} onCaptureReady={ready} preferences={previewPreferences}
            boneColors={colors ? colorMap : undefined} selectableGeosets={everyGeoset} selectionByGeoset={selection} highlightSelection
            selectedNodeIds={bone != null ? [analysis.bones[regionOf(bone)]?.driver ?? bone] : []} onSelectNodes={pickBone} onPickPart={pickPart}/>
        </section>
      </div>
      <footer>
        <span role="status" className={error || plan.error ? 'atm-error' : 'atm-muted'}>{status}</span>
        <button className="atm-commit active" disabled={!!plan.error || doc.readOnly} title="Apply this binding as one undoable edit" onClick={commit}>Commit</button>
        <button onClick={onClose}>Close</button>
      </footer>
  </ToolWindow>;
}
