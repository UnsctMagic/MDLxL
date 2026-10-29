/** GeosetAnim.Flags bit 2 enables tint; Color is a Float32Array(3) OR an
 * AnimVector { LineType, GlobalSeqId, Keys }. An animated MDX Color additionally
 * has its static RGB base in _MdxDefaults.Color. These are separate concepts.
 * Only disabled, unanimated null/absent/white Color values are format-equivalent.
 * Never whiten tracks, active colors, or dormant nonwhite colors; an MDL save
 * leaves dormant ones out (see dormantGeosetColor) because MDL cannot store them.
 */
export const hasGeosetColorTrack = anim => Array.isArray(anim?.Color?.Keys);
export const geosetTintEnabled = anim => !!(anim?.Flags & 2);
export const neutralGeosetColor = color => color == null ||
  (Array.isArray(color) || ArrayBuffer.isView(color)) && color.length === 3 && Array.from(color).every(n => n === 1);
export const defaultGeosetColor = anim => !geosetTintEnabled(anim) && !hasGeosetColorTrack(anim) && neutralGeosetColor(anim?.Color);
export const equivalentGeosetColorDefaults = (a, b) => defaultGeosetColor(a) && defaultGeosetColor(b);

export function createVisibilityGeosetAnimation(GeosetId) {
  return { GeosetId, Alpha: 1, Color: new Float32Array([1, 1, 1]), Flags: 0 };
}

/** The first geoset animation of a geoset, or undefined. */
export const geosetAnimationOf = (model, geosetId) => (model.GeosetAnims || []).find(anim => anim.GeosetId === geosetId);

/** Find a geoset's animation or append a neutral one. `refuseDuplicates`
 * throws when the geoset already has several (a string is the message);
 * false silently takes the first. Track edits check the same thing through
 * animation-tracks' assertSingleGeosetOwner, with their own message. */
export function ensureGeosetAnimation(model, geosetId, { refuseDuplicates = true } = {}) {
  const anims = (model.GeosetAnims ||= []);
  if (refuseDuplicates && anims.filter(anim => anim.GeosetId === geosetId).length > 1) throw new Error(typeof refuseDuplicates === 'string' ? refuseDuplicates : `Geoset ${geosetId + 1} has more than one geoset animation.`);
  return geosetAnimationOf(model, geosetId) || anims[anims.push(createVisibilityGeosetAnimation(geosetId)) - 1];
}

/** An explicit user toggle may enable the neutral default, preserving other bits. */
export function setGeosetTintEnabled(anim, enabled) {
  if (enabled && defaultGeosetColor(anim) && anim.Color == null) anim.Color = new Float32Array([1, 1, 1]);
  anim.Flags = enabled ? anim.Flags | 2 : anim.Flags & ~2;
}

/** Export-only snapshots; do not change the live document, flags, or history. */
export function prepareGeosetAnimationColors(animations, format) {
  return animations.map(anim => {
    if (defaultGeosetColor(anim)) return { ...anim, Color: format === 'mdl' ? null : new Float32Array([1, 1, 1]) };
    if (format === 'mdl' && dormantGeosetColor(anim)) return { ...anim, Color: null };
    return anim;
  });
}

/** A color the game ignores because tint (Flags bit 2) is off. MDL has no way
 * to store it without enabling tint, so an MDL save leaves it out; the game
 * looks the same. MDX keeps it. */
export const dormantGeosetColor = anim => !geosetTintEnabled(anim) && !defaultGeosetColor(anim) &&
  (hasGeosetColorTrack(anim) || anim?.Color instanceof Float32Array && anim.Color.length === 3 && anim.Color.every(Number.isFinite));

export function mdlDroppedGeosetColors(animations) {
  return (animations || []).flatMap((anim, i) => dormantGeosetColor(anim) ? [`GeosetAnims[${i}].Color`] : []);
}

export function geosetColorExportIssues(animations, format) {
  const issues = [];
  for (const [i, anim] of animations.entries()) {
    const path = `GeosetAnims[${i}].Color`;
    if (!hasGeosetColorTrack(anim) && !defaultGeosetColor(anim) &&
        (!(anim.Color instanceof Float32Array) || anim.Color.length !== 3 || !anim.Color.every(Number.isFinite))) {
      issues.push(`${path}: invalid static color; expected three finite RGB values.`);
    }
  }
  return issues;
}
