import { buildPoseWeight, preparePoseWeight } from '../src/pose-weight.js';

let context, analysis, selectionKey;
self.onmessage = ({ data }) => {
  if (data.context) { context = data.context; analysis = null; selectionKey = null; return; }
  try {
    const key = JSON.stringify(data.selection);
    if (!analysis || key !== selectionKey) {
      const { model, config, target, sequence, range } = context;
      analysis = preparePoseWeight(model, config, target, sequence, range, data.selection);
      selectionKey = key;
    }
    self.postMessage({ request: data.request, result: buildPoseWeight(analysis, data.mode, data.amount, data.restrictions, data.settings) });
  } catch (error) { self.postMessage({ request: data.request, error: error.message }); }
};
