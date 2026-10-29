// Read-only test hook (docs/PACKAGED-TESTS.md#test-hook). window.__mdlxl exists only when the desktop app was
// started with MDLXL_TEST_HOOK=1, as test/helpers/app.cjs does; normal use and the browser build never get it.
let readApp = null;
const previews = new WeakMap();
if (typeof window !== 'undefined' && window.desktop?.testHook) window.__mdlxl = Object.freeze({
  session: () => readApp?.().session ?? null,
  document: () => readApp?.().doc ?? null,
  model: () => readApp?.().doc?.model ?? null,
  selection: () => { const app = readApp?.(); return app ? { selection: app.selection, selectedNodeIds: app.selectedNodeIds, activeGeoset: app.activeGeoset } : null; },
  // The preview drawn into element (default: the first one, the main editor preview): { runtime, props }.
  preview: (element = document.querySelector('.game-preview-root')) => previews.get(element)?.() ?? null,
});
export const exposeAppForTests = read => { readApp = read; };
export const exposePreviewForTests = (element, read) => { if (element) previews.set(element, read); };
