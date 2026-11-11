import React, { useEffect, useMemo, useRef, useState } from 'react';
import Viewport, { textureFromAsset } from './Viewport.jsx';
import { openDocument, validateModel } from '../src/editor-document.js';
import { HD_UNSUPPORTED_MESSAGE } from '../src/model-version.js';
import { collectPart, partHasGlobalAnimations, partLook, partPathKey, partRgbOptions, partTextureFiles, partTextureIndices, positionPart, previewPart } from '../src/bits-and-parts.js';
import CollectBit from './CollectBit.jsx';
import PartRgb from './PartRgb.jsx';
import { hasDesktop, resolveGameFiles } from './desktop.js';
import './bits-and-parts.css';

function FolderTree({ entries, selected, onSelect, manage, busy }) {
  return <ul>{entries.map(entry => <li key={entry.id}>{entry.type === 'folder' ? <details open>
    <summary>{manage ? <button type="button" className={entry.id === selected ? 'selected' : ''} title={entry.id} disabled={busy} onClick={event => { event.preventDefault(); onSelect(entry); }}>{entry.name}</button> : entry.name}</summary>
    <FolderTree entries={entry.children} selected={selected} onSelect={onSelect} manage={manage} busy={busy}/>
  </details> : <button disabled={busy} className={entry.id === selected ? 'selected' : ''} title={entry.id} onClick={() => onSelect(entry)}>{entry.name}</button>}</li>)}</ul>;
}

const parentFolder = id => id.split('/').slice(0, -1).join('/');
const foldersIn = entries => entries.flatMap(entry => entry.type === 'folder' ? [entry.id, ...foldersIn(entry.children)] : []);

function ManageParts({ bank, busy, onChange }) {
  const [entry, setEntry] = useState(null), [action, setAction] = useState(null), [name, setName] = useState(''), [folder, setFolder] = useState('');
  const start = action => {
    setAction(action);
    setName(action === 'rename' ? entry.name : '');
    setFolder(entry ? action === 'mkdir' && entry.type === 'folder' ? entry.id : parentFolder(entry.id) : '');
  };
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    if (await onChange({ action, id: entry?.id, name, folder })) { setAction(null); setEntry(null); }
  };
  const destinationFolders = ['', ...foldersIn(bank.children)].filter(id => action !== 'move' || entry?.type !== 'folder' || (id !== entry.id && !id.startsWith(entry.id + '/')));
  return <div className="parts-body">
    <aside aria-label="Parts folders and files">
      <button disabled={busy} onClick={() => { setEntry(null); setAction(null); }}>BitsAndParts</button>
      <FolderTree entries={bank.children} selected={entry?.id} onSelect={entry => { setEntry(entry); setAction(null); }} manage busy={busy}/>
    </aside>
    <main className="parts-manage">
      <strong>{entry?.id || 'BitsAndParts'}</strong>
      <div className="parts-bank-tools">
        <button disabled={busy} onClick={() => start('mkdir')}>New folder</button>
        <button disabled={busy || !entry} onClick={() => start('rename')}>Rename</button>
        <button disabled={busy || !entry} onClick={() => start('move')}>Move</button>
        <button disabled={busy || !entry} onClick={() => start('delete')}>Delete</button>
      </div>
      {action && <form key={action} onSubmit={submit} className="parts-manage-form">
        {(action === 'mkdir' || action === 'rename') && <label>Name <input required autoFocus value={name} onChange={event => setName(event.target.value)} disabled={busy}/></label>}
        {(action === 'mkdir' || action === 'move') && <label>Folder <select value={folder} disabled={busy} onChange={event => setFolder(event.target.value)}>{destinationFolders.map(id => <option key={id} value={id}>{id || 'BitsAndParts'}</option>)}</select></label>}
        {action === 'delete' && <span>Move {entry.name} to the Recycle Bin?</span>}
        <button type="button" disabled={busy} onClick={() => setAction(null)}>Cancel</button>
        <button type="submit" disabled={busy || action === 'move' && folder === parentFolder(entry.id)}>{({ mkdir: 'Create folder', rename: 'Save name', move: 'Move here', delete: 'Move to Recycle Bin' })[action]}</button>
      </form>}
    </main>
  </div>;
}

