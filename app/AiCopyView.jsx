import React, { Suspense, lazy, useEffect, useMemo, useReducer, useRef } from 'react';
import { X } from 'lucide-react';
const GamePreview = lazy(() => import('./GamePreview.jsx'));

// Peek and Compare for a chat job on its own copy of the model. Peek shows the AI's
// copy while it works; Compare shows the AI's result next to the user's version
// when both changed the same parts. Both are view only, with the same preview and
// mouse camera as OptimizeXL's Before/After. Their camera is their own: looking
// around here never moves the editor, the AI's view or the AI's pictures.
export default function AiCopyView({ bridge, preferences, teamColor }) {
  const [, redraw] = useReducer(n => n + 1, 0);
  useEffect(() => bridge.subscribe(redraw), [bridge]);
  const job = [...bridge.copyJobs.values()].find(j => j.view);
  const models = job && bridge.copyModels(job.target);
  // Compare's two previews turn together, as OptimizeXL's do.
  const camera = useRef({ saved: null, listeners: new Set() });
  const previewPreferences = useMemo(() => ({ ...preferences, wheelMode: 'rotate' }), [preferences]);
  const aiRevision = models?.ai.revision,
    liveRevision = models?.live?.revision;
  // The renderer gets its own copy, so it never touches either document.
  const ai = useMemo(() => models && structuredClone(models.ai.model), [job?.target, aiRevision]);
  const live = useMemo(() => models?.live && job.view === 'compare' && structuredClone(models.live.model), [job?.target, job?.view, liveRevision]);
  if (!job || !models) return null;
  const close = () => bridge.setCopyView(job.target, job.view);
  const props = {
    pixelAligned: true,
    textureAssets: models.assets,
    modelPath: models.path,
    preferences: previewPreferences,
    teamColor,
    presentation: 'preview',
    overlays: { grid: false, axes: false, boneLines: false },
    showGrid: false,
    showAxes: false,
    playing: false,
    sequenceIndex: -1,
    time: 0,
    cameraMode: 'rotate',
    preserveCameraView: true,
  };
  const compare = job.view === 'compare';
  return (
    <div className="ai-copy-view" role="dialog" aria-label={compare ? 'Compare side by side' : "Peek at the AI's copy"}>
      <header>
        <strong>{compare ? 'Compare side by side' : "Peek at the AI's copy"}</strong>
        <span>{compare ? 'Drag to look around. Pick the version to keep.' : 'View only. Drag to look around; the AI is not disturbed.'}</span>
        <button type="button" className="ai-icon-button" aria-label="Close" title="Close." onClick={close}>
          <X size={13} aria-hidden="true" />
        </button>
      </header>
      <main className={compare ? 'ai-copy-pair' : ''}>
        <section className="ai-copy-preview" aria-label="AI result">
          {compare && <h3>AI result</h3>}
          <Suspense fallback={null}>
            <GamePreview {...props} {...(compare ? { compareCamera: camera.current } : {})} model={ai} revision={aiRevision} />
          </Suspense>
        </section>
        {compare && live && (
          <section className="ai-copy-preview" aria-label="Your version">
            <h3>Your version</h3>
            <Suspense fallback={null}>
              <GamePreview {...props} compareCamera={camera.current} model={live} revision={liveRevision} />
            </Suspense>
          </section>
        )}
      </main>
      {compare && (
        <footer>
          <button type="button" className="ai-good-button" title="Keep the AI's version of the parts you both changed. Your other edits stay. One Undo step." onClick={() => bridge.resolveCopy(job.target, 'ai')}>
            Keep AI result
          </button>
          <button type="button" title="Keep your model as it is. The AI's result is dropped." onClick={() => bridge.resolveCopy(job.target, 'yours')}>
            Keep yours
          </button>
        </footer>
      )}
    </div>
  );
}
