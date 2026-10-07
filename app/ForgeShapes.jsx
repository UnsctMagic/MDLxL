import React, { useEffect, useMemo, useState } from 'react';
import { buildForgePrimitive, FORGE_SHAPES, FLAT_FORGE_SHAPES, PRIMITIVE_DEFAULTS, PRIMITIVE_TEXTURE } from '../src/forge-primitives.js';
import { thumperImage, THUMPER_TEXTURE, THUMPER_COLORS } from '../src/forge-thumper.js';
import { textureFromAsset } from './Viewport.jsx';
import { encodeForgeTga } from '../src/forge.js';
import ForgePreview from './ForgePreview.jsx';

// Small, static previews use the same geometry as the shape being added.
function ShapeThumbnail({ shape }) {
  const faces = useMemo(() => {
    const mesh = buildForgePrimitive({ ...PRIMITIVE_DEFAULTS, shape, complexity: 1 });
    const flat = FLAT_FORGE_SHAPES.includes(shape) || shape === 'ThumperXL', vertices = [], triangles = [];
    for (const g of mesh.geosets) {
      const start = vertices.length;
      for (let i = 0; i < g.Vertices.length; i += 3) {
        const [x, y, z] = g.Vertices.slice(i, i + 3);
        vertices.push(flat ? [x, -y, z] : [.82 * x + .57 * z, .2 * x - .93 * y - .29 * z, -.53 * x - .37 * y + .76 * z]);
      }
      for (let i = 0; i < g.Faces.length; i += 3) { const face = Array.from(g.Faces.slice(i, i + 3), id => vertices[start + id]); face.color = THUMPER_COLORS[Math.floor(g.TVertices[0][g.Faces[i] * 2] * 8)]; triangles.push(face); }
    }
    const minX = Math.min(...vertices.map(p => p[0])), maxX = Math.max(...vertices.map(p => p[0]));
    const minY = Math.min(...vertices.map(p => p[1])), maxY = Math.max(...vertices.map(p => p[1]));
    const scale = 42 / Math.max(maxX - minX, maxY - minY, 1);
    return triangles.sort((a, b) => a.reduce((n, p) => n + p[2], 0) - b.reduce((n, p) => n + p[2], 0)).map(points => {
      const [a, b, c] = points, u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const shade = 48 + 22 * Math.abs((normal[0] * -.3 + normal[1] * -.6 + normal[2] * .7) / (Math.hypot(...normal) || 1));
      return { points: points.map(p => [32 + (p[0] - (minX + maxX) / 2) * scale, 26 + (p[1] - (minY + maxY) / 2) * scale].join(',')).join(' '), fill: shape === 'ThumperXL' ? points.color : 'hsl(202 35% ' + shade + '%)' };
    });
  }, [shape]);
  return <svg viewBox="0 0 64 52" aria-hidden="true">{faces.map((face, i) => <polygon key={i} points={face.points} fill={face.fill} stroke="#203646" strokeWidth=".35" strokeLinejoin="round"/>)}</svg>;
}

