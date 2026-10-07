import { useEffect, useState } from 'react';
export default function useUpdates() {
  const [status, setStatus] = useState({ state: 'idle' }), [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.desktop?.updateStatus) return;
    let mounted = true, received = false;
    const update = value => { if (!mounted || !value) return; received = true; setStatus(value); if (value.state === 'available' && !value.error) setOpen(true); };
    const unsubscribe = window.desktop.onUpdateStatus(update);
    window.desktop.updateStatus().then(value => { if (!received) update(value); }).catch(error => { if (mounted) setStatus({ state: 'error', error: error.message }); });
    return () => { mounted = false; unsubscribe?.(); };
  }, []);
  const check = async () => { try { const value = await window.desktop.checkUpdates(); setStatus(value); if (value.state === 'available') setOpen(true); } catch (error) { setStatus(previous => ({ ...previous, state: 'error', error: error.message })); } };
  const install = async () => { try { setStatus(await window.desktop.installUpdate()); } catch (error) { setStatus(previous => ({ ...previous, error: error.message })); } };
  const revert = async () => { try { setStatus(await window.desktop.revertUpdate()); } catch (error) { setStatus(previous => ({ ...previous, error: error.message })); } };
  return { status, open, check, install, revert, close: () => setOpen(false) };
}
