// Unattended runner for MDLxL's packaged-app tests (test/*.cjs) under machine variants.
// Usage: pnpm run test:packaged [variant] [all|core|name,name]   (see docs/PACKAGED-TESTS.md)
// On Windows it relaunches itself on the hidden "MDLxLTests" desktop (scripts/hidden-run.ps1), so no test
// window can reach the user's screen; set MDLXL_SUITE_VISIBLE=1 to run on the current desktop instead.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...parts) => path.join(root, 'out', ...parts);
// MDLXL_SUITE_PKG points the tests at another build, e.g. the unzipped official release.
const pkg = path.resolve(process.env.MDLXL_SUITE_PKG || out('pkg/MDLxL-win32-x64')), exe = path.join(pkg, 'MDLxL.exe');
// Fixtures. The defaults live in the untracked out/ folder; docs/PACKAGED-TESTS.md says how to prepare them.
const footman = path.resolve(process.env.MDLXL_SUITE_FOOTMAN || out('pose/Footman.mdx'));
const citadelFootman = path.resolve(process.env.MDLXL_SUITE_CITADEL_FOOTMAN || out('citadel-fixture/Footman.mdx'));
const particleIndex = path.resolve(process.env.MDLXL_PARTICLE_INDEX || out('particle-index/particles'));
const reviewModel = path.resolve(process.env.MDLXL_OPTIMIZEXL_REVIEW_MODEL || out('optimizexl-review/WH_WOC_KnightKhorneFlail03.mdx'));
const archer = process.env.MDLXL_SUITE_ARCHER, effectModel = process.env.MDLXL_EFFECT_MODEL;
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
// Anything not listed runs with the shared env only.
const SPECIAL = {
  'anim-xl': { env: { MDLXL_ANIMXL_EXE: exe } },
  'anim-xl-filmstrip': { env: { MDLXL_ANIMXL_EXE: exe }, argv: [footman], needs: [footman] },
  'appearance-contrast': { env: { MDLXL_TEST_EXE: exe } },
  'bit-collection': { env: { MDLXL_TEST_EXE: exe } },
  'bit-replacement': { env: { MDLXL_TEST_EXE: exe } },
  'glow-material-filters': { argv: [exe] },
  'uv-material-settings': { argv: [exe] },
  'material-presets': { argv: [archer], needs: [archer && path.resolve(archer)], hint: 'set MDLXL_SUITE_ARCHER to an archer .mdx' },
  'uv-wrapping': { argv: [footman], needs: [footman] },
  'sort-my-mess': { env: { MDLXL_SORT_EXE: exe } },
  'module-button-labels.browser': { env: { MDLXL_CHROMIUM_PATH: chrome }, needs: [chrome], hint: 'set MDLXL_CHROMIUM_PATH to chrome.exe' },
  'particle-lifecycle': { env: { MDLXL_PARTICLE_INDEX: particleIndex }, needs: [particleIndex] },
  'showcase-effects': { env: { MDLXL_EFFECT_MODEL: effectModel }, needs: [effectModel && path.resolve(effectModel)], hint: 'set MDLXL_EFFECT_MODEL to WH_WOC_KnightKhorneFlail03.mdx' },
};
for (const name of ['forge-bevel-sides', 'forge-cuts', 'forge-double-click', 'forge-face-editing', 'forge-glow', 'forge-house', 'forge-molding', 'forge-shape-hotkeys', 'forge-shape', 'mesh-density', 'uv-team-color', 'normalizer']) SPECIAL[name] = { env: { MDLXL_TEST_EXE: exe } };
for (const name of ['showcase-actions', 'update-shredder', 'updater-packaged', 'updater-processes', 'geoset-merge-conflicts', 'geoset-tabs']) SPECIAL[name] = { env: { MDLXL_TEST_PACKAGE: pkg } };
SPECIAL['updater-processes'].env.MDLXL_TEST_OUTPUT = out('updater-processes');
for (const name of ['optimizexl-review', 'optimizexl-playback']) SPECIAL[name] = { env: { MDLXL_OPTIMIZEXL_REVIEW_MODEL: reviewModel }, needs: [reviewModel] };
for (const name of ['pose-console', 'pose-copy-body', 'pose-ik', 'pose-ragdoll', 'pose-sd-controls', 'pose-view', 'movement-gizmo', 'movement-gizmo-layout']) SPECIAL[name] = { env: { MDLXL_POSE_EXE: exe, MDLXL_POSE_FIXTURE: footman }, needs: [footman] };
for (const name of ['citadel-brushes', 'citadel-edges', 'citadel-flow', 'citadel-library', 'citadel-locales', 'citadel-model', 'citadel-reskin', 'citadel-studio']) SPECIAL[name] = { env: { MDLXL_PAINT_FIXTURE: citadelFootman }, needs: [citadelFootman] };
// Never run: manual tools, or private models and archives that are not generally available.
export const SKIP = {
  'updater-release-gate': 'manual HTTP-driven release gate (never exits)',
  'updater-bootstrap': 'needs the official 0.20.1 ZIP',
  'particle-performance': 'needs an old baseline build (out/particle-prototype/baseline)',
  'particle-library-indexing': 'needs a copied real profile (MDLXL_REAL_PROFILE)',
  'pose-complex': 'needs WH_VC_NecrarchLord3.mdx (private model)',
  'pose-performance': 'needs WH_VC_NecrarchLord3.mdx (private model)',
  'pose-setup': 'needs WH_WOC_KurganWarlord3.mdx (private model)',
  'showcase-queue': 'needs KnightKhorneFlail04 / Axe01 (private models)',
  ...Object.fromEntries(['optimizexl', 'optimizexl-bounds', 'optimizexl-cleanup', 'optimizexl-diagnostics', 'optimizexl-expression', 'optimizexl-footman', 'optimizexl-format', 'optimizexl-geosets', 'optimizexl-inspection', 'optimizexl-motion', 'optimizexl-opening', 'optimizexl-save', 'optimizexl-selection', 'optimizexl-spline'].map(name => [name, 'needs a private OptimizeXL review model'])),
};
// Rendering-, timing- and layout-heavy tests that are worth running under every variant.
export const CORE = ['startup', 'appearance', 'appearance-contrast', 'quad-view', 'grabthrough', 'movement-chain-focus-speed', 'animation-speed', 'animations-sidebar', 'timeline-scrub', 'pose-ik', 'pose-console', 'movement-gizmo', 'uv-preview-picking', 'uv-tab-window', 'forge-shape', 'forge-house', 'citadel-studio', 'showcase', 'showcase-camera', 'particle-workflow', 'particle-picture', 'portrait-authoring', 'vertex-rgb-preview', 'tree-appearance', 'bone-tools', 'optimizexl-preview', 'anim-xl', 'model-tabs'];

