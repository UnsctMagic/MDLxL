import { useEffect, useMemo, useState } from 'react';
import { planSurfaceCutout, previewSurfaceCutout } from '../src/surface-cutout.js';
import { createVisibilityGeosetAnimation } from '../src/geoset-animation-defaults.js';

/** One independent pending-edit tool. Identity, domain and settings own its preview. */
export function useSurfaceCutout({ model, revision, documentToken, eligibleSelection, sourceSelection, activeGeoset, materialEntry, textureSize, onApply, disabled }) {
  const [open, setOpen] = useState(false), [mode, setMode] = useState('lasso'), [corners, setCorners] = useState(8);
  const [tolerance, setTolerance] = useState(.5), [outlineMode, setOutlineMode] = useState('auto');
  const [contour, setContour] = useState([]), [seeds, setSeeds] = useState([]), [addSurface, setAddSurface] = useState(false);
  const [approximate, setApproximate] = useState(false), [accepted, setAccepted] = useState(false), [untinted, setUntinted] = useState(false);
  const [view, setView] = useState('all'), [contrast, setContrast] = useState(false), [wires, setWires] = useState(true), [pickError, setPickError] = useState('');
  const [gestureKey, setGestureKey] = useState(0);
  const domainKey = JSON.stringify(eligibleSelection), selectionKey = JSON.stringify(sourceSelection), materialKey = JSON.stringify(materialEntry);
  const cancel = () => { setOpen(false); setContour([]); setSeeds([]); setAddSurface(false); setPickError(''); setAccepted(false); setView('all'); };
  useEffect(() => { setContour([]); setSeeds([]); setAccepted(false); setView('all'); setGestureKey(v => v + 1); }, [model, revision, documentToken, domainKey, selectionKey, activeGeoset, materialKey]);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  const result = useMemo(() => {
    if (!open || contour.length < 3) return {};
    try {
      if (mode === 'lasso' && !textureSize) throw Error('Load the source texture before simplifying a lasso. Polygon and Ellipse keep the reviewed corners.');
      const indices = seeds.length ? [...new Set(seeds.map(s => s.index))] : materialEntry?.geosetIndices || [];
      if (indices.length !== 1 && !seeds.length) throw Error('Pick the intended surface in the live model preview.');
      const targets = indices.map(geosetIndex => {
        const g = model.Geosets[geosetIndex], allowed = new Set(eligibleSelection[geosetIndex] || []), eligibleTriangleIndices = [];
        for (let i = 0; i < g.Faces.length / 3; i++) if (Array.from(g.Faces.subarray(i * 3, i * 3 + 3)).every(id => allowed.has(id))) eligibleTriangleIndices.push(i);
        return { geosetIndex, materialId: g.MaterialID, uvSet: materialEntry.coordId, layerIndex: materialEntry.layers.find(layer => layer.coordId === materialEntry.coordId)?.layerIndex ?? 0, eligibleTriangleIndices, seedTriangles: seeds.filter(s => s.index === geosetIndex).map(s => s.triangleIndex) };
      });
      const plan = planSurfaceCutout(model, { targets, contour, textureSize: textureSize || [1, 1], revision, documentToken, rigPolicy: approximate ? 'approximate' : 'strict', rgb: untinted ? 'untinted' : 'preserve', outline: { tolerance, pinned: mode === 'polygon' || mode === 'ellipse', maximumCorners: outlineMode === 'auto' ? 32 : corners } });
      return { plan, preview: previewSurfaceCutout(model, plan) };
    } catch (error) { return { error: error.message }; }
  }, [model, revision, documentToken, open, JSON.stringify(contour), JSON.stringify(seeds), domainKey, materialKey, textureSize?.[0], textureSize?.[1], tolerance, mode, outlineMode, corners, approximate, untinted]);
  useEffect(() => { setAccepted(false); }, [result.plan]);
  const preview = useMemo(() => {
    if (!result.preview || !contrast) return result.preview;
    const draft = { ...result.preview, GeosetAnims: structuredClone(result.preview.GeosetAnims || []) };
    for (let index = model.Geosets.length; index < draft.Geosets.length; index++) {
      const animations = draft.GeosetAnims.filter(a => a.GeosetId === index);
      if (!animations.length) { const anim = createVisibilityGeosetAnimation(index); draft.GeosetAnims.push(anim); animations.push(anim); }
      for (const anim of animations) { anim.Flags |= 2; anim.Color = new Float32Array([1, .15, .8]); }
    }
    return draft;
  }, [result.preview, contrast, model]);
  const pick = hit => {
    if (hit && result.plan) {
      const edit = hit.index < model.Geosets.length ? result.plan.edits.find(e => e.target.geosetIndex === hit.index) : result.plan.edits[hit.index - model.Geosets.length];
      const kind = hit.index < model.Geosets.length ? 'source' : 'extracted';
      const face = edit?.faceProvenance.find(p => p.kind === kind && p.outputTriangle === hit.triangleIndex);
      if (face) hit = { index: edit.target.geosetIndex, triangleIndex: face.triangleIndex, ids: Array.from(model.Geosets[edit.target.geosetIndex].Faces.subarray(face.triangleIndex * 3, face.triangleIndex * 3 + 3)) };
    }
    if (!hit || !materialEntry?.geosetIndices.includes(hit.index) || !hit.ids.every(id => eligibleSelection[hit.index]?.includes(id))) {
      setPickError('Pick a visible face in the current UV surface selection.'); return;
    }
    setPickError(''); setAccepted(false); setView('all');
    setSeeds(previous => addSurface ? [...previous.filter(s => s.index !== hit.index || s.triangleIndex !== hit.triangleIndex), hit] : [hit]);
  };
  const apply = () => {
    if (!result.plan || result.plan.status !== 'ready' || result.plan.needsApproximation && !accepted) return;
    try { if (onApply(result.plan, { acceptApproximation: accepted }) !== false) cancel(); }
    catch (error) { setPickError(error.message); }
  };
  return { open, toggle: () => { if (open) cancel(); else { setOpen(true); setView('all'); } }, cancel, mode, setMode, corners, setCorners, tolerance, setTolerance, outlineMode, setOutlineMode, contour,
    onContour: setContour, begin: () => { setContour([]); setView('all'); setPickError(''); }, gestureKey, cancelGesture: () => setGestureKey(v => v + 1),
    seeds, addSurface, setAddSurface, pick, approximate, setApproximate, accepted, setAccepted, untinted, setUntinted, view, setView, contrast, setContrast, wires, setWires,
    plan: result.plan, preview, error: pickError || result.error, apply };
}
