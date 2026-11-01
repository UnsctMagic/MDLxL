import { SD_BRAIN_AVAILABLE } from './ai-sd-rules.js';

// Human task names lead to the editor's existing APIs, not duplicate implementations.
export const AI_AREAS = [
  {
    id: 'mesh',
    description:
      'Surgical vertex transforms, duplicate/mirror/weld, extrude, detach, topology, subdivide and reduce density.',
    modules: [
      'ai-mesh',
      'classic-mesh',
      'mesh-tools',
      'mesh-density',
      'geoset-operations',
      'editor-commands',
    ],
  },
  {
    id: 'creation',
    description:
      (SD_BRAIN_AVAILABLE ? 'SD Kit solid hand-painted props (lathe, extrude, spikes, rings, gems; one painted texture), ' : '') +
        'Procedural primitives, Forge construction, detail shaping, combining and fitting reusable parts.',
    modules: [
      ...(SD_BRAIN_AVAILABLE ? ['sd-kit'] : []),
      'forge-primitives',
      'forge',
      'forge-detail-editing',
      'forge-shape-editing',
      'forge-molding',
      'bits-and-parts',
    ],
  },
  {
    id: 'rig',
    description: 'Bones, helpers, hierarchy, pivots, skin weights, hard/soft binding and IK posing.',
    modules: ['bone-tools', 'rig-node-order', 'movement', 'movement-selection', 'pose-ik'],
  },
  {
    id: 'animation',
    description:
      'Sparse keyframes, poses, clips, retiming, interpolation, transfer and secondary motion; sample deformed vertices to verify motion.',
    modules: [
      'animation',
      'ai-motion-compare',
      'animation-tracks',
      'keyframe-timeline',
      'sequence-editor',
      'animation-speed',
      'anim-xl',
    ],
  },
  {
    id: 'uv',
    description: 'UV coordinates, island selection, projection, folding, seams and texture wrapping.',
    modules: ['uv-tools', 'uv-selection', 'uv-preview', 'uv-coordinate-codec'],
  },
  {
    id: 'materials',
    description:
      'Textures, layers, filters, team color, alpha, visibility, animated materials and texture coordinates.',
    modules: ['material-presets', 'texture-references', 'animation-tracks', 'geoset-animation-defaults'],
  },
  {
    id: 'paint',
    description:
      'Citadel Paint brushes, decals, projection, palettes and texture export. Its live working copy is edited through the existing Paint controls; leave Paint normally to apply before model scripts.',
    modules: [
      'paint-project',
      'paint-brushes',
      'paint-decal',
      'paint-projection',
      'paint-materials',
      'paint-export',
    ],
  },
  {
    id: 'effects',
    description:
      'Particle emitters, ribbons, glow, attachment placement, cameras, lights, event objects and collision shapes.',
    modules: [
      'particle-recipes',
      'particle-editing',
      'particle-placement',
      'particle-ribbon-fit',
      'glow-up',
      'editor-commands',
    ],
  },
  {
    id: 'inspection',
    description:
      'Geometry measurements, normals, motion inspection, repair proposals and structural validation; inspect captures as well as numeric results.',
    modules: ['animation', 'ai-motion-compare', 'normals-rebuild', 'motion-inspector', 'optimizexl', 'optimizexl-checker-repairs'],
  },
];

export function aiExportNames(source) {
  const names = new Set(
    [...source.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/g)].map(m => m[1]),
  );
  for (const match of source.matchAll(/\bexport\s*\{([^}]+)\}/g))
    for (const item of match[1].split(',')) {
      const name = item
        .trim()
        .split(/\s+as\s+/)
        .at(-1);
      if (/^\w+$/.test(name)) names.add(name);
    }
  return [...names].sort();
}

