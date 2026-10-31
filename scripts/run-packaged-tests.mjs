// Unattended runner for MDLxL's packaged-app tests (test/*.cjs) under machine variants.
// Usage: pnpm run test:packaged [variant] [all|core|name,name]   (see docs/PACKAGED-TESTS.md)
// On Windows it relaunches itself on the hidden "MDLxLTests" desktop (scripts/hidden-run.ps1), so no test
// window can reach the user's screen; set MDLXL_SUITE_VISIBLE=1 to run on the current desktop instead.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { repoRoot as root, outDir as out } from './lib/paths.mjs';
// The app under test: MDLXL_SUITE_PKG (e.g. the unzipped official release) or out/pkg. Every test gets its
// MDLxL.exe as MDLXL_TEST_EXE, the one variable test/helpers/app.cjs reads, except DEV_ONLY below.
const pkg = path.resolve(process.env.MDLXL_SUITE_PKG || out('pkg/MDLxL-win32-x64')), exe = path.join(pkg, 'MDLxL.exe');
// Fixtures: test/helpers/fixtures.cjs owns the names, variables and out/ defaults; docs/PACKAGED-TESTS.md says
// how to prepare them.
const { fixturePath, testModel } = createRequire(import.meta.url)('../test/helpers/fixtures.cjs');
const footman = fixturePath('footman'), citadelFootman = fixturePath('citadel-footman'), particleIndex = fixturePath('particle-index'), reviewModel = fixturePath('optimizexl-review');
const graveguard = testModel('graveguard/graveguard_Optimized Weapon (1).mdx'), archer = fixturePath('archer'), effectModel = fixturePath('effect'), hoofprintModel = fixturePath('hoofprint');
const chrome = process.env.MDLXL_CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const VARIANTS = {
  default: {},
  // A PC without a graphics card: Direct3D WARP or SwiftShader software rendering.
  'no-gpu-warp': { MDLXL_VARIANT_ARGS: '--use-angle=d3d11-warp' },
  swiftshader: { MDLXL_VARIANT_ARGS: '--use-angle=swiftshader --enable-unsafe-swiftshader' },
  // Every window's CPU throttled four times.
  'slow-cpu': { MDLXL_VARIANT_CPU: '4' },
  // 150% Windows display scaling.
  hidpi: { MDLXL_VARIANT_ARGS: '--force-device-scale-factor=1.5' },
  // Same as default / no-gpu-warp with separate results, for MDLXL_SUITE_PKG=<unzipped release>.
  release: {},
  'release-no-gpu': { MDLXL_VARIANT_ARGS: '--use-angle=d3d11-warp' },
};
// Per-test settings: env, extra argv, files that must exist (else the test is skipped), timeout (ms).
// Anything not listed runs with the shared env only (which includes MDLXL_TEST_EXE).
const SPECIAL = {
  'ai-real-use': { env: { MDLVIS_HEADLESS: '' }, timeout: Number(process.env.MDLXL_AI_REAL_USE_REPEATS || 3) * (10 + 6 * Number(process.env.MDLXL_AI_REAL_USE_RESUMES || 2)) * (Number(process.env.MDLXL_AI_REAL_USE_TURN_MS || 240000) + 30000) + 120000 },
  learn: { env: { LEARN_NO_SHOTS: '1' } },
  'auto-corpse': { env: { MDLXL_CORPSE_FIXTURE: footman }, needs: [footman] },
  'smooth-edges': { needs: [footman] },
  attachemator: { env: { MDLXL_ATTACHEMATOR_MODEL: footman }, needs: [footman] },
  'anim-xl-filmstrip': { argv: [footman], needs: [footman] },
  'event-focus': { env: { MDLXL_TEST_MODEL: footman }, needs: [footman] },
  // The owner's Graveguard WIP model (supplied from Downloads), copied to out/graveguard.
  'event-sound-scroll': { env: { MDLXL_TEST_MODEL: graveguard }, needs: [graveguard] },
  'manager-simplification': { env: { MDLXL_TEST_MODEL: graveguard }, needs: [graveguard] },
  'tree-appearance': { env: { MDLXL_TEST_MODEL: graveguard }, needs: [graveguard] },
  'material-presets': { argv: [archer], needs: [archer], hint: 'set MDLXL_SUITE_ARCHER to an archer .mdx' },
  'uv-wrapping': { argv: [footman], needs: [footman] },
  // About 18 minutes of real mouse drags across every editing Rotate tool.
  'rotation-interaction': { timeout: 30 * 60 * 1000 },
  'module-button-labels.browser': { env: { MDLXL_CHROMIUM_PATH: chrome }, needs: [chrome], hint: 'set MDLXL_CHROMIUM_PATH to chrome.exe' },
  'update-popup-effects.browser': { env: { MDLXL_BROWSER_EXE: process.env.MDLXL_BROWSER_EXE || chrome }, needs: [process.env.MDLXL_BROWSER_EXE || chrome], hint: 'set MDLXL_BROWSER_EXE to chrome.exe' },
  'particle-lifecycle': { env: { MDLXL_PARTICLE_INDEX: particleIndex }, needs: [particleIndex] },
  'footprint-travel': { env: { MDLXL_TEST_MODEL: hoofprintModel }, needs: [hoofprintModel], hint: 'set MDLXL_SUITE_HOOFPRINT to a Chaos Knight .mdx with hoofprint events' },
  'showcase-effects': { env: { MDLXL_EFFECT_MODEL: effectModel }, needs: [effectModel], hint: 'set MDLXL_EFFECT_MODEL to WH_WOC_KnightKhorneFlail03.mdx' },
};
// These copy or patch the whole package folder (updater, recovery), so they get the folder of the same target.
for (const name of ['showcase-actions', 'update-shredder', 'updater-packaged', 'updater-processes', 'geoset-merge-conflicts', 'geoset-tabs']) SPECIAL[name] = { env: { MDLXL_TEST_PACKAGE: pkg } };
SPECIAL['updater-processes'].env.MDLXL_TEST_OUTPUT = out('updater-processes');
for (const name of ['ai-awareness', 'ai-attachments', 'ai-console', 'ai-editor', 'ai-parallel', 'ai-questions', 'ai-routing', 'ai-versions']) SPECIAL[name] = { env: { MDLXL_AI_TEST_OUT: out(name), MDLVIS_HEADLESS: '' } }; // They drive a normal window (still on the hidden desktop).
for (const name of ['optimizexl-review', 'optimizexl-playback']) SPECIAL[name] = { env: { MDLXL_OPTIMIZEXL_REVIEW_MODEL: reviewModel }, needs: [reviewModel] };
for (const name of ['pose-console', 'pose-copy-body', 'pose-ik', 'pose-ragdoll', 'pose-sd-controls', 'pose-view', 'movement-gizmo', 'movement-gizmo-layout']) SPECIAL[name] = { env: { MDLXL_POSE_FIXTURE: footman }, needs: [footman] };
for (const name of ['citadel-brushes', 'citadel-edges', 'citadel-flow', 'citadel-library', 'citadel-locales', 'citadel-model', 'citadel-reskin', 'citadel-studio', 'paint-tab-camera']) SPECIAL[name] = { env: { MDLXL_PAINT_FIXTURE: citadelFootman }, needs: [citadelFootman] };
// The owner's private OptimizeXL review models, copied to out/ by out/fixtures.sh (docs/PACKAGED-TESTS.md).
const flail01 = testModel('optimizexl/WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx');
const expression = [testModel('optimizexl-expression/WH_WOC_KnightKhorneFlail07.mdx'), testModel('optimizexl-expression/WH_WOC_KnightKhorneFlail03.mdx')];
const necrarch = testModel('pose-complex-fixtures/WH_VC_NecrarchLord3.mdx'), queueA = testModel('showcase-queue/WH_WOC_KnightKhorneFlail03.mdx'), queueB = testModel('showcase-queue/WH_WOC_KnightKhorneAxe03.mdx');
SPECIAL.optimizexl = { env: { MDLXL_OPTIMIZEXL_MODEL: flail01, MDLXL_OPTIMIZEXL_EXE: exe }, needs: [flail01] };
for (const name of ['optimizexl-geosets', 'optimizexl-inspection']) SPECIAL[name] = { env: { MDLXL_OPTIMIZEXL_MODEL: flail01 }, needs: [flail01] };
SPECIAL['optimizexl-expression'] = { env: { MDLXL_EXPRESSION_MODEL: expression.join(path.delimiter) }, needs: expression };
for (const name of ['pose-complex', 'pose-performance']) SPECIAL[name] = { env: { MDLXL_POSE_FIXTURE: necrarch }, needs: [necrarch] };
const fxFlail = testModel('pose-flail/Fx_original.mdx');
SPECIAL['pose-one-head'] = { env: { MDLXL_FLAIL_MODEL: fxFlail }, needs: [fxFlail] };
SPECIAL['showcase-queue'] = { env: { MDLXL_QUEUE_MODEL_A: queueA, MDLXL_QUEUE_MODEL_B: queueB }, needs: [queueA, queueB, path.join(root, 'profile/game-data-discovery.json')] };
// LowPolyWorks / Blizzard SD models chosen for the OptimizeXL feature each test exercises (docs/PACKAGED-TESTS.md).
const diagnosticsModel = testModel('optimizexl-diagnostics/WH_WOC_WarriorKhorneGW02.mdx');
SPECIAL['optimizexl-diagnostics'] = { env: { MDLXL_DIAGNOSTICS_MODEL: diagnosticsModel }, needs: [diagnosticsModel] };
const openingModel = testModel('optimizexl-opening/Spanish_Halberdier.mdx');
const boundsModel = testModel('optimizexl-bounds/WH_WOC_WarriorNurgle_Flail11_Optimized.mdx');
SPECIAL['optimizexl-bounds'] = { env: { MDLXL_BOUNDS_MODEL: boundsModel }, needs: [boundsModel] };
const formatModel = testModel('optimizexl-format/KnightOfTheBlazingSun.mdx');
SPECIAL['optimizexl-format'] = { env: { MDLXL_FORMAT_MODEL: formatModel }, needs: [formatModel] };
const splineModel = testModel('optimizexl-spline/Warp_Lightning_CannonB.mdx');
SPECIAL['optimizexl-spline'] = { env: { MDLXL_SPLINE_MODEL: splineModel }, needs: [splineModel] };
const footmanModel = testModel('optimizexl-footman/human__footman.mdx');
SPECIAL['optimizexl-footman'] = { env: { MDLXL_FOOTMAN_MODEL: footmanModel }, needs: [footmanModel] };
const motionModel = testModel('optimizexl-motion/WH_WOC_WarriorNurgle_Flail12_Optimized.mdx');
SPECIAL['optimizexl-motion'] = { env: { MDLXL_FOOTMAN_MODEL: motionModel }, needs: [motionModel] };
const selectionModel = testModel('optimizexl-selection/human__muradin.mdx');
SPECIAL['optimizexl-selection'] = { env: { MDLXL_FOOTMAN_MODEL: selectionModel }, needs: [selectionModel] };
const poseSetupModel = testModel('pose-setup-fixture/WH_VC_VonCarsteinLord07.mdx');
SPECIAL['pose-setup'] = { env: { MDLXL_POSE_FIXTURE: poseSetupModel }, needs: [poseSetupModel, testModel('pose-setup-fixture/Textures')] };
for (const name of ['optimizexl-opening', 'optimizexl-cleanup']) SPECIAL[name] = { env: { MDLXL_OPENING_MODEL: openingModel }, needs: [openingModel] };
SPECIAL['ai-parallel'].env.MDLXL_AI_CONSOLE_MODEL = footman;
SPECIAL['ai-parallel'].needs = [footman];
// Development build only: these replace electron/main.cjs with a stubbed wrapper entry before starting it, which a
// packaged MDLxL.exe cannot load. They get no MDLXL_TEST_EXE and always start the development Electron with dist/.
export const DEV_ONLY = ['welcome-prompt', 'close-prompt', 'model-close', 'showcase', 'showcase-effects', 'showcase-layout', 'showcase-queue', 'showcase-recording-particles', 'showcase-text', 'startup', 'update-popup-fallback', 'update-shredder', 'updater', 'updater-bootstrap', 'updater-packaged'];
// Never run: manual tools, or private models and archives that are not generally available.
export const SKIP = {
  'updater-release-gate': 'manual HTTP-driven release gate (never exits)',
  'updater-bootstrap': 'needs the official 0.20.1 ZIP',
  'ai-live': 'opt-in check against a real signed-in AI account (MDLXL_AI_LIVE_PROFILE)',
  'ai-real-use': 'opt-in: MDLXL_AI_REAL_USE=1 and explicit ai-real-use selection (never all/core)',
  'ai-live-tabs': 'opt-in: a real signed-in AI on several model tabs at once (MDLXL_AI_LIVE_PROFILE)',
  'particle-performance': 'needs an old baseline build (out/particle-prototype/baseline)',
  'particle-library-indexing': 'needs a copied real profile (MDLXL_REAL_PROFILE)',
};
// Rendering-, timing- and layout-heavy tests that are worth running under every variant.
export const CORE = ['startup', 'appearance', 'appearance-contrast', 'quad-view', 'grabthrough', 'movement-chain-focus-speed', 'animation-speed', 'animations-sidebar', 'timeline-scrub', 'pose-ik', 'pose-console', 'movement-gizmo', 'uv-preview-picking', 'uv-tab-window', 'forge-shape', 'forge-house', 'citadel-studio', 'showcase', 'showcase-camera', 'particle-workflow', 'particle-picture', 'portrait-authoring', 'vertex-rgb-preview', 'tree-appearance', 'bone-tools', 'optimizexl-preview', 'anim-xl', 'model-tabs'];

