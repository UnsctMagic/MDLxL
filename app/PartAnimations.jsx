import React from 'react';

export default function PartAnimations({ model, sequence, onPreview, busy, collecting = false }) {
  return <div className="parts-animation-options">
    <div className="parts-color-controls"><label>RGB animation<select aria-label="RGB animation" value={sequence} disabled={busy} onChange={event => onPreview(event.target.value)}><option value="">Original RGB</option>{model.Sequences.map((item, index) => <option key={index} value={index}>{item.Name}</option>)}</select></label></div>
    <p className="parts-note">{collecting ? 'All per-animation RGB tracks are saved.' : 'Choose an animation for each geoset’s RGB at its start frame.'}</p>
  </div>;
}
