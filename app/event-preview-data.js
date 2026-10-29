import { clamp } from '../src/math.js';
import { gamePathKey } from '../src/game-path.js';
// Warcraft table fields and name conventions are documented by the upstream viewer:
// https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/handler.ts
// https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/eventobjectemitterobject.ts
// This module only evaluates authored events; it does not substitute placeholder effects.
import { parseSlk } from '../src/slk.js';

export { parseSlk };
export const EVENT_TABLE_PATHS = Object.freeze({ SPN: 'Splats\\SpawnData.slk', SPL: 'Splats\\SplatData.slk', UBR: 'Splats\\UberSplatData.slk' });

export function parseEventName(name) {
  name = String(name || '');
  let type = name.slice(0, 3).toUpperCase();
  if (type === 'FPT') type = 'SPL';
  const id = name.slice(4);
  return EVENT_TABLE_PATHS[type] && id ? { type, id, tablePath: EVENT_TABLE_PATHS[type] } : null;
}

export function resolveEventDefinition(name, tables, { textureExtension = 'blp' } = {}) {
  const event = parseEventName(name);
  if (!event) return null;
  const sources = tables instanceof Map ? [...tables.entries()] : Object.entries(tables || {});
  let table = sources.find(([key]) => key === event.type || gamePathKey(key) === gamePathKey(event.tablePath))?.[1];
  if (typeof table === 'string') table = parseSlk(table);
  const entries = table instanceof Map ? [...table.entries()] : Object.entries(table || {});
  const row = entries.find(([key]) => key.toLowerCase() === event.id.toLowerCase())?.[1];
  if (!row) return null;
  const fields = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  const string = key => String(fields.get(key.toLowerCase()) ?? '').trim();
  const number = (key, fallback = 0) => { const value = fields.get(key.toLowerCase()); return value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : fallback; };
  if (event.type === 'SPN') {
    const path = string('Model');
    return path && path !== '_' ? { ...event, resourcePath: path.replace(/\.mdl$/i, '.mdx'), lifeSpanMs: 0 } : null;
  }
  const file = string('file');
  if (!file || file === '_') return null;
  const colors = ['Start', 'Middle', 'End'].map(stage => ['R', 'G', 'B', 'A'].map(channel => clamp(number(stage + channel, 255), 0, 255) / 255));
  const intervalTimesMs = (event.type === 'SPL' ? ['Lifespan', 'Decay'] : ['BirthTime', 'PauseTime', 'Decay']).map(key => Math.max(0, number(key)) * 1000);
  const intervals = event.type === 'SPL' ? ['Lifespan', 'Decay'].map(stage => [number(`UV${stage}Start`), number(`UV${stage}End`), Math.max(0, number(`${stage}Repeat`, 1))]) : [];
  const resourcePath = `ReplaceableTextures\\Splats\\${file.replace(/\.(blp|dds|tga|png)$/i, '')}.${textureExtension}`;
  return { ...event, resourcePath, colors, intervalTimesMs, intervals, lifeSpanMs: intervalTimesMs.reduce((a, b) => a + b, 0),
    scale: Math.max(0, number('Scale')), columns: event.type === 'SPL' ? Math.max(1, Math.floor(number('Columns', 1))) : 1,
    rows: event.type === 'SPL' ? Math.max(1, Math.floor(number('Rows', 1))) : 1, blendMode: number('BlendMode') };
}

