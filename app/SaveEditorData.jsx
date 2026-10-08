import React, { useState } from 'react';

export default function SaveEditorData({ Dialog, name, bytes, onChoose }) {
  const [remove, setRemove] = useState(false);
  return <Dialog title="Save model" onClose={() => onChoose(null)} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onChoose(null); }} footer={<><button onClick={() => onChoose(remove)}>Save</button><button onClick={() => onChoose(null)}>Cancel</button></>}>
    <p translate="no">{name}</p>
    <label title={`${bytes.toLocaleString()} bytes`}><input type="checkbox" checked={remove} onChange={event => setRemove(event.target.checked)}/>Remove all MDLxL editor data ({(bytes / 1024).toFixed(1)} KB)</label>
    <p>Removing this data keeps the model's appearance, animation playback and in-game performance unchanged. Original timing recovery and saved geoset tabs will be removed.</p>
  </Dialog>;
}
