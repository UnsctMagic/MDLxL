// Test fixtures, the game folder and temporary folders, in one place (see docs/PACKAGED-TESTS.md#shared-helper).
// scripts/run-packaged-tests.mjs reads the same table, so a harness and the runner always agree on a path.
const fs = require('node:fs'), path = require('node:path');

const root = path.resolve(__dirname, '../..');
const out = (...parts) => path.join(root, 'out', ...parts);
// The permanent test-model collection, kept outside Git (Blizzard, LowPolyWorks and the owner's own models; its
// README lists them). Every real model a test opens comes from here, never from Downloads, Desktop or out/.
const modelsRoot = (env = process.env) => path.resolve(env.MDLXL_TEST_MODELS || 'D:/Claude/MDLxL-TestModels');
const testModel = (...parts) => path.join(modelsRoot(), ...parts);

// name: [override variable, default path or null when there is no default]
const FIXTURES = {
  'glow-eye-effect': ['MDLXL_GLOW_EYE_MODEL', testModel('glow-up/WH_VC_ZombieDragonVCarstein02.mdx')],
  'glow-dual-weapon': ['MDLXL_GLOW_DUAL_MODEL', testModel('WH_WOC_WarriorSlaaneshDual01.mdx')],
  'optimizexl-exact-unit': ['MDLXL_EXACT_UNIT', testModel('optimizexl-exact-cleanup/before/WH_WOC_KnightSlaaneshChampionUnit03_1.mdx')],
  'optimizexl-exact-hero': ['MDLXL_EXACT_HERO', testModel('optimizexl-exact-cleanup/before/WH_WOC_KnightSlaaneshChampionHero03_1.mdx')],
  'optimizexl-pivots': ['MDLXL_OPTIMIZEXL_PIVOTS_MODEL', testModel('optimizexl-pivots/WH_WOC_KnightKhroneBStandard01_FIXED.mdx')],
  'ribbon-attachment': ['MDLXL_RIBBON_MODEL', testModel('ribbon-direction/WH_WOC_KnightSlaaneshChampion01_fix_v3.mdx')],
  footman: ['MDLXL_SUITE_FOOTMAN', testModel('pose/Footman.mdx')], // SD Footman 1800 with Textures/ beside it
  'citadel-footman': ['MDLXL_SUITE_CITADEL_FOOTMAN', testModel('citadel-fixture/Footman.mdx')], // classic MDX800 Footman
  'forge-hd-footman': ['MDLXL_FORGE_HD_FOOTMAN', testModel('forge-hd/Footman.mdx')], // native Reforged HD, skin + tangents
  'particle-index': ['MDLXL_PARTICLE_INDEX', out('particle-index/particles')],
  'optimizexl-review': ['MDLXL_OPTIMIZEXL_REVIEW_MODEL', testModel('optimizexl-review/WH_WOC_KnightKhorneFlail03.mdx')],
  archer: ['MDLXL_SUITE_ARCHER', testModel('material-fixture/Mecha-CL.mdx')], // geoset 4 uses Materials[4] (3 layers), 11+ textures
  effect: ['MDLXL_EFFECT_MODEL', testModel('effect-fixture/WH_WOC_KnightKhorneFlail03.mdx')],
  hoofprint: ['MDLXL_SUITE_HOOFPRINT', testModel('corpus-sd/human__knight.mdx')],
  'slaanesh-champion': ['MDLXL_SLAANESH_CHAMPION', testModel('WH_WOC_KnightSlaaneshChampion01.mdx')], // rider under a Death root, horse beside it
  'sd800-sheep': ['MDLXL_SD800_SHEEP', testModel('corpus-sd800/critters__sheep.mdx')], // a second Bone Namer run used to rename Bone_Foot_L
  'sd800-archnathid': ['MDLXL_SD800_ARCHNATHID', testModel('corpus-sd800/creeps__archnathid.mdx')], // right arm ends at the attachment Hand Right Ref
  'sd-bandit': ['MDLXL_SD_BANDIT', testModel('corpus-sd/creeps__bandit.mdx')], // HandRight (a mesh node) is gripped by its skin on +Y
  raider: ['MDLXL_RAIDER', testModel('bone-namer/Raider.mdx')], // owner's wolf rider: renamed helpers, badly named mesh pieces on each joint
  'sd-orc-wolfrider': ['MDLXL_SD_ORC_WOLFRIDER', testModel('corpus-sd/orc__wolfrider.mdx')], // rightfoot is gripped by its skin at Y -22.9
  lahmian: ['MDLXL_LAHMIAN', testModel('corpse-fixtures/Lahmian_SD_14.mdx')], // two bodies (Caspette portrait rig, Root sway), cloth chains
};

// Absolute path of a named fixture, or null when it has no default and its variable is not set.
function fixturePath(name, env = process.env) {
  const entry = FIXTURES[name];
  if (!entry) throw Error(`Unknown fixture "${name}". Known: ${Object.keys(FIXTURES).join(', ')}`);
  const value = env[entry[0]] || entry[1];
  return value ? path.resolve(value) : null;
}

// The Warcraft III folder: MDLXL_GAME_FOLDER, else the first CASC install the app's own discovery finds,
// else D:/Warcraft III.
async function gameFolder(env = process.env) {
  if (env.MDLXL_GAME_FOLDER) return path.resolve(env.MDLXL_GAME_FOLDER);
  try {
    const { GameDataDiscovery } = require('../../electron/game-data.cjs');
    const found = (await new GameDataDiscovery().discover())?.cascFolders?.[0];
    if (found) return found;
  } catch { /* discovery is best effort */ }
  return 'D:/Warcraft III';
}

// A new empty folder under MDLXL_TEMP, else this repo's out/tmp (never the system temp folder on C:).
// out/tmp gets a package.json saying CommonJS, so scripts tests write there (fake AI agents, helpers) run as
// they would in the system temp folder instead of inheriting this repo's "type": "module".
function tempDir(prefix = 'mdlxl-', env = process.env) {
  const base = path.resolve(env.MDLXL_TEMP || out('tmp'));
  fs.mkdirSync(base, { recursive: true });
  const scope = path.join(base, 'package.json');
  if (!env.MDLXL_TEMP && !fs.existsSync(scope)) fs.writeFileSync(scope, '{ "type": "commonjs" }\n');
  return fs.mkdtempSync(path.join(base, prefix));
}

module.exports = { FIXTURES, fixturePath, testModel, modelsRoot, gameFolder, tempDir };