const testDir = path.join(root, 'test');
const files = fs.readdirSync(testDir).filter(file => file.endsWith('.cjs'));
const nameOf = file => file.replace(/\.electron\.cjs$/, '').replace(/\.cjs$/, '');
const fileOf = name => files.find(file => file === name + '.electron.cjs' || file === name + '.cjs');
const variant = process.argv[2] || 'default', selection = process.argv[3] || 'all';
if (!VARIANTS[variant]) fail(`Unknown variant "${variant}". Variants: ${Object.keys(VARIANTS).join(', ')}`);
const names = selection === 'all' ? files.map(nameOf).filter(name => name !== 'ai-real-use') : selection === 'core' ? CORE : selection.split(',').map(name => name.trim()).filter(Boolean);
const outDir = out('suite', variant), summaryFile = path.join(outDir, 'summary.json'), doneFile = path.join(outDir, 'done.txt');
const TIMEOUT = Number(process.env.SUITE_TIMEOUT_MS || 15 * 60 * 1000);

function fail(message) { console.error(message); process.exit(2); }

function findPlaywright() {
  if (process.env.MDLXL_REAL_PLAYWRIGHT) return process.env.MDLXL_REAL_PLAYWRIGHT;
  const require = createRequire(path.join(root, 'package.json'));
  for (const name of ['playwright', 'playwright-core']) { try { return path.dirname(require.resolve(name + '/package.json')); } catch { /* next */ } }
  return null;
}

