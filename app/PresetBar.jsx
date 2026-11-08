import React, { useRef, useState } from 'react';
import { version } from '../package.json';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import { activePreset, applyPreset, captureCustom, CUSTOM_PRESET, deletePreset, listPresets, loadPreset, MAX_PRESET_FILE_BYTES, parsePresetFile, presetDomainLabel, presetRestoreQuestion, PRESET_EXTENSION, restoreCustom, restoreDomain, sanitizePresetName, savePreset, serializePreset } from '../src/settings-presets.js';
import './preset-bar.css';

const UNSAVED_OPTION = 'unsaved';
const NO_ACTIONS = [];
// For this run only, per domain: the Custom state left behind, and the preset last picked.
const unsavedCustom = new Map(), lastChosen = new Map();
const SELECT_TIP = 'Picks a set of the settings on this page. Changing any of them makes this Custom.';
// Bindable, but they take no default letter: the defaults stay as they were.
const hotkey = (domain, part) => ({ 'data-hotkey': `preset:${domain}:${part}`, 'data-hotkey-manual': '' });

async function writePresetFile(name, text) {
  if (globalThis.desktop?.presetSaveFile) return !!await globalThis.desktop.presetSaveFile({ name, text });
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
  link.href = url; link.download = `${name.replace(/[<>:"/\\|?*]/g, '_')}.${PRESET_EXTENSION}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** The row Save as… reveals: a name, then either keep it in Saved or write it to a file. */
export function PresetNameRow({ domain, name, onName, onSave, onSaveFile, onClose }) {
  return <form className="preset-bar-row" onSubmit={event => { event.preventDefault(); onSave(); }}>
    <input {...hotkey(domain, 'name')} aria-label="Preset name" title="A name for this preset." placeholder="Preset name" maxLength={80} autoFocus value={name} onChange={event => onName(event.target.value)}/>
    <button type="submit" {...hotkey(domain, 'save')} title="Adds the current settings to Saved." disabled={!sanitizePresetName(name)}>Save</button>
    <button type="button" {...hotkey(domain, 'save-file')} title="Writes the current settings to a file you can share." onClick={onSaveFile}>Save to file…</button>
    <button type="button" {...hotkey(domain, 'close')} title="Closes this row." onClick={onClose}>Cancel</button>
  </form>;
}

/**
 * Preset controls for one settings page. `commit` is Settings' commit(change); `catalog`
 * is the Hotkeys catalog (hotkeys page only). `onSaveAs` replaces the name row, `onMessage`
 * receives the status line instead of the bar showing it, and `selectLabel` overrides the
 * select's accessible name.
 */
export default function PresetBar({ domain, preferences, commit, catalog = NO_ACTIONS, onSaveAs, onMessage, selectLabel }) {
  const root = useRef(null), fileInput = useRef(null);
  const [naming, setNaming] = useState(false), [confirming, setConfirming] = useState(false), [name, setName] = useState(''), [status, setStatus] = useState('');
  const presets = listPresets(domain, preferences), builtIns = presets.filter(preset => preset.builtIn), saved = presets.filter(preset => !preset.builtIn);
  const active = activePreset(domain, preferences, lastChosen.get(domain)), desktopFiles = !!globalThis.desktop?.presetOpenFile;
  const left = active === CUSTOM_PRESET ? undefined : unsavedCustom.get(domain);
  const showUnsaved = left !== undefined && activePreset(domain, { ...preferences, ...restoreCustom(domain, preferences, left) }) === CUSTOM_PRESET;
  const question = presetRestoreQuestion(domain), label = presetDomainLabel(domain);
  const activeName = presets.find(preset => preset.id === active)?.name || 'Custom';

  const say = text => onMessage ? onMessage(text) : setStatus(text);
  const attempt = action => { try { action(); } catch (error) { say(error.message); } };
  const closeRows = () => { setNaming(false); setConfirming(false); setName(''); };
  const keepCustom = () => { if (active === CUSTOM_PRESET) unsavedCustom.set(domain, captureCustom(domain, preferences)); };
  const use = change => { if (change.presetId) lastChosen.set(domain, change.presetId); else lastChosen.delete(domain); commit(change); say(change.status); };

  const choose = id => attempt(() => {
    if (id === UNSAVED_OPTION) { use(restoreCustom(domain, preferences, unsavedCustom.get(domain))); return; }
    const change = applyPreset(domain, preferences, id);
    keepCustom(); use(change);
  });
  const save = () => attempt(() => { use(savePreset(domain, preferences, name)); closeRows(); });
  const saveFile = async () => {
    const fileName = sanitizePresetName(name) || activeName;
    try { if (await writePresetFile(fileName, serializePreset(domain, preferences, CUSTOM_PRESET, version, { name: fileName }))) { say(`${fileName} saved to file.`); closeRows(); } }
    catch (error) { say(error.message); }
  };
  const loadText = text => attempt(() => {
    const change = loadPreset(preferences, parsePresetFile(text, { expectDomain: domain, catalog }));
    keepCustom(); use(change);
  });
  const load = async () => {
    if (!desktopFiles) { fileInput.current?.click(); return; }
    try { const file = await globalThis.desktop.presetOpenFile(); if (file) loadText(file.text); }
    catch (error) { say(error.message); }
  };
  const loadPicked = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_PRESET_FILE_BYTES) throw Error('This file is too large to be a preset.');
      loadText(await file.text());
    } catch (error) { say(error.message); }
  };
  const restore = () => attempt(() => { const change = restoreDomain(domain, preferences); keepCustom(); use(change); closeRows(); });
  const remove = () => attempt(() => use(deletePreset(domain, preferences, active)));

  useWindowKeyClaim(({ event, localWindow }) => {
    if (event.key !== 'Escape' || !(naming || confirming) || (localWindow && !localWindow.contains(root.current))) return false;
    closeRows(); return true;
  }, 20);

  return <div className="preset-bar" ref={root}>
    <div className="preset-bar-main">
      <label className="preset-bar-field" title={SELECT_TIP}><span>Preset</span>
        <select {...hotkey(domain, 'select')} aria-label={selectLabel || `${label} preset`} title={SELECT_TIP} value={active} onChange={event => choose(event.target.value)}>
          {active === CUSTOM_PRESET && <option value={CUSTOM_PRESET} disabled>Custom</option>}
          <optgroup label="Built-in">{builtIns.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</optgroup>
          {saved.length > 0 && <optgroup label="Saved">{saved.map(preset => <option key={preset.id} value={preset.id} translate="no">{preset.name}</option>)}</optgroup>}
          {showUnsaved && <option value={UNSAVED_OPTION}>Unsaved custom</option>}
        </select>
      </label>
      {saved.some(preset => preset.id === active) && <button type="button" className="preset-bar-delete" {...hotkey(domain, 'delete')} aria-label="Delete this preset" title="Deletes this saved preset. The current settings stay." onClick={remove}>×</button>}
      <button type="button" {...hotkey(domain, 'save-as')} aria-expanded={onSaveAs ? undefined : naming} title="Keeps the current settings under a name, or writes them to a file to share." onClick={() => { if (onSaveAs) onSaveAs(); else { setConfirming(false); setNaming(open => !open); } }}>Save as…</button>
      {onSaveAs && <button type="button" {...hotkey(domain, 'save-file')} title="Writes the current settings to a file you can share." onClick={saveFile}>Save to file…</button>}
      <button type="button" {...hotkey(domain, 'load')} title="Opens a preset file. It is added to Saved and used right away." onClick={load}>Load from…</button>
      <button type="button" {...hotkey(domain, 'restore')} title="Goes back to the default settings on this page." onClick={() => { if (question) { setNaming(false); setConfirming(true); } else restore(); }}>Restore</button>
    </div>
    {!desktopFiles && <input ref={fileInput} className="preset-bar-file" type="file" accept=".mdlxl-preset,.json" aria-label="Preset file" onChange={loadPicked}/>}
    {naming && !onSaveAs && <PresetNameRow domain={domain} name={name} onName={setName} onSave={save} onSaveFile={saveFile} onClose={closeRows}/>}
    {confirming && <div className="preset-bar-row"><span>{question}</span><button type="button" {...hotkey(domain, 'restore-confirm')} onClick={restore}>Restore all defaults</button><button type="button" {...hotkey(domain, 'restore-cancel')} onClick={closeRows}>Cancel</button></div>}
    {!onMessage && status && <div className="preset-bar-status" role="status">{status}</div>}
  </div>;
}
