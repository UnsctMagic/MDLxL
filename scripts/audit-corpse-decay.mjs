import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CascReader } from '../electron/casc.cjs';
import { parseCompatibleMdx as parseMDX } from '../src/mdx-compatibility.js';
import { allNodes, sampleNodeMatrices, skinGeoset, sampleGeosetAnimation } from '../src/animation.js';

// Reproducible read-only study. Extracts stay in the caller's disposable output.
const [game, directory] = process.argv.slice(2);
if (!game || !directory) throw Error('Usage: node scripts/audit-corpse-decay.mjs GAME OUTPUT');
fs.mkdirSync(directory, { recursive: true });
const reader = new CascReader(game, directory), rows = [], hashes = new Set();
const chosen = {
  human: 'footman peasant rifleman knight priest sorceress mortarteam gyrocopter gryphonrider dragonhawkrider spellbreaker militia heropaladin heromountainking heroarchmage herobloodelf',
  orc: 'grunt peon raider tauren shaman witchdoctor spiritwalker headhunter windrider kotobeast demolisher catapult herofarseer heroblademaster herotaurenchieftain heroshadowhunter',
  undead: 'acolyte ghoul cryptfiend abomination necromancer banshee gargoyle frostmourne frostwyrm meatwagon obsidianstatue skeleton shade herodeathknight herodreadlord herolich herocryptlord',
  nightelf: 'archer huntress dryad druidclaw druidtalon hippogryph faeriedragon mountainGiant chimaera ballista wisp ent herodemonhunter heropriestessofthemoon herokeeperofthegrove herowarden',
  critters: 'rat frog sheep pig penguin rabbit raccoon vulture albatross packhorse seal skink spidercrab villagerman villagerwoman',
  naga: 'nagamyrmidon nagasiren nagaseawitch snapdragon dragonTurtle',
  creeps: 'ogre ogrelord gnoll kobold murloc centaur centaurarcher magnataur mammoth hydra redDragon redDragonWelp thunderlizard seaturtle grizzlybear direwolf harpy nerubian archnathid spider sasquatch furbolg satyr seagiant rockgolem humanbattleship goblinzeppelin goblinsapper facelessone unbroken quillbeast razormane',
  demon: 'felstalker felguard doomguard infernal pitlord eredarwarlock'
};
const bounds = values => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const a of values) for (let i = 0; i < a.length; i++) { const k = i % 3; lo[k] = Math.min(lo[k], a[i]); hi[k] = Math.max(hi[k], a[i]); }
  return Number.isFinite(lo[0]) ? { min: lo, max: hi, size: hi.map((v,i) => v-lo[i]) } : null;
};
try {
  const listing = await reader.list('models');
  const names = listing.names.filter(n => /^war3.w3mod:units\\/i.test(n) && !/portrait|missile/i.test(n));
  const candidates = Object.entries(chosen).flatMap(([race, units]) => units.toLowerCase().split(' ').map(unit => names.find(n => n.toLowerCase() === `war3.w3mod:units\\${race}\\${unit}\\${unit}.mdx`)).filter(Boolean));
  // Round robin across families; do not let the first race consume the quota.
  const groups = Object.keys(chosen).map(race => candidates.filter(n => n.includes(`units\\${race}\\`)));
  const ordered = []; for (let i=0; groups.some(g => i<g.length); i++) for (const g of groups) if (g[i]) ordered.push(g[i]);
  ordered.push(...names.filter(n => !ordered.includes(n)));
  for (const member of ordered) {
    if (rows.length === 100) break;
    const bytes = await reader.readKey(listing.keys[member.toLowerCase()]);
    if (!bytes) continue;
    const hash = crypto.createHash('sha256').update(bytes).digest('hex'); if (hashes.has(hash)) continue;
    const model = parseMDX(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const death = model.Sequences.findIndex(s => /^death(?:\s|$)/i.test(s.Name)); if (death < 0) continue;
    const decays = model.Sequences.flatMap((s,i) => /decay|dissipate/i.test(s.Name) ? [{ index:i, name:s.Name, interval:Array.from(s.Interval), nonLooping:!!s.NonLooping }] : []);
    const frame = model.Sequences[death].Interval[1], matrices = sampleNodeMatrices(model,frame,death);
    const skin = model.Geosets.map(g => skinGeoset(g,matrices));
    const body = model.Geosets.map((g,i) => ({i, alpha:sampleGeosetAnimation(model,i,frame,death).alpha})).filter(g => g.alpha>.01).map(g => g.i);
    const corpse = model.Geosets.map((g,i) => ({i,texture:(model.Materials[g.MaterialID]?.Layers||[]).map(l=>model.Textures[l.TextureID]?.Image||'').join('|')})).filter(g => /gutz|guts|bone|corpse|skeleton/i.test(g.texture));
    const samples = decays.map(seq => ({...seq, samples:[0,.0028,.25,.5,.75,1].map(t=>{
      const f=Math.round(seq.interval[0]+(seq.interval[1]-seq.interval[0])*t), ms=sampleNodeMatrices(model,f,seq.index);
      return {t,frame:f,body:bounds(body.map(i=>skinGeoset(model.Geosets[i],ms))), corpse:bounds(corpse.map(g=>skinGeoset(model.Geosets[g.i],ms))),alpha:model.Geosets.map((g,i)=>sampleGeosetAnimation(model,i,f,seq.index).alpha)};
    })}));
    const file=String(rows.length+1).padStart(3,'0')+'-'+member.split('\\').at(-1);
    fs.writeFileSync(path.join(directory,file),bytes);
    rows.push({file,member,sha256:hash,name:model.Info.Name,version:model.Version,death:{index:death,name:model.Sequences[death].Name,interval:Array.from(model.Sequences[death].Interval)},deathBounds:bounds(body.map(i=>skin[i])),bodyGeosets:body,corpseGeosets:corpse,decays:samples,nodes:allNodes(model).map(n=>({id:n.ObjectId,parent:n.Parent,name:n.Name})),corpseAlpha:corpse.map(g=>model.GeosetAnims?.find(a=>a.GeosetId===g.i)?.Alpha)});
    hashes.add(hash);
    console.log(`${rows.length}/100 ${member}`);
  }
  if(rows.length!==100) throw Error(`Expected 100 models, found ${rows.length}`);
  fs.writeFileSync(path.join(directory,'study.json'),JSON.stringify({source:'Local Warcraft III CASC, base SD models, unique SHA-256',count:rows.length,models:rows},null,2));
} finally { reader.close(); }
