import { poseNodeRole } from './pose-ik.js';

/** Rig words separated by punctuation, numbers, or camelCase (including acronyms). */
export function nameTokens(name) {
  return String(name || '').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z]+/g) || [];
}

// Union of the weapon words used by Glow Up, Attachemator, AnimXL, corpse
// geometry and POSE recognition. Machine actions and nonweapon exclusions stay
// with their feature; a substring such as Elbow, Balance or Begun is not a word.
export const WEAPON_WORDS = Object.freeze([
  'weapon', 'w', 'wep', 'sword', 'sord', 'blade', 'axe', 'hammer', 'mace',
  'club', 'staff', 'stave', 'spear', 'lance', 'pike', 'glaive', 'scythe',
  'halberd', 'polearm', 'flail', 'maul', 'wand', 'dagger', 'knife', 'katana',
  'scimitar', 'trident', 'bow', 'gun', 'rifle', 'pipe', 'rod', 'totem',
  'sickle', 'whip', 'cleaver', 'sabre', 'saber', 'choppa', 'shield',
]);
const weapons = new Set(WEAPON_WORDS);

export function isWeaponName(name, extraWords = []) {
  return nameTokens(name).some(token => weapons.has(token) || extraWords.includes(token));
}

/** Explicit side words win over initials, then the compact handr/rhand forms. */
export function nameSide(name) {
  const tokens = nameTokens(name), compact = tokens.join('');
  if (tokens.includes('left')) return 'left';
  if (tokens.includes('right')) return 'right';
  if (tokens.includes('l')) return 'left';
  if (tokens.includes('r')) return 'right';
  if (/(?:arm|leg|hand|foot|shoulder|wrist|thigh|knee|toe)r$|^r(?:arm|leg|hand|foot|shoulder|wrist|thigh|knee|toe)/.test(compact)) return 'right';
  if (/(?:arm|leg|hand|foot|shoulder|wrist|thigh|knee|toe)l$|^l(?:arm|leg|hand|foot|shoulder|wrist|thigh|knee|toe)/.test(compact)) return 'left';
  return null;
}

/** POSE owns joint roles; list ordering also recognizes broader region words.
 * AnimXL requests detailed roles for its existing spine/neck/foot reactions. */
export function nameRegion(name, { detailed = false } = {}) {
  const tokens = nameTokens(name), has = (...words) => words.some(word => tokens.some(token =>
    [word, 'left' + word, 'right' + word, word + 'l', word + 'r', 'l' + word, 'r' + word].includes(token)));
  const role = poseNodeRole({ Name: name });
  if (detailed) {
    if (has('torso')) return 'Chest';
    if (has('back', 'abdomen')) return 'Spine';
    if (has('feet') || role === 'Hoof') return 'Foot';
    if (role === 'Body') return 'Pelvis';
    return ['Chest', 'Spine', 'Neck', 'Head', 'Pelvis', 'Foot'].includes(role) ? role : null;
  }
  if (['Chest', 'Spine'].includes(role) || has('torso', 'ribcage', 'breast', 'upperbody') || has('upper') && has('body')) return 'chest';
  if (role === 'Hand' || has('arm', 'shoulder', 'clavicle', 'elbow', 'forearm', 'wrist', 'hand', 'finger', 'thumb')) return 'arm';
  if (['Foot', 'Hoof'].includes(role) || has('leg', 'thigh', 'knee', 'calf', 'shin', 'ankle', 'foot', 'feet', 'toe')) return 'leg';
  if (['Head', 'Neck'].includes(role) || has('face', 'jaw', 'mouth', 'eye', 'brow', 'cheek', 'nose', 'ear')) return 'head';
  if (['Body', 'Pelvis'].includes(role) || has('hip', 'waist', 'belly', 'gut', 'gutz')) return 'pelvis';
  if (has('mesh', 'object', 'box', 'dummy', 'chain', 'ribbon', 'reference', 'ref', 'copied', 'backdrop', 'copiedmodeldummy', 'portraitbackdrop')) return 'other';
  return null;
}
