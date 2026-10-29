import React, { useEffect, useState } from 'react';
import { checkSanity, sanityLocation } from '../src/sanity-check.js';
import { hiveSanity } from './optimizexl-hive.js';
import Dialog from './Dialog.jsx';

export default function SanityCheck({ model, revision, doc, onClose }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let active = true;
    setState(null);
    // Yield so the popup paints before starting the read-only scan.
    const timer = setTimeout(() => {
      checkSanity(model, hiveSanity, doc.diagnostics).then(report => { if (active) setState({ report }); })
        .catch(error => { if (active) setState({ error: error.message }); });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [model, revision, doc]);
  const report = state?.report;
  return <Dialog title="Sanity Check" onClose={onClose} footer={<><small style={{ marginRight: 'auto', textAlign: 'left', lineHeight: 1.3 }}>mdx-m3-viewer 5.12.0<br/>by GhostWolf and contributors</small><button data-hotkey="app:action:1" onClick={onClose}>Close</button></>}>
    <div style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>
      <p><strong>{model.Info?.Name || 'Untitled'}</strong> · Format {model.Version}</p>
      <p role="status" aria-live="polite"><strong>{state?.error ? 'Check could not complete' : report?.status || 'Checking current model…'}</strong></p>
      {state?.error && <p role="alert">{state.error}</p>}
      {report && <>
        <p>{report.errors} structural errors · {report.warnings} structural warnings</p>
        {report.limitation && <p>{report.limitation}</p>}
        {report.structural.length > 0 && <details open><summary>Structural findings ({report.structural.length})</summary>
          <ul style={{ maxHeight: 220, overflowY: 'auto' }}>{report.structural.map((f, i) => <li key={i}><strong>{f.severity}: {sanityLocation(f.path)}</strong><br/>{sanityLocation(f.message)} <small>({f.code})</small></li>)}</ul>
        </details>}
        {report.hive && <details open={report.hive.errors + report.hive.severe > 0}>
          <summary>Advisory findings ({report.hive.findings.length})</summary>
          <p>{report.hive.errors} errors · {report.hive.severe} severe · {report.hive.warnings} warnings · {report.hive.unused} unused notices</p>
          <p>Findings use zero-based indices. Naming, unused data and older compatibility heuristics require review; they are not proof of a game failure.</p>
          <ul style={{ maxHeight: 220, overflowY: 'auto' }}>{report.hive.findings.map((f, i) => <li key={i}><strong>{f.type}: {f.path}</strong><br/>{f.message}</li>)}</ul>
        </details>}
      </>}
      <p><small>Checks the current model, including unsaved edits. No model data is changed. Texture file availability and in-game behavior are not tested.</small></p>
    </div>
  </Dialog>;
}


