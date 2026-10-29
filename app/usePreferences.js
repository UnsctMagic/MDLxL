import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizePreferences } from '../src/preferences.js';
import { PANEL_WIDTH_EVENT } from './SidebarResizer.jsx';

// On desktop, settings.json is the only preference store. `mdlvis-preferences`
// in localStorage is only a first-paint cache there, not a store: it lets the very
// first frame use the saved theme and language, it is rewritten only after
// settings.json accepted a write (configure() resolved) or initial() answered, and
// initial() always replaces whatever it held.
function writePaintCache(encoded) { try { localStorage.setItem('mdlvis-preferences', encoded); } catch {} }

export default function usePreferences({ settings, say }) {
  // Browser runs keep preferences in localStorage. On desktop the same key is the
  // first-paint cache (see writePaintCache); initial() replaces it from settings.json.
  const [preferences, setPreferences] = useState(() => { try { return normalizePreferences(JSON.parse(localStorage.getItem('mdlvis-preferences') || '{}')); } catch { return normalizePreferences({}); } });
  const [settingsTab, setSettingsTab] = useState(null), [preferencesReady, setPreferencesReady] = useState(!window.desktop);
  const openHotkeySettings = useCallback(() => setSettingsTab('hotkeys'), []);
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const savedPreferences = useRef(null), preferencesTimer = useRef();
  function changePreferences(next) { const value = normalizePreferences(typeof next === 'function' ? next(preferencesRef.current) : next); preferencesRef.current = value; setPreferences(value); }
  useEffect(() => {
    const resizePanel = event => changePreferences(previous => ({ ...previous, panelWidth: event.detail }));
    window.addEventListener(PANEL_WIDTH_EVENT, resizePanel);
    return () => window.removeEventListener(PANEL_WIDTH_EVENT, resizePanel);
  }, []);
  function loadPreferences() { const persisted=normalizePreferences(settings.current.preferences || preferencesRef.current); savedPreferences.current=JSON.stringify(persisted); writePaintCache(savedPreferences.current); changePreferences(persisted); }
  async function flushPreferences(ready) { clearTimeout(preferencesTimer.current); if(!ready)return; const current=preferencesRef.current, encoded=JSON.stringify(current); if(savedPreferences.current!==encoded) {await window.desktop.configure({preferences:current});savedPreferences.current=encoded;writePaintCache(encoded);} }
  useEffect(() => {
    if(!preferencesReady) return;
    const encoded=JSON.stringify(preferences);
    if(!window.desktop){ try { localStorage.setItem('mdlvis-preferences',encoded); } catch(error) { say('Settings could not be stored in this browser: '+error.message,true); } return; }
    if(savedPreferences.current===encoded)return;
    const timer=preferencesTimer.current=setTimeout(() => { window.desktop.configure({preferences}).then(result => {settings.current=result; savedPreferences.current=encoded; writePaintCache(encoded);}).catch(error=>say('Settings could not be saved: '+error.message,true)); },200);
    return () => clearTimeout(timer);
  },[preferences,preferencesReady]);
  return { preferences, preferencesReady, openHotkeySettings, settingsTab, setSettingsTab, setPreferencesReady, preferencesRef, changePreferences, loadPreferences, flushPreferences };
}
