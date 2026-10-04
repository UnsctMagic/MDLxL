import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { GEOSET_TABS_KEY, createGeosetTab, assignGeosetTab, deleteGeosetTab } from '../src/geoset-tabs.js';
import './geoset-tabs.css';

export default function GeosetTabs({ model, active, onActive, selected, edit, disabled, Dialog, children }) {
  const tabs = model[GEOSET_TABS_KEY] || [];
  const [action, setAction] = useState(null), [name, setName] = useState(''), [target, setTarget] = useState('');
  const targetId = tabs.some(tab => tab.id === target) ? target : '';
  const current = tabs.find(tab => tab.id === active);
  const change = (label, operation) => edit(label, [GEOSET_TABS_KEY, 'Geosets'], operation);
  const choose = event => {
    const value = event.target.value;
    event.target.value = active;
    if (!value.startsWith('action:')) { onActive(value); return; }
    const command = value.slice(7);
    if (command === 'delete') {
      if (change('Delete geoset tab', currentModel => deleteGeosetTab(currentModel, current.id)) !== false) onActive('all');
    } else {
      setName(command === 'rename' ? current.name : ''); setTarget(current?.id || ''); setAction(command);
    }
  };
  const submit = event => {
    event.preventDefault();
    if (disabled) return;
    let result;
    if (action === 'create') {
      result = change('Create geoset tab', currentModel => createGeosetTab(currentModel, name, [...selected]));
      if (result && result !== true) onActive(result);
    } else if (action === 'rename') {
      result = change('Rename geoset tab', currentModel => { currentModel[GEOSET_TABS_KEY].find(tab => tab.id === current.id).name = name.trim(); });
    } else result = change('Move geosets to tab', currentModel => assignGeosetTab(currentModel, [...selected], targetId));
    if (result !== false) setAction(null);
  };
  const title = action === 'create' ? 'New geoset tab' : action === 'rename' ? 'Rename geoset tab' : 'Move checked geosets';
  const button = action === 'create' ? 'Create' : action === 'rename' ? 'Rename' : 'Move';
  return <div className="geoset-tabs">
    <select className="geoset-tab-select" aria-label="Geoset tabs" value={active} onChange={choose} onContextMenu={event => event.stopPropagation()}>
      <option value="all">All tabs</option>
      {tabs.length > 0 && <option value="ungrouped">Ungrouped</option>}
      {tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.name}{!tab.visible && ' (hidden)'}</option>)}
      <optgroup label="Tab actions" data-wheel-skip="">
        <option value="action:create" disabled={disabled}>New tab…</option>
        <option value="action:move" disabled={disabled || !tabs.length || !selected.size}>Move checked…</option>
        <option value="action:rename" disabled={disabled || !current}>Rename tab…</option>
        <option value="action:delete" disabled={disabled || !current}>Delete tab</option>
      </optgroup>
    </select>
    <div className="geoset-tab-box">
      {children}
      {current && <button className="geoset-tab-eye" aria-label={`Show tab ${current.name}`} aria-pressed={current.visible} disabled={disabled} title={current.visible ? `Hide ${current.name}` : `Show ${current.name}`} onClick={() => change('Set geoset tab visibility', currentModel => { currentModel[GEOSET_TABS_KEY].find(tab => tab.id === current.id).visible = !current.visible; })}>{current.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>}
    </div>
    {action && <div onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setAction(null); }} onContextMenu={event => event.stopPropagation()}>
      <Dialog title={title} onClose={() => setAction(null)} footer={<><button onClick={() => setAction(null)}>Cancel</button><button type="submit" form="geoset-tab-form" disabled={disabled || (action === 'move' ? !selected.size : !name.trim())}>{button}</button></>}>
        <form id="geoset-tab-form" onSubmit={submit}>
          {action === 'move' ? <select autoFocus aria-label="Move checked geosets to tab" value={targetId} onChange={event => setTarget(event.target.value)} disabled={disabled}><option value="">Ungrouped</option>{tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.name}</option>)}</select> : <input autoFocus aria-label={action === 'create' ? 'New geoset tab name' : 'Geoset tab name'} placeholder="Tab name" value={name} onChange={event => setName(event.target.value)} disabled={disabled}/>}
        </form>
      </Dialog>
    </div>}
  </div>;
}
