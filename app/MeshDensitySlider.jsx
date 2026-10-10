import React, { useEffect, useMemo, useState } from 'react';
import { changeGeosetDensity, maximumDensityAmount } from '../src/mesh-density.js';
import './mesh-density.css';

export default function MeshDensitySlider({ targets, value, onChange, onResult, disabled = false, compact = false }) {
  const [status, setStatus] = useState({ updating: false, error: '', result: null });
  const maximum = useMemo(() => targets.length ? Math.min(...targets.map(target => maximumDensityAmount(target.geoset, target))) : 0, [targets]);
  useEffect(() => { if (value > maximum) onChange(maximum); }, [maximum, value, onChange]);
  useEffect(() => {
    let cancelled = false;
    if (!targets.length) { setStatus({ updating: false, error: 'Select a triangle\'s three vertices.', result: null }); onResult?.(null); return; }
    setStatus(previous => ({ ...previous, updating: true, error: '' })); onResult?.(null);
    const timer = setTimeout(() => Promise.all(targets.map(async target => ({ index: target.index, ...await changeGeosetDensity(target.geoset, value, target) }))).then(changes => {
      if (cancelled) return;
      const result = { changes, constrained: changes.some(change => change.constrained) };
      for (const key of ['trianglesBefore', 'trianglesAfter', 'verticesAfter']) result[key] = changes.reduce((sum, change) => sum + change[key], 0);
      setStatus({ updating: false, error: '', result }); onResult?.(result);
    }).catch(error => {
      if (cancelled) return;
      setStatus({ updating: false, error: error.message, result: null }); onResult?.(null);
    }), 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [targets, value]);
  const result = status.result, direction = value > 0 ? 'More' : value < 0 ? 'Less' : 'Original';
  return <div className={`mesh-density-control${compact ? ' compact' : ''}`}>
    <div className="mesh-density-labels"><span>Less triangles</span><strong>{direction}</strong><span>More triangles</span></div>
    <input aria-label="Triangle density" type="range" min="-100" max={maximum} step="1" value={Math.min(value, maximum)} disabled={disabled || !targets.length} onChange={event => onChange(Number(event.target.value))}/>
    <div className="mesh-density-counts" aria-live="polite">{status.updating ? 'Updating wireframe…' : result ? <><strong>{result.trianglesAfter.toLocaleString()}</strong> triangles · {result.verticesAfter.toLocaleString()} vertices{result.constrained ? ' · minimum safe density reached' : ''}</> : ''}</div>
    {status.error && <div className="mesh-density-error" role="alert">{status.error}</div>}
  </div>;
}
