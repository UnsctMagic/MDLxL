// Pointer/keyboard input only. Locators identify coordinates; they never focus controls.
const assert = require('node:assert/strict');
async function click(page, locator, options = {}) {
  await locator.waitFor({state:'visible'});
  const box = await locator.boundingBox();
  assert.ok(box, 'Control has a visible hit target');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, options);
}
async function type(page, locator, text) {
  await click(page, locator);
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
}
async function orbit(page, stage) {
  const canvas = stage.locator('.game-preview-root canvas').first();
  await canvas.waitFor();
  const selector=await stage.evaluate(el=>el.classList.contains('gf-stage')?(el.closest('.pe-library')?'.pe-library .gf-stage .game-preview-root':'.tl-dialog .gf-stage .game-preview-root'):el.classList.contains('pe-source-stage')?'.pe-source-stage .game-preview-root':'.pe-preview .game-preview-root');
  await page.waitForFunction(selector=>mdlxlProbe(selector).runtime?.captureApi?.isReady,selector);
  const camera = () => stage.locator('.game-preview-root').evaluate(element => mdlxlProbe(element).runtime.controls.object.position.toArray());
  const before = await camera(), box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 35, {steps:8});
  await page.mouse.up();
  await page.waitForFunction(({selector,before}) => mdlxlProbe(selector).runtime.controls.object.position.toArray().some((value,index) => Math.abs(value-before[index])>0.001), {selector,before});
  assert.notDeepEqual(await camera(), before, 'Real mouse drag rotates the camera');
}
async function waitFile(file){
  const fs=require('node:fs/promises'),{setTimeout}=require('node:timers/promises'),deadline=Date.now()+10000;
  for(;;){try{return await fs.readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT'||Date.now()>deadline)throw error;await setTimeout(25);}}
}
// Personal recipes now use the shared Library tree (#491).
async function openEffectCollection(page, name) {
  const library=page.locator('.pe-library');await library.waitFor();
  await library.getByLabel('Find an effect',{exact:true}).fill('');
  for(const other of ['Warcraft','My presets','My work','Favorites']) {
    const row=library.getByRole('treeitem',{name:other,exact:true});
    if(other!==name && await row.count() && await row.getAttribute('aria-expanded')==='true') await row.click();
  }
  const row=library.getByRole('treeitem',{name,exact:true});await row.waitFor();
  if(await row.getAttribute('aria-expanded')!=='true') await row.click();
}
async function openEffect(page, name, collection='My presets') {
  const library=page.locator('.pe-library');
  await library.getByLabel('Find an effect',{exact:true}).fill(name);
  await library.locator('[data-effect-id][data-row^="'+collection+'/"]').filter({hasText:name}).last().dblclick();
  await library.waitFor({state:'hidden'});
}
module.exports = {click,type,orbit,waitFile,openEffectCollection,openEffect};
