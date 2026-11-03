import { measureNativeCandidate } from './ai-native-measure.js';

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ result: await measureNativeCandidate(data) });
  } catch (error) {
    self.postMessage({ error: error.message || String(error) });
  }
};
