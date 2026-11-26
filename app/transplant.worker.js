import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { transplantRepairOptions } from '../src/transfer-window.js';
import { suggestToggles } from '../src/xfer-suggest-toggles.js';

// Transplant (Transfer window) builds off the main thread: the engine and the per-animation extents.
// The open model and the donor arrive once each ({ hold }); each request carries only the options.
const held = { model: null, donor: null };
self.onmessage = ({ data }) => {
  if (data.hold) { held[data.hold] = data.value; return; }
  const { id, options, suggest, automaticMirror } = data;
  let plain;
  try {
    const resolved = transplantRepairOptions(held.model, held.donor, options, automaticMirror);
    plain = transplantSkeleton(held.model, held.donor, resolved);
    plain.report.mirrored = resolved.mirror ?? plain.report.mirrorOffer;
    self.postMessage({ id, model: plain.model, report: plain.report });
  } catch (error) {
    self.postMessage({ id, error: error.message });
    return;
  }
  if (!suggest) return;
  try {
    // The repairs are engine 1's: with engine 2 on, they are suggested from the engine 1 build.
    const { engine, regions, ...engine1 } = options;
    const suggestion = engine === 2 ? suggestToggles(held.model, held.donor, engine1, { automaticMirror }) : suggestToggles(held.model, held.donor, options, { plain, automaticMirror });
    self.postMessage({ id, suggestion });
  } catch (error) {
    self.postMessage({ id, suggestionError: error.message });
  }
};
