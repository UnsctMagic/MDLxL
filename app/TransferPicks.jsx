import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ToolWindow from './ToolWindow.jsx';
import TransferViewStrip from './TransferViewStrip.jsx';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import { useEditorArea } from './editor-area.js';
import { readPreviewModel } from './transfer-files.js';
import { buildTransfer, transferPreviewModel, transferRig } from '../src/anim-transfer.js';
import { jointPath, pathMarker } from '../src/transfer-window.js';
import { caseLetters, firstOpenCase, lookNodes, parseAnswers, parseCases, withAnswer } from '../src/transfer-picks.js';
import './resource-editors.css';
import './transfer.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const FLIP_MS = 500;
// The Transfer rig of a model (roles of its joints), read once per model object.
const rigs = new WeakMap();
const rigOf = model => { if (!rigs.has(model)) { let rig = null; try { rig = transferRig(model); } catch { rig = null; } rigs.set(model, rig); } return rigs.get(model); };
// A model's own size for framing: its hip height, else a third of its rest mesh's diagonal.
function modelSize(model) {
  const hip = rigOf(model)?.hipHeight;
  if (hip > 0) return hip;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const geoset of model.Geosets || []) for (let i = 0; i < geoset.Vertices.length; i++) { min[i % 3] = Math.min(min[i % 3], geoset.Vertices[i]); max[i % 3] = Math.max(max[i % 3], geoset.Vertices[i]); }
  const diagonal = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  return Number.isFinite(diagonal) && diagonal > 0 ? diagonal / 3 : 1;
}

/**
 * The Transfer pick sheet and compare sheet, for test builds only: started with
 * --transfer-picks="<cases .json>", it shows each case's variants as live views side by side (one
 * camera, one clock) and writes the owner's pick or answer to the answers file. Variants are Transfer
 * recipes (built here) or finished model files (their animations chosen by name). Looks frame and
 * highlight where to look; Flip shows two variants in one place. English only (translate="no"); no
 * hotkey ids. Contract: docs/agent-tasks/transfer-xl.md "Pick sheet as built" and "Compare sheet".
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

const trimmed = name => String(name ?? '').trim();
/** A model's animation by name: exact (trimmed), else the same ignoring case; -1 when it has none. */
function sequenceByName(model, name) {
  const list = (model?.Sequences || []).map(sequence => trimmed(sequence.Name)), wanted = trimmed(name);
  const exact = list.indexOf(wanted);
  return exact >= 0 ? exact : list.findIndex(item => item.toLowerCase() === wanted.toLowerCase());
}
/** Animation names every model has, in the first model's order. */
const commonNames = models => (models[0]?.Sequences || []).map(sequence => trimmed(sequence.Name)).filter(name => models.every(model => sequenceByName(model, name) >= 0));

