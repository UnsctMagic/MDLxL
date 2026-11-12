import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import useDismiss from './useDismiss.js';
import './desktop-menu.css';

function entryAt(items, path) {
  let entry;
  for (const index of path) {
    entry = items?.[index];
    items = entry?.submenu;
  }
  return entry;
}

function MenuPopup({ entry, path, expanded, trigger, onHover, onClick }) {
  const popup = useRef(null);
  const id = path.join('.');
  useLayoutEffect(() => {
    const anchor = trigger(id);
    const panel = popup.current;
    if (!anchor || !panel) return;
    const position = () => {
      const { left, right, top, bottom } = anchor.getBoundingClientRect();
      const { width, height } = panel.getBoundingClientRect();
      const edge = path.length === 1 ? left : right + width + 2 <= window.innerWidth ? right - 2 : left - width + 2;
      panel.style.left = Math.max(4, Math.min(edge, window.innerWidth - width - 4)) + 'px';
      panel.style.top = Math.max(0, Math.min(path.length === 1 ? bottom : top, window.innerHeight - height - 4)) + 'px';
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [entry, id, path.length, trigger]);

  return <div ref={popup} className="desktop-menu-popup" role="menu" aria-label={entry.label} data-menu-popup={id} translate="no">
    {entry.submenu.map((row, index) => {
      if (row.type === 'separator') return <hr role="separator" key={index}/>;
      const rowPath = [...path, index];
      const key = rowPath.join('.');
      const checkable = row.type === 'checkbox' || row.type === 'radio';
      const open = expanded === key;
      return <button type="button" key={index} tabIndex={-1} role={checkable ? 'menuitem' + row.type : 'menuitem'} disabled={!row.enabled}
        aria-checked={checkable ? row.checked : undefined} aria-haspopup={row.submenu ? 'menu' : undefined}
        aria-expanded={row.submenu ? open : undefined} data-menu-path={key}
        onPointerEnter={event => {
          if (event.pointerType !== 'mouse') return;
          if (row.enabled) event.currentTarget.focus({ preventScroll: true });
          onHover(row, rowPath);
        }} onClick={() => onClick(row, rowPath)}>
        <span className="desktop-menu-mark" aria-hidden="true">{row.checked ? (row.type === 'radio' ? '●' : '✓') : ''}</span>
        <span className="desktop-menu-label" translate="no">{row.label}</span>
        {row.shortcut && <kbd aria-hidden="true" translate="no">{row.shortcut}</kbd>}
        {row.submenu && <span className="desktop-menu-arrow" aria-hidden="true">▸</span>}
      </button>;
    })}
  </div>;
}

export default function DesktopMenu({ desktop, classic }) {
  const root = useRef(null);
  const previousFocus = useRef(null);
  const pendingFocus = useRef(null);
  const [items, setItems] = useState([]);
  const [openPath, setOpenPath] = useState([]);
  const [topTab, setTopTab] = useState(0);
  const trigger = React.useCallback(id => root.current?.querySelector('[data-menu-path="' + id + '"]'), []);
  const popupButtons = path => [...(root.current?.querySelector('[data-menu-popup="' + path.join('.') + '"]')
    ?.querySelectorAll(':scope > button:not(:disabled)') || [])];

  useEffect(() => desktop.onMenuItems(setItems), [desktop]);
  const close = (restoreFocus = false) => {
    setOpenPath([]);
    if (restoreFocus && previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    previousFocus.current = null;
  };
  useDismiss(openPath.length > 0, [root], () => close(), { escape: false });
  useEffect(() => {
    const onBlur = () => close();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);
  useLayoutEffect(() => {
    const end = pendingFocus.current;
    pendingFocus.current = null;
    if (end === null) return;
    const buttons = popupButtons(openPath);
    (buttons.at(end) || trigger(openPath.join('.')))?.focus();
  }, [openPath, trigger]);

  const open = (path, focusIndex = null) => {
    pendingFocus.current = focusIndex;
    setTopTab(path[0]);
    setOpenPath(path);
  };
  const rememberFocus = () => {
    if (!root.current?.contains(document.activeElement)) previousFocus.current = document.activeElement;
  };
  const clickRow = (row, path) => {
    if (row.submenu) { open(path, 0); return; }
    close(true);
    desktop.clickMenuItem(row.id);
  };
  const hoverRow = (row, path) => {
    const next = row.enabled && row.submenu ? path : path.slice(0, -1);
    if (next.join('.') !== openPath.join('.')) open(next);
  };

  useWindowKeyClaim(({ event }) => {
    if (!items.length || event.target?.ownerDocument !== root.current?.ownerDocument || event.isComposing ||
        event.target.closest?.('[data-hotkey-recording]')) return false;
    const focused = event.target.closest?.('[data-menu-path]');
    const focusPath = focused && root.current.contains(focused) ? focused.dataset.menuPath.split('.').map(Number) : null;
    const { key, altKey, ctrlKey, metaKey, shiftKey } = event;
    if (altKey && !ctrlKey && !metaKey && !shiftKey && key.length === 1) {
      const index = items.findIndex(item => item.mnemonic === key.toLowerCase());
      if (index >= 0) { rememberFocus(); open([index], 0); return true; }
    }
    if (key === 'F10' && !altKey && !ctrlKey && !metaKey && !shiftKey) {
      if (focusPath) close(true);
      else { rememberFocus(); setTopTab(0); trigger('0')?.focus(); }
      return true;
    }
    if (!focusPath && !openPath.length) return false;
    const path = focusPath || openPath;
    const panel = path.slice(0, -1);
    const inPopup = panel.length > 0;

    if (key === 'Escape') {
      if (openPath.length > 1) {
        open(openPath.slice(0, -1));
        trigger(openPath.join('.'))?.focus();
      } else close(true);
    } else if (key === 'Tab') {
      close(true);
      return false;
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      const step = key === 'ArrowDown' ? 1 : -1;
      if (!inPopup) open(path, step === 1 ? 0 : -1);
      else {
        const buttons = popupButtons(panel);
        const index = buttons.indexOf(focused);
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      }
    } else if (key === 'Home' || key === 'End') {
      const end = key === 'Home' ? 0 : -1;
      if (inPopup) popupButtons(panel).at(end)?.focus();
      else {
        const index = end === 0 ? 0 : items.length - 1;
        setTopTab(index);
        if (openPath.length) open([index], 0);
        else trigger(String(index))?.focus();
      }
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (key === 'ArrowRight' && inPopup && entryAt(items, path)?.submenu) open(path, 0);
      else if (key === 'ArrowLeft' && panel.length > 1) { open(panel.slice(0, -1)); trigger(panel.join('.'))?.focus(); }
      else {
        const index = (path[0] + (key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
        setTopTab(index);
        if (openPath.length) open([index], 0);
        else trigger(String(index))?.focus();
      }
    } else if (key === 'Enter' || key === ' ') {
      if (inPopup && focused) focused.click();
      else open([path[0]], 0);
    } else if (key.length === 1 && !ctrlKey && !altKey && !metaKey && inPopup) {
      const letter = key.toLowerCase();
      const rows = entryAt(items, panel)?.submenu || [];
      const mnemonic = rows.findIndex(row => row.enabled && row.mnemonic === letter);
      if (mnemonic >= 0) trigger([...panel, mnemonic].join('.'))?.click();
      else {
        const buttons = popupButtons(panel);
        const start = buttons.indexOf(focused) + 1;
        [...buttons.slice(start), ...buttons.slice(0, start)].find(button => button.querySelector('.desktop-menu-label')?.textContent.toLowerCase().startsWith(letter))?.focus();
      }
    } else return openPath.length > 0 && key !== 'Alt';
    return true;
  }, -25);

  return <nav ref={root} role="menubar" aria-label="Application menu" className={classic ? "desktop-menu classic-menu" : "desktop-menu"}>
    {items.map((item, index) => <button key={index} type="button" tabIndex={index === topTab ? 0 : -1} role="menuitem"
      aria-haspopup="menu" aria-expanded={index === openPath[0]} data-menu-path={index} translate="no"
      onPointerDown={rememberFocus}
      onPointerEnter={event => { if (event.pointerType === 'mouse' && openPath.length && openPath[0] !== index) { event.currentTarget.focus(); open([index]); } }}
      onClick={() => { if (openPath[0] === index) close(true); else open([index]); }}>{item.label}</button>)}
    {openPath.map((_, depth) => {
      const path = openPath.slice(0, depth + 1);
      const entry = entryAt(items, path);
      return entry?.submenu && <MenuPopup key={path.join('.')} entry={entry} path={path} expanded={openPath.slice(0, depth + 2).join('.')}
        trigger={trigger} onHover={hoverRow} onClick={clickRow}/>;
    })}
  </nav>;
}