export default function ForgeShapes({ modelPath, preferences, onClose, onCommit, onBusyChange }) {
  const [settings, setSettings] = useState(PRIMITIVE_DEFAULTS), [wire, setWire] = useState(false), [checker, setChecker] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [stock, setStock] = useState(null), [textureError, setTextureError] = useState('');
  const helmet = useMemo(thumperImage, []), isThumper = settings.shape === 'ThumperXL';
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const records = await window.desktop?.resolveTextures({ path: modelPath, names: [PRIMITIVE_TEXTURE] });
        const asset = records?.find(record => record.bytes);
        if (!asset) throw Error('BTNTemp preview needs Warcraft III textures. Set your game folder in Settings.');
        const texture = await textureFromAsset(asset);
        try { if (active) setStock({ asset, image: { width: texture.image.width, height: texture.image.height, data: new Uint8Array(texture.image.data) } }); }
        finally { texture.dispose(); }
      } catch (e) { if (active) setTextureError(e.message); }
    })();
    return () => { active = false; };
  }, [modelPath]);
  const setting = (key, value) => setSettings(s => ({ ...s, [key]: value }));
  const preview = useMemo(() => { try { return { mesh: buildForgePrimitive(settings) }; } catch (e) { return { error: e.message }; } }, [settings]);
  const add = async () => {
    setBusy(true); onBusyChange(true); setError('');
    try {
      const texturePath = isThumper ? THUMPER_TEXTURE : PRIMITIVE_TEXTURE;
      const asset = isThumper ? { name: texturePath, source: 'forge', bytes: encodeForgeTga(helmet) } : stock?.asset;
      const result = await onCommit({ mesh: preview.mesh, asset, texturePath }); if (result !== false) onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); onBusyChange(false); }
  };
  return <><div className="forge-shape-body forge-primitives"><aside>
    <div className="forge-shape-gallery" role="group" aria-label="Shape">{FORGE_SHAPES.map(shape => <button key={shape} aria-label={shape} aria-pressed={settings.shape === shape} className={settings.shape === shape ? 'active' : ''} onClick={() => setting('shape', shape)}><ShapeThumbnail shape={shape}/><span>{shape}</span></button>)}</div><div className="forge-dimensions">
    {['width', 'height', ...(FLAT_FORGE_SHAPES.includes(settings.shape) ? [] : ['depth'])].map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input aria-label={key[0].toUpperCase() + key.slice(1)} type="number" min="0.01" max="100000" value={settings[key]} onChange={e => setting(key, +e.target.value)}/></label>)}
    {FLAT_FORGE_SHAPES.includes(settings.shape) && <label>Thickness<input aria-label="Shape thickness" type="number" min="0" max="100000" step="0.5" value={settings.thickness} onChange={e => setting('thickness', +e.target.value)}/></label>}
    {settings.shape === 'Torus' && <label>Thickness (%)<input aria-label="Tube thickness" type="number" min="5" max="45" value={settings.tube} onChange={e => setting('tube', +e.target.value)}/></label>}
    </div>{settings.shape !== 'Plane' && !isThumper && <><label>Detail<strong>{settings.complexity} / 4</strong></label><input aria-label="Shape complexity" type="range" min="1" max="4" step="1" value={settings.complexity} onChange={e => setting('complexity', +e.target.value)}/></>}
    <details><summary>Placement</summary>{['position', 'rotation'].map(key => <div key={key}><p>{key === 'position' ? 'Position' : 'Rotation (degrees)'}</p>{['X', 'Y', 'Z'].map((axis, i) => <label key={axis}>{axis}<input aria-label={`Shape ${key} ${axis}`} type="number" value={settings[key][i]} onChange={e => setting(key, settings[key].map((n, j) => j === i ? +e.target.value : n))}/></label>)}</div>)}</details>
  </aside><div className="forge-shape-preview"><div className="forge-preview-heading"><h3>{settings.shape}</h3><div className="forge-preview-switches"><label className="forge-check"><input type="checkbox" checked={wire} onChange={e => setWire(e.target.checked)}/>Wireframe</label><label className="forge-check"><input type="checkbox" checked={checker} onChange={e => setChecker(e.target.checked)}/>Checker</label></div></div><ForgePreview key={settings.shape} image={isThumper ? helmet : stock?.image} preferences={preferences} geosets={preview.mesh?.geosets || []} wire={wire} checker={checker} initialView={isThumper ? 'front' : 'oblique'}/><div className="forge-counts" aria-live="polite">{preview.mesh && `${preview.mesh.vertexCount} vertices · ${preview.mesh.triangleCount} triangles`}</div></div></div>
  {!isThumper && textureError && <div role="status" className="forge-error">{textureError}</div>}
  {(error || preview.error) && <div role="alert" className="forge-error">{error || preview.error}</div>}<footer><button disabled={busy} onClick={onClose}>Cancel</button><button className="forge-primary" disabled={busy || !preview.mesh} onClick={add}>{busy ? 'Working…' : 'Add shape'}</button></footer></>;
}
