import React, { useEffect } from 'react';
import UpdateShredder from './UpdateShredder.jsx';

export const WEBSITE = 'https://www.lowpolyworks.com/mdlxl';
export function OfficialWebsite() {
  return <small className="official-website"><ExternalLink href={WEBSITE}>www.lowpolyworks.com</ExternalLink></small>;
}
function ExternalLink({ href, children, ...props }) {
  return <a href={href} target="_blank" rel="noreferrer" {...props} onClick={event => { if (window.desktop?.openLink) { event.preventDefault(); void window.desktop.openLink(href).catch(error => console.error(error)); } }}>{children}</a>;
}
export const updateStatusText = status => ({ idle: '', checking: 'Searching for updates…', current: 'You have the latest version.', available: `MDLxL ${status?.release?.version || ''} is available.`, downloading: 'Downloading update…', reverting: 'Preparing previous version…', ready: 'Update ready. Close MDLxL to install and restart.', error: status?.error })[status?.state] || '';

export default function UpdatePrompt({ status, Dialog, onInstall, onClose }) {
  const release = status?.release, busy = ['downloading', 'ready'].includes(status?.state);
  useEffect(()=>{const previous=document.activeElement;document.querySelector('[data-warmkey="update:later"]')?.focus();return ()=>{if(previous?.isConnected)previous.focus();};},[]);
  const trapFocus = event => {
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!busy)onClose();}
    if(event.key!=='Tab')return;
    const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled), a[href]')].filter(node=>node.getClientRects().length),first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  if (!release) return null;
  return <Dialog overlayClass="update-overlay" onKeyDown={trapFocus} title="MDLxL update" onClose={busy ? () => {} : onClose} footer={<><button data-warmkey="update:install" disabled={busy || !status.canInstall} onClick={onInstall}>Update and restart</button><button data-warmkey="update:later" disabled={busy} onClick={onClose}>Later</button></>}>
    <UpdateShredder status={status}/>
    <p><strong>{`MDLxL ${release.version} is available.`}</strong></p>
    <p>{`Installed version: ${status.currentVersion}`}</p>
    <ul className="update-summary" translate="no">{release.summary.map((line, index) => <li translate="no" key={index}>{line}</li>)}</ul>
    {!release.summary.length && <p>The full update log lists the changes in this release.</p>}
    <p>Read patch notes in: <ExternalLink href={release.notes.en || release.url} translate="no">English</ExternalLink>{' · '}<ExternalLink href={release.notes.ru || release.url} translate="no">Русский</ExternalLink>{' · '}<ExternalLink href={release.notes.es || release.url} translate="no">Español</ExternalLink>{' · '}<ExternalLink href={release.notes.zh || release.url} translate="no">简体中文</ExternalLink></p>
    <p>Your settings, personal libraries, and saved files are kept. MDLxL will ask about unsaved work before restarting.</p>
    {busy && <div role="status"><p>{updateStatusText(status)}</p><progress aria-label="Update download progress" max={Math.max(1, status.total || 1)} value={status.received || 0}/></div>}
    {status.error && <p role="alert">{status.error}</p>}
    {!status.canInstall && <p>Updates can be installed in the portable Windows app.</p>}
    <OfficialWebsite/>
  </Dialog>;
}
