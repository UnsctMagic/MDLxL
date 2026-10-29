import React, { useState } from 'react';
import Dialog from './Dialog.jsx';

/** Entry requirements belong to Movement, not a separate camera workspace. */
export default function PortraitSetup({ model, missingSequence, missingCamera, sourceIndex, disabled, onCreate, onSetCamera, onClose }) {
  const [duration, setDuration] = useState('1000');
  const [source, setSource] = useState(String(sourceIndex));
  const [error, setError] = useState('');
  return <Dialog title="Set up Portrait Frame View" onClose={onClose} footer={<><button onClick={onClose}>Cancel</button>{missingSequence && <button disabled={disabled || missingCamera} onClick={() => {
      try { onCreate({ duration: Number(duration), sourceIndex: Number(source) }); }
      catch (cause) { setError(cause.message); }
    }}>Create Sequence and Enter Portrait</button>}</>}>
    <div className="portrait-setup">
      {missingSequence && <><p>A Portrait animation is required. Create a sequence named Portrait:</p>
        <label>Length (ms)<input aria-label="Portrait length (ms)" type="number" min="1" step="1" value={duration} onChange={event => setDuration(event.target.value)}/></label>
        <label>Visibility/RGB source<select aria-label="Portrait visibility/RGB source" value={source} onChange={event => setSource(event.target.value)}>
          <option value="-1">Model defaults</option>{model.Sequences.map((sequence, index) => <option key={index} value={index}>{sequence.Name}</option>)}
        </select></label>
        <p>Copies the source's visibility and RGB animation over the new length. Bone movement is left blank.</p>
      </>}
      {missingCamera && <><p>A camera is required. Set Current View creates Camera 01 from the current viewport.</p><button disabled={disabled} onClick={onSetCamera}>Set Current View</button></>}
      {disabled && <p>This model is read-only; the missing requirements cannot be created.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </Dialog>;
}
