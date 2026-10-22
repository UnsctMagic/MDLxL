import React, { useEffect, useRef, useState } from 'react';
import { SelectField } from './Fields.jsx';
import { EVENT_TYPES, SOUND_EXPANSIONS, assignEventData, setEventFrame, resolveEventSound } from './node-event-data.js';
import EventSoundTree from './EventSoundTree.jsx';
import EventDecalPreview from './EventDecalPreview.jsx';

const EXPANSIONS_KEY = 'mdlxl-sound-expansions';
const readExpansions = () => { try { const saved = JSON.parse(localStorage.getItem(EXPANSIONS_KEY)); if (Array.isArray(saved) && saved.length) return new Set(saved.filter(key => SOUND_EXPANSIONS[key])); } catch { /* storage is optional */ } return new Set(Object.keys(SOUND_EXPANSIONS)); };
const EXPANSION_TIPS = {
  ROC: 'Reign of Chaos sounds. Click to show or hide them.', TFT: 'The Frozen Throne sounds. Click to show or hide them.',
  RE: 'Sounds added in Reforged. Click to show or hide them.', FK: 'Forsaken Kingdom sounds. Click to show or hide them.',
};
const SEARCH_LABELS = { SND: 'Search sounds', SPL: 'Search blood', FPT: 'Search footprints', UBR: 'Search uber splats', SPN: 'Search spawn objects' };

// Shows only the chosen event kind. Type, timing and node fields wait behind
// one closed disclosure (children are the generic node fields).
export default function NodeEventEditor({ node, model, modelPath, catalog, error: catalogError, edit, frame, onSeek, sequenceIndex, onSequenceChange, children }) {
  const type = EVENT_TYPES[node.Name?.slice(0,3)] ? node.Name.slice(0,3) : 'SND', id = node.Name?.slice(4);
  const [query, setQuery] = useState(''), [audioSource, setAudioSource] = useState(null), [fileIndex, setFileIndex] = useState(0), [error, setError] = useState('');
  const [expansions, setExpansions] = useState(readExpansions);
  const audio = useRef(null), rows = catalog?.[type] || [], selected = rows.find(row => row.id === id);
  const matches = rows.filter(row => row.label.toLowerCase().includes(query.toLowerCase()));
  const sounds = type === 'SND' ? rows.filter(row => !row.expansion || expansions.has(row.expansion)) : rows;
  const toggleExpansion = key => setExpansions(previous => {
    const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key);
    if (!next.size) for (const value of Object.keys(SOUND_EXPANSIONS)) next.add(value);
    try { localStorage.setItem(EXPANSIONS_KEY, JSON.stringify([...next])); } catch { /* storage is optional */ }
    return next;
  });
  const file = selected?.files?.[fileIndex] || selected?.files?.[0];
  const audioUrl = audioSource && audioSource.file === file ? audioSource.url : '';
  useEffect(() => { setFileIndex(0); setError(''); }, [node.ObjectId, node.Name]);
  useEffect(() => {
    let active = true, url;
    setAudioSource(null); setError('');
    if (file) resolveEventSound(window.desktop.resolveEventResources, file, modelPath).then(sound => {
      if (!active) return;
      url = URL.createObjectURL(new Blob([sound.bytes], {type:sound.mime})); setAudioSource({file,url});
    }).catch(cause => { if(active) setError(cause.message); });
    return () => { active=false; if(url) URL.revokeObjectURL(url); };
  }, [file, modelPath]);
  const assign = (nextType, nextId) => edit('Set event data', ['Nodes'], current => assignEventData(current.Nodes[node.ObjectId], nextType, nextId));
  const global = node.GlobalSeqId ?? node.GlobalSequenceId ?? -1;
  return <div className="re-event-editor">
    {type === 'SND' && <div className="re-sound-expansions" role="group" aria-label="Expansions">{Object.entries(SOUND_EXPANSIONS).map(([key, name]) => <button type="button" key={key} aria-pressed={expansions.has(key)} title={EXPANSION_TIPS[key]} onClick={() => toggleExpansion(key)}>{key}<small>{rows.filter(row => row.expansion === key).length}</small></button>)}</div>}
    <input type="search" aria-label={SEARCH_LABELS[type]} placeholder={SEARCH_LABELS[type]} value={query} onChange={e=>setQuery(e.target.value)}/>
    {type === 'SND' ? <EventSoundTree rows={sounds} selectedId={id} query={query} onSelect={next=>assign(type,next)}/> : <select size="7" aria-label={EVENT_TYPES[type]} value={id || ''} onChange={e=>assign(type,e.target.value)}>{!selected && <option value={id || ''}>{id || 'Select event data'}</option>}{matches.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select>}
    {file && <>{selected.files.length > 1 && <SelectField label="Sound file" value={fileIndex} options={selected.files.map((name,value)=>({value,label:name.split(/[\\/]/).at(-1)}))} onChange={v=>setFileIndex(Number(v))}/>}<audio key={file} ref={audio} aria-label="Sound preview" controls preload="auto" src={audioUrl || undefined} onError={()=>{if(audioUrl)setError('Sound format could not be played.');}}/></>}
    {selected?.definition && ['SPL','FPT','UBR'].includes(type) && <EventDecalPreview definition={selected.definition} modelPath={modelPath}/>}
    {(error || catalogError || type === 'SND' && selected && !file) && <p className="field-error" role="alert">{error || catalogError || `Sound definition unavailable: ${selected.label}`}</p>}
    {global < 0 && <SelectField label="Preview animation" value={sequenceIndex} options={model.Sequences.map((seq,value)=>({value,label:seq.Name}))} onChange={v=>onSequenceChange(Number(v))}/>}
    <div className="re-event-frames"><span>Event tracks</span><div>{Array.from(node.EventTrack || []).map(at=><button key={at} aria-label={`Event frame ${at}`} onClick={()=>onSeek(at)}>{at}</button>)}</div><button onClick={()=>edit('Add event track',['Nodes'],current=>setEventFrame(current.Nodes[node.ObjectId],frame,true))}>Add at {frame}</button><button disabled={!Array.from(node.EventTrack || []).includes(frame)} onClick={()=>edit('Remove event track',['Nodes'],current=>setEventFrame(current.Nodes[node.ObjectId],frame,false))}>Remove</button></div>
    <details className="re-event-settings"><summary title="Change the event type, global sequence, name, parent or pivot of this event node.">Node settings</summary>
      <SelectField label="Type" value={type} options={Object.entries(EVENT_TYPES).map(([value,label])=>({value,label}))} onChange={next => { setQuery(''); if(catalog?.[next]?.length) assign(next,catalog[next][0].id); }}/>
      <SelectField label="Global sequence" value={global} options={[{value:-1,label:'None'},...(model.GlobalSequences || []).map((_,value)=>({value,label:String(value+1)}))]} onChange={v=>edit('Set event global sequence',['Nodes'], current=>{const target=current.Nodes[node.ObjectId]; delete target.GlobalSequenceId;if(Number(v)<0)delete target.GlobalSeqId;else target.GlobalSeqId=Number(v);})}/>
      {children}
    </details>
  </div>;
}
