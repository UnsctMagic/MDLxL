import { buildAnimXL } from '../src/anim-xl.js';

// AnimXL builds off the main thread. The model arrives once per document
// revision; each request carries only the animation and slider settings.
let model = null;
self.onmessage = ({ data }) => {
  if (data.model) { model = data.model; return; }
  try { self.postMessage({ id: data.id, result: buildAnimXL(model, data.sequence, data.settings) }); }
  catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
