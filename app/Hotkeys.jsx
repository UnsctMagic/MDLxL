import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { canHandleHotkeyEvent, chordFromEvent, effectiveBindings, formatChord, isTextEditingTarget, MAX_HOTKEY_ID_LENGTH } from '../src/preferences.js';
import { contextualHotkeyDefaults, hotkeyCode, HotkeySequence, HOTKEY_LEADER, LEGACY_HOTKEY_CATALOG_STORAGE_KEY, migrateHotkeyId } from '../src/hotkey-defaults.js';
import { hotkeyHint } from '../src/hotkey-badge.js';
import { controlKind } from '../src/hotkey-allocation.js';
import { translate } from '../src/localization.js';
import './settings.css';
import './hotkey-sequences.css';

const HotkeysContext = createContext({ catalog: [], shortcuts: {} });
export const useHotkeys = () => useContext(HotkeysContext);
const CATALOG_STORAGE_KEY = 'mdlvis-classic-hotkeys-catalog-v1';
function loadCatalog() {
  try {
    // A profile from before the rename keeps its discovered controls; saves use the new key only.
    // Each control keeps the window it lives in and the short key it was first given.
    const records = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) || localStorage.getItem(LEGACY_HOTKEY_CATALOG_STORAGE_KEY) || '[]');
    return new Map((Array.isArray(records) ? records : []).slice(0, 40000).filter(item => item && typeof item.id === 'string' && item.id.length <= MAX_HOTKEY_ID_LENGTH && typeof item.label === 'string').map(item => [migrateHotkeyId(item.id), { id: migrateHotkeyId(item.id), label: item.label.slice(0, 250), category: typeof item.category === 'string' ? item.category.slice(0, 100) : 'Context controls', scope: typeof item.scope === 'string' ? item.scope : 'context', group: typeof item.group === 'string' ? item.group.slice(0, 250) : undefined, parentGroup: typeof item.parentGroup === 'string' ? item.parentGroup.slice(0, 250) : undefined, kind: typeof item.kind === 'string' ? item.kind : undefined, embedsEditor: item.embedsEditor === true, defaultKey: typeof item.defaultKey === 'string' ? item.defaultKey.slice(0, 40) : '', defaultKeys: [], contextual: true }]));
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

// A badge may escape its button's clipping, but an off-screen control gets no badge.
function hintRect(element, styles) {
  const rect = element.getBoundingClientRect(), doc = element.ownerDocument;
  let left = Math.max(0, rect.left), top = Math.max(0, rect.top), right = Math.min(doc.documentElement.clientWidth, rect.right), bottom = Math.min(doc.documentElement.clientHeight, rect.bottom);
  for (let parent = element.parentElement; parent && right > left && bottom > top; parent = parent.parentElement) {
    let style = styles.get(parent);
    if (!style) { style = doc.defaultView.getComputedStyle(parent); styles.set(parent, style); }
    const clipsX = /hidden|clip|auto|scroll/.test(style.overflowX), clipsY = /hidden|clip|auto|scroll/.test(style.overflowY);
    if (!clipsX && !clipsY) continue;
    const bounds = parent.getBoundingClientRect();
    if (clipsX) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
    if (clipsY) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
  }
  return right > left && bottom > top ? rect : null;
}
function placeHint(badge, rect) {
  const set = (name, value) => { if (badge.style.getPropertyValue(name) !== value) badge.style.setProperty(name, value); };
  set('--hotkey-hint-width', `${Math.max(28, Math.floor(rect.width))}px`);
  if (!badge.matches(':popover-open')) badge.showPopover();
  const box = badge.getBoundingClientRect(), viewport = badge.ownerDocument.documentElement;
  set('left', `${Math.max(3, Math.min(rect.right - box.width, viewport.clientWidth - box.width - 3))}px`);
  set('top', `${Math.max(3, Math.min(rect.top, viewport.clientHeight - box.height - 3))}px`);
}

/**
 * The window a control lives in, for its default key: the editor, or a modal dialog (by its
 * hotkey prefix or title). Each page of a tabbed dialog (Settings) is a window of its own
 * inside it (`parentGroup`).
 */
