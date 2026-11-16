import { useWindowHotkeys } from './Hotkeys.jsx';
import { windowCommandActions } from '../src/commands.js';
import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ToolWindow from './ToolWindow.jsx';
import { RangeField } from './Fields.jsx';
import { createFrameCoalescer } from './viewport-performance.js';
import { openDocument } from '../src/editor-document.js';
import { resolveGameFiles } from './desktop.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { applyTransfer, buildTransfer, clearTransferCache, defaultTransferPart, transferNodeTracks, transferPartLabel, transferPreviewModel, transferRestoreTracks, transferRig } from '../src/anim-transfer.js';
import { chipOrder, donorPartKey, handlePart, partHandle, takenSummary } from '../src/transfer-window.js';
import './resource-editors.css';
import './texture-library.css';
import './transfer.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const GameFileBrowser = lazy(() => import('./GameFileBrowser.jsx'));
// Everything applyTransfer can write: the new animation, and the body animation copied
// into every track (geosets, materials, texture animations, every node kind, cameras).
const SECTIONS = ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Bones', 'Helpers', 'Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'EventObjects', 'CollisionShapes', 'Cameras'];
const HIGHLIGHT = '#ffe14d';
const noop = () => {};
const sequenceName = (model, index) => model?.Sequences?.[index]?.Name || `Animation ${index + 1}`;
const firstAnimation = model => { const stand = standSequenceIndex(model); return stand >= 0 ? stand : model?.Sequences?.length ? 0 : -1; };

// The sliders. `get`/`set` convert between the recipe and what the slider shows.
const offsetField = (index, limb, trunk) => ({
  id: 'offset' + index, min: -90, max: 90, step: 1, unit: '°', only: 'one',
  label: kind => kind === 'trunk' ? trunk[0] : limb[0], tip: kind => kind === 'trunk' ? trunk[1] : limb[1],
  get: part => part.offset?.[index] ?? 0, set: (part, value) => ({ ...part, offset: [0, 1, 2].map(i => i === index ? value : part.offset?.[i] ?? 0) }),
});
const FIELDS = [
  { id: 'amount', label: () => 'Amount', min: 0, max: 150, step: 1, unit: '%', tip: () => 'How much of the taken movement plays. 100% is the donor\'s movement; 0% is the body animation.', get: part => part.amount * 100, set: (part, value) => ({ ...part, amount: value / 100 }) },
  { id: 'match', label: () => 'Match pose', min: 0, max: 100, step: 1, unit: '%', tip: () => '0%: keeps this model\'s own stance and adds the movement. 100%: the part points the way the donor\'s does.', get: part => part.match * 100, set: (part, value) => ({ ...part, match: value / 100 }) },
  offsetField(0, ['Raise', 'Turns the part up or down.'], ['Lean', 'Leans the part forward or back.']),
  offsetField(1, ['Swing', 'Turns the part forward or back around the vertical.'], ['Tilt', 'Tilts the part to the side.']),
  offsetField(2, ['Twist', 'Turns the part around its own length.'], ['Turn', 'Turns the part left or right.']),
  { id: 'start', label: () => 'Start', min: 0, max: 2000, step: 10, unit: ' ms', tip: () => 'When the taken movement starts in the new animation.', get: part => part.start, set: (part, value) => ({ ...part, start: value }) },
  { id: 'speed', label: () => 'Speed', min: 25, max: 300, step: 5, unit: '%', tip: () => 'Plays the taken movement faster or slower.', get: part => part.speed * 100, set: (part, value) => ({ ...part, speed: value / 100 }) },
  { id: 'blend', label: () => 'Blend', min: 0, max: 500, step: 10, unit: ' ms', only: 'nonLooping', tip: () => 'Eases the taken movement in after it starts and out before it ends.', get: part => part.blend, set: (part, value) => ({ ...part, blend: value }) },
  { id: 'travel', label: () => 'Travel', min: 0, max: 200, step: 1, unit: '%', only: 'hips', tip: () => 'How far the body moves with the donor\'s hips. 100% follows the donor, scaled to this model\'s size.', get: part => part.travel * 100, set: (part, value) => ({ ...part, travel: value / 100 }) },
];

