import { parseSlk } from './slk.js';

// The Library's "World Editor Style" tree: units, buildings and spells by race,
// items by class and doodads/destructibles by tileset and category, read from
// the installed game tables (units\*.slk, *skin.txt, worldeditdata.txt) and the
// installed language's strings. Every leaf keeps its own icon and model paths.
export const WORLD_EDITOR_FILES = Object.freeze([
  'units\\unitui.slk', 'units\\unitdata.slk', 'units\\unitskin.txt',
  'units\\abilitydata.slk', 'units\\abilityskin.txt',
  'units\\itemdata.slk', 'units\\itemskin.txt',
  'units\\destructabledata.slk', 'units\\destructableskin.txt',
  'doodads\\doodads.slk', 'doodads\\doodadskins.txt', 'ui\\worldeditdata.txt',
  // Older function tables still hold some icons and art; skin files override them.
  ...['human', 'orc', 'nightelf', 'undead', 'neutral', 'campaign'].map(race => `units\\${race}unitfunc.txt`),
  ...['human', 'orc', 'nightelf', 'undead', 'neutral', 'campaign', 'common', 'item'].map(race => `units\\${race}abilityfunc.txt`),
  'units\\itemfunc.txt',
]);
export const WORLD_EDITOR_ORIGIN_FILES = [...WORLD_EDITOR_FILES,
  'units\\unitabilities.slk', 'units\\unitbalance.slk', 'units\\unitweapons.slk',
  'units\\abilitybuffdata.slk', 'units\\upgradedata.slk', 'units\\upgradeskin.txt',
  ...['human', 'orc', 'nightelf', 'undead', 'neutral', 'campaign'].map(race => 'units\\' + race + 'upgradefunc.txt'),
];
const funcTables = (files, kind) => [...files.keys()].filter(path => path.endsWith(kind + 'func.txt')).reduce((into, path) => parseProfile(files.get(path), into), new Map());
/** Language files are read from the installed locale module: these names, and every units\*strings.txt. */
export const WORLD_EDITOR_STRING_FILES = Object.freeze(['ui\\worldeditstrings.txt', 'ui\\worldeditgamestrings.txt']);
export const isWorldEditorStringFile = path => /^units\\[a-z]*strings\.txt$/i.test(path) || WORLD_EDITOR_STRING_FILES.includes(String(path).toLowerCase());

const RACES = [['human', 'Human'], ['orc', 'Orc'], ['nightelf', 'Night Elf'], ['undead', 'Undead'], ['naga', 'Naga'], ['hostile', 'Neutral Hostile'], ['passive', 'Neutral Passive']];
const ITEM_CLASSES = [['Permanent', 'Permanent'], ['Charged', 'Charged'], ['PowerUp', 'Power Up'], ['Artifact', 'Artifact'], ['Purchasable', 'Purchasable'], ['Campaign', 'Campaign'], ['Miscellaneous', 'Miscellaneous'], ['Equipment', 'Equipment']];
const SPELL_ART = [['casterart', 'Caster'], ['targetart', 'Target'], ['effectart', 'Effect'], ['missileart', 'Missile'], ['areaeffectart', 'Area'], ['specialart', 'Special']];
const empty = value => value == null || value === '' || value === '_' || value === '-';
const truthy = value => Number(value) === 1;

/** Blizzard profile (.txt) sections; later files override earlier keys. */
export function parseProfile(text, into = new Map()) {
  let section = null;
  for (const raw of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const header = /^\[([^\]]+)\]/.exec(line);
    if (header) { const key = header[1].trim(); section = into.get(key) || new Map(); into.set(key, section); continue; }
    const equals = line.indexOf('=');
    if (!section || equals < 1) continue;
    section.set(line.slice(0, equals).trim().toLowerCase(), line.slice(equals + 1).trim());
  }
  return into;
}
const unquote = value => { const text = String(value ?? ''); return text.startsWith('"') ? text.slice(1, text.indexOf('"', 1) > 0 ? text.indexOf('"', 1) : undefined) : text.split(',')[0]; };

/** A model path as listed in the game files: .mdx, numbered variations when numVar > 1. */
export function modelPaths(file, numVar = 1) {
  if (empty(String(file ?? '').trim())) return [];
  const base = String(file).trim().replaceAll('/', '\\').replace(/\.(mdl|mdx)$/i, '');
  const count = Math.max(1, Math.min(16, Number(numVar) || 1));
  return count > 1 ? Array.from({ length: count }, (_, index) => base + index + '.mdx') : [base + '.mdx'];
}
const iconPath = value => empty(value) ? null : unquote(value).replaceAll('/', '\\');