function controlWindow(element) {
  const modal = element.closest('[role="dialog"][aria-modal="true"]') || element.closest('[data-hotkey-window]');
  if (!modal) return { group: 'editor', embedsEditor: false };
  const group = modal.getAttribute('data-hotkey-prefix') || modal.getAttribute('aria-label') || 'dialog';
  const page = element.closest('[role="tabpanel"][id]');
  // Forge and the shaping tools show the editor's own buttons, so their keys stay clear of the editor's.
  const embedsEditor = !!modal.querySelector('[data-hotkey="undo"], [data-hotkey="select"], [data-hotkey="fit"]');
  return page && modal.contains(page) ? { group: `${group} › ${page.id}`, parentGroup: group, embedsEditor } : { group, embedsEditor };
}
function actionMetadata(element, id) {
  const title = element.hasAttribute('data-hotkey-base-title') ? element.getAttribute('data-hotkey-base-title') : element.getAttribute('title');
  const label = element.getAttribute('data-hotkey-label') || element.getAttribute('aria-label') || title || element.closest('label')?.textContent?.trim() || element.textContent?.replaceAll(element.querySelector('[data-hotkey-badge]')?.textContent || '\u0000', '').trim() || id;
  return { id, label, category: element.getAttribute('data-hotkey-category') || element.closest('[data-hotkey-category]')?.getAttribute('data-hotkey-category') || (id.includes(':') ? 'Context controls' : 'Controls'), scope: element.closest('[data-hotkey-scope]')?.getAttribute('data-hotkey-scope') || 'editor', ...controlWindow(element), kind: controlKind(element), defaultKeys: [], contextual: true };
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
      try { localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify([...discovered.current.values()].slice(-40000).map(({ id, label, category, scope, group, parentGroup, kind, embedsEditor, defaultKey }) => ({ id, label, category, scope, group, parentGroup, kind, embedsEditor, defaultKey })))); } catch { /* Settings still work when browser storage is unavailable. */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [revision]);
  useEffect(() => {
    let queued = false, disposed = false;
    const discover = () => {
      queued = false; if (disposed || !root.current) return;
      let changed = false;
      const commandIds = new Set(latest.current.catalog.filter(action => !action.contextual).map(action => action.id));
      for (const controlRoot of controlRoots()) for (const element of controlRoot.querySelectorAll('[data-hotkey]')) {
        const id = controlActionId(element); if (!id) continue;
        const currentTitle = element.getAttribute('title') || '';
        if (currentTitle !== element.getAttribute('data-hotkey-tooltip')) element.setAttribute('data-hotkey-base-title', currentTitle);
        const previous = discovered.current.get(id), meta = { ...actionMetadata(element, id), defaultKey: previous?.defaultKey || '', defaultKeys: previous?.defaultKeys || [] };
        // A control keeps the window it was first found in (the shaping tools reuse some editor controls).
        if (previous?.group) Object.assign(meta, { group: previous.group, parentGroup: previous.parentGroup, embedsEditor: previous.embedsEditor });
        if (!previous || JSON.stringify(previous) !== JSON.stringify(meta)) { discovered.current.set(id, meta); changed = true; }
        const keys = latest.current.shortcuts[id] || [];
        // aria-keyshortcuts describes simultaneous keys, not three-character sequences.
        element.setAttribute('aria-keyshortcuts', keys.filter(key => !hotkeyCode(key)).map(key => key.replaceAll('Ctrl', 'Control').replaceAll('Plus', '+')).join(' '));
        element.setAttribute('data-hotkey-shortcuts', keys.join(' / '));
        const forgeHint = id.startsWith('forge:');
        const shortKeys = keys.filter(key => !hotkeyCode(key));
        const title = [element.getAttribute('data-hotkey-base-title'), forgeHint && keys.length ? translate(`Hotkey: ${keys.map(formatChord).join(' / ')}`) : shortKeys.length ? translate(`Hotkey: ${shortKeys.map(formatChord).join(' / ')}`) : ''].filter(Boolean).join('\n');
        element.setAttribute('title', title); element.setAttribute('data-hotkey-tooltip', title);
        // Forge's own tiles keep their compact look: their window keys show in the tooltip only.
        if (element.tagName !== 'BUTTON' || element.closest('[data-hotkey-badges]')?.getAttribute('data-hotkey-badges') === 'false' || forgeHint && !commandIds.has(id)) continue;
        let badge = element.querySelector(':scope > [data-hotkey-badge]');
        const text = keys.length ? (forgeHint ? hotkeyCode(keys[0]) : '') || hotkeyHint(keys[0]) : '';
        if (!text) { if (badge) badge.remove(); element.classList.remove('hotkey-control'); continue; }
        element.classList.add('hotkey-control');
        if (!badge) { badge = element.ownerDocument.createElement('span'); badge.className = 'hotkey-badge'; badge.dataset.hotkeyBadge = ''; badge.setAttribute('aria-hidden', 'true'); badge.popover = 'manual'; element.appendChild(badge); }
        if (badge.textContent !== text) badge.replaceChildren(...text.split('+').flatMap((part, index) => index ? [element.ownerDocument.createElement('wbr'), '+' + part] : [part]));
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
      const modal = activeDialog(root.current) || roots.map(activeDialog).filter(Boolean).at(-1);
      // A docked console owns keys only while focus is inside it. The model editor
      // remains usable beside it; a real modal still takes priority over both.
      const localWindow = modal || event.target?.closest?.('[data-hotkey-window]');
      const modalScope = localWindow?.getAttribute('data-hotkey-scope') || localWindow?.closest('[data-hotkey-scope]')?.getAttribute('data-hotkey-scope');
      // Forge's shape tools own their keys only in the visible Shape workspace.
      // Other editors keep their original bindings, even when a key is reused here.
      const forge = roots.flatMap(element => [...element.querySelectorAll('[data-hotkey-scope="forge-shapes"]')]).find(element => visible(element) && (!modal || modal.contains(element)));
      const matching = actions.filter(action => bindings[action.id]?.includes(chord) && (action.scope !== 'forge-shapes' || forge));
      const local = forge ? matching.filter(action => action.scope === 'forge-shapes') : [];
      const candidates = local.length ? local : matching;
      // The same key may belong to controls in different windows or modes; only those
      // on screen in the active window (or commands that can run there) take part.
      const controls = roots.flatMap(element => [...element.querySelectorAll('[data-hotkey]')]);
      const plans = candidates.map(action => {
        const available = controls.filter(element => controlActionId(element) === action.id && visible(element) && (localWindow ? localWindow.contains(element) : !element.closest('[role="dialog"][aria-modal="true"], [data-hotkey-window]')));
        if (available.length && available.every(element => !enabled(element))) return null;
        const target = available.find(enabled);
        // A dialog's local button owns its availability (and its own history).
        // The main document may have nothing to undo while Forge has edits.
        if (!canHandleHotkeyEvent(event, localWindow && target ? { ...action, enabled: true } : action)) return null;
        const canRun = (typeof action.run === 'function' || typeof dispatch === 'function' && !action.contextual) && (localWindow ? action.allowInModal === true || action.scope === modalScope : !action.scope || action.scope === scope || action.scope === 'global');
        return target || canRun ? { action, target } : null;
      }).filter(Boolean);
      // Reject duplicate bindings within the active context; a control on screen beats a command that only could run.
      const onScreen = plans.filter(plan => plan.target);
      const chosen = plans.length === 1 ? plans[0] : onScreen.length === 1 ? onScreen[0] : null;
      if (!chosen) return false;
      const { action, target } = chosen;
      consume(event);
      if (target) {
        if (target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea, select, [contenteditable="true"]')) { target.focus(); if (target.matches('input[type="text"], input:not([type]), textarea')) target.select?.(); }
        // A toggled checkbox keeps focus where the user works (e.g. the UV Wrapper).
        else { if (!target.matches('input[type="checkbox"]')) target.focus({ preventScroll: true }); target.click(); }
      } else if (typeof action.run === 'function') action.run(event); else dispatch(action.id, event);
      // Learn reminders count only shortcuts that actually ran.
      window.dispatchEvent(new CustomEvent('mdlxl-hotkey-used', { detail: { id: action.id, chord, event } }));
      return true;
    };
    const keydown = event => {
      if (event.target?.closest?.('[data-hotkey-recording]')) { cancel(); return; }
      const inLocalWindow = !!event.target?.closest?.('[data-hotkey-window]');
      if (event.key === 'Escape' && event.target?.ownerDocument?.querySelector('.learn-menu')) return;
      if(!inLocalWindow&&!window.dispatchEvent(new CustomEvent('mdlxl-showcase-key',{detail:event,cancelable:true}))){cancel();return;}
      // The focused UV workspace owns numpad nudges before global number shortcuts.
      if(!inLocalWindow&&!window.dispatchEvent(new CustomEvent('mdlxl-uv-key',{detail:event,cancelable:true}))){cancel();return;}
      // Paint owns its brush/clipboard shortcuts before global mesh commands.
      if(!inLocalWindow&&latest.current.activeScope==='paint'&&!window.dispatchEvent(new CustomEvent('mdlxl-paint-key',{detail:event,cancelable:true}))){cancel();return;}
      if (!inLocalWindow && event.key === 'Escape' && event.target?.ownerDocument?.querySelector('.bone-create-menu')) return;
      if (!inLocalWindow && event.key?.toLowerCase() === 'a' && !event.ctrlKey && !event.metaKey && !event.altKey &&
          event.target?.ownerDocument?.querySelector('.uv-workspace-body[data-pointer-region="preview"]')) { cancel(); return; }
      const chord = chordFromEvent(event);
      // Text selected in the AI chat copies as text; the editor's Copy is for the model.
      if (chord === 'Ctrl+C') {
        const selection = event.target?.ownerDocument?.getSelection?.();
        if (selection && !selection.isCollapsed && String(selection).trim() && selection.anchorNode?.parentElement?.closest('.ai-assistant')) return;
      }
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
    const persistent = !!preferences?.showHotkeys;
    let activeDocument = document, held = false, queued = false, disposed = false;
    const update = (ownerDocument, target) => {
      documents.add(ownerDocument);
      const roots=controlRoots().filter(element=>element.ownerDocument===ownerDocument);
      const modal=activeDialog(root.current) || roots.map(activeDialog).filter(Boolean).at(-1);
      const localWindow=modal||target?.closest?.('[data-hotkey-window]');
      for(const controlRoot of controlRoots()) for(const element of controlRoot.querySelectorAll('.hotkey-control'))element.dataset.hotkeyAvailable=String(element.ownerDocument===ownerDocument&&enabled(element)&&visible(element)&&(localWindow?localWindow.contains(element):!element.closest('[data-hotkey-window]')));
      if (persistent) for (const doc of documents) if (doc !== ownerDocument) delete doc.documentElement.dataset.shortcutHints;
      ownerDocument.documentElement.dataset.shortcutHints='true';
      const styles = new Map();
      for (const controlRoot of controlRoots()) for (const badge of controlRoot.querySelectorAll('[data-hotkey-badge]')) {
        const element = badge.closest('[data-hotkey]') || badge.parentElement.querySelector('[data-hotkey]') || badge.parentElement;
        const available = element.ownerDocument === ownerDocument && enabled(element) && visible(element) && (localWindow ? localWindow.contains(element) : !element.closest('[data-hotkey-window]'));
        const rect = available ? hintRect(element, styles) : null;
        if (rect) placeHint(badge, rect); else if (badge.matches(':popover-open')) badge.hidePopover();
      }
    };
    const reveal = event => {
      if (persistent || event.key !== 'Alt' || event.ctrlKey || event.metaKey || isTextEditingTarget(event.target)) return;
      held = true; activeDocument = event.target?.ownerDocument || document;
      update(event.target?.ownerDocument || document, event.target);
    };
    const dismiss = () => {
      if (persistent && !disposed) return;
      held = false;
      for (const doc of documents) {
        delete doc.documentElement.dataset.shortcutHints;
        for (const badge of doc.querySelectorAll('[data-hotkey-badge]:popover-open')) badge.hidePopover();
      }
    };
    const released = event => { if (event.key === 'Alt' || !event.altKey) dismiss(); };
    const refresh = () => {
      queued = false;
      if (disposed || !persistent && !held) return;
      if (!controlRoots().some(element => element.ownerDocument === activeDocument)) activeDocument = document;
      update(activeDocument, activeDocument.activeElement);
    };
    const schedule = event => {
      if (!persistent && !held) return;
      const doc = event?.target?.ownerDocument || event?.target?.document;
      if (doc?.documentElement) activeDocument = doc;
      if (!queued) { queued = true; queueMicrotask(refresh); }
    };
    const documents = new Set([document]);
    const hasHint = element => element?.nodeType === 1 && (element.matches('.hotkey-control,[data-hotkey-badge]') || element.querySelector('.hotkey-control,[data-hotkey-badge]'));
    const affectsHints = record => {
      if (record.type === 'attributes') {
        // Ignore our positioning writes and unchanged discovery classes, without
        // measuring controls for unrelated animation/cursor style changes.
        if (record.target.matches('[data-hotkey-badge]') || record.oldValue === record.target.getAttribute(record.attributeName)) return false;
        return hasHint(record.target);
      }
      return hasHint(record.target) || [...record.addedNodes, ...record.removedNodes].some(hasHint);
    };
    const observer = new MutationObserver(records => { if (!persistent || records.some(affectsHints)) schedule(); });
    const observe = () => {
      observer.disconnect();
      const next = new Set([document, ...controlRoots().map(element => element.ownerDocument)]);
      for (const doc of documents) if (!next.has(doc)) {
        delete doc.documentElement.dataset.shortcutHints;
        doc.removeEventListener('focusin', schedule, true); doc.removeEventListener('scroll', schedule, true); doc.defaultView?.removeEventListener('focus', schedule); doc.defaultView?.removeEventListener('resize', schedule);
        documents.delete(doc);
      }
      for (const doc of next) {
        documents.add(doc); doc.addEventListener('focusin', schedule, true); doc.addEventListener('scroll', schedule, { capture: true, passive: true }); doc.defaultView?.addEventListener('focus', schedule); doc.defaultView?.addEventListener('resize', schedule);
      }
      for (const element of controlRoots()) observer.observe(element, { childList: true, subtree: true, attributes: true, attributeOldValue: persistent, attributeFilter: ['disabled', 'aria-disabled', 'hidden', 'inert', 'open', 'class', 'style', 'data-hotkey', 'data-hotkey-window', 'aria-modal'] });
      schedule();
    };
    observe(); window.addEventListener('mdlxl-detached-root', observe);
    window.addEventListener('keydown', reveal, true); window.addEventListener('keyup', released, true); window.addEventListener('blur', dismiss);
    const detachedReveal=event=>reveal(event.detail), detachedRelease=event=>released(event.detail);
    window.addEventListener('mdlxl-detached-keydown', detachedReveal); window.addEventListener('mdlxl-detached-keyup', detachedRelease); window.addEventListener('mdlxl-detached-blur', dismiss);
    return () => {
      disposed = true; observer.disconnect(); window.removeEventListener('mdlxl-detached-root', observe);
      for (const doc of documents) { doc.removeEventListener('focusin', schedule, true); doc.removeEventListener('scroll', schedule, true); doc.defaultView?.removeEventListener('focus', schedule); doc.defaultView?.removeEventListener('resize', schedule); }
      window.removeEventListener('keydown', reveal, true); window.removeEventListener('keyup', released, true); window.removeEventListener('blur', dismiss); window.removeEventListener('mdlxl-detached-keydown', detachedReveal); window.removeEventListener('mdlxl-detached-keyup', detachedRelease); window.removeEventListener('mdlxl-detached-blur', dismiss); dismiss();
    };
  }, [preferences?.showHotkeys]);
  return <HotkeysContext.Provider value={{ catalog: merged, shortcuts }}><div ref={root} className="hotkeys-root">{children}{leaderCode !== null && <div className="hotkeys-sequence-cue" data-hotkey-sequence="" role="status" aria-live="polite"><strong>Hotkeys</strong><kbd>{leaderCode.padEnd(3, '·')}</kbd><span>Type the green code · Esc cancels</span></div>}</div></HotkeysContext.Provider>;
}

/** Optional explicit badge for controls outside the discovery root. */
export function HotkeyBadge({ actionId }) {
  const { shortcuts } = useHotkeys(); const keys = shortcuts[actionId] || [], forge = actionId.startsWith('forge:');
  const label = keys.length ? (forge ? hotkeyCode(keys[0]) : '') || hotkeyHint(keys[0]) : '';
  return label ? <span className={'hotkey-badge'+(forge?' forge-key':'')} data-hotkey-badge="" popover="manual" aria-hidden="true" title={keys.map(formatChord).join(' / ')}>{label.split('+').map((part, index) => <React.Fragment key={index}>{index > 0 && <wbr/>}{index ? '+' + part : part}</React.Fragment>)}</span> : null;
}
