import React, { useMemo, useState } from 'react';
import { buildForgePrimitive, FORGE_SHAPES, FLAT_FORGE_SHAPES, PRIMITIVE_DEFAULTS } from '../src/forge-primitives.js';
import { encodeForgeTga } from '../src/forge.js';
import ForgePreview from './ForgePreview.jsx';

export default function ForgeShapes({ preferences, onClose, onCommit, onBusyChange }) {
  const [settings, setSettings] = useState(PRIMITIVE_DEFAULTS), [wire, setWire] = useState(true), [checker, setChecker] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const setting = (key, value) => setSettings(s => ({ ...s, [key]: value }));
  const preview = useMemo(() => { try { return { mesh: buildForgePrimitive(settings) }; } catch (e) { return { error: e.message }; } }, [settings]);
  const add = async () => {
    setBusy(true); onBusyChange(true); setError('');
    try {
      const texturePath = 'MDLxL_Forge\\mdlxl-shape-white-v1.tga', asset = { name: texturePath, source: 'forge', bytes: encodeForgeTga({ width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) }) };
      const result = await onCommit({ mesh: preview.mesh, asset, texturePath }); if (result !== false) onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); onBusyChange(false); }
  };
  return <><div className="forge-shape-body forge-primitives"><aside>
    <label>Shape<select aria-label="Shape" value={settings.shape} onChange={e => setting('shape', e.target.value)}>{FORGE_SHAPES.map(shape => <option key={shape}>{shape}</option>)}</select></label>
    {['width', 'height', ...(FLAT_FORGE_SHAPES.includes(settings.shape) ? [] : ['depth'])].map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input aria-label={key[0].toUpperCase() + key.slice(1)} type="number" min="0.01" max="100000" value={settings[key]} onChange={e => setting(key, +e.target.value)}/></label>)}
    {FLAT_FORGE_SHAPES.includes(settings.shape) && <label>Thickness<input aria-label="Shape thickness" type="number" min="0" max="100000" step="0.5" value={settings.thickness} onChange={e => setting('thickness', +e.target.value)}/></label>}
    {settings.shape === 'Torus' && <label>Thickness (%)<input aria-label="Tube thickness" type="number" min="5" max="45" value={settings.tube} onChange={e => setting('tube', +e.target.value)}/></label>}
    {settings.shape !== 'Plane' && <><label>Complexity<strong>{settings.complexity} / 4</strong></label><input aria-label="Shape complexity" type="range" min="1" max="4" step="1" value={settings.complexity} onChange={e => setting('complexity', +e.target.value)}/></>}
    <p className="forge-counts" aria-live="polite">{preview.mesh && `${preview.mesh.vertexCount} vertices · ${preview.mesh.triangleCount} triangles`}</p>
    <label className="forge-check"><input type="checkbox" checked={wire} onChange={e => setWire(e.target.checked)}/>Wireframe</label><label className="forge-check"><input type="checkbox" checked={checker} onChange={e => setChecker(e.target.checked)}/>Checker</label>
    <details><summary>Placement</summary>{['position', 'rotation'].map(key => <div key={key}><p>{key === 'position' ? 'Position' : 'Rotation (degrees)'}</p>{['X', 'Y', 'Z'].map((axis, i) => <label key={axis}>{axis}<input aria-label={`Shape ${key} ${axis}`} type="number" value={settings[key][i]} onChange={e => setting(key, settings[key].map((n, j) => j === i ? +e.target.value : n))}/></label>)}</div>)}</details>
    <p>{FLAT_FORGE_SHAPES.includes(settings.shape) ? 'Thickness 0 is flat. Increase it for a solid front, back and edges.' : 'Adjust, then Add shape.'} {settings.shape === 'Plane' ? 'Use Grid for more rows to bend.' : 'Maximum complexity stays below 800 triangles.'}</p>
  </aside><ForgePreview preferences={preferences} geosets={preview.mesh?.geosets || []} wire={wire} checker={checker} initialView="oblique"/></div>
  {(error || preview.error) && <div role="alert" className="forge-error">{error || preview.error}</div>}<footer><span>New geoset · DummyBone · one undo step</span><button disabled={busy} onClick={onClose}>Cancel</button><button className="forge-primary" disabled={busy || !preview.mesh} onClick={add}>{busy ? 'Working…' : 'Add shape'}</button></footer></>;
}
