import fs from 'node:fs';
const file = new URL('../../docs/SD-RESEARCH/data/base-namespace-art-exceptions.json', import.meta.url);
export const scopeReview = JSON.parse(fs.readFileSync(file));
export const excludedBaseNamespaceIds = new Set(scopeReview.models.filter(m => m.activeSdStudy === false).map(m => m.id));
export const isActiveSd = model => (model.tier || 'sd') === 'sd' && !excludedBaseNamespaceIds.has(model.id);
