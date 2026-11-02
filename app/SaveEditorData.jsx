import React, { useState } from 'react';
import Dialog from './Dialog.jsx';

export default function SaveEditorData({ name, bytes, hasFx, onChoose }) {
  const [remove, setRemove] = useState(false);
  return <Dialog title="Save model" onClose={() => onChoose(null)} footer={<><button onClick={() => onChoose(remove)}>Save</button><button onClick={() => onChoose(null)}>Cancel</button></>}>
    <p translate="no">{name}</p>
    <label title={`${bytes.toLocaleString()} bytes`}><input type="checkbox" checked={remove} onChange={event => setRemove(event.target.checked)}/>Remove all MDLxL editor data ({(bytes / 1024).toFixed(1)} KB)</label>
    {hasFx&&<p>Removing editor data also removes the editable FX layer list. The enchantment will still play.</p>}
    <p>Removing this data keeps the model's appearance, animation playback and in-game performance unchanged. Saved geoset tabs will be removed.</p>
  </Dialog>;
}
