import React, { useMemo, useState } from 'react';
import { previewShape, resolveShapeSelection, SHAPE_TOOLS } from '../src/shaping.js';
import ForgePreview from './ForgePreview.jsx';
import './forge.css';

const HELP = { Bend: 'Curve a shield or fold it at the middle. Length follows the shape; Toward chooses which way it bends.', Warp: 'Twist around the length axis. The center stays in place.', Dome: 'Push the surface out around the center. Height is in model units.', Wrap: 'Roll the surface into an arc around the center.', Taper: 'Make the shape narrower or wider away from the center.' };
export default function ShapingDialog({ model, selectedGeosets, selectionByGeoset = {}, initialTool = 'Bend', preferences, onClose, onApply }) {
  const geosetIds = useMemo(() => selectedGeosets.filter(i => model.Geosets[i]), [model, selectedGeosets]);
  const initialAxes = useMemo(() => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const [gi, ids] of Object.entries(resolveShapeSelection(model, geosetIds, selectionByGeoset))) for (const id of ids) for (let a = 0; a < 3; a++) { const n = model.Geosets[gi].Vertices[id * 3 + a]; min[a] = Math.min(min[a], n); max[a] = Math.max(max[a], n); }
    const ordered = [0, 1, 2].sort((a, b) => (max[b] - min[b]) - (max[a] - min[a]));
    return initialTool === 'Dome' ? [ordered[2], ordered[0]] : [ordered[0], ordered[2]];
  }, [model, geosetIds, selectionByGeoset, initialTool]);
  const [tool, setTool] = useState(initialTool), [axis, setAxis] = useState(initialAxes[0]), [direction, setDirection] = useState(initialAxes[1]), [amount, setAmount] = useState(0), [wire, setWire] = useState(true), [message, setMessage] = useState('');
  const [picked, setPicked] = useState(selectionByGeoset), [picking, setPicking] = useState(false), [affect, setAffect] = useState(geosetIds.some(i => selectionByGeoset[i]?.length) ? 'selected' : 'all'), [pivot, setPivot] = useState(initialTool === 'Taper' ? 'start' : 'middle'), [bendStyle, setBendStyle] = useState('curve'), [local, setLocal] = useState(false), [radius, setRadius] = useState(50);
  const selection = useMemo(() => affect === 'all' ? resolveShapeSelection(model, geosetIds) : Object.fromEntries(geosetIds.filter(i => picked[i]?.length).map(i => [i, picked[i]])), [model, geosetIds, affect, picked]);
  const origin = useMemo(() => {
    const positions = new Map(); for (const gi of geosetIds) for (const id of picked[gi] || []) { const p = Array.from(model.Geosets[gi].Vertices.slice(id * 3, id * 3 + 3)); positions.set(p.join(','), p); }
    return positions.size ? [...positions.values()].reduce((sum, p) => sum.map((v, i) => v + p[i] / positions.size), [0, 0, 0]) : null;
  }, [model, geosetIds, picked]);
  const options = useMemo(() => ({ tool, axis, direction, amount, pivot, bendStyle, radius: local ? radius : 0, ...(pivot === 'selected' ? { origin } : {}) }), [tool, axis, direction, amount, pivot, bendStyle, local, radius, origin]);
  const preview = useMemo(() => { try { if (local && radius <= 0) throw Error('Choose a positive influence radius.'); const result = previewShape(model, selection, options); return { geosets: geosetIds.map(i => result.Geosets[i]) }; } catch (e) { return { error: e.message, geosets: geosetIds.map(i => model.Geosets[i]) }; } }, [model, selection, options, geosetIds, local, radius]);
  const apply = async () => { try { const result = await onApply(options, selection); if (result !== false) onClose(); } catch (e) { setMessage(e.message); } };
  const pick = (localIndex, id, add) => { const gi = geosetIds[localIndex]; setPicked(previous => { const ids = new Set(add ? previous[gi] || [] : []); if (add && ids.has(id)) ids.delete(id); else ids.add(id); return { ...(add ? previous : {}), [gi]: [...ids] }; }); setPivot('selected'); setAffect('all'); setMessage(''); };
  const range = tool === 'Taper' ? [-95, 200] : tool === 'Dome' ? [-100, 100] : tool === 'Bend' && bendStyle === 'fold' ? [-180, 180] : [-360, 360];
  const pickedCount = geosetIds.reduce((n, i) => n + (picked[i]?.length || 0), 0);
  const setLengthAxis = next => { setAxis(next); if (next === direction) setDirection((next + 1) % 3); };
  return <div className="forge-overlay" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}><section className="forge-shape-dialog" role="dialog" aria-modal="true" aria-label="Shape geosets"><header><h2>Shape geosets</h2><button onClick={onClose} aria-label="Close shaping tools">✕</button></header>
    <div className="forge-shape-body"><aside>
      <label>Tool<select aria-label="Tool" value={tool} onChange={e => { const next = e.target.value; setTool(next); setAmount(0); const length = initialTool === 'Dome' ? initialAxes[1] : initialAxes[0], depth = initialTool === 'Dome' ? initialAxes[0] : initialAxes[1]; if (next === 'Dome') { setAxis(depth); setDirection(length); } else if (tool === 'Dome') { setAxis(length); setDirection(depth); } }}>{SHAPE_TOOLS.map(t => <option key={t}>{t}</option>)}</select></label><p>{HELP[tool]}</p>
      <label>{tool === 'Dome' ? 'Push along' : 'Length axis'}<select aria-label={tool === 'Dome' ? 'Push along' : 'Length axis'} value={axis} onChange={e => setLengthAxis(+e.target.value)}>{['X', 'Y', 'Z'].map((a, i) => <option value={i} key={a}>{a}</option>)}</select></label>
      {['Bend', 'Wrap'].includes(tool) && <label>Toward<select aria-label="Toward" value={direction} onChange={e => setDirection(+e.target.value)}>{['X', 'Y', 'Z'].map((a, i) => i !== axis && <option value={i} key={a}>{a}</option>)}</select></label>}
      {tool === 'Bend' && <label>Bend style<select aria-label="Bend style" value={bendStyle} onChange={e => setBendStyle(e.target.value)}><option value="curve">Smooth curve</option><option value="fold">Fold at center</option></select></label>}
      <label>Center<select aria-label="Center" value={pivot} onChange={e => setPivot(e.target.value)}><option value="start">Start edge</option><option value="middle">Middle</option><option value="end">End edge</option><option value="selected">Selected vertices</option></select></label>
      <div className="forge-pick-actions"><button className={picking ? 'active' : ''} aria-pressed={picking} onClick={() => { setPicking(!picking); if (!picking) setAmount(0); }}>{picking ? 'Done picking' : 'Pick center'}</button><span>{pickedCount} selected</span></div>
      {picking && <p>Click vertices where you want the center. Shift-click adds or removes. Click Done picking, then adjust the angle.</p>}
      <label>Affect<select aria-label="Affect" value={affect} onChange={e => setAffect(e.target.value)}><option value="all">Whole geosets</option><option value="selected">Selected vertices only</option></select></label>
      <label>{tool === 'Taper' ? 'Amount (%)' : tool === 'Dome' ? 'Height' : 'Angle (degrees)'}<input type="number" value={amount} onChange={e => setAmount(+e.target.value)}/></label><input type="range" min={range[0]} max={range[1]} value={amount} onChange={e => setAmount(+e.target.value)} aria-label="Shaping amount"/>
      <details><summary>Local influence</summary><label className="forge-check"><input type="checkbox" checked={local} onChange={e => setLocal(e.target.checked)}/>Only near center</label>{local && <label>Radius<input aria-label="Influence radius" type="number" min="0.01" value={radius} onChange={e => setRadius(+e.target.value)}/></label>}<p>Movement fades smoothly to zero outside this radius.</p></details>
      <label className="forge-check"><input type="checkbox" checked={wire} onChange={e => setWire(e.target.checked)}/>Wireframe</label><button onClick={() => setAmount(0)}>Reset preview</button>
      <p>Preview first, then Apply. Cancel leaves the model untouched. One undo step. Curves need rows of vertices; Forge complexity adds these to new shapes.</p>{(preview.error || message) && <p role="alert" className="forge-error">{preview.error || message}</p>}
    </aside><ForgePreview preferences={preferences} geosets={preview.geosets} wire={wire} initialView="largest" shapeHandle={picking ? null : { amount, onChange: value => setAmount(Math.round(Math.max(range[0], Math.min(range[1], value)))) }} vertexSelection={{ picking, byGeoset: geosetIds.map(i => picked[i] || []), onPick: pick, origin: pivot === 'selected' ? origin : null }}/></div>
    <footer><button onClick={onClose}>Cancel</button><button className="forge-primary" disabled={!!preview.error || amount === 0 || picking} onClick={apply}>Apply</button></footer></section></div>;
}
