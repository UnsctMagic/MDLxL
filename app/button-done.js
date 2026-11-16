// A button whose click changed the model lights up briefly in the theme accent (styles.css [data-done]),
// so actions like Bake All Visibility show they ran. Only real edits light it: a click that changes
// nothing, fails or only opens something stays plain. Toggle buttons already show their own state.
const RECENT_MS = 800, SHOWN_MS = 700;

export function installButtonDone(target = window, root = document) {
  let last = null, at = 0;
  const clicked = event => {
    const button = event.target?.closest?.('button');
    if (!button || button.disabled || button.hasAttribute('aria-pressed') || button.hasAttribute('aria-expanded') || button.getAttribute('role') === 'tab') { last = null; return; }
    last = button; at = performance.now();
  };
  const edited = () => {
    const button = last;
    if (!button || performance.now() - at > RECENT_MS || !button.isConnected) return;
    last = null;
    button.removeAttribute('data-done'); void button.offsetWidth; // restart when clicked again
    button.setAttribute('data-done', '');
    clearTimeout(button._doneTimer);
    button._doneTimer = setTimeout(() => button.removeAttribute('data-done'), SHOWN_MS);
  };
  root.addEventListener('click', clicked, true);
  target.addEventListener('mdlxl-model-edited', edited);
  return () => { root.removeEventListener('click', clicked, true); target.removeEventListener('mdlxl-model-edited', edited); };
}
