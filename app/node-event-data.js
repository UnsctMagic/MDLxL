import { parseSlk, EVENT_TABLE_PATHS, resolveEventDefinition } from './event-preview-data.js';
import { gamePathKey } from '../src/game-path.js';

export const EVENT_TYPES = { SND: 'Sound', SPL: 'Blood Splat', FPT: 'Footprint', UBR: 'Uber Splat', SPN: 'Spawn Object' };
export const NODE_EVENT_TABLES = ['UI\\SoundInfo\\AnimLookups.slk', 'UI\\SoundInfo\\AnimSounds.slk', ...Object.values(EVENT_TABLE_PATHS)];
// Expansion of each playable sound. The game's sound table marks Reign of Chaos
// rows version 0 and The Frozen Throne rows version 1. Reforged appended a few
// rows after the classic alphabetical block, and every Forsaken Kingdom (3.0)
// sound is listed as an OGG, which no earlier row lists (older death sounds
// reach OGG files only through the dialogue tables, so pass the listed names).
export const SOUND_EXPANSIONS = Object.freeze({ ROC: 'Reign of Chaos', TFT: 'The Frozen Throne', RE: 'Reforged', FK: 'Forsaken Kingdom' });
const REFORGED_SOUNDS = new Set(['DMAR', 'MTSL', 'MTUS', 'DSTO', 'DSTB', 'DSTC']);
export function soundExpansion(id, version, files) {
  if (files.some(file => /\.ogg$/i.test(file))) return 'FK';
  if (REFORGED_SOUNDS.has(id)) return 'RE';
  return Number(version) === 1 ? 'TFT' : 'ROC';
}
const FOOTPRINT = /^foo?t?print/i;
// Top-level sound groups say what a sound is for; the game's own folders follow below them.
const SOUND_GROUPS = [
  [/^abilities\/spells\//, 'Spells', 2], [/^abilities\/weapons\//, 'Weapons & missiles', 2],
  [/^units\//, 'Units', 1], [/^sound\/units\//, 'Units', 2], [/^buildings\//, 'Buildings', 1], [/^sound\/buildings\//, 'Buildings', 2],
  [/^doodads\//, 'Doodads & destructibles', 1], [/^sound\/destructibles\//, 'Doodads & destructibles', 2],
  [/^sound\/interface\//, 'Interface', 2], [/^ui\//, 'Interface', 1],
];
export function soundFolders(row) {
  const folders = row.files?.[0]?.split(':').at(-1).split(/[\\/]+/).filter(Boolean).slice(0, -1);
  if (!folders) return ['Unavailable'];
  const path = folders.join('/').toLowerCase() + '/';
  const [, group, skip] = SOUND_GROUPS.find(([pattern]) => pattern.test(path)) || [null, 'Other', 0];
  return [group, ...folders.slice(skip)];
}
const NATIVE_SOUND_TABLES = ['AnimSounds', ...['Human','Orc','Undead','NightElf','Naga','Demon','Creeps'].map(race => `Dialogue${race}Base`)].map(name => `war3.w3mod:UI\\SoundInfo\\${name}.slk`);
export function eventCatalog(records) {
  const tables = new Map(records.map(record => [record.name.replaceAll('/', '\\').toLowerCase(), parseSlk(new TextDecoder().decode(record.bytes))]));
  const table = name => tables.get(name.toLowerCase()) || new Map();
  const sounds = table(NODE_EVENT_TABLES[1]);
  const catalog = { SND: [], SPL: [], FPT: [], UBR: [], SPN: [] };
  for (const [id, lookup] of table(NODE_EVENT_TABLES[0])) {
    const sound = sounds.get(lookup.SoundLabel);
    const files = sound?.FileNames ? String(sound.FileNames).split(',').filter(file => /\.(wav|mp3|ogg|flac)$/i.test(file.trim())).map(file => `${sound.DirectoryBase || ''}\\${file.trim()}`.replace(/\\+/g, '\\').replace(/^\\/, '')) : [];
    if (files.length) catalog.SND.push({ id, label: `${lookup.SoundLabel} · ${id}`, files, expansion: soundExpansion(id, sound.version, files) });
  }
  // Reforged stores event codes on AnimSounds and sound-file labels in the
  // dialogue tables. Use the authored mapping; never guess a replacement path.
  for (const [label, row] of table(NATIVE_SOUND_TABLES[0])) {
    const id = row.AnimationEventCode;
    if (!/^[A-Za-z0-9]{4}$/.test(id)) continue;
    const files = String(row.FileNames || '').split(',').flatMap(value => {
      const file = value.trim();
      if (/\.(wav|mp3|ogg|flac)$/i.test(file)) return [`war3.w3mod:${file}`];
      const data = NATIVE_SOUND_TABLES.slice(1).map(name => table(name).get(file)).find(data => data?.Filepath);
      return data ? [`war3.w3mod:${data.Filepath}`] : [];
    });
    if (!files.length) continue;
    const existing = catalog.SND.findIndex(sound => sound.id === id);
    const sound = {id, label:`${label} · ${id}`, files, expansion: soundExpansion(id, row.version, String(row.FileNames || '').split(','))};
    if (existing < 0) catalog.SND.push(sound); else catalog.SND[existing] = sound;
  }
  for (const [type, name] of Object.entries(EVENT_TABLE_PATHS)) for (const [id, row] of table(name)) {
    if (id === 'INIT') continue;
    const label = row.comment || row.Model || row.file || id;
    catalog[type].push({ id, label: `${label} · ${id}`, definition:resolveEventDefinition(`${type}x${id}`, tables) });
  }
  // Blood and footprints share the splat table; each picker lists only its own kind.
  catalog.FPT = catalog.SPL.filter(row => FOOTPRINT.test(row.label));
  catalog.SPL = catalog.SPL.filter(row => !FOOTPRINT.test(row.label));
  for (const rows of Object.values(catalog)) rows.sort((a, b) => a.label.localeCompare(b.label));
  return catalog;
}
export function assignEventData(node, type, id) {
  if (!EVENT_TYPES[type] || !/^[A-Za-z0-9]{4}$/.test(id)) throw Error('Select valid event data.');
  node.Name = `${type}${node.Name?.[3] || 'x'}${id}`;
}
export function setEventFrame(node, frame, enabled) {
  if (!Number.isInteger(frame) || frame < 0 || frame > 0xffffffff) throw Error('Event frame must be a non-negative whole number.');
  const frames = new Set(node.EventTrack || []);
  if (enabled) frames.add(frame); else frames.delete(frame);
  node.EventTrack = new Uint32Array([...frames].sort((a,b) => a-b));
}
export function loadEventCatalog(modelPath) {
  return window.desktop.resolveEventResources({ names: [...NODE_EVENT_TABLES, ...NATIVE_SOUND_TABLES], path: modelPath }).then(eventCatalog);
}

export async function resolveEventSound(resolveResources, file, modelPath) {
  const records = await resolveResources({ names:[file], path: modelPath });
  const sound = records.find(record => record.name === file && record.bytes?.length);
  if (!sound) throw Error(`Sound not found: ${file}`);
  const mime = { wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', flac: 'audio/flac' }[(sound.sourceName || sound.name).split('.').at(-1).toLowerCase()];
  return { bytes: sound.bytes, mime };
}
