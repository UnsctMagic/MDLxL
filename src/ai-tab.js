import { SelectionHistory, restoreSelection } from './selection-history.js';
import { captureUVPreviewGuard, validateUVPreviewGuard } from './uv-preview.js';

// Edits for a model tab that is not showing, made by the AI while the user works on
// another tab. They go into that tab's own document and Undo history, and the tab's
// remembered view keeps a valid selection, so switching to it shows the result.
// `tab` is an editor session: { doc, uvPreviews, viewState }.

/** A selection written into a tab's remembered view, as the live editor would set it. */
export function tabSelection(value, model, view) {
  return restoreSelection({
    ...view,
    ...(value.vertices
      ? { selection: value.vertices, selectable: new Set([...view.selectable, ...Object.keys(value.vertices).map(Number)]) }
      : {}),
    ...(value.geosetIds ? { selectable: new Set(value.geosetIds) } : {}),
    ...(value.nodeIds ? { selectedNodeIds: value.nodeIds } : {}),
    ...(value.activeGeoset !== undefined ? { activeGeoset: value.activeGeoset } : {}),
  }, model);
}

/** One Undo step on the tab's document, with the selection before and after it. */
export function editTab(tab, label, sections, operation, { validate, selection } = {}) {
  const view = tab.viewState, history = new SelectionHistory(tab.doc);
  const ticket = history.captureEdit(view), guard = captureUVPreviewGuard(tab.doc.model, tab.uvPreviews);
  const result = tab.doc.apply(label, sections, model => {
    const value = operation(model);
    validateUVPreviewGuard(model, tab.uvPreviews, guard);
    return value;
  }, { validate });
  Object.assign(view, selection ? tabSelection(selection, tab.doc.model, view) : restoreSelection(view, tab.doc.model));
  history.recordEdit(ticket, view);
  return result;
}

/** Undo or Redo on the tab's own history; returns false when there is nothing to do. */
export function undoTab(tab, redo) {
  const view = tab.viewState, guard = captureUVPreviewGuard(tab.doc.model, tab.uvPreviews);
  const history = new SelectionHistory(tab.doc), restored = history.travel(redo ? 'redo' : 'undo', view);
  if (!restored) return false;
  try { validateUVPreviewGuard(tab.doc.model, tab.uvPreviews, guard); }
  catch (error) { history.travel(redo ? 'undo' : 'redo', restored); throw error; }
  Object.assign(view, restored);
  return true;
}

export function selectTab(tab, value) {
  Object.assign(tab.viewState, tabSelection(value, tab.doc.model, tab.viewState));
}
