import { useMousePressLost, useWindowHotkeys, useWindowKeyClaim } from './Hotkeys.jsx';
import { windowCommandActions } from '../src/commands.js';
import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ToolWindow from './ToolWindow.jsx';
import { RangeField, Section } from './Fields.jsx';
import GameLibraryRow from './GameLibraryRow.jsx';
import TransferTimeline from './TransferTimeline.jsx';
import { createFrameCoalescer } from './viewport-performance.js';
import { openDocument } from '../src/editor-document.js';
import { resolveGameFiles } from './desktop.js';
import { readStored, writeStored } from '../src/local-store.js';
import { PresetNameRow, writePresetFile } from './PresetBar.jsx';
import { sanitizePresetName } from '../src/settings-presets.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { applyTransfer, buildTransfer, clearTransferCache, defaultTransferPart, transferAim, transferEndPoint, transferNodeTracks, transferPartLabel, transferPreviewModel, transferRestoreTracks } from '../src/anim-transfer.js';
import { addAllPlan, chipOrder, parseSetup, recipeFromSetup, setupFromRecipe, clipBlocks, clipLanes, dropPoint, handlePart, jointPath, partHandle, pathMarker, rigFor, sourcePartKey, takenPoseConfig, takenSummary, wholeBodyParts, withNodeTracks } from '../src/transfer-window.js';
import './resource-editors.css';
import './texture-library.css';
import './transfer.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const GameFileBrowser = lazy(() => import('./GameFileBrowser.jsx'));
// Everything applyTransfer can write: the new animation, and the body animation copied
// into every track (geosets, materials, texture animations, every node kind, cameras).
const SECTIONS = ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Bones', 'Helpers', 'Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'EventObjects', 'CollisionShapes', 'Cameras'];
const HIGHLIGHT = '#ffe14d', PATH = '#ff8a2a';
const noop = () => {};
const sequenceName = (model, index) => model?.Sequences?.[index]?.Name || `Animation ${index + 1}`;
// Model names are shown without their file extension ("grunt donor", not "grunt donor.mdx").
const plainName = name => String(name || '').replace(/\.(mdx|mdl|mdlxlpaint)$/i, '');
const firstAnimation = model => { const stand = standSequenceIndex(model); return stand >= 0 ? stand : model?.Sequences?.length ? 0 : -1; };

// The selected part's sliders. `get`/`set` convert between the recipe and the slider;
// `reset` is the value a double-click puts back. Timing ones sit in the Timing fold.
const offsetField = (index, limb, trunk) => ({
  id: 'offset' + index, min: -90, max: 90, step: 1, unit: '°',
  label: kind => kind === 'trunk' ? trunk[0] : limb[0], tip: kind => kind === 'trunk' ? trunk[1] : limb[1],
  get: part => part.offset?.[index] ?? 0, set: (part, value) => ({ ...part, offset: [0, 1, 2].map(i => i === index ? value : part.offset?.[i] ?? 0) }), reset: () => 0,
});
const FIELDS = [
  { id: 'amount', label: () => 'Strength', min: 0, max: 150, step: 1, unit: '%', tip: () => 'How much of the taken movement plays. 100% is the donor\'s movement, 0% is this model\'s own.', get: part => part.amount * 100, set: (part, value) => ({ ...part, amount: value / 100 }), reset: d => d.amount * 100 },
  { id: 'match', label: () => 'Pose', ends: ['Mine', 'Theirs'], min: 0, max: 100, step: 1, unit: '%', tip: () => 'Mine keeps this model\'s own stance and adds the movement. Theirs points the part the way the donor\'s does.', get: part => part.match * 100, set: (part, value) => ({ ...part, match: value / 100 }), reset: d => d.match * 100 },
  offsetField(0, ['Raise', 'Turns the part up or down.'], ['Lean', 'Leans the part forward or back.']),
  offsetField(1, ['Turn', 'Turns the part forward or back around the vertical.'], ['Tilt', 'Tilts the part to the side.']),
  offsetField(2, ['Roll', 'Turns the part around its own length.'], ['Turn', 'Turns the part left or right.']),
  { id: 'travel', label: () => 'Travel', min: 0, max: 200, step: 1, unit: '%', only: 'hips', tip: () => 'How far the body moves with the donor\'s hips. 100% follows the donor, scaled to this model\'s size.', get: part => part.travel * 100, set: (part, value) => ({ ...part, travel: value / 100 }), reset: d => d.travel * 100 },
  { id: 'start', timing: true, label: () => 'Delay', min: 0, max: 2000, step: 10, unit: ' ms', tip: () => 'How long after the start of the new animation the taken movement begins.', get: part => part.start, set: (part, value) => ({ ...part, start: value }), reset: d => d.start },
  { id: 'speed', timing: true, label: () => 'Speed', min: 25, max: 300, step: 5, unit: '%', tip: () => 'Plays the taken movement faster or slower.', get: part => part.speed * 100, set: (part, value) => ({ ...part, speed: value / 100 }), reset: d => d.speed * 100 },
  { id: 'blend', timing: true, label: () => 'Ease', min: 0, max: 500, step: 10, unit: ' ms', only: 'nonLooping', tip: () => 'Eases the taken movement in after it starts and out before it ends.', get: part => part.blend, set: (part, value) => ({ ...part, blend: value }), reset: d => d.blend },
];

/** The donor view: plays its own clock, so only it redraws while it plays. With `clock`
 * ({ sequence, frame }) it follows the result instead: the selected part's source animation at
 * the moment the result shows. The selected part's hand or foot path is drawn over it, with a
 * dot at the current moment. The camera turns with the result view's (cameraAngles). */
const DonorStage = memo(function DonorStage({ donor, sequence: own, playing, poseConfig, onPoseSelect, path, clock, cameraAnglesRequest, onCameraAnglesChange }) {
  const sequence = clock ? clock.sequence : own, interval = donor.model.Sequences?.[sequence]?.Interval;
  const [free, setTime] = useState(interval?.[0] ?? 0);
  useEffect(() => { setTime(interval?.[0] ?? 0); }, [donor.model, sequence]);
  const time = clock ? clock.frame : free;
  const overlay = useMemo(() => path?.points.length > 1 ? [{ points: path.points, color: PATH, width: 3, alpha: .95, marker: pathMarker(path.frames, time) }] : undefined, [path, time]);
  return <Suspense fallback={<span className="xf-note">Loading preview…</span>}>
    <GamePreview key={donor.id} presentation="preview" interactivePreview fitModel fitSequenceExtent fitBox showGrid={false} showAxes={false} preserveCameraView model={donor.model} revision={donor.revision} textureAssets={donor.assets} sequenceIndex={sequence} time={time} onTimeChange={clock ? undefined : setTime} playing={clock ? false : playing} cameraAnglesRequest={cameraAnglesRequest} onCameraAnglesChange={onCameraAnglesChange}
      cleanAnimationPreview emptyDragRotates transformMode="select" poseConfig={poseConfig} poseDocumentModel={donor.model} onPoseSelect={onPoseSelect} onPoseCommit={noop} overlayPaths={overlay}/>
  </Suspense>;
});

