import React, { useMemo, useState } from 'react';
import Viewport from './Viewport.jsx';
import { collectedPartModel, partHasGlobalAnimations, partLook, partRgbOptions, previewPart, serializeCollectedPart } from '../src/bits-and-parts.js';
import PartRgb from './PartRgb.jsx';
import { validateModel } from '../src/editor-document.js';

export default function CollectBit({ source, textureAssets, teamColor, onClose, onSaved }) {
  const [name, setName] = useState(''), [rgb, setRgb] = useState(0), [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const rgbOptions = useMemo(() => partRgbOptions(source), [source]), hasGlobals = useMemo(() => partHasGlobalAnimations(source), [source]);
  const preview = useMemo(() => previewPart(partLook(source, rgbOptions[rgb])), [source, rgbOptions, rgb]);
  // A Bit with global animations asks whether to keep them.
  const save = async (keepGlobals = null) => {
    if (hasGlobals && keepGlobals === null) { setAsking(true); return; }
    setAsking(false); setBusy(true); setError('');
    try {
      const model = collectedPartModel(source, { name, keepGlobals: keepGlobals !== false });
      const issues = validateModel(model).filter(issue => issue.severity === 'error');
      if (issues.length) throw Error(issues[0].message);
      const result = await window.desktop.savePart({ name: name.trim(), bytes: serializeCollectedPart(model) });
      await onSaved(result);
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  return <div className="parts-overlay"><section data-hotkey-prefix="collect-bit" className="parts-dialog parts-collect-dialog" role="dialog" aria-modal="true" aria-label="Collect Bit">
    <header><h2>Collect Bit</h2><button onClick={onClose} disabled={busy} data-hotkey="close" aria-label="Close Collect Bit">✕</button></header>
    <div className="parts-body"><aside>
      <label className="parts-collect-name">Bit name<input autoFocus aria-label="Bit name" value={name} onChange={event => setName(event.target.value)}/></label>
      <p className="parts-note">{source.Geosets.length} geosets · {source.Geosets.reduce((count, geoset) => count + geoset.Vertices.length / 3, 0)} selected vertices</p>
      <PartRgb options={rgbOptions} value={rgb} onChange={setRgb} busy={busy}/>
    </aside><main><div className="parts-preview"><Viewport presentation="preview" model={preview} revision={0} textureAssets={textureAssets} teamColor={teamColor} mode="textured" view="perspective" cameraMode="rotate" showGrid={false} showSkeleton={false} showVertices={false} overlays={{}} selectedGeoset={-1} sequenceIndex={-1} time={0} playing={false} shaded/></div>
    </main></div>{error && <div className="parts-error" role="alert">{error}</div>}<footer>{asking ? <><span>Keep global animations?</span><button onClick={() => save(true)}>Yes</button><button onClick={() => save(false)}>No</button></> : <><span>Saved in BitsAndParts with original texture paths.</span><button onClick={onClose} disabled={busy}>Cancel</button><button className="parts-import" disabled={busy || !name.trim()} onClick={() => save()}>{busy ? 'Saving…' : 'Save Bit'}</button></>}</footer>
  </section></div>;
}
