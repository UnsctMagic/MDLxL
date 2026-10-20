import { useEffect, useRef, useState } from 'react';
export default function useUpdates() {
  const [status, setStatus] = useState({ state: 'idle' }), [open, setOpen] = useState(false);
  // A status broadcast that arrives while a request is pending is newer than that
  // request's reply (e.g. a cancelled close prompt returns the update to
  // 'available' before the install reply lands), so the reply must not overwrite it.
  const broadcasts = useRef(0);
  const reply = async request => { const seen = broadcasts.current, value = await request(); if (broadcasts.current === seen) setStatus(value); return value; };
  useEffect(() => {
    if (!window.desktop?.updateStatus) return;
    let mounted = true, received = false;
    const update = value => { if (!mounted || !value) return; received = true; broadcasts.current++; setStatus(value); if (value.state === 'available' && !value.error) setOpen(true); };
    const unsubscribe = window.desktop.onUpdateStatus(update);
    window.desktop.updateStatus().then(value => { if (!received) update(value); }).catch(error => { if (mounted) setStatus({ state: 'error', error: error.message }); });
    return () => { mounted = false; unsubscribe?.(); };
  }, []);
  const check = async () => { try { const value = await reply(() => window.desktop.checkUpdates()); if (value.state === 'available') setOpen(true); } catch (error) { setStatus(previous => ({ ...previous, state: 'error', error: error.message })); } };
  const install = async () => { try { await reply(() => window.desktop.installUpdate()); } catch (error) { setStatus(previous => ({ ...previous, error: error.message })); } };
  const revert = async () => { try { await reply(() => window.desktop.revertUpdate()); } catch (error) { setStatus(previous => ({ ...previous, error: error.message })); } };
  return { status, open, check, install, revert, close: () => setOpen(false) };
}
