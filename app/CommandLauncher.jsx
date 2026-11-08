import React, { useLayoutEffect, useRef, useState } from 'react';
import { useHotkeys, useWindowKeyClaim } from './Hotkeys.jsx';
import useDismiss from './useDismiss.js';
import { chordFromEvent, formatChord } from '../src/preferences.js';
import { hotkeyCode } from '../src/hotkey-defaults.js';
import { filterLauncherRows, launcherRows } from '../src/command-launcher.js';
import { translate } from '../src/localization.js';
import './launcher.css';

const PAGE = 9;

/** Search box over every command. Closes on Esc, a press outside it, its own key or after running a row. */
export default function CommandLauncher({ initialQuery = '', extras, isEnabled, onRun, onClose }) {
  const { catalog, shortcuts } = useHotkeys();
  const panel = useRef(null), field = useRef(null), list = useRef(null), scrollToActive = useRef(false);
  const [query, setQuery] = useState(initialQuery), [active, setActive] = useState(0);
  const rows = filterLauncherRows(launcherRows(catalog, extras, isEnabled), query, translate);
  const selected = Math.min(active, rows.length - 1);
  const run = row => { if (!row) return; onClose(); onRun(row.id); };
  const keyLabel = id => { const key = shortcuts[id]?.[0]; return key ? hotkeyCode(key) || formatChord(key) : ''; };
  const move = step => { scrollToActive.current = true; setActive(rows.length ? (selected + step + rows.length) % rows.length : 0); };
  const moveClamped = step => { scrollToActive.current = true; setActive(Math.max(0, Math.min(rows.length - 1, selected + step))); };

  useLayoutEffect(() => {
    const previous = document.activeElement;
    field.current.focus(); field.current.select();
    return () => { if (previous?.isConnected && previous !== document.body) previous.focus({ preventScroll: true }); };
  }, []);
  useLayoutEffect(() => {
    if (!scrollToActive.current) return;
    scrollToActive.current = false;
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected, query]);
  useDismiss(true, [panel], onClose, { claimEscape: true, escapePriority: -30 });
  useWindowKeyClaim(({ event }) => {
    if (event.isComposing || event.target?.ownerDocument !== panel.current?.ownerDocument) return false;
    const { key, shiftKey } = event;
    if (key === 'ArrowDown' || key === 'Tab' && !shiftKey) move(1);
    else if (key === 'ArrowUp' || key === 'Tab') move(-1);
    else if (key === 'PageDown') moveClamped(PAGE);
    else if (key === 'PageUp') moveClamped(-PAGE);
    else if (key === 'Enter') run(rows[selected]);
    else if (shortcuts.launcher?.includes(chordFromEvent(event))) onClose();
    else return false;
    return true;
  }, -30);

  return <div ref={panel} className="command-launcher" role="dialog" aria-label="Search commands" data-hotkey-window="" data-hotkey-scope="launcher">
    <input ref={field} type="text" role="combobox" aria-label="Search commands" placeholder="Search commands" aria-expanded="true" aria-controls="command-launcher-list" aria-activedescendant={rows.length ? `command-launcher-${selected}` : undefined} autoComplete="off" spellCheck={false} value={query} onChange={event => { scrollToActive.current = true; setActive(0); setQuery(event.target.value); }}/>
    {rows.length ? <ul ref={list} id="command-launcher-list" role="listbox" aria-label="Commands">{rows.map((row, index) => {
      const key = keyLabel(row.id);
      return <li key={row.id} id={`command-launcher-${index}`} role="option" aria-selected={index === selected} aria-checked={row.checked} onMouseMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => run(row)}><span className="launcher-check" aria-hidden="true">{row.checked ? '✓' : ''}</span><span className="launcher-name">{row.label}{row.value && <>: <span translate="no">{row.value}</span></>}</span>{key && <kbd>{key}</kbd>}</li>;
    })}</ul> : <p className="launcher-empty">No matching command</p>}
  </div>;
}