// Stops what a test left running: processes descended from it, or started from this repo's out/ folder,
// in both cases only if they were created after the test started. The user's own MDLxL (even one opened
// from out/pkg before the run) and other sessions' processes are never touched.
function cleanup(testPid, since) {
  if (process.platform !== 'win32') return;
  let list;
  try {
    const query = "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine,ExecutablePath,@{n='Created';e={[long]($_.CreationDate.ToUniversalTime() - [datetime]'1970-01-01').TotalMilliseconds}} | ConvertTo-Json -Compress";
    list = JSON.parse(execFileSync('powershell', ['-NoProfile', '-Command', query], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 60000, windowsHide: true }));
  } catch { return; /* best effort */ }
  const fresh = list.filter(p => p.Created >= since - 1000);
  const outPath = (out() + path.sep).toLowerCase(), keep = new Set([process.pid]);
  for (let pid = process.ppid; pid && !keep.has(pid); pid = list.find(p => p.ProcessId === pid)?.ParentProcessId) keep.add(pid);
  const doomed = new Set([testPid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of fresh) if (!doomed.has(p.ProcessId) && doomed.has(p.ParentProcessId)) { doomed.add(p.ProcessId); grew = true; }
  }
  for (const p of fresh) if ((p.CommandLine || '').toLowerCase().includes(outPath) || (p.ExecutablePath || '').toLowerCase().startsWith(outPath)) doomed.add(p.ProcessId);
  for (const pid of doomed) if (!keep.has(pid)) { try { process.kill(pid); } catch { /* already gone */ } }
}

