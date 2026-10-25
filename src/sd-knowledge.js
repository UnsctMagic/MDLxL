/**
 * SD Brain's Warcraft III knowledge: what the SD research volume (PR #302) observed
 * in Blizzard's SD models and the LowPolyWorks collection, searchable by words.
 *
 *   const know = await api.module('sd-knowledge');
 *   know.findMaterials('dark iron gold rim')     // native texture areas, ranked by look
 *   know.findFamilies('sword blade')             // how real parts of that kind are built
 *   know.categoryNorms('unit')                   // what a normal unit measures
 *   know.findFactions('nurgle')                  // what makes a faction read as itself
 *   know.findChapters('chain') / know.chapter(id)
 *   know.checkAgainstNorms(model, 'item')        // the open model next to its category
 *   know.findParts('frostmourne') / ('grunt head') // the box of parts: which game model carries it, where
 *   know.findBases('orc warlord')                // game models to start a kitbash from
 *   know.weaponReferences()                      // real weapon parts, for size and construction
 *
 * A region is a rectangle fully inside a real UV island that a reviewed model paints
 * with that look. Its tags describe the rendered part: when a region carries tint
 * (geoset colour, RGB) or team (a team-colour layer under alpha paint), that is part
 * of how the look was made. Pass a region to sd-kit as { native: region } to map a
 * new part onto it. Everything here is observation, not a rule or a limit.
 */
import DATA from './sd-knowledge-data.js';
import PARTS from './sd-parts-data.js';

export const SD_KNOWLEDGE_SOURCE = DATA.source;
export const SD_FOOTMAN_HEIGHT = DATA.footmanHeight;

const STOP = new Set('a an the and or of to for in on with without me my make made create build give this that these it its some very more less really cool cooler better nice new please like look looks looking style styled kind sort thing things one into from by be is are as at so but just also want need can could would should model models mdlxl warcraft wc3 sd'.split(' '));
// Words people use → words the research uses. Each query word also matches itself.
const SYNONYMS = {
  iron: ['iron', 'metal', 'steel', 'plate', 'armour', 'armor'], metal: ['metal', 'iron', 'steel', 'plate'], steel: ['steel', 'metal', 'silver', 'iron'],
  dark: ['dark', 'black', 'blackened', 'shadow'], black: ['black', 'dark'], gold: ['gold', 'golden', 'gilded', 'brass', 'yellow'], golden: ['gold', 'golden'],
  brass: ['brass', 'gold', 'bronze'], bronze: ['bronze', 'brass', 'copper'], silver: ['silver', 'steel', 'white metal'],
  bone: ['bone', 'skull', 'ivory', 'pale'], skull: ['skull', 'bone'], wood: ['wood', 'wooden', 'timber', 'bark', 'plank'], wooden: ['wood', 'wooden'],
  leather: ['leather', 'hide', 'strap'], cloth: ['cloth', 'fabric', 'banner', 'cape', 'robe', 'drape'], cape: ['cape', 'cloak', 'cloth'], cloak: ['cloak', 'cape'],
  fur: ['fur', 'pelt', 'mane'], hair: ['hair', 'mane', 'fur'], red: ['red', 'crimson', 'blood'], blood: ['blood', 'red', 'gore'], green: ['green', 'olive', 'sickly'],
  purple: ['purple', 'violet', 'magenta', 'pink'], blue: ['blue', 'azure', 'teal'], stone: ['stone', 'rock', 'masonry', 'brick'], rock: ['rock', 'stone'],
  skin: ['skin', 'flesh'], flesh: ['flesh', 'skin', 'gore', 'meat'], glow: ['glow', 'glowing', 'fire', 'flame', 'fel', 'magic'], fire: ['fire', 'flame', 'lava', 'glow'],
  lava: ['lava', 'fire', 'molten'], chain: ['chain', 'mail', 'chainmail', 'link'], mail: ['mail', 'chainmail', 'chain'], gem: ['gem', 'jewel', 'crystal'],
  crystal: ['crystal', 'gem'], rust: ['rust', 'rusted', 'corroded', 'worn'], worn: ['worn', 'chipped', 'scratched', 'rust'], spike: ['spike', 'horn', 'spiked'],
  horn: ['horn', 'spike', 'antler'], rim: ['rim', 'trim', 'border', 'edge'], trim: ['trim', 'rim', 'border'], scale: ['scale', 'scales', 'scaled'],
  eye: ['eye', 'eyes'], tooth: ['tooth', 'teeth', 'fang', 'tusk'], teeth: ['teeth', 'tooth', 'fang'], wing: ['wing', 'membrane'], rune: ['rune', 'glyph', 'symbol', 'emblem'],
  symbol: ['symbol', 'emblem', 'rune', 'motif'], sword: ['sword', 'blade'], blade: ['blade', 'sword', 'edge'], axe: ['axe', 'cleaver', 'hatchet'], shield: ['shield'],
  helmet: ['helmet', 'helm', 'visor', 'crest'], helm: ['helm', 'helmet'], armour: ['armour', 'armor', 'plate', 'pauldron'], armor: ['armor', 'armour', 'plate'],
  shoulder: ['shoulder', 'pauldron'], pauldron: ['pauldron', 'shoulder'], haft: ['haft', 'shaft', 'handle', 'grip', 'pole'], grip: ['grip', 'handle', 'haft'],
  roof: ['roof', 'tile', 'shingle'], tree: ['tree', 'trunk', 'leaf', 'leaves', 'canopy'], banner: ['banner', 'flag', 'standard', 'cloth'],
};
const words = text => String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).map(w => w.replace(/'s$|'/g, '')).filter(w => w.length > 1 && !STOP.has(w));
const stem = w => w.replace(/(ing|ed|es|s)$/, '') || w;
const terms = query => words(query).map(w => [...new Set([w, ...(SYNONYMS[w] || []), ...(SYNONYMS[stem(w)] || [])])]);
const has = (text, variants) => { const t = String(text).toLowerCase(); return variants.some(v => t.includes(v)); };
const area = uv => Math.max(0, (uv[2] - uv[0]) * (uv[3] - uv[1]));

