import { compareMotion } from '../src/ai-motion-compare.js';

self.onmessage = ({ data }) => {
  try { self.postMessage({ result: compareMotion(data.before, data.after, data.options) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
