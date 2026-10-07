import React, { useMemo, useState } from 'react';
import { resolveShapeSelection, previewShape } from '../src/shaping.js';
import { prepareShapeSupport } from '../src/shaping-support.js';
import ForgePreview from './ForgePreview.jsx';
import './forge.css';

const TOOLS = [
  ['Curve', 'Bend', 'curve', 'M8 33 Q32 5 56 33'],
  ['Fold', 'Bend', 'fold', 'M8 33 L32 12 L56 33'],
  ['Twist', 'Warp', 'curve', 'M14 9 C55 9 9 37 50 37 M50 9 C9 9 55 37 14 37'],
  ['Dome', 'Dome', 'curve', 'M8 35 Q32 -5 56 35 Z M17 35 Q32 7 47 35'],
  ['Roll', 'Wrap', 'curve', 'M52 32 C14 51 4 5 32 8 C53 10 46 33 28 27'],
  ['Taper', 'Taper', 'curve', 'M22 9 L42 9 L56 37 L8 37 Z'],
];
export default function ShapingDialog({ model, selectedGeosets, selectionByGeoset = {}, initialTool = 'Bend', preferences, onClose, onApply }) {
  const geosetIds = useMemo(() => selectedGeosets.filter(i => model.Geosets[i]), [model, selectedGeosets]);
  const frame = useMemo(() => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const gi of geosetIds) for (let i = 0; i < model.Geosets[gi].Vertices.length; i++) { const axis = i % 3, value = model.Geosets[gi].Vertices[i]; min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); }
    const spans = max.map((v, i) => v - min[i]), depth = [0, 1, 2].sort((a, b) => spans[a] - spans[b])[0];
    const vertical = depth === 2 ? 1 : 2, horizontal = 3 - depth - vertical;
    return { horizontal, vertical, depth, size: Math.max(...spans.filter(Number.isFinite), 1) };
  }, [model, geosetIds]);
  const initialAmount = next => next === 'Dome' ? Math.round(frame.size * 15) / 100 : next === 'Taper' ? 25 : 60;
  const [tool, setTool] = useState(initialTool), [axis, setAxis] = useState(initialTool === 'Dome' ? frame.depth : ['Warp', 'Taper'].includes(initialTool) ? frame.vertical : frame.horizontal), [direction, setDirection] = useState(initialTool === 'Dome' ? frame.horizontal : frame.depth);
  const [amount, setAmount] = useState(() => initialAmount(initialTool)), [wire, setWire] = useState(false), [message, setMessage] = useState(''), [original, setOriginal] = useState(false);
  const [picked, setPicked] = useState(selectionByGeoset), [picking, setPicking] = useState(false), [affect, setAffect] = useState('all'), [pivot, setPivot] = useState(initialTool === 'Taper' ? 'start' : 'middle'), [bendStyle, setBendStyle] = useState('curve'), [local, setLocal] = useState(false), [radius, setRadius] = useState(frame.size / 2), [support, setSupport] = useState('auto');
  const selection = useMemo(() => affect === 'all' ? resolveShapeSelection(model, geosetIds) : Object.fromEntries(geosetIds.filter(i => picked[i]?.length).map(i => [i, picked[i]])), [model, geosetIds, affect, picked]);
  const origin = useMemo(() => {
    const positions = new Map(); for (const gi of geosetIds) for (const id of picked[gi] || []) { const p = Array.from(model.Geosets[gi].Vertices.slice(id * 3, id * 3 + 3)); positions.set(p.join(','), p); }
    return positions.size ? [...positions.values()].reduce((sum, p) => sum.map((v, i) => v + p[i] / positions.size), [0, 0, 0]) : null;
  }, [model, geosetIds, picked]);
  const effectiveSupport = affect === 'all' ? support : 0;
  // Support is prepared once per tool/selection change, not on every slider tick.
  const prepared = useMemo(() => { try { return prepareShapeSupport(model, selection, { support: effectiveSupport, tool, axis, bendStyle }); } catch (e) { return { error: e.message }; } }, [model, selection, effectiveSupport, tool, axis, bendStyle]);
  const options = useMemo(() => ({ tool, axis, direction, amount, pivot, bendStyle, support: effectiveSupport, radius: local ? radius : 0, ...(pivot === 'selected' ? { origin } : {}) }), [tool, axis, direction, amount, pivot, bendStyle, effectiveSupport, local, radius, origin]);
  const source = geosetIds.map(i => model.Geosets[i]);
  const preview = useMemo(() => { try {
    if (local && radius <= 0) throw Error('Choose a positive radius.');
    if (prepared.error && amount !== 0) throw Error(prepared.error);
    const result = amount === 0 ? model : previewShape(prepared.model, prepared.selection, options);
    return { geosets: geosetIds.map(i => result.Geosets[i]) };
  } catch (e) { return { error: e.message, geosets: geosetIds.map(i => model.Geosets[i]) }; } }, [model, prepared, options, geosetIds, local, radius, amount]);
  const apply = async () => { try { const result = await onApply(options, selection); if (result !== false) onClose(); } catch (e) { setMessage(e.message); } };
  const pick = (localIndex, id, add) => { const gi = geosetIds[localIndex]; setPicked(previous => { const ids = new Set(add ? previous[gi] || [] : []); if (add && ids.has(id)) ids.delete(id); else ids.add(id); return { ...(add ? previous : {}), [gi]: [...ids] }; }); setPivot('selected'); setAffect('all'); setMessage(''); };
  const chooseTool = (next, style) => { setTool(next); setBendStyle(style); setAmount(initialAmount(next)); setAxis(next === 'Dome' ? frame.depth : ['Warp', 'Taper'].includes(next) ? frame.vertical : frame.horizontal); setDirection(next === 'Dome' ? frame.horizontal : frame.depth); setOriginal(false); setPicking(false); setMessage(''); };
  const changeAmount = value => { setAmount(value); setOriginal(false); };
  const range = tool === 'Taper' ? [-95, 100] : tool === 'Dome' ? [-frame.size / 2, frame.size / 2] : ['Warp', 'Wrap'].includes(tool) ? [-360, 360] : [-180, 180];
  const pickedCount = geosetIds.reduce((n, i) => n + (picked[i]?.length || 0), 0);
  const setLengthAxis = next => { setAxis(next); if (next === direction) setDirection((next + 1) % 3); setOriginal(false); };
  const sourceTriangles = source.reduce((n, g) => n + g.Faces.length / 3, 0), triangles = preview.geosets.reduce((n, g) => n + g.Faces.length / 3, 0);
  return <div className="forge-overlay" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { if (picking) setPicking(false); else onClose(); } }}><section className="forge-shape-dialog shaping-simple" role="dialog" aria-modal="true" aria-label="Shape geosets"><header><h2>Shape</h2><button onClick={onClose} aria-label="Close shaping tools">✕</button></header>
    <div className="forge-shape-body"><aside>
      <div className="shaping-tools" role="group" aria-label="Shape effect">{TOOLS.map(([label, next, style, path]) => <button key={label} className={tool === next && bendStyle === style ? 'active' : ''} aria-pressed={tool === next && bendStyle === style} onClick={() => chooseTool(next, style)}><svg viewBox="0 0 64 46" aria-hidden="true"><path d={path}/></svg>{label}</button>)}</div>
      <label className="shaping-amount">Amount<input aria-label="Amount" type="number" min={range[0]} max={range[1]} value={amount} onChange={e => changeAmount(+e.target.value)}/></label>
      <input type="range" min={range[0]} max={range[1]} step="0.5" value={amount} onChange={e => changeAmount(+e.target.value)} aria-label="Shaping amount"/>
      <button className="shaping-reverse" onClick={() => changeAmount(-amount)}>↔ Reverse</button>
      {tool !== 'Dome' && <><div className="shaping-caption">Direction</div><div className="shaping-segments">{[[frame.horizontal, 'Across'], [frame.vertical, 'Up / down']].map(([value, label]) => <button key={label} aria-pressed={axis === value} className={axis === value ? 'active' : ''} onClick={() => { setLengthAxis(value); setDirection(frame.depth); }}>{label}</button>)}</div></>}
      {tool !== 'Dome' && <><div className="shaping-caption">Center</div><div className="shaping-segments">{[['start', 'Start'], ['middle', 'Middle'], ['end', 'End']].map(([value, label]) => <button key={value} className={pivot === value ? 'active' : ''} aria-pressed={pivot === value} onClick={() => setPivot(value)}>{label}</button>)}</div></>}
      <details className="shaping-more"><summary>More controls</summary>
        <label>Center<select aria-label="Center" value={pivot} onChange={e => setPivot(e.target.value)}><option value="start">Start edge</option><option value="middle">Middle</option><option value="end">End edge</option><option value="selected" disabled={!origin}>Picked vertices</option></select></label>
        <div className="forge-pick-actions"><button className={picking ? 'active' : ''} aria-pressed={picking} onClick={() => { setPicking(!picking); setOriginal(false); }}>{picking ? 'Done picking' : 'Pick center'}</button><span>{pickedCount} picked</span></div>
        {picking && <p>Click a vertex. Shift-click adds or removes.</p>}
        <label>Affect<select aria-label="Affect" value={affect} onChange={e => setAffect(e.target.value)}><option value="all">Whole geosets</option><option value="selected">Picked vertices only</option></select></label>
        <label>Axis<select aria-label="Length axis" value={axis} onChange={e => setLengthAxis(+e.target.value)}>{['X', 'Y', 'Z'].map((a, i) => <option value={i} key={a}>{a}</option>)}</select></label>
        {['Bend', 'Wrap'].includes(tool) && <label>Bend toward<select aria-label="Toward" value={direction} onChange={e => setDirection(+e.target.value)}>{['X', 'Y', 'Z'].map((a, i) => i !== axis && <option value={i} key={a}>{a}</option>)}</select></label>}
        <label>Surface<select aria-label="Surface detail" value={support} disabled={affect !== 'all'} onChange={e => setSupport(e.target.value === 'auto' ? 'auto' : +e.target.value)}><option value="auto">Auto</option><option value="0">Original triangles</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>Extra detail {n}</option>)}</select></label>
        <label className="forge-check"><input type="checkbox" checked={local} onChange={e => setLocal(e.target.checked)}/>Only near center</label>{local && <label>Radius<input aria-label="Influence radius" type="number" min="0.01" value={radius} onChange={e => setRadius(+e.target.value)}/></label>}
      </details>
      {(preview.error || message) && <p role="alert" className="forge-error">{preview.error || message}</p>}
    </aside><div className="shaping-preview"><div className="shaping-preview-bar"><button aria-pressed={original} className={original ? 'active' : ''} onClick={() => setOriginal(!original)}>Original</button><label className="forge-check"><input type="checkbox" checked={wire} onChange={e => setWire(e.target.checked)}/>Wireframe</label></div><ForgePreview surfaceColor="#659abd" preferences={preferences} geosets={picking || original ? source : preview.geosets} wire={wire} initialView="oblique" viewAxes={frame} shapeHandle={picking || original ? null : { amount, onChange: value => changeAmount(Math.round(Math.max(range[0], Math.min(range[1], value)))) }} vertexSelection={picking || pivot === 'selected' ? { picking, byGeoset: geosetIds.map(i => !picking && triangles !== sourceTriangles ? [] : picked[i] || []), onPick: pick, origin: pivot === 'selected' ? origin : null } : null}/><div className="forge-counts">{original || picking ? sourceTriangles : triangles} triangles{!original && !picking && triangles > sourceTriangles ? ` · +${triangles - sourceTriangles} for shaping` : ''}</div></div></div>
    <footer><button onClick={() => changeAmount(0)}>Reset</button><button onClick={onClose}>Cancel</button><button className="forge-primary" disabled={!!preview.error || amount === 0 || picking} onClick={apply}>Apply</button></footer></section></div>;
}
