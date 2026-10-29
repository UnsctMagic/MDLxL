import { recalculateExtents } from './editor-document.js';
import { globalSequenceId, isGlobalTrack, keysInInterval, sampleTrack, visitTracks } from './animation.js';
import { recalculatePortraitExtents } from './portrait-extents.js';
import { ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS, animationSpeed } from './animation-speed.js';

const MAX_FRAME = 0x7fffffff;

function wholeFrame(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_FRAME) throw new Error(`${label} must be a whole frame from 0 to ${MAX_FRAME}.`);
  return value;
}

function intervalLike(current, start, end) {
  return ArrayBuffer.isView(current) ? new current.constructor([start, end]) : [start, end];
}

function extentCopy(source = {}) {
  return {
    MinimumExtent: new Float32Array(source.MinimumExtent || [0, 0, 0]),
    MaximumExtent: new Float32Array(source.MaximumExtent || [0, 0, 0]),
    BoundsRadius: Number(source.BoundsRadius) || 0,
  };
}

export function setSequenceInterval(model, sequenceIndex, start, end) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) throw new Error('Select an animation before editing its frame interval.');
  start = wholeFrame(start, 'The first frame');
  end = wholeFrame(end, 'The last frame');
  if (end < start) throw new Error('The last frame must be greater than or equal to the first frame.');
  sequence.Interval = intervalLike(sequence.Interval, start, end);
  return sequence.Interval;
}

export function setSequenceName(model, sequenceIndex, value) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) throw new Error('Select an animation before renaming it.');
  const name = String(value ?? '').replace(/[\r\n\0]/g, '').trim();
  if (!name) throw new Error('An animation name cannot be empty.');
  if (new TextEncoder().encode(name).length > 79) throw new Error('An animation name must fit in 79 UTF-8 bytes.');
  sequence.Name = name;
  return name;
}

/** MdlVis' Apply Move Speed control edits the sequence field only. MoveSpeed
 * describes ground speed to a preview/game consumer; it is not a command to
 * add displacement to a Root_Bone animation track. */
export function setSequenceMoveSpeed(model, sequenceIndex, value) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) throw new Error('Select an animation before editing move speed.');
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed < 0) throw new Error('Move speed must be a number greater than or equal to 0.');
  sequence.MoveSpeed = speed;
  return speed;
}

export function setGlobalSequenceDuration(model, globalSeqId, duration) {
  if (!Number.isInteger(globalSeqId) || globalSeqId < 0 || model.GlobalSequences?.[globalSeqId] === undefined) throw new Error('Select a global sequence before editing its duration.');
  duration = wholeFrame(duration, 'The global sequence length');
  if (duration < 1) throw new Error('A global sequence must be at least one frame long.');
  model.GlobalSequences[globalSeqId] = duration;
  return duration;
}

export function createSequence(model, duration = 1000) {
  duration = wholeFrame(Number(duration), 'Sequence length');
  if (duration < 1) throw new Error('Sequence length must be at least 1 ms.');
  model.Sequences ||= [];
  const previousEnd = model.Sequences.length ? Math.max(...model.Sequences.map(sequence => Number(sequence.Interval?.[1]) || 0)) : -1000;
  const start = previousEnd + 1000, end = start + duration;
  if (end > MAX_FRAME) throw new Error('There is not enough frame space to create another sequence.');
  const taken = new Set(model.Sequences.map(sequence => sequence.Name));
  let number = model.Sequences.length + 1, name = `New Sequence ${number}`;
  while (taken.has(name)) name = `New Sequence ${++number}`;
  const sequence = {
    Name: name,
    Interval: new Uint32Array([start, end]),
    NonLooping: false,
    MoveSpeed: 0,
    Rarity: 0,
    ...extentCopy(model.Info),
  };
  const index = model.Sequences.push(sequence) - 1;
  for (const geoset of model.Geosets || []) (geoset.Anims ||= []).push(extentCopy(geoset));
  return index;
}

