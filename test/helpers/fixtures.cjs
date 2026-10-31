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
  footman: ['MDLXL_SUITE_FOOTMAN', testModel('pose/Footman.mdx')], // SD Footman 1800 with Textures/ beside it
  'citadel-footman': ['MDLXL_SUITE_CITADEL_FOOTMAN', testModel('citadel-fixture/Footman.mdx')], // classic MDX800 Footman
  'particle-index': ['MDLXL_PARTICLE_INDEX', out('particle-index/particles')],
  'optimizexl-review': ['MDLXL_OPTIMIZEXL_REVIEW_MODEL', testModel('optimizexl-review/WH_WOC_KnightKhorneFlail03.mdx')],
  archer: ['MDLXL_SUITE_ARCHER', testModel('material-fixture/Mecha-CL.mdx')], // geoset 4 uses Materials[4] (3 layers), 11+ textures
  effect: ['MDLXL_EFFECT_MODEL', testModel('effect-fixture/WH_WOC_KnightKhorneFlail03.mdx')],
  hoofprint: ['MDLXL_SUITE_HOOFPRINT', testModel('corpus-sd/human__knight.mdx')],
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
