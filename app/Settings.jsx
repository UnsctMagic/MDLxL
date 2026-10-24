import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { DEFAULT_PAINT_APPEARANCE } from '../src/paint-appearance.js';
import { APPLICATION_THEMES } from '../src/preferences.js';
import { LIGHTING_PRESETS } from '../src/preview-lighting.js';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { assignHotkey, CAMERA_PRESETS, chordFromEvent, configurationHotkeyConflict, DEFAULT_PREFERENCES, DEFAULT_VISUALS, effectiveBindings, formatChord, GRAPHICS_PRESETS, GRID_PRESETS, hotkeyConflicts, normalizePreferences, PANEL_WIDTH_MAX, PANEL_WIDTH_MIN } from '../src/preferences.js';
import { useHotkeys } from './Hotkeys.jsx';
import { HotkeySequence, HOTKEY_LEADER } from '../src/hotkey-defaults.js';
import { BUILT_IN_VIEWPORT_PRESETS, DEFAULT_BONE_APPEARANCE, DEFAULT_BONE_INFLUENCE, MAX_VIEWPORT_BACKGROUND_DATA_LENGTH, MAX_VIEWPORT_PRESETS, viewportPresetById } from '../src/viewport-appearance.js';
import { wireDashArray } from '../src/wire-pattern.js';
import { helpersForPreset, paintForPreset, viewportPresetChange } from '../src/light-dark-switch.js';
import { TREE_COLORS, NODE_COLORS, FOLDER_COLORS } from '../src/tree-appearance.js';
import { CONTROLLER_SHAPES, PIN_STYLES, controllerShapePoints } from '../src/controller-appearance.js';
import './settings.css';
import { updateStatusText } from './UpdatePrompt.jsx';
import { BONE_INFLUENCE_TIP } from './bone-display.js';
import { detectRenderer } from './renderer-detection.js';

// Appearance shows one page at a time; each section names the page it sits on.
export const APPEARANCE_PAGES = Object.freeze(['Presets', 'Interface', 'Viewport', 'Wires', 'Vertices', 'Bones & skeleton', 'Bone influence', 'Controllers', 'Lists & folders', 'Quadview', 'Editor helpers', 'Citadel Paint']);
const APPEARANCE_PAGE_OF = Object.freeze({ 'Folders & lists': 'Lists & folders', 'Node colors': 'Lists & folders', 'Sound folder colors': 'Lists & folders', 'Viewport background': 'Viewport', 'Highlight Geoset': 'Viewport', 'Wire style': 'Wires', 'Selected geoset': 'Wires', 'Other visible geosets': 'Wires', 'Hidden vertices': 'Vertices', 'Selected vertices': 'Vertices', 'Unselected vertices': 'Vertices' });
const AppearancePage = createContext(null);
let lastAppearancePage = 'Presets';
function AppearanceSection({ title, children, palette }) {
  const page = useContext(AppearancePage);
  if (page && (APPEARANCE_PAGE_OF[title] || title) !== page) return null;
  return <section className="settings-appearance-section"><h4>{title}</h4><div className="settings-appearance-content">{palette}{children}</div></section>;
}
export const BONE_STYLE_TIP = 'The shape of bone and helper markers: cubes or diamonds. Skeleton links have their own style setting.';
export const BONE_CONNECTOR_TIP = 'The style of skeleton links between objects: Shaded fades from dark to light; Tapered narrows towards the child; Cone adds an outline; Stick draws thick bars. Object markers keep their own shape.';
export const WIRE_MODE_TIP = 'All edges draws every wire the same way. Hidden-line draws the wires behind the mesh as faint dashes, so the front of the model reads clearly in Wireframe.';
const BONE_STYLE_LABELS = [['cubes', 'Cubes'], ['diamond', 'Diamonds']];
const BONE_COLOR_LABELS = [['bone', 'Bone'], ['root', 'Root bone'], ['helper', 'Helpers'], ['ref', 'Refs'], ['selected', 'Selected bone'], ['parent', 'Parent bone'], ['child', 'Child bones']];
const INFLUENCE_COLOR_LABELS = [['ghost', 'Ghost'], ['direct', 'Moved by the bone'], ['follow', 'Follows through child bones']];

/** A small chain drawn the way the viewport draws bones: an ordinary link, then the selected bone and its child highlighted. */
function BonePreview({ bones, background }) {
  const joints = [[18, 50], [70, 26], [128, 42], [184, 14]], fills = [bones.root, bones.parent, bones.selected, bones.child];
  const link = (a, b, highlight) => {
    const width = (highlight ? bones.highlightThickness : bones.thickness) * (bones.connector === 'stick' ? 2 : 1), shape = bones.connector;
    const fill = highlight || 'url(#settings-bone-shade)';
    if (shape === 'shaded' || shape === 'stick') return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={fill} strokeWidth={width}/>;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / length, ny = (b[0] - a[0]) / length, half = (shape === 'cone' ? Math.max(10, width * 3.4) : width * 1.7) / 2;
    return <polygon points={[[a[0] + nx * half, a[1] + ny * half], [b[0] + nx * .5, b[1] + ny * .5], [b[0] - nx * .5, b[1] - ny * .5], [a[0] - nx * half, a[1] - ny * half]].map(p => p.join(',')).join(' ')} fill={fill} stroke={shape === 'cone' ? '#000000' : 'none'} strokeWidth=".8"/>;
  };
  return <svg className="settings-bone-preview" viewBox="0 0 204 64" role="img" aria-label="Bone appearance preview" style={{ background }}>
    <defs><linearGradient id="settings-bone-shade" gradientUnits="userSpaceOnUse" x1={joints[0][0]} y1={joints[0][1]} x2={joints[1][0]} y2={joints[1][1]}><stop offset="0" stopColor="#000000"/><stop offset="1" stopColor="#ffffff"/></linearGradient></defs>
    {link(joints[0], joints[1], null)}{link(joints[1], joints[2], bones.selected)}{link(joints[2], joints[3], bones.child)}
    {joints.map((p, i) => bones.style === 'diamond' ? <polygon key={i} points={`${p[0]},${p[1]-6} ${p[0]+6},${p[1]} ${p[0]},${p[1]+6} ${p[0]-6},${p[1]}`} fill={fills[i]} stroke="#111111" strokeWidth=".6"/> : <rect key={i} x={p[0] - 5} y={p[1] - 5} width="10" height="10" fill={fills[i]} stroke="#111111" strokeWidth=".6"/>)}
  </svg>;
}
const colorValues = value => Object.fromEntries(Object.entries(value).filter(([, color]) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)));
const sameValues = (a, b) => Object.keys(b).every(key => a?.[key] === b[key]);
function AppearanceSet({ title, value, entries, onChange }) {
  const current = entries.find(([, , colors]) => sameValues(value, colors))?.[0] || '';
  return <label className="settings-appearance-set"><span>{title === 'Controllers' ? 'Appearance set' : 'Color set'}</span><select aria-label={`${title} appearance set`} value={current} onChange={event => onChange(entries.find(([id]) => id === event.target.value)[2])}><option value="" disabled>Custom</option>{entries.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>;
}
function ControllerPreview({ appearance }) {
  return <svg className="settings-controller-preview" viewBox="0 0 300 66" role="img" aria-label="Controller appearance preview" style={{ background: appearance.background }}>
    {['shape', 'bodyShape', 'bendShape'].map((key, index) => {
      const x = 38 + index * 78, points = controllerShapePoints(appearance[key], appearance.size);
      return <g key={key} transform={`translate(${x},26)`} stroke={index === 1 ? appearance.selected : appearance.color} fill={appearance.background} strokeWidth="2">{points ? <polygon points={points.map(pair => pair.join(',')).join(' ')}/> : <circle r={appearance.size}/>}<text y="32" stroke="none" fill={appearance.outline} textAnchor="middle" fontSize="10">{['Handle', 'Body', 'Bend'][index]}</text></g>;
    })}
    <g transform="translate(262,26)" stroke={appearance.pinned} fill="none" strokeWidth="2">{appearance.pinStyle === 'round' ? <circle r="15"/> : <rect x={appearance.pinStyle === 'label' ? -25 : -15} y="-15" width={appearance.pinStyle === 'label' ? 50 : 30} height="30" rx="3"/>}<path d="M-5-8H5L3-2L7 2V4H-7V2L-3-2ZM0 4V12"/><text y="32" stroke="none" fill={appearance.outline} textAnchor="middle" fontSize="10">Pin</text></g>
  </svg>;
}
function AppearanceColors({ colors, value, prefix, onChange }) {
  return <div className="settings-color-grid">{colors.map(([key, label]) => <label className="settings-color" key={key}><span>{label}</span><input type="color" aria-label={`${prefix} ${label}`} value={value[key]} onChange={event => onChange({ [key]: event.target.value })}/><code>{value[key]}</code></label>)}</div>;
}

function Toggle({ id, label, checked, onChange, description }) {
  return <label className="settings-toggle"><input data-hotkey={id} data-hotkey-label={label} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/><span>{label}{description && <small>{description}</small>}</span></label>;
}
function Numeric({ id, label, value, min, max, step = 1, onChange, unit = '' }) {
  return <label className="settings-number"><span>{label}</span><span><input data-hotkey={id} aria-label={label} type="number" min={min} max={max} step={step} value={value} onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber); }}/>{unit}</span></label>;
}
const VISUAL_COLORS = [['background', 'Viewport background'], ['vertex', 'Vertices'], ['selectedVertex', 'Selected vertices'], ['occludedVertex', 'Occluded vertices'], ['wireframe', 'Wireframe lines'], ['occludedWireframe', 'Occluded wireframe'], ['selectedGeometry', 'Selected geometry'], ['gridMinor', 'Minor grid'], ['gridMajor', 'Major grid'], ['axisX', 'X axis'], ['axisY', 'Y axis'], ['axisZ', 'Z axis'], ['keyframe', 'Keyframes'], ['activeKeyframe', 'Active keyframe'], ['bone', 'Bones and helper bones'], ['node', 'Attachment refs and nodes'], ['particle', 'Particle emitters'], ['event', 'Event objects'], ['selection', 'Selection overlay'], ['uvSelection', 'UV live selection']];
const APPEARANCE_HELPER_COLORS = VISUAL_COLORS.filter(([key]) => ['keyframe', 'activeKeyframe', 'bone', 'node', 'particle', 'event', 'selection', 'uvSelection'].includes(key));

