// What the user sees on screen (window names, toolbar icons, sidebar and UV Wrapper buttons) and the
// engine behind it, so "run Nuclear Weld" or "use OptimizeXL" finds `module.function` for scripts and
// `command` ids for hidden model tabs. Used by the capabilities search and by the "this needs the screen" hint.
// test/ai-screen-names.test.js walks the UI sources and fails when a label here is missing.
//
// names:   what the interface calls it (any spelling in the UI, including its own typos)
// command: the mdlxl_command id that runs it (on screen; those in hidden also run on a model tab not showing)
// engines: `module.function` entries of src, callable through await api.module(module)
// use:     one short sentence when there is no engine or the way in is not obvious
const e = (names, engines, extra = {}) => ({ names, engines, ...extra });
const MESH = 'mesh-actions.applyMeshAction';

export const SCREEN_NAMES = [
  // The sidebar's mesh tools; their command ids are the labels MESH_ACTIONS uses.
  e(['Delete vertices'], [MESH, 'editor-commands.deleteVertices'], { command: 'Delete vertices', hidden: true }),
  e(['Uncouple vertices', 'Uncouple'], [MESH, 'classic-mesh.uncoupleVertices'], { command: 'Uncouple', hidden: true }),
  e(['Mirror in workplane', 'Mirror'], [MESH], { command: 'Mirror', hidden: true, use: 'Optional pivot [x, y, z].' }),
  e(['Extrude 10 units, then move', 'Extrude'], [MESH, 'mesh-tools.extrudeFaces'], { command: 'Extrude', hidden: true, use: 'Optional distance (default 10).' }),
  e(['Detach as new geoset', 'Detach'], [MESH, 'mesh-tools.detachFaces'], { command: 'Detach', hidden: true }),
  e(['Create triangle'], [MESH, 'editor-commands.addTriangle'], { command: 'Create triangle', hidden: true }),
  e(['Delete selected triangles', 'Delete triangles'], [MESH, 'classic-mesh.deleteSelectedFaces'], { command: 'Delete triangles', hidden: true }),
  e(['Collapse', 'Collapse points'], [MESH, 'classic-mesh.collapseVertices'], { command: 'Collapse', hidden: true }),
  e(['Weld', 'Weld points'], [MESH, 'classic-mesh.weldSelectedVertices'], { command: 'Weld', hidden: true }),
  e(['Average selected normals', 'Smooth normals'], [MESH, 'classic-mesh.averageSelectedNormals'], { command: 'Smooth normals', hidden: true }),
  e(['Recalculate geoset normals', 'Restore normals'], [MESH, 'editor-document.recalculateNormals'], { command: 'Restore normals', hidden: true }),
  e(['Reverse normals'], [MESH], { command: 'Reverse normals', hidden: true }),
  e(['Rotate normals'], [MESH], { command: 'Rotate normals', hidden: true, use: 'Optional angle in degrees.' }),
  e(['Cut'], ['mesh-actions.applyCut', 'edge-cut.cutTriangles'], { command: 'Cut', hidden: true, use: 'cut: { geosetIndex, start, a, b, t } or { geosetIndex, start, vertex }.' }),
  // The Geosets list operations.
  e(['Seperate by Loose parts', 'Separate by loose parts', 'Separate'], ['geoset-operations.separateGeosetsByLoosePart'], { command: 'Separate by loose parts', hidden: true }),
  e(['Nuclear', 'Nuclear Seperation', 'Nuclear separation'], ['geoset-operations.nuclearSeparateGeosets'], { command: 'Nuclear separation', hidden: true }),
  e(['Delete free vertices'], ['geoset-operations.deleteFreeVertices'], { command: 'Delete free vertices', hidden: true }),
  e(['Nuclear Weld'], ['geoset-operations.nuclearWeldVertices'], { command: 'Nuclear Weld', hidden: true }),
  e(['Merge Geosets', 'Merge Similar'], ['geoset-operations.mergeSimilarGeosets', 'geoset-operations.geosetMergeConflicts'], { command: 'Merge geosets', hidden: true }),
  e(['NormalsXL'], ['normals-rebuild.rebuildNormals', 'normals-rebuild.fixFacing', 'normals-rebuild.planNormalRebuild']),
  // Modes.
  e(['Vertices'], [], { command: 'vertices', hidden: true, use: 'A view mode: mdlxl_command vertices.' }),
  e(['Bones'], [], { command: 'bones', hidden: true, use: 'A view mode: mdlxl_command bones.' }),
  e(['UV-maps'], [], { command: 'uv', hidden: true, use: 'A view mode: mdlxl_command uv; the UV tools are in uv-actions.' }),
  e(['Movement'], [], { command: 'animation', hidden: true, use: 'The animation mode: mdlxl_command animation; edit keys with the animation modules.' }),
  e(['Animations'], ['sequence-editor.createSequenceFromCurrent'], { use: 'The sequence list; sequence-editor and animation hold the functions.' }),
  // UV Wrapper buttons.
  e(['Select'], ['uv-tools.uvPieces', 'uv-selection.eligibleUVVertices']),
  e(['Move'], [], { use: 'Write the points\' TVertices in mdlxl_script (uv-actions.fitUVsToRegion for a region).' }),
  e(['Rotate'], ['uv-tools.uvTurn'], { use: 'Rotate the marked UV points around their centre in mdlxl_script.' }),
  e(['Zoom'], ['uv-tools.uvZoom'], { use: 'Scale the marked UV points around their centre in mdlxl_script.' }),
  e(['Mirror by X', 'Mirror by Y'], ['uv-actions.flipUVs']),
  e(['Uncouple selected face corners'], ['uv-tools.uncoupleUVVertices']),
  e(['Fold'], ['uv-tools.foldUVCoordinates']),
  e(['Straighten'], ['uv-tools.straightenUVCoordinates']),
  e(['Mirror Copy'], ['uv-tools.mirrorCopyUVCoordinates']),
  e(['Unwrap', 'Box Projection', 'Cylinder Projection'], ['uv-actions.unwrapUVs', 'uv-unwrap.unwrapUVCorners', 'uv-actions.commitUVCornerPlans']),
  e(['Relax'], ['uv-tools.relaxUVCoordinates']),
  e(['Fit'], ['uv-fit.fitUVs']),
  e(['Project from Current View', 'Project UVs from model view'], ['uv-tools.projectUVFromView']),
  e(['Fit to region', 'Pack islands'], ['uv-actions.fitUVsToRegion', 'uv-actions.packUVIslands', 'uv-tools.uvPieces']),
  // Windows and toolbar icons.
  e(['Material and Texture Library', 'Material & Texture Library', 'Texture Library'], ['material-presets.applyMaterialPreset', 'texture-references.visitTextureReferences'], { command: 'textureLibrary' }),
  e(['Team Color Overlay', 'Team Color', 'Color Tint'], ['material-presets.applyMaterialPreset', 'team-colors.TEAM_COLORS']),
  e(['Forge', 'Forge tools'], ['forge-vertex-run.runForgeVertexTool', 'forge-vertex-run.addForgeVertexShape', 'forge-primitives.buildForgePrimitive', 'forge.commitForge'], { command: 'forge' }),
  e(['BitsAndParts', 'Clockwork'], ['bits-and-parts.collectPart', 'bits-and-parts.commitPart'], { command: 'bitsAndParts' }),
  e(['OptimizeXL', 'Insanity Fixer', 'Irregularities Fixer', 'Sphereomancer', 'Nuclear Polygon Destroyer'], ['optimizexl-run.optimizeModelStage', 'optimizexl-run.planToSize', 'optimizexl.runOptimizeStage'], { command: 'optimizeModel' }),
  e(['Emitter Editor', 'Particle Editor', 'EMTR', 'Glow Up'], ['particle-recipes.placeParticleRecipe', 'glow-up.glowUp', 'particle-editing.particlePreviewModel'], { command: 'particles' }),
  e(['Surface Effects', 'FX'], ['global-animation-model.compileAnimation', 'fx-own-looks.stackFromOwnLook', 'fx-tattoo.tattooTriangles'], { command: 'surfaceEffects' }),
  e(['AnimXL'], ['anim-xl.buildAnimXL', 'anim-xl.applyAnimXL', 'anim-xl.ANIMXL_PRESETS'], { command: 'animXL' }),
  e(['Auto Corpse', 'CORP'], ['auto-corpse.autoCorpse', 'corpse-geometry.buildCorpseGeometry'], { command: 'autoCorpse' }),
  e(['Citadel Paint', 'Paint'], ['paint-project.createPaintProject', 'paint-decal.projectPaintDecal', 'paint-materials.applyPaintMaterials'], { command: 'paint' }),
  e(['New base coat'], ['paint-uv-layout.createPaintLayout', 'paint-uv-atlas.createFreshPaintAtlas']),
  e(['Bone Namer'], ['bone-namer.planBoneNames', 'bone-namer.applyBoneNames']),
  e(['Attachemator'], ['attachemator.planAttachments', 'attachemator.applyAttachmentPlan']),
  e(['Sort My Mess'], ['sort-my-mess.applySortMyMess']),
  e(['Sanity Check'], ['sanity-check.checkSanity'], { command: 'sanityCheck' }),
  e(['Showcase'], [], { use: 'A presentation view of the model; nothing to edit.' }),
  e(['Learn', 'AI console', 'Search commands', 'Help', 'Report a problem', 'About'], [], { use: 'Not a model feature.' }),
];

