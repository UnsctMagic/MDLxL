import { Buffer } from 'buffer';
import { parseMdl } from './mdl-lossless.js';
import { parseMdx } from './mdx-container.js';

export const ANIMATION_SPEED_KEY = '_AnimationSpeed';
export const ANIMATION_SPEED_FRAME = '_AnimationSpeedFrame';
export const ANIMATION_SPEED_EVENTS = '_AnimationSpeedEvents';
export const ANIMATION_SPEED_TAG = 'MDLXL_ANIMATION_SPEED_V1:6324b9ab-c97d-4884-bffa-a623adc41438';
export const ANIMATION_SPEED_CHUNK = 'XLAS';
export const ANIMATION_SPEED_SECTIONS = ['Sequences', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras', ANIMATION_SPEED_KEY];
const privateKeys = new Set([ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS]);
const prefix = `// ${ANIMATION_SPEED_TAG} `;
const MAX_FRAME = 0x7fffffff;
const MIN_FRAME = -0x80000000;
const percentValid = value => Number.isInteger(value) && value >= 1 && value <= 300;
const intervalValid = value => Array.isArray(value) && value.length === 2 && value.every(frame => Number.isInteger(frame) && frame >= 0 && frame <= MAX_FRAME) && value[1] >= value[0];
const global = value => Number.isInteger(value.GlobalSeqId) && value.GlobalSeqId >= 0;

export function animationSpeed(sequence) { return sequence?.[ANIMATION_SPEED_KEY]?.percent ?? 100; }
export function animationSpeedChecked(sequence) { return sequence?.[ANIMATION_SPEED_KEY]?.checked !== false; }
export function animationMasterSpeed(model) { return model[ANIMATION_SPEED_KEY]?.master ?? 100; }

// Visit native records once, avoiding the Nodes aliases and editor annotations.
function timingRecords(model) {
  const tracks = [], events = [], seen = new Set();
  function visit(value, path) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value.Keys)) { if (!global(value)) tracks.push({ value, path }); return; }
    if (value.EventTrack && !global(value)) events.push({ value, path });
    for (const [key, child] of Object.entries(value)) {
      if (privateKeys.has(key) || key === 'Nodes' || key === 'EventTrack') continue;
      visit(child, [...path, Array.isArray(value) ? Number(key) : key]);
    }
  }
  visit(model, []);
  return { tracks, events };
}

function mapFrame(frame, ranges, inverse = false) {
  let shift = 0;
  for (const range of ranges) {
    const from = inverse ? range.current : range.original, to = inverse ? range.original : range.current;
    if (frame < from[0]) break;
    if (frame <= from[1]) return to[0] + (from[1] === from[0] ? 0 : (frame - from[0]) / (from[1] - from[0]) * (to[1] - to[0]));
    shift = to[1] - from[1];
  }
  return frame + shift;
}

function rangesFor(model) {
  const sequences = (model.Sequences || []).map((sequence, index) => ({ sequence, index })).sort((a, b) => a.sequence.Interval[0] - b.sequence.Interval[0]);
  let shift = 0;
  return sequences.map(({ sequence, index }) => {
    const current = Array.from(sequence.Interval);
    const original = sequence[ANIMATION_SPEED_KEY]?.originalInterval || [current[0] - shift, current[1] - shift];
    shift = current[1] - original[1];
    return { sequence, index, original, current };
  });
}

function ensureBaseline(model) {
  const ranges = rangesFor(model);
  for (const { sequence, original } of ranges) sequence[ANIMATION_SPEED_KEY] ||= { originalInterval: original, percent: 100, checked: true };
  model[ANIMATION_SPEED_KEY] ||= { master: 100 };
  return ranges;
}

function originalFrames(frames, stored, ranges) {
  const unused = [...(stored || [])], byFrame = new Map();
  unused.forEach((item, i) => {
    if (!item) return;
    if (!byFrame.has(item.frame)) byFrame.set(item.frame, { indices: [], cursor: 0 });
    byFrame.get(item.frame).indices.push(i);
  });
  return frames.map((frame, i) => {
    const candidates = byFrame.get(frame);
    while (candidates && candidates.cursor < candidates.indices.length && !unused[candidates.indices[candidates.cursor]]) candidates.cursor++;
    const match = unused[i]?.frame === frame ? i : candidates?.indices[candidates.cursor] ?? -1;
    const previous = match < 0 ? null : unused[match];
    if (match >= 0) unused[match] = null;
    return previous ? previous.originalFrame : mapFrame(frame, ranges, true);
  });
}

export function setAnimationSpeedChecked(model, index, checked) {
  if (!model.Sequences?.[index]) throw new Error('Select an animation before adjusting speed.');
  ensureBaseline(model);
  model.Sequences[index][ANIMATION_SPEED_KEY].checked = !!checked;
}

