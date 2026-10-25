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
      'Fresh low-poly construction with existing mesh, extrude, mirror and Forge APIs; Warcraft handbook, native texture regions and part measurements. SD Kit is an optional fallback painter.',
    modules: [
      'sd-knowledge',
      'sd-model-metrics',
      'sd-kit',
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
    modules: ['uv-tools', 'uv-selection', 'uv-preview', 'uv-coordinate-codec', 'sd-native-uv', 'sd-native-textures'],
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
    modules: ['animation', 'normals-rebuild', 'motion-inspector', 'optimizexl', 'optimizexl-checker-repairs'],
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
        (!selected || selected.modules.includes(row.module)) &&
        terms.every(term =>
          (row.module + ' ' + row.exports.join(' ') + ' ' + row.areas.join(' ')).toLowerCase().includes(term),
        ),
    )
    .sort((a, b) => a.module.localeCompare(b.module));
  return {
    areas: AI_AREAS,
    total: rows.length,
    offset,
    truncated: offset + limit < rows.length,
    modules: rows.slice(offset, offset + limit),
    usage:
      'Request module by exact name for runtime exports/signatures. Use mdlxl_script and await api.module(name) for arbitrary combinations in one Undo step. All public src modules remain accessible through api.modules, including those outside these task areas.',
  };
}