/** Native texture regions whose reviewed look matches the words, best first, at most two per sheet. */
export function findMaterials(query, { limit = 8, from, sheet } = {}) {
  const groups = terms(query);
  if (!groups.length) return [];
  const scored = [];
  for (const r of DATA.regions) {
    if (from && r.from !== from) continue;
    if (sheet && !r.sheet.toLowerCase().includes(String(sheet).toLowerCase())) continue;
    let score = 0, matched = 0;
    for (const g of groups) {
      const s = (r.tags.some(t => has(t, g)) ? 3 : 0) + (has(r.label, g) ? 2 : 0) + (has(r.sheet, g) ? 0.5 : 0);
      if (s) matched++;
      score += s;
    }
    if (!matched) continue;
    // Prefer regions that match every word, then roomy ones, then the owner's own choices.
    // Corpse and portrait-backdrop pieces are hidden in normal play; use them only when asked.
    score += (matched === groups.length ? 4 : 0) + Math.min(2, area(r.uv) * 40) + (r.from === 'owner' ? 0.5 : 0);
    if (/corpse|decay|portrait backdrop/i.test(r.label) && !groups.some(g => g.some(v => /corpse|decay|portrait/.test(v)))) score -= 6;
    scored.push({ r, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const perSheet = new Map(), out = [];
  for (const { r } of scored) {
    const k = r.sheet.toLowerCase(), n = perSheet.get(k) || 0;
    if (n >= 2) continue;
    perSheet.set(k, n + 1); out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** Everything known about one native sheet: its observed contents and every reviewed region on it. */
export function sheetInfo(sheet) {
  const k = String(sheet || '').replaceAll('/', '\\').toLowerCase();
  const match = s => s.toLowerCase() === k || s.toLowerCase().endsWith('\\' + k) || s.toLowerCase().replace(/\.(blp|dds|tga)$/, '') === k.replace(/\.(blp|dds|tga)$/, '');
  return { sheet: DATA.sheets.find(s => match(s.sheet)) || null, regions: DATA.regions.filter(r => match(r.sheet)) };
}

// Everyday names → the research's family ids, most telling first.
const FAMILY_ALIASES = {
  sword: ['straight-blade', 'curved-blade', 'rune-blade', 'weapon-guard', 'pommel', 'weapon-grip'], blade: ['straight-blade', 'curved-blade', 'weapon-blade'], dagger: ['dagger', 'straight-blade', 'weapon-grip'],
  axe: ['axe-blade', 'weapon-haft', 'weapon-head-assembly'], cleaver: ['axe-blade', 'weapon-blade'], hammer: ['hammer-head', 'weapon-haft'], mace: ['hammer-head', 'weapon-spike', 'weapon-haft'],
  glaive: ['glaive-blade', 'leaf-weapon-card'], spear: ['spearhead', 'spear-shaft'], polearm: ['polearm-blade', 'spear-shaft', 'weapon-haft'], halberd: ['polearm-blade', 'spear-shaft'], lance: ['lance', 'spear-shaft'],
  scythe: ['curved-blade', 'polearm-blade', 'weapon-haft'], staff: ['staff', 'totem-weapon', 'weapon-haft'], bow: ['bow', 'bowstring', 'quiver'], gun: ['firearm', 'gun-barrel', 'firearm-fitting'], cannon: ['gun-barrel', 'wheel', 'vehicle-chassis'],
  weapon: ['straight-blade', 'axe-blade', 'weapon-haft'], shield: ['shield', 'shield-boss', 'shield-back', 'shield-rim', 'shield-face-assembly'],
  helmet: ['helmet', 'helmet-shell', 'helmet-visor', 'helmet-crest', 'helmet-horn', 'plume'], helm: ['helmet', 'helmet-shell', 'helmet-visor'], hat: ['helmet-point', 'hood', 'helmet-shell'],
  crown: ['skull-headdress', 'helmet-point', 'helmet-crest'], hood: ['hood', 'animal-pelt-hood'], plume: ['plume', 'helmet-crest'],
  skull: ['skull', 'skull-plate', 'skull-card', 'jaw', 'tooth'], bone: ['bone-card', 'skull'], jaw: ['jaw', 'tooth'], tooth: ['tooth', 'tooth-card', 'fang', 'tusk'], teeth: ['tooth', 'tooth-card', 'fang'],
  tusk: ['tusk', 'fang'], fang: ['fang', 'tooth'], horn: ['horn', 'helmet-horn', 'horn-surface', 'horn-spur'], spike: ['spike', 'weapon-spike', 'spike-card', 'chitin-spike'],
  armour: ['pauldron', 'gauntlet', 'greave', 'bracer', 'armoured-leg', 'torso'], armor: ['pauldron', 'gauntlet', 'greave', 'bracer', 'armoured-leg', 'torso'],
  pauldron: ['pauldron', 'pauldron-rim', 'shoulder-panel'], shoulder: ['pauldron', 'pauldron-rim', 'shoulder-panel'], gauntlet: ['gauntlet', 'bracer', 'hand'],
  cape: ['cape', 'cape-lining', 'cloak', 'cloth-panel'], cloak: ['cloak', 'cape', 'cape-lining'], robe: ['robe', 'sleeve', 'cloth-panel'],
  banner: ['banner', 'banner-cloth', 'banner-pole', 'banner-finial', 'banner-tassel'], flag: ['banner', 'banner-cloth', 'banner-pole'], standard: ['banner', 'banner-cloth', 'banner-pole'],
  hair: ['hair', 'head-hair', 'hair-crest', 'hair-tail'], beard: ['beard', 'facial-hair'], fur: ['fur-card', 'fur-trim', 'fur-mantle'],
  head: ['head', 'head-assembly', 'face', 'jaw', 'ear'], face: ['face', 'head', 'eye', 'facial-hair'], eye: ['eye', 'eye-lid'], ear: ['ear', 'pointed-ear', 'animal-ear'],
  hand: ['hand', 'arm-and-hand', 'claw'], claw: ['claw', 'claw-spike', 'claw-card'], foot: ['foot', 'boot', 'clawed-foot', 'hoof'], boot: ['boot', 'greave', 'foot'],
  arm: ['upper-arm', 'forearm', 'arm-assembly'], leg: ['leg-assembly', 'thigh', 'armoured-leg'],
  knight: ['body-assembly', 'helmet-shell', 'pauldron', 'shield', 'straight-blade'], warrior: ['body-assembly', 'torso', 'pauldron'], soldier: ['body-assembly', 'helmet-shell', 'shield'],
  footman: ['body-assembly', 'helmet', 'shield', 'straight-blade'], grunt: ['body-assembly', 'axe-blade', 'tusk'], body: ['body-assembly', 'torso', 'mixed-humanoid-body'],
  wing: ['membrane-wing', 'wing-finger', 'wing-framework', 'wing-membrane'], tail: ['tail', 'tail-card'], dragon: ['membrane-wing', 'wing-finger', 'tail', 'horn', 'fang'],
  creature: ['mixed-creature-body', 'creature-arm', 'clawed-foot', 'tail'], beast: ['mixed-creature-body', 'clawed-foot', 'tail', 'horn'],
  horse: ['mount-body', 'mount-head', 'mount-leg', 'barding', 'tack'], mount: ['mount-body', 'mount-head', 'mount-leg', 'barding'],
  chain: ['chain-card', 'chain', 'chainmail-carrier'], gem: ['gem', 'gem-plate', 'gem-trim-card'], jewel: ['gem', 'gem-plate', 'jewellery-card'], crystal: ['crystal-cluster', 'hanging-shard', 'gem'],
  rune: ['rune-panel', 'emblem-plate', 'weapon-emblem-card'], emblem: ['emblem-plate', 'weapon-emblem-card', 'plaque'], symbol: ['emblem-plate', 'weapon-emblem-card'],
  book: ['book'], tome: ['book'], chest: ['treasure-chest', 'crate'], treasure: ['treasure-chest'], barrel: ['barrel', 'crate'], crate: ['crate', 'barrel'],
  tree: ['tree-trunk', 'leaf-card', 'tree-stump', 'fallen-leaf-card'], plant: ['leaf-card', 'ground-card'], bush: ['leaf-card', 'ground-card'],
  roof: ['pitched-tile-roof', 'pitched-thatch-roof', 'pyramidal-roof', 'radial-roof'], house: ['building-body', 'mixed-house-shell', 'pitched-thatch-roof', 'door', 'chimney'],
  hut: ['hide-wall', 'mixed-house-shell', 'pitched-thatch-roof', 'door'], building: ['building-body', 'mixed-house-shell', 'door'], tower: ['tower', 'tower-wall', 'battlement-wall'],
  wall: ['palisade-wall', 'battlement-wall', 'arched-wall', 'foundation-wall'], door: ['door'], pillar: ['pillar', 'stone-pillar'], column: ['pillar', 'stone-pillar'], stairs: ['painted-stairs', 'platform'],
  cart: ['vehicle-chassis', 'wheel', 'axle'], wagon: ['vehicle-chassis', 'wheel', 'axle'], wheel: ['wheel', 'wheel-cap', 'axle'],
  glow: ['glow-card', 'effect-card'], effect: ['effect-card', 'glow-card'], spell: ['effect-card', 'glow-card'], statue: ['statue-body', 'pillar'],
};

/** Construction families (blade, helmet-shell, chain, roof...) with the real members that show how they are built. */
export function findFamilies(query, { limit = 3 } = {}) {
  const groups = terms(query);
  if (!groups.length) return [];
  // Take the named families in turns, so "skull helmet" brings skulls and helmets.
  const lists = words(query).map(w => FAMILY_ALIASES[w] || FAMILY_ALIASES[stem(w)] || []).filter(l => l.length), ids = [];
  for (let i = 0; lists.some(l => i < l.length); i++) for (const l of lists) if (i < l.length) ids.push(l[i]);
  const named = [...new Set(ids)].map(id => DATA.families.find(f => f.family === id)).filter(Boolean);
  if (named.length >= limit) return named.slice(0, limit);
  return [...named, ...DATA.families
    .filter(f => !named.includes(f))
    .map(f => {
      let score = 0;
      for (const g of groups) score += (has(f.family.replaceAll('-', ' '), g) ? 4 : 0) + Math.min(3, f.members.filter(m => has(m.label, g)).length * 0.5);
      // Blizzard's own construction is the reference; owner families follow it.
      if (score && f.members.some(m => m.from === 'blizzard')) score += 2.5;
      return { f, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || b.f.count - a.f.count)
    .slice(0, limit - named.length)
    .map(x => x.f)];
}

const CATEGORY_WORDS = {
  hero: ['hero', 'lord', 'champion', 'king', 'queen', 'warlord', 'general', 'boss', 'archmage', 'paladin', 'blademaster'],
  unit: ['unit', 'knight', 'warrior', 'soldier', 'footman', 'grunt', 'archer', 'creature', 'beast', 'monster', 'dragon', 'horse', 'rider', 'mount', 'skeleton', 'ogre', 'troll', 'goblin', 'zombie', 'ghoul', 'wolf', 'spider', 'minotaur', 'ratman', 'saurus', 'skink', 'berserker', 'guard', 'golem'],
  building: ['building', 'tower', 'house', 'hut', 'castle', 'barracks', 'keep', 'fort', 'temple', 'shrine', 'farm', 'mill', 'gate', 'wall', 'altar', 'hall'],
  doodad: ['doodad', 'tree', 'rock', 'plant', 'bush', 'barrel', 'crate', 'statue', 'fence', 'ruin', 'pillar', 'column', 'lamp', 'torch', 'cart', 'tent', 'well', 'grave', 'tombstone'],
  item: ['item', 'chalice', 'cup', 'goblet', 'potion', 'bottle', 'tome', 'book', 'rune', 'chest', 'ring', 'amulet', 'orb', 'relic', 'treasure', 'gold', 'scroll', 'sword', 'axe', 'shield', 'weapon', 'staff', 'hammer', 'mace', 'spear', 'bow', 'dagger', 'glaive', 'helmet', 'hat', 'banner', 'skull'],
  missile: ['missile', 'projectile', 'arrow', 'bolt', 'fireball'],
  effect: ['effect', 'spell', 'aura', 'explosion', 'buff', 'particle', 'glow', 'impact'],
  portrait: ['portrait'],
};
/** The likely Warcraft category for a request's words (unit, hero, building, doodad, item, missile, effect, portrait).
 * The first word that names a kind of thing wins: "a knight with an axe" is a unit, "an orc axe" an item. */
export function guessCategory(text) {
  for (const word of words(text)) {
    const w = stem(word);
    for (const [category, list] of Object.entries(CATEGORY_WORDS)) if (list.includes(word) || list.includes(w)) return category;
  }
  return null;
}

/** Observed populations for a category. source: blizzard (default), lowpolyworks or hive. */
export function categoryNorms(category, source = 'blizzard') {
  return DATA.categories.find(c => c.category === category && c.source === source) || null;
}

const FACTION_WORDS = {
  'lpw-warriors-of-chaos': ['chaos', 'khorne', 'nurgle', 'tzeentch', 'slaanesh', 'undivided', 'daemon', 'kurgan'],
  'lpw-vampire-counts': ['vampire', 'necromancer', 'wight', 'graveguard', 'carstein', 'strigoi', 'necrarch', 'blood dragon'],
  'lpw-the-empire': ['empire', 'halberdier', 'handgunner', 'reiksguard', 'swordsman', 'estalian'],
  'lpw-bretonnia': ['bretonnia', 'bretonnian', 'grail'],
  'lpw-dwarfs': ['dwarf', 'dwarfs', 'dwarven', 'dawi'],
  'lpw-skaven': ['skaven', 'ratmen', 'ratling', 'stormvermin', 'clanrat', 'warp'],
  'lpw-lizardmen': ['lizardmen', 'lizard', 'saurus', 'skink', 'kroxigor', 'slann'],
  'lpw-beastmen': ['beastmen', 'beastman', 'gor', 'ungor', 'bestigor', 'minotaur', 'bray'],
  'lpw-dark-elves': ['dark elf', 'dark elves', 'druchii', 'naggaroth'],
  'lpw-orcs-and-goblins': ['greenskin', 'black orc', 'goblin', 'night goblin'],
  'warcraft-human': ['human', 'footman', 'knight', 'paladin', 'alliance', 'rifleman', 'priest', 'sorceress'],
  'warcraft-orc': ['orc', 'orcish', 'grunt', 'horde', 'tauren', 'troll', 'shaman', 'raider'],
  'warcraft-undead': ['undead', 'scourge', 'ghoul', 'skeleton', 'lich', 'abomination', 'death knight', 'banshee', 'crypt'],
  'warcraft-nightelf': ['night elf', 'nightelf', 'druid', 'huntress', 'dryad', 'sentinel'],
  'warcraft-elf-commoner': ['blood elf', 'high elf', 'elven', 'elf'],
  'warcraft-naga': ['naga', 'siren', 'murloc', 'sea'],
  'warcraft-demons': ['demon', 'demonic', 'fel', 'infernal', 'dreadlord', 'burning legion', 'satyr'],
  'warcraft-creeps-humanoid': ['bandit', 'gnoll', 'kobold', 'ogre', 'mercenary', 'brigand'],
  'warcraft-creeps-creature': ['creature', 'beast', 'dragon', 'spider', 'wolf', 'bear', 'golem', 'elemental'],
  'warcraft-critters': ['critter', 'sheep', 'pig', 'chicken', 'rabbit', 'frog', 'deer'],
};
/** Faction and army style profiles, Warcraft and LowPolyWorks, that the words name. */
export function findFactions(query, { limit = 2 } = {}) {
  const text = ' ' + String(query || '').toLowerCase().replace(/[^a-z ]+/g, ' ') + ' ';
  return DATA.factions
    .map(f => ({ f, score: (FACTION_WORDS[f.id] || []).filter(w => text.includes(' ' + w + ' ') || text.includes(' ' + w + 's ')).length * 2 + (f.kind === 'lowpolyworks' ? 0.5 : 0) }))
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.f);
}

/** Painting observations of the custom LowPolyWorks sheets (Gluma, HerrDave), for when new paint is needed. */
export function findPainting(query, { limit = 3 } = {}) {
  const groups = terms(query);
  return DATA.painting
    .map(p => ({ p, score: groups.reduce((s, g) => s + (p.tags.some(t => has(t, g)) ? 2 : 0) + (has(p.observation, g) ? 1 : 0), 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.p);
}

/** Study chapters for the words, best first: { id, title }. Read one with chapter(id). */
export function findChapters(query, { limit = 3 } = {}) {
  const groups = terms(query);
  return DATA.chapters
    .map(c => {
      const head = (c.id + ' ' + c.title).toLowerCase().replaceAll('-', ' ');
      let score = 0;
      for (const g of groups) score += (has(head, g) ? 5 : 0) + Math.min(3, g.reduce((n, v) => n + (c.text.toLowerCase().split(v).length - 1), 0) / 4);
      return { c, score };
    })
    .filter(x => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => ({ id: x.c.id, title: x.c.title }));
}
export const chapterList = () => DATA.chapters.map(c => ({ id: c.id, title: c.title }));
export function chapter(id) {
  const c = DATA.chapters.find(x => x.id === id);
  if (!c) throw Error(`Unknown chapter ${id}. Use chapterList() or findChapters(words).`);
  return c.text;
}

// The box of parts: recognisable parts of game models (src/sd-parts-data.js, built by
// scripts/sd-knowledge/build-parts.mjs), each found again in the installed game by loading it.
const PART_KIND_WORDS = {
  weapon: ['weapon', 'sword', 'blade', 'axe', 'hammer', 'mace', 'club', 'spear', 'staff', 'bow', 'glaive', 'warglaive', 'polearm', 'cleaver', 'dagger', 'knife', 'haft', 'hilt', 'scythe', 'lance', 'halberd', 'flail', 'maul', 'rifle', 'gun', 'frostmourne', 'doomhammer', 'gorehowl'],
  helmet: ['helmet', 'helm', 'hood', 'headdress', 'crown', 'visor', 'crest', 'cowl', 'cap'],
  shield: ['shield', 'buckler'],
  head: ['head', 'face', 'skull'],
  horn: ['horn', 'horns', 'spike', 'spikes', 'tusk', 'tusks', 'fang', 'fangs', 'antler'],
  hair: ['hair', 'beard', 'moustache', 'mustache', 'mane', 'ponytail'],
  armour: ['pauldron', 'pauldrons', 'shoulder', 'armour', 'armor', 'bracer', 'gauntlet', 'greave', 'boot', 'collar'],
  cloth: ['cape', 'cloak', 'robe', 'sleeve'],
};
const modelOf = id => PARTS.models.find(m => m.id === id);
const partEntry = p => { const m = modelOf(p.model); return { ...p, id: `${p.model}:${p.geoset}:${p.piece}`, name: m?.name || p.model, path: m?.path }; };
const kindOfWords = list => Object.entries(PART_KIND_WORDS).find(([, ws]) => list.some(w => ws.includes(w) || ws.includes(stem(w))))?.[0] || null;
// Words that name a faction or a rank rather than one model never narrow the search to a model.
const SHARED_NAME_WORDS = new Set(['orc', 'orcs', 'human', 'undead', 'demon', 'elf', 'elves', 'night', 'dark', 'chaos', 'fel', 'skeletal', 'lord', 'hero', 'king', 'with', 'form', 'foot', 'paladin', 'death']);
const nameWords = m => m.name.toLowerCase().split(/[^a-z']+/).filter(w => w && !SHARED_NAME_WORDS.has(w));
const namedModels = list => PARTS.models.filter(m => list.includes(m.id) || list.some(w => w.length > 2 && nameWords(m).includes(w)));

/** Parts of game models that match the words, best first: { id, name, path, geoset, piece, triangles,
 * size, center, bone, kind, label, family?, material?, textures, check }. A model name in the words
 * ("grunt head", "arthas sword") limits the search to that model; kind: weapon, helmet, shield, head,
 * horn, hair, armour, cloth, body, ornament or other. Load the model (mdlxl_assets game reference) and
 * select the piece with sd-kitbash select(model, entry). */
export function findParts(query, { kind, model, limit = 8 } = {}) {
  const list = words(query), groups = terms(query);
  kind ||= kindOfWords(list);
  const named = namedModels(list), faction = list.find(w => PARTS.models.some(m => m.faction === w));
  const scored = [];
  for (const p of PARTS.parts) {
    if (kind && p.kind !== kind) continue;
    if (model && p.model !== model && modelOf(p.model)?.name.toLowerCase() !== String(model).toLowerCase()) continue;
    if (named.length && !named.some(m => m.id === p.model)) continue;
    // A model named by its own id (grunt) outranks one that only shares the word (Chaos Grunt).
    let score = named.length ? 4 + (list.includes(p.model) ? 3 : 0) : 0;
    const text = `${p.label} ${p.family || ''} ${p.material || ''}`.toLowerCase();
    for (const g of groups) score += has(text, g) ? 3 : 0;
    // The very word asked for (sword, not only blade) and the faction asked for count extra.
    for (const w of list) score += new RegExp(`\\b${w}`).test(text) ? 2 : 0;
    if (faction && modelOf(p.model)?.faction === faction) score += 2;
    score += Math.min(2, p.triangles / 60) + (p.check.startsWith('picture') ? 0.5 : 0);
    if (score >= 3 || (kind && score > 0)) scored.push({ p, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(x => partEntry(x.p));
}
/** One box-of-parts entry by its id ('grunt:7:0' = model id, geoset, piece), with its model path. */
export function part(id) {
  const [model, geoset, piece] = String(id).split(':'), p = PARTS.parts.find(x => x.model === model && x.geoset === Number(geoset) && x.piece === Number(piece));
  if (!p) throw Error(`No part ${id} in the box of parts; find one with findParts(words).`);
  return partEntry(p);
}
/** Every listed part of one game model (by id like 'grunt' or its name). */
export const partsOf = model => PARTS.parts.filter(p => p.model === model || modelOf(p.model)?.name.toLowerCase() === String(model).toLowerCase()).map(partEntry);

/** Game models to start a kitbash from for the words (units and heroes): { id, name, path, faction,
 * category, triangles, bones, height, sheets, parts: { kind: count } }. */
export function findBases(query, { limit = 6 } = {}) {
  const list = words(query), hero = guessCategory(query) === 'hero';
  return PARTS.models
    .filter(m => m.category === 'unit' || m.category === 'hero')
    .map(m => ({ m, listed: PARTS.parts.filter(p => p.model === m.id).length, score: list.reduce((s, w) => s + (m.id === w || nameWords(m).includes(w) ? 5 : m.faction === w || m.faction === stem(w) ? 2 : 0), 0) + (m.category === (hero ? 'hero' : 'unit') ? 0.5 : 0) }))
    .filter(x => x.score > 1)
    // Ties go to the models whose parts are mapped best (the research's reviewed units).
    .sort((a, b) => b.score - a.score || b.listed - a.listed)
    .slice(0, limit)
    .map(({ m }) => ({ ...m, parts: PARTS.parts.filter(p => p.model === m.id).reduce((c, p) => ({ ...c, [p.kind]: (c[p.kind] || 0) + 1 }), {}) }));
}

// Weapon parts that show how Blizzard builds a held weapon: [model id, label start].
const WEAPON_REFERENCES = [['footman', 'Straight sword blade'], ['footman', 'Diamond sword guard'], ['heroblademaster', 'Long sword blade'], ['knight', 'Sword blade'], ['herodeathknight', 'Runed sword'], ['undeadarthas', 'Frostmourne'], ['skeleton', 'Curved sword blade'], ['thecaptain', 'Sword'], ['herochaosblademaster', 'Jagged'], ['doomguard', 'Jagged dark sword'], ['grunt', 'Heavy axe blade'], ['grunt', 'Axe haft'], ['hellscream', 'Gorehowl, notched'], ['heromountainking', 'Rectangular hammer head'], ['heromountainking', 'Wide axe head'], ['thrallmountless', 'Doomhammer'], ['abomination', 'Bloody cleaver'], ['magnataur', 'Polearm blade'], ['heroarchmage', 'Archmage staff'], ['herodemonhunter', 'Crescent glaive blade']];
/** Real weapon parts with their triangles and longest side (units; Footman = 98 tall), for size and
 * construction. A held weapon is measured against these, not against the item population. */
export function weaponReferences() {
  return WEAPON_REFERENCES.map(([model, label]) => PARTS.parts.find(p => p.model === model && p.kind === 'weapon' && p.label.startsWith(label))).filter(Boolean)
    .map(p => ({ ...partEntry(p), length: Math.round(Math.max(...p.size)) }));
}
const WEAPON_WORDS = new Set([...PART_KIND_WORDS.weapon.filter(w => !['weapon', 'haft', 'hilt'].includes(w)), 'falchion', 'sabre', 'saber', 'katana', 'warhammer', 'battleaxe', 'greatsword', 'longsword', 'pike', 'trident']);
/** True when the request is a weapon on its own (not a unit carrying one). */
export function isWeaponRequest(text) {
  const category = guessCategory(text);
  return (!category || category === 'item') && words(text).some(w => WEAPON_WORDS.has(w) || WEAPON_WORDS.has(stem(w)));
}

// Visible triangles and distinct diffuse images of a model, the way the research counted them.
function modelCounts(model) {
  const visible = (model.Geosets || []).map((g, i) => {
    const anim = (model.GeosetAnims || []).find(a => a.GeosetId === i), alpha = anim?.Alpha;
    return { g, hidden: typeof alpha === 'number' && alpha === 0 };
  });
  const sheets = new Set();
  let triangles = 0;
  for (const { g, hidden } of visible) {
    if (hidden) continue;
    triangles += (g.Faces?.length || 0) / 3;
    for (const layer of model.Materials?.[g.MaterialID]?.Layers || []) {
      const t = typeof layer.TextureID === 'number' ? model.Textures?.[layer.TextureID] : null;
      if (t?.Image && !t.ReplaceableId) sheets.add(String(t.Image).toLowerCase());
    }
  }
  return { triangles: Math.round(triangles), sheets: sheets.size };
}
/** Puts the model's triangles and texture sheets next to the observed Blizzard (and LowPolyWorks) populations of its category. */
export function checkAgainstNorms(model, category) {
  const norm = categoryNorms(category);
  if (!norm) throw Error(`No norms for ${category}. Categories: ${[...new Set(DATA.categories.map(c => c.category))].join(', ')}.`);
  const counts = modelCounts(model), body = norm.bodyTriangles;
  const place = v => (v > body.p90 ? 'above Blizzard p90' : v < body.p10 ? 'below Blizzard p10' : 'within the Blizzard p10–p90 range');
  const lpw = categoryNorms(category, 'lowpolyworks');
  return {
    category, ...counts,
    blizzard: { models: norm.count, bodyTriangles: body, sheets: norm.sheets, kib: norm.kib },
    ...(lpw ? { lowpolyworks: { models: lpw.count, bodyTriangles: lpw.bodyTriangles, sheets: lpw.sheets } } : {}),
    reading: `${counts.triangles} visible triangles, ${place(counts.triangles)} (median ${body.median}); ${counts.sheets} texture sheets (Blizzard median ${norm.sheets.median}). Observed populations, not limits.`,
  };
}

const line = r => `- ${r.sheet} uv [${r.uv.join(', ')}]: ${r.tags.join('; ') || r.label} — used as "${r.label}" on ${r.model} (${r.from}, ${r.tris ?? '?'} tris)${r.tint ? `, tint RGB [${r.tint.join(', ')}]` : ''}${r.team ? ', team-colour layer under its alpha' : ''}`;
const excerpt = (text, max) => {
  const body = text.replace(/^#.*\n+/, '');
  return body.length <= max ? body : body.slice(0, body.lastIndexOf('\n', max) > max * 0.6 ? body.lastIndexOf('\n', max) : max) + '\n…';
};

/** The evidence block the art director receives with a request: norms (or, for a weapon, real weapon
 * parts), faction notes, the box of parts (bases and parts that fit, the owner's BITZ box), real
 * construction, palette areas to start looking at, then as much of the matching study chapters as the
 * budget leaves. bitz: names in the owner's BitsAndParts box. */
export function briefEvidence(text, { existing = false, budget = 11000, bitz = [] } = {}) {
  const fixed = [], weapon = !existing && isWeaponRequest(text), category = guessCategory(text) || (existing ? null : 'item');
  const norm = category && categoryNorms(category), lpw = category && categoryNorms(category, 'lowpolyworks');
  if (weapon)
    fixed.push('Weapon references (Blizzard SD parts; a held weapon is sized and built like these, not like the item population): ' +
      weaponReferences().map(r => `${r.name} ${r.label.toLowerCase()} ${r.triangles} tris, ${r.length} long [${r.id}]`).join('; ') + '. [model:geoset:piece] ids open with know.part(id).');
  else if (norm)
    fixed.push(`Observed ${category} population: Blizzard SD ${norm.count} models, visible body triangles p10/median/p90 ${norm.bodyTriangles.p10}/${norm.bodyTriangles.median}/${norm.bodyTriangles.p90}, diffuse sheets median ${norm.sheets.median}, height ${norm.heightFootman?.median ?? '?'} Footman heights (Footman = ${SD_FOOTMAN_HEIGHT} units).` +
      (lpw ? ` LowPolyWorks ${category}s: median ${lpw.bodyTriangles.median} triangles, ${lpw.sheets.median} sheets.` : ''));
  for (const f of findFactions(text)) fixed.push(`${f.title}:\n` + f.observations.slice(0, 3).map(o => '- ' + (o.length > 420 ? o.slice(0, 420) + '…' : o)).join('\n'));
  const bases = category === 'unit' || category === 'hero' ? findBases(text) : [], parts = findParts(text, { limit: 8 });
  if (bases.length) fixed.push('Bases in the box of parts (game models to start from): ' + bases.map(b => `${b.name} (${b.path}, ${b.triangles} tris, ${b.bones} bones, ${b.height} tall)`).join('; ') + '.');
  if (parts.length) fixed.push('Box of parts for this request (model, part, path, geoset and piece, triangles, size, bone):\n' + parts.map(p => `- ${p.name}: ${p.label}, ${p.path} geoset ${p.geoset} piece ${p.piece}, ${p.triangles} tris, size ${p.size.join('x')}, bone ${p.bone}`).join('\n'));
  if (bitz.length) fixed.push(`The owner's BITZ box (the owner's own kitbash parts, loaded with mdlxl_assets source parts): ${bitz.slice(0, 60).join(', ')}.`);
  const families = findFamilies(text, { limit: 3 });
  if (families.length)
    fixed.push('Real parts of this kind (model, label, triangles, distinct positions, cross-section corners at 25/50/75%):\n' + families.map(f => `${f.family} (${f.count} reviewed):\n` + f.members.slice(0, 8).map(m => `- ${m.model} (${m.from}): ${m.label}, ${m.tris} tris, ${m.positions} positions, ${m.shape}${m.sections.length ? `, sections ${m.sections.join('/')}` : ''}${m.materials.length ? `, ${m.materials.join('; ')}` : ''}`).join('\n')).join('\n'));
  const look = words(text).filter(w => SYNONYMS[w] || SYNONYMS[stem(w)]).join(' ') || text;
  const materials = findMaterials(look, { limit: 8 });
  if (materials.length) fixed.push('Palette areas that reviewed models used for this look (where to start looking: the builder previews the sheet and picks the area by what the pixels show; game texture path, uv [u0, v0, u1, v1], top-left origin):\n' + materials.map(line).join('\n'));
  let out = fixed.join('\n\n');
  if (out.length > budget) return out.slice(0, budget) + '\n…';
  // Chapters fill what is left: the subject chapters first, the category chapter last.
  const categoryChapter = category && !weapon && DATA.chapters.find(c => c.id === `categories/${category}s`);
  const subjects = findChapters(text + ' ' + families.map(f => f.family.replaceAll('-', ' ')).join(' '), { limit: 3 })
    .filter(c => c.id !== categoryChapter?.id).slice(0, 2).map(c => DATA.chapters.find(x => x.id === c.id));
  const list = [...subjects, ...(categoryChapter ? [categoryChapter] : [])], room = budget - out.length - 80;
  if (list.length && room > 600) {
    const share = Math.floor(room / list.length);
    out = 'Study chapters (observations from real models):\n' + list.map(c => `## ${c.title} [${c.id}]\n${excerpt(c.text, share - c.title.length - c.id.length - 12)}`).join('\n\n') + '\n\n' + out;
  }
  return out.length > budget ? out.slice(0, budget) + '\n…' : out;
}
