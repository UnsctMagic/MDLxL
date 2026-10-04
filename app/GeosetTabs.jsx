import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { GEOSET_TABS_KEY, createGeosetTab, assignGeosetTab, deleteGeosetTab } from '../src/geoset-tabs.js';
import './geoset-tabs.css';

export default function GeosetTabs({ model, active, onActive, selected, edit, disabled }) {
  const tabs = model[GEOSET_TABS_KEY] || [];
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [target, setTarget] = useState('');
  const strip = useRef(null);
  useEffect(() => { strip.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [active]);
  const targetId = tabs.some(tab => tab.id === target) ? target : '';
  const current = tabs.find(tab => tab.id === active);
  const change = (label, operation) => edit(label, [GEOSET_TABS_KEY, 'Geosets'], operation);
  const create = event => {
    event.preventDefault();
    const id = change('Create geoset tab', currentModel => createGeosetTab(currentModel, name, [...selected]));
    if (id && id !== true) { onActive(id); setName(''); setTarget(id); }
  };
  return <div className="geoset-tabs" onContextMenu={event => event.stopPropagation()}>
    <div className="geoset-tab-strip">
      {tabs.length > 0 && <div ref={strip} role="tablist" aria-label="Geoset tabs">
        <button role="tab" aria-selected={active === 'all'} onClick={() => onActive('all')}>All tabs</button>
        <button role="tab" aria-selected={active === 'ungrouped'} onClick={() => onActive('ungrouped')}>Ungrouped</button>
        {tabs.map(tab => <span className="geoset-tab" key={tab.id}>
          <button role="tab" title={tab.name} aria-selected={active === tab.id} onClick={() => onActive(tab.id)}>{tab.name}</button>
          <button className="geoset-tab-eye" aria-label={`Show tab ${tab.name}`} aria-pressed={tab.visible} disabled={disabled} title={tab.visible ? `Hide ${tab.name}` : `Show ${tab.name}`} onClick={() => change('Set geoset tab visibility', currentModel => { currentModel[GEOSET_TABS_KEY].find(item => item.id === tab.id).visible = !tab.visible; })}>{tab.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>
        </span>)}
      </div>}
      <button aria-label="Manage geoset tabs" aria-expanded={open} onClick={() => setOpen(value => !value)}>{tabs.length ? '…' : 'Tabs…'}</button>
    </div>
    {open && <div className="geoset-tab-controls">
      <form onSubmit={create}><input aria-label="New geoset tab name" placeholder="Tab name" value={name} onChange={event => setName(event.target.value)} disabled={disabled}/><button disabled={disabled || !name.trim()}>New</button></form>
      <small>New tabs include checked geosets.</small>
      {tabs.length > 0 && <>
        <select aria-label="Move checked geosets to tab" value={targetId} onChange={event => setTarget(event.target.value)} disabled={disabled}><option value="">Ungrouped</option>{tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.name}</option>)}</select>
        <button disabled={disabled || !selected.size} onClick={() => change('Move geosets to tab', currentModel => assignGeosetTab(currentModel, [...selected], targetId))}>Move checked ({selected.size})</button>
      </>}
      {current && <>
        <input aria-label="Geoset tab name" value={current.name} disabled={disabled} onChange={event => { const value = event.target.value; if (value.trim()) change('Rename geoset tab', currentModel => { currentModel[GEOSET_TABS_KEY].find(tab => tab.id === current.id).name = value; }); }}/>
        <button disabled={disabled} onClick={() => { if (change('Delete geoset tab', currentModel => deleteGeosetTab(currentModel, current.id)) !== false) { onActive('all'); setTarget(''); } }}>Delete tab</button>
        <small>Deleting a tab leaves its geosets ungrouped.</small>
      </>}
    </div>}
  </div>;
}
