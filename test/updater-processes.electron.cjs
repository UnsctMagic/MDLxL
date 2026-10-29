const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Native Windows regression: a locked portable EXE is reported and preserved, and the
// installer waits for real Electron processes of this installation before replacing it.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {execFile, spawn} = require('node:child_process');
const {promisify} = require('node:util');
const {digest} = require('../electron/updater.cjs');
const run = promisify(execFile);
const ps = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForFile(file) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { await fs.access(file); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await pause(50);
  }
  throw Error('Installer did not reach file verification.');
}
(async () => {
  const output = process.env.MDLXL_TEST_OUTPUT || os.tmpdir();
  await fs.mkdir(output, {recursive:true});
  const root = await fs.mkdtemp(path.join(output, 'mdlxl-update-processes-'));
  const target = path.join(root, 'installed'), source = path.join(root, 'new');
  await fs.cp(process.env.MDLXL_TEST_PACKAGE || path.resolve('out/updater-package/MDLxL-win32-x64'), target, {recursive:true});
  const exe = path.join(target, 'MDLxL.exe');
  await fs.mkdir(source);
  await fs.copyFile(exe, path.join(source, 'MDLxL.exe'));
  // An appended overlay keeps the PE executable valid while requiring replacement.
  await fs.appendFile(path.join(source, 'MDLxL.exe'), 'MDLxL updater regression');
  const before = await digest(exe), hash = await digest(path.join(source, 'MDLxL.exe'));
  const result = path.join(root, 'result.json'), planFile = path.join(root, 'plan.json');
  const plan = {source,target,operations:[{relative:'MDLxL.exe',before,hash}],pid:0,executable:exe,profile:path.join(root,'restart-profile'),result};
  const env = {...process.env, MDLVIS_HEADLESS:'1'};
  const installer = path.join(root,'install.ps1');
  const installerSource = await fs.readFile(process.env.MDLXL_TEST_INSTALLER || path.resolve('electron/update-install.ps1'),'utf8');
  await fs.writeFile(installer,installerSource);
  let owner, remaining;
  const install = () => run(ps, ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',installer,planFile], {windowsHide:true,env});
  let holder, starting;
  try {
    remaining = (await launchApp({ out: path.resolve('out'), profile: path.join(root,'remaining-profile'), target: { executablePath: exe, args: [], packaged: true }, env: { ...env } })).app;
    await remaining.firstWindow();
    // The installer publishes files with an atomic replace, which Windows allows for a
    // running EXE (the editor's own processes are waited for instead). A handle without
    // delete sharing, such as a scanner reading the file, still locks it.
    const held = path.join(root,'exe-held'), release = path.join(root,'exe-release'), hold = path.join(root,'hold.ps1');
    await fs.writeFile(hold, "param($File,$Held,$Release)\n$stream=[IO.File]::Open($File,'Open','Read','Read')\ntry{[IO.File]::WriteAllText($Held,'');while(!(Test-Path -LiteralPath $Release)){Start-Sleep -Milliseconds 50}}finally{$stream.Dispose()}\n");
    holder = run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',hold,exe,held,release],{windowsHide:true});
    await waitForFile(held);
    await fs.writeFile(planFile, JSON.stringify(plan));
    await install();
    await fs.writeFile(release,''); await holder; holder = null;
    const failed = JSON.parse(await fs.readFile(result,'utf8'));
    assert.equal(failed.ok,false);
    assert.match(failed.error,/being used by another process/);
    assert.equal(await digest(exe),before,'Rejected replacement preserves the original EXE and records the failure');
    await fs.rm(result);
    await closeApp(remaining); remaining = null;
    // Pause only the test copy at verification, after the owner's exit check.
    // This reproduces a desktop relaunch during the real verification delay.
    const marker = '    # Recheck every destination after the editor has flushed and exited.';
    assert.ok(installerSource.includes(marker));
    await fs.writeFile(installer,installerSource.replace(marker,`    [IO.File]::WriteAllText((Join-Path $stage 'verification-started'), '')
    while (!(Test-Path -LiteralPath (Join-Path $stage 'continue-verification'))) { Start-Sleep -Milliseconds 20 }
${marker}`));
    owner = (await launchApp({ out: path.resolve('out'), profile: path.join(root,'owner-profile'), target: { executablePath: exe, args: [], packaged: true }, env: { ...env } })).app;
    await owner.firstWindow();
    plan.pid = await owner.evaluate(() => process.pid);
    await fs.writeFile(planFile,JSON.stringify(plan));
    // The editor hands the installer its installation lock (Updater.launchInstaller).
    const lock = path.join(target,'.mdlxl-installing');
    await fs.mkdir(lock); await fs.writeFile(path.join(lock,'owner.json'),JSON.stringify({planFile,pid:plan.pid}));
    const installing = install();
    await pause(500);
    await closeApp(owner); owner = null;
    await waitForFile(path.join(root,'verification-started'));
    // A desktop relaunch during installation leaves through the startup guard without
    // opening the editor (the installation lock is present).
    const relaunch = spawn(exe, [], {env:{...env,MDLXL_PROFILE:path.join(root,'remaining-profile')},stdio:'ignore',windowsHide:true});
    const exitCode = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Relaunch did not exit through the installation guard.')), 30000); relaunch.once('exit', code => { clearTimeout(timer); resolve(code); }); relaunch.once('error', reject); });
    assert.equal(exitCode,0);
    // A relaunch that has loaded this EXE but not yet left the guard must be waited for.
    starting = spawn(exe, ['-e','setInterval(()=>{},1000)'], {env:{...env,ELECTRON_RUN_AS_NODE:'1'},stdio:'ignore',windowsHide:true});
    await new Promise((resolve, reject) => { starting.once('spawn', resolve); starting.once('error', reject); });
    await fs.writeFile(path.join(root,'continue-verification'),'');
    await pause(3000);
    assert.equal(await digest(exe),before,'Installer waits for a launch of this EXE that is still running during verification');
    await assert.rejects(fs.access(result));
    starting.kill(); starting = null;
    await installing;
    assert.equal(JSON.parse(await fs.readFile(result,'utf8')).ok,true);
    assert.equal(await digest(exe),hash);
    await assert.rejects(fs.access(lock),'the installation lock is released after installing');
    console.log('PASS locked EXE failure reporting and guarded relaunch, and successful replacement after a launch running during verification closes');
  } finally {
    if (holder) { await fs.writeFile(path.join(root,'exe-release'),'').catch(() => {}); await holder.catch(() => {}); }
    if (starting) starting.kill();
    // Never leave the paused test installer waiting after a failure.
    await fs.writeFile(path.join(root,'continue-verification'),'').catch(() => {});
    for (const app of [owner,remaining]) if (app) await closeApp(app).catch(() => {});
    // Only processes launched from this disposable test installation are owned here.
    const cleanup = path.join(root,'close.ps1');
    await fs.writeFile(cleanup, "param($Executable)\nGet-Process MDLxL -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $Executable } | Stop-Process\n");
    await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',cleanup,exe],{windowsHide:true});
  }
})().catch(error => {console.error(error);process.exitCode=1;});