const norm = text => String(text).toLowerCase().replace(/[…]|\.{3}/g, '').replace(/[^a-z0-9]+/g, '');
const KEYS = SCREEN_NAMES.flatMap(entry => entry.names.map(name => [norm(name), entry]));

/** The table entry for an on-screen label: an exact name, or a label that starts with a name of five or more
 * letters ("AnimXL: shape an animation with sliders", "Auto Corpse (test)"). */
export function screenEntryFor(label) {
  const key = norm(label);
  return KEYS.find(([name]) => name === key)?.[1] || KEYS.filter(([name]) => name.length >= 5 && key.startsWith(name)).sort((a, b) => b[0].length - a[0].length)[0]?.[1] || null;
}

/** Entries whose names contain every word of `query`, best (shortest name) first, at most `limit`. */
export function findScreenNames(query, limit = 4) {
  const terms = String(query).toLowerCase().split(/\s+/).map(norm).filter(Boolean);
  if (!terms.length) return [];
  return SCREEN_NAMES
    .map(entry => ({ entry, size: Math.min(...entry.names.filter(name => terms.every(term => norm(name).includes(term))).map(name => norm(name).length), Infinity) }))
    .filter(({ size }) => Number.isFinite(size))
    .sort((a, b) => a.size - b.size)
    .slice(0, limit)
    .map(({ entry }) => ({ names: entry.names, ...(entry.command ? { command: entry.command } : {}), engines: entry.engines, ...(entry.use ? { use: entry.use } : {}) }));
}

/** For "this step needs the screen": the engines of a window command id, in words. */
export function screenEngineHint(commandId) {
  const entry = SCREEN_NAMES.find(item => item.command === commandId && item.engines.length);
  return entry ? entry.engines.join(', ') : null;
}