function browserBank(files) {
  const root = { name: 'BitsAndParts', children: [] }, models = new Map(), assets = new Map();
  for (const file of files) {
    const segments = file.webkitRelativePath.split('/');
    if (segments.shift() !== 'BitsAndParts') throw Error('Choose the folder named BitsAndParts.');
    const id = segments.join('/'); assets.set(partPathKey(id), file);
    if (!/\.(mdl|mdx)$/i.test(id)) continue;
    models.set(id, file); let folder = root, prefix = '';
    for (const name of segments.slice(0, -1)) { prefix += (prefix ? '/' : '') + name; let child = folder.children.find(entry => entry.type === 'folder' && entry.name === name); if (!child) folder.children.push(child = { id: prefix, name, type: 'folder', children: [] }); folder = child; }
    folder.children.push({ id, name: file.name, type: 'model' });
  }
  return { ...root, models, assets };
}

async function preparePartAsset(asset, name) {
  const bytes = new Uint8Array(asset.bytes);
  const texture = await textureFromAsset(asset); // Decode before committing, including binary formats.
  texture.dispose();
  if (!bytes.length || bytes.length > 64 * 1024 * 1024) throw Error('Part textures must be smaller than 64 MB.');
  return { name, bytes, source: 'parts' };
}

export default function BitsAndParts({ model, selectionByGeoset, textureAssets = new Map(), teamColor = '#ff0000', onClose, onCommit, onStageReplacement }) {
  const [collection, setCollection] = useState(null);
  const [replacing, setReplacing] = useState(false), [managing, setManaging] = useState(false);
  const [bank, setBank] = useState(null), [part, setPart] = useState(null), [assets, setAssets] = useState(new Map()), [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [missing, setMissing] = useState([]);
  const [channels, setChannels] = useState([null, null, null]);
  const [rgb, setRgb] = useState(0), [globals, setGlobals] = useState(null), [asking, setAsking] = useState(false);
  const generation = useRef(0), picker = useRef(), dialog = useRef();
  const refresh = async (manage = false) => {
    if (!window.desktop?.listParts) return;
    setBusy(true); setError('');
    try { setBank(await window.desktop.listParts(manage)); setManaging(manage); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  const changeEntry = async data => {
    setBusy(true); setError('');
    try {
      await window.desktop.changePartEntry(data);
      setSelected(''); setPart(null); setAssets(new Map());
      setBank(await window.desktop.listParts(true));
      return true;
    } catch (error) { setError(error.message); return false; }
    finally { setBusy(false); }
  };
  useEffect(() => { refresh(); dialog.current?.focus(); return () => { generation.current++; }; }, []);
  const choose = async entry => {
    const request = ++generation.current;
    setSelected(entry.id); setPart(null); setAssets(new Map()); setRgb(0); setChannels([null, null, null]); setGlobals(null); setAsking(false); setMissing([]); setBusy(true); setError('');
    try {
      const record = window.desktop?.readPart ? await window.desktop.readPart(entry.id) : { name: entry.name, bytes: new Uint8Array(await bank.models.get(entry.id).arrayBuffer()) };
      const document = openDocument(record.bytes, record.name);
      if (document.hdViewOnly) throw Error(HD_UNSUPPORTED_MESSAGE);
      if (document.readOnly || validateModel(document.model).some(issue => issue.severity === 'error')) throw Error('This part is unreadable or contains invalid references. Repair it before importing.');
      if (!document.model.Geosets.length) throw Error('This part has no geosets.');
      const names = partTextureIndices(document.model).map(index => document.model.Textures[index]).filter(texture => !texture.ReplaceableId && texture.Image).map(texture => texture.Image);
      let records = [];
      // Without the Bit's path the lookup sees installed game data only, so a
      // hit there marks a native path that is referenced, never copied.
      let native = new Set();
      if (hasDesktop('resolveTextures')) {
        records = await resolveGameFiles(names, record.path);
        native = new Set((await resolveGameFiles(names)).map(found => partPathKey(found.logicalName || found.texturePath || found.name)));
      }
      else for (const name of names) { const relative = entry.id.split('/').slice(0, -1).concat(name.replaceAll('\\', '/')).join('/'), file = bank.assets.get(partPathKey(relative)) || bank.assets.get(partPathKey(name)); if (file) records.push({ name, bytes: new Uint8Array(await file.arrayBuffer()) }); }
      const loaded = new Map();
      for (const record of records) { const name = record.logicalName || record.texturePath || record.name; loaded.set(partPathKey(name), { ...record, name, ...(native.has(partPathKey(name)) ? { native: true } : {}) }); }
      // Existing destination assets can satisfy equivalent dependency records.
      for (const name of names) if (!loaded.has(partPathKey(name)) && textureAssets.has(partPathKey(name))) loaded.set(partPathKey(name), textureAssets.get(partPathKey(name)));
      if (generation.current !== request) return;
      setMissing(names.filter(name => !loaded.has(partPathKey(name)))); setAssets(loaded); setPart({ ...record, model: document.model });
    } catch (error) { if (generation.current === request) setError(error.message); }
    finally { if (generation.current === request) setBusy(false); }
  };
  const rgbOptions = useMemo(() => part ? partRgbOptions(part.model) : [], [part]);
  const hasGlobals = useMemo(() => !!part && partHasGlobalAnimations(part.model), [part]);
  const invalidRgb = channels.some(value => value != null && value !== '' && (!/^\d+$/.test(value) || Number(value) > 255));
  const look = useMemo(() => part ? { ...rgbOptions[rgb], globals: !!globals, channels: channels.map(value => value && /^\d+$/.test(value) && Number(value) <= 255 ? Number(value) / 255 : null) } : null, [part, rgbOptions, rgb, globals, channels]);
  const rgbValues = part && [0, 1, 2].map(axis => {
    const values = new Set(part.model.Geosets.map((_, index) => Math.round((look.colors?.[index]?.[axis] ?? 1) * 255)));
    return values.size === 1 ? [...values][0] : '';
  });
  const preview = useMemo(() => part ? previewPart(partLook(part.model, look)) : null, [part, look]);
  const hasSelection = Object.values(selectionByGeoset || {}).some(ids => ids.length);
  const collect = () => { try { setCollection(collectPart(model, selectionByGeoset)); setError(''); } catch (error) { setError(error.message); } };
  // A Bit with global animations asks once whether to apply them.
  const importPart = async (applyGlobals = globals) => {
    if (!part || busy || invalidRgb) return;
    if (hasGlobals && applyGlobals === null) { setAsking(true); return; }
    setAsking(false); setGlobals(applyGlobals);
    const request = generation.current, chosen = { ...look, globals: !!applyGlobals };
    setBusy(true); setError('');
    try {
      const portable = [];
      for (const { name, asset } of partTextureFiles(model, partLook(part.model, chosen), assets)) portable.push(await preparePartAsset(asset, name));
      if (generation.current !== request) return;
      if (replacing) {
        const source = positionPart(part.model, model, selectionByGeoset);
        await onStageReplacement({ source, look: chosen, assets: portable, replacement: selectionByGeoset, textureAssets: assets });
      } else {
        const result = await onCommit({ source: part.model, look: chosen, assets: portable });
        if (generation.current === request && result !== false) onClose();
      }
    } catch (error) { if (generation.current === request) setError(error.message); }
    finally { if (generation.current === request) setBusy(false); }
  };
  if (collection) return <CollectBit source={collection} textureAssets={textureAssets} teamColor={teamColor} onClose={() => setCollection(null)} onSaved={async entry => { setCollection(null); await refresh(); await choose(entry); }}/>;
  return <div className="parts-overlay"><section data-hotkey-prefix="bits-and-parts" className="parts-dialog" role="dialog" aria-modal="true" aria-label="BitsAndParts" tabIndex={-1} ref={dialog}>
    <header><h2>BitsAndParts</h2><div className="parts-header-actions">
      {managing ? <button disabled={busy} onClick={() => refresh()}>Done</button> : <>
        <button disabled={busy || !window.desktop?.savePart || !hasSelection} onClick={collect}>Collect Bit</button>
        <button disabled={busy || !hasSelection} aria-pressed={replacing} onClick={() => { setReplacing(!replacing); setAsking(false); }}>Replace Part</button>
      </>}
    </div><button onClick={onClose} disabled={busy} data-hotkey="close" aria-label="Close BitsAndParts">✕</button></header>
    {managing ? <ManageParts bank={bank} busy={busy} onChange={changeEntry}/> : <>
    <div className="parts-body"><aside aria-label="Parts folders and files"><div className="parts-bank-tools"><strong>BitsAndParts</strong>{window.desktop?.listParts ? <><button disabled={busy} onClick={() => refresh()}>Refresh</button><button disabled={busy} onClick={() => window.desktop.openPartsFolder().catch(error => setError(error.message))}>Open folder</button>{window.desktop.changePartEntry && <button disabled={busy} onClick={() => refresh(true)}>Manage</button>}</> : <button onClick={() => picker.current.click()}>Choose folder</button>}</div>
      {bank?.children.length ? <FolderTree entries={bank.children} selected={selected} onSelect={choose} busy={busy}/> : <p>Store MDL and MDX parts here. Nested folders such as helms/horns stay organized.</p>}
      {bank?.directory && <small className="parts-directory" title={bank.directory}>{bank.directory}</small>}
      <input hidden ref={picker} type="file" webkitdirectory="" multiple onChange={event => { try { setBank(browserBank([...event.target.files])); setError(''); } catch (error) { setError(error.message); } event.target.value = ''; }}/>
    </aside><main><div className="parts-preview">{preview ? <Viewport key="source" presentation="preview" model={preview} revision={0} textureAssets={assets} teamColor={teamColor} mode="textured" view="perspective" cameraMode="rotate" showGrid={false} showSkeleton={false} showVertices={false} overlays={{}} selectedGeoset={-1} sequenceIndex={-1} time={0} playing={false} shaded/> : <p>{busy ? 'Loading preview…' : 'Select a part to preview it.'}</p>}
    </div>
      {part && <><strong className="parts-filename">{part.name} · {part.model.Geosets.length} geosets</strong>{!replacing && <p className="parts-note">Import the whole part at its original coordinates and scale, attached to DummyBone. Source rig motion is not imported.</p>}
      <PartRgb options={rgbOptions} value={rgb} onChange={value => { setRgb(value); setChannels([null, null, null]); }} busy={busy}/>
      <div className="parts-color-controls parts-rgb-inputs" role="group" aria-label="Custom RGB" title="Edit the Bit’s RGB channels before importing (0–255). Blank channels keep the selected look.">
        {['R', 'G', 'B'].map((label, axis) => <label className={`channel-${label.toLowerCase()}`} key={label}>{label}<input type="number" aria-label={`Bit ${label}`} min="0" max="255" step="1" disabled={busy} placeholder={rgbValues[axis] === '' ? 'Mixed' : String(rgbValues[axis])} value={channels[axis] ?? rgbValues[axis]} onChange={event => {
          const value = event.target.value;
          setChannels(previous => previous.map((current, index) => axis === index ? value : current));
        }}/></label>)}
      </div>
      {missing.length > 0 && <p className="parts-warning">Unavailable textures: {missing.join(', ')}. Import requires these textures unless an equivalent dependency already exists.</p>}
      {part.model.Version !== model.Version && <p className="parts-warning">Source format {part.model.Version}; destination format {model.Version}. Convert a copy to the destination format before import.</p>}</>}
    </main></div><footer>{asking ? <><span>Apply its global animations?</span><button disabled={busy || invalidRgb} onClick={() => importPart(true)}>Yes</button><button disabled={busy || invalidRgb} onClick={() => importPart(false)}>No</button></> : <><span>{replacing ? 'Adjust the replacement in Quad View before committing.' : 'The displayed RGB is imported; saved Bit tracks stay intact.'}</span><button onClick={onClose} disabled={busy}>Cancel</button><button className="parts-import" disabled={!part || busy || invalidRgb || part?.model.Version !== model.Version || (replacing && !hasSelection)} onClick={() => importPart()}>{busy ? 'Working…' : replacing ? 'Edit in Quad View' : 'Import whole part'}</button></>}</footer></>}
    {error && <div className="parts-error" role="alert">{error}</div>}
  </section></div>;
}
