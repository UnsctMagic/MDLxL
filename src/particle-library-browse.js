import {gamePathKey} from './game-path.js';

export const appearanceTypes = ['Fire','Smoke','Sparks','Magic','Glows','Trails','Bursts','Other'];
const modelKey = value => gamePathKey(value).split(':').at(-1).replace(/^\\+/, '').replace(/\.mdl$/, '.mdx');
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const unique = values => [...new Set(values.filter(Boolean))];
const stem = path => String(path || '').split(/[\\/:]/).at(-1).replace(/\.[^.]+$/, '');
const words = value => String(value || '').replace(/Bliz(?:Particle|Ribbon)|Particle ?Emitter/gi,' ')
  .replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/\s+/g,' ').trim();
const sentence = value => value.charAt(0).toUpperCase() + value.slice(1);
const typeEvidence = [
  ['Smoke','smoke',/smoke|steam|mist|dust|cloud|fume/i],
  ['Sparks','sparks',/spark|ember|electric|lightning/i],
  ['Fire','flame',/fire|flame|burn|lava|inferno/i],
  ['Glows','glow',/glow|flare|halo|rays|lightshaft|lensflare/i],
  ['Magic','magic',/rune|magic|spell|arcane|mana|aura|frost|heal/i],
  ['Bursts','burst',/burst|explos|splash|splut|spray|shatter/i],
  ['Trails','trail',/ribbon|trail|streak/i],
];

export function particleAppearance(item, evidence) {
  if (item.categories?.[0] !== 'Other' || item.blocked) return null;
  // Prefer the emitter's own picture, then the authored node name. Its source unit's name
  // alone is insufficient evidence of what a particle looks like.
  for (const clue of [...evidence?.pictures || [], ...(item.sources || []).map(source => source.emitterName)]) {
    const match = typeEvidence.find(([, ,pattern]) => pattern.test(clue || ''));
    if (match) return {categories:[match[0]], noun:match[1]};
  }
  return null;
}

export function particleNamingEvidence(recipe) {
  const p = recipe.native.ParticleEmitters2?.[0] || recipe.native.RibbonEmitters?.[0] || recipe.native.ParticleEmitters?.[0];
  const position = Array.isArray(p?.PivotPoint?.values) ? p.PivotPoint.values : p?.PivotPoint || [];
  const values = p?.ParticleScaling?.values instanceof Array ? p.ParticleScaling.values : p?.ParticleScaling;
  return {
    pictures:unique(recipe.dependencies.filter(dep => dep.kind === 'texture').map(dep => stem(dep.path))),
    model:recipe.native.Info?.Name, size:values?.[0] ?? p?.HeightAbove, endSize:values?.[2],
    height:position[2], side:position[1], depth:position[0], life:p?.LifeSpan, speed:typeof p?.Speed === 'number' ? p.Speed : undefined,
  };
}

// Group legacy suggestions that differ only in punctuation, plural or an emitter number.
export const similarName = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s#_-]*\d+$/,'')
  .replace(/\b(particle|burst|streak|trail)s\b/g,'$1').replace(/[^\p{L}\p{N}]/gu,'');
