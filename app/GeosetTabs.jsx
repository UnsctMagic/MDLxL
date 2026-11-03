import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsRight, Eye, EyeOff, Menu, Plus } from 'lucide-react';
import GeosetListBox from './GeosetListBox.jsx';
import Dialog from './Dialog.jsx';
import useDismiss from './useDismiss.js';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import { GEOSET_TABS_KEY, createGeosetTab, assignGeosetTab, deleteGeosetTab } from '../src/geoset-tabs.js';
import './geoset-tabs.css';

export default function GeosetTabs({ model, active, onActive, selected, edit, disabled, actionsContainer, children }) {
  const tabs = model[GEOSET_TABS_KEY] || [];
  const [action, setAction] = useState(null), [name, setName] = useState(''), [target, setTarget] = useState('');
  const targetId = tabs.some(tab => tab.id === target) ? target : '';
  const current = tabs.find(tab => tab.id === active);
  const root = useRef(null), strip = useRef(null), controls = useRef(null), popup = useRef(null), trigger = useRef(null), focusTab = useRef(null);
  const [menu, setMenu] = useState(null), [overflow, setOverflow] = useState(false), [position, setPosition] = useState({});
  const entries = [{ id: 'all', name: 'All tabs' }, ...tabs, ...(tabs.length ? [{ id: 'ungrouped', name: 'Ungrouped' }] : [])];
  useDismiss(!!menu, [root, controls], event => {
    setMenu(null);
    if (event.type === 'keydown') trigger.current?.focus({ preventScroll: true });
  }, { claimEscape: true, escapePriority: -20 });
  useWindowKeyClaim(({ event }) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
    if (event.target?.closest?.('.geoset-tab-viewport') === strip.current) return tabKeys(event);
    if (popup.current?.contains(event.target)) return menuKeys(event);
    return false;
  }, -20);
  useLayoutEffect(() => {
    const element = strip.current;
    const measure = () => {
      const buttons = [...element.children];
      for (const button of buttons) button.hidden = false;
      const widths = buttons.map(button => button.getBoundingClientRect().width), width = element.getBoundingClientRect().width;
      const index = Math.max(0, buttons.findIndex(button => button.dataset.tabId === active));
      let first = 0;
      while (first < index && widths.slice(first, index + 1).reduce((sum, value) => sum + value, 0) > width + .5) first++;
      let used = 0;
      buttons.forEach((button, i) => {
        button.hidden = i < first || used + widths[i] > width + .5;
        if (!button.hidden) used += widths[i];
      });
      if (focusTab.current === active) { buttons[index]?.focus({ preventScroll: true }); focusTab.current = null; }
      setOverflow(buttons.some(button => button.hidden));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, tabs, overflow, actionsContainer]);
  useLayoutEffect(() => {
    if (!menu) return;
    const element = popup.current, win = element.ownerDocument.defaultView, rect = trigger.current.getBoundingClientRect();
    setPosition({ top: Math.max(4, Math.min(rect.bottom + 3, win.innerHeight - element.offsetHeight - 6)), right: Math.max(6, win.innerWidth - rect.right) });
    element.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [menu]);
  const change = (label, operation) => edit(label, [GEOSET_TABS_KEY, 'Geosets'], operation);
  const openAction = command => {
    setMenu(null);
    if (command === 'delete') {
      if (change('Delete geoset tab', currentModel => deleteGeosetTab(currentModel, current.id)) !== false) onActive('all');
    } else {
      setName(command === 'rename' ? current.name : ''); setTarget(current?.id || ''); setAction(command);
    }
  };
  const choose = (id, focus = false) => { if (focus) focusTab.current = id; setMenu(null); onActive(id); };
  const openMenu = (event, kind) => {
    event.preventDefault(); event.stopPropagation();
    trigger.current = event.currentTarget; setMenu(previous => previous === kind ? null : kind);
  };
  function tabKeys(event) {
    const index = entries.findIndex(tab => tab.id === active);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : event.key === 'ArrowRight' ? (index + 1) % entries.length : event.key === 'ArrowLeft' ? (index - 1 + entries.length) % entries.length : -1;
    if (next < 0) return false;
    event.preventDefault(); event.stopPropagation(); choose(entries[next].id, true);
    return true;
  }
  function menuKeys(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false;
    event.preventDefault(); event.stopPropagation();
    const buttons = [...popup.current.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(event.target);
    buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    return true;
  }
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
  return <div className="geoset-tabs" ref={root}>
    {actionsContainer && createPortal(<span className="geoset-tab-buttons" ref={controls}>
      <button type="button" aria-label="New geoset tab" title="New tab" disabled={disabled} onClick={event => { event.preventDefault(); event.stopPropagation(); openAction('create'); }}><Plus size={13}/></button>
      <button type="button" aria-label="Geoset tab actions" title="Tab actions" aria-haspopup="menu" aria-expanded={menu === 'actions'} onClick={event => openMenu(event, 'actions')}><Menu size={13}/></button>
    </span>, actionsContainer)}
    <div className="geoset-tab-strip">
      <div className="geoset-tab-viewport" role="tablist" aria-label="Geoset tabs" ref={strip} onKeyDown={tabKeys}>
        {entries.map(tab => <button type="button" role="tab" key={tab.id} data-tab-id={tab.id} aria-selected={active === tab.id} aria-label={tab.name} title={tab.name + (tab.visible === false ? ' (hidden)' : '')} onClick={() => choose(tab.id)}><span>{tab.name}</span>{tab.visible === false && <EyeOff size={10}/>}</button>)}
      </div>
      {overflow && <button type="button" className="geoset-tab-overflow" aria-label="More geoset tabs" title="More tabs" aria-haspopup="menu" aria-expanded={menu === 'tabs'} onClick={event => openMenu(event, 'tabs')}><ChevronsRight size={13}/></button>}
    </div>
    {menu && <div ref={popup} className="geoset-tab-menu" role="menu" aria-label={menu === 'actions' ? 'Tab actions' : 'Geoset tabs'} style={position} onContextMenu={event => event.stopPropagation()} onKeyDown={menuKeys}>
      {menu === 'tabs' ? entries.map(tab => <button type="button" role="menuitemradio" aria-checked={active === tab.id} aria-label={tab.name} data-tab-id={tab.id} key={tab.id} onClick={() => choose(tab.id, true)}><span aria-hidden="true">{active === tab.id ? '✓' : ''}</span><span>{tab.name}</span>{tab.visible === false && <EyeOff size={11}/>}</button>) : <>
        <button type="button" role="menuitem" disabled={disabled} onClick={() => openAction('create')}>New tab…</button>
        <button type="button" role="menuitem" disabled={disabled || !tabs.length || !selected.size} onClick={() => openAction('move')}>Move checked…</button>
        <button type="button" role="menuitem" disabled={disabled || !current} onClick={() => openAction('rename')}>Rename tab…</button>
        <hr/>
        <button type="button" role="menuitem" disabled={disabled || !current} onClick={() => openAction('delete')}>Delete tab</button>
      </>}
    </div>}
    <GeosetListBox overlay={current && <button className="geoset-tab-eye" aria-label={`Show tab ${current.name}`} aria-pressed={current.visible} disabled={disabled} title={current.visible ? `Hide ${current.name}` : `Show ${current.name}`} onClick={() => change('Set geoset tab visibility', currentModel => { currentModel[GEOSET_TABS_KEY].find(tab => tab.id === current.id).visible = !current.visible; })}>{current.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>}>
      {children}
    </GeosetListBox>
    {action && <div onKeyDown={event => { event.stopPropagation(); }} onContextMenu={event => event.stopPropagation()}>
      <Dialog title={title} onClose={() => setAction(null)} footer={<><button onClick={() => setAction(null)}>Cancel</button><button type="submit" form="geoset-tab-form" disabled={disabled || (action === 'move' ? !selected.size : !name.trim())}>{button}</button></>}>
        <form id="geoset-tab-form" onSubmit={submit}>
          {action === 'move' ? <select autoFocus aria-label="Move checked geosets to tab" value={targetId} onChange={event => setTarget(event.target.value)} disabled={disabled}><option value="">Ungrouped</option>{tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.name}</option>)}</select> : <input autoFocus aria-label={action === 'create' ? 'New geoset tab name' : 'Geoset tab name'} placeholder="Tab name" value={name} onChange={event => setName(event.target.value)} disabled={disabled}/>}
        </form>
      </Dialog>
    </div>}
  </div>;
}
