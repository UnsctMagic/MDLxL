import { Buffer } from 'buffer';
import { ANIMATION_SPEED_SECTIONS, animationSpeedRecords, forgetAnimationSpeed } from './animation-speed.js';
import { GEOSET_TABS_KEY, GEOSET_TAB_KEY, geosetTabsRecords } from './geoset-tabs.js';

export const EDITOR_DATA_SECTIONS = [...ANIMATION_SPEED_SECTIONS, 'Geosets', GEOSET_TABS_KEY];

/** Remove only MDLxL's identified annotations. Native records, other programs'
 * unknown chunks, and ordinary author comments remain byte-for-byte intact. */
export function removeEditorData(input, format) {
  const bytes = Buffer.from(input), parts = [];
  const records = [...animationSpeedRecords(bytes, format), ...geosetTabsRecords(bytes, format)].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const record of records) { parts.push(bytes.subarray(cursor, record.start)); cursor = record.end; }
  parts.push(bytes.subarray(cursor));
  const output = new Uint8Array(Buffer.concat(parts));
  return { bytes: output, removedBytes: bytes.length - output.length };
}

export function clearEditorData(model) {
  forgetAnimationSpeed(model);
  delete model[GEOSET_TABS_KEY];
  for (const geoset of model.Geosets || []) delete geoset[GEOSET_TAB_KEY];
}