function PickSheet({ sheet, teamColor, onClose }) {
  const dialog = useRef(null);
  useEditorArea(dialog);
  const cases = sheet.cases || [];
  const [answers, setAnswers] = useState(sheet.answers || {});
  const [index, setIndex] = useState(() => firstOpenCase(cases, sheet.answers || {}));
  const [problem, setProblem] = useState('');
  const item = cases[index];
  const done = !sheet.error && index >= cases.length;
  const fileCase = item?.kind === 'file';

  // Models of the shown case: recipe cases read the case model and its donors, file cases each
  // variant's file, all with their textures.
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
        if (item.kind === 'file') {
          const records = {};
          for (const variant of item.variants) records[variant.id] = await read(variant.file);
          if (live) setLoaded({ id: item.id, files: records });
          return;
        }
        const model = await read(item.model), donors = {};
        for (const [key, file] of Object.entries(item.donors)) donors[key] = await read(file);
        if (live) setLoaded({ id: item.id, model, donors });
      } catch (error) { if (live) setLoaded({ id: item.id, error: error.message }); }
    })();
    return () => { live = false; };
  }, [item?.id]);
  const ready = !!item && loaded?.id === item.id && !loaded.error;

  // File cases: the animation every view plays, by name; the row lists the case's names or those all share.
  const names = useMemo(() => !fileCase || !ready ? [] : item.sequences.length ? item.sequences : commonNames(item.variants.map(variant => loaded.files[variant.id].model)), [item?.id, ready]);
  const [animation, setAnimation] = useState('');
  useEffect(() => { setAnimation(names[0] || ''); }, [names]);

  // Each view: a recipe built the way Transfer's result view builds it (a failure keeps the engine's
  // sentence), or a file's model on the chosen animation (a view without it says so).
  const letters = useMemo(() => item ? caseLetters(item) : {}, [item?.id]);
  const views = useMemo(() => {
    if (!ready) return [];
    return Object.entries(letters).map(([letter, id]) => {
      const variant = item.variants.find(entry => entry.id === id), label = variant.label;
      if (fileCase) {
        const record = loaded.files[id], sequenceIndex = sequenceByName(record.model, animation);
        if (sequenceIndex < 0) return { letter, id, label, error: `No "${animation}" animation in this model.` };
        return { letter, id, label, preview: { model: record.model, sequenceIndex }, assets: record.assets, path: variant.file, interval: record.model.Sequences[sequenceIndex].Interval };
      }
      const model = loaded.model.model, sources = new Map(Object.entries(loaded.donors).map(([key, record]) => [key, record.model]));
      try {
        const built = buildTransfer(model, sources, variant.recipe), made = transferPreviewModel(model, built, variant.recipe);
        // As Transfer does: framing uses the body animation's own box.
        const own = made.model.Sequences[made.sequenceIndex], base = model.Sequences[variant.recipe.base.sequence];
        if (base?.MinimumExtent && base?.MaximumExtent) { own.MinimumExtent = Float32Array.from(base.MinimumExtent); own.MaximumExtent = Float32Array.from(base.MaximumExtent); }
        return { letter, id, label, preview: made, assets: loaded.model.assets, path: item.model, interval: own.Interval };
      } catch (error) { return { letter, id, label, error: error.message || 'This variant could not be built.' }; }
    });
  }, [item?.id, ready, loaded, letters, animation]);

  // Flip: two variants in one place, on the same camera and clock; held key or button, or every 0.5 s.
  const [flip, setFlip] = useState(false), [pair, setPair] = useState([]), [second, setSecond] = useState(false), [auto, setAuto] = useState(false);
  useEffect(() => { setFlip(false); setSecond(false); setAuto(false); setPair(item ? item.flip || item.variants.slice(0, 2).map(variant => variant.id) : []); }, [item?.id]);
  useEffect(() => {
    if (!flip || !auto) return undefined;
    const timer = setInterval(() => setSecond(value => !value), FLIP_MS);
    return () => clearInterval(timer);
  }, [flip, auto]);
  const shownId = flip ? pair[second ? 1 : 0] : null;
  const active = view => !flip || pair.includes(view.id);

  // One camera and one clock for every view of a case. The clock is the time from the animation's
  // start; each view plays it inside its own animation. The first playing view reports it.
  // File cases (models of different sizes) share only the viewing direction (turnCamera): each view keeps
  // its own target and distance, so each frames the same body part at its own size. Recipe cases (one
  // model) share the whole camera.
  const camera = useMemo(() => ({ saved: null, listeners: new Set() }), [item?.id]);
  const [clock, setClock] = useState(0), [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(100);
  const reporter = views.find(view => view.preview && active(view) && (!flip || view.id === pair[0])) || views.find(view => view.preview && active(view));
  const reporterRef = useRef(null); reporterRef.current = reporter;
  const onReport = useCallback(frame => { const view = reporterRef.current; if (view) setClock(Math.max(0, frame - view.interval[0])); }, []);
  const captures = useRef(new Map()), captureHandlers = useRef(new Map()), [captureTick, setCaptureTick] = useState(0);
  const onCaptureFor = id => {
    if (!captureHandlers.current.has(id)) captureHandlers.current.set(id, api => { captures.current.set(id, api); setCaptureTick(tick => tick + 1); });
    return captureHandlers.current.get(id);
  };
  const capture = () => reporter && captures.current.get(reporter.id);

  // Looks: one animation, only its window looping, slow, framed close on the bones, which are
  // highlighted in every view (their path over the window and where they are now).
  const [lookIndex, setLookIndex] = useState(null), speedBefore = useRef(100), frameLook = useRef(false);
  const look = item && lookIndex != null ? item.looks[lookIndex] : null;
  useEffect(() => { setLookIndex(null); setClock(0); setPlaying(true); setSpeed(100); frameLook.current = false; }, [item?.id]);
  const leaveLook = () => { setLookIndex(null); setSpeed(speedBefore.current); };
  const enterLook = at => {
    if (lookIndex === at) { leaveLook(); return; }
    const next = item.looks[at];
    if (lookIndex == null) speedBefore.current = speed;
    setLookIndex(at); setAnimation(next.sequence); setSpeed(next.speed); setClock(next.from); setPlaying(true); frameLook.current = true;
  };
  const chooseAnimation = name => { if (look) leaveLook(); setAnimation(name); setClock(0); };
  // The look's bones in each view: by name, else by their role in the Transfer rig (lookNodes).
  const paths = useMemo(() => {
    if (!look) return {};
    const shown = views.filter(view => view.preview), out = {};
    const marks = lookNodes(shown.map(view => ({ id: view.id, model: view.preview.model, rig: fileCase ? rigOf(view.preview.model) : null })), look.bones);
    for (const view of shown) {
      const { model, sequenceIndex } = view.preview, start = view.interval[0], found = [];
      for (const id of marks[view.id].ids) {
        const path = jointPath(model, sequenceIndex, id, 1000 / 30, [start + look.from, start + look.to]);
        if (path.points.length > 1) found.push(path);
      }
      out[view.id] = { found, none: !marks[view.id].ids.length };
    }
    return out;
  }, [look, views]);
  // Framing a look. File cases: every view on its own marked bones, at a distance scaled to its own
  // model's size (the largest share of size any view's marks need), so the same part shows at the same
  // size in every view and Flip lines up on the bones. Recipe cases: the shared camera on all marks.
  useEffect(() => {
    if (!frameLook.current || !look) return;
    const marked = views.filter(view => paths[view.id]?.found.length);
    if (!marked.length) return;
    if (!fileCase) {
      const api = capture(); if (!api) return;
      frameLook.current = false; api.fit(marked.flatMap(view => paths[view.id].found.flatMap(path => path.points.flat()))); return;
    }
    if (marked.some(view => !captures.current.get(view.id))) return;
    const frames = marked.map(view => {
      const points = paths[view.id].found.flatMap(path => path.points), size = modelSize(view.preview.model);
      const center = [0, 1, 2].map(axis => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
      const reach = Math.max(...points.map(point => Math.hypot(point[0] - center[0], point[1] - center[1], point[2] - center[2])));
      return { view, center, size, share: reach / size };
    });
    const share = Math.max(.3, ...frames.map(frame => frame.share));
    frameLook.current = false;
    for (const { view, center, size } of frames) {
      const r = share * size;
      // Two points 2r apart: GamePreview frames a radius of 1.5 r around their middle.
      captures.current.get(view.id).fit([center[0] - r, center[1], center[2], center[0] + r, center[1], center[2]]);
    }  }, [paths, look, captureTick, flip]);

  const answer = async pick => {
    if (!item) return;
    const next = withAnswer(answers, item, pick);
    try { await window.desktop.writeTransferPicks(sheet.answersPath, JSON.stringify(next, null, 2)); }
    catch (error) { setProblem(`The answer was not saved: ${error.message}`); return; }
    setProblem(''); setAnswers(next); setIndex(i => i + 1);
  };
  const back = () => { setProblem(''); setIndex(i => Math.max(0, i - 1)); };
  const picked = item ? answers[item.id]?.pick : null;
  const choices = item?.choices || [];

  useWindowKeyClaim(({ event, localWindow }) => {
    if (!dialog.current || !(localWindow === dialog.current || dialog.current.contains(event.target)) || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (event.target?.closest?.('select,input:not([type=range])')) return false;
    if (flip && (event.key === 'f' || event.key === 'F')) { if (!event.repeat) setSecond(true); return true; }
    if (event.repeat) return false;
    if (event.key === 'Escape' && look) { leaveLook(); return true; }
    if (event.key === ' ') { setPlaying(value => !value); return true; }
    if (choices.length) return false;
    const letter = event.key.length === 1 ? event.key.toUpperCase() : '';
    const view = views.find(entry => entry.letter === letter);
    if (!view?.preview) return false;
    answer(view.id); return true;
  }, 5);
  useEffect(() => {
    if (!flip) return undefined;
    const up = event => { if (event.key === 'f' || event.key === 'F') setSecond(false); };
    window.addEventListener('keyup', up);
    return () => window.removeEventListener('keyup', up);
  }, [flip]);
  useEffect(() => { dialog.current?.focus(); }, []);

  const count = flip ? 1 : Math.max(1, views.length);
  const duration = reporter ? reporter.interval[1] - reporter.interval[0] : 1;
  const holdSecond = value => () => setSecond(value);
  return <ToolWindow title="Pick sheet" overlayClass="resource-editor transfer-xl transfer-picks" className="re-window xf-window xp-window" headerClass="re-caption" closeClass="re-caption-close" windowRef={dialog} onClose={onClose} sectionProps={{ translate: 'no' }}>
    {sheet.error ? <div className="xp-message" role="alert"><b>The cases file cannot be used.</b><p>{sheet.error}</p><p className="xp-path">{sheet.path}</p></div>
      : done ? <div className="xp-message" role="status"><b>Done. You can close this window.</b>{cases.length > 0 && <div className="xp-footer"><button onClick={back}>Back</button></div>}</div>
      : <div className="xp-body">
        <div className="xp-head">
          <div className="xp-question"><b>{item.question}</b>{item.hint && <span>{item.hint}</span>}</div>
          <span className="xp-count">{`${index + 1} / ${cases.length}`}</span>
        </div>
        {fileCase && names.length > 0 && <div className="xp-row" role="group" aria-label="Animation">
          <span className="xp-row-name">Animation</span>
          {names.map(name => <button key={name} aria-pressed={animation === name} onClick={() => chooseAnimation(name)}>{name}</button>)}
        </div>}
        {item.looks.length > 0 && <div className="xp-row" role="group" aria-label="Look here">
          <span className="xp-row-name">Look</span>
          {item.looks.map((entry, at) => <button key={at} className="xp-look" aria-pressed={lookIndex === at} title="Plays only this moment, slowly, close up, with these bones marked. Click again or press Esc to leave." onClick={() => enterLook(at)}>{entry.label}</button>)}
        </div>}
        <div className="xp-row" role="group" aria-label="Flip">
          <button aria-pressed={flip} disabled={views.filter(view => view.preview).length < 2} title="Shows two views in one place, on the same camera and moment, so a small difference jumps out." onClick={() => { setFlip(value => !value); setSecond(false); if (look) frameLook.current = true; }}>Flip</button>
          {flip && <>
            {[0, 1].map(slot => <select key={slot} aria-label={slot ? 'Second view' : 'First view'} value={pair[slot] || ''} onChange={event => setPair(old => { const next = [...old]; next[slot] = event.target.value; if (next[0] === next[1]) next[1 - slot] = old[slot]; return next; })}>
              {views.filter(view => view.preview).map(view => <option key={view.id} value={view.id}>{view.label ? `${view.letter} ${view.label}` : view.letter}</option>)}
            </select>)}
            <button className="xp-hold" aria-pressed={second} title="Hold to show the second view (or hold F)." onPointerDown={holdSecond(true)} onPointerUp={holdSecond(false)} onPointerLeave={holdSecond(false)} onPointerCancel={holdSecond(false)}>Hold to swap</button>
            <label className="xp-auto"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)}/>Every 0.5 s</label>
          </>}
        </div>
        <div className={`xp-views${flip ? ' xp-flipping' : ''}`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {!ready ? (loaded?.id === item.id && loaded.error ? <div className="xp-message" role="alert">{loaded.error}</div> : <div className="xf-placeholder xp-loading">Loading models…</div>)
            : views.map(view => {
              const on = active(view), shown = !flip || view.id === shownId, start = view.interval?.[0] ?? 0, time = Math.min(view.interval?.[1] ?? 0, start + clock), marked = paths[view.id];
              const overlay = marked?.found.length ? marked.found.map(path => ({ points: path.points, motion: true, width: 3, alpha: .95, marker: pathMarker(path.frames, time) })) : undefined;
              return <section key={`${item.id}:${view.id}`} className={`xp-view${shown ? '' : ' xp-off'}`} aria-label={`Variant ${view.letter}`} aria-hidden={shown ? undefined : true}>
                <div className="xf-preview">
                  <span className="xp-letter" aria-hidden="true">{view.letter}</span>
                  {view.label && <span className="xp-label">{view.label}</span>}
                  {marked?.none && <span className="xp-missing">Not in this model</span>}
                  {view.preview ? <Suspense fallback={<span className="xf-note">Loading preview…</span>}>
                    <GamePreview presentation="preview" resetViewButton={false} interactivePreview fitModel fitSequenceExtent fitBox showGrid={false} showAxes={false} preserveCameraView
                      model={view.preview.model} revision={`${item.id}|${view.id}`} textureAssets={view.assets} modelPath={view.path} teamColor={teamColor}
                      sequenceIndex={view.preview.sequenceIndex} time={time} onTimeChange={view === reporter ? onReport : undefined} playing={playing} playbackSpeed={speed} loop
                      playbackRange={look ? [start + look.from, start + look.to] : undefined} overlayPaths={overlay} suspended={!on}
                      compareCamera={fileCase ? undefined : camera} turnCamera={fileCase ? camera : undefined} cleanAnimationPreview emptyDragRotates onCaptureReady={onCaptureFor(view.id)}/>
                  </Suspense> : <div className="xp-failed" role="status">{view.error}</div>}
                </div>
                {!choices.length && <button className="xp-pick" aria-pressed={picked === view.id} disabled={!view.preview} onClick={() => answer(view.id)}>{`Pick ${view.letter}`}</button>}
              </section>;
            })}
        </div>
        <TransferViewStrip plain name="Views" playing={playing} onPlay={() => setPlaying(value => !value)} playTitle="Play or pause every view." onReset={() => { if (fileCase) for (const view of views) captures.current.get(view.id)?.resetView(); else capture()?.resetView(); }}
          interval={[0, Math.max(1, duration)]} time={clock} onSeek={value => { setPlaying(false); setClock(value); }} speed={speed} onSpeed={setSpeed} disabled={!reporter}/>
        {problem && <p className="xp-problem" role="alert">{problem}</p>}
        <div className="xp-footer">
          {choices.length ? choices.map(choice => <button key={choice.id} className="xp-answer" aria-pressed={picked === choice.id} onClick={() => answer(choice.id)}>{choice.label}</button>)
            : <>
              <button aria-pressed={picked === 'same'} onClick={() => answer('same')}>No difference</button>
              <button aria-pressed={picked === 'none'} onClick={() => answer('none')}>None looks right</button>
            </>}
          <span className="xf-spacer"/>
          <button disabled={index === 0} onClick={back}>Back</button>
        </div>
      </div>}
  </ToolWindow>;
}
