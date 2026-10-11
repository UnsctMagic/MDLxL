import { buildPoseMotion, preparePoseMotion } from '../src/pose-motion.js';

let context, analysis, lastInput, lastResult;
self.onmessage = ({ data }) => {
  if (data.context) { context = data.context; analysis = null; lastInput = null; lastResult = null; return; }
  try {
    analysis ||= preparePoseMotion(context.model, context.config, context.sequence, context.range);
    const input = JSON.stringify([data.settings, data.restrictions]);
    if (input !== lastInput) { lastResult = buildPoseMotion(analysis, data.settings, data.restrictions); lastInput = input; }
    self.postMessage({ variant: data.variant, request: data.request, result: lastResult });
  } catch (error) { self.postMessage({ variant: data.variant, request: data.request, error: error.message }); }
};
