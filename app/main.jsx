import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { normalizePreferences } from '../src/preferences.js';
import { loadLanguage } from '../src/localization.js';
import './styles.css';
class EditorBoundary extends React.Component{
  state={error:null};
  static getDerivedStateFromError(error){return {error};}
  render(){if(this.state.error)return <div className="classic-modal"><div className="classic-modal-window"><header>MDLxL</header><div className="classic-modal-body"><p>The interface could not finish drawing.</p><p>{String(this.state.error.message||this.state.error)}</p><p>The last disk recovery copy can be restored after reloading.</p></div><footer><button onClick={()=>location.reload()}>Reload editor</button></footer></div></div>;return this.props.children;}
}
const startup = (async () => {
  let stored;
  if (window.desktop) stored = (await window.desktop.getSettings()).preferences;
  else try { stored = JSON.parse(localStorage.getItem('mdlvis-preferences') || '{}'); } catch { stored = {}; }
  const preferences = normalizePreferences(stored);
  await loadLanguage(preferences.language);
  return preferences;
})();
function Startup() { return <App initialPreferences={React.use(startup)}/>; }
createRoot(document.getElementById('root')).render(<EditorBoundary><React.Suspense fallback={null}><Startup/></React.Suspense></EditorBoundary>);
