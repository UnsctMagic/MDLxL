import { Buffer } from 'buffer';
import { parseMdl } from './mdl-lossless.js';
import { parseMdx } from './mdx-container.js';

// This namespace identifies our comments, not an MDL grammar extension.
export const GEOSET_TABS_TAG = 'MDLXL_GEOSET_TABS_V1:8f75130f-6e97-4b72-97d5-bf1d348e91ab';
export const GEOSET_TABS_CHUNK = 'XLGT';
export const GEOSET_TABS_KEY = '_GeosetTabs';
export const GEOSET_TAB_KEY = '_GeosetTabId';
const prefix = `// ${GEOSET_TABS_TAG} `;
function validData(data, model) {
  return Array.isArray(data?.tabs) && data.geosets && typeof data.geosets === 'object' && !Array.isArray(data.geosets) &&
    data.tabs.every(tab => typeof tab?.id === 'string' && tab.id && !['all', 'ungrouped'].includes(tab.id) && typeof tab.name === 'string' && typeof tab.visible === 'boolean') &&
    new Set(data.tabs.map(tab => tab.id)).size === data.tabs.length &&
    Object.entries(data.geosets).every(([index, id]) => /^\d+$/.test(index) && Number.isSafeInteger(Number(index)) && (!model || model.Geosets[index]) && data.tabs.some(tab => tab.id === id));
}
function validRecord(record) {
  try { return validData(JSON.parse(record.text.slice(prefix.length))); }
  catch { return false; } // readGeosetTabs reports malformed source annotations.
}

export function geosetTabsData(model) {
  const tabs = model[GEOSET_TABS_KEY] || [], ids = new Set(tabs.map(tab => tab.id));
  const geosets = {};
  model.Geosets.forEach((geoset, index) => {
    if (ids.has(geoset[GEOSET_TAB_KEY])) geosets[index] = geoset[GEOSET_TAB_KEY];
  });
  return { tabs, geosets };
}

export function normalizeGeosetTabs(model) {
  const ids = new Set((model[GEOSET_TABS_KEY] || []).map(tab => tab.id));
  for (const geoset of model.Geosets) if (!ids.has(geoset[GEOSET_TAB_KEY])) delete geoset[GEOSET_TAB_KEY];
}

export function createGeosetTab(model, name, indices = [], id = crypto.randomUUID()) {
  name = name.trim();
  if (!name) throw new Error('Enter a tab name.');
  const tabs = model[GEOSET_TABS_KEY] ||= [];
  if (tabs.some(tab => tab.id === id)) throw new Error('Geoset tab ID already exists.');
  tabs.push({ id, name, visible: true });
  assignGeosetTab(model, indices, id);
  return id;
}

export function assignGeosetTab(model, indices, id) {
  if (id && !(model[GEOSET_TABS_KEY] || []).some(tab => tab.id === id)) throw new Error('Geoset tab does not exist.');
  for (const index of indices) {
    const geoset = model.Geosets[index];
    if (!geoset) throw new Error('Geoset does not exist.');
    if (id) geoset[GEOSET_TAB_KEY] = id;
    else delete geoset[GEOSET_TAB_KEY];
  }
}

export function deleteGeosetTab(model, id) {
  model[GEOSET_TABS_KEY] = (model[GEOSET_TABS_KEY] || []).filter(tab => tab.id !== id);
  normalizeGeosetTabs(model);
  if (!model[GEOSET_TABS_KEY].length) delete model[GEOSET_TABS_KEY];
}

// The active tab filters the work area; eye toggles apply independently of
// the existing Show all geosets checkbox. Native GEOA/visibility is untouched.
export function geosetsInTab(model, active = 'all', { visible = false } = {}) {
  const tabs = new Map((model[GEOSET_TABS_KEY] || []).map(tab => [tab.id, tab]));
  return new Set(model.Geosets.flatMap((geoset, index) => {
    const id = tabs.has(geoset[GEOSET_TAB_KEY]) ? geoset[GEOSET_TAB_KEY] : 'ungrouped';
    return (active === 'all' || active === id) && (!visible || tabs.get(id)?.visible !== false) ? [index] : [];
  }));
}

export function isGeosetTabsChunk(bytes, chunk) {
  return chunk.tag === GEOSET_TABS_CHUNK && Buffer.from(bytes).subarray(chunk.payloadOffset, chunk.payloadOffset + prefix.length).toString('utf8') === prefix;
}

export function geosetTabsRecords(bytes, format, container) {
  if (format === 'mdl') return (container || parseMdl(bytes)).tokens
    .filter(token => token.kind === 'line-comment' && token.raw.toString('utf8').startsWith(prefix))
    .map(token => ({ start: token.start, end: token.end + (bytes[token.end] === 13 ? (bytes[token.end + 1] === 10 ? 2 : 1) : bytes[token.end] === 10 ? 1 : 0), text: token.raw.toString('utf8') }));
  return (container || parseMdx(bytes)).chunks.filter(chunk => isGeosetTabsChunk(bytes, chunk))
    .map(chunk => ({ start: chunk.offset, end: chunk.payloadOffset + chunk.declaredSize, text: bytes.subarray(chunk.payloadOffset, chunk.payloadOffset + chunk.declaredSize).toString('utf8') }));
}

export function readGeosetTabs(input, format, model, container) {
  const bytes = Buffer.from(input), records = geosetTabsRecords(bytes, format, container);
  const diagnostics = [];
  for (const record of records) {
    let data;
    try { data = JSON.parse(record.text.slice(prefix.length)); }
    catch { diagnostics.push({ severity: 'warning', code: 'GEOSET_TABS_METADATA', message: 'The MDLxL geoset tab comment contains invalid JSON; its source bytes are retained.' }); continue; }
    if (!validData(data, model)) {
      diagnostics.push({ severity: 'warning', code: 'GEOSET_TABS_METADATA', message: 'The MDLxL geoset tab comment has invalid tab or geoset references; its source bytes are retained.' });
      continue;
    }
    if (data.tabs.length) model[GEOSET_TABS_KEY] = data.tabs;
    else delete model[GEOSET_TABS_KEY];
    for (const geoset of model.Geosets) delete geoset[GEOSET_TAB_KEY];
    for (const [index, id] of Object.entries(data.geosets)) model.Geosets[index][GEOSET_TAB_KEY] = id;
  }
  return diagnostics;
}

export function writeGeosetTabs(input, format, model) {
  const bytes = Buffer.from(input), parts = [], records = geosetTabsRecords(bytes, format).filter(validRecord);
  let cursor = 0;
  for (const record of records) { parts.push(bytes.subarray(cursor, record.start)); cursor = record.end; }
  parts.push(bytes.subarray(cursor));
  const body = Buffer.concat(parts), data = geosetTabsData(model);
  if (!data.tabs.length) return body;
  const text = Buffer.from(prefix + JSON.stringify(data) + '\n', 'utf8');
  // Put comments before the model, avoiding readers that expect a model
  // section after every comment and mishandle a comment at end of file.
  if (format === 'mdl') {
    const bom = body.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? 3 : 0;
    return Buffer.concat([body.subarray(0, bom), text, body.subarray(bom)]);
  }
  const header = Buffer.alloc(8); header.write(GEOSET_TABS_CHUNK, 'ascii'); header.writeUInt32LE(text.length, 4);
  // Append after every native chunk, so readers with a bounded chunk loop
  // encounter all model records before the optional editor annotation.
  const container = parseMdx(body), end = body.length - container.trailingBytes.length;
  return Buffer.concat([body.subarray(0, end), header, text, body.subarray(end)]);
}
