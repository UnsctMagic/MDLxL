const { gamePathKey } = require('./game-path.cjs');
const reviewedNames = require('../src/particle-reviewed-names.json');
// Observed names belong to an emitter of one source model, not to a library id.
// A wc3- id hashes the extracted recipe, so it changes whenever extraction or a
// dependency changes, even when the model is untouched. The key is the model's
// physical path plus the emitter name ('*' for the whole-model group); the
// content hash still binds the name to the exact bytes that were observed.
const reviewKey = source => source?.physicalPath ? gamePathKey(source.physicalPath) + '|' + (source.emitterIds?.length > 1 ? '*' : source.emitterName ?? '') : null;
const reviewFor = item => {
  for (const source of item?.sources || []) {
    const review = reviewedNames[reviewKey(source)];
    if (review && review.naming.sourceContentHash === source.contentHash) return review;
  }
  return null;
};
module.exports = { reviewKey, reviewFor };