const testDir = path.join(root, 'test');
const files = fs.readdirSync(testDir).filter(file => file.endsWith('.cjs'));
const nameOf = file => file.replace(/\.electron\.cjs$/, '').replace(/\.cjs$/, '');
const fileOf = name => files.find(file => file === name + '.electron.cjs' || file === name + '.cjs');
const variant = process.argv[2] || 'default', selection = process.argv[3] || 'all';
if (!VARIANTS[variant]) fail(`Unknown variant "${variant}". Variants: ${Object.keys(VARIANTS).join(', ')}`);
const names = selection === 'all' ? files.map(nameOf) : selection === 'core' ? CORE : selection.split(',').map(name => name.trim()).filter(Boolean);
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
    const notRun = SKIP[name] ? { status: 'skip', reason: SKIP[name] }
      : !file ? { status: 'missing', reason: `no test/${name}.electron.cjs or test/${name}.cjs` }
      : missing ? { status: 'skip', reason: 'missing fixture: ' + (special.hint || special.needs.join(', ')) }
      : !playwright ? { status: 'fail', reason: 'Playwright not found: set MDLXL_REAL_PLAYWRIGHT' } : null;
    if (notRun) { summary.results[name] = notRun; save(); console.log(`${name}: ${notRun.status} (${notRun.reason})`); continue; }
    const log = path.join(outDir, name + '.log');
    const env = { ...process.env, TEMP: tmp, TMP: tmp, MDLVIS_HEADLESS: '1', MDLXL_PLAYWRIGHT_MODULE: path.join(root, 'scripts/playwright-variant.cjs'), MDLXL_REAL_PLAYWRIGHT: playwright, MDLXL_VARIANT_ARGS: '', MDLXL_VARIANT_CPU: '', ...VARIANTS[variant], ...(special.env || {}) };
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
