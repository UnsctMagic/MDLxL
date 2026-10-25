// Builds src/sd-parts-data.js, SD Brain's box of parts: which Warcraft III game models carry
// recognisable parts and where they are (model path, geoset, piece, bone). Two sources:
// every part the SD research volume reviewed by picture (native-reviewed-parts.json) and
// scripts/sd-knowledge/named-parts.json (parts picked from more hero and unit models and
// confirmed by a picture of the isolated piece). Every entry is checked here by loading its
// model from the installed game and finding the same piece (sd-kitbash pieces) with the same
// triangle count; an entry that fails is dropped and reported. No geometry is written.
//
//   node scripts/sd-knowledge/build-parts.mjs [--research D:/Codex/sd-research] [--game "D:/Warcraft III"]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2), arg = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const research = arg('--research', 'D:/Codex/sd-research'), gameFolder = arg('--game', 'D:/Warcraft III');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { CascReader } = require(path.join(root, 'electron/casc.cjs'));
const { openDocument } = await import(pathToFileURL(path.join(root, 'src/editor-document.js')).href);
const { pieces } = await import(pathToFileURL(path.join(root, 'src/sd-kitbash.js')).href);

const NAMES = {
  heromountainking: 'Mountain King', herodeathknight: 'Death Knight', heroblademaster: 'Blademaster', herolich: 'Lich', herodemonhunter: 'Demon Hunter',
  undeadarthas: 'Arthas (undead, Frostmourne)', arthaswithsword: 'Arthas with Frostmourne', arthas: 'Arthas (paladin)', thrallmountless: 'Thrall (on foot)',
  heropaladin: 'Paladin', heroarchmage: 'Archmage', thecaptain: 'Captain', hellscream: 'Grom Hellscream', orcwarlord: 'Orc Warlord', chaosgrunt: 'Chaos Grunt',
  herofarseer: 'Far Seer', herotaurenchieftain: 'Tauren Chieftain', heroshadowhunter: 'Shadow Hunter', orcwarlockguldan: "Gul'dan", herodreadlord: 'Dreadlord',
  kelthuzad: "Kel'Thuzad", evilsylvanas: 'Sylvanas (banshee)', herofemaledeathknight: 'Female Death Knight', herowarden: 'Warden', illidanevil: 'Illidan (demon form)',
  heropitlord: 'Pit Lord', doomguard: 'Doom Guard', felgaurd: 'Fel Guard', herochaosblademaster: 'Chaos Blademaster', banditlord: 'Bandit Lord', ogrelord: 'Ogre Lord',
  skeletonorc: 'Skeletal Orc', centaurkhan: 'Centaur Khan', tuskarlord: 'Tuskarr Chieftain', gnollwarden: 'Gnoll Warden', murgultidewarrior: 'Murgul Tidewarrior',
  anubarak: "Anub'arak", wolfrider: 'Raider', druidoftheclaw: 'Druid of the Claw', cryptfiend: 'Crypt Fiend', infernalcannoncannon: 'Infernal Cannon',
  undeadairbarge: 'Undead Air Barge', templeofthedamned: 'Temple of the Damned', gargoylespire: 'Gargoyle Spire', humanbarracks: 'Human Barracks',
  orcbarracks: 'Orc Barracks', elvenfarm: 'Elven Farm', treasurechest: 'Treasure Chest', witchdoctor: 'Witch Doctor', headhunter: 'Headhunter',
};
const titled = stem => NAMES[stem] || stem.replace(/\d+$/, '').replace(/(^|_)(\w)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase());
const HEROES = /^(hero|arthas|undeadarthas|thrall|uther|muradin|jaina|thecaptain|hellscream|orcwarlord|orcwarlockguldan|kelthuzad|evilsylvanas|illidanevil|anubarak|banditlord)/;
const faction = p => ({ human: 'human', orc: 'orc', undead: 'undead', nightelf: 'night elf', demon: 'demon', creeps: 'creep', other: 'other', critters: 'critter' })[p.split('\\')[1]] || p.split('\\')[0];
const category = p => (p.startsWith('buildings') ? 'building' : p.startsWith('doodads') ? 'doodad' : p.startsWith('objects\\inventoryitems') ? 'item' : HEROES.test(stem(p)) ? 'hero' : 'unit');
const stem = p => p.split('\\').at(-1).replace(/\.mdx$/, '');
// Kinds the director and builder ask for first; the research family says what a part is.
function kindOf(family) {
  if (/^shield/.test(family)) return 'shield';
  if (/helmet-horn|horn|tusk|fang|spike|claw-spike/.test(family) && !/weapon-spike/.test(family)) return 'horn';
  if (/helmet|plume|skull-headdress|hood/.test(family)) return 'helmet';
  if (/^architecture|emblem-card|banner/.test(family)) return 'ornament';
  if (/blade|sword|axe|hammer|mace|spear|staff|bow|firearm|glaive|polearm|totem-weapon|weapon|haft|dagger|lance|quiver|gun/.test(family)) return 'weapon';
  if (/hair|beard/.test(family)) return 'hair';
  if (/^head|face|skull|jaw/.test(family)) return 'head';
  if (/pauldron|bracer|greave|gauntlet|boot|armoured|shoulder|collar|armour|barding/.test(family)) return 'armour';
  if (/cape|cloak|robe|sleeve|cloth/.test(family)) return 'cloth';
  if (/body|torso|leg|arm|hand|foot|hoof|tail|wing|ear|eye|claw/.test(family)) return 'body';
  return 'other';
}
const r1 = v => Math.round(v * 10) / 10;