// One card per exported function: its arguments and the comment written above
// it, so a lookup says how to call a function without reading its source.
const FUNCTION = /^export\s+(?:async\s+)?function\s+(\w+)\s*\(([^]*?)\)\s*\{/gm;
const cardCache = new Map();
const oneLine = (text, max) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
};
function leadingComment(before) {
  // Only a comment directly above the function, not one across a blank line.
  const lines = before.replace(/\r?\n$/, '').split(/\r?\n/);
  const comment = [];
  if (lines.at(-1)?.trim().endsWith('*/')) {
    while (lines.length) {
      const line = lines.pop();
      comment.unshift(line);
      if (line.includes('/*')) break;
    }
  } else while (lines.length && lines.at(-1).trim().startsWith('//')) comment.unshift(lines.pop());
  return oneLine(comment.join(' ').replace(/\/\*\*?|\*\/|^\s*\*|\s\*\s|\/\//g, ' '), 240);
}
export function aiFunctionCards(source) {
  if (!cardCache.has(source))
    cardCache.set(
      source,
      [...source.matchAll(FUNCTION)].map(match => ({
        name: match[1],
        arguments: oneLine(match[2], 160),
        about: leadingComment(source.slice(Math.max(0, match.index - 2000), match.index)),
      })),
    );
  return cardCache.get(source);
}
const cardLine = (module, card) => `${module}.${card.name}(${card.arguments})${card.about ? ' — ' + card.about : ''}`;

// The functions AI jobs called most in saved chats (owner profile and the
// Demonette study, 2026-10-31). They travel with the fixed editing instructions,
// which providers cache, so common jobs start without a lookup.
export const AI_COMMON_FUNCTIONS = {
  animation: ['sampleNodeMatrices', 'skinGeoset', 'sampleTrack', 'sampleGeosetAnimation', 'allNodes'],
  'pose-ik': ['poseChainBetween', 'samplePoseChain', 'solvePoseLimb'],
  'animation-tracks': ['makeKey'],
  'mesh-tools': ['detachFaces', 'updateBounds'],
  'editor-commands': ['deleteVertices'],
  'editor-document': ['recalculateExtents', 'removeGeosets'],
  'geoset-operations': ['deleteFreeVertices'],
  'classic-mesh': ['weldSelectedVertices'],
  'uv-tools': ['projectUVFromView'],
  'optimizexl-bounds': ['repairBounds'],
  'texture-references': ['visitTextureReferences', 'isTeamColorLayer'],
  'part-bones': ['vertexBones'],
  'node-hierarchy': ['nodeIndex'],
};
const isCommon = (module, name) => AI_COMMON_FUNCTIONS[module]?.includes(name);
export function aiCommonFunctionsText(sources) {
  const lines = Object.entries(AI_COMMON_FUNCTIONS).flatMap(([module, names]) =>
    aiFunctionCards(sources[module] || '')
      .filter(card => names.includes(card.name))
      .map(card => cardLine(module, card)),
  );
  return lines.length
    ? 'Common editor functions, ready to call in mdlxl_script through await api.module(name); look up others with capabilities:\n' + lines.join('\n')
    : '';
}

// The areas a request's words point to, most mentioned first (at most two), for
// direct jobs inferred from their request.
const AREA_WORDS = [
  ['mesh', /\b(vertex|vertices|mesh|geoset|weld|extrude|mirror|split|detach|separate|merge|triangle|face|poly|subdivid|densit|hole|gap)/gi],
  ['creation', /\b(forge|primitive|procedural|lathe|sculpt|prop|bits?\b)/gi],
  ['rig', /\b(bind|binding|bound|weight|skin\b|skinn|rig|bone|pivot|hierarchy|parent|ik\b|helper)/gi],
  ['animation', /\b(animat|walk|attack|stand|death|spell|keyframe|key|retime|pose|sequence|motion|swing|loop|frame)/gi],
  ['uv', /\b(uv|unwrap|wrap|reskin|island|projection|stretch)/gi],
  ['materials', /\b(texture|material|reskin|colou?r|alpha|team|layer|transparen|visibility|filter|shading|tint)/gi],
  ['paint', /\b(paint|brush|decal|palette)/gi],
  ['effects', /\b(particle|emitter|ribbon|glow|light|event|sound|trail|effect|attachment|camera|collision)/gi],
  ['inspection', /\b(normal|measure|inspect|validat|optimi|reduce|smaller)/gi],
];
export function areasForRequest(text) {
  return AREA_WORDS.map(([area, words]) => [area, (String(text).match(words) || []).length])
    .filter(([, hits]) => hits > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([area]) => area);
}

// The functions of the chosen areas, attached to a job once per conversation.
// Documented functions get a card; the rest are named, and capabilities still
// finds anything left out.
export function aiToolPages(sources, areas, { perArea = 5000 } = {}) {
  const seen = new Set(),
    pages = [];
  for (const id of areas) {
    const area = AI_AREAS.find(a => a.id === id);
    if (!area) continue;
    const lines = [];
    let size = 0,
      cut = false;
    for (const module of area.modules) {
      if (seen.has(module) || !sources[module]) continue;
      seen.add(module);
      const cards = aiFunctionCards(sources[module]).filter(card => !isCommon(module, card.name));
      const named = cards.filter(card => !card.about).map(card => card.name);
      for (const line of [
        ...cards.filter(card => card.about).map(card => cardLine(module, card)),
        ...(named.length ? [`${module} also has: ${named.join(', ')}`] : []),
      ]) {
        if (size + line.length > perArea) cut = true;
        else (lines.push(line), (size += line.length + 1));
      }
    }
    if (lines.length)
      pages.push(`${area.id} (${area.description}):\n${lines.join('\n')}${cut ? `\nMore: capabilities area "${area.id}".` : ''}`);
  }
  return pages.length
    ? 'Editor functions for this job, ready to call in mdlxl_script through await api.module(name):\n' + pages.join('\n\n')
    : '';
}

export function searchAiCapabilities(sources, { query = '', area, offset = 0, limit = 30 } = {}) {
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw Error('Use a capability page of 1–100 modules.');
  const selected = area ? AI_AREAS.find(a => a.id === area) : null;
  if (area && !selected) throw Error('Unknown capability area. Request the area list.');
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const rows = Object.entries(sources)
    .map(([module, source]) => ({
      module,
      exports: aiExportNames(source),
      areas: AI_AREAS.filter(a => a.modules.includes(module)).map(a => a.id),
    }))
    .filter(
      row =>
        row.exports.length &&
        (SD_BRAIN_AVAILABLE || row.module !== 'sd-kit') &&
        (!selected || selected.modules.includes(row.module)) &&
        terms.every(term =>
          (row.module + ' ' + row.exports.join(' ') + ' ' + row.areas.join(' ')).toLowerCase().includes(term),
        ),
    )
    .sort((a, b) => a.module.localeCompare(b.module));
  // A search also answers with the matching functions themselves, best match first.
  const functions = terms.length
    ? Object.entries(sources)
        .filter(([module]) => (SD_BRAIN_AVAILABLE || module !== 'sd-kit') && (!selected || selected.modules.includes(module)))
        .flatMap(([module, source]) =>
          aiFunctionCards(source).map(card => {
            const text = (module + ' ' + card.name + ' ' + card.about).toLowerCase();
            return { module, ...card, hits: terms.filter(term => text.includes(term)).length, named: terms.some(term => card.name.toLowerCase().includes(term)) };
          }),
        )
        .filter(card => card.hits)
        .sort((a, b) => b.hits - a.hits || b.named - a.named || !!b.about - !!a.about || a.module.localeCompare(b.module))
        .slice(0, 12)
        .map(({ hits, named, ...card }) => card)
    : undefined;
  return {
    areas: AI_AREAS,
    total: rows.length,
    offset,
    truncated: offset + limit < rows.length,
    modules: rows.slice(offset, offset + limit),
    ...(functions ? { functions } : {}),
    usage:
      'functions lists matching functions with their arguments and what they do, ready to call. Request module by exact name for all its functions with arguments and descriptions. Use mdlxl_script and await api.module(name) for arbitrary combinations in one Undo step. All public src modules remain accessible through api.modules, including those outside these task areas.',
  };
}
