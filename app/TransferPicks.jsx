import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ToolWindow from './ToolWindow.jsx';
import TransferViewStrip from './TransferViewStrip.jsx';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import { useEditorArea } from './editor-area.js';
import { readPreviewModel } from './transfer-files.js';
import { buildTransfer, transferPreviewModel } from '../src/anim-transfer.js';
import { caseLetters, firstOpenCase, parseAnswers, parseCases, withAnswer } from '../src/transfer-picks.js';
import './resource-editors.css';
import './transfer.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));

/**
 * The Transfer pick sheet, for test builds only: started with --transfer-picks="<cases .json>", it
 * shows each case's variants as live views side by side (one camera, one clock) and writes the owner's
 * pick to the answers file. English only (translate="no"); no hotkey ids. Contract:
 * docs/agent-tasks/transfer-xl.md "Pick sheet as built".
 * `found` is what window.desktop.transferPicks() returned: { path, text, answers } or { error }.
 */
export default function TransferPicks({ found, teamColor }) {
  const [closed, setClosed] = useState(false);
  const sheet = useMemo(() => {
    if (found.error) return { path: found.path || '', error: found.error };
    try { const { answers, cases } = parseCases(found.text); return { path: found.path, answersPath: answers, cases, answers: parseAnswers(found.answers) }; }
    catch (error) { return { path: found.path, error: error.message }; }
  }, [found]);
  if (closed) return null;
  return <PickSheet sheet={sheet} teamColor={teamColor} onClose={() => setClosed(true)}/>;
}