async function runSuite() {
  const playwright = findPlaywright();
  fs.mkdirSync(outDir, { recursive: true });
  const summary = fs.existsSync(summaryFile) && process.env.SUITE_RESUME ? JSON.parse(fs.readFileSync(summaryFile, 'utf8')) : { variant, selection, started: new Date().toISOString(), package: pkg, results: {} };
  delete summary.finished; fs.rmSync(doneFile, { force: true });
  const save = () => fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  save();
  // Keep every temporary file inside this repo's out/ folder.
  const tmp = out('tmp', variant); fs.mkdirSync(tmp, { recursive: true });
  for (const name of names) {
    if (summary.results[name]?.status === 'pass') continue;
    const special = SPECIAL[name] || {}, file = fileOf(name);
    const missing = (special.needs || []).some(need => !need || !fs.existsSync(need));
    const optedIn = name === 'ai-real-use' && process.env.MDLXL_AI_REAL_USE === '1' && selection !== 'all' && selection !== 'core';
    const notRun = SKIP[name] && !optedIn ? { status: 'skip', reason: SKIP[name] }
      : !file ? { status: 'missing', reason: `no test/${name}.electron.cjs or test/${name}.cjs` }
      : missing ? { status: 'skip', reason: 'missing fixture: ' + (special.hint || special.needs.join(', ')) }
      : !playwright ? { status: 'fail', reason: 'Playwright not found: set MDLXL_REAL_PLAYWRIGHT' } : null;
    if (notRun) { summary.results[name] = notRun; save(); console.log(`${name}: ${notRun.status} (${notRun.reason})`); continue; }
    const log = path.join(outDir, name + '.log');
    // DEV_ONLY wrappers must not inherit the release-package fallback now that they use appTarget().
    const env = { ...process.env, TEMP: tmp, TMP: tmp, MDLXL_TEMP: tmp, MDLVIS_HEADLESS: '1', MDLXL_PLAYWRIGHT_MODULE: path.join(root, 'scripts/playwright-variant.cjs'), MDLXL_REAL_PLAYWRIGHT: playwright, MDLXL_VARIANT_ARGS: '', MDLXL_VARIANT_CPU: '', MDLXL_TEST_EXE: DEV_ONLY.includes(name) ? '' : exe, MDLXL_SUITE_PKG: DEV_ONLY.includes(name) ? '' : process.env.MDLXL_SUITE_PKG || '', ...VARIANTS[variant], ...(special.env || {}) };
    const timeout = special.timeout || TIMEOUT, started = Date.now(), stream = fs.openSync(log, 'w');
    let testPid = 0;
    const code = await new Promise(resolve => {
      const child = spawn(process.execPath, [path.join('test', file), ...(special.argv || [])], { cwd: root, env, stdio: ['ignore', stream, stream], windowsHide: true });
      testPid = child.pid;
      const timer = setTimeout(() => {
        fs.appendFileSync(log, `\n[suite] timeout after ${timeout / 1000}s\n`);
        if (process.platform === 'win32') { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore', windowsHide: true }); } catch { /* gone */ } } else child.kill('SIGKILL');
        resolve('timeout');
      }, timeout);
      child.on('error', error => { clearTimeout(timer); fs.appendFileSync(log, `\n[suite] ${error.message}\n`); resolve('error'); });
      child.on('exit', exitCode => { clearTimeout(timer); resolve(exitCode); });
    });
    fs.closeSync(stream); cleanup(testPid, started);
    const tail = fs.readFileSync(log, 'utf8').trim().split(/\r?\n/).slice(-6).join(' | ').slice(0, 600);
    summary.results[name] = { status: code === 0 ? 'pass' : code === 'timeout' ? 'timeout' : 'fail', code, seconds: Math.round((Date.now() - started) / 1000), tail };
    save(); console.log(`${name}: ${summary.results[name].status} (${summary.results[name].seconds}s)`);
  }
  summary.finished = new Date().toISOString(); save();
  const counts = countOf(summary);
  fs.writeFileSync(doneFile, JSON.stringify(counts));
  return counts;
}

const countOf = summary => Object.entries(summary.results).filter(([name]) => names.includes(name)).reduce((counts, [, r]) => ({ ...counts, [r.status]: (counts[r.status] || 0) + 1 }), {});
const failed = counts => (counts.fail || 0) + (counts.timeout || 0) + (counts.missing || 0) > 0;

// Starts the runner on the hidden desktop and reports its progress from summary.json.
async function runHidden() {
  if (!fs.existsSync(exe) && names.some(name => !SKIP[name])) console.warn(`Warning: ${exe} does not exist. Package the app (docs/PACKAGED-TESTS.md) or set MDLXL_SUITE_PKG.`);
  fs.mkdirSync(outDir, { recursive: true }); fs.rmSync(doneFile, { force: true });
  const quote = value => `"${value}"`;
  const command = [process.execPath, fileURLToPath(import.meta.url), variant, selection].map(quote).join(' ');
  console.log(`Running ${names.length} test(s), variant ${variant}, on the hidden MDLxLTests desktop. Logs: ${outDir}`);
  const env = { ...process.env, MDLXL_SUITE_HIDDEN: '1', MDLXL_HIDDEN_COMMAND: command };
  const launcher = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/hidden-run.ps1'), '-WorkDir', root], { cwd: root, env, stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  const reported = new Set(), started = Date.now();
  const report = () => {
    let summary; try { summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8')); } catch { return; }
    if (Date.parse(summary.started) < started - 5000 && !process.env.SUITE_RESUME) return; // an older run's file
    for (const [name, result] of Object.entries(summary.results)) {
      if (reported.has(name) || !names.includes(name)) continue;
      reported.add(name);
      console.log(`[${reported.size}/${names.length}] ${name}: ${result.status}${result.seconds !== undefined ? ` (${result.seconds}s)` : ''}${result.reason ? ` - ${result.reason}` : ''}${result.status === 'fail' || result.status === 'timeout' ? `\n    ${result.tail}` : ''}`);
    }
  };
  const timer = setInterval(report, 2000);
  const code = await new Promise(resolve => launcher.on('exit', resolve));
  clearInterval(timer); report();
  if (!fs.existsSync(doneFile)) fail(`The hidden runner stopped early (launcher exit ${code}). See ${outDir}.`);
  return JSON.parse(fs.readFileSync(doneFile, 'utf8'));
}

const hide = process.platform === 'win32' && !process.env.MDLXL_SUITE_HIDDEN && !process.env.MDLXL_SUITE_VISIBLE;
const counts = hide ? await runHidden() : await runSuite().catch(error => {
  fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'runner-error.log'), String(error?.stack || error)); throw error;
});
console.log(`${variant} ${selection}: ${JSON.stringify(counts)}`);
process.exitCode = failed(counts) ? 1 : 0;