function WireLinePreview({ wire, background, label }) {
  const dash = wireDashArray(wire).join(' ');
  return <svg className="settings-appearance-preview settings-wire-preview" viewBox="0 0 96 22" role="img" aria-label={`${label} wire line preview`} focusable="false" style={{backgroundColor:background}}>
    <line x1="6" y1="11" x2="90" y2="11" stroke={wire.color} strokeWidth={wire.thickness} strokeOpacity={wire.opacity} strokeDasharray={dash || undefined} strokeLinecap={wire.style === 'dotted' ? 'round' : 'butt'}/>
  </svg>;
}

function VertexMarkerPreview({ marker, background, label }) {
  const half = marker.size / 2, centerX = 48, centerY = 11;
  const shape = marker.style === 'circle'
    ? <circle cx={centerX} cy={centerY} r={half}/>
    : marker.style === 'diamond'
      ? <polygon points={`${centerX},${centerY - half} ${centerX + half},${centerY} ${centerX},${centerY + half} ${centerX - half},${centerY}`}/>
      : <rect x={centerX - half} y={centerY - half} width={marker.size} height={marker.size}/>;
  return <svg className="settings-appearance-preview settings-marker-preview" viewBox="0 0 96 22" role="img" aria-label={`${label} marker preview`} focusable="false" style={{backgroundColor:background}}>
    <g fill={marker.color}>{shape}</g>
  </svg>;
}

function AssetPreload({ modelPath }) {
  const [status, setStatus] = useState({ state: 'idle' }), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), cancelChoice = useRef(null), trigger = useRef(null);
  const available = !!window.desktop?.textureLibraryPreloadStart;
  const update = next => { if (mounted.current && next) setStatus(previous => previous.updatedAt && next.updatedAt < previous.updatedAt ? previous : next); };
  useEffect(() => {
    mounted.current = true;
    if (!available) return () => { mounted.current = false; };
    const unsubscribe = window.desktop.onTextureLibraryPreloadProgress?.(update);
    window.desktop.textureLibraryPreloadStatus().then(update).catch(cause => { if (mounted.current) setError(cause.message); });
    return () => { mounted.current = false; unsubscribe?.(); };
  }, [available]);
  useEffect(() => { if (confirm) cancelChoice.current?.focus(); }, [confirm]);
  const running = ['indexing', 'running'].includes(status.state);
  const decline = () => { setConfirm(false); trigger.current?.focus(); };
  const request = async cancel => {
    if (busy) return; setBusy(true); setError(''); setConfirm(false);
    try {
      const next=await (cancel ? window.desktop.textureLibraryPreloadCancel({ jobId: status.jobId }) : window.desktop.textureLibraryPreloadStart({ modelPath }));
      update(next);
      if(!cancel && ['indexing','running','complete'].includes(next?.state))void import('./TextureLibrary.jsx').then(module=>module.warmTextureLibrary(modelPath)).catch(()=>{});
    }
    catch (cause) { if (mounted.current) setError(cause.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  const titles = { idle: 'No preload is running.', indexing: 'Finding available textures…', running: 'Preparing texture previews…', complete: 'Asset preload finished.', cancelled: 'Preload stopped. Completed previews are kept.', error: 'Asset preload could not finish.' };
  return <section className="settings-preload" aria-label="Preload Assets">
    <h3>Preload Assets</h3><p>Prepare local texture previews once for faster library browsing. Cached previews remain available after restarting MDLxL.</p>
    <button ref={trigger} data-hotkey="game-data:preload" disabled={!available || running || busy || confirm} onClick={() => setConfirm(true)}>Preload Assets</button>
    {!available && <p className="settings-hint">Asset preloading is available in the desktop app.</p>}
    {confirm && <div className="settings-preload-confirm" role="group" aria-label="Confirm asset preload" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); decline(); } }}>
      <strong>Preload all available asset previews?</strong><p>This reads the available texture library and saves thumbnails locally. The first run can take time and use disk space. You can continue editing or close Settings while it runs. Cancel stops the run and keeps completed previews; a later run reuses them. Imported textures keep their original Warcraft paths.</p>
      <div className="settings-inline-actions"><button disabled={busy} onClick={() => request(false)}>Yes</button><button ref={cancelChoice} onClick={decline}>No</button></div>
    </div>}
    <div className="settings-preload-status" role="status" aria-live="polite">
      <p>{titles[status.state] || titles.idle}</p>
      {(running || status.total > 0) && <><progress aria-label="Asset preload progress" max={Math.max(1, status.total || 0)} value={status.state === 'indexing' ? undefined : Math.min(status.total || 0, status.completed || 0)}/><p>{(status.completed || 0).toLocaleString()} / {(status.total || 0).toLocaleString()} processed · {(status.cached || 0).toLocaleString()} reused · {(status.failed || 0).toLocaleString()} unavailable{status.bytes > 0 ? ` · ${(status.bytes / 1048576).toFixed(1)} MB cached` : ''}</p></>}
      {running && status.current && <code title={status.current}>{status.current}</code>}
    </div>
    {running && <button disabled={busy} onClick={() => request(true)}>Cancel preload</button>}
    {error && <p className="settings-preload-error" role="alert">{error}</p>}
    {status.errors?.length > 0 && <details className="settings-preload-errors"><summary>Unavailable previews ({status.failed || status.errors.length})</summary><ul>{status.errors.slice(0, 12).map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.message || item.path || 'Preview unavailable'}</li>)}</ul><p>Run Preload Assets again to retry unavailable previews.</p></details>}
  </section>;
}