export function createSequenceFromCurrent(model, sourceIndex) {
  const source = model.Sequences?.[sourceIndex];
  if (!source?.Interval) throw new Error('Select an animation before copying it.');
  const name = `${source.Name} - copy`;
  if (new TextEncoder().encode(name).length > 79) throw new Error('An animation name must fit in 79 UTF-8 bytes.');
  const [start, end] = source.Interval;
  const index = createSequence(model, Math.max(1, end - start));
  const targetStart = model.Sequences[index].Interval[0], offset = targetStart - start;
  model.Sequences[index] = { ...structuredClone(source), Name: name, Interval: intervalLike(source.Interval, targetStart, end + offset) };
  if (source[ANIMATION_SPEED_KEY]) {
    // The copy is independently reversible to the source's original duration.
    const ordered = model.Sequences.slice(0, index).filter(sequence => sequence.Interval[0] < targetStart);
    const shift = ordered.reduce((sum, sequence) => {
      const original = sequence[ANIMATION_SPEED_KEY]?.originalInterval;
      return sum + (original ? sequence.Interval[1] - sequence.Interval[0] - (original[1] - original[0]) : 0);
    }, 0);
    const original = source[ANIMATION_SPEED_KEY].originalInterval, originalStart = targetStart - shift;
    model.Sequences[index][ANIMATION_SPEED_KEY] = { ...source[ANIMATION_SPEED_KEY], originalInterval: [originalStart, originalStart + original[1] - original[0]] };
  }
  for (const geoset of model.Geosets || []) {
    if (geoset.Anims?.[sourceIndex]) geoset.Anims[index] = structuredClone(geoset.Anims[sourceIndex]);
  }
  visitModel(model, {
    track(track) {
      if (isGlobalTrack(track)) return;
      const copies = keysInInterval(track, [start, end]).map(key => {
        const copy = { ...structuredClone(key), Frame: key.Frame + offset };
        if (source[ANIMATION_SPEED_KEY]) {
          const original = key[ANIMATION_SPEED_FRAME]?.frame === key.Frame ? key[ANIMATION_SPEED_FRAME].originalFrame : source[ANIMATION_SPEED_KEY].originalInterval[0] + (key.Frame - start) * animationSpeed(source) / 100;
          copy[ANIMATION_SPEED_FRAME] = { originalFrame: model.Sequences[index][ANIMATION_SPEED_KEY].originalInterval[0] + original - source[ANIMATION_SPEED_KEY].originalInterval[0], frame: copy.Frame };
        }
        return copy;
      });
      track.Keys.push(...copies);
      track.Keys.sort((a, b) => a.Frame - b.Frame);
    },
    event(node) {
      if (isGlobalTrack(node)) return;
      const frames = Array.from(node.EventTrack);
      const copies = frames.filter(frame => frame >= start && frame <= end).map(frame => frame + offset);
      const combined = [...frames, ...copies].sort((a, b) => a - b);
      node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor(combined) : combined;
    },
  });
  return index;
}

export function createGlobalSequence(model, duration = 1000) {
  model.GlobalSequences ||= [];
  duration = wholeFrame(duration, 'The global sequence length');
  if (duration < 1) throw new Error('A global sequence must be at least one frame long.');
  return model.GlobalSequences.push(duration) - 1;
}

export function portraitSequenceIndices(model) {
  return (model.Sequences || []).flatMap((sequence, index) => /portrait/i.test(sequence.Name || '') ? [index] : []);
}

/** Portrait is an ordinary Movement sequence. Copy only appearance channels;
 * bone motion and camera tracks must never be inherited from the source.
 * Local appearance keys are fitted to the new duration; shared global tracks
 * and static values already apply to the new sequence without modification. */
export function createPortraitSequence(model, duration, sourceIndex = -1) {
  duration = wholeFrame(Number(duration), 'Portrait length');
  if (duration < 1) throw new Error('Portrait length must be at least 1 ms.');
  const source = model.Sequences?.[sourceIndex];
  if (sourceIndex !== -1 && !source) throw new Error('Select an existing visibility/RGB source.');
  const previousEnd = Math.max(-1000, ...(model.Sequences || []).map(sequence => Number(sequence.Interval?.[1]) || 0));
  if (previousEnd + 1000 + duration > MAX_FRAME) throw new Error('There is not enough frame space for this Portrait sequence.');
  const copies = [];
  if (source) visitModel(model, {
    track(track, owner, property) {
      if (!['Alpha', 'Color', 'AmbColor', 'Visibility'].includes(property) || !track.Keys.length || isGlobalTrack(track)) return;
      const [start, end] = source.Interval;
      const sample = Frame => {
        const value = sampleTrack(track, Frame, { interval: source.Interval, fallback: property === 'Color' || property === 'AmbColor' ? [1, 1, 1] : 1 });
        const Vector = new Float32Array(typeof value === 'number' ? [value] : value);
        return { Frame, Vector, ...(track.LineType >= 2 ? { InTan: track.LineType === 2 ? new Float32Array(Vector.length) : new Float32Array(Vector), OutTan: track.LineType === 2 ? new Float32Array(Vector.length) : new Float32Array(Vector) } : {}) };
      };
      const keys = keysInInterval(track, [start, end]).map(key => structuredClone(key));
      if (!keys.some(key => key.Frame === start)) keys.unshift(sample(start));
      if (!keys.some(key => key.Frame === end)) keys.push(sample(end));
      copies.push({ track, keys, start, end });
    },
    event() {},
  });
  const index = createSequence(model, duration), sequence = model.Sequences[index];
  sequence.Name = 'Portrait';
  sequence.Interval[1] = sequence.Interval[0] + duration;
  for (const { track, keys, start, end } of copies) {
    const fitted = new Map();
    for (const key of keys) {
      key.Frame = sequence.Interval[0] + Math.round((key.Frame - start) / Math.max(1, end - start) * duration);
      fitted.set(key.Frame, key);
    }
    track.Keys.push(...fitted.values());
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  }
  recalculatePortraitExtents(model, [index]);
  return index;
}

