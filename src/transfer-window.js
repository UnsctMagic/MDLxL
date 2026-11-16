// Small pure helpers of the Transfer window (app/Transfer.jsx): which chip comes
// first, which donor part feeds a part, and POSE handles to parts and back.

const CHIP_ORDER = ['head', 'chest', 'hips', 'armL', 'armR', 'legL', 'legR', 'wingL', 'wingR', 'tail'];

/** Part keys in chip order: Head, Chest, Hips, arms, legs, wings, tail; extra limbs after their kind. */
export function chipOrder(keys) {
  const rank = key => { const [, stem, number] = String(key).match(/^(.*?)(\d*)$/); const at = CHIP_ORDER.indexOf(stem); return (at < 0 ? CHIP_ORDER.length : at) * 100 + (Number(number) || 1); };
  return [...keys].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
}

/** The donor part that feeds this model's part: the other side when mirrored. */
export function donorPartKey(key, mirror) {
  return mirror ? String(key).replace(/^(arm|leg|wing)([LR])/, (_, kind, side) => kind + (side === 'L' ? 'R' : 'L')) : key;
}

/** The part a clicked POSE handle belongs to ({kind:'body'|'endpoint'|'bend'|'node'}), or null. */
export function handlePart(rig, pose, target) {
  if (!rig?.ok || !target) return null;
  if (target.kind === 'body') return rig.parts.hips ? 'hips' : null;
  let ids = [];
  if (target.kind === 'node') ids = [target.id];
  else if (target.key != null) { const chain = pose?.chains?.find(item => item.key === target.key); if (chain) ids = [chain.end, chain.middle, chain.root, ...(chain.joints || [])]; }
  for (const id of ids) for (const part of Object.values(rig.parts)) if (part.joints.includes(id)) return part.key;
  return null;
}

/** The POSE handle that stands for a part, so the preview can show it as chosen. */
export function partHandle(rig, pose, key) {
  const part = rig?.parts?.[key];
  if (!part || !pose) return null;
  if (key === 'hips') return { kind: 'body' };
  const chain = (pose.chains || []).find(item => [item.end, item.middle, item.root].some(id => part.joints.includes(id)));
  if (chain && part.kind === 'limb') return { kind: 'endpoint', key: chain.key };
  return { kind: 'node', id: part.marker };
}

/** Which source and animation each taken part uses, as one comparable string. */
export function takenSummary(recipe) {
  return Object.entries(recipe?.parts || {}).map(([key, part]) => `${key}:${part.source}:${part.sequence}:${part.from ?? ''}`).sort().join('|') + '|' + JSON.stringify(recipe?.sources || {});
}
