import React, { useMemo, useState } from 'react';
import { resolveShapeSelection, previewShape } from '../src/shaping.js';
import { prepareShapeSupport } from '../src/shaping-support.js';
import ForgeEditor from './ForgeEditor.jsx';
import { WarmKeyBadge } from './WarmKeys.jsx';
import { SURFACE_COLORS, geosetModelingOverlay } from './forge-surface-colors.js';
import { transformVertices } from '../src/editor-commands.js';
import './forge.css';

const TOOLS = [
  ['Curve', 'Bend', 'curve', 'M8 33 Q32 5 56 33'],
  ['Fold', 'Bend', 'fold', 'M8 33 L32 12 L56 33'],
  ['Twist', 'Warp', 'curve', 'M14 9 C55 9 9 37 50 37 M50 9 C9 9 55 37 14 37'],
  ['Dome', 'Dome', 'curve', 'M8 35 Q32 -5 56 35 Z M17 35 Q32 7 47 35'],
  ['Roll', 'Wrap', 'curve', 'M52 32 C14 51 4 5 32 8 C53 10 46 33 28 27'],
  ['Taper', 'Taper', 'curve', 'M22 9 L42 9 L56 37 L8 37 Z'],
];
export default function ShapingDialog({ model, selectedGeosets, selectionByGeoset = {}, initialTool = 'Bend', preferences, editorState, surfaceColors = SURFACE_COLORS, onClose, onApply, onApplyModel }) {
  const [working, setWorking] = useState(model), [history, setHistory] = useState([]), [future, setFuture] = useState([]);
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
  const [amount, setAmount] = useState(() => initialAmount(initialTool)), [message, setMessage] = useState(''), [original, setOriginal] = useState(false);
  const [picked, setPicked] = useState(selectionByGeoset), [affect, setAffect] = useState('all'), [pivot, setPivot] = useState(initialTool === 'Taper' ? 'start' : 'middle'), [bendStyle, setBendStyle] = useState('curve'), [local, setLocal] = useState(false), [radius, setRadius] = useState(frame.size / 2), [support, setSupport] = useState('auto');
  const selection = useMemo(() => affect === 'all' ? resolveShapeSelection(working, geosetIds) : Object.fromEntries(geosetIds.filter(i => picked[i]?.length).map(i => [i, picked[i]])), [working, geosetIds, affect, picked]);
  const origin = useMemo(() => {
    const positions = new Map(); for (const gi of geosetIds) for (const id of picked[gi] || []) { const p = Array.from(working.Geosets[gi].Vertices.slice(id * 3, id * 3 + 3)); if(p.length!==3)continue; positions.set(p.join(','), p); }
    return positions.size ? [...positions.values()].reduce((sum, p) => sum.map((v, i) => v + p[i] / positions.size), [0, 0, 0]) : null;
  }, [working, geosetIds, picked]);
  const effectiveSupport = affect === 'all' ? support : 0;
  // Support is prepared once per tool/selection change, not on every slider tick.
  const prepared = useMemo(() => { try { return prepareShapeSupport(working, selection, { support: effectiveSupport, tool, axis, bendStyle }); } catch (e) { return { error: e.message }; } }, [working, selection, effectiveSupport, tool, axis, bendStyle]);
  const options = useMemo(() => ({ tool, axis, direction, amount, pivot, bendStyle, support: effectiveSupport, radius: local ? radius : 0, ...(pivot === 'selected' ? { origin } : {}) }), [tool, axis, direction, amount, pivot, bendStyle, effectiveSupport, local, radius, origin]);
  const source = geosetIds.map(i => model.Geosets[i]);
  const preview = useMemo(() => { try {
    if (local && radius <= 0) throw Error('Choose a positive radius.');
    if (prepared.error && amount !== 0) throw Error(prepared.error);
    const result = amount === 0 ? working : previewShape(prepared.model, prepared.selection, options);
    return { model: result, geosets: geosetIds.map(i => result.Geosets[i]) };
  } catch (e) { return { error: e.message, model: working, geosets: geosetIds.map(i => working.Geosets[i]) }; } }, [working, prepared, options, geosetIds, local, radius, amount]);
  const apply = async () => { try { const result = onApplyModel ? await onApplyModel(preview.model) : await onApply(options, selection, working); if (result !== false) onClose(); } catch (e) { setMessage(e.message); } };
  const chooseTool = (next, style) => { setTool(next); setBendStyle(style); setAmount(initialAmount(next)); setAxis(next === 'Dome' ? frame.depth : ['Warp', 'Taper'].includes(next) ? frame.vertical : frame.horizontal); setDirection(next === 'Dome' ? frame.horizontal : frame.depth); setOriginal(false); setMessage(''); };
  const changeAmount = value => { setAmount(value); setOriginal(false); };
  const range = tool === 'Taper' ? [-95, 100] : tool === 'Dome' ? [-frame.size / 2, frame.size / 2] : ['Warp', 'Wrap'].includes(tool) ? [-360, 360] : [-180, 180];
  const pickedCount = geosetIds.reduce((n, i) => n + (picked[i]?.length || 0), 0);
  const setLengthAxis = next => { setAxis(next); if (next === direction) setDirection((next + 1) % 3); setOriginal(false); };
  const sourceTriangles = source.reduce((n, g) => n + g.Faces.length / 3, 0), triangles = preview.geosets.reduce((n, g) => n + g.Faces.length / 3, 0);

  const shown = original ? model : preview.model;
  const previewModel = useMemo(() => ({ ...shown, Geosets: geosetIds.map(i => shown.Geosets[i]) }), [shown, geosetIds]);
  const previewColors = useMemo(() => geosetIds.map(i => surfaceColors[i % surfaceColors.length]), [surfaceColors, geosetIds]);

  const localSelection = Object.fromEntries(geosetIds.map((gi,i)=>[i,(picked[gi]||[]).filter(id=>id<previewModel.Geosets[i].Vertices.length/3)]));
  const modelingOverlay = useMemo(() => previewModel.Geosets.map((g, i) => geosetModelingOverlay(g, localSelection[i])), [previewModel, picked, geosetIds]);
  const select = next => { if (Object.entries(next).some(([i,ids])=>ids.some(id=>id>=working.Geosets[geosetIds[i]].Vertices.length/3))) {remember();setWorking(shown);setAmount(0);} setPicked(Object.fromEntries(geosetIds.map((gi,i)=>[gi,next[i]||[]]))); setMessage(''); };
  const snapshot = () => ({ working, picked, amount, tool, axis, direction, pivot, bendStyle, local, radius, support, affect });
  const remember = () => { setHistory(h=>[...h,snapshot()]); setFuture([]); };
  const restore = (redo) => { const from=redo?future:history, to=redo?setHistory:setFuture, setFrom=redo?setFuture:setHistory; if(!from.length)return; to(h=>[...h,snapshot()]); const state=from.at(-1);setFrom(from.slice(0,-1));setWorking(state.working);setPicked(state.picked);setAmount(state.amount);setTool(state.tool);setAxis(state.axis);setDirection(state.direction);setPivot(state.pivot);setBendStyle(state.bendStyle);setLocal(state.local);setRadius(state.radius);setSupport(state.support);setAffect(state.affect); };
  const transform = payload => {
    try {
      const next={...shown,Geosets:[...shown.Geosets]};
      for(const [i,ids] of Object.entries(payload.selections||localSelection)) {
        const gi=geosetIds[i]; if(!ids.length)continue; next.Geosets[gi]=structuredClone(shown.Geosets[gi]);
        transformVertices(next.Geosets[gi],ids,payload.translation,payload.scale,payload.rotation,payload.pivot,{allowSingularScale:payload.allowSingularScale===true});
      }
      remember();setWorking(next);setAmount(0);setOriginal(false);setMessage('');
    } catch(e) { setMessage(e.message); }
  };
  return <div className="forge-overlay shaping-overlay"><section className="forge-shape-dialog shaping-simple" data-warmkey-category="MDLxL FORGE" role="dialog" aria-modal="true" data-warmkey-scope="dialog" aria-label="Shape geosets"><header><img src="./classic/wc3-forge.gif" alt=""/><h2>MDLxL FORGE · SHAPE</h2><button data-warmkey="forge:effect:close" onClick={onClose} aria-label="Close shaping tools">×</button></header>
    <ForgeEditor model={previewModel} preferences={preferences} editorState={editorState} surfaceColors={previewColors} modelingOverlay={modelingOverlay} selection={localSelection} onSelectionChange={select} onTransform={transform} onUndo={()=>restore(false)} onRedo={()=>restore(true)} canUndo={history.length>0} canRedo={future.length>0} toolbar={<button data-warmkey="forge:effect:original" aria-label="Original" aria-pressed={original} className={original?'active':''} onClick={()=>setOriginal(!original)}>Original</button>}
      sidebar={<div className="forge-effect-controls" data-warmkey-prefix="forge:effect">      <div className="shaping-tools" role="group" aria-label="Shape effect">{TOOLS.map(([label, next, style, path]) => <button data-warmkey={'tool:'+label} aria-label={label} key={label} className={tool === next && bendStyle === style ? 'active' : ''} aria-pressed={tool === next && bendStyle === style} onClick={() => chooseTool(next, style)}><svg viewBox="0 0 64 46" aria-hidden="true"><path d={path}/></svg>{label}</button>)}</div>
      <label className="shaping-amount">Amount<WarmKeyBadge actionId="forge:effect:amount"/><input data-warmkey="amount" aria-label="Amount" type="number" min={range[0]} max={range[1]} value={amount} onChange={e => changeAmount(+e.target.value)}/></label>
      <input data-warmkey="amount-slider" type="range" min={range[0]} max={range[1]} step="0.5" value={amount} onChange={e => changeAmount(+e.target.value)} aria-label="Shaping amount"/>
      <button data-warmkey="reverse" aria-label="Reverse" className="shaping-reverse" onClick={() => changeAmount(-amount)}>↔ Reverse</button>
      {tool !== 'Dome' && <><div className="shaping-caption">Direction</div><div className="shaping-segments">{[[frame.horizontal, 'Across'], [frame.vertical, 'Up / down']].map(([value, label]) => <button data-warmkey={'direction:'+label} aria-label={label} key={label} aria-pressed={axis === value} className={axis === value ? 'active' : ''} onClick={() => { setLengthAxis(value); setDirection(frame.depth); }}>{label}</button>)}</div></>}
      {tool !== 'Dome' && <><div className="shaping-caption">Center</div><div className="shaping-segments">{[['start', 'Start'], ['middle', 'Middle'], ['end', 'End']].map(([value, label]) => <button data-warmkey={'center:'+value} aria-label={label} key={value} className={pivot === value ? 'active' : ''} aria-pressed={pivot === value} onClick={() => setPivot(value)}>{label}</button>)}</div></>}
      <details className="shaping-more"><summary data-warmkey="more">More controls<WarmKeyBadge actionId="forge:effect:more"/></summary>
        <label>Center<WarmKeyBadge actionId="forge:effect:center-field"/><select data-warmkey="center-field" aria-label="Center" value={pivot} onChange={e => setPivot(e.target.value)}><option value="start">Start edge</option><option value="middle">Middle</option><option value="end">End edge</option><option value="selected" disabled={!origin}>Selected vertices</option></select></label>
        <p>Select vertices with the Select tool to choose a center.</p>
        <label>Affect<WarmKeyBadge actionId="forge:effect:affect"/><select data-warmkey="affect" aria-label="Affect" value={affect} onChange={e => setAffect(e.target.value)}><option value="all">Whole geosets</option><option value="selected">Selected vertices only</option></select></label>
        <label>Axis<WarmKeyBadge actionId="forge:effect:axis"/><select data-warmkey="axis" aria-label="Length axis" value={axis} onChange={e => setLengthAxis(+e.target.value)}>{['X', 'Y', 'Z'].map((a, i) => <option value={i} key={a}>{a}</option>)}</select></label>
        {['Bend', 'Wrap'].includes(tool) && <label>Bend toward<WarmKeyBadge actionId="forge:effect:toward"/><select data-warmkey="toward" aria-label="Toward" value={direction} onChange={e => setDirection(+e.target.value)}>{['X', 'Y', 'Z'].map((a, i) => i !== axis && <option value={i} key={a}>{a}</option>)}</select></label>}
        <label>Surface<WarmKeyBadge actionId="forge:effect:surface"/><select data-warmkey="surface" aria-label="Surface detail" value={support} disabled={affect !== 'all'} onChange={e => setSupport(e.target.value === 'auto' ? 'auto' : +e.target.value)}><option value="auto">Auto</option><option value="0">Original triangles</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>Extra detail {n}</option>)}</select></label>
        <label className="forge-check"><input data-warmkey="local" type="checkbox" checked={local} onChange={e => setLocal(e.target.checked)}/>Only near center</label>{local && <label>Radius<WarmKeyBadge actionId="forge:effect:radius"/><input data-warmkey="radius" aria-label="Influence radius" type="number" min="0.01" value={radius} onChange={e => setRadius(+e.target.value)}/></label>}
      </details>
      {(preview.error || message) && <p role="alert" className="forge-error">{preview.error || message}</p>}
</div>} status={(preview.error||message)||triangles+' triangles'}/>
    <footer><button data-warmkey="forge:effect:reset" aria-label="Reset" onClick={() => {remember();changeAmount(0);}}>Reset</button><button data-warmkey="forge:effect:cancel" aria-label="Cancel" onClick={onClose}>Cancel</button><button data-warmkey="forge:effect:apply" aria-label="Apply" className="forge-primary" disabled={!!preview.error || amount===0 && working===model} onClick={apply}>Apply</button></footer></section></div>;
}
