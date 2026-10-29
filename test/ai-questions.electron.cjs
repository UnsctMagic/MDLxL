// Run only through scripts/hidden-run.ps1 / the packaged suite on Windows.
// Uses a local protocol fixture, generated models and a disposable profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'D:/Claude/tools/node_modules/playwright-core');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-questions');
const checks = [], errors = [];
const check = (name, passed) => { checks.push({ name, passed: !!passed }); assert.ok(passed, name); };
let app, page;
(async () => {
  const profile = path.join(out, 'profile-' + Date.now()), ai = path.join(profile, 'ai');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ type: 'commonjs' }));
  fs.mkdirSync(ai, { recursive: true }); fs.mkdirSync(path.join(out, 'temp'), { recursive: true });
  fs.mkdirSync(path.join(out, 'bin'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../fixtures/ai-question-agent.cjs'), path.join(out, 'agent.js'));
  const executable = path.join(out, 'bin/codex.cmd');
  fs.writeFileSync(executable, '@"%dp0%\\..\\agent.js" %*\r\n');
  fs.writeFileSync(path.join(ai, 'connections.json'), JSON.stringify({ provider: 'codex', offload: true, providers: { codex: { executable, model: 'fixture-model' } } }));
  const { createStarterDocument } = await import('../src/starter-model.js');
  const model = createStarterDocument(), fixture = path.join(out, 'Question.mdx');
  fs.writeFileSync(fixture, model.serialize('mdx'));
  app = await _electron.launch({ executablePath: process.env.MDLXL_AI_TEST_EXE, args: [fixture], env: { ...process.env, MDLXL_PROFILE: profile, MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') }, timeout: 60000 });
  page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.unmaximize(); w.setContentSize(1440, 900); });
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  const prompt = page.getByLabel('AI prompt', { exact: true });
  await prompt.fill('Switch the arms');
  await page.waitForFunction(() => { const button = document.querySelector('.ai-send'); return button && !button.disabled; });
  await prompt.press('Control+Enter');
  const question = page.locator('.ai-question').last();
  await question.getByText('How should I switch the arms?', { exact: true }).waitFor();
  check('bird question is visible directly in organiser chat', await question.isVisible() && (await question.innerText()).includes('Waiting for your answer'));
  check('no answer is silently preselected', await question.getByRole('radio', { checked: true }).count() === 0 && !await question.getByRole('button', { name: 'Send answer', exact: true }).isEnabled());
  await question.getByRole('radio', { name: /Swap animation/ }).check();
  await question.getByLabel('What should stay unchanged?', { exact: true }).fill('Keep shoulders and enlarged axe');
  await page.screenshot({ path: path.join(out, 'question.png') });
  await question.getByRole('button', { name: 'Send answer', exact: true }).click();
  await page.locator('.ai-send[aria-label="Send"]').waitFor();
  check('answer reaches native provider and appears in organiser report', (await page.locator('.ai-messages').innerText()).includes('Answer received: Swap animation; Keep shoulders and enlarged axe'));
  const id = (await page.locator('.ai-roster button').allTextContents()).find(t => !t.includes('Organiser'));
  const bird = page.locator('.ai-roster button').filter({ hasText: id.trim() }).first();
  await bird.click();
  await page.locator('.ai-question').last().locator('.ai-message-note').filter({ hasText: /Answered/ }).waitFor();
  check('answered question persists in bird chat after switching', (await page.locator('.ai-question').last().innerText()).includes('Keep shoulders and enlarged axe'));
  await prompt.fill('free-text: clarify the axe'); await prompt.press('Control+Enter');
  await page.locator('.ai-question').last().getByText('Which arm should keep the axe?', { exact: true }).waitFor();
  await page.locator('.ai-question').last().getByLabel('Which arm should keep the axe?', { exact: true }).fill('The right arm');
  await page.locator('.ai-question').last().getByRole('button', { name: 'Send answer', exact: true }).click();
  await page.locator('.ai-send[aria-label="Send"]').waitFor();
  check('text-only question returns free text to native provider', (await page.locator('.ai-messages').innerText()).includes('Answer received: The right arm'));
  await prompt.fill('Switch the arms again'); await prompt.press('Control+Enter');
  await page.locator('.ai-question').last().getByText('How should I switch the arms?', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.locator('.ai-question').last().locator('.ai-message-note').filter({ hasText: /Question stopped/ }).waitFor();
  check('Stop removes stale answer controls', await page.locator('.ai-question').last().getByRole('button', { name: 'Send answer', exact: true }).count() === 0);
  const canvas = page.locator('.classic-view canvas').first(), box = await canvas.boundingBox(), before = await canvas.screenshot();
  await page.keyboard.down('Alt'); await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6, { steps: 16 }); await page.mouse.up(); await page.keyboard.up('Alt');
  await page.waitForTimeout(200);
  check('normal mouse drag still rotates the viewport', !before.equals(await canvas.screenshot()));
  check('no renderer errors', errors.length === 0);
})().catch(error => { checks.push({ name: 'exception', passed: false, error: error.stack }); process.exitCode = 1; }).finally(async () => {
  if (process.exitCode && page) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); fs.writeFileSync(path.join(out, 'failure.txt'), await page.locator('body').innerText().catch(() => 'unavailable')); }
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(checks, null, 2)); console.log(JSON.stringify(checks, null, 2));
});