function visitModel(model, visitor) {
  visitTracks(model, (track, { owner, property }) => visitor.track(track, owner, Array.isArray(owner) ? null : property), {
    skip: ['Keys', 'EventTrack', 'Interval', 'Anims'], event: node => visitor.event(node),
  });
}

function sameGlobalId(value, id) {
  return globalSequenceId(value) === id;
}

export const SEQUENCE_REORDER_SECTIONS = ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras'];

function checkOrder(order, count) {
  if (!Array.isArray(order) || order.length !== count || new Set(order).size !== count || order.some(index => !Number.isInteger(index) || index < 0 || index >= count))
    throw new Error('The animation order must contain every animation exactly once.');
}

/** Move complete clips, not just their names. Gaps retain their positional
 * lengths and their unused keys; all local channels use the same translation.
 * Shared endpoints are copied into both clips. Globals have independent clocks.
 * Prepare every write first so a bad interval/overflow cannot partially retime.
 */
export function reorderSequences(model, order) {
  const sequences = model.Sequences || [];
  checkOrder(order, sequences.length);
  if (order.every((index, position) => index === position)) return false;
  let shift = 0;
  const ranges = sequences.map((sequence, index) => {
    const current = Array.from(sequence.Interval || []);
    if (current.length !== 2) throw new Error('Every animation needs a valid frame interval before reordering.');
    current.forEach(frame => wholeFrame(frame, 'Animation frame'));
    if (current[1] < current[0]) throw new Error('An animation ends before it starts.');
    return { sequence, index, current };
  }).sort((a, b) => a.current[0] - b.current[0]);
  for (const [position, range] of ranges.entries()) {
    range.original = range.sequence[ANIMATION_SPEED_KEY]?.originalInterval || range.current.map(frame => frame - shift);
    shift = range.current[1] - range.original[1];
    if (position && (range.current[0] < ranges[position - 1].current[1] || range.original[0] < ranges[position - 1].original[1]))
      throw new Error('Overlapping animation intervals must be separated before reordering.');
  }
  const byIndex = new Map(ranges.map(range => [range.index, range]));
  const next = order.map(index => byIndex.get(index));
  // Preserve both the native timeline and the speed control's 100% baseline.
  for (const domain of ['current', 'original']) {
    let start = ranges[0][domain][0];
    next.forEach((range, position) => {
      const end = start + range[domain][1] - range[domain][0];
      wholeFrame(start, 'Animation frame'); wholeFrame(end, 'Animation frame');
      range[domain + 'Next'] = [start, end];
      if (position + 1 < next.length) start = end + Math.max(1, ranges[position + 1][domain][0] - ranges[position][domain][1]);
    });
  }
  const outside = (frame, domain) => {
    if (frame < ranges[0][domain][0]) return frame;
    for (let i = 0; i + 1 < ranges.length; i++) {
      if (frame > ranges[i][domain][1] && frame < ranges[i + 1][domain][0])
        return frame + next[i][domain + 'Next'][1] - ranges[i][domain][1];
    }
    return frame + next.at(-1)[domain + 'Next'][1] - ranges.at(-1)[domain][1];
  };
  const mapped = (frame, stored) => {
    const owners = ranges.filter(range => frame >= range.current[0] && frame <= range.current[1]);
    const previous = stored?.frame === frame ? stored.originalFrame : null;
    const result = owners.length ? owners.map(range => {
      const original = previous ?? range.original[0] + (frame - range.current[0]) * (range.original[1] - range.original[0]) / Math.max(1, range.current[1] - range.current[0]);
      return { frame: frame + range.currentNext[0] - range.current[0], originalFrame: original + range.originalNext[0] - range.original[0] };
    }) : [{ frame: outside(frame, 'current'), originalFrame: outside(previous ?? (() => {
      const preceding = ranges.filter(range => range.current[1] < frame).at(-1);
      return frame - (preceding ? preceding.current[1] - preceding.original[1] : 0);
    })(), 'original') }];
    for (const record of result) if (!Number.isInteger(record.frame) || record.frame < -0x80000000 || record.frame > MAX_FRAME)
      throw new Error('There is not enough frame space to reorder these animations.');
    return result;
  };
  const edits = [];
  visitModel(model, {
    track(track) {
      if (isGlobalTrack(track)) return;
      const keys = track.Keys.flatMap(key => mapped(key.Frame, key[ANIMATION_SPEED_FRAME]).map(record => ({
        ...structuredClone(key), Frame: record.frame,
        ...(key[ANIMATION_SPEED_FRAME] ? { [ANIMATION_SPEED_FRAME]: record } : {}),
      }))).sort((a, b) => a.Frame - b.Frame);
      edits.push(() => { track.Keys = keys; });
    },
    event(node) {
      if (isGlobalTrack(node)) return;
      const stored = [...(node[ANIMATION_SPEED_EVENTS] || [])];
      const records = Array.from(node.EventTrack).flatMap(frame => {
        const index = stored.findIndex(record => record?.frame === frame);
        return mapped(frame, index < 0 ? null : stored.splice(index, 1)[0]);
      }).sort((a, b) => a.frame - b.frame);
      edits.push(() => {
        const frames = records.map(record => record.frame);
        node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor(frames) : frames;
        if (node[ANIMATION_SPEED_EVENTS]) node[ANIMATION_SPEED_EVENTS] = records;
      });
    },
  });
  for (const geoset of model.Geosets || []) if (geoset.Anims?.length) {
    if (geoset.Anims.length !== sequences.length) throw new Error('Geoset animation bounds must match the animation count before reordering.');
    const anims = order.map(index => geoset.Anims[index]);
    edits.push(() => { geoset.Anims = anims; });
  }
  for (const range of next) {
    range.sequence.Interval = intervalLike(range.sequence.Interval, ...range.currentNext);
    if (range.sequence[ANIMATION_SPEED_KEY]?.originalInterval) range.sequence[ANIMATION_SPEED_KEY].originalInterval = range.originalNext;
  }
  model.Sequences = next.map(range => range.sequence);
  for (const edit of edits) edit();
  return true;
}