/** The Library's game-model browser, picking a donor instead of opening a tab. */
function LibraryPicker({ onPick, onClose }) {
  return <ToolWindow title="Library" overlayClass="tl-overlay xf-library" className="tl-dialog" headerClass="tl-header xf-library-header" onClose={onClose}>
    <Suspense fallback={<p className="tl-empty">Loading game files…</p>}><GameFileBrowser preset="models" pickLabel="Use this model" onOpenGameModel={onPick} onClose={onClose}/></Suspense>
  </ToolWindow>;
}

/** A slider in the shared look; double-click puts its default back. */
function PartSlider({ field, kind, value, mixed, onDraft, onCommit, onReset }) {
  const tip = field.tip(kind);
  return <div className="xf-slider" onDoubleClick={onReset} title={tip}>
    <RangeField label={field.label(kind)} title={tip} inputProps={{ title: tip, 'data-field': field.id }} min={field.min} max={field.max} step={field.step} ends={field.ends}
      output={shown => mixed && shown === value ? '–' : `${Math.round(shown)}${field.unit}`} value={value} onDraft={onDraft} onCommit={onCommit}/>
  </div>;
}

/** Transfer: give the open model movement from another model (or another of its own
 * animations), body part by body part. Contract: docs/agent-tasks/transfer-xl.md (Round 2). */
