import React, { useRef } from 'react';
import { allGeosets, chooseGeosets, invertGeosets } from '../src/classic-selection.js';
import GeosetListBox from './GeosetListBox.jsx';

// The Library's geoset box: the vertex editor's numbered list and click,
// shift and ctrl selection, acting on the previewed copy only.
export default function LibraryGeosets({ count, selected, onChange, hovered, onHover, highlight, onHighlight, selectedOnly, onSelectedOnly, editable, busy, onSeparate, onImport, onOpen, canImport, importReason }) {
  const anchor = useRef(0), none = !selected.size;
  function choose(index, event) {
    const shift = !!(event.shiftKey || event.nativeEvent?.shiftKey), ctrl = !!(event.ctrlKey || event.metaKey || event.nativeEvent?.ctrlKey);
    onChange(chooseGeosets(selected, index, { shift, ctrl, checked: event.target.checked, anchor: anchor.current, count }));
    if (!shift) anchor.current = index;
  }
  return <div className="classic-geosets gf-geosets">
    <div className="classic-geosets-heading">Geosets</div>
    <div className="geoset-options">
      <label className="check" title="Shows only the checked geosets in the preview. Nothing is deleted."><input type="checkbox" checked={selectedOnly} onChange={event => onSelectedOnly(event.target.checked)}/>View selected only</label>
      <label className="check"><input type="checkbox" checked={highlight} onChange={event => onHighlight(event.target.checked)}/>Highlight Geoset</label>
    </div>
    <div className="classic-selection-actions"><button onClick={() => onChange(allGeosets(count))}>All</button><button onClick={() => onChange(new Set())}>Clear</button><button onClick={() => onChange(invertGeosets(selected, count))}>Invert</button></div>
    <GeosetListBox><div className="classic-geoset-list" style={{ '--geoset-rows': Math.max(1, Math.ceil(count / 4)) }} role="listbox" aria-label="Library geosets" aria-multiselectable="true">
      {Array.from({ length: count }, (_, index) => <div key={index} className={`geoset-row${selected.has(index) ? ' selected' : ''}${hovered === index ? ' hovered' : ''}`} role="option" aria-selected={selected.has(index)}>
        <label className="geoset-hover-target" onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}><input type="checkbox" aria-label={`Geoset ${index + 1}`} checked={selected.has(index)} onChange={event => choose(index, event)}/><span>{index + 1}</span></label>
      </div>)}
    </div></GeosetListBox>
    <div className="classic-geoset-count">{selected.size} of {count} selected</div>
    <div className="classic-geoset-operations">
      <button disabled={!editable || none || busy} title="Splits the checked geosets into one geoset per separate piece. No vertices need to be selected." onClick={() => onSeparate(false)}>Seperate by Loose parts</button>
      <button disabled={!editable || none || busy} title="Splits the checked geosets wherever triangles do not share vertices, even inside one piece. No vertices need to be selected." onClick={() => onSeparate(true)}>Nuclear Seperation</button>
    </div>
    <div className="tl-actions gf-geoset-actions">
      <button className="tl-primary" disabled={none || busy || !canImport} title={canImport ? 'Adds the checked geosets to the model you are editing, attached to DummyBone like other parts.' : importReason} onClick={onImport}>Import to current</button>
      <button disabled={none || busy} title="Opens the model with only the checked geosets as a new tab." onClick={onOpen}>Open in editor</button>
      {!canImport && importReason && <p className="tl-preview-reason">{importReason}</p>}
    </div>
  </div>;
}
