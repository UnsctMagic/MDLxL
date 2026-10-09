import React, { useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import { allNodes } from '../src/animation.js';
import { openDocument, validateModel } from '../src/editor-document.js';
import { animationImportObjects, animationImportSkeleton, importAnimation, suggestAnimationBoneMatches } from '../src/animation-importer.js';
import './animation-importer.css';

const pathKey = name => String(name || '').replaceAll('/', '\\').toLowerCase();
const bytesOf = async record => record.arrayBuffer ? new Uint8Array(await record.arrayBuffer()) : new Uint8Array(record.bytes);
const poseConfig = skeleton => ({ ...skeleton.rig, enabled: true, pins: [], target: null, inspectIds: [] });
const poseNodeId = (target, config) => target.kind === 'node' ? target.id : target.kind === 'body' ? config.body : config.chains.find(chain => chain.key === target.key)?.[target.kind === 'bend' ? 'middle' : 'end'];
const readonlyPose = () => false;

export default function AnimationImporter({ model, revision, modelName, modelPath, sequenceIndex, preferences, textureAssets, teamColor, onClose, onCommit }) {
  const [source, setSource] = useState(null), [assets, setAssets] = useState(new Map()), [sourceSequence, setSourceSequence] = useState(0);
  const [mode, setMode] = useState('replace'), [destinationSequence, setDestinationSequence] = useState(sequenceIndex >= 0 ? sequenceIndex : 0);
  const [matches, setMatches] = useState({}), [decisions, setDecisions] = useState({}), [time, setTime] = useState(0), [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [selectedSource, setSelectedSource] = useState([]), [selectedDestination, setSelectedDestination] = useState([]);
  const picker = useRef(null), dialog = useRef(null), generation = useRef(0);
  useEffect(() => { dialog.current?.focus(); return () => { generation.current++; }; }, []);
  const sourceSkeleton = useMemo(() => source ? animationImportSkeleton(source.model, sourceSequence) : null, [source, sourceSequence]);
  const destinationSkeleton = useMemo(() => animationImportSkeleton(model, destinationSequence), [model, revision, destinationSequence]);
  const fromPose = useMemo(() => sourceSkeleton ? poseConfig(sourceSkeleton) : null, [sourceSkeleton]);
  const extras = useMemo(() => source ? animationImportObjects(source.model, sourceSequence, matches) : [], [source, sourceSequence, matches]);
  const objectOptions = extras.map(item => ({ ...item, import: decisions[item.id]?.import === true, bindTo: decisions[item.id]?.bindTo ?? '' }));
  const options = { sourceSequence, mode, destinationSequence, matches, objects: objectOptions };
  const decisionKey = JSON.stringify(objectOptions);
  const preview = useMemo(() => {
    if (!source) return { model, sequenceIndex: destinationSequence };
    try { const draft = structuredClone(model); const result = importAnimation(draft, source.model, options); return { model: draft, ...result }; }
    catch (cause) { return { model, sequenceIndex: destinationSequence, error: cause.message }; }
  }, [source, model, revision, sourceSequence, mode, destinationSequence, matches, decisionKey]);
  const intoPose = useMemo(() => poseConfig(animationImportSkeleton(preview.model, preview.sequenceIndex)), [preview]);
  const interval = source?.model.Sequences[sourceSequence]?.Interval || [0, 1], targetInterval = preview.model.Sequences[preview.sequenceIndex]?.Interval || [0, 1];
  const destinationTime = targetInterval[0] + (time - interval[0]) * (targetInterval[1] - targetInterval[0]) / (interval[1] - interval[0]);
  const unanswered = extras.some(item => decisions[item.id]?.import == null);
  const choose = async record => {
    if (!record) return;
    const request = ++generation.current; setBusy(true); setError(''); setPlaying(false);
    try {
      const opened = openDocument(await bytesOf(record), record.name);
      if (opened.readOnly || !opened.model.Sequences.length || validateModel(opened.model).some(issue => issue.severity === 'error')) throw Error('Choose a readable model with valid references and animations.');
      const loaded = new Map(), records = window.desktop?.resolveTextures ? await window.desktop.resolveTextures({ path: record.path, names: opened.model.Textures.map(texture => texture.Image).filter(Boolean) }) : [];
      for (const asset of records) { const name = asset.logicalName || asset.texturePath || asset.name; loaded.set(pathKey(name), { ...asset, name }); }
      if (generation.current !== request) return;
      setSource({ model: opened.model, name: record.name, path: record.path }); setAssets(loaded); setSourceSequence(0); setTime(opened.model.Sequences[0].Interval[0]);
      setMatches(suggestAnimationBoneMatches(opened.model, model)); setDecisions({}); setSelectedSource([]); setSelectedDestination([]);
    } catch (cause) { if (generation.current === request) setError(cause.message); }
    finally { if (generation.current === request) setBusy(false); }
  };
  const selectFile = async () => {
    if (!window.desktop?.openShowcaseModel) { picker.current.click(); return; }
    try { await choose(await window.desktop.openShowcaseModel()); } catch (cause) { setError(cause.message); }
  };
  const commit = async () => {
    if (!source || unanswered || busy || preview.error) return;
    setError(''); setBusy(true); setPlaying(false);
    try { const result = await onCommit(source.model, options, assets); if (result !== false) onClose(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const match = (id, value) => { setMatches(prior => ({ ...prior, [id]: value === '' ? '' : Number(value) })); setDecisions({}); };
  const destinationNodes = allNodes(model), sourceNodes = sourceSkeleton?.nodes || [];
  const selectSource = ids => { setSelectedSource(ids); const target = matches[ids.at(-1)]; setSelectedDestination(target === '' || target == null ? [] : [Number(target)]); };
  const selectDestination = ids => { const original = preview.nodeIdMap ? ids.map(id => Object.keys(preview.nodeIdMap).find(key => preview.nodeIdMap[key] === id)).filter(id => id != null && destinationNodes.some(node => node.ObjectId === Number(id))).map(Number) : ids; setSelectedDestination(original); if (selectedSource.length === 1 && original.length === 1) match(selectedSource[0], original[0]); };
  const common = { modelPath, preferences, teamColor, view: 'perspective', cameraMode: 'work', transformMode: 'select', mode: 'textured', shaded: true, showGrid: false, showAxes: false, showNodes: true, showSkeleton: true, overlays: { bones: true, nodes: true, attachments: true, boneLines: true }, workplane: 'xy', multiple: false, playing: false, textureAssets };
  return <div className="animation-import-overlay" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !busy) onClose(); }}>
    <section className="animation-import-dialog" role="dialog" aria-modal="true" aria-label="Animation Importer" tabIndex={-1} ref={dialog}>
      <header><h2>Animation Importer</h2><button disabled={busy} onClick={selectFile}>Select model</button><button aria-label="Close Animation Importer" disabled={busy} onClick={onClose}>✕</button></header>
      <input hidden ref={picker} type="file" accept=".mdl,.mdx" onChange={event => { choose(event.target.files[0]); event.target.value = ''; }}/>
      <div className="animation-import-models">
        <section aria-label="Destination model"><strong>Importing INTO: {modelName}</strong><div className="animation-import-preview"><GamePreview {...common} model={preview.model} sequenceIndex={preview.sequenceIndex} time={destinationTime} poseConfig={intoPose} selectedNodeIds={selectedDestination.map(id => preview.nodeIdMap?.[id] ?? id)} onSelectNodes={selectDestination} onPoseSelect={target => { const id = poseNodeId(target, intoPose); if (id != null) selectDestination([id]); }} onPoseCommit={readonlyPose}/></div></section>
        <section aria-label="Imported model"><strong>{source ? `Imported model: ${source.name}` : 'Imported model'}</strong><div className="animation-import-preview">{source ? <GamePreview {...common} model={source.model} modelPath={source.path} textureAssets={assets} sequenceIndex={sourceSequence} time={time} poseConfig={fromPose} playing={playing} onTimeChange={setTime} onPlayingChange={setPlaying} selectedNodeIds={selectedSource} onSelectNodes={selectSource} onPoseSelect={target => { const id = poseNodeId(target, fromPose); if (id != null) selectSource([id]); }} onPoseCommit={readonlyPose}/> : <p>Select a model to make both pose skeletons.</p>}</div></section>
      </div>
      {source && <>
        <div className="animation-import-controls">
          <label>Imported animation<select aria-label="Imported animation" value={sourceSequence} disabled={busy} onChange={event => { const index = Number(event.target.value); setSourceSequence(index); setTime(source.model.Sequences[index].Interval[0]); setDecisions({}); }}>{source.model.Sequences.map((item, index) => <option key={index} value={index}>{item.Name}</option>)}</select></label>
          <button disabled={busy} aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>Replace</button><button disabled={busy} aria-pressed={mode === 'new'} onClick={() => setMode('new')}>Make new</button>
          <label>{mode === 'new' ? 'Use RGB/Visbility settings from which animation?' : 'Replace which animation?'}<select aria-label={mode === 'new' ? 'Use RGB/Visbility settings from which animation?' : 'Replace which animation?'} value={destinationSequence} disabled={busy} onChange={event => setDestinationSequence(Number(event.target.value))}>{model.Sequences.map((item, index) => <option key={index} value={index}>{item.Name}</option>)}</select></label>
        </div>
        <div className="animation-import-playback"><button disabled={busy} aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause' : 'Play'}</button><input aria-label="Imported animation frame" type="range" min={interval[0]} max={interval[1]} step="1" value={time} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }}/><span>{Math.round(time)} ms</span></div>
        <details className="animation-import-matches"><summary>Pose skeleton matches · {Object.values(matches).filter(value => value !== '' && value != null).length}/{sourceNodes.length}</summary><p>Select a source bone, then its corresponding destination bone in the views, or choose below.</p><div>{sourceNodes.map(node => <label key={node.ObjectId}>{node.Name || `Node ${node.ObjectId}`}<select aria-label={`Match ${node.Name || node.ObjectId}`} value={matches[node.ObjectId] ?? ''} disabled={busy} onChange={event => match(node.ObjectId, event.target.value)}><option value="">Unmatched</option>{destinationSkeleton.nodes.map(other => <option key={other.ObjectId} value={other.ObjectId}>{other.Name || `Node ${other.ObjectId}`}</option>)}</select></label>)}</div></details>
        {extras.length > 0 && <div className="animation-import-objects">{extras.map(item => <div key={item.id}><strong>Import {item.name}?</strong><button disabled={busy} aria-pressed={decisions[item.id]?.import === true} onClick={() => setDecisions(prior => ({ ...prior, [item.id]: { ...prior[item.id], import: true } }))}>Yes</button><button disabled={busy} aria-pressed={decisions[item.id]?.import === false} onClick={() => setDecisions(prior => ({ ...prior, [item.id]: { ...prior[item.id], import: false } }))}>No</button>{decisions[item.id]?.import && <label>Bind to<select aria-label={`Bind ${item.name} to`} value={decisions[item.id]?.bindTo ?? ''} disabled={busy} onChange={event => setDecisions(prior => ({ ...prior, [item.id]: { ...prior[item.id], bindTo: event.target.value } }))}><option value="">Corresponding parent from pose</option>{destinationNodes.map(node => <option key={node.ObjectId} value={node.ObjectId}>{node.Name || `Node ${node.ObjectId}`}</option>)}</select></label>}</div>)}</div>}
      </>}
      {(error || preview.error) && <p className="animation-import-error" role="alert">{error || preview.error}</p>}
      <footer><span>{mode === 'replace' ? 'Destination duration, RGB and visibility are retained.' : 'RGB and visibility come from the selected original animation.'}</span><button disabled={busy} onClick={onClose}>Cancel</button><button disabled={!source || busy || unanswered || !!preview.error} onClick={commit}>{busy ? 'Working…' : 'Import animation'}</button></footer>
    </section>
  </div>;
}