/** A global sequence is a duration referenced by ID, not a local frame range. */
export function reorderGlobalSequences(model, order) {
  const globals = model.GlobalSequences || [];
  checkOrder(order, globals.length);
  if (order.every((index, position) => index === position)) return false;
  const ids = new Map(order.map((old, index) => [old, index]));
  const remap = value => { if (ids.has(value.GlobalSeqId)) value.GlobalSeqId = ids.get(value.GlobalSeqId); };
  visitModel(model, { track: remap, event: remap });
  model.GlobalSequences = order.map(index => globals[index]);
  return true;
}

export function deleteSequence(model, sequenceIndex) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence?.Interval) throw new Error('Select an animation before deleting it.');
  const [start, end] = sequence.Interval;
  let removedKeys = 0;
  visitModel(model, {
    track(track) {
      if (isGlobalTrack(track)) return;
      const before = track.Keys.length;
      track.Keys = track.Keys.filter(key => key.Frame < start || key.Frame > end);
      removedKeys += before - track.Keys.length;
    },
    event(node) {
      if (isGlobalTrack(node)) return;
      const values = Array.from(node.EventTrack), filtered = values.filter(frame => frame < start || frame > end);
      removedKeys += values.length - filtered.length;
      node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor(filtered) : filtered;
    },
  });
  model.Sequences.splice(sequenceIndex, 1);
  for (const geoset of model.Geosets || []) if (Array.isArray(geoset.Anims)) geoset.Anims.splice(sequenceIndex, 1);
  if (model.Info) recalculateExtents(model);
  return removedKeys;
}

export function deleteGlobalSequence(model, globalSeqId) {
  if (!Number.isInteger(globalSeqId) || globalSeqId < 0 || model.GlobalSequences?.[globalSeqId] === undefined) throw new Error('Select a global sequence before deleting it.');
  let removedKeys = 0;
  visitModel(model, {
    track(track) {
      if (sameGlobalId(track, globalSeqId)) {
        removedKeys += track.Keys.length;
        track.Keys = [];
        track.GlobalSeqId = null;
      } else if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId > globalSeqId) track.GlobalSeqId--;
    },
    event(node) {
      if (sameGlobalId(node, globalSeqId)) {
        removedKeys += node.EventTrack.length;
        node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor() : [];
        delete node.GlobalSeqId;
      } else if (Number.isInteger(node.GlobalSeqId) && node.GlobalSeqId > globalSeqId) node.GlobalSeqId--;
    },
  });
  model.GlobalSequences.splice(globalSeqId, 1);
  if (model.Info) recalculateExtents(model);
  return removedKeys;
}