const reviewed = JSON.parse(fs.readFileSync(path.join(research, 'study/data/native-reviewed-parts.json'), 'utf8'));
const named = JSON.parse(fs.readFileSync(path.join(root, 'scripts/sd-knowledge/named-parts.json'), 'utf8')).parts;
const wanted = new Map();
const want = (p, entry) => { const k = p.toLowerCase(); (wanted.get(k) || wanted.set(k, []).get(k)).push(entry); };
for (const p of reviewed) want(p.sourcePath || p.modelPath, { geoset: p.geoset1 - 1, piece: p.component1 - 1, triangles: p.triangles ?? p.measurement?.triangles, label: p.label, family: p.family, kind: kindOf(p.family), material: p.material, from: 'research' });
for (const [p, geoset, piece, kind, label] of named) want(p, { geoset, piece, label, kind, from: 'picture' });

const casc = new CascReader(gameFolder, path.join(root, 'electron'));
const models = [], parts = [], dropped = [];
try {
  for (const [file, entries] of wanted) {
    const bytes = await casc.read('war3.w3mod:' + file);
    if (!bytes) { dropped.push(...entries.map(e => `${file}: model not in the game`)); continue; }
    const model = openDocument(new Uint8Array(bytes), file.split('\\').at(-1)).model, id = stem(file);
    const hidden = new Set((model.GeosetAnims || []).filter(a => a.Alpha === 0).map(a => a.GeosetId));
    const all = pieces(model, { order: 'file', limit: 100000 }), byKey = new Map(all.map(p => [`${p.geoset}:${p.piece}`, p]));
    const textures = g => (model.Materials[model.Geosets[g].MaterialID]?.Layers || []).map(l => model.Textures[l.TextureID]).filter(t => t?.Image && !t.ReplaceableId).map(t => t.Image);
    const visible = all.filter(p => !hidden.has(p.geoset)), top = Math.max(...visible.map(p => p.max[2]));
    models.push({ id, name: titled(id), path: file, faction: faction(file), category: category(file), triangles: visible.reduce((s, p) => s + p.triangles, 0), bones: model.Bones.length, height: Math.round(top), sheets: [...new Set(visible.flatMap(p => textures(p.geoset)))] });
    for (const e of entries) {
      const p = byKey.get(`${e.geoset}:${e.piece}`);
      if (!p || (e.triangles && p.triangles !== e.triangles)) { dropped.push(`${file} g${e.geoset}p${e.piece} ${e.label}: piece ${p ? 'has ' + p.triangles + ' triangles' : 'missing'}`); continue; }
      parts.push({ model: id, label: e.label, kind: e.kind, ...(e.family ? { family: e.family } : {}), geoset: p.geoset, piece: p.piece, triangles: p.triangles, size: p.size, center: p.center, bone: p.bone, textures: textures(p.geoset), ...(e.material ? { material: e.material } : {}), check: e.from === 'research' ? 'research picture review, found by loading' : 'picture of the isolated piece, found by loading' });
    }
  }
} finally { casc.close(); }
const data = { schema: 1, source: 'SD research volume 1 reviewed parts plus picked hero and unit parts, each found again in the installed game (Warcraft III SD models)', checked: new Date().toISOString().slice(0, 10), models: models.sort((a, b) => a.name.localeCompare(b.name)), parts };
fs.writeFileSync(path.join(root, 'src/sd-parts-data.js'), `// Generated by scripts/sd-knowledge/build-parts.mjs from the SD research volume and the installed game. Do not edit by hand.\nexport default ${JSON.stringify(data)};\n`);
console.log(`${models.length} models, ${parts.length} parts (${parts.filter(p => p.check.startsWith('research')).length} research, ${parts.filter(p => p.check.startsWith('picture')).length} picked); kinds ${JSON.stringify(parts.reduce((m, p) => ({ ...m, [p.kind]: (m[p.kind] || 0) + 1 }), {}))}`);
if (dropped.length) console.log('Dropped:\n' + dropped.join('\n'));