function PickSheet({ sheet, teamColor, onClose }) {
  const dialog = useRef(null);
  useEditorArea(dialog);
  const cases = sheet.cases || [];
  const [answers, setAnswers] = useState(sheet.answers || {});
  const [index, setIndex] = useState(() => firstOpenCase(cases, sheet.answers || {}));
  const [problem, setProblem] = useState('');
  const item = cases[index];
  const done = !sheet.error && index >= cases.length;

  // Models of the shown case: the case model and its donors, read from their files with their textures.
  const files = useRef(new Map()), releases = useRef([]);
  useEffect(() => () => { for (const release of releases.current) release(); }, []);
  const read = useCallback(file => {
    if (!files.current.has(file)) files.current.set(file, readPreviewModel(file).then(record => { releases.current.push(record.release); return record; }));
    return files.current.get(file);
  }, []);
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (!item) return undefined;
    let live = true; setLoaded(null);
    (async () => {
      try {
        const model = await read(item.model), donors = {};
        for (const [key, file] of Object.entries(item.donors)) donors[key] = await read(file);
        if (live) setLoaded({ id: item.id, model, donors });
      } catch (error) { if (live) setLoaded({ id: item.id, error: error.message }); }
    })();
    return () => { live = false; };
  }, [item?.id]);

  // Each variant built the way Transfer's result view builds it; a failure keeps the engine's sentence.
  const letters = useMemo(() => item ? caseLetters(item) : {}, [item?.id]);
  const views = useMemo(() => {
    if (!item || loaded?.id !== item.id || !loaded.model) return [];
    const model = loaded.model.model, sources = new Map(Object.entries(loaded.donors).map(([key, record]) => [key, record.model]));
    return Object.entries(letters).map(([letter, id]) => {
      const recipe = item.variants.find(variant => variant.id === id).recipe;
      try {
        const built = buildTransfer(model, sources, recipe), made = transferPreviewModel(model, built, recipe);
        // As Transfer does: framing uses the body animation's own box.
        const own = made.model.Sequences[made.sequenceIndex], base = model.Sequences[recipe.base.sequence];
        if (base?.MinimumExtent && base?.MaximumExtent) { own.MinimumExtent = Float32Array.from(base.MinimumExtent); own.MaximumExtent = Float32Array.from(base.MaximumExtent); }
        return { letter, id, preview: made, interval: own.Interval };
      } catch (error) { return { letter, id, error: error.message || 'This variant could not be built.' }; }
    });
  }, [item?.id, loaded, letters]);
  const first = views.find(view => view.preview);

  // One camera and one clock for every view of a case. A new case frames anew.
  const camera = useMemo(() => ({ saved: null, listeners: new Set() }), [item?.id]);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(100);
  useEffect(() => { setTime(first?.interval[0] ?? 0); setPlaying(true); }, [item?.id, !!first]);
  const capture = useRef(null), onCapture = useCallback(api => { capture.current = api; }, []);

  const answer = async pick => {
    if (!item) return;
    const next = withAnswer(answers, item, pick);
    try { await window.desktop.writeTransferPicks(sheet.answersPath, JSON.stringify(next, null, 2)); }
    catch (error) { setProblem(`The answer was not saved: ${error.message}`); return; }
    setProblem(''); setAnswers(next); setIndex(i => i + 1);
  };
  const back = () => { setProblem(''); setIndex(i => Math.max(0, i - 1)); };
  const picked = item ? answers[item.id]?.pick : null;

  useWindowKeyClaim(({ event, localWindow }) => {
    if (!dialog.current || !(localWindow === dialog.current || dialog.current.contains(event.target)) || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return false;
    if (event.target?.closest?.('select,input:not([type=range])')) return false;
    if (event.key === ' ') { setPlaying(value => !value); return true; }
    const letter = event.key.length === 1 ? event.key.toUpperCase() : '';
    const view = views.find(entry => entry.letter === letter);
    if (!view?.preview) return false;
    answer(view.id); return true;
  }, 5);
  useEffect(() => { dialog.current?.focus(); }, []);

  const count = Math.max(1, views.length);
  return <ToolWindow title="Pick sheet" overlayClass="resource-editor transfer-xl transfer-picks" className="re-window xf-window xp-window" headerClass="re-caption" closeClass="re-caption-close" windowRef={dialog} onClose={onClose} sectionProps={{ translate: 'no' }}>
    {sheet.error ? <div className="xp-message" role="alert"><b>The cases file cannot be used.</b><p>{sheet.error}</p><p className="xp-path">{sheet.path}</p></div>
      : done ? <div className="xp-message" role="status"><b>Done. You can close this window.</b>{cases.length > 0 && <div className="xp-footer"><button onClick={back}>Back</button></div>}</div>
      : <div className="xp-body">
        <div className="xp-head">
          <div className="xp-question"><b>{item.question}</b>{item.hint && <span>{item.hint}</span>}</div>
          <span className="xp-count">{`${index + 1} / ${cases.length}`}</span>
        </div>
        <div className="xp-views" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {loaded?.id !== item.id ? <div className="xf-placeholder xp-loading">Loading models…</div>
            : loaded.error ? <div className="xp-message" role="alert">{loaded.error}</div>
            : views.map(view => <section key={`${item.id}:${view.id}`} className="xp-view" aria-label={`Variant ${view.letter}`}>
              <div className="xf-preview">
                <span className="xp-letter" aria-hidden="true">{view.letter}</span>
                {view.preview ? <Suspense fallback={<span className="xf-note">Loading preview…</span>}>
                  <GamePreview presentation="preview" resetViewButton={false} interactivePreview fitModel fitSequenceExtent fitBox showGrid={false} showAxes={false} preserveCameraView
                    model={view.preview.model} revision={`${item.id}|${view.id}`} textureAssets={loaded.model.assets} modelPath={item.model} teamColor={teamColor}
                    sequenceIndex={view.preview.sequenceIndex} time={time} onTimeChange={view === first ? setTime : undefined} playing={playing} playbackSpeed={speed} loop
                    compareCamera={camera} cleanAnimationPreview emptyDragRotates onCaptureReady={view === first ? onCapture : undefined}/>
                </Suspense> : <div className="xp-failed" role="status">{view.error}</div>}
              </div>
              <button className="xp-pick" aria-pressed={picked === view.id} disabled={!view.preview} onClick={() => answer(view.id)}>{`Pick ${view.letter}`}</button>
            </section>)}
        </div>
        <TransferViewStrip plain name="Views" playing={playing} onPlay={() => setPlaying(value => !value)} playTitle="Play or pause every view." onReset={() => capture.current?.resetView()}
          interval={first?.interval || [0, 1]} time={time} onSeek={value => { setPlaying(false); setTime(value); }} speed={speed} onSpeed={setSpeed} disabled={!first}/>
        {problem && <p className="xp-problem" role="alert">{problem}</p>}
        <div className="xp-footer">
          <button aria-pressed={picked === 'same'} onClick={() => answer('same')}>No difference</button>
          <button aria-pressed={picked === 'none'} onClick={() => answer('none')}>None looks right</button>
          <span className="xf-spacer"/>
          <button disabled={index === 0} onClick={back}>Back</button>
        </div>
      </div>}
  </ToolWindow>;
}

