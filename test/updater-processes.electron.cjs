// Native Windows regression: real Electron processes keep the portable EXE locked.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {_electron} = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
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
  try {
    remaining = await _electron.launch({executablePath:exe,env:{...env,MDLXL_PROFILE:path.join(root,'remaining-profile')}});
    await remaining.firstWindow();
    await fs.writeFile(planFile, JSON.stringify(plan));
    await install();
    const failed = JSON.parse(await fs.readFile(result,'utf8'));
    assert.equal(failed.ok,false);
    assert.match(failed.error,/being used by another process/);
    assert.equal(await digest(exe),before,'Rejected replacement preserves the original EXE and records the failure');
    await fs.rm(result);
    await remaining.evaluate(({app}) => app.exit(0)); remaining = null;
    // Pause only the test copy at verification, after the owner's exit check.
    // This reproduces a desktop relaunch during the real verification delay.
    const marker = '    # Recheck every destination after the editor has flushed and exited.';
    assert.ok(installerSource.includes(marker));
    await fs.writeFile(installer,installerSource.replace(marker,`    [IO.File]::WriteAllText((Join-Path $stage 'verification-started'), '')
    while (!(Test-Path -LiteralPath (Join-Path $stage 'continue-verification'))) { Start-Sleep -Milliseconds 20 }
${marker}`));
    owner = await _electron.launch({executablePath:exe,env:{...env,MDLXL_PROFILE:path.join(root,'owner-profile')}});
    await owner.firstWindow();
    plan.pid = await owner.evaluate(() => process.pid);
    await fs.writeFile(planFile,JSON.stringify(plan));
    const installing = install();
    await pause(500);
    await owner.evaluate(({app}) => app.exit(0)); owner = null;
    await waitForFile(path.join(root,'verification-started'));
    remaining = await _electron.launch({executablePath:exe,env:{...env,MDLXL_PROFILE:path.join(root,'remaining-profile')}});
    await remaining.firstWindow();
    await fs.writeFile(path.join(root,'continue-verification'),'');
    await pause(3000);
    assert.equal(await digest(exe),before,'Installer waits for the app reopened during verification');
    await assert.rejects(fs.access(result));
    await remaining.evaluate(({app}) => app.exit(0)); remaining = null;
    await installing;
    assert.equal(JSON.parse(await fs.readFile(result,'utf8')).ok,true);
    assert.equal(await digest(exe),hash);
    console.log('PASS locked EXE failure reporting and successful replacement after an app reopened during verification closes');
  } finally {
    for (const app of [owner,remaining]) if (app) await app.evaluate(({app}) => app.exit(0)).catch(() => {});
    // Only processes launched from this disposable test installation are owned here.
    const cleanup = path.join(root,'close.ps1');
    await fs.writeFile(cleanup, "param($Executable)\nGet-Process MDLxL -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $Executable } | Stop-Process\n");
    await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',cleanup,exe],{windowsHide:true});
  }
})().catch(error => {console.error(error);process.exitCode=1;});