/** The donor pane's preview: plays its own clock, so only it redraws while it plays. */
const DonorStage = memo(function DonorStage({ donor, sequence, playing, poseConfig, onPoseSelect }) {
  const interval = donor.model.Sequences?.[sequence]?.Interval;
  const [time, setTime] = useState(interval?.[0] ?? 0);
  useEffect(() => { setTime(interval?.[0] ?? 0); }, [donor.model, sequence]);
  return <Suspense fallback={<span className="xf-note">Loading preview…</span>}>
    <GamePreview key={donor.id} presentation="preview" interactivePreview fitModel fitSequenceExtent fitBox showGrid={false} showAxes={false} preserveCameraView model={donor.model} revision={donor.revision} textureAssets={donor.assets} sequenceIndex={sequence} time={time} onTimeChange={setTime} playing={playing}
      cleanAnimationPreview emptyDragRotates transformMode="select" poseConfig={poseConfig} poseDocumentModel={donor.model} onPoseSelect={onPoseSelect} onPoseCommit={noop}/>
  </Suspense>;
});

/** The Library's game-model browser, picking a donor instead of opening a tab. */
function LibraryPicker({ onPick, onClose }) {
  return <ToolWindow title="Library" overlayClass="tl-overlay xf-library" className="tl-dialog" headerClass="tl-header xf-library-header" onClose={onClose}>
    <Suspense fallback={<p className="tl-empty">Loading game files…</p>}><GameFileBrowser preset="models" pickLabel="Use this model" onOpenGameModel={onPick} onClose={onClose}/></Suspense>
  </ToolWindow>;
}

/** Transfer: give the open model movement from another model (or another of its own
 * animations), body part by body part. Contract: docs/agent-tasks/transfer-xl.md. */