function folder(name, icon = null) { return { name, ...(icon ? { icon } : {}), children: [] }; }
const FOLDER_ORDER = ['Units', 'Buildings', 'Spells', 'Normal', 'Heroes', 'Campaign', 'Campaign heroes', 'Special', 'Item abilities'];
function child(parent, name, icon) { let node = parent.children.find(item => item.children && item.name === name); if (!node) { node = folder(name, icon); const order = FOLDER_ORDER.indexOf(name); if (order >= 0) node.order = order; parent.children.push(node); } return node; }
function prune(node) {
  if (!node.children) return node;
  node.children = node.children.map(prune).filter(item => !item.children || item.children.length);
  node.children.sort((a, b) => Number(!a.children) - Number(!b.children) || (a.order ?? 0) - (b.order ?? 0) || (a.children ? 0 : a.name.localeCompare(b.name)));
  return node;
}

export function visibleWorldEditorRows(nodes,expanded) {
  const rows=[];
  function visit(children,depth) {
    for(const node of children){
      rows.push({key:node.key,depth,name:node.name,node,folder:!!node.children,count:node.total});
      if(node.children && expanded.has(node.key))visit(node.children,depth+1);
    }
  }
  visit(nodes,0);
  return rows;
}
export const worldEditorRaceOrder = RACES.map(([,name])=>name);

/**
 * skin: 'sd' (Classic), 'hd' (Reforged) or 'de' (Forsaken Kingdom).
 * files: Map of lower-case logical path -> text for WORLD_EDITOR_FILES.
 * strings: texts of the installed language's string files (any order).
 */
