import React, { useMemo, useState } from 'react';
import Viewport from './Viewport.jsx';
import { collectedPartModel, partPathKey, partTextureIndices, previewPart, serializeCollectedPart } from '../src/bits-and-parts.js';
import PartAnimations from './PartAnimations.jsx';
import { validateModel } from '../src/editor-document.js';

export default function CollectBit({ source, preferences, textureAssets, teamColor, prepareAsset, onClose, onSaved }) {
  const [name, setName] = useState(''), [animations, setAnimations] = useState(null), [sequence, setSequence] = useState(''), [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const preview = useMemo(() => previewPart(source), [source]);
  const interval = source.Sequences[Number(sequence)]?.Interval;
  const save = async () => {
    setBusy(true); setError('');
    try {
      const model = collectedPartModel(source, { name, animations }), assets = [];
      for (const index of partTextureIndices(model)) {
        const texture = model.Textures[index];
        if (texture.ReplaceableId || !texture.Image) continue;
        const asset = textureAssets.get(partPathKey(texture.Image));
        if (!asset) throw Error(`Missing texture: ${texture.Image}. Load it before collecting this Bit.`);
        const prepared = await prepareAsset(asset); texture.Image = prepared.name;
        if (!assets.some(existing => existing.name === prepared.name)) assets.push(prepared);
      }
      const issues = validateModel(model).filter(issue => issue.severity === 'error');
      if (issues.length) throw Error(issues[0].message);
      const result = await window.desktop.savePart({ name: name.trim(), bytes: serializeCollectedPart(model), assets });
      await onSaved(result);
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  return <div className="parts-overlay" onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); } }}><section className="parts-dialog parts-collect-dialog" role="dialog" aria-modal="true" aria-label="Collect Bit">
    <header><h2>Collect Bit</h2><button onClick={onClose} disabled={busy} aria-label="Close Collect Bit">✕</button></header>
    <div className="parts-body"><aside>
      <label className="parts-collect-name">Bit name<input autoFocus aria-label="Bit name" value={name} onChange={event => setName(event.target.value)}/></label>
      <p className="parts-note">{source.Geosets.length} geosets · {source.Geosets.reduce((count, geoset) => count + geoset.Vertices.length / 3, 0)} selected vertices</p>
      <PartAnimations model={source} animations={animations} onChange={setAnimations} sequence={sequence} onPreview={value => { setSequence(value); setPlaying(false); }} busy={busy}/>
    </aside><main><div className="parts-preview"><Viewport presentation="preview" model={preview} preferences={preferences} revision={0} textureAssets={textureAssets} teamColor={teamColor} mode="textured" view="perspective" cameraMode="free" showGrid={false} showSkeleton={false} showVertices={false} overlays={{}} selectedGeoset={-1} sequenceIndex={sequence === '' ? -1 : Number(sequence)} time={sequence === '' ? 0 : interval?.[0] || 0} playing={playing} shaded/></div>
      <button disabled={sequence === ''} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause preview' : 'Play preview'}</button>
    </main></div>{error && <div className="parts-error" role="alert">{error}</div>}<footer><span>Saved in BitsAndParts with its textures.</span><button onClick={onClose} disabled={busy}>Cancel</button><button className="parts-import" disabled={busy || !name.trim() || (animations !== null && (!animations.length || animations.some(animation => !animation.name.trim())))} onClick={save}>{busy ? 'Saving…' : 'Save Bit'}</button></footer>
  </section></div>;
}
