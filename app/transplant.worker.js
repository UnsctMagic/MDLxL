import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { suggestToggles } from '../src/xfer-suggest-toggles.js';

// Transplant (Transfer window) builds off the main thread: the engine and the per-animation extents.
// The open model and the donor arrive once each ({ hold }); each request carries only the options.
const held = { model: null, donor: null };
self.onmessage = ({ data }) => {
  if (data.hold) { held[data.hold] = data.value; return; }
  const { id, options, suggest, automaticMirror } = data;
  let plain;
  try {
    plain = transplantSkeleton(held.model, held.donor, options);
    self.postMessage({ id, model: plain.model, report: plain.report });
  } catch (error) {
    self.postMessage({ id, error: error.message });
    return;
  }
  if (!suggest) return;
  try {
    const suggestion = suggestToggles(held.model, held.donor, options, { plain, automaticMirror });
    self.postMessage({ id, suggestion });
  } catch (error) {
    self.postMessage({ id, suggestionError: error.message });
  }
};