/** Change real native intervals, every local channel, and local event frames.
 * Original integer frames are retained separately so repeated adjustments and
 * save/reopen cycles cannot accumulate rounding errors. Key values and spline
 * controls are never changed, including when restoring the original timing. */
export function setAnimationActualSpeed(model, index, percent) {
  if (!percentValid(percent)) throw new Error('Animation speed must be a whole percent from 1 to 300.');
  if (index !== null && !model.Sequences?.[index]) throw new Error('Select an animation before adjusting speed.');
  const ranges = rangesFor(model), records = timingRecords(model);
  const next = ranges.map(range => ({ ...range, current: [...range.current] }));
  let shift = 0;
  for (let i = 0; i < next.length; i++) {
    const range = next[i], original = range.original;
    if (i && original[0] < next[i - 1].original[1]) throw new Error('Overlapping animation intervals must be separated before changing their speed.');
    const affected = index === null ? animationSpeedChecked(range.sequence) : range.index === index;
    const speed = affected ? percent : animationSpeed(range.sequence);
    const duration = original[1] - original[0];
    const length = affected ? duration ? Math.max(1, Math.round(duration * 100 / speed)) : 0 : range.current[1] - range.current[0];
    range.current = [original[0] + shift, original[0] + shift + length];
    if (!intervalValid(range.current)) throw new Error('There is not enough frame space for this animation speed.');
    shift += length - duration;
  }
  const edits = [];
  const retime = (frames, baselines) => originalFrames(frames, baselines, ranges).map(originalFrame => {
    const target = Math.round(mapFrame(originalFrame, next));
    if (target < MIN_FRAME || target > MAX_FRAME) throw new Error('There is not enough frame space for this animation speed.');
    return { originalFrame, frame: target };
  });
  for (const { value } of records.tracks) {
    const frames = value.Keys.map(key => key.Frame);
    const mapped = retime(frames, value.Keys.map(key => key[ANIMATION_SPEED_FRAME]));
    for (let i = 1; i < mapped.length; i++) if (frames[i] > frames[i - 1] && mapped[i].frame <= mapped[i - 1].frame) throw new Error('This animation speed would merge distinct keyframes. Choose a slower speed.');
    edits.push(() => value.Keys.forEach((key, i) => { key.Frame = mapped[i].frame; key[ANIMATION_SPEED_FRAME] = mapped[i]; }));
  }
  for (const { value } of records.events) {
    const mapped = retime(Array.from(value.EventTrack), value[ANIMATION_SPEED_EVENTS]);
    edits.push(() => {
      const frames = mapped.map(record => record.frame);
      value.EventTrack = ArrayBuffer.isView(value.EventTrack) ? new value.EventTrack.constructor(frames) : frames;
      value[ANIMATION_SPEED_EVENTS] = mapped;
    });
  }
  // Commit only after every interval/channel has been checked.
  ensureBaseline(model);
  for (const range of next) {
    const sequence = range.sequence;
    const affected = index === null ? animationSpeedChecked(sequence) : range.index === index;
    if (affected) sequence[ANIMATION_SPEED_KEY].percent = percent;
    sequence.Interval = ArrayBuffer.isView(sequence.Interval) ? new sequence.Interval.constructor(range.current) : range.current;
  }
  if (index === null) model[ANIMATION_SPEED_KEY].master = percent;
  for (const edit of edits) edit();
}

export function animationSpeedData(model) {
  if (!model[ANIMATION_SPEED_KEY] && !(model.Sequences || []).some(sequence => sequence[ANIMATION_SPEED_KEY])) return null;
  const { tracks, events } = timingRecords(model), ranges = rangesFor(model);
  const framesData = (frames, stored) => originalFrames(frames, stored, ranges).map((originalFrame, i) => ({ originalFrame, frame: frames[i] }));
  return {
    master: animationMasterSpeed(model),
    sequences: (model.Sequences || []).map(sequence => sequence[ANIMATION_SPEED_KEY] || null),
    tracks: tracks.map(({ path, value }) => ({ path, frames: framesData(value.Keys.map(key => key.Frame), value.Keys.map(key => key[ANIMATION_SPEED_FRAME])) })),
    events: events.map(({ path, value }) => ({ path, frames: framesData(Array.from(value.EventTrack), value[ANIMATION_SPEED_EVENTS]) })),
  };
}

function validData(data) {
  const frameValid = item => item === null || item && Number.isFinite(item.originalFrame) && item.originalFrame >= MIN_FRAME && item.originalFrame <= MAX_FRAME && Number.isInteger(item.frame) && item.frame >= MIN_FRAME && item.frame <= MAX_FRAME;
  const recordsValid = records => Array.isArray(records) && records.every(record => Array.isArray(record?.path) && record.path.length && record.path.every(key => typeof key === 'string' && !['__proto__', 'constructor', 'prototype'].includes(key) || Number.isInteger(key) && key >= 0) && Array.isArray(record.frames) && record.frames.every(frameValid));
  return data && percentValid(data.master) && Array.isArray(data.sequences) && data.sequences.every(sequence => sequence === null || sequence && percentValid(sequence.percent) && typeof sequence.checked === 'boolean' && intervalValid(sequence.originalInterval)) && recordsValid(data.tracks) && recordsValid(data.events);
}

