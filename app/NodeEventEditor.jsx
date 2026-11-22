import React, { useEffect, useMemo, useState } from 'react';
import { SelectField } from './Fields.jsx';
import { EVENT_TYPES, SOUND_EXPANSIONS, assignEventData, setEventFrame, resolveEventSound, MISSING_SOUND, MISSING_SOUND_TIP } from './node-event-data.js';
import EventSoundTree from './EventSoundTree.jsx';
import EventDecalPreview from './EventDecalPreview.jsx';
import SpawnObjectPreview from './SpawnObjectPreview.jsx';
import { parseEventRenderModel } from './event-render-model.js';
import { gamePathKey } from '../src/game-path.js';
import { readStored, writeStored } from '../src/local-store.js';

const EXPANSIONS_KEY = 'mdlxl-sound-expansions';
const readExpansions = () => readStored(EXPANSIONS_KEY, null, saved => Array.isArray(saved) && saved.length ? new Set(saved.filter(key => SOUND_EXPANSIONS[key])) : null) || new Set(Object.keys(SOUND_EXPANSIONS));
const EXPANSION_TIPS = {
  ROC: 'Reign of Chaos sounds. Click to show or hide them.', TFT: 'The Frozen Throne sounds. Click to show or hide them.',
  RE: 'Sounds added in Reforged. Click to show or hide them.', FK: 'Forsaken Kingdom sounds. Click to show or hide them.',
};
const SEARCH_LABELS = { SND: 'Search sounds', SPL: 'Search blood', FPT: 'Search footprints', UBR: 'Search uber splats', SPN: 'Search spawn objects' };

export function useSpawnChoices(getSpawnChoices, enabled) {
  const [lookup, setLookup] = useState(null);
  useEffect(() => {
    if (!enabled || !getSpawnChoices) return;
    let active = true;
    getSpawnChoices().then(result => {
      if (active) setLookup({ source: getSpawnChoices, result });
    }, () => {
      if (active) setLookup({ source: getSpawnChoices, error: 'Could not look up models in the game files' });
    });
    return () => { active = false; };
  }, [enabled, getSpawnChoices]);
  return lookup?.source === getSpawnChoices ? lookup : null;
}

