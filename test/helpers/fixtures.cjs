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
  'sd-chaos-orc': ['MDLXL_SD_CHAOS_ORC', testModel('corpus-sd/critters__chaosspaceorc.mdx')], // a keyed light, attachments, an emitter, SND/FPT/SPL and an odd SPN event
  lahmian: ['MDLXL_LAHMIAN', testModel('corpse-fixtures/Lahmian_SD_14.mdx')], // two bodies (Caspette portrait rig, Root sway), cloth chains
  'transfer-footman': ['MDLXL_TRANSFER_FOOTMAN', testModel('corpus-sd/human__footman.mdx')], // SD Footman: weapon arm Arm1_L > Arm2_L > Hand_R, right arm ends at Hand Right Ref
  'transfer-grunt': ['MDLXL_TRANSFER_GRUNT', testModel('corpus-sd/orc__grunt.mdx')], // SD Grunt: axe on the +Y arm, Attack - 1 non-looping
  'transfer-lord-of-change': ['MDLXL_TRANSFER_LORD_OF_CHANGE', testModel('pose-wings/Lord_of_Changes_Repaired.mdx')], // v800 winged demon, shared shoulder helpers, global FX ribbons
  'transfer-demon-hunter': ['MDLXL_TRANSFER_DEMON_HUNTER', testModel('corpus-sd/nightelf__herodemonhunter.mdx')], // two skeletons: Attack moves the plain one, "... Alternate" is the demon form
  'transfer-abomination': ['MDLXL_TRANSFER_ABOMINATION', testModel('corpus-sd/undead__abomination.mdx')],
  'transfer-dryad': ['MDLXL_TRANSFER_DRYAD', testModel('corpus-sd/nightelf__dryad.mdx')], // horse body: BONE_CHEST carries the front legs and the rider torso
  'transfer-sorceress': ['MDLXL_TRANSFER_SORCERESS', testModel('corpus-sd/human__sorceress.mdx')],
  'transfer-knight': ['MDLXL_TRANSFER_KNIGHT', testModel('corpus-sd/human__knight.mdx')], // rider on a horse: three leg pairs
  'transfer-ghoul': ['MDLXL_TRANSFER_GHOUL', testModel('corpus-sd/undead__ghoul.mdx')], // long toes skinned to Foot1/Foot2 under the foot joints
  'transfer-kurgan': ['MDLXL_TRANSFER_KURGAN', testModel('pose-complex-fixtures/WH_WOC_KurganWarlord02.mdx')], // two-handed hammer: one hand in Stand - 1, both in Stand Ready
  'transfer-nurgle-knight': ['MDLXL_TRANSFER_NURGLE_KNIGHT', testModel('fx-owner/variety/WH_WOC_KnightNurgle16.mdx')], // the rider hangs from a second mount root, not under the horse's body
  'transfer-nurgle-warrior': ['MDLXL_TRANSFER_NURGLE_WARRIOR', testModel('surface-effects/WH_WOC_WarriorNurgle02.mdx')], // a belly chain that shares skin with the chest, a cape, shoulder bones
  'transfer-nurgle': ['MDLXL_TRANSFER_NURGLE', testModel('surface-effects/WH_WOC_WarriorNurgle02.mdx')], // shield and axe
  'transfer-dragon-rider': ['MDLXL_TRANSFER_DRAGON_RIDER', testModel('pose-heads/WH_VC_ZombieDragonVCarsteinHero01.mdx')], // rider under the dragon's chest, beside its wings, neck and head
  'transfer-nightmare-rider': ['MDLXL_TRANSFER_NIGHTMARE_RIDER', testModel('transfer-riders/BloodDragonNightmare_Polished_2_1.mdx')], // rider on a four-footed mount whose forelimbs read as arms; cloth strips on the rider's chest read as legs
  'transfer-cold-one-rider': ['MDLXL_TRANSFER_COLD_ONE_RIDER', testModel('transfer-riders/Cold_One_Rider_UNIT.mdx')], // rider on its own root over a two-legged mount that has arms
  'transfer-magnataur': ['MDLXL_TRANSFER_MAGNATAUR', testModel('corpus-sd/creeps__magnataur.mdx')], // one creature: a torso on a four-legged body, hanging from a joint read as a neck
  'transfer-khorne-knight': ['MDLXL_TRANSFER_KHORNE_KNIGHT', testModel('transfer-riders/WH_WOC_KnightKhorneAxe03.mdx')], // the rider's leg has a joint whose pivot sits at the body's middle, off the leg
  'transfer-bray-shaman': ['MDLXL_TRANSFER_BRAY_SHAMAN', testModel('transfer-riders/bray_shaman_unit.mdx')], // one creature: mirrored strips of scroll hang from the chest the arms hang from
  'transfer-bray-shaman-hero': ['MDLXL_TRANSFER_BRAY_SHAMAN_HERO', testModel('transfer-riders/bray_shaman_hero.mdx')], // the hero version of the same rig
  'transfer-tauren': ['MDLXL_TRANSFER_TAUREN', testModel('corpus-sd/orc__tauren.mdx')], // four-joint limbs: a collar above each arm, a thigh above each hoofed leg's handle chain
  'transfer-hermit-crab': ['MDLXL_TRANSFER_HERMIT_CRAB', testModel('corpus-sd/critters__hermitcrab.mdx')], // its root bone hangs from the Origin Ref attachment
  'transfer-villager': ['MDLXL_TRANSFER_VILLAGER', testModel('corpus-sd/critters__villagerman.mdx')],
  'transfer-red-dragon': ['MDLXL_TRANSFER_RED_DRAGON', testModel('corpus-sd/creeps__reddragon.mdx')], // the root scales to zero in Death: the whole body goes
  'transfer-orc-warlock': ['MDLXL_TRANSFER_ORC_WARLOCK', testModel('corpus-sd/creeps__orcwarlock.mdx')], // hips of two joints stacked on each other: the piece between them points nowhere in particular
  'vertex-modulate2x': ['MDLXL_VERTEX_MODULATE2X', testModel('vertex-modulate2x/Baron Rivendare.mdx')], // horse legs: HeroDeathknight + dark TeamColor24 at Modulate 2x
  'vertex-rgb-match': ['MDLXL_VERTEX_RGB_MATCH', testModel('vertex-rgb-match/Baron Rivendare.mdx')], // owner's Baron (16 Nov 2026): red geoset RGB, Blend layers; with shoulder_leather_raidrogue_d_01.blp
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