export function buildWorldEditorCatalog(files, strings = [], { skin: version = 'sd', particleOrigins = false } = {}) {
  // Skin fields can be per game version: Art:sd, file:hd, file:de.
  const field = (section, key) => section?.get(key + ':' + version) ?? section?.get(key);
  const text = path => files.get(path.toLowerCase()) || '';
  const names = new Map(), unitNames = new Map(), westrings = new Map();
  for (const source of strings) {
    parseProfile(source, unitNames);
    for (const [id, section] of parseProfile(source)) {
      if (section.has('name')) names.set(id.toLowerCase(), { name: unquote(section.get('name')), suffix: unquote(section.get('editorsuffix') || '') });
    }
    for (const line of String(source).split(/\r?\n/)) { const match = /^(WESTRING_[A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (match) westrings.set(match[1], match[2].replace(/^"|"$/g, '')); }
  }
  const we = value => westrings.get(String(value)) || String(value || '').replace(/^WESTRING_/, '').replaceAll('_', ' ');
  const label = (id, fallback) => { const entry = names.get(String(id).toLowerCase()); return entry ? entry.name + (entry.suffix ? ' ' + entry.suffix.trim() : '') : fallback || id; };
  const unitLabel = (id, fallback) => {
    // Rawcodes are case-sensitive. Merge partial locale sections before reading
    // per-version names; a hero's class and fixed character name are distinct.
    const entry = unitNames.get(id), value = field(entry, 'name');
    let name = empty(value) ? fallback || id : unquote(value);
    const proper = String(field(entry, 'propernames') ?? '').trim().replace(/^"|"$/g, '').split(',').map(value => value.trim()).filter(value => !empty(value));
    // Melee heroes have random-name pools, not one character identity.
    if (proper.length === 1) name = proper[0];
    const suffix = unquote(field(entry, 'editorsuffix') || '').trim();
    return name + (suffix ? ' ' + suffix : '');
  };
  const root = { name: 'World Editor', children: [] };
  const races = new Map(RACES.map(([key, name], order) => [key, Object.assign(folder(name), { order })]));
  for (const node of races.values()) root.children.push(node);
  const modelIcons = new Map();
  const leaf = (parent, id, name, icon, models) => {
    // The Models tab browses models: icons only label entries in the tree.
    if (!models.length) return;
    const node = { id, name, ...(icon ? { icon } : {}), models };
    if (icon) for (const model of models) if (!modelIcons.has(model.path.toLowerCase())) modelIcons.set(model.path.toLowerCase(), icon);
    parent.children.push(node);
  };

  // Units and buildings.
  const ui = parseSlk(text('units\\unitui.slk')), data = parseSlk(text('units\\unitdata.slk')), unitSkins = parseProfile(text('units\\unitskin.txt'), funcTables(files, 'unit'));
  const abilities = parseSlk(text('units\\abilitydata.slk')), abilitySkins = parseProfile(text('units\\abilityskin.txt'), funcTables(files, 'ability'));
  const list = value => String(value ?? '').split(',').map(part => part.trim()).filter(part => !empty(part));
  const spellArt = (skin, row = {}) => SPELL_ART.flatMap(([key, role]) =>
    list(field(skin, key) ?? row[key]).flatMap(value => modelPaths(value).map(path => ({ label: role, path }))));
  const objects = [];
  const table = name => particleOrigins ? parseSlk(text('units\\' + name + '.slk')) : new Map();
  const unitAbilities = table('unitabilities'), balance = table('unitbalance'), weapons = table('unitweapons');
  const buffs = table('abilitybuffdata'), upgrades = table('upgradedata');
  const upgradeSkins = particleOrigins && parseProfile(text('units\\upgradeskin.txt'), funcTables(files, 'upgrade'));
  const grouped = (models, title, kind) => models.map(({ path, label }) => ({ path, group: title, role: label, kind }));
  const artFields = (fields, skin, row) => fields.flatMap(key => list(field(skin, key) ?? row?.[key]).flatMap(value => modelPaths(value)));
  const abilityCache = new Map();
  function abilityArt(id) {
    if (abilityCache.has(id)) return abilityCache.get(id);
    const row = abilities.get(id) || {}, skin = abilitySkins.get(id), title = label(id, row.comments);
    const result = grouped(spellArt(skin, row), title, 'ability');
    // Each level can introduce a new buff, effect or summoned unit.
    for (const [key, value] of Object.entries(row)) {
      if (/^(BuffID|EfctID)\d+$/i.test(key)) for (const ref of list(value)) {
        const name = label(ref, field(unitNames.get(ref), 'bufftip') || buffs.get(ref)?.comments?.trim());
        result.push(...grouped(spellArt(abilitySkins.get(ref)), title, 'buff').map(art => ({ ...art, buff: name })));
      }
      if (/^UnitID\d+$/i.test(key)) for (const ref of list(value)) {
        const models = modelPaths(field(unitSkins.get(ref), 'file') || ui.get(ref)?.file);
        result.push(...models.map(path => ({ path, group: title, role: unitLabel(ref, ui.get(ref)?.name), kind: 'ability' })));
      }
    }
    const decorated=result.map(art=>({...art,icon:iconPath(field(skin,'art'))}));
    abilityCache.set(id, decorated);
    return decorated;
  }
  const object = (id, name, icon, folders, art) => objects.push({ id, name, icon, folders, art });
  for (const [id, row] of ui) {
    if (!truthy(row.inEditor) || truthy(row.hiddenInEditor)) continue;
    const race = String(data.get(id)?.race || '').toLowerCase(), skin = unitSkins.get(id) || new Map();
    const key = ['human', 'orc', 'nightelf', 'undead', 'naga'].includes(race) ? race : race === 'creeps' ? (String(row.hostilePal) === '0' ? 'passive' : 'hostile') : String(row.hostilePal) === '1' ? 'hostile' : 'passive';
    const building = /structure/i.test(String(data.get(id)?.targType || '')), hero = /^[A-Z]/.test(id), campaign = truthy(field(skin, 'campaign') ?? row.campaign), special = truthy(field(skin, 'special') ?? row.special);
    const group = child(races.get(key), building ? 'Buildings' : 'Units');
    const kind = special ? 'Special' : campaign ? (hero && !building ? 'Campaign heroes' : 'Campaign') : hero && !building ? 'Heroes' : 'Normal';
    const models = modelPaths(field(skin, 'file') || row.file).map(path => ({ label: 'Model', path }));
    const name = unitLabel(id, row.name), icon = iconPath(field(skin, 'art'));
    leaf(child(group, kind), id, name, icon, models);
    if (particleOrigins) {
      const art = grouped(models, 'Model', 'model');
      const portrait = field(skin, 'portrait') ?? row.portrait;
      const portraits = portrait ? modelPaths(portrait) : models.map(model => model.path.replace(/\.mdx$/i, '_portrait.mdx'));
      for (const path of portraits) art.push({ path, group: 'Model', role: 'Portrait', kind: 'model' });
      for (const path of artFields(['missileart','missileart_1','missileart_2','missileart1','missileart2'], skin, weapons.get(id)))
        art.push({ path, group: 'Attack/Missile', role: 'Missile', kind: 'attack' });
      for (const path of artFields(['specialart','deathart'], skin, row))
        art.push({ path, group: 'Death/Special', role: 'Special', kind: 'death' });
      const ability = unitAbilities.get(id);
      for (const ref of new Set([...list(ability?.abilList), ...list(ability?.heroAbilList), ...list(field(skin,'abilskinlist')), ...list(field(skin,'heroabilskinlist'))]))
        art.push(...abilityArt(ref));
      for (const ref of list(balance.get(id)?.upgrades)) art.push(...grouped(spellArt(upgradeSkins.get(ref), upgrades.get(ref)), label(ref, upgrades.get(ref)?.comments), 'upgrade'));
      const type = building ? 'Buildings' : hero ? 'Heroes' : 'Units';
      const folders = [type, races.get(key).name];
      if (kind !== type) folders.push(kind);
      object(id, name, icon, [folders], art);
    }
  }
  // Spells: race abilities by unit and hero; item abilities live with items.

  const items = Object.assign(folder('Items'), { order: 20 }); root.children.push(items);
  for (const [id, row] of abilities) {
    if (!truthy(row.useInEditor)) continue;
    const race = String(row.race || '').toLowerCase(), skin = abilitySkins.get(id) || new Map();
    const parent = truthy(row.item) ? child(items, 'Item abilities')
      : child(child(races.get(['human', 'orc', 'nightelf', 'undead', 'naga'].includes(race) ? race : race === 'creeps' ? 'hostile' : 'passive'), 'Spells'), truthy(row.hero) ? 'Heroes' : 'Normal');
    const models = spellArt(skin);
    leaf(parent, id, label(id, row.comments || id), iconPath(field(skin, 'art')), models);
  }
  // Items by class.
  const itemData = parseSlk(text('units\\itemdata.slk')), itemSkins = parseProfile(text('units\\itemskin.txt'), funcTables(files, 'item')), classes = new Map(ITEM_CLASSES);
  for (const [id, row] of itemData) {
    const skin = itemSkins.get(id) || new Map(), itemClass = classes.get(String(row.class)) || 'Miscellaneous';
    const models = modelPaths(field(skin, 'file') || row.file).map(path => ({ label: 'Model', path }));
    const name = label(id, row.comment || id), icon = iconPath(field(skin, 'art'));
    leaf(child(items, itemClass), id, name, icon, models);
    if (particleOrigins) object(id, name, icon, [['Items', itemClass]], [...grouped(models, 'Model', 'model'), ...list(row.abilList).flatMap(abilityArt)]);
  }
  // Doodads and destructibles: tileset, then category, as the editor's palettes show them.
  const worldEdit = parseProfile(text('ui\\worldeditdata.txt'));
  const tilesetKeys = new Map([...(worldEdit.get('TileSets') || new Map())].map(([key, value]) => [key.toLowerCase(), we(value.split(',')[0])]));
  const categories = new Map([...(worldEdit.get('DoodadCategories') || new Map()), ...(worldEdit.get('DestructibleCategories') || new Map())].map(([key, value]) => { const [name, icon] = value.split(','); return [key.toLowerCase(), { name: we(name), icon: icon ? icon.trim() + '.blp' : null }]; }));
  const doodads = Object.assign(folder('Doodads'), { order: 30 }); root.children.push(doodads);
  for (const [order, name] of [...tilesetKeys.values()].entries()) child(doodads, name).order = order;
  const tilesetNode = key => { const name = tilesetKeys.get(key.toLowerCase()); return name ? child(doodads, name) : null; };
  const place = (type, id, row, skin, name) => {
    const category = categories.get(String(row.category || '').toLowerCase()) || { name: 'Other', icon: null };
    const keys = String(row.tilesets || '').split(',').map(value => value.trim()).filter(Boolean);
    const targets = keys.includes('*') ? [...tilesetKeys.keys()] : keys;
    const models = modelPaths(field(skin, 'file') || row.file, field(skin, 'numvar') || row.numVar).map((path, index, list) => ({ label: list.length > 1 ? 'Variation ' + (index + 1) : 'Model', path }));
    if (particleOrigins) {
      const folders = targets.map(key => [type, tilesetKeys.get(key.toLowerCase()) || key, category.name]);
      object(id, name, category.icon, folders.length ? folders : [[type, category.name]], grouped(models, 'Model', 'model'));
    }
    for (const key of targets) { const tileset = tilesetNode(key); if (tileset) leaf(child(tileset, category.name, category.icon), id, name, category.icon, models); }
  };
  const doodadSkins = parseProfile(text('doodads\\doodadskins.txt'));
  for (const [id, row] of parseSlk(text('doodads\\doodads.slk'))) { const skin = doodadSkins.get(id) || new Map(); place('Doodads', id, row, skin, we(field(skin, 'name') || row.Name) || row.comment || id); }
  const destructableSkins = parseProfile(text('units\\destructableskin.txt'));
  for (const [id, row] of parseSlk(text('units\\destructabledata.slk'))) { const skin = destructableSkins.get(id) || new Map(); place('Destructibles', id, row, skin, we(field(skin, 'name') || row.Name) || id); }
  return { ...(particleOrigins ? { objects } : {}), root: prune(root), modelIcons: Object.fromEntries(modelIcons) };
}
