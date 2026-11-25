// Scorecard page: one row per pair, the six rules, a picture of each failing pair's worst moment.
//   node out/scorecard/page.mjs <scores.jsonl> <out folder> [--before <scores.jsonl>] [--title "..."] [--no-pictures]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const [scoresFile, outDir] = args;
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const flag = name => args.includes('--' + name);
const read = f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
const rows = read(scoresFile);
const before = opt('before') ? new Map(read(opt('before')).map(r => [r.id, r])) : null;
fs.mkdirSync(path.join(outDir, 'pictures'), { recursive: true });

const SHEETS = ['weapons14', 'reasonable50', 'new30', 'random30'].map(s => `D:/Claude/MDLxL/TestBuilds/transfer-xl-35/cases-${s}.json`);
const sheetOf = id => SHEETS.find(f => JSON.parse(fs.readFileSync(f)).cases.some(c => c.id === id));
const RULES = [
  ['shape', 'Body keeps its shape'],
  ['motion', 'Parts move like the donor'],
  ['weapon', 'Weapon held like the donor'],
  ['twins', 'Near-twins stay alike'],
  ['jitter', 'No jitter'],
];
const pct = x => Math.round(x * 100) + '%';
const words = {
  shape: r => r.worst ? `${r.stretchedEdges} edges stretch; worst ${r.worst.ratio}× at ${r.worst.where} in ${r.worst.clip}` : `${r.stretchedEdges} edges stretch`,
  motion: r => r.worst ? `${r.off} of ${r.checked} part-moves off; worst ${r.worst.part} ${r.worst.ratio}× the donor's in ${r.worst.clip}` : `${r.checked} part-moves checked`,
  weapon: r => r.note ? r.note : `in hand ${pct(r.inHand)}, angle off ${Math.round(r.angle)}°${r.secondHand != null ? `, second hand ${pct(r.secondHand)}` : ''}`,
  twins: r => r.note ? r.note : r.worst ? `${r.worse} of ${r.twinClips} alike animations drift; ${r.worst.clip}: own ${Math.round(r.worst.own)}° from donor, result ${Math.round(r.worst.result)}°` : `${r.twinClips} alike animations stay alike`,
  jitter: r => r.worst ? `${r.clipsOver} animations jerk; worst ${r.worst.clip}` : 'smooth',
};
const worstMoment = r => {
  for (const key of ['shape', 'weapon', 'jitter', 'motion', 'twins']) {
    const rule = r.rules?.[key];
    if (rule?.pass === false && rule.worst?.clip) return { key, clip: rule.worst.clip, phase: rule.worst.phase ?? .5 };
  }
  return null;
};

if (!flag('no-pictures')) for (const r of rows) {
  const m = worstMoment(r), file = path.join(outDir, 'pictures', r.id + '.png');
  if (!m || fs.existsSync(file)) continue;
  try {
    execFileSync(process.execPath, [path.resolve('scripts/xfer-scorecard/render.mjs'), r.id, path.resolve(file), '--manifest', sheetOf(r.id), '--seq', m.clip, '--n', '1', '--phase', String(m.phase), '--size', '240'], { cwd: path.resolve('scripts/xfer-scorecard'), stdio: 'ignore', timeout: 120000 });
  } catch { /* picture is optional */ }
}

