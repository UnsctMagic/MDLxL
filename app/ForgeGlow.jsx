import React, { useMemo, useState } from 'react';
import { allNodes } from '../src/animation.js';
import { commitGlow, glowSelection, GLOW_TYPES } from '../src/forge-glow.js';

import ForgeEditor from './ForgeEditor.jsx';

export default function ForgeGlow({ model, selection, modelPath, textureAssets, preferences, editorState, teamColor, onCommit, onClose, onBusyChange }) {
  const anchor = useMemo(() => { try { return glowSelection(model, selection); } catch (e) { return { error: e.message }; } }, [model, selection]);
  const [settings, setSettings] = useState(() => ({ type: 'billboard', plane: 'xy', width: anchor.size || 40, height: anchor.size || 40, alpha: .75, parentId: anchor.parentId ?? null }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const nodes = useMemo(() => allNodes(model), [model]);
  const preview = useMemo(() => {
    if (anchor.error) return {};
    try {
      const copy = structuredClone(model); commitGlow(copy, selection, settings);
      // Preview the vertex editor's rest positions while retaining billboard
      // evaluation by the existing Warcraft renderer as the camera orbits.
      for (const node of allNodes(copy)) { delete node.Translation; delete node.Rotation; delete node.Scaling; }
      return { model: copy };
    } catch (e) { return { error: e.message }; }
  }, [model, selection, settings, anchor]);
  const setting = (key, value) => setSettings(old => ({ ...old, [key]: value }));
  const add = async () => {
    setBusy(true); onBusyChange(true); setError('');
    try { if (await onCommit(settings) !== false) onClose(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); onBusyChange(false); }
  };
  return <>{preview.model ? <ForgeEditor model={preview.model} preferences={preferences} editorState={editorState} textureAssets={textureAssets} teamColor={teamColor} previewOnly initialRenderMode="textured" sidebar={<div className="forge-effect-controls">    <label>Type<select aria-label="Glow type" value={settings.type} onChange={e => setting('type', e.target.value)}>{GLOW_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
    {settings.type === 'plane' && <label>Plane<select aria-label="Glow plane" value={settings.plane} onChange={e => setting('plane', e.target.value)}><option value="xy">XY (ground)</option><option value="xz">XZ</option><option value="yz">YZ</option></select></label>}
    {['width', 'height'].map(key => <React.Fragment key={key}><label>{key === 'width' ? 'Width' : 'Height'}<input aria-label={`Glow ${key}`} type="number" min="0.01" max="100000" step="0.1" value={settings[key]} onChange={e => setting(key, +e.target.value)}/></label><input aria-label={`Glow ${key} slider`} type="range" min="0.1" max={Math.max(200, (anchor.size || 40) * 5, settings[key])} step="0.1" value={settings[key]} onChange={e => setting(key, +e.target.value)}/></React.Fragment>)}
    <label>Intensity (alpha)<strong>{Math.round(settings.alpha * 100)}%</strong></label><input aria-label="Glow intensity" type="range" min="0" max="100" value={Math.round(settings.alpha * 100)} onChange={e => setting('alpha', +e.target.value / 100)}/>
    <label>Attach to<select aria-label="Glow attachment" value={settings.parentId ?? ''} onChange={e => setting('parentId', e.target.value === '' ? null : +e.target.value)}><option value="">Model root (no parent)</option>{nodes.map(node => <option key={node.ObjectId} value={node.ObjectId}>{node.Name}</option>)}</select></label>
    {anchor.mixed && <p>Selection uses several bones. The strongest influence is selected; choose the intended attachment.</p>}
    {!anchor.error && <p>At the center of {anchor.count} selected {anchor.count === 1 ? 'vertex' : 'vertices'}. A new glow bone follows the chosen attachment.</p>}
</div>}/> : <div className="forge-start">Select vertices in the model to place a glow.</div>}
    {(anchor.error || preview.error || error) && <div role="alert" className="forge-error">{anchor.error || preview.error || error}</div>}
    <footer><button disabled={busy} onClick={onClose}>Cancel</button><button className="forge-primary" disabled={busy || !preview.model} onClick={add}>{busy ? 'Working…' : 'Add'}</button></footer></>;
}
