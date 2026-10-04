import React from 'react';

export default function PartAnimations({ model, animations, onChange, sequence, onPreview, busy }) {
  return <div className="parts-animation-options">
    <label><input type="radio" name="part-animation-mode" checked={animations === null} disabled={busy} onChange={() => onChange(null)}/> Import as is</label>
    <label><input type="radio" name="part-animation-mode" checked={animations !== null} disabled={busy || !model.Sequences.length} onChange={() => onChange([])}/> Select animations and rename</label>
    {animations !== null && <ul className="parts-animation-list">{model.Sequences.map((item, index) => {
      const chosen = animations.find(animation => animation.sequenceIndex === index);
      return <li key={index}>
        <label><input type="checkbox" aria-label={`Include animation ${index + 1}: ${item.Name}`} checked={!!chosen} disabled={busy} onChange={event => onChange(event.target.checked ? [...animations, { sequenceIndex: index, name: item.Name }].sort((a, b) => a.sequenceIndex - b.sequenceIndex) : animations.filter(animation => animation.sequenceIndex !== index))}/>{item.Name}</label>
        {chosen && <input aria-label={`Animation ${index + 1} name`} value={chosen.name} disabled={busy} onChange={event => onChange(animations.map(animation => animation.sequenceIndex === index ? { ...animation, name: event.target.value } : animation))}/>}
      </li>;
    })}</ul>}
    <div className="parts-color-controls"><label>Preview animation<select aria-label="Preview animation" value={sequence} onChange={event => onPreview(event.target.value)}><option value="">Unanimated</option>{model.Sequences.map((item, index) => <option key={index} value={index}>{item.Name}</option>)}</select></label></div>
    <p className="parts-note">Each geoset keeps its own full RGB animation.</p>
  </div>;
}
