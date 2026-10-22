import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { canHandleHotkeyEvent, chordFromEvent, effectiveBindings, formatChord, isTextEditingTarget, MAX_HOTKEY_ID_LENGTH } from '../src/preferences.js';
import { contextualHotkeyDefaults, hotkeyCode, HotkeySequence, HOTKEY_LEADER, LEGACY_HOTKEY_CATALOG_STORAGE_KEY, migrateHotkeyId } from '../src/hotkey-defaults.js';
import { hotkeyBadge } from '../src/hotkey-badge.js';
import './settings.css';
import './hotkey-sequences.css';

const HotkeysContext = createContext({ catalog: [], shortcuts: {} });
export const useHotkeys = () => useContext(HotkeysContext);
const CATALOG_STORAGE_KEY = 'mdlvis-classic-hotkeys-catalog-v1';
function loadCatalog() {
  try {
    // A profile from before the rename keeps its discovered controls and their codes; saves use the new key only.
    const records = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) || localStorage.getItem(LEGACY_HOTKEY_CATALOG_STORAGE_KEY) || '[]');
    return new Map((Array.isArray(records) ? records : []).slice(0, 40000).filter(item => item && typeof item.id === 'string' && item.id.length <= MAX_HOTKEY_ID_LENGTH && typeof item.label === 'string').map(item => [migrateHotkeyId(item.id), { id: migrateHotkeyId(item.id), label: item.label.slice(0, 250), category: typeof item.category === 'string' ? item.category.slice(0, 100) : 'Context controls', scope: typeof item.scope === 'string' ? item.scope : 'context', defaultCode: item.defaultCode, defaultKeys: [], contextual: true }]));
  } catch { return new Map(); }
}