export function EventDataPicker({ type, id, modelPath, catalog, spawnLookup, teamColor, error: catalogError, onSelect }) {
  const [query, setQuery] = useState(''), [audioSource, setAudioSource] = useState(null), [fileIndex, setFileIndex] = useState(0), [error, setError] = useState('');
  const [expansions, setExpansions] = useState(readExpansions);
  const rows = catalog?.[type] || [], selected = rows.find(row => row.id === id);
  const spawnChoices = spawnLookup?.result?.choices || [];
  const selectedSpawnPath = type === 'SPN' ? selected?.definition?.resourcePath : null;
  const selectedSpawnKey = gamePathKey(selectedSpawnPath);
  const usable = spawnLookup?.result?.usable;
  const spawnRecord = usable?.get(selectedSpawnKey);
  const spawnPreview = useMemo(() => spawnRecord ? parseEventRenderModel(spawnRecord.bytes, spawnRecord.name) : null, [spawnRecord]);
  let spawnError = '';
  if (type === 'SPN') {
    if (spawnLookup?.error) spawnError = spawnLookup.error;
    else if (id && catalog) {
      if (!selectedSpawnPath) spawnError = 'No model listed';
      else if (spawnLookup?.result?.unsupported.has(selectedSpawnKey)) spawnError = 'This model format cannot be previewed';
      else if (usable && !spawnRecord) spawnError = 'Not found in the game files';
    }
  }
  const needle = query.trim().toLowerCase();
  const matches = (type === 'SPN' ? spawnChoices : rows).filter(row => row.id === id || row.label.toLowerCase().includes(needle));
  const selectedSpawnShown = matches.some(row => row.id === id);
  // The expansion buttons narrow browsing only; a typed search looks in every
  // expansion so a sound is never hidden behind a switched-off button.
  const sounds = type === 'SND' && !needle ? rows.filter(row => !row.expansion || expansions.has(row.expansion)) : rows;
  const toggleExpansion = key => setExpansions(previous => {
    const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key);
    if (!next.size) for (const value of Object.keys(SOUND_EXPANSIONS)) next.add(value);
    writeStored(EXPANSIONS_KEY, [...next]);
    return next;
  });
  const file = selected?.missing ? null : selected?.files?.[fileIndex] || selected?.files?.[0];
  const audioUrl = audioSource && audioSource.file === file ? audioSource.url : '';
  useEffect(() => { setFileIndex(0); setError(''); }, [id]);
  useEffect(() => {
    let active = true, url;
    setAudioSource(null); setError('');
    if (file) resolveEventSound(window.desktop.resolveEventResources, file, modelPath).then(sound => {
      if (!active) return;
      url = URL.createObjectURL(new Blob([sound.bytes], {type:sound.mime})); setAudioSource({file,url});
    }).catch(cause => { if(active) setError(cause.message); });
    return () => { active=false; if(url) URL.revokeObjectURL(url); };
  }, [file, modelPath]);
  return <>
    {type === 'SND' && <div className="re-sound-expansions" role="group" aria-label="Expansions">{Object.entries(SOUND_EXPANSIONS).map(([key, name]) => <button type="button" key={key} aria-pressed={expansions.has(key)} title={EXPANSION_TIPS[key]} onClick={() => toggleExpansion(key)}>{key}<small>{rows.filter(row => row.expansion === key).length}</small></button>)}</div>}
    <input type="search" aria-label={SEARCH_LABELS[type]} placeholder={SEARCH_LABELS[type]} value={query} onChange={e=>setQuery(e.target.value)}/>
    {type === 'SND' ? <EventSoundTree rows={sounds} selectedId={id} query={query} onSelect={onSelect}/>
      : type === 'SPN' ? <select size="7" aria-label={EVENT_TYPES.SPN} value={selectedSpawnShown ? id : ''} disabled={!matches.length} onChange={e=>onSelect(e.target.value)}>
        {!selectedSpawnShown && <option value="" hidden disabled/>}
        {matches.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
      </select> : <select size="7" aria-label={EVENT_TYPES[type]} value={id || ''} onChange={e=>onSelect(e.target.value)}>{!selected && <option disabled value={id || ''}>{id || 'Select event data'}</option>}{matches.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select>}
    {type === 'SPN' && <SpawnObjectPreview model={spawnPreview} modelPath={modelPath} teamColor={teamColor} loading={!!selectedSpawnPath && !spawnLookup}/>}
    {file && <>{selected.files.length > 1 && <SelectField label="Sound file" value={fileIndex} options={selected.files.map((name,value)=>({value,label:name.split(/[\\/]/).at(-1)}))} onChange={v=>setFileIndex(Number(v))}/>}<audio key={file} aria-label="Sound preview" controls preload="auto" src={audioUrl || undefined} onError={()=>{if(audioUrl)setError('Sound format could not be played.');}}/></>}
    {selected?.definition && ['SPL','FPT','UBR'].includes(type) && <EventDecalPreview definition={selected.definition} modelPath={modelPath}/>}
    {type === 'SND' && selected?.missing && <p className="re-sound-missing" title={MISSING_SOUND_TIP}>{MISSING_SOUND}</p>}
    {(error || spawnError || catalogError || type === 'SND' && selected && !selected.missing && !file) && <p className="field-error" role="alert">{error || spawnError || catalogError || `Sound definition unavailable: ${selected.label}`}</p>}
  </>;
}

// Shows only the chosen event kind. Type, timing and node fields wait behind
// one closed disclosure (children are the generic node fields).
export default function NodeEventEditor({ node, model, modelPath, catalog, getSpawnChoices, error: catalogError, edit, teamColor, frame, onSeek, onShowFrame, sequenceIndex, onSequenceChange, children }) {
  const type = EVENT_TYPES[node.Name?.slice(0,3)] ? node.Name.slice(0,3) : 'SND', id = node.Name?.slice(4);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const spawnLookup = useSpawnChoices(getSpawnChoices, type === 'SPN' || settingsOpen);
  const spawnChoices = spawnLookup?.result?.choices || [];
  const assign = (nextType, nextId) => edit('Set event data', ['Nodes'], current => assignEventData(current.Nodes[node.ObjectId], nextType, nextId));
  const global = node.GlobalSeqId ?? node.GlobalSequenceId ?? -1;
  return <div className="re-event-editor">
    <EventDataPicker key={type} type={type} id={id} modelPath={modelPath} catalog={catalog} spawnLookup={spawnLookup} teamColor={teamColor} error={catalogError} onSelect={next => assign(type, next)}/>
    {global < 0 && <SelectField label="Preview animation" value={sequenceIndex} options={model.Sequences.map((seq,value)=>({value,label:seq.Name}))} onChange={v=>onSequenceChange(Number(v))}/>}
    <div className="re-event-frames"><span>Event tracks</span><div>{Array.from(node.EventTrack || []).map(at=><button key={at} aria-label={`Event frame ${at}`} title="Double-click to show this frame in Animations" onClick={()=>onSeek(at)} onDoubleClick={()=>onShowFrame?.(at, global)}>{at}</button>)}</div><button onClick={()=>edit('Add event track',['Nodes'],current=>setEventFrame(current.Nodes[node.ObjectId],frame,true))}>Add at {frame}</button><button disabled={!Array.from(node.EventTrack || []).includes(frame)} onClick={()=>edit('Remove event track',['Nodes'],current=>setEventFrame(current.Nodes[node.ObjectId],frame,false))}>Remove</button></div>
    <details className="re-event-settings" onToggle={e=>setSettingsOpen(e.currentTarget.open)}><summary title="Change the event type, global sequence, name, parent or pivot of this event node.">Node settings</summary>
      <SelectField label="Type" value={type} options={Object.entries(EVENT_TYPES).filter(([value])=>value !== 'SPN' || type === 'SPN' || spawnChoices.length).map(([value,label])=>({value,label}))} onChange={next => {
        const first = (next === 'SPN' ? spawnChoices : catalog?.[next])?.[0];
        if (first) assign(next,first.id);
      }}/>
      <SelectField label="Global sequence" value={global} options={[{value:-1,label:'None'},...(model.GlobalSequences || []).map((_,value)=>({value,label:String(value+1)}))]} onChange={v=>edit('Set event global sequence',['Nodes'], current=>{const target=current.Nodes[node.ObjectId]; delete target.GlobalSequenceId;if(Number(v)<0)delete target.GlobalSeqId;else target.GlobalSeqId=Number(v);})}/>
      {children}
    </details>
  </div>;
}