export function isAnimationSpeedChunk(bytes, chunk) {
  return chunk.tag === ANIMATION_SPEED_CHUNK && Buffer.from(bytes).subarray(chunk.payloadOffset, chunk.payloadOffset + prefix.length).toString('utf8') === prefix;
}

function commentRecords(bytes, format, container) {
  if (format === 'mdl') return (container || parseMdl(bytes)).tokens.filter(token => token.kind === 'line-comment' && token.raw.toString('utf8').startsWith(prefix)).map(token => ({ start: token.start, end: token.end + (bytes[token.end] === 13 ? (bytes[token.end + 1] === 10 ? 2 : 1) : bytes[token.end] === 10 ? 1 : 0), text: token.raw.toString('utf8') }));
  return (container || parseMdx(bytes)).chunks.filter(chunk => isAnimationSpeedChunk(bytes, chunk)).map(chunk => ({ start: chunk.offset, end: chunk.payloadOffset + chunk.declaredSize, text: bytes.subarray(chunk.payloadOffset, chunk.payloadOffset + chunk.declaredSize).toString('utf8') }));
}

export function readAnimationSpeed(input, format, model, container) {
  const diagnostics = [], bytes = Buffer.from(input);
  for (const record of commentRecords(bytes, format, container)) {
    let data;
    try { data = JSON.parse(record.text.slice(prefix.length)); } catch { /* Report the malformed annotation below and preserve its bytes. */ }
    if (!validData(data)) {
      diagnostics.push({ severity: 'warning', code: 'ANIMATION_SPEED_METADATA', message: 'The MDLxL animation speed comment is invalid; its source bytes are retained.' });
      continue;
    }
    const { tracks, events } = timingRecords(model);
    const find = (records, path) => records.find(record => JSON.stringify(record.path) === JSON.stringify(path))?.value;
    const resolvedTracks = data.tracks.map(record => ({ ...record, value: find(tracks, record.path) }));
    const resolvedEvents = data.events.map(record => ({ ...record, value: find(events, record.path) }));
    if (data.sequences.length !== model.Sequences.length || resolvedTracks.some(record => !record.value || record.frames.length !== record.value.Keys.length || record.frames.some((frame, i) => frame && frame.frame !== record.value.Keys[i].Frame)) || resolvedEvents.some(record => !record.value || record.frames.length !== record.value.EventTrack.length || record.frames.some((frame, i) => !frame || frame.frame !== record.value.EventTrack[i]))) {
      diagnostics.push({ severity: 'warning', code: 'ANIMATION_SPEED_METADATA', message: 'The MDLxL animation speed comment is invalid; its source bytes are retained.' });
      continue;
    }
    model[ANIMATION_SPEED_KEY] = { master: data.master };
    model.Sequences.forEach((sequence, i) => { if (data.sequences[i]) sequence[ANIMATION_SPEED_KEY] = data.sequences[i]; else delete sequence[ANIMATION_SPEED_KEY]; });
    for (const { value } of tracks) for (const key of value.Keys) delete key[ANIMATION_SPEED_FRAME];
    for (const record of resolvedTracks) record.value.Keys.forEach((key, i) => { if (record.frames[i]) key[ANIMATION_SPEED_FRAME] = record.frames[i]; });
    for (const { value } of events) delete value[ANIMATION_SPEED_EVENTS];
    for (const record of resolvedEvents) record.value[ANIMATION_SPEED_EVENTS] = record.frames;
  }
  return diagnostics;
}

export function writeAnimationSpeed(input, format, model) {
  const bytes = Buffer.from(input), parts = [];
  let cursor = 0;
  for (const record of commentRecords(bytes, format)) {
    let valid = false;
    try { valid = validData(JSON.parse(record.text.slice(prefix.length))); } catch { /* Malformed source annotations remain byte-for-byte intact. */ }
    if (!valid) continue;
    parts.push(bytes.subarray(cursor, record.start)); cursor = record.end;
  }
  parts.push(bytes.subarray(cursor));
  const body = Buffer.concat(parts), data = animationSpeedData(model);
  if (!data) return body;
  const text = Buffer.from(prefix + JSON.stringify(data) + '\n', 'utf8');
  if (format === 'mdl') {
    const bom = body.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? 3 : 0;
    return Buffer.concat([body.subarray(0, bom), text, body.subarray(bom)]);
  }
  const header = Buffer.alloc(8); header.write(ANIMATION_SPEED_CHUNK, 'ascii'); header.writeUInt32LE(text.length, 4);
  const end = body.length - parseMdx(body).trailingBytes.length;
  return Buffer.concat([body.subarray(0, end), header, text, body.subarray(end)]);
}
