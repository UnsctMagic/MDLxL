// One result: node scripts/xfer-look/look.mjs <donor.mdx> <result.mdx> [original unit.mdx]
// Prints "looks fine" or each reason with the clip it shows in.
import { measurePair } from './check.mjs';
import { verdict } from './verdict.mjs';
const [donor, result, native] = process.argv.slice(2);
if (!donor || !result) { console.log('usage: look.mjs <donor.mdx> <result.mdx> [original unit.mdx]'); process.exit(1); }
const v = verdict(measurePair(donor, result, { native: native || null }));
console.log(v.broken ? 'LOOKS BROKEN' : 'looks fine');
for (const r of v.reasons) console.log(`  ${r.words} (${r.clip}; score ${r.value}, limit ${r.limit})`);
if (!native) console.log('  (no original unit given: weapon, tear and still-part checks skipped)');
