import { transplantSkeleton } from '../src/skeleton-transplant.js';

// Transplant (Transfer window) builds off the main thread: the engine and the per-animation extents.
// The open model and the donor arrive once each ({ hold }); each request carries only the options.
const held = { model: null, donor: null };
self.onmessage = ({ data }) => {
  if (data.hold) { held[data.hold] = data.value; return; }
  try { const out = transplantSkeleton(held.model, held.donor, data.options); self.postMessage({ id: data.id, model: out.model, report: out.report }); }
  catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