const keyOf = value => value.trim().toLowerCase();
function collisions(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const k = key(row.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(row);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

export function distinctParticleNames(entries, origins, evidence, reviewFor = () => null) {
  const changes = {}, rows = entries.map(item => {
    const review = reviewFor(item), fixed = !!review || ['reviewed','user-reviewed'].includes(item.naming?.state);
    const appearance = !fixed && particleAppearance(item, evidence.get(item.id));
    if (appearance) changes[item.id] = { categories:appearance.categories };
    return { item, fixed, name:review?.name || item.name, appearance };
  }).sort((a,b) => compare(a.item.id,b.item.id));
  for (const group of collisions(rows, similarName)) for (const row of group) {
    if (row.fixed) continue;
    const {item} = row, source = [...(item.sources || [])].sort((a,b) => compare(a.physicalPath,b.physicalPath))[0];
    const authored = source?.emitterName || item.aliases?.find(alias => !/[:\\/]/.test(alias));
    const origin = origins.get(item.id), model = sentence(words(stem(evidence.get(item.id)?.model || origin?.path || source?.physicalPath)));
    const picture = words(evidence.get(item.id)?.pictures?.[0]);
    const node = words(authored).replace(/^\d+\s*/, '').replace(/\d+$/, '').trim();
    const look = row.appearance ? [item.tags?.find(tag => /^(red|green|blue|pale|golden|purple)$/.test(tag)),row.appearance.noun].filter(Boolean).join(' ') : item.name.replace(/ group$/i,'').toLowerCase();
    const base = sentence(look) + (origin?.name || model ? ' · '+(origin?.name || model) : '');
    const directory = modelKey(source?.physicalPath).split('\\')[0];
    const sourceType = {buildings:'building', doodads:'doodad', units:'unit', cinematics:'cinematic'}[directory];
    row.name = base + (item.grouping ? ' · layered' : '');
    const stats = evidence.get(item.id);
    row.stats = stats;
    row.qualifiers = unique([look, node, picture.replace(/\d+$/, '').trim(), model, sourceType, ...(stats ? [['size',stats.size],['lifespan',stats.life],['speed',stats.speed],['end size',stats.endSize],['height',stats.height],['side',stats.side],['depth',stats.depth]].map(([label,n]) => Number.isFinite(n) ? label+' '+Number(n.toFixed(2)) : '') : []),
      words(stem(source?.physicalPath)), words(authored), source?.physicalPath?.split(':').slice(1,-1).join(' ').replace(/[_\\]/g,' ').replace(/\.w3mod/g,'').trim(),
      /^\D*\d+$/.test(authored || '') ? (/ribbon/i.test(authored)?'ribbon ':'emitter ')+authored.match(/\d+$/)[0] : '']);
  }
  // Add the first piece of evidence that actually distinguishes siblings. Keep verified
  // names reserved, and only number entries left identical after exhausting every clue.
  for (let depth=0; depth<16; depth++) {
    let changed = false;
    for (const group of collisions(rows,keyOf)) {
      const editable = group.filter(row => !row.fixed);
      for (const row of editable) {
        // Prefer plain relative descriptions to numerical measurements of siblings.
        const relative = [];
        for (const [field,low,high] of [['size','smaller','larger'],['life','short-lived','long-lived'],['speed','slower','faster'],
          ['height','lower','upper'],['side','left','right'],['depth','back','front']]) {
          const values=editable.map(other=>other.stats?.[field]).filter(Number.isFinite);
          if(values.length<2 || Math.max(...values)-Math.min(...values)<0.1)continue;
          if(row.stats?.[field]===Math.min(...values))relative.push(low);
          if(row.stats?.[field]===Math.max(...values))relative.push(high);
        }
        const semantic=row.qualifiers?.filter(value=>!/\d/.test(value)) || [];
        const distinguishes=value=>editable.length===1 || editable.some(other=>!other.qualifiers?.includes(value));
        const clue = semantic.find(value=>!row.name.toLowerCase().includes(value.toLowerCase()) && distinguishes(value))
          || relative.find(value=>!row.name.includes(' · '+value))
          || row.qualifiers?.find(value => !row.name.toLowerCase().includes(value.toLowerCase())
          && (editable.length === 1 || editable.some(other => !other.qualifiers?.includes(value))));
        if (!clue) continue;
        row.name = row.name.slice(0,Math.max(1,116-Math.min(56,clue.length)))+' · '+clue.slice(0,56);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const used = new Set(rows.map(row => keyOf(row.name)));
  for (const group of collisions(rows,keyOf)) {
    let n=1;
    for(const row of group.filter(row=>!row.fixed)){
      const base=row.name.slice(0,100);
      do { row.name=base+' · variant '+n++; } while(used.has(keyOf(row.name)));
      used.add(keyOf(row.name));
    }
  }
  for (const {item,name,fixed} of rows) if (!fixed && name !== item.name)
    changes[item.id] = {...changes[item.id],name};
  return changes;
}

// Some classic table rows use a sibling folder for the same model (cinematic unit
// models and inventory tomes). Check the full model inventory, including models
// with zero emitters, before resolving a unique sibling under the same parent.
export function resolveParticleArtPaths(objects, physicalPaths) {
  const installed=new Set(), siblings=new Map();
  const sibling=key=>key.replace(/[^\\]+\\([^\\]+)$/,'$1');
  for(const path of physicalPaths){
    if(!/\.(mdx|mdl)$/i.test(path)||/:_(hd|de)\.w3mod:/i.test(path))continue;
    const key=modelKey(path);
    if(installed.has(key))continue;
    installed.add(key);
    const parent=sibling(key);
    siblings.set(parent,siblings.has(parent)?null:key);
  }
  return objects.map(object=>({...object,art:object.art.map(art=>{
    const key=modelKey(art.path);
    if(installed.has(key))return art;
    const variation=key.replace(/\.mdx$/,'0.mdx');
    const isScenery=['Doodads','Destructibles'].includes(object.folders[0]?.[0]);
    const path=isScenery && installed.has(variation)?variation:siblings.get(sibling(key));
    return path?{...art,path}:art;
  })}));
}

export function buildParticleBrowse(objects, entries, evidence = new Map(), reviewFor) {
  const paths = new Map(), buckets = [], linked = new Set(), origins = new Map(), rows = [];
  function index(path, id) {
    if (!paths.has(path)) { paths.set(path,buckets.length); buckets.push(new Set()); }
    buckets[paths.get(path)].add(id);
  }
  for (const item of entries) for (const source of item.sources || []) {
    if (!source.physicalPath || /:_(hd|de)\.w3mod:/i.test(source.physicalPath)) continue;
    const key = modelKey(source.physicalPath);
    index(key,item.id);
    // Classic's versioned unit skins use e.g. Priest_v1 and Priest_v1_portrait.
    const base = key.replace(/_v\d+(?=(_portrait)?\.mdx$)/,'');
    if (base !== key) index(base,item.id);
  }
  for (const {art,...object} of objects) {
    const groups = new Map(), ids = new Set();
    for (const {group,role,kind,buff,path} of art) {
      const key = modelKey(path), bucket = paths.get(key);
      const title = kind === 'model' || kind === 'attack' || kind === 'death' ? group
        : [group,buff && 'Buff · '+buff,role].filter(Boolean).join(' · ');
      if (!groups.has(title)) groups.set(title,new Set());
      if (bucket === undefined || groups.get(title).has(bucket)) continue;
      groups.get(title).add(bucket);
      const name = (kind === 'model' ? object.name + (role === 'Model' ? '' : ' — '+role.toLowerCase())
        : ['attack','death'].includes(kind) ? object.name+' — '+group : group+' — '+(buff ? 'buff ' : '')+role.toLowerCase());
      const rank = ['ability','buff','model','upgrade','attack','death'].indexOf(kind);
      for (const id of buckets[bucket]) {
        ids.add(id); linked.add(id);
        const previous = origins.get(id);
        if (!previous || rank<previous.rank || rank===previous.rank && (name.length<previous.name.length || name.length===previous.name.length && compare(name,previous.name)<0))
          origins.set(id,{name,path,rank});
      }
    }
    if (ids.size) rows.push({...object,count:ids.size,groups:[...groups].map(([title,refs])=>({title,refs:[...refs]}))});
  }
  const other = entries.filter(item => !linked.has(item.id)).map(item => item.id);
  return {objects:rows,buckets:buckets.map(ids=>[...ids]),other,metadata:distinctParticleNames(entries,origins,evidence,reviewFor)};
}