/** Explicit control identities compose with stable resource / section prefixes. */
export function controlActionId(element) {
  const id = element.getAttribute('data-hotkey');
  if (!id) return '';
  if (element.hasAttribute('data-hotkey-absolute')) return id;
  const prefixes = []; let parent = element.parentElement;
  while (parent) { const prefix = parent.getAttribute('data-hotkey-prefix'); if (prefix) prefixes.unshift(prefix); parent = parent.parentElement; }
  return [...prefixes, id].join(':');
}
function visible(element) {
  return !!element?.isConnected && !element.hidden && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 && (element.ownerDocument.defaultView || window).getComputedStyle(element).visibility !== 'hidden';
}
function activeDialog(root) { return [...root.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(visible).at(-1); }
function enabled(element) { return !element.disabled && element.getAttribute('aria-disabled') !== 'true' && !element.closest('fieldset[disabled]'); }

function actionMetadata(element, id) {
  const title = element.hasAttribute('data-hotkey-base-title') ? element.getAttribute('data-hotkey-base-title') : element.getAttribute('title');
  const label = element.getAttribute('data-hotkey-label') || element.getAttribute('aria-label') || title || element.closest('label')?.textContent?.trim() || element.textContent?.replaceAll(element.querySelector('[data-hotkey-badge]')?.textContent || '\u0000', '').trim() || id;
  return { id, label, category: element.getAttribute('data-hotkey-category') || element.closest('[data-hotkey-category]')?.getAttribute('data-hotkey-category') || (id.includes(':') ? 'Context controls' : 'Controls'), scope: element.closest('[data-hotkey-scope]')?.getAttribute('data-hotkey-scope') || 'editor', defaultKeys: [], contextual: true };
}

/** All identities come from the catalog or explicit data-hotkey attributes, never inferred labels. */
export function HotkeysProvider({ preferences, catalog = [], activeScope = 'editor', onAction, onCatalogChange, children }) {
  const root = useRef(null), discovered = useRef(null), [revision, setRevision] = useState(0), latest = useRef({});
  const detachedRoots = useRef(new Set());
  const controlRoots = () => [root.current, ...detachedRoots.current].filter(element => element?.isConnected);
  const [leaderCode, setLeaderCode] = useState(null);
  if (!discovered.current) discovered.current = loadCatalog();
  const merged = useMemo(() => {
    const map = new Map(discovered.current);
    for (const action of catalog) map.set(action.id, { ...map.get(action.id), contextual: false, scope: 'editor', ...action });
    for (const id of Object.keys(preferences?.hotkeys || {})) if (!map.has(id)) map.set(id, { id, label: id, category: 'Saved controls', scope: 'context', contextual: true, defaultKeys: [] });
    const actions = contextualHotkeyDefaults([...map.values()], Object.values(preferences?.hotkeys || {}).flat());
    for (const action of actions) if (action.contextual) discovered.current.set(action.id, action);
    return actions;
  }, [catalog, preferences?.hotkeys, revision]);
  const shortcuts = useMemo(() => effectiveBindings(merged, preferences?.hotkeys), [merged, preferences?.hotkeys]);
  const shortcutSignature = JSON.stringify(shortcuts);
  latest.current = { catalog: merged, shortcuts, activeScope, onAction };

  useEffect(() => { onCatalogChange?.(merged); }, [merged, onCatalogChange]);
  useEffect(() => {
    if (!revision) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify([...discovered.current.values()].slice(-40000).map(({ id, label, category, scope, defaultCode }) => ({ id, label, category, scope, defaultCode })))); } catch { /* Settings still work when browser storage is unavailable. */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [revision]);
  useEffect(() => {
    let queued = false, disposed = false;
    const discover = () => {
      queued = false; if (disposed || !root.current) return;
      let changed = false;
      for (const controlRoot of controlRoots()) for (const element of controlRoot.querySelectorAll('[data-hotkey]')) {
        const id = controlActionId(element); if (!id) continue;
        const currentTitle = element.getAttribute('title') || '';
        if (currentTitle !== element.getAttribute('data-hotkey-tooltip')) element.setAttribute('data-hotkey-base-title', currentTitle);
        const previous = discovered.current.get(id), meta = { ...actionMetadata(element, id), defaultCode: previous?.defaultCode, defaultKeys: previous?.defaultKeys || [] };
        if (!previous || JSON.stringify(previous) !== JSON.stringify(meta)) { discovered.current.set(id, meta); changed = true; }
        const keys = latest.current.shortcuts[id] || [];
        // aria-keyshortcuts describes simultaneous keys, not three-character sequences.
        element.setAttribute('aria-keyshortcuts', keys.filter(key => !hotkeyCode(key)).map(key => key.replaceAll('Ctrl', 'Control').replaceAll('Plus', '+')).join(' '));
        element.setAttribute('data-hotkey-shortcuts', keys.join(' / '));
        const forgeHint = id.startsWith('forge:');
        const title = [element.getAttribute('data-hotkey-base-title'), forgeHint && keys.length ? `Hotkey: ${keys.map(formatChord).join(' / ')}` : keys.map(hotkeyBadge).filter(Boolean).length ? `Hotkey: ${keys.map(hotkeyBadge).filter(Boolean).join(' / ')}` : ''].filter(Boolean).join('\n');
        element.setAttribute('title', title); element.setAttribute('data-hotkey-tooltip', title);
        if (element.tagName !== 'BUTTON' || element.getAttribute('data-hotkey-badges') === 'false') continue;
        let badge = element.querySelector(':scope > [data-hotkey-badge]');
        const text = keys.length ? (forgeHint ? hotkeyCode(keys[0]) : '') || hotkeyBadge(keys[0]) || formatChord(keys[0]) : '';
        if (!text) { if (badge) badge.remove(); element.classList.remove('hotkey-control'); continue; }
        element.classList.add('hotkey-control');
        if (!badge) { badge = element.ownerDocument.createElement('span'); badge.className = 'hotkey-badge'; badge.dataset.hotkeyBadge = ''; badge.setAttribute('aria-hidden', 'true'); element.appendChild(badge); }
        if (badge.textContent !== text) badge.textContent = text; badge.dataset.longHint=String(text.length>3);
        if (badge.title !== keys.map(formatChord).join(' / ')) badge.title = keys.map(formatChord).join(' / ');
      }
      if (changed) setRevision(value => value + 1);
    };
    const schedule = () => { if (!queued) { queued = true; queueMicrotask(discover); } };
    const observer = new MutationObserver(schedule);
    const observeRoots = () => {
      observer.disconnect();
      for (const element of controlRoots()) observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-hotkey', 'data-hotkey-prefix', 'data-hotkey-scope', 'data-hotkey-label', 'data-hotkey-category'] });
    };
    const registerRoot = event => {
      const element = event.detail?.root;
      if (!element?.querySelectorAll) return;
      if (event.detail.add) detachedRoots.current.add(element); else detachedRoots.current.delete(element);
      observeRoots(); schedule();
    };
    window.addEventListener('mdlxl-detached-root', registerRoot); observeRoots();
    window.dispatchEvent(new CustomEvent('mdlxl-hotkeys-ready'));
    root.current.__refreshHotkeys = discover;
    discover();
    return () => { disposed = true; observer.disconnect(); window.removeEventListener('mdlxl-detached-root', registerRoot); detachedRoots.current.clear(); if (root.current) delete root.current.__refreshHotkeys; };
  }, []);
  // Command enablement changes during playback; only actual binding changes need a DOM scan.
  useEffect(() => { root.current?.__refreshHotkeys?.(); }, [shortcutSignature]);

  useEffect(() => {
    const sequence = new HotkeySequence(); let timer;
    const cancel = () => { sequence.cancel(); clearTimeout(timer); setLeaderCode(null); };
    const consume = event => { window.dispatchEvent(new CustomEvent('mdlxl-input-observed', {detail:event})); event.preventDefault(); event.stopImmediatePropagation(); };
    const runShortcut = (chord, event) => {
      if (!root.current) return false;
      const { catalog: actions, shortcuts: bindings, activeScope: scope, onAction: dispatch } = latest.current;
      const ownerDocument = event.target?.ownerDocument || document;
      const roots = controlRoots().filter(element => element.ownerDocument === ownerDocument);
      // A main application modal also blocks controls in the detached editor.
      const modal = activeDialog(root.current) || roots.map(activeDialog).filter(Boolean).at(-1), modalScope = modal?.getAttribute('data-hotkey-scope') || modal?.closest('[data-hotkey-scope]')?.getAttribute('data-hotkey-scope');
      // Forge's shape tools own their keys only in the visible Shape workspace.
      // Other editors keep their original bindings, even when a key is reused here.
      const forge = roots.flatMap(element => [...element.querySelectorAll('[data-hotkey-scope="forge-shapes"]')]).find(element => visible(element) && (!modal || modal.contains(element)));
      const matching = actions.filter(action => bindings[action.id]?.includes(chord) && (action.scope !== 'forge-shapes' || forge));
      const local = forge ? matching.filter(action => action.scope === 'forge-shapes') : [];
      const candidates = local.length ? local : matching;
      // Reject duplicate bindings within the active context.
      if (candidates.length !== 1) return false;
      const action = candidates[0];
      const available = roots.flatMap(element => [...element.querySelectorAll('[data-hotkey]')]).filter(element => controlActionId(element) === action.id && visible(element) && (modal ? modal.contains(element) : !element.closest('[role="dialog"][aria-modal="true"]')));
      if (available.length && available.every(element => !enabled(element))) return false;
      const targets = available.filter(enabled);
      const target = targets.find(element => modal ? modal.contains(element) : !element.closest('[role="dialog"][aria-modal="true"]'));
      // A dialog's local button owns its availability (and its own history).
      // The main document may have nothing to undo while Forge has edits.
      if (!canHandleHotkeyEvent(event, modal && target ? { ...action, enabled: true } : action)) return false;
      const canRun = (typeof action.run === 'function' || typeof dispatch === 'function' && !action.contextual) && (modal ? action.allowInModal === true || action.scope === modalScope : !action.scope || action.scope === scope || action.scope === 'global');
      if (!target && !canRun) return false;
      consume(event);
      if (target) {
        if (target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea, select, [contenteditable="true"]')) { target.focus(); if (target.matches('input[type="text"], input:not([type]), textarea')) target.select?.(); }
        else { target.focus({ preventScroll: true }); target.click(); }
      } else if (typeof action.run === 'function') action.run(event); else dispatch(action.id, event);
      // Shredder the Wise learns which shortcuts the user already knows.
      window.dispatchEvent(new CustomEvent('mdlxl-hotkey-used', { detail: { id: action.id, chord } }));
      return true;
    };
    const keydown = event => {
      if (event.target?.closest?.('[data-hotkey-recording]')) { cancel(); return; }
      if(!window.dispatchEvent(new CustomEvent('mdlxl-showcase-key',{detail:event,cancelable:true}))){cancel();return;}
      // The focused UV workspace owns numpad nudges before global number shortcuts.
      if(!window.dispatchEvent(new CustomEvent('mdlxl-uv-key',{detail:event,cancelable:true}))){cancel();return;}
      // Paint owns its brush/clipboard shortcuts before global mesh commands.
      if(latest.current.activeScope==='paint'&&!window.dispatchEvent(new CustomEvent('mdlxl-paint-key',{detail:event,cancelable:true}))){cancel();return;}
      if (event.key === 'Escape' && event.target?.ownerDocument?.querySelector('.bone-create-menu')) return;
      if (event.key?.toLowerCase() === 'a' && !event.ctrlKey && !event.metaKey && !event.altKey &&
          event.target?.ownerDocument?.querySelector('.uv-workspace-body[data-pointer-region="preview"]')) { cancel(); return; }
      const chord = chordFromEvent(event);
      if (sequence.active && (event.defaultPrevented || isTextEditingTarget(event.target) || event.isComposing || event.keyCode === 229)) { cancel(); return; }
      if (sequence.active || chord === HOTKEY_LEADER && canHandleHotkeyEvent(event)) {
        const next = sequence.feed(event);
        clearTimeout(timer); setLeaderCode(next.pending ? next.code : null);
        if (next.pending) timer = setTimeout(cancel, sequence.timeoutMs);
        if (next.chord) runShortcut(next.chord, event);
        if (next.consume) { consume(event); return; }
      }
      if (chord) runShortcut(chord, event);
    };
    window.addEventListener('keydown', keydown, true);
    const detachedKeydown = event => keydown(event.detail);
    window.addEventListener('mdlxl-detached-keydown', detachedKeydown);
    window.addEventListener('blur', cancel);
    window.addEventListener('mdlxl-detached-blur', cancel);
    window.addEventListener('pointerdown', cancel, true);
    const visibility = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', keydown, true); window.removeEventListener('mdlxl-detached-keydown', detachedKeydown); window.removeEventListener('blur', cancel); window.removeEventListener('mdlxl-detached-blur', cancel); window.removeEventListener('pointerdown', cancel, true); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    const reveal = event => {
      if(event.key !== 'Alt' || event.ctrlKey || event.metaKey || isTextEditingTarget(event.target))return;
      const ownerDocument=event.target?.ownerDocument || document;
      const roots=controlRoots().filter(element=>element.ownerDocument===ownerDocument);
      const modal=activeDialog(root.current) || roots.map(activeDialog).filter(Boolean).at(-1);
      for(const controlRoot of controlRoots()) for(const element of controlRoot.querySelectorAll('.hotkey-control'))element.dataset.hotkeyAvailable=String(element.ownerDocument===ownerDocument&&enabled(element)&&visible(element)&&(!modal||modal.contains(element)));
      ownerDocument.documentElement.dataset.shortcutHints='true';
    };
    const dismiss = () => { for(const element of controlRoots())delete element.ownerDocument.documentElement.dataset.shortcutHints; delete document.documentElement.dataset.shortcutHints; };
    const released = event => { if (event.key === 'Alt' || !event.altKey) dismiss(); };
    window.addEventListener('keydown', reveal, true); window.addEventListener('keyup', released, true); window.addEventListener('blur', dismiss);
    const detachedReveal=event=>reveal(event.detail), detachedRelease=event=>released(event.detail);
    window.addEventListener('mdlxl-detached-keydown', detachedReveal); window.addEventListener('mdlxl-detached-keyup', detachedRelease); window.addEventListener('mdlxl-detached-blur', dismiss);
    return () => { window.removeEventListener('keydown', reveal, true); window.removeEventListener('keyup', released, true); window.removeEventListener('blur', dismiss); window.removeEventListener('mdlxl-detached-keydown', detachedReveal); window.removeEventListener('mdlxl-detached-keyup', detachedRelease); window.removeEventListener('mdlxl-detached-blur', dismiss); dismiss(); };
  }, []);
  return <HotkeysContext.Provider value={{ catalog: merged, shortcuts }}><div ref={root} className="hotkeys-root">{children}{leaderCode !== null && <div className="hotkeys-sequence-cue" data-hotkey-sequence="" role="status" aria-live="polite"><strong>Hotkeys</strong><kbd>{leaderCode.padEnd(3, '·')}</kbd><span>Type the green code · Esc cancels</span></div>}</div></HotkeysContext.Provider>;
}

/** Optional explicit badge for controls outside the discovery root. */
export function HotkeyBadge({ actionId }) {
  const { shortcuts } = useHotkeys(); const keys = shortcuts[actionId] || [], forge = actionId.startsWith('forge:');
  const label = forge && keys.length ? hotkeyCode(keys[0]) || hotkeyBadge(keys[0]) || formatChord(keys[0]) : keys.map(hotkeyBadge).find(Boolean);
  return label ? <span className={'hotkey-badge'+(forge?' forge-key':'')} data-hotkey-badge="" aria-hidden="true" title={keys.map(formatChord).join(' / ')}>{label}</span> : null;
}