/** Stateless event instances: rewinding/repeating a frame returns the same keys. */
export function activeEventInstances(model, definitions, { sequenceIndex = -1, frame = 0, globalTime = frame, playback, footprintPlayback, maxInstances = 128 } = {}) {
  const result = [];
  const limit = Number.isFinite(maxInstances) ? clamp(Math.floor(maxInstances), 0, 512) : 128;
  for (const [eventIndex, event] of (model.EventObjects || []).entries()) {
    const eventPlayback = /^FPT/i.test(event.Name) ? footprintPlayback ?? playback : playback;
    const interval = eventPlayback?.interval || model.Sequences?.[sequenceIndex]?.Interval;
    if (playback?.disabledEmitters?.includes(event.ObjectId)) continue;
    const definition = definitions instanceof Map ? definitions.get(event.Name) : definitions?.[event.Name];
    if (!definition || !(definition.lifeSpanMs > 0) || !Number.isFinite(definition.lifeSpanMs) || !limit) continue;
    const globalId = event.GlobalSeqId ?? event.GlobalSequenceId;
    const global = Number.isInteger(globalId) && globalId >= 0, duration = model.GlobalSequences?.[globalId];
    if (global && !(duration > 0) || !global && (!interval || frame < interval[0] || frame > interval[1])) continue;
    const now = global ? globalTime : frame;
    if (!Number.isFinite(now) || now < 0) continue;
    const tracks = [...new Set(Array.from(event.EventTrack || []))].filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => b - a);
    for (const triggerFrame of tracks) {
      let count = 0;
      if (global) {
        if (triggerFrame > duration) continue;
        const latestCycle = Math.floor((now - triggerFrame) / duration);
        for (let cycle = latestCycle; cycle >= 0 && count < limit; cycle--) {
          const ageMs = now - (cycle * duration + triggerFrame);
          if (ageMs >= definition.lifeSpanMs) break;
          if (ageMs >= 0) { result.push({ key: `${eventIndex}:g${globalId}:${cycle}:${triggerFrame}`, event, eventIndex, definition, triggerFrame, ageMs }); count++; }
        }
      } else if (eventPlayback?.motionSeconds != null && triggerFrame >= interval[0] && triggerFrame <= interval[1]) {
        if (!(eventPlayback.speed > 0)) continue;
        const speed = eventPlayback.speed, span = interval[1] - interval[0];
        const period = eventPlayback.finishEffects ? eventPlayback.cycleSeconds * 1000 : span / speed;
        if (!(period > 0)) continue;
        const trigger = (triggerFrame - interval[0]) / speed;
        const latest = Math.min(eventPlayback.loop === false ? 0 : eventPlayback.finishEffects ? (eventPlayback.durationLoops || 1) - 1 : Infinity, Math.floor((eventPlayback.clipTime - trigger) / period));
        for (let cycle = latest; cycle >= 0 && count < limit; cycle--) {
          const ageMs = eventPlayback.clipTime - cycle * period - trigger;
          if (ageMs >= definition.lifeSpanMs) break;
          if (ageMs >= 0) { result.push({key: `${eventIndex}:s${sequenceIndex}:${eventPlayback.segment}:${cycle}:${triggerFrame}`, event, eventIndex, definition, triggerFrame, ageMs}); count++; }
        }
      } else if (triggerFrame >= interval[0] && triggerFrame <= interval[1] && triggerFrame <= now && now - triggerFrame < definition.lifeSpanMs) {
        result.push({ key: `${eventIndex}:s${sequenceIndex}:${triggerFrame}`, event, eventIndex, definition, triggerFrame, ageMs: now - triggerFrame }); count++;
      }
    }
  }
  return result.sort((a, b) => a.ageMs - b.ageMs || a.eventIndex - b.eventIndex || a.key.localeCompare(b.key)).slice(0, limit);
}

/** Color and atlas position follow upstream splat/ubersplat life-stage formulas. */
export function sampleEventDecal(definition, ageMs) {
  const times = definition.intervalTimesMs || [], colors = definition.colors || [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 0]];
  let stage = 0, factor = 0;
  if (definition.type === 'UBR') {
    if (ageMs < times[0]) factor = ageMs / times[0];
    else if (ageMs < times[0] + times[1]) factor = 1;
    else { stage = 1; factor = (ageMs - times[0] - times[1]) / (times[2] || 1); }
  } else if (ageMs < times[0]) factor = ageMs / times[0];
  else { stage = 1; factor = (ageMs - (times[0] || 0)) / (times[1] || 1); }
  factor = clamp(factor, 0, 1);
  const color = colors[stage].map((value, i) => value + (colors[stage + 1][i] - value) * factor);
  const [start = 0, end = 0, repeat = 1] = definition.intervals?.[stage] || [], columns = definition.columns || 1, rows = definition.rows || 1;
  const count = end - start, cell = clamp(count > 0 ? start + Math.floor(count * repeat * factor) % count : start, 0, columns * rows - 1);
  const left = Math.floor(cell % columns) / columns, top = Math.floor(cell / columns) / rows;
  return { color, uv: [left, top, left + 1 / columns, top + 1 / rows] };
}
