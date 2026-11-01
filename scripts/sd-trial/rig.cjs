// SD Brain trial rig: runs one natural-language prompt through the packaged app with
// the real Codex provider, then saves pictures from several sides, the chat and the model.
// Start it with scripts/sd-trial/trial.ps1 (hidden desktop, no windows). Args: label, prompt,
// brain (on/off), [model file to open]; the prompt "-" only opens and photographs.
// It shares the test build's Codex sign-in through a folder link (never a copy), uses its own
// profile and port under out/sd-trials/runs/<label>, and ends only its own process tree.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE);
const [label, prompt, brain = 'on', open] = process.argv.slice(2);
const repo = path.resolve(__dirname, '..', '..');
const out = path.join(repo, 'out', 'sd-trials', 'runs', label);
const exe = path.join(repo, 'out', process.env.MDLXL_TRIAL_PKG || 'pkg-ai', 'MDLxL-win32-x64', 'MDLxL.exe');
// The test build's Codex folder; its connections.json next to it supplies the provider settings.
const codexHome = process.env.MDLXL_TRIAL_CODEX_HOME || 'D:\\Codex\\mdlxl-ai-hook-20261024\\user-test-profile\\ai\\codex';
const log = (...a) => fs.appendFileSync(path.join(out, 'rig.log'), a.join(' ') + '\n');
(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'profile', 'ai'), { recursive: true });
  // Share the test build's Codex sign-in instead of copying it, so no token is duplicated.
  execSync(`cmd /c mklink /J "${path.join(out, 'profile', 'ai', 'codex')}" "${codexHome}"`);
  // The test build's provider settings, with this trial's switches.
  const connections = JSON.parse(fs.readFileSync(path.join(codexHome, '..', 'connections.json'), 'utf8'));
  Object.assign(connections, { sdBrain: brain === 'on', awareness: false });
  // Encrypted values belong to the other profile; this one makes its own.
  delete connections.token;
  connections.port = 54100 + Math.floor(Math.random() * 800);
  for (const p of Object.values(connections.providers || {})) p.key = '';
  fs.writeFileSync(path.join(out, 'profile', 'ai', 'connections.json'), JSON.stringify(connections, null, 2));
  const app = await _electron.launch({
    executablePath: exe,
    args: [...(open ? [open] : []), '--disable-gpu-vsync'],
    env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile'), MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') },
    timeout: 90000,
  });
  let page;
  try {
    page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.webContents.setBackgroundThrottling(false);
      w.setSize(1600, 1000);
    });
    await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.evaluate(
      async ({ brain }) => {
        await window.desktop.aiSdBrain(brain === 'on');
        await window.desktop.aiEnable(true);
      },
      { brain },
    );
    const link = (await page.evaluate(() => window.desktop.aiConfig())).mcpServers.mdlxl;
    const tool = async (name, args = {}) => {
      const reply = await (
        await fetch(link.url, {
          method: 'POST',
          headers: { ...link.headers, 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name, arguments: args } }),
        })
      ).json();
      if (reply.error) throw Error(reply.error.message);
      if (reply.result.isError) throw Error(reply.result.content[0].text);
      return reply.result.content;
    };
    if (prompt !== '-') {
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    await page.waitForSelector('[aria-label="AI prompt"]:not([disabled])', { timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(out, 'before-send.png') });
    await page.getByLabel('AI prompt').fill(prompt);
    const started = Date.now();
    await page.getByLabel('AI prompt').press('Enter');
    log('sent', prompt, 'brain', brain);
    for (let i = 0; i < 24 && !(await page.evaluate(() => window.desktop.aiStatus())).busy; i++) await page.waitForTimeout(2500);
    if (!(await page.evaluate(() => window.desktop.aiStatus())).busy) {
      await page.screenshot({ path: path.join(out, 'not-sent.png') });
      throw Error('The prompt did not start a task.');
    }
    while ((await page.evaluate(() => window.desktop.aiStatus())).busy) {
      if (Date.now() - started > 40 * 60000) throw Error('timeout');
      await page.waitForTimeout(5000);
    }
    log('finished after', Math.round((Date.now() - started) / 1000), 's');
    if (prompt !== '-') fs.writeFileSync(path.join(out, 'chat.txt'), await page.locator('.ai-messages').innerText());
    if (prompt !== '-' && (await page.locator('.ai-art .ai-part-toggle:not([disabled])').count())) {
      await page.locator('.ai-art .ai-part-toggle').first().click();
      await page.waitForTimeout(400);
      await page.locator('section.ai-assistant').screenshot({ path: path.join(out, 'console.png') }).catch(() => {});
    }
    }
    const context = JSON.parse((await tool('mdlxl_context'))[0].text);
    const target = context.target;
    await tool('mdlxl_view', { target, view: 'perspective', renderMode: 'textured', fit: 'model' });
    if (prompt === '-') await tool('mdlxl_command', { target, id: 'showVertices' }).catch(e => log('vertices toggle', e.message));
    const shots = await tool('mdlxl_capture', {
      target,
      samples: ['perspective', 'front', 'left', 'back', 'top'].map(view => ({ view })),
    });
    let n = 0;
    for (const c of shots)
      if (c.type === 'image') fs.writeFileSync(path.join(out, `view-${++n}.png`), Buffer.from(c.data, 'base64'));
    await tool('mdlxl_view', { target, view: 'perspective' });
    await tool('mdlxl_document', { target, action: 'export', path: path.join(out, 'result.mdx'), format: 'mdx' }).catch(e =>
      log('export failed', e.message),
    );
    const stats = JSON.parse((await tool('mdlxl_script', { target, code: 'return {geosets:model.Geosets.length,triangles:model.Geosets.reduce((s,g)=>s+g.Faces.length/3,0),textures:model.Textures.map(t=>t.Image)};' }))[0].text);
    log('stats', JSON.stringify(stats));
  } catch (error) {
    log('error', error.stack);
    if (page) await page.screenshot({ path: path.join(out, 'error.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    for (const f of fs.readdirSync(path.join(out, 'profile', 'ai')).filter(f => /^chat-.*\.json$/.test(f)))
      fs.copyFileSync(path.join(out, 'profile', 'ai', f), path.join(out, f));
    // Close the whole test app tree (its renderer and Codex child), never another process.
    try {
      execSync(`taskkill /PID ${app.process().pid} /T /F`, { stdio: 'ignore' });
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Remove the junction only, never the shared Codex folder behind it.
    execSync(`cmd /c rmdir "${path.join(out, 'profile', 'ai', 'codex')}"`);
  }
})();
