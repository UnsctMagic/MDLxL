import { createNode, deleteNode } from './editor-document.js';

/** Death blood the way Blizzard's units bleed: ground splats (SPL events from
 * Splats\SplatData.slk) and one spray model (an SPN event from
 * Splats\SpawnData.slk), keyed in the Death animation. Splat codes are race
 * letter + B + S(mall)/L(arge) + variant 0-3, for example SPLxHBS0. */
export const BLOOD_RACES = Object.freeze({ H: 'Human (red)', O: 'Orc (dark red)', U: 'Undead', E: 'Night elf (purple)', D: 'Demon (green)' });
export const splatCode = (race, size, variant) => `${race}B${size}${variant}`;
export const parseSplat = id => /^([HOUED])B([SL])([0-3])$/.exec(id || '') && { race: id[0], size: id[2], variant: Number(id[3]) };
// Blood sprays in SpawnData use B as their second letter (HBF0, OBG0, UBGH, NBAR, DBPT).
// Their first letter is the kind; night elf sprays use N where splats use E.
export const sprayKind = id => ({ H: 'H', O: 'O', U: 'U', N: 'E', D: 'D' })[id?.[0]] || 'X';
export const BLOOD_KINDS = Object.freeze({ ...BLOOD_RACES, X: 'Other (creatures)' });
export const isBloodSpray = id => /^[A-Z]B[A-Z0-9]{2}$/.test(id || '');
const isBlood = event => {
  const type = event.Name?.slice(0, 3), id = event.Name?.slice(4, 8);
  return type === 'SPL' && parseSplat(id) || type === 'SPN' && isBloodSpray(id);
};

/** The blood already keyed inside this Death animation, one row per moment. */
export function deathBlood(model, deathIndex) {
  const [start, end] = model.Sequences[deathIndex].Interval, rows = [];
  for (const event of model.EventObjects || []) if (isBlood(event))
    for (const frame of event.EventTrack || []) if (frame >= start && frame <= end)
      rows.push({ type: event.Name.slice(0, 3), id: event.Name.slice(4, 8), time: frame - start, position: Array.from(event.PivotPoint || [0, 0, 0]), parent: event.Parent ?? null });
  return rows.sort((a, b) => a.time - b.time);
}

/** Replaces this Death animation's blood with `rows`. Keys in other
 * animations and every non-blood event stay as they are. */
export function applyDeathBlood(model, deathIndex, rows) {
  const [start, end] = model.Sequences[deathIndex].Interval;
  for (const event of [...(model.EventObjects || [])]) {
    if (!isBlood(event)) continue;
    const before = event.EventTrack?.length || 0;
    event.EventTrack = new Uint32Array(Array.from(event.EventTrack || []).filter(frame => frame < start || frame > end));
    if (before && !event.EventTrack.length) { try { deleteNode(model, event.ObjectId); } catch { /* A keyless event changes nothing. */ } }
  }
  const used = new Set((model.EventObjects || []).map(event => event.Name));
  for (const row of rows) {
    if (row.type === 'SPL' ? !parseSplat(row.id) : !isBloodSpray(row.id)) throw Error(`${row.type}${row.id} is not a blood event.`);
    // The fourth letter only tells events of the same kind apart.
    const letter = [...'xyzwvutsrqponmlkjihgfedcba'].find(c => !used.has(`${row.type}${c}${row.id}`));
    if (!letter) throw Error(`Too many ${row.type}${row.id} events in this model.`);
    const node = createNode(model, 'EventObject');
    node.Name = `${row.type}${letter}${row.id}`; used.add(node.Name);
    node.Parent = row.parent ?? null; node.PivotPoint.set(row.position.slice(0, 3)); model.PivotPoints[node.ObjectId] = node.PivotPoint;
    node.EventTrack = new Uint32Array([Math.min(end, start + Math.max(0, Math.round(row.time)))]);
  }
}