export default function Transfer({ doc, edit, textureAssets, teamColor, modelPath, otherModels = [], onClose }) {
  const model = doc.model, sequences = model.Sequences || [];
  // The engine caches each model's rig; an edit to this model (Add animation, Undo) starts afresh.
  const rigB = useMemo(() => { clearTransferCache(model); return transferRig(model); }, [model, doc.revision]);
  const poseB = useMemo(() => { try { return rigB.ok ? suggestPoseRig(model, rigB.reference.frame, Math.max(0, rigB.reference.sequence)) : null; } catch { return null; } }, [rigB]);
  const dialog = useRef(null);

  // Donors loaded in this window. Never tabs, never changed. 'self' is the open model.
  const [donors, setDonors] = useState([]), [donorId, setDonorId] = useState(null), [donorSeqs, setDonorSeqs] = useState({});
  const [loading, setLoading] = useState(''), [message, setMessage] = useState(''), [picker, setPicker] = useState(false);
  const releases = useRef([]);
  useEffect(() => () => { for (const release of releases.current) release(); }, []);
  const donor = useMemo(() => { const d = donors.find(item => item.id === donorId); return d?.id === 'self' ? { ...d, model, assets: textureAssets, revision: doc.revision } : d; }, [donors, donorId, model, textureAssets, doc.revision]);
  const modelOf = id => id === 'self' ? model : donors.find(d => d.id === id)?.model;
  const nameOf = id => id === 'self' ? 'This model' : donors.find(d => d.id === id)?.name || '';
  const sources = useMemo(() => new Map(donors.filter(d => d.id !== 'self').map(d => [d.id, d.model])), [donors]);
  const rigA = useMemo(() => donor ? transferRig(donor.model) : null, [donor?.model, donor?.revision]);
  const poseA = useMemo(() => { try { return rigA?.ok ? suggestPoseRig(donor.model, rigA.reference.frame, Math.max(0, rigA.reference.sequence)) : null; } catch { return null; } }, [rigA]);
  const donorSeq = donor ? donorSeqs[donor.id] ?? firstAnimation(donor.model) : -1;
  const addDonor = (record, sequence) => {
    setDonors(list => [...list.filter(d => d.id !== record.id), record]);
    setDonorSeqs(old => ({ ...old, [record.id]: old[record.id] ?? sequence ?? firstAnimation(record.id === 'self' ? model : record.model) }));
    setDonorId(record.id); setMessage('');
  };
  const chooseSelf = () => addDonor({ id: 'self', name: 'This model' });
  const chooseTab = session => {
    const id = 'tab:' + session.id;
    if (donors.some(d => d.id === id)) { setDonorId(id); return; }
    // A snapshot, so the donor stays as it was when it was chosen.
    let copy; try { copy = structuredClone(session.doc.model); } catch { copy = session.doc.model; }
    addDonor({ id, name: session.doc.name, model: copy, assets: session.assets, revision: 0 });
  };
  const loaded = async (id, name, bytes, textures) => {
    const opened = openDocument(bytes, name);
    if (!opened.model) throw new Error('This model could not be read.');
    const { previewAssets } = await import('./GameFileBrowser.jsx');
    const preview = previewAssets(textures);
    releases.current.push(preview.release);
    addDonor({ id, name, model: opened.model, assets: preview.assets, revision: 0 });
  };
  const openFile = async () => {
    if (!window.desktop?.openTransferModel) { setMessage('Opening a file needs the desktop app.'); return; }
    try {
      const record = await window.desktop.openTransferModel();
      if (!record) return;
      setLoading(record.name);
      const names = (openDocument(record.bytes, record.name).model?.Textures || []).map(texture => texture.Image).filter(Boolean);
      const found = names.length ? await resolveGameFiles(names, record.path) : [];
      await loaded('file:' + (record.path || record.name), record.name, record.bytes, found.filter(item => item?.bytes).map(item => ({ name: item.logicalName || item.texturePath || item.name, bytes: item.bytes })));
    } catch (error) { setMessage(error.message); }
    finally { setLoading(''); }
  };
  const pickLibrary = async ({ name, path, bytes, textures }) => {
    setLoading(name);
    try { await loaded('lib:' + (path || name), name, bytes, textures || []); }
    catch (error) { setMessage(error.message); }
    finally { setLoading(''); }
  };
  const chooseFrom = value => {
    if (value === '#open') openFile();
    else if (value === '#library') setPicker(true);
    else if (value === 'self') chooseSelf();
    else if (value.startsWith('tab:') && !donors.some(d => d.id === value)) { const session = otherModels.find(s => 'tab:' + s.id === value); if (session) chooseTab(session); }
    else setDonorId(value);
  };

  // The recipe is the whole editable state; every change rebuilds from it (src/anim-transfer.js).
  const initialBase = firstAnimation(model);
  const [recipe, setRecipe] = useState(() => ({ base: { sequence: initialBase }, length: null, sources: {}, parts: {} }));
  const [draft, setDraft] = useState(null);
  const recipeRef = useRef(recipe); recipeRef.current = recipe;
  const history = useRef({ undo: [], redo: [] });
  const change = next => { if (next === recipeRef.current) return; history.current.undo.push(recipeRef.current); if (history.current.undo.length > 200) history.current.undo.shift(); history.current.redo = []; recipeRef.current = next; setRecipe(next); };
  const stepHistory = redo => {
    const h = history.current, from = redo ? h.redo : h.undo, to = redo ? h.undo : h.redo;
    if (!from.length) return;
    to.push(recipeRef.current); const previous = from.pop(); recipeRef.current = previous; setRecipe(previous); setDraft(null);
  };
  // A base animation removed by an Undo in the editor falls back to the first one.
  useEffect(() => { if (!sequences[recipe.base.sequence] && sequences.length) change({ ...recipe, base: { sequence: initialBase } }); }, [doc.revision]);
  const effective = draft || recipe;
  const taken = Object.keys(effective.parts).filter(key => rigB.parts[key]);
  const [selected, setSelected] = useState(null);
  const mirrorOf = id => {
    const own = recipe.sources?.[id]?.mirror;
    if (own != null) return own;
    const rig = modelOf(id) && transferRig(modelOf(id));
    return id !== 'self' && !!rig?.weaponSide && !!rigB.weaponSide && rig.weaponSide !== rigB.weaponSide;
  };
  const donorMirror = donor ? mirrorOf(donor.id) : false;
  const donorLacks = key => !rigA?.parts?.[donorPartKey(key, donorMirror)];
  const clipNonLooping = part => !!modelOf(part.source)?.Sequences?.[part.sequence]?.NonLooping && part.loop !== true;
  const clipName = part => `${nameOf(part.source)} - ${sequenceName(modelOf(part.source), part.sequence)}`;
  const shareClip = (parts, part) => Object.values(parts).filter(other => other.source === part.source && other.sequence === part.sequence).length > 1;

  const take = key => {
    if (!donor || donorLacks(key) || donorSeq < 0) return;
    const old = recipe.parts[key];
    change({ ...recipe, parts: { ...recipe.parts, [key]: old ? { ...old, source: donor.id, sequence: donorSeq } : { ...defaultTransferPart(rigB, key, false), source: donor.id, sequence: donorSeq } } });
    setSelected(key);
  };
  const takeWhole = () => {
    if (!donor || donorSeq < 0) return;
    const parts = { ...recipe.parts };
    for (const key of Object.keys(rigB.parts)) if (!donorLacks(key)) parts[key] = { ...defaultTransferPart(rigB, key, true), source: donor.id, sequence: donorSeq };
    change({ ...recipe, parts }); setSelected('all');
  };
  const giveBack = keys => { const parts = { ...recipe.parts }; for (const key of keys) delete parts[key]; change({ ...recipe, parts }); };
  const reset = keys => { const parts = { ...recipe.parts }; for (const key of keys) if (parts[key]) parts[key] = { ...defaultTransferPart(rigB, key, shareClip(recipe.parts, parts[key])), source: parts[key].source, sequence: parts[key].sequence }; change({ ...recipe, parts }); };
  const toggleMirror = () => { if (donor) change({ ...recipe, sources: { ...recipe.sources, [donor.id]: { mirror: !donorMirror } } }); };
  const setBase = sequence => change({ ...recipe, base: { sequence } });

  // Built motion. Slider drags change `draft` at most once per display frame.
  const outcome = useMemo(() => {
    if (!rigB.ok) return { error: '' };
    try { return { built: buildTransfer(model, sources, effective) }; } catch (error) { return { error: error.message }; }
  }, [model, rigB, sources, effective]);
  const built = outcome.built;

  // The result pane plays a private copy. It is rebuilt only when the body animation or
  // the result's length changes, and never during a drag; otherwise node tracks are swapped.
  const shape = built ? `${doc.revision}|${effective.base.sequence}|${built.length}|${built.nonLooping}|${built.baseClock.rate}` : null;
  // touched: nodes whose tracks were swapped since the copy was made; swapped: the renderer differs from the copy.
  const [preview, setPreview] = useState(null), touched = useRef(new Set()), swapped = useRef(false);
  useEffect(() => {
    if (!built || draft || preview?.shape === shape) return;
    const made = transferPreviewModel(model, built, effective);
    // The copy skips extents; framing uses the body animation's own box (the camera is framed once, on opening).
    const own = made.model.Sequences[made.sequenceIndex], base = model.Sequences[effective.base.sequence];
    if (base?.MinimumExtent && base?.MaximumExtent) { own.MinimumExtent = Float32Array.from(base.MinimumExtent); own.MaximumExtent = Float32Array.from(base.MaximumExtent); }
    touched.current = new Set(built.driven); swapped.current = false;
    setPreview({ ...made, shape, built, start: made.model.Sequences[made.sequenceIndex].Interval[0], end: made.model.Sequences[made.sequenceIndex].Interval[1] });
  }, [shape, draft, built]);
  const [original, setOriginal] = useState(false);
  const liveTracks = useMemo(() => {
    if (!preview || !built) return [];
    if (!original && built === preview.built && !swapped.current) return [];
    swapped.current = true;
    const ids = original ? [] : built.driven;
    for (const id of ids) touched.current.add(id);
    const back = [...touched.current].filter(id => !ids.includes(id));
    return [...(ids.length ? transferNodeTracks(preview.model, preview.sequenceIndex, built) : []), ...(back.length ? transferRestoreTracks(model, preview.start, built, back) : [])];
  }, [preview, built, original, model]);

  // Playback: one clock for the result; the donor plays its own animation and pauses with it.
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(true);
  useEffect(() => { if (preview && (time < preview.start || time > preview.end)) setTime(preview.start); }, [preview]);
  const scrubValue = useRef(null), scrub = useRef(null);
  scrub.current ||= createFrameCoalescer(() => { if (scrubValue.current != null) setTime(scrubValue.current); });
  const sliderValue = useRef(null), slider = useRef(null);
  slider.current ||= createFrameCoalescer(() => { if (sliderValue.current) setDraft(sliderValue.current); });
  useEffect(() => () => { scrub.current.cancel(); slider.current.cancel(); }, []);

  // Selection and the handles.
  const selectedKeys = selected === 'all' ? taken : selected && effective.parts[selected] ? [selected] : [];
  const selectedPart = selected && selected !== 'all' ? rigB.parts[selected] : null;
  const resultPose = useMemo(() => poseB && { ...poseB, enabled: true, picking: null, pins: poseB.pins || [], target: selectedPart ? partHandle(rigB, poseB, selected) : null, inspectPaths: selectedKeys.map(key => rigB.parts[key].joints), inspectColor: HIGHLIGHT, inspectThin: selected === 'all' }, [poseB, rigB, selected, selectedKeys.join(',')]);
  const donorPose = useMemo(() => {
    if (!poseA || !donor) return null;
    // Joint paths for the selected part only (All: every taken part, thinner); the chips say what is taken.
    const mine = selectedKeys.filter(key => effective.parts[key].source === donor.id).map(key => rigA.parts[donorPartKey(key, donorMirror)]).filter(Boolean);
    const shown = selectedPart && !donorLacks(selected) ? donorPartKey(selected, donorMirror) : null;
    return { ...poseA, enabled: true, picking: null, pins: poseA.pins || [], target: shown ? partHandle(rigA, poseA, shown) : null, inspectPaths: mine.map(part => part.joints), inspectColor: HIGHLIGHT, inspectThin: selected === 'all' };
  }, [poseA, rigA, donor?.id, donorMirror, selected, selectedKeys.join(','), takenSummary(effective)]);
  const latestHandlers = useRef({});
  latestHandlers.current.donorHandle = target => {
    const theirs = handlePart(rigA, poseA, target);
    if (!theirs) return;
    const key = donorPartKey(theirs, donorMirror);
    if (!rigB.parts[key]) { setMessage(`This model has no ${transferPartLabel(key)}.`); return; }
    setMessage(''); take(key);
  };
  latestHandlers.current.resultHandle = target => { const key = handlePart(rigB, poseB, target); if (key) setSelected(key); };
  const onDonorHandle = useCallback(target => latestHandlers.current.donorHandle(target), []);
  const onResultHandle = useCallback(target => latestHandlers.current.resultHandle(target), []);

  // Sliders: the selection's values; with All, every taken part.
  const applies = (field, key) => field.only === 'one' ? selected !== 'all' : field.only === 'hips' ? key === 'hips' : field.only === 'nonLooping' ? clipNonLooping(effective.parts[key]) : true;
  const setField = (field, value, live) => {
    const base = recipeRef.current, parts = { ...base.parts };
    for (const key of selectedKeys) if (parts[key] && applies(field, key)) parts[key] = field.set(parts[key], value);
    const next = { ...base, parts };
    if (live) { sliderValue.current = next; slider.current.schedule(); return; }
    slider.current.cancel(); sliderValue.current = null; setDraft(null); change(next);
  };
  // The slider's own draft ends (release or Escape): drop the live recipe; a release then commits.
  const endDrag = () => { slider.current.cancel(); sliderValue.current = null; setDraft(null); };
  const legs = selectedKeys.filter(key => rigB.parts[key]?.kind === 'limb' && /^leg/.test(key));
  const kind = selectedPart?.kind;

  // Add animation: one edit, one Undo step, built afresh from the document's own model.
  const [name, setName] = useState(null), [added, setAdded] = useState(''), addedRecipe = useRef(null);
  const shownName = name ?? built?.suggestedName ?? '';
  const add = () => {
    if (!built || !taken.length || doc.readOnly) return;
    const finalName = shownName.trim() || built.suggestedName, current = recipeRef.current;
    const result = edit(`Transfer: add ${finalName}`, SECTIONS, m => { clearTransferCache(m); applyTransfer(m, buildTransfer(m, sources, current), current, { name: finalName }); });
    clearTransferCache(model);
    if (result === false) return;
    addedRecipe.current = JSON.stringify(current); setAdded(finalName); setName(null);
  };
  useEffect(() => { if (added && addedRecipe.current !== JSON.stringify(recipe)) setAdded(''); }, [recipe]);
  const unapplied = taken.length > 0 && !doc.readOnly && addedRecipe.current !== JSON.stringify(recipe);

  useWindowHotkeys('transfer', windowCommandActions('transfer', 'Transfer', {undo: () => stepHistory(false), redo: () => stepHistory(true), play: () => setPlaying(v => !v)}).map(action => ({...action, allowInInput: action.bindingCommand !== 'play'})));
  useEffect(() => { dialog.current?.focus(); }, []);

  const picking = picker && <LibraryPicker onPick={pickLibrary} onClose={() => setPicker(false)}/>;
  return <ToolWindow title="Transfer" overlayClass="resource-editor transfer-xl" className="re-window xf-window" headerClass="re-caption" closeClass="re-caption-close" closeTitle="Close. Parts not added are lost." windowRef={dialog} onClose={onClose} unapplied={unapplied} after={picking} sectionProps={{'data-hotkey-prefix': 'transfer', 'data-hotkey-scope': 'transfer'}}>
    {!rigB.ok ? <div className="xf-problems" role="alert">{rigB.problems.map(text => <p key={text}>{text}</p>)}</div> : <>
      <div className="xf-panes">
        <section className="xf-pane" aria-label="From">
          <div className="xf-pane-head">
            <b>From</b>
            {donor && <select data-hotkey="transfer:from" data-hotkey-manual data-hotkey-label="From" aria-label="From" title="The model to take animation from. It is only read, never changed." value={donor.id} onChange={event => chooseFrom(event.target.value)}>
              {!donors.some(d => d.id === 'self') && <option value="self">This model</option>}
              {donors.map(d => d.id === 'self' ? <option key={d.id} value={d.id}>This model</option> : <option key={d.id} value={d.id} translate="no">{d.name}</option>)}
              {otherModels.filter(s => !donors.some(d => d.id === 'tab:' + s.id)).map(s => <option key={s.id} value={'tab:' + s.id} translate="no">{s.doc.name}</option>)}
              <option value="#open">Open file...</option>
              <option value="#library">Library...</option>
            </select>}
            {donor && <button data-hotkey="transfer:mirror" data-hotkey-manual data-hotkey-label="Mirror" aria-pressed={donorMirror} disabled={!rigA?.ok} title="Swap left and right: the donor's left side drives this model's right side. On by itself when the two models hold their weapon in opposite hands." onClick={toggleMirror}>Mirror</button>}
          </div>
          <div className="xf-preview">
            {donor ? <>
              <DonorStage donor={donor} sequence={donorSeq} playing={playing} poseConfig={donorPose} onPoseSelect={onDonorHandle}/>
              {!rigA?.ok && <div className="xf-overlay-note" role="status">{(rigA?.problems || []).map(text => <p key={text}>{text}</p>)}</div>}
            </> : <div className="xf-choices" role="group" aria-label="Take animation from">
              <span>Take animation from</span>
              <button data-hotkey="transfer:this-model" data-hotkey-manual data-hotkey-label="This model" title="Another animation of this model." onClick={chooseSelf}>This model</button>
              {otherModels.map(s => <button key={s.id} title="This open model. It is only read, never changed." onClick={() => chooseTab(s)}><span translate="no">{s.doc.name}</span></button>)}
              <button data-hotkey="transfer:open-file" data-hotkey-manual data-hotkey-label="Open file..." title="A model file. It is only read and does not open as a tab." onClick={openFile}>Open file...</button>
              <button data-hotkey="transfer:library" data-hotkey-manual data-hotkey-label="Library..." title="A Warcraft III model from the game files." onClick={() => setPicker(true)}>Library...</button>
            </div>}
            {(loading || message) && <div className="xf-overlay-note xf-message" role="status">{loading ? 'Loading model…' : message}</div>}
          </div>
          {donor && <div className="xf-pane-foot">
            <label title="The donor's animation to take movement from.">Animation <select data-hotkey="transfer:donor-animation" data-hotkey-manual data-hotkey-label="Donor animation" aria-label="Animation" value={donorSeq} onChange={event => setDonorSeqs(old => ({ ...old, [donor.id]: Number(event.target.value) }))}>{(donor.model.Sequences || []).map((s, i) => <option key={i} value={i} translate="no">{sequenceName(donor.model, i)}</option>)}</select></label>
            <button data-hotkey="transfer:take-whole-body" data-hotkey-manual data-hotkey-label="Take whole body" disabled={!rigA?.ok || donorSeq < 0} title="Take every part both models have from this animation." onClick={takeWhole}>Take whole body</button>
          </div>}
        </section>
        <section className="xf-pane" aria-label="To">
          <div className="xf-pane-head"><b>To</b><span translate="no">{doc.name}</span></div>
          <div className="xf-preview">
            {preview && <Suspense fallback={<span className="xf-note">Loading preview…</span>}>
              <GamePreview presentation="preview" interactivePreview fitModel fitSequenceExtent fitBox showGrid={false} showAxes={false} preserveCameraView model={preview.model} revision={preview.shape} textureAssets={textureAssets} modelPath={modelPath} teamColor={teamColor} sequenceIndex={preview.sequenceIndex} time={time} onTimeChange={setTime} playing={playing} onPlayingChange={setPlaying} liveNodeTracks={liveTracks}
                cleanAnimationPreview emptyDragRotates transformMode="select" poseConfig={resultPose} poseDocumentModel={preview.model} onPoseSelect={onResultHandle} onPoseCommit={noop}/>
            </Suspense>}
            {outcome.error && <div className="xf-overlay-note" role="status">{outcome.error}</div>}
          </div>
          <div className="xf-pane-foot">
            <label title="This model's own animation under everything. Parts that are not taken keep moving as it does.">Body animation <select data-hotkey="transfer:body-animation" data-hotkey-manual data-hotkey-label="Body animation" aria-label="Body animation" value={recipe.base.sequence} onChange={event => setBase(Number(event.target.value))}>{sequences.map((s, i) => <option key={i} value={i} translate="no">{sequenceName(model, i)}</option>)}</select></label>
          </div>
        </section>
      </div>
      <div className="xf-parts">
        <div className="xf-chips" role="group" aria-label="Parts">
          <button data-hotkey="transfer:all" data-hotkey-manual data-hotkey-label="All parts" aria-pressed={selected === 'all'} className="xf-chip" title="Every taken part at once. Double-click takes the whole body." onClick={() => setSelected('all')} onDoubleClick={takeWhole}>All</button>
          {chipOrder(Object.keys(rigB.parts)).map(key => {
            const part = effective.parts[key], lacks = !donor || donorLacks(key);
            const tip = part ? `Taken from ${clipName(part)}. Double-click gives it back.` : lacks ? (donor ? `The donor has no ${transferPartLabel(donorPartKey(key, donorMirror))}.` : 'Choose a model to take animation from first.') : 'Double-click takes it.';
            return <button key={key} data-part={key} aria-pressed={selected === key} className={part ? 'xf-chip xf-taken' : 'xf-chip'} title={tip} onClick={() => setSelected(key)} onDoubleClick={() => part ? giveBack([key]) : take(key)}>{transferPartLabel(key)}</button>;
          })}
        </div>
        <div className="xf-part-row">
          {selected ? <>
            <b>{selected === 'all' ? 'All' : transferPartLabel(selected)}</b>
            <button data-hotkey="transfer:take" data-hotkey-manual data-hotkey-label="Take part" disabled={!donor || donorSeq < 0 || (selected === 'all' ? !rigA?.ok : donorLacks(selected))}
              title={!donor ? 'Choose a model to take animation from first.' : selected !== 'all' && donorLacks(selected) ? `The donor has no ${transferPartLabel(donorPartKey(selected, donorMirror))}.` : selected === 'all' ? 'Take every part both models have from the animation the From pane shows.' : 'Take this part from the animation the From pane shows.'}
              onClick={() => selected === 'all' ? takeWhole() : take(selected)}>Take from <span translate="no">{donor ? `${nameOf(donor.id)} - ${sequenceName(donor.model, donorSeq)}` : '…'}</span></button>
            <button data-hotkey="transfer:give-back" data-hotkey-manual data-hotkey-label="Give back" disabled={!selectedKeys.length} title="The part goes back to the body animation." onClick={() => giveBack(selectedKeys)}>Give back</button>
            <button data-hotkey="transfer:reset" data-hotkey-manual data-hotkey-label="Reset part" disabled={!selectedKeys.length} title="Set the sliders back to their defaults." onClick={() => reset(selectedKeys)}>Reset</button>
            {selected !== 'all' && effective.parts[selected] && <small className="xf-source" translate="no">{clipName(effective.parts[selected])}</small>}
          </> : <span className="xf-note">{donor ? 'Click a part on the From model to take it, or Take whole body.' : 'Choose where the animation comes from.'}</span>}
        </div>
        {selectedKeys.length > 0 && <div className="xf-sliders">
          {FIELDS.filter(field => selectedKeys.some(key => applies(field, key))).map(field => {
            const values = selectedKeys.filter(key => applies(field, key)).map(key => Math.round(field.get(recipe.parts[key] || effective.parts[key]) * 100) / 100), same = values.every(v => v === values[0]);
            const label = field.label(kind), tip = field.tip(kind);
            return <RangeField key={field.id} className="xf-slider" label={label} title={tip} inputProps={{ title: tip, 'data-field': field.id }} min={field.min} max={field.max} step={field.step}
              output={shown => same || shown !== values[0] ? `${Math.round(shown)}${field.unit}` : '–'} value={values[0]} onDraft={value => value == null ? endDrag() : setField(field, value, true)} onCommit={value => setField(field, value, false)}/>;
          })}
          {legs.length > 0 && <label className="xf-check" title="Keeps the foot on the donor foot's path, scaled to this leg, so a planted foot stays on the ground. Works when Hips come from the same animation."><input data-hotkey="transfer:plant-foot" data-hotkey-manual data-hotkey-label="Plant foot" type="checkbox" checked={legs.every(key => effective.parts[key].plant !== false)} onChange={event => { const parts = { ...recipe.parts }; for (const key of legs) parts[key] = { ...parts[key], plant: event.target.checked }; change({ ...recipe, parts }); }}/> Plant foot</label>}
        </div>}
      </div>
      <footer className="xf-footer">
        <button data-hotkey="transfer:play" data-hotkey-absolute title="Play or pause both previews." onClick={() => setPlaying(v => !v)}>{playing ? 'Pause' : 'Play'}</button>
        {preview && <RangeField className="xf-scrub" aria-label="Time" title="Time in the new animation." min={preview.start} max={Math.max(preview.start + 1, preview.end)} step={1} value={Math.max(preview.start, Math.min(preview.end, time))} onChange={value => { setPlaying(false); scrubValue.current = value; scrub.current.schedule(); }}/>}
        <span className="xf-time" title="Time in the new animation.">{preview ? ((Math.max(preview.start, Math.min(preview.end, time)) - preview.start) / 1000).toFixed(2) : '0.00'} s</span>
        <button data-hotkey="transfer:original" data-hotkey-manual data-hotkey-label="Original" aria-pressed={original} title="Show the body animation without the taken parts." onClick={() => setOriginal(v => !v)}>Original</button>
        <span className="xf-spacer"/>
        <label className="xf-name" title="Name of the new animation.">Name <input data-hotkey="transfer:name" data-hotkey-manual data-hotkey-label="Animation name" aria-label="Name" value={shownName} maxLength={79} onChange={event => setName(event.target.value)}/></label>
        <button data-hotkey="transfer:clear" data-hotkey-manual data-hotkey-label="Clear" disabled={!Object.keys(recipe.parts).length} title="Give every part back." onClick={() => { giveBack(Object.keys(recipe.parts)); setSelected(null); }}>Clear</button>
        <button data-hotkey="transfer:add-animation" data-hotkey-manual data-hotkey-label="Add animation" className="xf-add" disabled={!built || !taken.length || doc.readOnly} title="Add the result to this model as a new animation. One Undo removes it." onClick={add}>Add animation</button>
        {added && <span className="xf-added" role="status">Added <span translate="no">{added}</span></span>}
      </footer>
    </>}
  </ToolWindow>;
}