export default function Transfer({ doc, edit, textureAssets, teamColor, modelPath, otherModels = [], onClose }) {
  const model = doc.model, sequences = model.Sequences || [];
  const dialog = useRef(null);

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

  // The open model's rig as its body animation moves it. An edit (Add animation, Undo) starts afresh.
  const rigB = useMemo(() => { clearTransferCache(model); return rigFor(model, recipe.base.sequence); }, [model, doc.revision, recipe.base.sequence]);
  const poseB = useMemo(() => { try { return rigB.ok ? suggestPoseRig(model, rigB.reference.frame, Math.max(0, rigB.reference.sequence)) : null; } catch { return null; } }, [rigB]);

  // Donors loaded in this window. Never tabs, never changed. 'self' is the open model.
  const [donors, setDonors] = useState([]), [donorId, setDonorId] = useState(null), [donorSeqs, setDonorSeqs] = useState({});
  const [loading, setLoading] = useState(''), [message, setMessage] = useState(''), [picker, setPicker] = useState(false);
  const releases = useRef([]);
  useEffect(() => () => { for (const release of releases.current) release(); }, []);
  const donor = useMemo(() => { const d = donors.find(item => item.id === donorId); return d?.id === 'self' ? { ...d, model, assets: textureAssets, revision: doc.revision } : d; }, [donors, donorId, model, textureAssets, doc.revision]);
  const modelOf = id => id === 'self' ? model : donors.find(d => d.id === id)?.model;
  const nameOf = id => id === 'self' ? 'This model' : plainName(donors.find(d => d.id === id)?.name);
  const sources = useMemo(() => new Map(donors.filter(d => d.id !== 'self').map(d => [d.id, d.model])), [donors]);
  const donorSeq = donor ? donorSeqs[donor.id] ?? firstAnimation(donor.model) : -1;
  const rigA = useMemo(() => donor ? rigFor(donor.model, donorSeq) : null, [donor?.model, donor?.revision, donorSeq]);
  const poseA = useMemo(() => { try { return rigA?.ok ? suggestPoseRig(donor.model, rigA.reference.frame, Math.max(0, rigA.reference.sequence)) : null; } catch { return null; } }, [rigA]);
  const addDonor = (record, sequence) => {
    setDonors(list => [...list.filter(d => d.id !== record.id), record]);
    setDonorSeqs(old => ({ ...old, [record.id]: old[record.id] ?? sequence ?? firstAnimation(record.id === 'self' ? model : record.model) }));
    setDonorId(record.id); setMessage('');
  };
  const chooseSelf = () => donors.some(d => d.id === 'self') ? setDonorId('self') : addDonor({ id: 'self', name: 'This model' });
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
    const record = { id, name, model: opened.model, assets: preview.assets, revision: 0, path: id.slice(id.indexOf(':') + 1) };
    addDonor(record);
    return record;
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

  const taken = Object.keys(effective.parts).filter(key => rigB.parts[key]);
  const [selected, setSelected] = useState(null);
  const mirrorOf = id => {
    const own = recipe.sources?.[id]?.mirror;
    if (own != null) return own;
    const rig = modelOf(id) && rigFor(modelOf(id), id === donor?.id ? donorSeq : undefined);
    return id !== 'self' && !!rig?.weaponSide && !!rigB.weaponSide && rig.weaponSide !== rigB.weaponSide;
  };
  const donorMirror = donor ? mirrorOf(donor.id) : false;
  const feedsFrom = (key, flip = !!recipe.parts[key]?.flip) => sourcePartKey(key, donorMirror, flip);
  const donorLacks = key => !rigA?.parts?.[feedsFrom(key)];
  const clipNonLooping = part => !!modelOf(part.source)?.Sequences?.[part.sequence]?.NonLooping && part.loop !== true;
  const clipName = part => `${nameOf(part.source)} - ${sequenceName(modelOf(part.source), part.sequence)}`;
  const shareClip = (parts, part) => Object.values(parts).filter(other => other.source === part.source && other.sequence === part.sequence).length > 1;

  const take = key => {
    if (!donor || donorLacks(key) || donorSeq < 0) return;
    const old = recipe.parts[key];
    change({ ...recipe, parts: { ...recipe.parts, [key]: old ? { ...old, source: donor.id, sequence: donorSeq } : { ...defaultTransferPart(rigB, key, false), source: donor.id, sequence: donorSeq } } });
    setSelected(key);
  };
  const remove = keys => { const parts = { ...recipe.parts }; for (const key of keys) delete parts[key]; change({ ...recipe, parts }); };
  const whole = useMemo(() => rigA?.ok ? wholeBodyParts(rigB, rigA) : { parts: [], reason: '' }, [rigB, rigA, donorMirror]);
  const [wholeReason, setWholeReason] = useState('');
  const takeWhole = () => {
    if (!donor || donorSeq < 0 || !whole.parts.length) return;
    const parts = { ...recipe.parts };
    for (const key of whole.parts) parts[key] = { ...defaultTransferPart(rigB, key, true), source: donor.id, sequence: donorSeq };
    change({ ...recipe, parts }); setWholeReason(whole.reason || ''); setSelected('all');
  };
  const clearAll = () => { remove(Object.keys(recipe.parts)); setWholeReason(''); };
  const toggleMirror = () => { if (donor) change({ ...recipe, sources: { ...recipe.sources, [donor.id]: { mirror: !donorMirror } } }); };
  const setPart = (key, values) => { if (recipe.parts[key]) change({ ...recipe, parts: { ...recipe.parts, [key]: { ...recipe.parts[key], ...values } } }); };
  const setBase = sequence => change({ ...recipe, base: { sequence } });

  // Built motion. Slider drags change `draft` at most once per display frame.
  const outcome = useMemo(() => {
    if (!rigB.ok) return { error: '' };
    try { return { built: buildTransfer(model, sources, effective) }; } catch (error) { return { error: error.message }; }
  }, [model, rigB, sources, effective]);
  const built = outcome.built;

  // The result view plays a private copy. It is rebuilt only when the body animation or
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
  const sliderValue = useRef(null), slider = useRef(null);
  slider.current ||= createFrameCoalescer(() => { if (sliderValue.current) setDraft(sliderValue.current); });
  useEffect(() => () => { slider.current.cancel(); }, []);

  // Setups (N9): the recipe with sources by file or game path and animations by name. Saved setups
  // live in this window's store; Save to file writes one to share. Loading reopens the donors.
  const SETUPS = 'mdlxl.transfer.setups';
  const [setups, setSetups] = useState(() => { const list = readStored(SETUPS, []); return Array.isArray(list) ? list : []; });
  const [naming, setNaming] = useState(false), [setupName, setSetupName] = useState(''), [loadMenu, setLoadMenu] = useState(false), [setupStatus, setSetupStatus] = useState('');
  const describeSource = id => {
    if (id === 'self') return { kind: 'self', name: 'This model', model };
    const d = donors.find(item => item.id === id);
    if (!d) return null;
    return { kind: id.startsWith('lib:') ? 'library' : id.startsWith('file:') ? 'file' : 'tab', path: d.path || null, name: d.name, model: d.model };
  };
  const currentSetup = name => setupFromRecipe(recipeRef.current, model, describeSource, name);
  const saveSetup = () => {
    const name = sanitizePresetName(setupName);
    if (!name) return;
    const list = [...setups.filter(item => item.name !== name), currentSetup(name)];
    setSetups(list); writeStored(SETUPS, list); setNaming(false); setSetupStatus(`${name} saved.`);
  };
  const saveSetupFile = async () => {
    const name = sanitizePresetName(setupName) || 'Transfer setup';
    try { if (await writePresetFile(name, JSON.stringify(currentSetup(name), null, 1))) { setNaming(false); setSetupStatus(`${name} saved to file.`); } } catch (error) { setSetupStatus(error.message); }
  };
  // One donor of a setup: already loaded, else reopened by its path, else asked for once.
  const reopen = async (source, asked) => {
    if (source.kind === 'self') return { id: 'self', model };
    const id = (source.kind === 'library' ? 'lib:' : 'file:') + source.path, known = donors.find(d => d.id === id);
    if (known) return known;
    try {
      if (source.kind === 'library' && window.desktop?.gameFilesFindPath) {
        const summary = await window.desktop.gameFilesSummary(), entry = await window.desktop.gameFilesFindPath({ path: source.path, variant: 'all' });
        if (entry) {
          const read = await window.desktop.gameFilesRead({ id: entry.id, signature: summary.signature }), names = (openDocument(read.bytes, entry.name).model?.Textures || []).map(t => t.Image).filter(Boolean);
          const textures = names.length ? (await window.desktop.gameFilesResolve({ id: entry.id, signature: summary.signature, names })).found : [];
          return await loaded(id, entry.name, read.bytes, textures);
        }
      } else if (source.kind === 'file' && window.desktop?.readTransferModel) {
        const record = await window.desktop.readTransferModel(source.path), names = (openDocument(record.bytes, record.name).model?.Textures || []).map(t => t.Image).filter(Boolean);
        const found = names.length ? await resolveGameFiles(names, record.path) : [];
        return await loaded(id, record.name, record.bytes, found.filter(item => item?.bytes).map(item => ({ name: item.logicalName || item.texturePath || item.name, bytes: item.bytes })));
      }
    } catch { /* asked for below */ }
    if (asked.has(source.name) || !window.desktop?.openTransferModel) return null;
    asked.add(source.name);
    setSetupStatus(`Find ${source.name}`);
    const record = await window.desktop.openTransferModel();
    if (!record) return null;
    const names = (openDocument(record.bytes, record.name).model?.Textures || []).map(t => t.Image).filter(Boolean), found = names.length ? await resolveGameFiles(names, record.path) : [];
    return loaded('file:' + (record.path || record.name), record.name, record.bytes, found.filter(item => item?.bytes).map(item => ({ name: item.logicalName || item.texturePath || item.name, bytes: item.bytes })));
  };
  const applySetup = async setup => {
    setLoadMenu(false); setSetupStatus('Loading model…');
    try {
      const opened = {}, asked = new Set();
      for (const [key, source] of Object.entries(setup.sources || {})) opened[key] = await reopen(source, asked);
      const { recipe: next, left } = recipeFromSetup(setup, model, rigB, opened, recipeRef.current.base.sequence);
      change(next); setSelected(Object.keys(next.parts).length ? 'all' : null);
      const first = Object.values(next.parts)[0];
      if (first) { setDonorId(first.source); setDonorSeqs(old => ({ ...old, [first.source]: first.sequence })); if (first.source === 'self' && !donors.some(d => d.id === 'self')) setDonors(list => [...list.filter(d => d.id !== 'self'), { id: 'self', name: 'This model' }]); }
      const words = left.map(code => { const [kind, value] = code.split(':'); return kind === 'part' ? transferPartLabel(value) : kind === 'source' ? setup.sources?.[value]?.name || value : value; });
      setSetupStatus(left.length ? `${setup.name || 'Setup'} loaded. Left out: ${words.join(', ')}` : `${setup.name || 'Setup'} loaded.`);
    } catch (error) { setSetupStatus(error.message); }
  };
  const loadSetupFile = async () => {
    if (!window.desktop?.openPresetFile) { setSetupStatus('Opening a file needs the desktop app.'); return; }
    try { const picked = await window.desktop.openPresetFile(); if (picked) await applySetup(parseSetup(picked.text)); } catch (error) { setSetupStatus(error.message); }
  };
  const deleteSetup = name => { const list = setups.filter(item => item.name !== name); setSetups(list); writeStored(SETUPS, list); };

  // Selection, the handles and the path the selected limb's hand or foot draws.
  // 'all' edits every taken part at once (Strength, Pose, Timing, Travel, Keep foot on the ground).
  const allMode = selected === 'all' && taken.length > 0;
  const selectedPart = selected && selected !== 'all' ? rigB.parts[selected] : null, selectedTaken = selectedPart && effective.parts[selected] ? effective.parts[selected] : null;
  const selectedFrom = selectedTaken && selectedTaken.source === donor?.id ? feedsFrom(selected) : null;
  // The result view has handles for taken parts only; the parts list selects the others.
  const resultPose = useMemo(() => { const own = takenPoseConfig(poseB, rigB, taken); return own && { ...own, enabled: true, picking: null, pins: own.pins || [], target: selectedTaken ? partHandle(rigB, poseB, selected) : null, inspectPaths: selectedTaken ? [rigB.parts[selected].joints] : [], inspectColor: HIGHLIGHT }; }, [poseB, rigB, selected, !!selectedTaken, taken.join(',')]);
  const donorPose = useMemo(() => {
    if (!poseA || !donor) return null;
    const shown = selectedPart && !donorLacks(selected) ? feedsFrom(selected) : null;
    return { ...poseA, enabled: true, picking: null, pins: poseA.pins || [], target: shown ? partHandle(rigA, poseA, shown) : null, inspectPaths: selectedFrom && rigA.parts[selectedFrom] ? [rigA.parts[selectedFrom].joints] : [], inspectColor: HIGHLIGHT };
  }, [poseA, rigA, donor?.id, donorMirror, selected, selectedFrom, takenSummary(effective)]);
  const limb = selectedPart?.kind === 'limb' && selectedTaken;
  const resultPath = useMemo(() => {
    if (!limb || !preview || original) return null;
    try { return jointPath(withNodeTracks(preview.model, liveTracks), preview.sequenceIndex, selectedPart.marker); } catch { return null; }
  }, [limb, preview, liveTracks, original, selectedPart]);
  const resultOverlayPath = useMemo(() => resultPath?.points.length > 1 ? [{ points: resultPath.points, color: PATH, width: 3, alpha: .95, marker: pathMarker(resultPath.frames, time) }] : [], [resultPath, time]);
  // A selected taken part from the donor shown: the donor view plays that part's animation on
  // the result's clock (Delay and Speed applied), so both swings happen together.
  const linked = !!selectedTaken && !!donor && selectedTaken.source === donor.id && !!donor.model.Sequences?.[selectedTaken.sequence]?.Interval;
  const donorClock = useMemo(() => {
    if (!linked || !preview) return null;
    const [first, last] = donor.model.Sequences[selectedTaken.sequence].Interval, length = Math.max(0, last - first);
    const x = (Math.max(preview.start, Math.min(preview.end, time)) - preview.start - (Number(selectedTaken.start) || 0)) * (selectedTaken.speed > 0 ? selectedTaken.speed : 1);
    const looping = selectedTaken.loop ?? !donor.model.Sequences[selectedTaken.sequence].NonLooping;
    const phase = !length ? 0 : looping ? x - length * Math.floor(x / length) : Math.max(0, Math.min(length, x));
    return { sequence: selectedTaken.sequence, frame: Math.round(first + phase) };
  }, [linked, preview, time, selectedTaken?.sequence, selectedTaken?.start, selectedTaken?.speed, selectedTaken?.loop, donor?.model]);
  const donorShows = linked ? selectedTaken.sequence : donorSeq;
  const donorPath = useMemo(() => {
    const rig = limb && donor && selectedFrom ? rigFor(donor.model, donorShows) : null;
    if (!rig?.parts?.[selectedFrom]) return null;
    try { return jointPath(donor.model, donorShows, rig.parts[selectedFrom].marker); } catch { return null; }
  }, [limb, donor?.model, donorShows, selectedFrom]);
  // The two views turn together: a view's own camera turn is sent to the other view (each keeps
  // its own distance and framing). A report equal to what was just sent is the echo and is ignored.
  const [angles, setAngles] = useState({ donor: null, result: null }), sentAngles = useRef({ donor: null, result: null });
  const sameAngles = (a, b) => !!a && !!b && ['x', 'y', 'z'].every(axis => Math.abs(a[axis] - b[axis]) < .01);
  const turnFrom = useCallback((from, to) => values => {
    if (!values || sameAngles(values, sentAngles.current[from])) return;
    sentAngles.current[to] = { ...values }; setAngles(old => ({ ...old, [to]: { ...values } }));
  }, []);
  const onDonorAngles = useMemo(() => turnFrom('donor', 'result'), [turnFrom]), onResultAngles = useMemo(() => turnFrom('result', 'donor'), [turnFrom]);
  const latestHandlers = useRef({});
  latestHandlers.current.donorHandle = target => {
    const theirs = handlePart(rigA, poseA, target);
    if (!theirs) return;
    const key = sourcePartKey(theirs, donorMirror, false);
    if (!rigB.parts[key]) { setMessage(`This model has no ${transferPartLabel(key)}.`); return; }
    setMessage(''); take(key);
  };
  latestHandlers.current.resultHandle = target => { const key = handlePart(rigB, poseB, target); if (key) setSelected(key); };
  const onDonorHandle = useCallback(target => latestHandlers.current.donorHandle(target), []);
  const onResultHandle = useCallback(target => latestHandlers.current.resultHandle(target), []);

  // Weapons (N8): the selected arm's weapon, the donor arm's, the effective "point like theirs", and
  // untaken arms the build drives because they hold the weapon.
  const weapon = selectedTaken && selectedPart?.weapon && typeof selectedPart.weapon === 'object' ? selectedPart.weapon : null;
  const donorWeapon = useMemo(() => {
    if (!weapon || !selectedTaken) return null;
    const theirs = modelOf(selectedTaken.source), rig = theirs && rigFor(theirs, selectedTaken.sequence);
    return rig?.parts?.[sourcePartKey(selected, mirrorOf(selectedTaken.source), !!selectedTaken.flip)]?.weapon || null;
  }, [weapon, selectedTaken?.source, selectedTaken?.sequence, selectedTaken?.flip, selected]);
  const aimEffective = selectedTaken?.aim == null ? !!donorWeapon && clipNonLooping(selectedTaken) : selectedTaken.aim > 0.5;
  const holders = useMemo(() => { const driven = new Set(built?.driven || []); return new Set(Object.values(rigB.parts).filter(part => part.kind === 'limb' && !effective.parts[part.key] && part.joints.some(id => driven.has(id))).map(part => part.key)); }, [built, rigB, effective.parts]);
  const onResultCapture = useCallback(api => { capture.current = api; }, []);
  // Sliders of the selected taken part. Values come from the committed recipe, so a release commits.
  const kind = selectedPart?.kind, targets = allMode ? taken : selectedTaken ? [selected] : [];
  const applies = (field, key) => field.only === 'hips' ? key === 'hips' : field.only === 'nonLooping' ? clipNonLooping(effective.parts[key]) : !(allMode && /^offset/.test(field.id));
  const setField = (field, value, live) => {
    const base = recipeRef.current, parts = { ...base.parts };
    for (const key of targets) if (parts[key] && applies(field, key)) parts[key] = field.set(parts[key], value);
    const next = { ...base, parts };
    if (live) { sliderValue.current = next; slider.current.schedule(); return; }
    slider.current.cancel(); sliderValue.current = null; setDraft(null); change(next);
  };
  // The slider's own draft ends (release or Escape): drop the live recipe; a release then commits.
  const endDrag = () => { slider.current.cancel(); sliderValue.current = null; setDraft(null); };

  // Drag to aim (N7): the selected taken limb's hand or foot handle on the result view is dragged to
  // where it should be at the paused moment. Whole movement writes the part's Raise / Turn (/ Roll);
  // This moment writes a moment fix. Pointer events only record; transferAim runs once per frame.
  const [aimScope, setAimScope] = useState('whole'), [aimNote, setAimNote] = useState(false), [ghost, setGhost] = useState(null);
  const capture = useRef(null), aim = useRef(null), aimFrame = useRef(null), aimApply = useRef(null);
  aimFrame.current ||= createFrameCoalescer(() => aimApply.current());
  useEffect(() => () => aimFrame.current.cancel(), []);
  const aimable = !!selectedTaken && selectedPart?.kind === 'limb' && !original && !!preview;
  const aimDown = event => {
    if (event.button !== 0 || !aimable || !capture.current?.project || !capture.current.ray) return;
    const t = Math.round(time0 - preview.start), base = recipeRef.current;
    let at; try { at = transferEndPoint(model, sources, base, selected, t); } catch { return; }
    const canvas = event.currentTarget.querySelector('canvas'), box = canvas?.getBoundingClientRect();
    if (!box) return;
    const [x, y] = capture.current.project(at.end), scale = canvas.width / Math.max(1, box.width);
    if (Math.hypot(box.left + x / scale - event.clientX, box.top + y / scale - event.clientY) > 20) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlaying(false);
    aim.current = { key: selected, time: t, base, at, x: event.clientX, y: event.clientY, scope: aimScope, next: null, clamped: false };
  };
  const aimMove = event => {
    const d = aim.current;
    if (!d) return;
    event.stopPropagation();
    d.x = event.clientX; d.y = event.clientY; aimFrame.current.schedule();
  };
  aimApply.current = () => {
    const d = aim.current;
    if (!d || !capture.current) return;
    const point = dropPoint(capture.current.ray(d.x, d.y), d.at.root, d.at.end);
    let result; try { result = transferAim(model, sources, d.base, d.key, d.time, point, { scope: d.scope }); } catch { return; }
    const part = d.base.parts[d.key];
    let changed;
    if (d.scope === 'moment') { const fixes = [...(part.fixes || [])]; if (result.index >= 0) fixes[result.index] = result.fix; else fixes.push(result.fix); changed = { ...part, fixes }; }
    else changed = { ...part, offset: result.offset };
    d.next = { ...d.base, parts: { ...d.base.parts, [d.key]: changed } }; d.clamped = !!result.clamped;
    setDraft(d.next); setGhost({ root: d.at.root, point });
  };
  const aimUp = event => {
    const d = aim.current;
    if (!d) return;
    event.stopPropagation();
    aimFrame.current.flush(); aim.current = null; setGhost(null);
    if (d.next) { setDraft(null); change(d.next); setAimNote(d.clamped); } else setDraft(null);
  };
  const aimCancel = () => { if (!aim.current) return; aimFrame.current.cancel(); aim.current = null; setGhost(null); setDraft(null); };
  useWindowKeyClaim(({ event }) => { if (event.key !== 'Escape' || !aim.current) return false; aimCancel(); return true; }, 0);
  useMousePressLost(aimCancel);
  useEffect(() => { setAimNote(false); }, [selected]);
  const clearFixes = () => setPart(selected, { fixes: [] });
  // The drag's ghost: a dashed line from the limb's root to where the hand or foot is dropped.
  const resultOverlay = useMemo(() => [...resultOverlayPath, ...(ghost ? [{ points: [ghost.root, ghost.point], color: '#ffffff', width: 7, alpha: .85 }, { points: [ghost.root, ghost.point], color: '#1d5fd1', width: 3.5, dash: [7, 4], alpha: 1, marker: 1 }] : [])], [resultOverlayPath, ghost]);
  // Double-click: every target back to its own default.
  const resetField = field => {
    const base = recipeRef.current, parts = { ...base.parts };
    for (const key of targets) if (parts[key] && applies(field, key)) parts[key] = field.set(parts[key], field.reset(defaultTransferPart(rigB, key, shareClip(base.parts, parts[key]))));
    endDrag(); change({ ...base, parts });
  };
  // With All, a slider shows the shared value, or stays empty ('–') when the parts differ.
  const slidersFor = timing => FIELDS.filter(field => !!field.timing === timing && targets.some(key => applies(field, key))).map(field => {
    const values = targets.filter(key => applies(field, key)).map(key => Math.round(field.get((laneLive ? effective.parts[key] : recipe.parts[key]) || effective.parts[key]) * 100) / 100);
    return <PartSlider key={field.id} field={field} kind={kind} value={values[0]} mixed={values.some(v => v !== values[0])}
      onDraft={value => value == null ? endDrag() : setField(field, value, true)} onCommit={value => setField(field, value, false)} onReset={() => resetField(field)}/>;
  });
  const legsTaken = targets.filter(key => /^leg/.test(key) && rigB.parts[key]?.kind === 'limb');

  // Add animation: one edit, one Undo step, built afresh from the document's own model.
  const [name, setName] = useState(null), [added, setAdded] = useState(''), addedRecipe = useRef(null);
  const shownName = name ?? built?.suggestedName ?? '';
  const add = () => {
    if (!built || !taken.length || doc.readOnly) return;
    const finalName = shownName.trim() || built.suggestedName, current = recipeRef.current;
    const result = edit(`Transfer: add ${finalName}`, SECTIONS, m => { clearTransferCache(m); applyTransfer(m, buildTransfer(m, sources, current), current, { name: finalName }); });
    clearTransferCache(model);
    if (result === false) return;
    addedRecipe.current = JSON.stringify(current); setAdded({ name: finalName }); setName(null);
  };
  // Add all: the donor's whole set with the parts taken from it, one Undo for all (src/transfer-window.js addAllPlan).
  const plan = useMemo(() => donor ? addAllPlan(model, donor.model, donor.id, recipe, recipe.base.sequence) : { clips: [] }, [donor, model, doc.revision, recipe]);
  // The set takes a few seconds on big models: the button says Adding... and the footer waits,
  // painted before the work starts.
  const [adding, setAdding] = useState(false);
  const addAll = () => {
    if (!plan.clips.length || doc.readOnly || adding) return;
    const clips = plan.clips;
    setAdding(true);
    requestAnimationFrame(() => setTimeout(() => {
      try {
        const result = edit(`Transfer: add ${clips.length} animations`, SECTIONS, m => { for (const clip of clips) { clearTransferCache(m); applyTransfer(m, buildTransfer(m, sources, clip.recipe), clip.recipe, { name: clip.name }); } });
        clearTransferCache(model);
        if (result !== false) { addedRecipe.current = JSON.stringify(recipeRef.current); setAdded({ count: clips.length }); setName(null); }
      } finally { setAdding(false); }
    }, 0));
  };
  const fromDonor = donor && taken.some(key => effective.parts[key].source === donor.id);
  const addAllTip = !donor || !fromDonor ? 'Take a part from the donor first: Add all repeats those parts for each of its animations.' : !plan.clips.length ? 'This model already has every animation of the donor, or only Decay and Portrait animations are left.' : `Adds: ${plan.clips.map(clip => clip.name).join(', ')}`;
  useEffect(() => { if (added && addedRecipe.current !== JSON.stringify(recipe)) setAdded(''); }, [recipe]);
  const unapplied = taken.length > 0 && !doc.readOnly && addedRecipe.current !== JSON.stringify(recipe);

  useWindowHotkeys('transfer', windowCommandActions('transfer', 'Transfer', {undo: () => stepHistory(false), redo: () => stepHistory(true), play: () => setPlaying(v => !v)}).map(action => ({...action, allowInInput: action.bindingCommand !== 'play'})));
  useEffect(() => { dialog.current?.focus(); }, []);

  const sourceRows = [
    ['self', 'This model', 'Another animation of this model.', chooseSelf],
    ...otherModels.map(s => ['tab:' + s.id, plainName(s.doc.name), 'This open model. It is only read, never changed.', () => chooseTab(s)]),
    ...donors.filter(d => d.id !== 'self' && !d.id.startsWith('tab:')).map(d => [d.id, plainName(d.name), 'Only read, never changed.', () => setDonorId(d.id)]),
  ];
  const time0 = preview ? Math.max(preview.start, Math.min(preview.end, time)) : 0;
  // The clip timeline: the axis is the result as previewed (it changes on release, not mid-drag).
  const axis = preview ? Math.max(1, preview.end - preview.start) : 1;
  const bodyLane = useMemo(() => {
    const clock = built?.baseClock, sequence = model.Sequences[effective.base.sequence];
    if (!clock || !sequence) return null;
    const period = clock.looping ? clock.length / (clock.rate || 1) : clock.length;
    return { id: 'body', label: sequenceName(model, effective.base.sequence), title: 'Body animation', blocks: clipBlocks(0, period, clock.looping, axis) };
  }, [built, axis, effective.base.sequence, model]);
  const lanes = useMemo(() => clipLanes(effective.parts, part => { const s = modelOf(part.source)?.Sequences?.[part.sequence]; return s?.Interval ? { length: s.Interval[1] - s.Interval[0], looping: !s.NonLooping } : null; }, chipOrder(taken)).map(lane => ({
    ...lane, editable: true, label: `${sequenceName(modelOf(lane.source), lane.sequence)} - ${nameOf(lane.source)}`, parts: lane.keys.map(transferPartLabel).join(', '),
    title: `${sequenceName(modelOf(lane.source), lane.sequence)} - ${nameOf(lane.source)}: ${lane.keys.map(transferPartLabel).join(', ')}`, blocks: clipBlocks(lane.start, lane.span, lane.looping, axis),
  })), [effective.parts, taken.join(','), axis, donors, model]);
  // A lane's label selects its part; a lane of several parts selects All taken parts.
  const selectedLanes = lanes.filter(lane => allMode ? lane.keys.length > 1 : lane.keys.includes(selected)).map(lane => lane.id);
  const selectLane = lane => setSelected(lane.keys.length > 1 ? 'all' : lane.keys[0]);
  // A clip drag: Delay or Speed for every part in the lane, live once per frame, one history step on release.
  const [laneLive, setLaneLive] = useState(false);
  const changeLane = (lane, value, live) => {
    setLaneLive(!!value && live);
    if (!value) { endDrag(); return; }
    const base = recipeRef.current, parts = { ...base.parts };
    for (const key of lane.keys) if (parts[key]) parts[key] = { ...parts[key], ...value };
    const next = { ...base, parts };
    if (live) { sliderValue.current = next; slider.current.schedule(); return; }
    slider.current.cancel(); sliderValue.current = null; setDraft(null); change(next);
  };
  const selectFix = fix => { setSelected(fix.key); setPlaying(false); if (preview) setTime(preview.start + fix.time); };
  const deleteFix = fix => { const part = recipe.parts[fix.key]; if (part?.fixes) setPart(fix.key, { fixes: part.fixes.filter((_, i) => i !== fix.index) }); };
  const lacksTip = key => !donor ? 'Choose a model to take animation from first.' : `The donor has no ${transferPartLabel(feedsFrom(key))}.`;
  return <ToolWindow title="Transfer" overlayClass="resource-editor transfer-xl" className="re-window xf-window" headerClass="re-caption" closeClass="re-caption-close" closeTitle="Close. Parts not added are lost." windowRef={dialog} onClose={onClose} unapplied={unapplied} after={picker && <LibraryPicker onPick={pickLibrary} onClose={() => setPicker(false)}/>} sectionProps={{'data-hotkey-prefix': 'transfer', 'data-hotkey-scope': 'transfer'}}>
    {!rigB.ok ? <div className="xf-problems" role="alert">{rigB.problems.map(text => <p key={text}>{text}</p>)}</div> : <>
      <div className="xf-body">
        <aside className="xf-from" aria-label="From">
          <b className="xf-heading">From</b>
          <div className="gf-tree xf-list" role="group" aria-label="Take animation from">
            {sourceRows.map(([id, label, tip, choose]) => id === 'self'
              ? <button key={id} data-source={id} data-hotkey="transfer:this-model" data-hotkey-manual data-hotkey-label="This model" className={'gf-row xf-row' + (donor?.id === id ? ' selected' : '')} aria-pressed={donor?.id === id} title={tip} onClick={choose}>This model</button>
              : <GameLibraryRow as="button" key={id} data-source={id} className={'gf-row xf-row' + (donor?.id === id ? ' selected' : '')} aria-pressed={donor?.id === id} title={tip} name={label} onClick={choose}/>)}
            <button data-hotkey="transfer:open-file" data-hotkey-manual data-hotkey-label="Open file..." className="gf-row xf-row xf-action" title="A model file. It is only read and does not open as a tab." onClick={openFile}>Open file...</button>
            <button data-hotkey="transfer:library" data-hotkey-manual data-hotkey-label="Library..." className="gf-row xf-row xf-action" title="A Warcraft III model from the game files." onClick={() => setPicker(true)}>Library...</button>
          </div>
          <b className="xf-heading">Animations</b>
          <div className="gf-tree xf-list xf-animations" role="group" aria-label="Donor animations">
            {donor ? (donor.model.Sequences || []).map((s, i) => <GameLibraryRow as="button" key={i} data-animation={i} className={'gf-row xf-row' + (i === donorSeq ? ' selected' : '') + (linked && i === donorShows ? ' xf-playing' : '')} aria-pressed={i === donorSeq} aria-current={linked && i === donorShows ? 'true' : undefined} title="Play this animation in the donor view." name={sequenceName(donor.model, i)} onClick={() => setDonorSeqs(old => ({ ...old, [donor.id]: i }))}/>)
              : <span className="xf-note xf-empty">Choose a model above.</span>}
          </div>
        </aside>
        <main className="xf-center">
          <div className="xf-stage">
            <section className="xf-view" aria-label="Donor">
              <div className="xf-caption">{donor ? <span translate="no">{nameOf(donor.id)} - {sequenceName(donor.model, donorShows)}</span> : <span>Donor</span>}
                {donor && <button data-hotkey="transfer:mirror" data-hotkey-manual data-hotkey-label="Mirror" aria-pressed={donorMirror} disabled={!rigA?.ok} title="Swap left and right for this whole donor. On by itself when the two models hold their weapon in opposite hands." onClick={toggleMirror}>Mirror</button>}</div>
              <div className="xf-preview">
                {donor ? <>
                  <DonorStage donor={donor} sequence={donorSeq} playing={playing} poseConfig={donorPose} onPoseSelect={onDonorHandle} path={donorPath} clock={donorClock} cameraAnglesRequest={angles.donor} onCameraAnglesChange={onDonorAngles}/>
                  {!rigA?.ok && <div className="xf-overlay-note" role="status">{(rigA?.problems || []).map(text => <p key={text}>{text}</p>)}</div>}
                </> : <div className="xf-placeholder">Choose a model under From.</div>}
                {(loading || message) && <div className="xf-overlay-note xf-message" role="status">{loading ? 'Loading model…' : message}</div>}
              </div>
            </section>
            <section className="xf-view" aria-label="Result">
              <div className="xf-caption"><span translate="no">{plainName(doc.name)}</span></div>
              <div className="xf-preview" onPointerDownCapture={aimDown} onPointerMoveCapture={aimMove} onPointerUpCapture={aimUp} onPointerCancelCapture={aimUp}>
                {preview && <Suspense fallback={<span className="xf-note">Loading preview…</span>}>
                  <GamePreview presentation="preview" interactivePreview fitModel fitSequenceExtent fitBox showGrid={false} showAxes={false} preserveCameraView model={preview.model} revision={preview.shape} textureAssets={textureAssets} modelPath={modelPath} teamColor={teamColor} sequenceIndex={preview.sequenceIndex} time={time} onTimeChange={setTime} playing={playing} onPlayingChange={setPlaying} liveNodeTracks={liveTracks} cameraAnglesRequest={angles.result} onCameraAnglesChange={onResultAngles}
                    cleanAnimationPreview emptyDragRotates transformMode="select" poseConfig={resultPose} poseDocumentModel={preview.model} onPoseSelect={onResultHandle} onPoseCommit={noop} onCaptureReady={onResultCapture} overlayPaths={resultOverlay}/>
                </Suspense>}
                {outcome.error && <div className="xf-overlay-note" role="status">{outcome.error}</div>}
              </div>
            </section>
          </div>
          <TransferTimeline length={axis} time={time0 - (preview?.start || 0)} playing={playing} onPlay={() => setPlaying(v => !v)} onSeek={t => { setPlaying(false); if (preview) setTime(preview.start + t); }}
            bodyLane={bodyLane} lanes={lanes} selectedLanes={selectedLanes} onLaneSelect={selectLane} onLaneChange={changeLane} onFixSelect={selectFix} onFixDelete={deleteFix}
            readout={`${preview ? ((time0 - preview.start) / 1000).toFixed(2) : '0.00'} s`}>
            <button data-hotkey="transfer:original" data-hotkey-manual data-hotkey-label="Original" aria-pressed={original} title="Show the body animation without the taken parts." onClick={() => setOriginal(v => !v)}>Original</button>
          </TransferTimeline>
        </main>
        <aside className="xf-controls" aria-label="Parts">
          <div className="preset-bar xf-setup-bar">
            <div className="preset-bar-main">
              <button type="button" data-hotkey="transfer:setup-save" data-hotkey-manual data-hotkey-label="Save setup" aria-expanded={naming} disabled={!taken.length} title="Keeps the taken parts and their settings as a setup, or writes it to a file to share. Load it on any model." onClick={() => { setLoadMenu(false); setNaming(open => !open); }}>Save as…</button>
              <button type="button" data-hotkey="transfer:setup-load" data-hotkey-manual data-hotkey-label="Load setup" aria-expanded={loadMenu} title="Uses a saved setup on this model: its donors open again, parts and animations are matched by name." onClick={() => { setNaming(false); setLoadMenu(open => !open); }}>Load from…</button>
            </div>
            {naming && <PresetNameRow domain="transfer" name={setupName} onName={setSetupName} onSave={saveSetup} onSaveFile={saveSetupFile} onClose={() => setNaming(false)}/>}
            {loadMenu && <div className="gf-tree xf-list xf-setups" role="group" aria-label="Saved setups">
              {setups.map(item => <div key={item.name} className="gf-row xf-setup-row"><button type="button" className="xf-part-name" title="Use this setup." onClick={() => applySetup(item)}><span translate="no">{item.name}</span></button><button type="button" className="preset-bar-delete" aria-label="Delete this setup" title="Deletes this saved setup." onClick={() => deleteSetup(item.name)}>×</button></div>)}
              <button type="button" className="gf-row xf-row xf-action" onClick={loadSetupFile}>File…</button>
            </div>}
            {setupStatus && <div className="preset-bar-status" role="status">{setupStatus}</div>}
          </div>
          <label className="xf-field" title="This model's own animation under everything. Parts that are not taken keep moving as it does.">Body animation <select data-hotkey="transfer:body-animation" data-hotkey-manual data-hotkey-label="Body animation" aria-label="Body animation" value={recipe.base.sequence} onChange={event => setBase(Number(event.target.value))}>{sequences.map((s, i) => <option key={i} value={i} translate="no">{sequenceName(model, i)}</option>)}</select></label>
          <div className="xf-row-buttons">
            <button data-hotkey="transfer:take-whole-body" data-hotkey-manual data-hotkey-label="Take whole body" disabled={!rigA?.ok || donorSeq < 0 || !whole.parts.length} title="Take every part both models have from the animation the donor view shows." onClick={takeWhole}>Take whole body</button>
            <button data-hotkey="transfer:clear-all" data-hotkey-manual data-hotkey-label="Clear all" disabled={!Object.keys(recipe.parts).length} title="Remove every taken part." onClick={clearAll}>Clear all</button>
          </div>
          {wholeReason && <p className="xf-note xf-reason" role="status">{wholeReason}</p>}
          <div className="gf-tree xf-list xf-parts" role="group" aria-label="Parts list">
            <div className={'gf-row xf-part xf-all' + (allMode ? ' selected' : '')}><button data-part="all" data-hotkey="transfer:all-taken-parts" data-hotkey-manual data-hotkey-label="All taken parts" aria-pressed={allMode} disabled={!taken.length} className="xf-part-name" title="Change every taken part at once." onClick={() => setSelected('all')}>All taken parts</button></div>
            {chipOrder(Object.keys(rigB.parts)).map(key => {
              const part = effective.parts[key], lacks = !part && donorLacks(key);
              return <div key={key} className={'gf-row xf-part' + (selected === key ? ' selected' : '')}>
                <input type="checkbox" data-part-switch={key} aria-label={`Take ${transferPartLabel(key)}`} checked={!!part} disabled={lacks} title={part ? 'Taken. Switch off to remove it.' : lacks ? lacksTip(key) : 'Take this part from the animation the donor view shows.'} onChange={event => event.target.checked ? take(key) : remove([key])}/>
                <button data-part={key} aria-pressed={selected === key} className="xf-part-name" title={part ? `Taken from ${clipName(part)}.` : holders.has(key) ? 'Keeps its hand on the weapon.' : 'Select this part.'} onClick={() => setSelected(key)}>{transferPartLabel(key)}{part ? <small translate="no">{clipName(part)}</small> : holders.has(key) && <small className="xf-holds">holds the weapon</small>}</button>
              </div>;
            })}
          </div>
          {allMode ? <div className="xf-part-controls" role="group" aria-label="All taken parts">
            <div className="xf-part-title"><b>All taken parts</b></div>
            {slidersFor(false)}
            {legsTaken.length > 0 && <label className="xf-check" title="Keeps each foot on the donor foot's path, scaled to the leg, so a planted foot stays on the ground. Works when Hips come from the same animation."><input data-hotkey="transfer:keep-foot" data-hotkey-manual data-hotkey-label="Keep foot on the ground" type="checkbox" checked={legsTaken.every(key => effective.parts[key].plant !== false)} onChange={event => { const parts = { ...recipe.parts }; for (const key of legsTaken) parts[key] = { ...parts[key], plant: event.target.checked }; change({ ...recipe, parts }); }}/> Keep foot on the ground</label>}
            <Section className="xf-timing" title="Timing" defaultOpen={false}>{slidersFor(true)}</Section>
          </div> : selectedTaken ? <div className="xf-part-controls" role="group" aria-label={transferPartLabel(selected)}>
            <div className="xf-part-title"><b>{transferPartLabel(selected)}</b>
              {kind === 'limb' && <button data-hotkey="transfer:other-side" data-hotkey-manual data-hotkey-label="Other side" aria-pressed={!!selectedTaken.flip} disabled={!donor || !rigA?.parts?.[feedsFrom(selected, !selectedTaken.flip)]} title="Take this part from the donor's other side: this left arm does what their right arm does." onClick={() => setPart(selected, { flip: !selectedTaken.flip })}>Other side</button>}</div>
            {donor && (selectedTaken.source !== donor.id || selectedTaken.sequence !== donorSeq) && <button data-hotkey="transfer:take-from" data-hotkey-manual data-hotkey-label="Take from the donor view" disabled={donorLacks(selected) || donorSeq < 0} title="Take this part from the animation the donor view shows now." onClick={() => take(selected)}>Take from <span translate="no">{nameOf(donor.id)} - {sequenceName(donor.model, donorSeq)}</span></button>}
            {kind === 'limb' && <div className="xf-scope" role="group" aria-label="Drag the hand or foot" title="Drag the hand or foot handle on the result to aim it. Whole movement turns the whole movement; This moment changes only the paused moment.">
              <button data-hotkey="transfer:whole-movement" data-hotkey-manual data-hotkey-label="Whole movement" aria-pressed={aimScope === 'whole'} onClick={() => setAimScope('whole')}>Whole movement</button>
              <button data-hotkey="transfer:this-moment" data-hotkey-manual data-hotkey-label="This moment" aria-pressed={aimScope === 'moment'} onClick={() => setAimScope('moment')}>This moment</button>
              {selectedTaken.fixes?.length > 0 && <button data-hotkey="transfer:clear-fixes" data-hotkey-manual data-hotkey-label="Clear fixes" title="Remove this part's moment fixes." onClick={clearFixes}>Clear fixes</button>}
            </div>}
            {aimNote && <p className="xf-note xf-reason" role="status">The limb cannot reach that point; it goes as far as it can.</p>}
            {slidersFor(false)}
            {weapon && <>
              {weapon.grip && <label className="xf-check" title="The other hand stays on the weapon where it holds it."><input data-hotkey="transfer:both-hands" data-hotkey-manual data-hotkey-label="Both hands on the weapon" type="checkbox" checked={selectedTaken.grip ?? true} onChange={event => setPart(selected, { grip: event.target.checked })}/> Both hands on the weapon</label>}
              <label className="xf-check" title="Lifts the arm where the weapon would go into the ground."><input data-hotkey="transfer:weapon-above-ground" data-hotkey-manual data-hotkey-label="Keep weapon above the ground" type="checkbox" checked={selectedTaken.clear ?? true} onChange={event => setPart(selected, { clear: event.target.checked })}/> Keep weapon above the ground</label>
              {donorWeapon && <label className="xf-check" title="Turns the weapon so it points the way the donor's weapon points."><input data-hotkey="transfer:point-weapon" data-hotkey-manual data-hotkey-label="Point weapon like theirs" type="checkbox" checked={aimEffective} onChange={event => setPart(selected, { aim: event.target.checked ? 1 : 0 })}/> Point weapon like theirs</label>}
            </>}
            {/^leg/.test(selected) && kind === 'limb' && <label className="xf-check" title="Keeps the foot on the donor foot's path, scaled to this leg, so a planted foot stays on the ground. Works when Hips come from the same animation."><input data-hotkey="transfer:keep-foot" data-hotkey-manual data-hotkey-label="Keep foot on the ground" type="checkbox" checked={selectedTaken.plant !== false} onChange={event => setPart(selected, { plant: event.target.checked })}/> Keep foot on the ground</label>}
            <Section className="xf-timing" title="Timing" defaultOpen={false}>{slidersFor(true)}</Section>
          </div> : <p className="xf-note">{!donor ? 'Choose where the animation comes from.' : selected && selected !== 'all' ? 'Switch the part on to take it.' : 'Click a part on the donor to take it, or Take whole body.'}</p>}
        </aside>
      </div>
      <footer className="xf-footer">
        <label className="xf-name" title="Name of the new animation.">Name <input data-hotkey="transfer:name" data-hotkey-manual data-hotkey-label="Animation name" aria-label="Name" value={shownName} maxLength={79} onChange={event => setName(event.target.value)}/></label>
        {added && <span className="xf-added" role="status">{added.count ? `Added ${added.count} animations` : <>Added <span translate="no">{added.name}</span></>}</span>}
        <span className="xf-spacer"/>
        <button disabled={adding} onClick={onClose} title="Close. Parts not added are lost.">Cancel</button>
        <button data-hotkey="transfer:add-all" data-hotkey-manual data-hotkey-label="Add all" className="xf-add-all" disabled={adding || !plan.clips.length || doc.readOnly || !built} title={addAllTip} onClick={addAll}>{adding ? 'Adding…' : <>Add all <span translate="no">({plan.clips.length})</span></>}</button>
        <button data-hotkey="transfer:add-animation" data-hotkey-manual data-hotkey-label="Add animation" className="xf-add" disabled={adding || !built || !taken.length || doc.readOnly} title="Add the result to this model as a new animation. One Undo removes it." onClick={add}>Add animation</button>
      </footer>
    </>}
  </ToolWindow>;
}
