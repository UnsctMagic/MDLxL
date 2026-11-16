import React, { useEffect, useState } from 'react';
import Dialog from './Dialog.jsx';

const LIMIT = 2000, NAME_LIMIT = 40;
const RESULTS = {
  sent: 'Sent.',
  'limit-pc': 'Daily limit reached. Try again tomorrow.',
  'limit-ip': 'Daily limit reached. Try again tomorrow.',
  'limit-day': 'Reports are full for today. Try again tomorrow.',
  paused: 'Reports are paused.',
};

/** Sends a short problem report through the main process; the text stays until it is sent. */
export default function ReportDialog({ onClose, onHotkeys, }) {
  const [text, setText] = useState(''), [name, setName] = useState(''), [sending, setSending] = useState(false), [paused, setPaused] = useState(false), [result, setResult] = useState('');
  useEffect(() => {
    let live = true;
    window.desktop?.reportStatus?.().then(status => { if (live && status === 'paused') setPaused(true); }, () => {});
    return () => { live = false; };
  }, []);
  const send = async () => {
    setSending(true);
    let outcome = 'error';
    try { outcome = await window.desktop.sendReport(text, name); } catch { /* shown as a connection error */ }
    setSending(false);
    if (outcome === 'paused') setPaused(true);
    if (outcome === 'sent') setText('');
    setResult(RESULTS[outcome] || 'Could not send. Check your internet connection.');
  };
  const message = paused ? 'Reports are paused.' : result;
  return <Dialog onHotkeys={onHotkeys} title="Report a problem" onClose={onClose} footer={<>
    <button data-hotkey="app:action:1" disabled={sending || paused || !text.trim() || !window.desktop?.sendReport} onClick={send}>Send</button>
    <button data-hotkey="app:action:2" onClick={onClose}>Cancel</button>
  </>}>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span>Name (optional)</span><input data-hotkey="app:field:2" type="text" maxLength={NAME_LIMIT} style={{ flex: 1 }} value={name} onChange={event => { setName(event.target.value); setResult(''); }}/></label>
    <textarea data-hotkey="app:field:1" aria-label="Report a problem" autoFocus rows={7} maxLength={LIMIT} style={{ width: '100%', boxSizing: 'border-box' }} value={text} onChange={event => { setText(event.target.value); setResult(''); }}/>
    <p>{text.length} / {LIMIT}</p>
    <p>Sends your name, text, MDLxL version and Windows version.</p>
    {message && <p role="status">{message}</p>}
  </Dialog>;
}