const count = key => ({ pass: rows.filter(r => r.rules?.[key]?.pass === true).length, fail: rows.filter(r => r.rules?.[key]?.pass === false).length, na: rows.filter(r => r.rules?.[key]?.pass == null).length });
const failsOf = r => RULES.filter(([k]) => r.rules?.[k]?.pass === false).length;
const sorted = [...rows].sort((a, b) => failsOf(b) - failsOf(a) || a.id.localeCompare(b.id));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cell = (r, key) => {
  const rule = r.rules?.[key];
  if (!rule) return '<td class="na">–</td>';
  const was = before?.get(r.id)?.rules?.[key]?.pass;
  const change = before && was !== undefined && was !== rule.pass ? (rule.pass === true ? ' <b class="up">now passes</b>' : rule.pass === false ? ' <b class="down">now fails</b>' : '') : '';
  const cls = rule.pass === true ? 'ok' : rule.pass === false ? 'bad' : 'na';
  const mark = rule.pass === true ? '✓' : rule.pass === false ? '✗' : '–';
  return `<td class="${cls}"><span class="mark">${mark}</span> ${esc(words[key](rule))}${change}</td>`;
};
const allPass = rows.filter(r => RULES.every(([k]) => r.rules?.[k]?.pass !== false)).length;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opt('title') || 'XFER scorecard')}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#f6f6f4;--fg:#1d1d1b;--muted:#6b6b66;--ok:#1f7a3a;--okbg:#e6f3ea;--bad:#a8261c;--badbg:#fbe9e7;--line:#dcdcd6}
@media (prefers-color-scheme:dark){:root{--bg:#1b1b1a;--fg:#ececea;--muted:#a3a39d;--ok:#7fd09a;--okbg:#1f3326;--bad:#f2948a;--badbg:#3a2220;--line:#3a3a37}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
main{max-width:1400px;margin:0 auto;padding:20px 16px}
h1{font-size:22px;margin:0 0 4px}p{margin:4px 0 12px;color:var(--muted)}
.sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:14px 0 18px}
.sum div{border:1px solid var(--line);border-radius:8px;padding:10px}
.sum b{display:block;font-size:20px}
table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{position:sticky;top:0;background:var(--bg);font-weight:600}
td.ok{background:var(--okbg)}td.bad{background:var(--badbg)}td.na{color:var(--muted)}
.mark{font-weight:700}td.ok .mark{color:var(--ok)}td.bad .mark{color:var(--bad)}
.up{color:var(--ok)}.down{color:var(--bad)}
img{width:120px;border-radius:4px;cursor:zoom-in}img:hover{width:360px}
.id{color:var(--muted);font-size:12px}
.wrap{overflow-x:auto}
</style></head><body><main>
<h1>${esc(opt('title') || 'XFER scorecard')}</h1>
<p>${rows.length} pairs, every donated animation (Decay left out), default ticks. ${allPass} pairs pass every rule.${before ? ' Changes are against the previous scorecard.' : ' This is the starting point: rule 6 (no pair gets worse) is checked from the next run on.'}</p>
<div class="sum">${RULES.map(([k, label]) => { const c = count(k); return `<div><b>${c.pass} / ${c.pass + c.fail}</b>${esc(label)}${c.na ? `<br><span class="id">${c.na} not applicable</span>` : ''}</div>`; }).join('')}</div>
<div class="wrap"><table><thead><tr><th>Pair</th>${RULES.map(([, l]) => `<th>${esc(l)}</th>`).join('')}<th>Worst moment</th></tr></thead><tbody>
${sorted.map(r => {
  if (r.error) return `<tr><td>${esc(r.title)}<div class="id">${esc(r.id)}</div></td><td colspan="${RULES.length + 1}" class="bad">The scorecard could not build this pair: ${esc(r.error.split('\n')[0])}</td></tr>`;
  const m = worstMoment(r), pic = path.join(outDir, 'pictures', r.id + '.png');
  return `<tr><td>${esc(r.title)}<div class="id">${esc(r.id)}${r.mirror ? ' · mirrored' : ''}</div></td>${RULES.map(([k]) => cell(r, k)).join('')}<td>${m && fs.existsSync(pic) ? `<img src="pictures/${esc(r.id)}.png" alt="Donor, own and result at the worst moment"><div class="id">${esc(m.clip)} · donor / own / result</div>` : ''}</td></tr>`;
}).join('\n')}
</tbody></table></div></main></body></html>`;
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('page', path.join(outDir, 'index.html'), 'pairs', rows.length, 'all rules pass', allPass);
