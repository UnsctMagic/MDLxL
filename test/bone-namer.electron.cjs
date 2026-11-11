const { launchApp, closeApp, stubDialogs, waitForInfo, infoMessageCursor } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
// Bone Namer in the packaged app, the user's way: node test/bone-namer.electron.cjs
// (or pnpm run test:packaged default bone-namer). Opens the native SD Footman, whose left hand bone is named
// Bone_Hand_R, goes Bones mode → Bone Namer and uses only real clicks, drags, wheel, keys and the list's
// dropdowns (the same selectOption Attachemator's test uses). The test hook is read only to check results:
// the main model's names, the preview's camera and which labels the preview's overlay canvas draws.
// Contract: docs/agent-tasks/bone-namer.md, "The window".
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TOOLTIP = "Renames the rig's bones to Warcraft III's standard names (Bone_Head, Bone_Arm1_L, Bone_Hand_L…) from the parts POSE recognises. Opens a preview first; nothing changes until Commit.";
const STATUS = 'Click a row or a bone to see its name. Drag empty space to turn the camera.';

(async () => {
  const source = path.resolve(process.env.MDLXL_BONE_NAMER_MODEL || fixturePath('footman'));
  if (!fs.existsSync(source)) { console.log(`Skipped: ${source} is missing.`); return; }
  const output = path.resolve('out/bone-namer-ui'), models = path.join(output, 'model');
  fs.rmSync(models, { recursive: true, force: true }); fs.mkdirSync(models, { recursive: true });
  const fixture = path.join(models, 'Footman.mdx');
  fs.copyFileSync(source, fixture);
  if (fs.existsSync(path.join(path.dirname(source), 'Textures'))) fs.cpSync(path.join(path.dirname(source), 'Textures'), path.join(models, 'Textures'), { recursive: true });
  // A view-only copy (HD content is decoded for viewing only), made from the classic MDX800 Footman the way
  // top-bar-layout makes one. It has the same misnamed left hand.
  const { openDocument } = await import('../src/editor-document.js');
  const classic = path.resolve(fixturePath('citadel-footman'));
  assert.ok(fs.existsSync(classic), `missing ${classic}`);
  const hd = openDocument(fs.readFileSync(classic), 'HD Footman.mdx'); hd.convertVersion(1000);
  hd.apply('HD view-only fixture', ['Materials'], model => { model.Materials[0].Shader = 'Shader_HD_DefaultUnit'; });
  const hdPath = path.join(models, 'HD Footman.mdx'); fs.writeFileSync(hdPath, Buffer.from(hd.serialize('mdx')));
  assert.equal(openDocument(fs.readFileSync(hdPath), 'HD Footman.mdx').readOnly, true, 'the HD copy opens view-only');

  // Behaviour checks are collected so one run reports every broken promise; setup failures stop at once.
  const failures = [];
  const check = (ok, message) => { if (ok) console.log(`ok   ${message}`); else { failures.push(message); console.error(`FAIL ${message}`); } };
  const shot = name => page.screenshot({ path: path.join(output, name) }).catch(() => {});

  const errors = [];
  const { app, page } = await launchApp({ out: output, profile: path.join(output, 'profile-' + Date.now()), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture, errors, pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1500, height: 950 }, show: 'inactive' });
  try {
    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({ timeout: 60000 });
    await page.waitForFunction(() => window.__mdlxl?.model()?.Bones?.length > 0);
    const mainNames = () => page.evaluate(() => Object.fromEntries((window.__mdlxl.model().Nodes || []).filter(Boolean).map(node => [node.ObjectId, node.Name])));
    const mainShape = () => page.evaluate(() => JSON.stringify((window.__mdlxl.model().Nodes || []).filter(Boolean).map(node => [node.ObjectId, node.Parent ?? null, Array.from(node.PivotPoint || [])])));
    const originalNames = await mainNames(), originalShape = await mainShape();
    const idOf = name => Number(Object.keys(originalNames).find(id => originalNames[id] === name));
    const handId = idOf('Bone_Hand_R');
    assert.ok(handId >= 0, 'the fixture has a Bone_Hand_R');

    // Records the labels the Bone Namer preview's overlay canvas draws: every overlay frame starts with
    // clearRect, then fillText draws each label. Observation only; nothing is driven through it.
    await page.evaluate(() => {
      const state = window.__bnmOverlay = { frames: 0, current: [] };
      const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect, fill = proto.fillText;
      const ours = context => context.canvas?.dataset && 'nodeOverlay' in context.canvas.dataset && !!context.canvas.closest?.('.bnm-window');
      proto.clearRect = function (...args) { if (ours(this)) { state.frames++; state.current = []; } return clear.apply(this, args); };
      proto.fillText = function (text, ...args) { if (ours(this)) state.current.push(String(text)); return fill.call(this, text, ...args); };
    });
    const overlay = () => page.evaluate(() => ({ frames: window.__bnmOverlay.frames, labels: [...new Set(window.__bnmOverlay.current)].sort() }));
    const waitLabels = async (expected, after) => {
      const want = [...expected].sort();
      const ok = await page.waitForFunction(({ want, after }) => window.__bnmOverlay.frames > after && JSON.stringify([...new Set(window.__bnmOverlay.current)].sort()) === JSON.stringify(want), { want, after }, { timeout: 10000 }).then(() => true, () => false);
      return { ok, actual: (await overlay()).labels };
    };

    // 1. Bones mode → Tools: Bone Namer beside Attachemator, with its tooltip, opens the window.
    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor({ timeout: 60000 });
    const button = page.getByRole('button', { name: 'Bone Namer', exact: true });
    await button.waitFor();
    const attachemator = page.getByRole('button', { name: 'Attachemator', exact: true });
    check(await button.getAttribute('title') === TOOLTIP, 'the Bone Namer button has the contract tooltip');
    check(await button.evaluate(element => element.previousElementSibling?.textContent === 'Attachemator'), 'Bone Namer sits right after Attachemator');
    const [ourBox, theirBox] = [await button.boundingBox(), await attachemator.boundingBox()];
    check(Math.abs(ourBox.height - theirBox.height) <= 1 && Math.abs(ourBox.width - theirBox.width) <= 1 && await button.getAttribute('class') === await attachemator.getAttribute('class'), `Bone Namer has Attachemator's size and class (${JSON.stringify([ourBox, theirBox])})`);
    check(await page.locator('.bnm-window').count() === 0, 'no Bone Namer window before the click');
    await shot('1-bones-tools.png');

    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Bone Namer', exact: true });
    await dialog.waitFor();
    await page.locator('.bnm-window .atm-preview canvas').first().waitFor();
    const rows = page.locator('.bnm-window .bnm-row[role=row]').filter({ has: page.locator('span[role=cell]') });
    const row = name => rows.filter({ has: page.locator('span[role=cell]:nth-child(2)', { hasText: new RegExp(`^${name}$`) }) });
    const newName = name => row(name).locator('span[role=cell]').nth(2).innerText();
    const ticked = name => row(name).getByRole('checkbox', { name: 'Rename bone' }).isChecked();
    const partOf = name => row(name).getByRole('combobox', { name: 'Part' }).evaluate(select => select.selectedOptions[0]?.textContent);
    const sideOf = name => row(name).getByRole('combobox', { name: 'Side' }).evaluate(select => select.selectedOptions[0]?.textContent);
    const status = () => page.locator('.bnm-window footer [role=status]').innerText();
    const commit = dialog.getByRole('button', { name: 'Commit', exact: true });
    const waitNewName = async (name, expected) => page.waitForFunction(({ name, expected }) => [...document.querySelectorAll('.bnm-window .bnm-row[role=row]')].some(element => element.children[1]?.textContent === name && element.children[2]?.textContent === expected), { name, expected }, { timeout: 5000 }).then(() => true, () => false);

    // 2. The list: current → new name, the misnamed left hand ticked, unrecognised bones kept and unticked.
    const rigCount = await page.evaluate(() => (window.__mdlxl.model().Bones || []).length + (window.__mdlxl.model().Helpers || []).length);
    assert.equal(await rows.count(), rigCount, 'one row per bone and helper');
    check(await dialog.getByRole('columnheader', { name: 'Current name' }).count() === 1 && await dialog.getByRole('columnheader', { name: 'New name' }).count() === 1, 'the list has Current name and New name columns');
    check(await newName('Bone_Hand_R') === 'Bone_Hand_L', 'Bone_Hand_R (the left hand) is proposed as Bone_Hand_L');
    check(await ticked('Bone_Hand_R'), 'the renamed hand starts ticked');
    check(await partOf('Bone_Hand_R') === 'Hand' && await sideOf('Bone_Hand_R') === 'Left', 'the hand row shows Part Hand, Side Left');
    check(await newName('Bone_Head') === 'Bone_Head' && !await ticked('Bone_Head'), 'an already right name is shown and changes nothing (unticked)');
    for (const kept of ['Box04', 'Mesh02', 'Cantine']) {
      check(await partOf(kept) === 'Keep name' && await newName(kept) === kept && !await ticked(kept), `unrecognised ${kept} shows Keep name, unticked`);
    }
    check(await dialog.getByText('Not recognised', { exact: true }).count() === 1, 'unrecognised bones are grouped under Not recognised');
    check(await dialog.getByRole('combobox', { name: 'Actor' }).count() === 0, 'one actor: no Main/Mount group header');
    check(await status() === STATUS, 'the footer shows the click/drag hint');
    check(await commit.isEnabled(), 'Commit is active with a ticked change');
    check(await row('Bone_Hand_R').locator('span[role=cell]').nth(2).getAttribute('translate') === 'no', 'new names are marked translate="no"');
    // Layout the user reads: one line per bone, the Part dropdown wide enough to show its part.
    const middle = box => box.y + box.height / 2;
    const nameBox = await row('Bone_Hand_R').locator('span[role=cell]').nth(1).boundingBox();
    const partBox = await row('Bone_Hand_R').getByRole('combobox', { name: 'Part' }).boundingBox(), sideBox = await row('Bone_Hand_R').getByRole('combobox', { name: 'Side' }).boundingBox();
    const grid = await row('Bone_Hand_R').evaluate(element => getComputedStyle(element).gridTemplateColumns);
    console.log(`note stylesheet order: ${await page.evaluate(() => [...document.styleSheets].map(sheet => (sheet.href || 'inline').split('/').pop()).filter(name => /attachemator|BoneNamer/.test(name)).join(' then '))}`);
    // This session is fresh and Attachemator has not been opened, so attachemator.css loads after Bone Namer's:
    // the case where the Part column shrank to 20 px (fix round 1, item 9).
    check(partBox.width >= 60, `opened first in a fresh session, the Part column is at least 60 px wide (${Math.round(partBox.width)} px; row columns "${grid}")`);
    check(Math.abs(middle(partBox) - middle(nameBox)) <= 8 && Math.abs(middle(sideBox) - middle(nameBox)) <= 8,
      `each row is one line (Part at y ${Math.round(middle(partBox))}, Side at y ${Math.round(middle(sideBox))}, name at y ${Math.round(middle(nameBox))})`);
    await shot('2-window.png');

    // 5. Camera: drag empty preview space with the left button.
    const previewRoot = '.bnm-window .atm-preview .game-preview-root';
    await page.waitForFunction(root => !!mdlxlProbe(document.querySelector(root)).runtime && !!mdlxlProbe(document.querySelector(root)).props, previewRoot);
    const camera = () => page.evaluate(root => {
      const state = mdlxlProbe(document.querySelector(root)).runtime;
      if (!state) throw Error('Bone Namer preview camera not found');
      return { position: state.controls.object.position.toArray(), quaternion: state.controls.object.quaternion.toArray() };
    }, previewRoot);
    const sameCamera = (a, b, tolerance = 1e-4) => a.position.every((value, i) => Math.abs(value - b.position[i]) <= tolerance) && a.quaternion.every((value, i) => Math.abs(value - b.quaternion[i]) <= tolerance);
    const previewProps = () => page.evaluate(root => {
      const props = mdlxlProbe(document.querySelector(root)).props;
      return { names: Object.fromEntries(props.model.Nodes.filter(Boolean).map(node => [node.ObjectId, node.Name])), pivots: Object.fromEntries(props.model.Nodes.filter(Boolean).map(node => [node.ObjectId, Array.from(node.PivotPoint || [])])), selected: [...(props.selectedNodeIds || [])] };
    }, previewRoot);
    const project = point => page.evaluate(({ root, point }) => {
      const state = mdlxlProbe(document.querySelector(root)).runtime, view = state.controls.object;
      const bounds = document.querySelector(root).querySelector('canvas').getBoundingClientRect(), projected = view.position.clone().set(...point).project(view);
      return { x: bounds.x + (projected.x + 1) * bounds.width / 2, y: bounds.y + (1 - projected.y) * bounds.height / 2 };
    }, { root: previewRoot, point });
    const framesDrawn = async after => page.waitForFunction(after => window.__bnmOverlay.frames > after, after, { timeout: 10000 }).then(() => true, () => false);
    const twoFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    await framesDrawn(0);
    const before = await camera(), box = await page.locator(`${previewRoot} canvas`).first().boundingBox();
    let mark = (await overlay()).frames;
    await page.mouse.move(box.x + box.width * .1, box.y + box.height * .85); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .35, box.y + box.height * .8, { steps: 12 }); await page.mouse.up();
    await framesDrawn(mark);
    const turned = await camera();
    check(!sameCamera(before, turned, 1e-3), 'a left drag on empty preview space turns the camera');
    check((await previewProps()).selected.length === 0 && await page.locator('.bnm-window .bnm-row.is-selected').count() === 0, 'the empty-space drag selects nothing');
    // 4 (nothing selected). The overlay drew frames during the drag; none of them may carry labels.
    check((await overlay()).labels.length === 0, `nothing selected: the preview draws no labels (drew ${JSON.stringify((await overlay()).labels)})`);

    // 4. Clicking a row selects its bone and labels its limb with the NEW names.
    mark = (await overlay()).frames;
    await row('Bone_Hand_R').locator('span[role=cell]').nth(1).click();
    check(await row('Bone_Hand_R').evaluate(element => element.classList.contains('is-selected')), 'clicking a row selects it');
    check((await previewProps()).selected.join() === String(handId), 'clicking the hand row selects that bone in the preview');
    let labels = await waitLabels(['Bone_Arm1_L', 'Bone_Arm2_L', 'Bone_Hand_L'], mark);
    check(labels.ok, `the hand row labels the left arm with new names Bone_Arm1_L, Bone_Arm2_L, Bone_Hand_L (drew ${JSON.stringify(labels.actual)})`);
    await shot('3-row-labels.png');

    // 3. Side flips _L/_R; the labels follow the bone to the other arm.
    mark = (await overlay()).frames;
    await row('Bone_Hand_R').getByRole('combobox', { name: 'Side' }).selectOption({ label: 'Right' });
    check(await waitNewName('Bone_Hand_R', 'Bone_Hand_R'), 'Side Right turns the proposal into Bone_Hand_R');
    check(!await commit.isEnabled(), 'with nothing left to rename, Commit is inactive');
    labels = await waitLabels(['Bone_Arm1_R', 'Bone_Arm2_R', 'Bone_Hand_R'], mark);
    check(labels.ok, `after Side Right the labels show the right arm (drew ${JSON.stringify(labels.actual)})`);
    await row('Bone_Hand_R').getByRole('combobox', { name: 'Side' }).selectOption({ label: 'Left' });
    check(await waitNewName('Bone_Hand_R', 'Bone_Hand_L'), 'Side Left turns it back into Bone_Hand_L');

    // 3. A part change re-ticks the row: untick the hand, then correct its part.
    await row('Bone_Hand_R').getByRole('checkbox', { name: 'Rename bone' }).click();
    check(!await ticked('Bone_Hand_R') && !await commit.isEnabled(), 'unticking the hand leaves nothing to commit');
    await row('Bone_Hand_R').getByRole('combobox', { name: 'Part' }).selectOption({ label: 'Arm' });
    check(await waitNewName('Bone_Hand_R', 'Bone_Arm3_L') && await ticked('Bone_Hand_R'), 'Part Arm re-ticks the row and numbers it Bone_Arm3_L');
    await row('Bone_Hand_R').getByRole('combobox', { name: 'Part' }).selectOption({ label: 'Hand' });
    check(await waitNewName('Bone_Hand_R', 'Bone_Hand_L') && await ticked('Bone_Hand_R'), 'Part Hand gives Bone_Hand_L again, ticked');

    // 3. Keep name on the upper arm unticks it and renumbers the arm below it.
    mark = (await overlay()).frames;
    await row('Bone_Arm1_L').getByRole('combobox', { name: 'Part' }).selectOption({ label: 'Keep name' });
    check(await waitNewName('Bone_Arm2_L', 'Bone_Arm1_L_2'), `Keep name on Bone_Arm1_L renumbers the forearm to Arm1 (unique: Bone_Arm1_L_2; shows ${await newName('Bone_Arm2_L')})`);
    check(!await ticked('Bone_Arm1_L') && await row('Bone_Arm1_L').getByRole('checkbox', { name: 'Rename bone' }).isDisabled() && await newName('Bone_Arm1_L') === 'Bone_Arm1_L', 'Keep name unticks the row and keeps its name');
    check(await ticked('Bone_Arm2_L'), 'the renumbered forearm is ticked');
    check(await newName('Bone_Hand_R') === 'Bone_Hand_L', 'the hand keeps Bone_Hand_L');
    // 5. None of these list edits reset the camera the user turned.
    await page.waitForFunction(root => Object.values(mdlxlProbe(document.querySelector(root)).props.model.Nodes).some(node => node?.Name === 'Bone_Arm1_L_2'), previewRoot, { timeout: 5000 }).catch(() => {});
    await framesDrawn(mark); await twoFrames();
    const afterEdits = await camera();
    check(sameCamera(turned, afterEdits), `list edits keep the camera where the user turned it (before ${JSON.stringify(turned.position)}, after ${JSON.stringify(afterEdits.position)})`);
    check((await previewProps()).names[idOf('Bone_Arm2_L')] === 'Bone_Arm1_L_2', 'the preview shows the renamed copy');
    await shot('4-changed.png');

    // 4. Clicking a bone in the preview selects its row and scrolls it into view.
    const list = page.locator('.bnm-window .atm-list');
    const listBox = await list.boundingBox();
    const scrollable = await list.evaluate(element => element.scrollHeight > element.clientHeight + 4);
    if (scrollable) {
      await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
      for (let i = 0; i < 10 && !await list.evaluate(element => element.scrollTop + element.clientHeight >= element.scrollHeight - 2); i++) {
        const top = await list.evaluate(element => element.scrollTop);
        await page.mouse.wheel(0, 600);
        await page.waitForFunction(top => document.querySelector('.bnm-window .atm-list').scrollTop !== top, top, { timeout: 2000 }).catch(() => {});
      }
    }
    const footId = idOf('Bone_Foot_L');
    const inList = async name => { const rowBox = await row(name).boundingBox(), outer = await list.boundingBox(); return !!rowBox && rowBox.y >= outer.y - 1 && rowBox.y + rowBox.height <= outer.y + outer.height + 1; };
    const footHiddenBefore = scrollable ? !await inList('Bone_Foot_L') : null;
    const footPoint = await project((await previewProps()).pivots[footId]);
    mark = (await overlay()).frames;
    await page.mouse.click(footPoint.x, footPoint.y);
    const footSelected = await page.waitForFunction(() => document.querySelector('.bnm-window .bnm-row.is-selected')?.children[1]?.textContent === 'Bone_Foot_L', null, { timeout: 5000 }).then(() => true, () => false);
    check(footSelected, `clicking Bone_Foot_L in the preview selects its row (selected: ${await page.evaluate(() => document.querySelector('.bnm-window .bnm-row.is-selected')?.children[1]?.textContent ?? 'none')})`);
    if (scrollable) check(footHiddenBefore && await inList('Bone_Foot_L'), 'the selected row is scrolled into view');
    else console.log('note the list fits without scrolling at 1500x950; scroll-into-view not exercised');
    labels = await waitLabels(['Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L'], mark);
    check(labels.ok, `the foot labels the left leg Bone_Leg1_L, Bone_Leg2_L, Bone_Foot_L (drew ${JSON.stringify(labels.actual)})`);
    await shot('5-preview-click.png');
    // Nothing can be moved: a drag that starts on the foot leaves every pivot where it was.
    const pivotsBefore = JSON.stringify((await previewProps()).pivots);
    await page.mouse.move(footPoint.x, footPoint.y); await page.mouse.down();
    await page.mouse.move(footPoint.x + 40, footPoint.y - 30, { steps: 10 }); await page.mouse.up();
    await twoFrames();
    check(JSON.stringify((await previewProps()).pivots) === pivotsBefore && await mainShape() === originalShape, 'dragging from a bone moves nothing');

    // 7. Unapplied work (fix round 1, item 8): Close and × close at once like Attachemator's, with no
    // question, and rename nothing; Escape still asks for a second press.
    const discardQuestion = () => page.getByRole('dialog', { name: /^Discard Bone Namer/ }).count();
    const closesAtOnce = async (control, what) => {
      check(await newName('Bone_Arm2_L') === 'Bone_Arm1_L_2', `${what}: the window holds an unapplied change`);
      await control.click();
      check(await dialog.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false) && await discardQuestion() === 0, `${what} with an unapplied change closes at once, no question`);
      check(JSON.stringify(await mainNames()) === JSON.stringify(originalNames), `${what} renames nothing`);
      if (await dialog.count()) { await shot(`6-${what.replace(/\W+/g, '-')}-stayed-open.png`); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {}); }
    };
    // Reopens the window and makes the same unapplied change again (the upper arm kept, the forearm renumbered).
    const reopenWithChange = async () => {
      await button.click(); await dialog.waitFor();
      check(await newName('Bone_Arm2_L') === 'Bone_Arm2_L', 'reopening after closing without Commit starts from the fresh proposal');
      await row('Bone_Arm1_L').getByRole('combobox', { name: 'Part' }).selectOption({ label: 'Keep name' });
      await waitNewName('Bone_Arm2_L', 'Bone_Arm1_L_2');
    };
    await closesAtOnce(dialog.getByRole('button', { name: 'Close', exact: true }), 'footer Close');
    await reopenWithChange();
    await closesAtOnce(dialog.getByRole('button', { name: 'Close Bone Namer', exact: true }), 'title bar ×');
    await reopenWithChange();
    // Escape: the first press only warns, the second discards.
    await row('Bone_Head').locator('span[role=cell]').nth(1).click();
    await page.keyboard.press('Escape');
    const cue = await page.locator('.hotkeys-discard-cue').waitFor({ timeout: 3000 }).then(() => true, () => false);
    check(cue && /Press Esc again to discard/.test(await page.locator('.hotkeys-discard-cue').innerText()) && await dialog.count() === 1, 'the first Escape with an unapplied change warns and keeps the window');
    if (await dialog.count() === 1) {
      await page.keyboard.press('Escape');
      check(await dialog.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false), 'the second Escape closes and discards');
    }
    check(JSON.stringify(await mainNames()) === JSON.stringify(originalNames), 'closing without Commit renamed nothing');

    // 7. No change: Close and Escape close at once, without asking.
    await button.click(); await dialog.waitFor();
    check(await newName('Bone_Arm2_L') === 'Bone_Arm2_L' && await newName('Bone_Hand_R') === 'Bone_Hand_L', 'reopening starts from the fresh proposal');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    check(await dialog.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false) && await discardQuestion() === 0, 'with no change, Close closes at once');
    await button.click(); await dialog.waitFor();
    await row('Bone_Head').locator('span[role=cell]').nth(1).click();
    await page.keyboard.press('Escape');
    check(await dialog.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false) && await discardQuestion() === 0, 'with no change, one Escape closes at once');

    // 6. Commit: the default hand fix, a part the user assigns (Box02 → Neck), and an assigned-but-unticked row.
    await button.click(); await dialog.waitFor();
    await page.locator(`${previewRoot} canvas`).first().waitFor();
    await row('Box02').getByRole('combobox', { name: 'Part' }).selectOption({ label: 'Neck' });
    check(await waitNewName('Box02', 'Bone_Neck') && await ticked('Box02'), 'assigning Neck to Box02 proposes Bone_Neck, ticked');
    await row('Box04').getByRole('combobox', { name: 'Part' }).selectOption({ label: 'Tail' });
    check(await waitNewName('Box04', 'Bone_Tail1') && await ticked('Box04'), 'assigning Tail to Box04 proposes Bone_Tail1, ticked');
    await row('Box04').getByRole('checkbox', { name: 'Rename bone' }).click();
    check(!await ticked('Box04'), 'Box04 unticked');
    const expectedChanged = 2;
    const cursor = await infoMessageCursor(page);
    await commit.click();
    check(await dialog.waitFor({ state: 'hidden', timeout: 5000 }).then(() => true, () => false), 'Commit closes the window');
    // Fix round 1, item 10: "Bone Namer renamed {0} bone{1}." (plural like Attachemator's message).
    const message = await waitForInfo(page, /^Bone Namer renamed \d+ bones?\.$/, { after: cursor, timeout: 5000 }).catch(() => null);
    check(message === `Bone Namer renamed ${expectedChanged} bones.`, `the status says how many: "${message}"`);
    const committed = await mainNames();
    const expected = { ...originalNames, [handId]: 'Bone_Hand_L', [idOf('Box02')]: 'Bone_Neck' };
    check(JSON.stringify(committed) === JSON.stringify(expected), `Commit renamed exactly the ticked bones (diff: ${JSON.stringify(Object.keys(expected).filter(id => expected[id] !== committed[id]).map(id => [originalNames[id], committed[id], expected[id]]))})`);
    check(await mainShape() === originalShape, 'Commit changed names only: parents and pivots unchanged');
    check(await page.evaluate(() => window.__mdlxl.document().dirty === true), 'the document is modified');
    await shot('7-committed.png');

    // 6. One Ctrl+Z restores every old name.
    await page.keyboard.press('Control+z');
    const undone = await page.waitForFunction(original => JSON.stringify(Object.fromEntries((window.__mdlxl.model().Nodes || []).filter(Boolean).map(node => [node.ObjectId, node.Name]))) === original, JSON.stringify(originalNames), { timeout: 5000 }).then(() => true, () => false);
    check(undone, `one Ctrl+Z restores every old name (now ${JSON.stringify(Object.entries(await mainNames()).filter(([id, name]) => originalNames[id] !== name))})`);

    // Read-only document: the window opens for review, Commit stays disabled.
    await stubDialogs(app, { open: hdPath }); await page.keyboard.press('Control+o');
    await page.getByRole('tab', { name: 'HD Footman.mdx', exact: true }).waitFor();
    await page.getByRole('dialog', { name: 'HD models', exact: true }).getByRole('button', { name: 'Open view-only', exact: true }).click();
    await page.getByRole('dialog', { name: 'HD models', exact: true }).waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.__mdlxl.document()?.name === 'HD Footman.mdx' && window.__mdlxl.document()?.readOnly === true);
    if (!await page.getByLabel('Bones controller').count()) await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await button.waitFor();
    if (await button.isEnabled()) {
      await button.click(); await dialog.waitFor();
      check(await newName('Bone_Hand_R') === 'Bone_Hand_L' && await ticked('Bone_Hand_R'), 'read-only: the proposal is shown');
      check(!await commit.isEnabled(), 'read-only: Commit is disabled');
      await shot('8-read-only.png');
      await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    } else console.log('note read-only: the Bone Namer button is disabled');

    check(errors.length === 0, `no page errors (${JSON.stringify(errors)})`);
    if (failures.length) throw Error(`${failures.length} Bone Namer check(s) failed:\n- ${failures.join('\n- ')}`);
    console.log('Bone Namer passed.');
  } catch (error) { await shot('failure.png'); throw error; } finally { await closeApp(app); }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
