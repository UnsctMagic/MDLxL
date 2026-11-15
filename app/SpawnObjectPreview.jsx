import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { gamePathKey } from '../src/game-path.js';

const GamePreview = lazy(() => import('./GamePreview.jsx'));

export default function SpawnObjectPreview({ model, modelPath, teamColor, loading }) {
  const camera = useRef(null);
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (!model) return;
    let active = true;
    const names = model.Textures.filter(texture => texture.Image && ![1, 2].includes(texture.ReplaceableId)).map(texture => texture.Image);
    window.desktop.resolveEventResources({ names, path: modelPath }).then(records => {
      if (active) setLoaded({ model, modelPath, assets: new Map(records.map(record => [gamePathKey(record.name), record])) });
    }, () => {
      if (active) setLoaded({ model, modelPath, error: 'Could not load preview textures' });
    });
    return () => { active = false; };
  }, [model, modelPath]);

  if (!model && !loading) return null;
  const current = loaded && loaded.model === model && loaded.modelPath === modelPath ? loaded : null;
  if (current?.error) return <p className="field-error" role="alert">{current.error}</p>;
  return <div className="re-model-stage" role="region" aria-label="Spawn Object preview">
    <Suspense fallback={<span role="status">Loading preview…</span>}>
      {current ? <GamePreview model={model} modelPath={modelPath} textureAssets={current.assets} teamColor={teamColor}
        presentation="preview" interactivePreview cameraMode="rotate" cameraHandoff={camera} preserveCameraView
        fitModel fitSequenceExtent sequenceIndex={0} playing showParticles showGrid={false} view="perspective"/>
        : <span role="status">Loading preview…</span>}
    </Suspense>
  </div>;
}
