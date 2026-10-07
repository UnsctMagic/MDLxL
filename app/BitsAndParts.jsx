import React, { useEffect, useMemo, useRef, useState } from 'react';
import Viewport, { textureFromAsset } from './Viewport.jsx';
import { openDocument, validateModel } from '../src/editor-document.js';
import { collectPart, partPathKey, partRgbSnapshot, partTextureIndices, partTextureKey, positionPart, previewPart, previewPartReplacement, transformPart } from '../src/bits-and-parts.js';
import CollectBit from './CollectBit.jsx';
import PartAnimations from './PartAnimations.jsx';
import './bits-and-parts.css';

function FolderTree({ entries, selected, onSelect }) {
  return <ul>{entries.map(entry => <li key={entry.id}>{entry.type === 'folder' ? <details open><summary>{entry.name}</summary><FolderTree entries={entry.children} selected={selected} onSelect={onSelect}/></details> : <button className={entry.id === selected ? 'selected' : ''} title={entry.id} onClick={() => onSelect(entry)}>{entry.name}</button>}</li>)}</ul>;
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

export default function BitsAndParts({ model, preferences, selectionByGeoset, textureAssets = new Map(), teamColor = '#ff0000', onClose, onCommit }) {
  const [collection, setCollection] = useState(null);
  const [replacing, setReplacing] = useState(false), [placed, setPlaced] = useState(null), [quad, setQuad] = useState(true), [placementView, setPlacementView] = useState('perspective'), [placementTool, setPlacementTool] = useState('translate');
  const [bank, setBank] = useState(null), [part, setPart] = useState(null), [assets, setAssets] = useState(new Map()), [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [missing, setMissing] = useState([]);
  const [sequence, setSequence] = useState('');
  const generation = useRef(0), picker = useRef(), dialog = useRef();
  const refresh = async () => { if (!window.desktop?.listParts) return; setBusy(true); setError(''); try { setBank(await window.desktop.listParts()); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  useEffect(() => { refresh(); dialog.current?.focus(); return () => { generation.current++; }; }, []);
  const choose = async entry => {
    const request = ++generation.current;
    setSelected(entry.id); setPart(null); setPlaced(null); setAssets(new Map()); setSequence(''); setMissing([]); setBusy(true); setError('');
    try {
      const record = window.desktop?.readPart ? await window.desktop.readPart(entry.id) : { name: entry.name, bytes: new Uint8Array(await bank.models.get(entry.id).arrayBuffer()) };
      const document = openDocument(record.bytes, record.name);
      if (document.readOnly || validateModel(document.model).some(issue => issue.severity === 'error')) throw Error('This part is unreadable or contains invalid references. Repair it before importing.');
      if (!document.model.Geosets.length) throw Error('This part has no geosets.');
      const names = partTextureIndices(document.model).map(index => document.model.Textures[index]).filter(texture => !texture.ReplaceableId && texture.Image).map(texture => texture.Image);
      let records = [];
      if (window.desktop?.resolveTextures) records = await window.desktop.resolveTextures({ path: record.path, names });
      else for (const name of names) { const relative = entry.id.split('/').slice(0, -1).concat(name.replaceAll('\\', '/')).join('/'), file = bank.assets.get(partPathKey(relative)) || bank.assets.get(partPathKey(name)); if (file) records.push({ name, bytes: new Uint8Array(await file.arrayBuffer()) }); }
      const loaded = new Map();
      for (const record of records) { const name = record.logicalName || record.texturePath || record.name; loaded.set(partPathKey(name), { ...record, name }); }
      // Existing destination assets can satisfy equivalent dependency records.
      for (const name of names) if (!loaded.has(partPathKey(name)) && textureAssets.has(partPathKey(name))) loaded.set(partPathKey(name), textureAssets.get(partPathKey(name)));
      if (generation.current !== request) return;
      setMissing(names.filter(name => !loaded.has(partPathKey(name)))); setAssets(loaded); setPart({ ...record, model: document.model });
      if (replacing) setPlaced(positionPart(document.model, model, selectionByGeoset));
    } catch (error) { if (generation.current === request) setError(error.message); }
    finally { if (generation.current === request) setBusy(false); }
  };
  const rgbSequence = sequence === '' ? -1 : Number(sequence);
  const preview = useMemo(() => part ? previewPart(partRgbSnapshot(part.model, rgbSequence)) : null, [part, rgbSequence]);
  const placement = useMemo(() => {
    if (!replacing) return null;
    try { return previewPartReplacement(model, placed, selectionByGeoset, rgbSequence); }
    catch (error) { return { error: error.message }; }
  }, [replacing, model, placed, selectionByGeoset, rgbSequence]);
  const placementSelection = useMemo(() => Object.fromEntries((placement?.geosetIndices || []).map(index => [index, Array.from({ length: placement.model.Geosets[index].Vertices.length / 3 }, (_, id) => id)])), [placement]);
  const placementAssets = useMemo(() => new Map([...assets, ...textureAssets]), [assets, textureAssets]);
  const hasSelection = Object.values(selectionByGeoset || {}).some(ids => ids.length);
  const collect = () => { try { setCollection(collectPart(model, selectionByGeoset)); setError(''); } catch (error) { setError(error.message); } };
  const replace = () => {
    try {
      previewPartReplacement(model, null, selectionByGeoset);
      setPlaced(part ? positionPart(part.model, model, selectionByGeoset) : null);
      setReplacing(true); setQuad(true); setPlacementTool('translate'); setError('');
    } catch (error) { setError(error.message); }
  };
  const movePart = payload => {
    try {
      // Viewport IDs include the remaining destination; source IDs start at 0.
      const modelPositions = payload.modelPositions && Object.fromEntries(placement.geosetIndices.map((index, sourceIndex) => [sourceIndex, payload.modelPositions[index]]));
      setPlaced(transformPart(placed, { ...payload, modelPositions })); setError(''); return true;
    } catch (error) { setError(error.message); return false; }
  };
  const importPart = async () => {
    if (!part || busy) return;
    const request = generation.current;
    setBusy(true); setError('');
    try {
      const portable = [], preparedPaths = new Set();
      for (const index of partTextureIndices(partRgbSnapshot(part.model, rgbSequence))) {
        const texture = part.model.Textures[index];
        if (texture.ReplaceableId || !texture.Image || /\.w3mod:/i.test(texture.Image)) continue;
        if (model.Textures.some(existing => partTextureKey(existing) === partTextureKey(texture)) || preparedPaths.has(partPathKey(texture.Image))) continue;
        const asset = assets.get(partPathKey(texture.Image));
        if (!asset) throw Error(`Missing texture: ${texture.Image}. Place it beside the source part or configure its Warcraft data folder.`);
        const prepared = await preparePartAsset(asset, texture.Image); portable.push(prepared); preparedPaths.add(partPathKey(texture.Image));
      }
      if (generation.current !== request) return;
      const result = await onCommit({ source: replacing ? placed : part.model, rgbSequence, assets: portable, replacement: replacing ? selectionByGeoset : null });
      if (generation.current === request && result !== false) onClose();
    } catch (error) { if (generation.current === request) setError(error.message); }
    finally { if (generation.current === request) setBusy(false); }
  };
  if (collection) return <CollectBit source={collection} preferences={preferences} textureAssets={textureAssets} teamColor={teamColor} prepareAsset={preparePartAsset} onClose={() => setCollection(null)} onSaved={async entry => { setCollection(null); await refresh(); await choose(entry); }}/>;
  return <div className="parts-overlay" onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); } }}><section className="parts-dialog" role="dialog" aria-modal="true" aria-label="BitsAndParts" tabIndex={-1} ref={dialog}>
    <header><h2>BitsAndParts</h2><div className="parts-header-actions"><button disabled={busy || !window.desktop?.savePart || !hasSelection} onClick={collect}>Collect Bit</button><button disabled={busy || !hasSelection} aria-pressed={replacing} onClick={replace}>Replace Part</button></div><button onClick={onClose} disabled={busy} aria-label="Close BitsAndParts">✕</button></header>
    <div className="parts-body"><aside aria-label="Parts folders and files"><div className="parts-bank-tools"><strong>BitsAndParts</strong>{window.desktop?.listParts ? <><button disabled={busy} onClick={refresh}>Refresh</button><button onClick={() => window.desktop.openPartsFolder().catch(error => setError(error.message))}>Open folder</button></> : <button onClick={() => picker.current.click()}>Choose folder</button>}</div>
      {bank?.children.length ? <FolderTree entries={bank.children} selected={selected} onSelect={choose}/> : <p>Store MDL and MDX parts here. Nested folders such as helms/horns stay organized.</p>}
      {bank?.directory && <small className="parts-directory" title={bank.directory}>{bank.directory}</small>}
      <input hidden ref={picker} type="file" webkitdirectory="" multiple onChange={event => { try { setBank(browserBank([...event.target.files])); setError(''); } catch (error) { setError(error.message); } event.target.value = ''; }}/>
    </aside><main>{replacing && <div className="parts-placement-tools"><button aria-pressed={quad} onClick={() => setQuad(true)}>Quad View</button><button aria-pressed={!quad} onClick={() => setQuad(false)}>Normal View</button>{!quad && <select aria-label="Placement view" value={placementView} onChange={event => setPlacementView(event.target.value)}>{['perspective', 'front', 'back', 'left', 'right', 'top', 'bottom'].map(view => <option key={view} value={view}>{view[0].toUpperCase() + view.slice(1)}</option>)}</select>}{[['translate', 'Move'], ['rotate', 'Rotate'], ['scale', 'Scale']].map(([tool, label]) => <button key={tool} disabled={!placed || busy} aria-pressed={placementTool === tool} onClick={() => setPlacementTool(tool)}>{label}</button>)}</div>}<div className={`parts-preview${replacing ? ' parts-placement-preview' : ''}`}>{replacing ? placement?.model ? <Viewport key={placed ? 'replacement:' + selected : 'replacement'} model={placement.model} preferences={preferences} textureAssets={placementAssets} teamColor={teamColor} mode="textured" quadView={quad} view={placementView} cameraMode="work" workplaneEnabled={quad} transformMode={placementTool} onTransform={movePart} selectionByGeoset={placementSelection} selectableGeosets={new Set(placement.geosetIndices)} selectedGeoset={placement.geosetIndices[0] ?? -1} vertexSelection={false} showVertices={false} showSkeleton={false} showGrid={false} showAxes={false} overlays={{}} sequenceIndex={-1} time={0} playing={false} rgbPreview shaded/> : <p>{placement?.error}</p> : preview ? <Viewport key="source" presentation="preview" model={preview} preferences={preferences} revision={0} textureAssets={assets} teamColor={teamColor} mode="textured" view="perspective" cameraMode="free" showGrid={false} showSkeleton={false} showVertices={false} overlays={{}} selectedGeoset={-1} sequenceIndex={-1} time={0} playing={false} shaded/> : <p>{busy ? 'Loading preview…' : 'Select a part to preview it.'}</p>}</div>
      {replacing && <p className="parts-note">{part ? 'Drag to position the Bit. It inherits the replaced vertices’ bones and weights; source rig motion is not imported.' : 'The selected part is hidden. Choose a Bit to position in its place.'}</p>}
      {part && <><strong className="parts-filename">{part.name} · {part.model.Geosets.length} geosets</strong>{!replacing && <p className="parts-note">Import the whole part at its original coordinates and scale, attached to DummyBone. Source rig motion is not imported.</p>}
      <PartAnimations model={part.model} sequence={sequence} onPreview={setSequence} busy={busy}/>
      {missing.length > 0 && <p className="parts-warning">Unavailable textures: {missing.join(', ')}. Import requires these textures unless an equivalent dependency already exists.</p>}
      {part.model.Version !== model.Version && <p className="parts-warning">Source format {part.model.Version}; destination format {model.Version}. Convert a copy to the destination format before import.</p>}</>}
    </main></div>{error && <div className="parts-error" role="alert">{error}</div>}<footer><span>{replacing ? 'Apply removes the selected geometry. Cancel keeps the model unchanged.' : 'The displayed RGB is imported; saved Bit tracks stay intact.'}</span><button onClick={onClose} disabled={busy}>Cancel</button><button className="parts-import" disabled={!part || busy || part?.model.Version !== model.Version || (replacing && (!placed || !!placement?.error))} onClick={importPart}>{busy ? 'Working…' : replacing ? 'Apply replacement' : 'Import whole part'}</button></footer>
  </section></div>;
}
