// Turns the measurements of one result (check.mjs measurePair) into "looks broken" reasons.
// Each score is the worst clip; the limits in thresholds.json were tuned on the owner's 295 graded results
// (tune.mjs). Plain words per reason are what the owner would call it.
import thresholds from '../scripts/xfer-look/thresholds.json' with { type: 'json' };

export const WORDS = {
  bobX: 'bobs up and down far more than the donor',
  bobD: 'bobs up and down far more than the donor',
  shakeX: 'shakes far more than the donor',
  shakeD: 'shakes far more than the donor',
  twitchX: 'a part twitches far more than on the donor',
  ntwitch: 'a part twitches more than the unit ever does',
  squash: 'body curls up or collapses',
  floorD: 'floats or sinks compared with the donor',
  stillWalk: 'legs/tail/cloak stop moving in the walk',
  regionStill: 'a body part that moves on the unit stays still',
  regionMass: 'a body part that moves on the unit stays still',
  napart: 'a held piece (weapon, shield, arm) comes off',
  ntear: 'skin tears or stretches',
  ncrush: 'skin squashes flat',
  wild: 'a part flails',
};

export const THRESHOLDS = thresholds;
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

// Worst value of every score over the clips, and the clip it came from.
export function scores(m) {
  const cs = m.clips, st = cs.find(c => /^stand/i.test(c.name)) || cs[0], o = {}, at = {};
  if (!st) return { o, at };
  const hr = med(st.r.height), hd = med(st.d.height);
  const mx = (k, v, clip) => { if (Number.isFinite(v) && v > (o[k] ?? -Infinity)) { o[k] = v; at[k] = clip; } };
  for (const c of cs) {
    const R = c.r, D = c.d, N = c.nat, walk = /walk|run|swim/i.test(c.name);
    mx('shakeX', (R.shake / hr) / Math.max(D.shake / hd, 3), c.name);
    mx('bobX', (R.bob / hr) / Math.max(D.bob / hd, 0.05), c.name);
    mx('twitchX', (R.twitch / hr) / Math.max(D.twitch / hd, 60), c.name);
    mx('bobD', R.bob / hr - D.bob / hd, c.name);
    mx('shakeD', R.shake / hr - D.shake / hd, c.name);
    let sq = -Infinity; for (let t = 0; t < c.n; t++) sq = Math.max(sq, 1 - (R.height[t] / hr) / (D.height[t] / hd)); mx('squash', sq, c.name);
    let fl = 0; for (let t = 0; t < c.n; t++) fl = Math.max(fl, Math.abs((R.low[t] - R.low[0]) / hr - (D.low[t] - D.low[0]) / hd)); mx('floorD', fl, c.name);
    if (N) {
      if (walk) mx('stillWalk', N.still, c.name);
      if (N.regionShare >= 0.03) mx('regionStill', N.regionStill, c.name);
      mx('regionMass', (N.regionStill || 0) * (N.regionShare || 0), c.name);
      mx('napart', N.apart, c.name); mx('ntear', N.tear, c.name); mx('ncrush', N.crush, c.name); mx('ntwitch', N.twitch, c.name); mx('wild', N.wild, c.name);
    }
  }
  return { o, at };
}

export function verdict(m, th = THRESHOLDS) {
  const { o, at } = scores(m), reasons = [];
  for (const [k, limit] of Object.entries(th)) if ((o[k] ?? -Infinity) > limit) reasons.push({ kind: k, words: WORDS[k] || k, clip: at[k], value: +o[k].toFixed(3), limit: +limit.toFixed(3) });
  return { broken: reasons.length > 0, reasons };
}