export default function Settings({ preferences, onChange, onClose, catalog: suppliedCatalog, initialTab = 'mouse', onTabChange, gameDataPath = '', gameDataSources = [], modelPath = null, onChooseGameData, onClearGameData, onAddGameDataSource, onRemoveGameDataSource, updateStatus, onCheckUpdates, onRevertUpdate }) {
  const [gameDataBusy, setGameDataBusy] = useState(false);
  async function changeGameDataSource(action) {
    setGameDataBusy(true);
    try { await action(); } finally { setGameDataBusy(false); }
  }
  const context = useHotkeys(), catalog = suppliedCatalog || context.catalog;
  const prefs = normalizePreferences(preferences);
  const [appearancePage, setAppearancePageState] = useState(() => APPEARANCE_PAGES.includes(lastAppearancePage) ? lastAppearancePage : 'Presets');
  const setAppearancePage = page => { lastAppearancePage = page; setAppearancePageState(page); };
  const [tab, setTab] = useState(initialTab), [search, setSearch] = useState(''), [category, setCategory] = useState('All categories');
  const [recording, setRecording] = useState(null), [recorded, setRecorded] = useState(''), [message, setMessage] = useState(''), [resetConfirm, setResetConfirm] = useState(false), [presetName, setPresetName] = useState('');
  const [sequenceCode, setSequenceCode] = useState(null), sequence = useRef(null), sequenceTimer = useRef(null);
  if (!sequence.current) sequence.current = new HotkeySequence();
  const configInput = useRef(null), platformInput = useRef(null), viewportImageInput = useRef(null), quadImageInput = useRef(null);
  const recorder = useRef(null), panel = useRef(null), previousFocus = useRef(null);
  const bindings = useMemo(() => effectiveBindings(catalog, prefs.hotkeys), [catalog, preferences?.hotkeys]);
  const categories = [...new Set(catalog.map(action => action.category || 'Controls'))].sort();
  const actions = catalog.filter(action => (category === 'All categories' || (action.category || 'Controls') === category) && `${action.label} ${action.id} ${action.category} ${(bindings[action.id] || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.label || a.id).localeCompare(b.label || b.id));
  const conflicts = recorded && recording ? hotkeyConflicts(catalog, prefs.hotkeys, recording.id, recorded) : [];
  const labelFor = id => catalog.find(action => action.id === id)?.label || id;
  const commit = change => onChange(normalizePreferences({ ...prefs, ...change }));
  const graphic = change => commit({ graphics: { ...prefs.graphics, ...change } });
  const visual = change => commit({ visuals: { ...prefs.visuals, ...change } });
  const viewport = change => commit({ viewportPreset: 'custom', viewportAppearance: { ...prefs.viewportAppearance, ...change } });
  const viewportPart = (part, change) => viewport({ [part]: { ...prefs.viewportAppearance[part], ...change } });
  const quadPart = (part, change) => viewportPart('quadView', { [part]: { ...prefs.viewportAppearance.quadView[part], ...change } });
  const treePart = (part, change) => viewportPart('tree', { [part]: { ...prefs.viewportAppearance.tree[part], ...change } });
  const palette = (title, value, read, apply) => <AppearanceSet title={title} value={value} entries={Object.values(BUILT_IN_VIEWPORT_PRESETS).map(preset => [preset.id, preset.name, read(preset)])} onChange={apply}/>;
  const partPalette = (part, title) => palette(title, prefs.viewportAppearance[part], preset => part === 'controllers' ? preset.appearance[part] : colorValues(preset.appearance[part]), change => viewportPart(part, change));
  const helpersFor = helpersForPreset, paintFor = paintForPreset;
  const grid = change => commit({ grid: { ...prefs.grid, ...change } });
  useEffect(() => {
    previousFocus.current = document.activeElement;
    panel.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus();
    return () => { if (previousFocus.current?.isConnected) previousFocus.current.focus(); };
  }, []);
  useEffect(() => { sequence.current.cancel(); clearTimeout(sequenceTimer.current); setSequenceCode(null); if (recording) recorder.current?.focus(); }, [recording]);
  useEffect(() => () => clearTimeout(sequenceTimer.current), []);
  useEffect(() => { setTab(initialTab); setRecording(null); setMessage(''); }, [initialTab]);
  const startRecording = action => { setRecording(action); setRecorded(''); setMessage(''); setResetConfirm(false); };
  const cancelSequence = () => { if (!sequence.current.active) return; sequence.current.cancel(); clearTimeout(sequenceTimer.current); setSequenceCode(null); setRecorded(''); setMessage('Sequence cancelled. Press a combination or the leader to try again.'); };
  const recordKey = event => {
    event.preventDefault(); event.stopPropagation();
    if (event.repeat) return;
    const key = chordFromEvent(event);
    if (sequence.current.active || key === HOTKEY_LEADER) {
      const next = sequence.current.feed(event);
      clearTimeout(sequenceTimer.current); setSequenceCode(next.pending ? next.code : null); setRecorded(next.chord); setMessage(next.cancelled ? 'Sequence cancelled.' : '');
      if (next.pending) sequenceTimer.current = setTimeout(cancelSequence, sequence.current.timeoutMs);
      return;
    }
    if (key) { setRecorded(key); setMessage(''); }
    else setMessage('Press a key together with any modifiers. Modifier keys alone cannot be assigned.');
  };
  const applyShortcut = replace => {
    const result = assignHotkey(prefs.hotkeys, catalog, recording.id, recorded, { replace });
    if (!result.ok) { setMessage(result.error); return; }
    commit({ hotkeys: result.hotkeys }); setMessage(`${formatChord(recorded)} assigned to ${recording.label || recording.id}.`); setRecording(null); setRecorded('');
  };
  const removeShortcut = (id, chord) => { commit({ hotkeys: { ...prefs.hotkeys, [id]: (bindings[id] || []).filter(key => key !== chord) } }); setMessage(`Removed ${formatChord(chord)} from ${labelFor(id)}.`); };
  const restoreAction = action => {
    const next = { ...prefs.hotkeys }; delete next[action.id];
    const collision = (action.defaultKeys || []).flatMap(chord => hotkeyConflicts(catalog, next, action.id, chord));
    if (collision.length) { setMessage(`Cannot restore ${action.label}: a default shortcut is assigned to ${[...new Set(collision)].map(labelFor).join(', ')}. Clear that assignment first, or use Add shortcut and replace it.`); return; }
    commit({ hotkeys: next }); setMessage(`Restored defaults for ${action.label || action.id}.`);
  };
  const exportSettings = () => {
    const url=URL.createObjectURL(new Blob([JSON.stringify(exportConfiguration(prefs),null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='MDLxL-configuration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const loadConfiguration=async file=>{try{if(!file)return;const next=importConfiguration(await file.text());const conflict=configurationHotkeyConflict(catalog,next.hotkeys);if(conflict)throw new Error('Conflicting shortcut '+conflict+'.');onChange(next);setMessage('Configuration imported. Portable settings replaced.');}catch(error){setMessage(error.message);}};
  const loadPlatformTexture=async file=>{try{if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2000000)throw new Error('Choose a PNG, JPEG or WebP under 2 MB.');const reader=new FileReader();reader.onload=()=>commit({platform:{...prefs.platform,textureUrl:reader.result}});reader.readAsDataURL(file);}catch(error){setMessage(error.message);}};
  const loadViewportBackground = async (file, quad = false) => {
    try {
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8_000_000) throw new Error('Choose a PNG, JPEG or WebP under 8 MB.');
      const imageData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('The background image could not be read.')); reader.readAsDataURL(file); });
      if (typeof imageData !== 'string' || imageData.length > MAX_VIEWPORT_BACKGROUND_DATA_LENGTH) throw new Error('The encoded background image is too large to save safely.');
      (quad ? quadPart : viewportPart)('background', { type: 'image', imageData, imageName: file.name }); setMessage(`Background image loaded: ${file.name}`);
    } catch (error) { setMessage(error.message); }
  };
  const applyViewportPreset = id => {
    const preset = viewportPresetById(id, prefs.viewportPresets);
    if (!preset) return;
    commit(viewportPresetChange(prefs, id)); setMessage(`${preset.name} loaded.`);
  };
  const saveViewportPreset = () => {
    const name = presetName.trim();
    if (!name) { setMessage('Enter a name for the custom viewport preset.'); return; }
    if (prefs.viewportPresets.length >= MAX_VIEWPORT_PRESETS) { setMessage(`You can save up to ${MAX_VIEWPORT_PRESETS} custom viewport presets.`); return; }
    if ([...Object.values(BUILT_IN_VIEWPORT_PRESETS), ...prefs.viewportPresets].some(preset => preset.name.toLowerCase() === name.toLowerCase())) { setMessage('A viewport preset with that name already exists.'); return; }
    const id = `custom-${Date.now().toString(36)}`;
    commit({ viewportPreset: id, viewportPresets: [...prefs.viewportPresets, { id, name, appearance: prefs.viewportAppearance, theme: prefs.theme, accent: prefs.accent }] });
    setPresetName(''); setMessage(`${name} saved.`);
  };
  const deleteViewportPreset = () => {
    if (!String(prefs.viewportPreset).startsWith('custom-')) return;
    const removed = prefs.viewportPresets.find(preset => preset.id === prefs.viewportPreset);
    commit({ viewportPreset: 'custom', viewportPresets: prefs.viewportPresets.filter(preset => preset.id !== prefs.viewportPreset) });
    setMessage(`${removed?.name || 'Custom preset'} deleted. Current appearance was kept.`);
  };
  const trapFocus = event => {
    if (event.key === 'Escape' && !event.target.closest('[data-hotkey-recording]')) { event.preventDefault(); event.stopPropagation(); if (recording) setRecording(null); else onClose(); return; }
    if (event.key !== 'Tab' || event.target.closest('[data-hotkey-recording]')) return;
    const focusable = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="classic-modal settings-overlay" data-hotkey-scope="settings"><section ref={panel} className="classic-modal-window settings-window" role="dialog" aria-modal="true" aria-label="Settings" data-hotkey-scope="settings" data-hotkey-prefix="settings" data-hotkey-category="Settings" onKeyDown={trapFocus}>
    <header><span>Settings</span><button data-hotkey="close" aria-label="Close Settings" onClick={onClose}>×</button></header>
    <div className="settings-tabs" role="tablist" aria-label="Settings pages">{[['configuration','Configuration'], ['mouse', 'Mouse'], ['hotkeys', 'Hotkeys'], ['graphics', 'Graphics'], ['capture', 'Capture'], ['visuals', 'Appearance'], ['grid', 'Grid'], ['gameData', 'Warcraft III']].map(([id, label]) => <button key={id} id={`settings-tab-${id}`} data-hotkey={`tab:${id}`} role="tab" aria-selected={tab === id} aria-controls={`settings-panel-${id}`} onClick={() => { setTab(id); onTabChange?.(id); setRecording(null); setMessage(''); }}>{label}</button>)}</div>
    <div className="classic-modal-body settings-body" role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
      {tab === 'mouse' && <div className="settings-page">
        <h3>Camera controls</h3><p>Choose camera navigation buttons. Left mouse continues to use the active camera or editing tool.</p>
        <div className="settings-inline-actions"><span>Preset:</span><button data-hotkey="mouse:preset:classic" onClick={() => commit(CAMERA_PRESETS.classic)}>Classic MDLVis</button><button data-hotkey="mouse:preset:orbit" onClick={() => commit(CAMERA_PRESETS.orbit)}>Orbit navigation</button></div>
        <div className="settings-graphics-grid">{[['right', 'Right mouse'], ['middle', 'Middle mouse']].map(([key, label]) => <label className="settings-select" key={key}><span>{label}</span><select data-hotkey={`mouse:binding:${key}`} aria-label={`${label} camera action`} value={prefs.cameraBindings[key]} onChange={event => commit({ cameraBindings: { ...prefs.cameraBindings, [key]: event.target.value } })}>{(key === 'middle' ? [['toggle', 'Toggle rotation / work']] : []).concat([['pan', 'Pan'], ['rotate', 'Rotate'], ['zoom', 'Zoom'], ['none', 'No action']]).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}</div>
        <h3>Mouse wheel sensitivity</h3><p>Change how far each wheel step zooms or scrolls in the editors. Changes apply immediately and are remembered.</p>
        <div className="settings-sensitivity"><input data-hotkey="mouse:sensitivity-slider" aria-label="Mouse wheel sensitivity" type="range" min="0.1" max="10" step="0.01" value={prefs.scrollSensitivity} onChange={event => commit({ scrollSensitivity: Number(event.target.value) })}/><label><input data-hotkey="mouse:sensitivity-value" aria-label="Mouse wheel sensitivity value" type="number" min="0.1" max="10" step="0.01" value={prefs.scrollSensitivity} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) commit({ scrollSensitivity: value }); }}/><span>×</span></label></div>
        <div className="settings-range-labels"><span>Precise · 0.1×</span><span>Fast · 10×</span></div>
        <div className="settings-inline-actions" role="group" aria-label="Wheel mode">{[['rotate','Rotation / normal zoom'],['scroll','Peon · Scroll sensitivity'],['pointer','Wisp · Wheel adjusts DPI']].map(([value,label]) => <button key={value} data-hotkey={`mouse:wheel:${value}`} aria-pressed={prefs.wheelMode === value} onClick={() => commit({ wheelMode:value })}>{label}</button>)}</div>
        <p className="settings-hint">Normal mode: wheel zooms; a middle click toggles camera rotation and work mode. Peon: wheel alone adjusts scroll sensitivity. Wisp: wheel alone adjusts DPI. Hold left and scroll for a temporary DPI adjustment without changing the selected toolbar mode. Left then right resets DPI. Right then left resets scroll sensitivity.</p>
        <h3>DPI / pointer sensitivity</h3><p>Adjust 3D camera and editing drag speed inside MDLxL. UV transforms have their own sensitivity below. This multiplier does not change hardware DPI or Windows pointer settings.</p>
        <div className="settings-sensitivity"><input data-hotkey="mouse:pointer-slider" aria-label="MdlVis pointer sensitivity" type="range" min="0.01" max="4" step="0.01" value={prefs.pointerSensitivity} onChange={event => commit({ pointerSensitivity:Number(event.target.value) })}/><label><input data-hotkey="mouse:pointer-value" aria-label="MdlVis pointer sensitivity value" type="number" min="0.01" max="4" step="0.01" value={prefs.pointerSensitivity} onChange={event => { if(Number.isFinite(event.target.valueAsNumber)) commit({ pointerSensitivity:event.target.valueAsNumber }); }}/><span>×</span></label></div>
        <div className="settings-range-labels"><span>Ultra-precise · 0.01×</span><span>Fast · 4×</span></div>
        <Toggle id="mouse:right-scroll-adjust" label="Hold right mouse button + scroll to adjust sensitivity" checked={prefs.rightScrollAdjust} onChange={rightScrollAdjust => commit({ rightScrollAdjust })} description="Wheel up increases sensitivity; wheel down decreases it. Release the right button and the next wheel movement uses the new value. The value stays until you change it."/>
        <div className="settings-graphics-grid"><Numeric id="mouse:fine" label="Fine control multiplier" value={prefs.fineSensitivity} min={0.01} max={1} step={0.01} unit="×" onChange={fineSensitivity => commit({ fineSensitivity })}/><Numeric id="mouse:uv" label="UV transform sensitivity" value={prefs.uvSensitivity} min={0.01} max={4} step={0.01} unit="×" onChange={uvSensitivity => commit({ uvSensitivity })}/></div>
        <p className="settings-hint">UV movement is measured relative to the displayed texture. At 1×, UV vertices follow your pointer. Changing camera DPI leaves UV movement, rotation, and scale unchanged. For fine control, hold Alt when starting a UV drag or Shift while navigating the 3D camera.</p>
        <button data-hotkey="mouse:reset" onClick={() => commit({ ...CAMERA_PRESETS.classic, uvSensitivity: DEFAULT_PREFERENCES.uvSensitivity })}>Restore mouse defaults</button>
      </div>}
      {tab === 'hotkeys' && <div className="settings-page hotkeys-page">
        <h3>Hotkeys</h3><p>Assign a key or combination to commands, buttons, and fields. Hold Alt to show available button shortcuts; remapped combinations appear in full. Field shortcuts focus the field; toggle shortcuts switch it.</p>
        <p>Existing MdlVis shortcuts are preserved. Other controls have default sequences: press <kbd>Ctrl+Alt+Space</kbd>, release the keys, then type the three-character code listed here. Escape cancels. Peon: <kbd>Ctrl+Alt+P</kbd> · Wisp: <kbd>Ctrl+Alt+I</kbd>. You can replace any sequence with a single key or combination.</p>
        <p className="settings-hint">Resource controls appear here when their manager is opened and stay in this list after closing it. Shortcuts act only on available controls in the active window, and leave text entry alone.</p>
        <div className="hotkeys-filter"><input data-hotkey="hotkeys:search" aria-label="Search Hotkeys" placeholder="Search actions or shortcuts…" value={search} onChange={event => setSearch(event.target.value)}/><select data-hotkey="hotkeys:category" aria-label="Hotkeys category" value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select><span>{actions.length} actions</span></div>
        {recording && <div className="hotkeys-recorder" aria-label={`Assign shortcut to ${recording.label || recording.id}`}>
          <strong>Shortcut for {recording.label || recording.id}</strong><div ref={recorder} tabIndex={0} className="hotkeys-capture" data-hotkey-recording="true" aria-label="Press a key combination" onKeyDown={recordKey} onBlur={cancelSequence}>{sequenceCode !== null ? <kbd>{HOTKEY_LEADER} &gt; {sequenceCode.padEnd(3, '·')}</kbd> : recorded ? <kbd>{formatChord(recorded)}</kbd> : 'Press a combination, or Ctrl+Alt+Space followed by three letters or digits'}</div>
          {!!conflicts.length && <p className="hotkeys-conflict">{formatChord(recorded)} is assigned to <strong>{conflicts.map(labelFor).join(', ')}</strong>. Replace removes this key from those actions.</p>}
          <div className="settings-inline-actions"><button disabled={!recorded} onClick={() => applyShortcut(!!conflicts.length)}>{conflicts.length ? 'Replace existing assignment' : 'Assign shortcut'}</button><button onClick={() => { setRecording(null); setRecorded(''); }}>Cancel</button></div>
        </div>}
        <div className="hotkeys-table-wrap"><table className="hotkeys-table"><thead><tr><th>Action</th><th>Shortcut</th><th><span className="settings-sr-only">Change shortcut</span></th></tr></thead><tbody>{actions.map(action => <tr key={action.id}><td><strong>{action.label || action.id}</strong><small title={action.id}>{action.category || 'Controls'}{action.contextual ? ' · when visible' : ''}</small></td><td><div className="hotkeys-chords">{(bindings[action.id] || []).map(chord => <span className="hotkeys-chip" key={chord}><kbd>{formatChord(chord)}</kbd><button aria-label={`Remove ${formatChord(chord)} from ${action.label || action.id}`} onClick={() => removeShortcut(action.id, chord)}>×</button></span>)}{!bindings[action.id]?.length && <span className="settings-muted">Unassigned</span>}</div></td><td><div className="hotkeys-row-actions"><button aria-label={`Assign shortcut to ${action.label || action.id}`} onClick={() => startRecording(action)}>Add shortcut</button><button aria-label={`Restore default shortcuts for ${action.label || action.id}`} onClick={() => restoreAction(action)}>Reset</button></div></td></tr>)}</tbody></table>{!actions.length && <p>No actions match this search.</p>}</div>
        <div className="settings-inline-actions">{resetConfirm ? <><span>Restore every default shortcut and clear custom assignments?</span><button onClick={() => { commit({ hotkeys: {} }); setResetConfirm(false); setRecording(null); setMessage('All Hotkeys restored to defaults.'); }}>Restore all defaults</button><button onClick={() => setResetConfirm(false)}>Cancel</button></> : <button data-hotkey="hotkeys:reset-all" onClick={() => setResetConfirm(true)}>Reset all Hotkeys…</button>}</div>
      </div>}
      {tab === 'graphics' && <div className="settings-page">
        <h3>Preview lighting</h3>
        <label>Setup <select aria-label="Lighting setup" value={prefs.lighting.preset} onChange={event=>commit({lighting:{...prefs.lighting,preset:event.target.value}})}><option value="requested">Requested · 128 / 192 / 0</option><option value="legacy">Previous lighting</option><option value="custom">Custom</option></select></label>
        <div className="settings-graphics-grid">{['ambient','diffuse','specular'].map(channel=><fieldset key={channel}><legend>{channel}</legend>{['R','G','B'].map((axis,i)=><Numeric key={axis} id={`lighting:${channel}:${axis}`} label={`${channel} ${axis}`} value={prefs.lighting[channel][i]} min={0} max={255} onChange={value=>commit({lighting:{...prefs.lighting,preset:'custom',[channel]:prefs.lighting[channel].map((v,j)=>i===j?value:v)}})}/>)}</fieldset>)}</div>
        <Numeric id="lighting:power" label="Specular power" value={prefs.lighting.power} min={0} step={.1} onChange={power=>commit({lighting:{...prefs.lighting,preset:'custom',power}})}/>
        <h3>Display platform</h3><Toggle id="platform:enabled" label="Show platform" checked={prefs.platform.enabled} onChange={enabled=>commit({platform:{...prefs.platform,enabled}})}/>
        <label>Shape <select aria-label="Platform shape" value={prefs.platform.shape} onChange={event=>commit({platform:{...prefs.platform,shape:event.target.value}})}>{['square','disc','hexagon'].map(shape=><option key={shape}>{shape}</option>)}</select></label>
        <Numeric id="platform:size" label="Platform size" value={prefs.platform.size} min={.1} max={10} step={.1} unit="× model radius" onChange={size=>commit({platform:{...prefs.platform,size}})}/><Numeric id="platform:height" label="Platform height" value={prefs.platform.height} min={-100000} max={100000} onChange={height=>commit({platform:{...prefs.platform,height}})}/>
        <label>Platform color <input type="color" aria-label="Platform color" value={prefs.platform.color} onChange={event=>commit({platform:{...prefs.platform,color:event.target.value}})}/></label><input ref={platformInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{loadPlatformTexture(event.target.files[0]);event.target.value='';}}/><button onClick={()=>platformInput.current.click()}>Choose platform texture…</button><button disabled={!prefs.platform.textureUrl} onClick={()=>commit({platform:{...prefs.platform,textureUrl:''}})}>Clear texture</button>
        <h3>Graphical settings</h3><p>Use fewer visual effects to reduce rendering and texture loading work. These preferences do not change the saved model.</p>
        {(() => { const renderer = detectRenderer(); return renderer.name && <p className="settings-muted" title="The device that draws the 3D views. Software rendering means no graphics card is in use, so the processor draws every pixel.">Drawing with: {renderer.name}{renderer.software ? ` · software rendering${prefs.graphics.softwareLow ? ', so 30 fps was chosen automatically' : ''}` : ''}</p>; })()}
        <div className="settings-inline-actions"><span>Preset:</span>{[['fast', 'Fast'], ['balanced', 'Balanced'], ['quality', 'High quality']].map(([id, label]) => <button key={id} data-hotkey={`graphics:preset:${id}`} onClick={() => graphic(GRAPHICS_PRESETS[id])}>{label}</button>)}</div>
        <div className="settings-graphics-grid"><label className="settings-select"><span>Render resolution</span><select data-hotkey="graphics:pixel-ratio" aria-label="Render resolution" value={prefs.graphics.pixelRatio} onChange={event => graphic({ pixelRatio: Number(event.target.value) })}><option value="0.5">0.5× · low-spec PCs</option><option value="0.75">0.75× · lighter</option><option value="1">1× · fast</option><option value="1.5">1.5× · balanced</option><option value="2">2× · sharper</option></select><small>Maximum pixel ratio; lower values reduce GPU work. Below 1× the 3D views are drawn smaller and scaled up, which looks softer.</small></label><label className="settings-select"><span>Maximum frame rate</span><select data-hotkey="graphics:max-fps" aria-label="Maximum frame rate" value={prefs.graphics.maxFps} onChange={event => graphic({ maxFps: Number(event.target.value) })}><option value="30">30 fps · lower load</option><option value="60">60 fps · balanced</option><option value="120">120 fps · smoother motion</option></select><small>Only active playback or interaction needs continuous frames.</small></label></div>
        <Toggle id="graphics:antialias" label="Smooth edges (antialiasing)" checked={prefs.graphics.antialias} onChange={antialias => graphic({ antialias })} description="Turn off to reduce rendering cost. The viewport refreshes when this changes."/>
        <Toggle id="graphics:textures" label="Load and render textures" checked={prefs.graphics.textures} onChange={textures => graphic({ textures })} description="Turn off for simpler shaded surfaces and fewer image uploads."/>
        <Toggle id="graphics:lighting" label="Lighting and reflections" checked={prefs.graphics.lighting} onChange={lighting => graphic({ lighting })} description="Shaded editor lighting and animation preview environment reflections."/>
        <Toggle id="graphics:particles" label="Particle and ribbon effects" checked={prefs.graphics.particles} onChange={particles => graphic({ particles })} description="Applies to game preview effects."/>
        <Toggle id="graphics:pause-when-hidden" label="Pause rendering and animation when the window is hidden" checked={prefs.graphics.pauseWhenHidden} onChange={pauseWhenHidden => graphic({ pauseWhenHidden })}/>
      </div>}
      {tab === 'capture' && <div className="settings-page">
        <h3>Recording and screenshots</h3><p>Capture the model with its current lighting and background. Resolution follows the viewport aspect ratio.</p>
        <label className="settings-select"><span>Recording frame rate</span><select aria-label="Recording frame rate" value={prefs.capture.fps} onChange={event => commit({capture:{...prefs.capture,fps:Number(event.target.value)}})}>{[10,15,20,24,25,30,50].map(fps=><option key={fps} value={fps}>{fps} FPS</option>)}</select></label>
        <div className="settings-graphics-grid">{[['recordingQuality','Recording quality'],['screenshotQuality','Screenshot quality']].map(([key,label])=><label className="settings-select" key={key}><span>{label}</span><select aria-label={label} value={prefs.capture[key]} onChange={event=>commit({capture:{...prefs.capture,[key]:event.target.value}})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>)}</div>
        <p>GIF: Low 720 px / 128 colors without dithering · Medium 1280 px / 256 colors · High 1920 px / 256 colors. Medium and High use Sierra dithering.</p>
        <p>PNG screenshots: Low 1280 px · Medium 1920 px · High 3840 px. PNG preserves full color without compression loss.</p>
        <p className="settings-hint">GIF uses a shared palette with up to 256 entries, including transparency for optimization. Higher quality needs more processing. Recording preserves elapsed time when capture frames are skipped and uses temporary disk space.</p>
        <Toggle id="capture:pressed-keys" label="Show pressed keys" checked={prefs.showPressedKeys} onChange={showPressedKeys=>commit({showPressedKeys})} description="Display keyboard and mouse combinations for tutorials. Text entered in fields is not shown."/>
        <button onClick={()=>commit({capture:{fps:30,recordingQuality:'medium',screenshotQuality:'medium'}})}>Restore capture defaults</button>
      </div>}
      {tab === 'visuals' && <div className="settings-page settings-appearance-page">
        <nav className="settings-appearance-nav" aria-label="Appearance pages">{APPEARANCE_PAGES.map(page => <button key={page} type="button" aria-pressed={page === appearancePage} onClick={() => setAppearancePage(page)}>{page}</button>)}</nav>
        <div className="settings-appearance-detail"><AppearancePage.Provider value={appearancePage}>
        <AppearanceSection title="Presets">
        <label className="settings-select"><span>Appearance preset</span><select aria-label="Viewport appearance preset" value={prefs.viewportPreset} onChange={event => applyViewportPreset(event.target.value)}>
          {Object.values(BUILT_IN_VIEWPORT_PRESETS).map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          {prefs.viewportPreset === 'custom' && <option value="custom">Unsaved custom appearance</option>}
          {prefs.viewportPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select></label>
        <div className="settings-inline-actions"><input aria-label="Custom viewport preset name" value={presetName} maxLength={80} placeholder="Custom preset name" onChange={event => setPresetName(event.target.value)}/><button onClick={saveViewportPreset}>Save as custom preset</button>{String(prefs.viewportPreset).startsWith('custom-') && <button onClick={deleteViewportPreset}>Delete selected preset</button>}</div>
        </AppearanceSection>
        <AppearanceSection title="Interface" palette={palette('Interface', { theme: prefs.theme, accent: prefs.accent }, preset => ({ theme: preset.theme, accent: APPLICATION_THEMES[preset.theme].accent }), change => commit({ ...change, viewportPreset: 'custom' }))}>
        <label className="settings-color">UI accent <input type="color" aria-label="UI accent" value={prefs.accent} onChange={event=>commit({accent:event.target.value})}/><code>{prefs.accent}</code></label>
        <div className="settings-graphics-grid"><Numeric id="appearance:panel-width" label="Toolbox width" value={prefs.panelWidth} min={PANEL_WIDTH_MIN} max={PANEL_WIDTH_MAX} unit="px" onChange={panelWidth=>commit({panelWidth})}/><Numeric id="appearance:panel-scale" label="Toolbox scale" value={prefs.panelScale} min={1} max={1.75} step={.05} unit="×" onChange={panelScale=>commit({panelScale})}/></div>
        </AppearanceSection>
        <AppearanceSection title="Controllers" palette={partPalette('controllers', 'Controllers')}>
          <ControllerPreview appearance={prefs.viewportAppearance.controllers}/>
          <div className="settings-controller-shapes">{[['shape', 'Handle shape'], ['bodyShape', 'Body shape'], ['bendShape', 'Bend shape']].map(([key, label]) => <label className="settings-select" key={key}><span>{label}</span><select aria-label={label} value={prefs.viewportAppearance.controllers[key]} onChange={event => viewportPart('controllers', { [key]: event.target.value })}>{CONTROLLER_SHAPES.map(shape => <option key={shape} value={shape}>{shape[0].toUpperCase() + shape.slice(1)}</option>)}</select></label>)}</div>
          <label className="settings-select"><span>Pin button</span><select aria-label="Pin button style" value={prefs.viewportAppearance.controllers.pinStyle} onChange={event => viewportPart('controllers', { pinStyle: event.target.value })}>{PIN_STYLES.map((style, index) => <option key={style} value={style}>{['Icon and label', 'Square icon', 'Round icon'][index]}</option>)}</select></label>
          <Toggle label="Show body-part symbols" checked={prefs.viewportAppearance.controllers.symbols} onChange={symbols => viewportPart('controllers', { symbols })}/>
          <Numeric label="Controller size" min={12} max={24} unit="px" value={prefs.viewportAppearance.controllers.size} onChange={size => viewportPart('controllers', { size })}/>
          <AppearanceColors prefix="Controller" colors={[['color', 'Handle'], ['selected', 'Selected'], ['pinned', 'Pinned'], ['background', 'Background'], ['skeleton', 'Pose skeleton'], ['outline', 'Outline'], ['axisX', 'X axis'], ['axisY', 'Y axis'], ['axisZ', 'Z axis']]} value={prefs.viewportAppearance.controllers} onChange={change => viewportPart('controllers', change)}/>
        </AppearanceSection>
        <AppearanceSection title="Folders & lists" palette={palette('Folders & lists', prefs.viewportAppearance.tree, preset => colorValues(preset.appearance.tree), change => viewportPart('tree', change))}>
          <AppearanceColors colors={TREE_COLORS} value={prefs.viewportAppearance.tree} prefix="Tree" onChange={change => viewportPart('tree', change)}/>
          <Numeric label="List font size" id="appearance:tree:font-size" min={10} max={20} unit="px" value={prefs.viewportAppearance.tree.fontSize} onChange={fontSize => viewportPart('tree', { fontSize })}/>
        </AppearanceSection>
        <AppearanceSection title="Node colors" palette={palette('Node colors', prefs.viewportAppearance.tree.nodes, preset => preset.appearance.tree.nodes, change => treePart('nodes', change))}>
          <AppearanceColors colors={NODE_COLORS} value={prefs.viewportAppearance.tree.nodes} prefix="Node" onChange={change => treePart('nodes', change)}/>
        </AppearanceSection>
        <AppearanceSection title="Sound folder colors" palette={palette('Sound folder colors', prefs.viewportAppearance.tree.folders, preset => preset.appearance.tree.folders, change => treePart('folders', change))}>
          <AppearanceColors colors={FOLDER_COLORS} value={prefs.viewportAppearance.tree.folders} prefix="Folder" onChange={change => treePart('folders', change)}/>
        </AppearanceSection>
        <AppearanceSection title="Viewport background" palette={partPalette('background', 'Viewport background')}>
        <div className="settings-inline-actions" role="group" aria-label="Viewport background type"><span>Type:</span><button aria-pressed={prefs.viewportAppearance.background.type === 'color'} onClick={() => viewportPart('background',{type:'color'})}>Solid color</button><button aria-pressed={prefs.viewportAppearance.background.type === 'image'} disabled={!prefs.viewportAppearance.background.imageData} onClick={() => viewportPart('background',{type:'image'})}>Image</button></div>
        <label className="settings-color">Fallback color <input type="color" aria-label="Viewport background color" value={prefs.viewportAppearance.background.color} onChange={event => viewportPart('background',{color:event.target.value})}/><code>{prefs.viewportAppearance.background.color}</code></label>
        <input ref={viewportImageInput} hidden type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={event => { loadViewportBackground(event.target.files[0]); event.target.value=''; }}/>
        <div className="settings-inline-actions"><button onClick={() => viewportImageInput.current?.click()}>Choose background image…</button>{prefs.viewportAppearance.background.imageData && <><span className="settings-muted" title={prefs.viewportAppearance.background.imageName}>{prefs.viewportAppearance.background.imageName || 'Saved image'}</span><button onClick={() => viewportPart('background',{type:'color',imageData:'',imageName:''})}>Remove image</button></>}</div>
        {prefs.viewportAppearance.background.imageData && <div className="settings-graphics-grid"><label className="settings-select"><span>Image display</span><select aria-label="Background image display mode" value={prefs.viewportAppearance.background.display} onChange={event => viewportPart('background',{display:event.target.value})}><option value="fit">Fit</option><option value="fill">Fill</option><option value="stretch">Stretch</option><option value="center">Center / actual size</option></select></label><Numeric id="appearance:background:opacity" label="Image opacity" value={prefs.viewportAppearance.background.opacity} min={0} max={1} step={.05} onChange={opacity => viewportPart('background',{opacity})}/></div>}
        </AppearanceSection>
        <AppearanceSection title="Highlight Geoset" palette={partPalette('geosetHighlight', 'Highlight Geoset')}>
          <label className="settings-color"><span>Color</span><input type="color" aria-label="Highlight Geoset color" value={prefs.viewportAppearance.geosetHighlight.color} onChange={event => viewportPart('geosetHighlight', { color: event.target.value })}/><code>{prefs.viewportAppearance.geosetHighlight.color}</code></label>
          <label className="settings-select"><span>Type</span><select aria-label="Highlight Geoset type" value={prefs.viewportAppearance.geosetHighlight.type} onChange={event => viewportPart('geosetHighlight', { type: event.target.value })}><option value="wire-vertices">Wireframe with vertices</option><option value="wire">Wireframe without vertices</option><option value="fill">Filled geoset</option></select></label>
          <label><input type="checkbox" checked={prefs.viewportAppearance.geosetHighlight.viaView} disabled={!prefs.viewportAppearance.geosetHighlight.viaSelection} onChange={event => viewportPart('geosetHighlight', { viaView: event.target.checked })}/>Highlight via View</label>
          <label><input type="checkbox" checked={prefs.viewportAppearance.geosetHighlight.viaSelection} disabled={!prefs.viewportAppearance.geosetHighlight.viaView} onChange={event => viewportPart('geosetHighlight', { viaSelection: event.target.checked })}/>Highlight via Selection</label>
        </AppearanceSection>
        <div className="settings-appearance-grid">
          <AppearanceSection title="Wire style">
            <label className="settings-select" title={WIRE_MODE_TIP}><span>Wire style</span><select aria-label="Wire style" title={WIRE_MODE_TIP} value={prefs.viewportAppearance.wireMode} onChange={event => viewport({ wireMode: event.target.value })}><option value="all">All edges</option><option value="hidden-line">Hidden-line</option></select></label>
            <Numeric id="appearance:size:occludedOpacity" label="Hidden wire intensity" value={prefs.visuals.occludedOpacity} min={0} max={1} step={0.05} onChange={occludedOpacity => visual({ occludedOpacity })}/>
          </AppearanceSection>
          {[['selectedGeoset','Selected geoset'],['otherGeoset','Other visible geosets']].map(([part,label]) => <AppearanceSection key={part} title={label} palette={partPalette(part, label)}>
            <label className="settings-color"><span>Wire color</span><input type="color" aria-label={`${label} wire color`} value={prefs.viewportAppearance[part].color} onChange={event => viewportPart(part,{color:event.target.value})}/><code>{prefs.viewportAppearance[part].color}</code></label>
            <Numeric id={`appearance:${part}:thickness`} label="Wire thickness" value={prefs.viewportAppearance[part].thickness} min={.5} max={4} step={.25} unit="px" onChange={thickness => viewportPart(part,{thickness})}/>
            <Numeric id={`appearance:${part}:opacity`} label="Wire opacity" value={prefs.viewportAppearance[part].opacity} min={0} max={1} step={.05} onChange={opacity => viewportPart(part,{opacity})}/>
            <label className="settings-select"><span>Wire style</span><select aria-label={`${label} wire style`} value={prefs.viewportAppearance[part].style} onChange={event => viewportPart(part,{style:event.target.value})}><option value="solid">Solid</option><option value="dotted">Dotted</option><option value="dashed">Striped</option></select></label>
            {prefs.viewportAppearance[part].style !== 'solid' && <Numeric id={`appearance:${part}:spacing`} label="Line spacing" value={prefs.viewportAppearance[part].spacing} min={2} max={32} step={1} unit="px" onChange={spacing => viewportPart(part,{spacing})}/>}<WireLinePreview wire={prefs.viewportAppearance[part]} background={prefs.viewportAppearance.background.color} label={label}/>
          </AppearanceSection>)}
          <AppearanceSection title="Hidden vertices">
            <Toggle id="appearance:xray-vertices" label="Show occluded vertices in General View (X-Ray)" checked={prefs.viewportAppearance.xrayVertices} onChange={xrayVertices => viewport({xrayVertices})} description="Off by default: General View hides vertices behind model geometry. Wireframe View remains see-through."/>
          </AppearanceSection>
          {[['selectedVertex','Selected vertices'],['unselectedVertex','Unselected vertices']].map(([part,label]) => <AppearanceSection key={part} title={label} palette={partPalette(part, label)}>
            <label className="settings-color"><span>Marker color</span><input type="color" aria-label={`${label} color`} value={prefs.viewportAppearance[part].color} onChange={event => viewportPart(part,{color:event.target.value})}/><code>{prefs.viewportAppearance[part].color}</code></label>
            <Numeric id={`appearance:${part}:size`} label="Marker size" value={prefs.viewportAppearance[part].size} min={2} max={16} step={1} unit="px" onChange={size => viewportPart(part,{size})}/>
            <label className="settings-select"><span>Marker style</span><select aria-label={`${label} marker style`} value={prefs.viewportAppearance[part].style} onChange={event => viewportPart(part,{style:event.target.value})}><option value="square">Square</option><option value="circle">Circle</option><option value="diamond">Diamond</option></select></label>
            <VertexMarkerPreview marker={prefs.viewportAppearance[part]} background={prefs.viewportAppearance.background.color} label={label}/>
          </AppearanceSection>)}
        </div>
        <AppearanceSection title="Quadview" palette={palette('Quadview', { ...colorValues(prefs.viewportAppearance.quadView.grid), background: prefs.viewportAppearance.quadView.background.color }, preset => ({ ...colorValues(preset.appearance.quadView.grid), background: preset.appearance.quadView.background.color }), ({ background, ...colors }) => viewportPart('quadView', { background: { ...prefs.viewportAppearance.quadView.background, color: background }, grid: { ...prefs.viewportAppearance.quadView.grid, ...colors } }))}>
          <Toggle id="appearance:quadview:grid" label="Quadview grid" checked={prefs.viewportAppearance.quadView.grid.enabled} onChange={enabled => quadPart('grid', {enabled})}/>
          <div className="settings-color-grid">
            <label className="settings-color"><span>Background</span><input type="color" aria-label="Quadview background color" value={prefs.viewportAppearance.quadView.background.color} onChange={event => quadPart('background', {color:event.target.value})}/></label>
            {[['minorColor','Minor grid'],['majorColor','Major grid'],['axisColor','Origin axes']].map(([key,label]) => <label className="settings-color" key={key}><span>{label}</span><input type="color" aria-label={`Quadview ${label.toLowerCase()} color`} value={prefs.viewportAppearance.quadView.grid[key]} onChange={event => quadPart('grid', {[key]:event.target.value})}/></label>)}
          </div>
          <div className="settings-graphics-grid">
            <Numeric id="appearance:quadview:spacing" label="Quadview minimum cell size" value={prefs.viewportAppearance.quadView.grid.spacing} min={12} max={96} unit="px" onChange={spacing => quadPart('grid', {spacing})}/>
            <Numeric id="appearance:quadview:major" label="Quadview major line every" value={prefs.viewportAppearance.quadView.grid.majorEvery} min={2} max={10} unit="cells" onChange={majorEvery => quadPart('grid', {majorEvery})}/>
            <Numeric id="appearance:quadview:thickness" label="Quadview line thickness" value={prefs.viewportAppearance.quadView.grid.thickness} min={.5} max={4} step={.25} unit="px" onChange={thickness => quadPart('grid', {thickness})}/>
            <Numeric id="appearance:quadview:opacity" label="Quadview minor opacity" value={prefs.viewportAppearance.quadView.grid.opacity} min={0} max={1} step={.05} onChange={opacity => quadPart('grid', {opacity})}/>
            <Numeric id="appearance:quadview:major-opacity" label="Quadview major opacity" value={prefs.viewportAppearance.quadView.grid.majorOpacity} min={0} max={1} step={.05} onChange={majorOpacity => quadPart('grid', {majorOpacity})}/>
          </div>
          <input ref={quadImageInput} hidden type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={event => { loadViewportBackground(event.target.files[0], true); event.target.value=''; }}/>
          <div className="settings-inline-actions"><button onClick={() => quadImageInput.current?.click()}>Choose Quadview background image…</button>{prefs.viewportAppearance.quadView.background.imageData && <button onClick={() => quadPart('background', {type:'color',imageData:'',imageName:''})}>Remove Quadview image</button>}</div>
          {prefs.viewportAppearance.quadView.background.imageData && <div className="settings-graphics-grid"><label>Quadview image display <select aria-label="Quadview image display" value={prefs.viewportAppearance.quadView.background.display} onChange={event => quadPart('background', {display:event.target.value})}>{['fit','fill','stretch','center'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><Numeric id="appearance:quadview:image-opacity" label="Quadview image opacity" value={prefs.viewportAppearance.quadView.background.opacity} min={0} max={1} step={.05} onChange={opacity => quadPart('background', {opacity})}/></div>}
        </AppearanceSection>
        <AppearanceSection title="Editor helpers" palette={palette('Editor helpers', prefs.visuals, helpersFor, visual)}><div className="settings-color-grid">{APPEARANCE_HELPER_COLORS.map(([key, label]) => <label className="settings-color" key={key}><span>{label}</span><input data-hotkey={`appearance:color:${key}`} type="color" aria-label={`${label} color`} value={prefs.visuals[key]} onChange={event => visual({ [key]: event.target.value })}/><code>{prefs.visuals[key]}</code></label>)}</div>
        <label>Emitter marker<select aria-label="Emitter marker" value={prefs.emitterMarker} onChange={event=>commit({emitterMarker:event.target.value})}><option value="pentagram">Pentagram in a circle</option><option value="tetrahedron">Normal node</option><option value="cube">Cube</option></select></label>
        <div className="settings-graphics-grid">{[['keyframeSize', 'Keyframe marker size', 4, 24, 1, 'px'], ['helperSize', 'Node marker size', 3, 18, 1, 'px']].map(([key, label, min, max, step, unit]) => <Numeric key={key} id={`appearance:size:${key}`} label={label} value={prefs.visuals[key]} min={min} max={max} step={step} unit={unit} onChange={value => visual({ [key]: value })}/>)}</div>
        </AppearanceSection>
        <AppearanceSection title="Citadel Paint" palette={palette('Citadel Paint', prefs.citadelPaint, paintFor, change => commit({ citadelPaint: { ...prefs.citadelPaint, ...change } }))}><div className="settings-appearance-grid">
          {[['brushTipLight','Brush tips — light theme'],['brushTipDark','Brush tips — dark themes'],['brushCursor','Brush cursor'],['geosetSelection','Geoset selection'],['geosetBorder','Geoset border'],['lampSelection','Selected lamp']].map(([key,label])=><label className="settings-color" key={key}><span>{label}</span><input type="color" aria-label={'Citadel '+label} value={prefs.citadelPaint[key]} onChange={e=>commit({citadelPaint:{...prefs.citadelPaint,[key]:e.target.value}})}/></label>)}
          <Numeric label="Citadel border thickness" id="citadel:borderThickness" min={1} max={6} value={prefs.citadelPaint.borderThickness} onChange={borderThickness=>commit({citadelPaint:{...prefs.citadelPaint,borderThickness}})}/>
          <button onClick={()=>commit({citadelPaint:DEFAULT_PAINT_APPEARANCE})}>Reset Citadel colours</button>
        </div></AppearanceSection>
        <AppearanceSection title="Bones & skeleton" palette={partPalette('bones', 'Bones & skeleton')}>
          <BonePreview bones={prefs.viewportAppearance.bones} background={prefs.viewportAppearance.background.color}/>
          <label className="settings-select" title={BONE_STYLE_TIP}><span>Bone style</span><select aria-label="Bone style" title={BONE_STYLE_TIP} value={prefs.viewportAppearance.bones.style} onChange={event => viewportPart('bones', { style: event.target.value })}>{BONE_STYLE_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="settings-select" title={BONE_CONNECTOR_TIP}><span>Skeleton style</span><select aria-label="Skeleton style" title={BONE_CONNECTOR_TIP} value={prefs.viewportAppearance.bones.connector} onChange={event => viewportPart('bones', { connector: event.target.value })}><option value="shaded">Shaded</option><option value="tapered">Tapered</option><option value="cone">Cone</option><option value="stick">Stick</option></select></label>
          <AppearanceColors colors={BONE_COLOR_LABELS} value={prefs.viewportAppearance.bones} prefix="Bones" onChange={change => viewportPart('bones', change)}/>
          <div className="settings-graphics-grid"><Numeric id="appearance:bones:thickness" label="Connector thickness" value={prefs.viewportAppearance.bones.thickness} min={1} max={12} unit="px" onChange={thickness => viewportPart('bones', { thickness })}/><Numeric id="appearance:bones:highlight" label="Chain highlight thickness" value={prefs.viewportAppearance.bones.highlightThickness} min={1} max={16} unit="px" onChange={highlightThickness => viewportPart('bones', { highlightThickness })}/></div>
          <button onClick={() => viewport({ bones: (BUILT_IN_VIEWPORT_PRESETS[prefs.viewportPreset] || Object.values(BUILT_IN_VIEWPORT_PRESETS).find(preset => preset.theme === prefs.theme)).appearance.bones })}>Reset bones and skeleton</button>
        </AppearanceSection>
        <AppearanceSection title="Bone influence">
          <p className="settings-hint">{BONE_INFLUENCE_TIP}</p>
          <Numeric id="appearance:influence:opacity" label="Ghost opacity" value={Math.round(prefs.viewportAppearance.boneInfluence.opacity * 100)} min={5} max={95} unit="%" onChange={opacity => viewportPart('boneInfluence', { opacity: opacity / 100 })}/>
          <AppearanceColors colors={INFLUENCE_COLOR_LABELS} value={prefs.viewportAppearance.boneInfluence} prefix="Bone influence" onChange={change => viewportPart('boneInfluence', change)}/>
          <button onClick={() => viewport({ boneInfluence: DEFAULT_BONE_INFLUENCE })}>Reset Bone influence</button>
        </AppearanceSection>
        </AppearancePage.Provider>
        <button data-hotkey="appearance:reset" onClick={() => commit({ theme: 'light', accent: APPLICATION_THEMES.light.accent, viewportPreset: 'mdlvis-vanilla', viewportAppearance: BUILT_IN_VIEWPORT_PRESETS['mdlvis-vanilla'].appearance, visuals: DEFAULT_VISUALS })}>Restore Lordaeron and helper defaults</button>
      </div></div>}
      {tab === 'grid' && <div className="settings-page">
        <h3>XYZ grid</h3><p>Configure the grid shared by the 3D viewport and animation preview. Use Display → Grid to show or hide it.</p>
        <div className="settings-inline-actions"><span>Preset:</span>{[['classic', 'Classic'], ['fine', 'Fine'], ['world', 'Large model'], ['xyz', 'Three planes']].map(([key, label]) => <button key={key} data-hotkey={`grid:preset:${key}`} onClick={() => grid(GRID_PRESETS[key])}>{label}</button>)}</div>
        <div className="settings-graphics-grid"><Numeric id="grid:spacing" label="Minor line spacing" value={prefs.grid.spacing} min={0.1} max={4096} step={0.1} unit=" units" onChange={spacing => grid({ spacing })}/><Numeric id="grid:major-every" label="Minor divisions per major line" value={prefs.grid.majorEvery} min={2} max={32} onChange={majorEvery => grid({ majorEvery })}/><Numeric id="grid:extent" label="Extent from origin" value={prefs.grid.extent} min={1} max={16384} unit=" units" onChange={extent => grid({ extent })}/><Numeric id="grid:opacity" label="Minor grid opacity" value={prefs.grid.opacity} min={0} max={1} step={0.05} onChange={opacity => grid({ opacity })}/><Numeric id="grid:major-opacity" label="Major grid opacity" value={prefs.grid.majorOpacity} min={0} max={1} step={0.05} onChange={majorOpacity => grid({ majorOpacity })}/></div>
        <Toggle id="grid:small" label="Small grid" checked={prefs.grid.small} onChange={small => grid({ small })} description="Show the fine lines. The coarse grid remains visible."/>
        <div className="settings-plane-choices"><span>Grid planes:</span>{['xz', 'yz', 'xy'].map(key => <label key={key}><input data-hotkey={`grid:plane:${key}`} aria-label={`Grid ${key.toUpperCase()} plane`} type="checkbox" checked={prefs.grid.planes[key]} onChange={event => grid({ planes: { ...prefs.grid.planes, [key]: event.target.checked } })}/>{key.toUpperCase()}</label>)}</div>
        <div className="settings-plane-choices"><span>Axes:</span>{['x', 'y', 'z'].map(key => <label key={key}><input data-hotkey={`grid:axis:${key}`} aria-label={`Grid ${key.toUpperCase()} axis`} type="checkbox" checked={prefs.grid.axes[key]} onChange={event => grid({ axes: { ...prefs.grid.axes, [key]: event.target.checked } })}/>{key.toUpperCase()}</label>)}</div>
        <div className="settings-color-grid">{VISUAL_COLORS.filter(([key]) => key.startsWith('grid') || key.startsWith('axis')).map(([key, label]) => <label className="settings-color" key={key}><span>{label}</span><input data-hotkey={`grid:color:${key}`} type="color" aria-label={`${label} color`} value={prefs.visuals[key]} onChange={event => visual({ [key]: event.target.value })}/><code>{prefs.visuals[key]}</code></label>)}</div>
      </div>}
      {tab === 'configuration' && <div className="settings-page">        <h3>Updates</h3>
        <Toggle id="updates:startup" label="Auto update" checked={prefs.checkUpdatesOnStartup} onChange={checkUpdatesOnStartup => commit({ checkUpdatesOnStartup })} description="Search for updates when MDLxL starts. Ask before downloading or installing."/>
        <button data-hotkey="updates:check" disabled={!onCheckUpdates || ['checking','downloading','ready','reverting'].includes(updateStatus?.state)} onClick={onCheckUpdates}>Search for updates</button>
        <button data-hotkey="updates:revert" disabled={!onRevertUpdate || !updateStatus?.previousVersion || ['checking','downloading','ready','reverting'].includes(updateStatus?.state)} onClick={onRevertUpdate}>Revert to last version</button>
        {updateStatus?.previousVersion && <small>{`Previous version: ${updateStatus.previousVersion}`}</small>}
        <p className="settings-hint" role="status">{updateStatusText(updateStatus)}</p>
        {updateStatus?.error && updateStatus.state !== 'error' && <p role="alert">{updateStatus.error}</p>}
        <h3>File icons</h3><p>The icon Explorer shows on MDL, MDX and Paint Project files. Windows uses it once MDLxL is the default program for them.</p>
        <div className="settings-inline-actions" role="radiogroup" aria-label="File icon">{[['page', 'Helmet on a page', 'file-page.ico'], ['dark-page', 'Dark page', 'file-dark-page.ico'], ['tile', 'Dark tile', 'file-tile.ico'], ['program', 'Program icon', 'MDLxL.ico']].map(([key, label, file]) => <button key={key} data-hotkey={`file-icon:${key}`} role="radio" aria-checked={prefs.fileIcon === key} aria-pressed={prefs.fileIcon === key} title={key === 'program' ? 'Files show the same helmet icon as MDLxL.exe.' : `Files show the ${label.toLowerCase()} icon, so they look different from MDLxL.exe.`} className="settings-file-icon" onClick={() => commit({ fileIcon: key })}><img src={`./branding/${file}`} alt=""/>{label}</button>)}</div>
        <button data-hotkey="file-icon:default-apps" disabled={!window.desktop?.openDefaultApps} title="Opens Windows Default apps, where you can choose MDLxL for .mdl and .mdx files." onClick={() => window.desktop.openDefaultApps()}>Make MDLxL the default program…</button>
<h3>Reusable configuration</h3><p>Export interface colors, toolbox size, input settings, graphics and hotkeys. Import replaces these preferences together; machine paths and model data stay local.</p><input ref={configInput} hidden type="file" accept=".json,application/json" onChange={event=>{loadConfiguration(event.target.files[0]);event.target.value='';}}/><button onClick={exportSettings}>Export configuration…</button><button onClick={()=>configInput.current.click()}>Import configuration…</button><h3>New model</h3><label>Starter format <select aria-label="New model version" value={prefs.newModelVersion} onChange={event=>commit({newModelVersion:Number(event.target.value)})}><option value={800}>MDX800 · Classic</option><option value={1000}>MDX1000 · Reforged</option></select></label><p>New creates Bone_Root and a 64-unit cube with eight vertices and twelve triangles.</p></div>}
      {tab === 'gameData' && <div className="settings-page game-data-page">
        <h3>Warcraft III installation</h3>
        <p>Choose the main Warcraft III installation folder once. MdlVis saves the location in its app profile, then uses it automatically when a model refers to native Warcraft textures.</p>
        {gameDataPath ? <p className="game-data-path"><strong>Saved folder:</strong> <code>{gameDataPath}</code></p> : <p className="settings-hint">Warcraft III is detected automatically when native textures are needed. The detected installation and textures are cached for later launches.</p>}
        <div className="settings-inline-actions"><button data-hotkey="game-data:choose" disabled={!onChooseGameData} onClick={onChooseGameData}>{gameDataPath ? 'Choose a different Warcraft III installation…' : 'Choose Warcraft III installation…'}</button>{gameDataPath && <button data-hotkey="game-data:clear" disabled={!onClearGameData} onClick={onClearGameData}>Forget saved folder</button>}</div>
        <h3>Custom game archives</h3>
        <p className="settings-hint">Add your own CASC storage or MPQ files for a custom Warcraft III setup. Custom archives take priority over installed game data.</p>
        <div className="settings-inline-actions"><button data-hotkey="game-data:add-casc" disabled={!onAddGameDataSource || gameDataBusy} onClick={()=>changeGameDataSource(()=>onAddGameDataSource('casc'))}>Add CASC folder…</button><button data-hotkey="game-data:add-mpq" disabled={!onAddGameDataSource || gameDataBusy} onClick={()=>changeGameDataSource(()=>onAddGameDataSource('mpq'))}>Add MPQ files…</button></div>
        {gameDataSources.map(source=><div className="game-data-path" key={source.path}><strong>{source.kind.toUpperCase()}: </strong><code>{source.path}</code> <button aria-label={`Remove ${source.path}`} disabled={!onRemoveGameDataSource || gameDataBusy} onClick={()=>changeGameDataSource(()=>onRemoveGameDataSource(source.path))}>Remove</button></div>)}
        <p className="settings-hint">For CASC, select the storage folder containing .build.info and Data. For MPQ, select one or more .mpq files. These choices are saved in the app profile.</p>
        <AssetPreload modelPath={modelPath}/>
      </div>}
      <div className="settings-message" role="status" aria-live="polite">{message}</div>
    </div><footer><span>Changes apply immediately.</span><button data-hotkey="done" onClick={onClose}>Done</button></footer>
  </section></div>;
}
