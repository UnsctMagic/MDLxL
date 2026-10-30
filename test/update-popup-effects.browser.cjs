const { settle } = require('./helpers/app.cjs');
// Run after pnpm run build. Uses the optional external Playwright/browser runtime.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'out/update-popup-effects');fs.mkdirSync(output,{recursive:true});const run=fs.mkdtempSync(path.join(output,'browser-'));
const {welcomePromptHtml}=require(path.join(root,'electron/welcome-prompt.cjs'));
const options={heading:'Welcome to MDLxL',question:'Would you like to enable auto updating?',detail:'Detail',note:'Note',labels:{yes:'Yes, enable it',no:'No thanks'},icon:'data:image/png;base64,'+fs.readFileSync(path.join(root,'public/branding/MDLxL.png')).toString('base64'),theme:'light',effectsScript:fs.readFileSync(path.join(root,'dist/update-popup-effects.js'),'utf8')};
fs.writeFileSync(path.join(run,'popup-welcome-check.html'),welcomePromptHtml(options));
require(path.join(root,'node_modules/esbuild')).buildSync({entryPoints:[path.join(root,'test/fixtures/update-popup-effects.jsx')],bundle:true,platform:'browser',format:'iife',outfile:path.join(run,'popup-fixture.js'),jsx:'automatic',loader:{'.png':'dataurl'}});
fs.writeFileSync(path.join(run,'popup-fixture.html'),'<!doctype html><html><head><link rel="stylesheet" href="popup-fixture.css"></head><body><div id="root"></div><script src="popup-fixture.js"></script></body></html>');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.MDLXL_BROWSER_EXE,headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
try{
const errors=[],page=await browser.newPage({viewport:{width:760,height:600}});page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.stack);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text());}});
await page.addInitScript(()=>{
const Original=AudioContext;window.audios=[];window.AudioContext=class extends Original{constructor(...args){super(...args);const analyser=this.createAnalyser(),destination=this.destination,connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(target,...rest){if(target===destination){connect.call(this,analyser);connect.call(analyser,destination);}return connect.call(this,target,...rest);};window.audios.push({audio:this,analyser});}};
});
const file=name=>'file:///'+path.join(run,name).replaceAll('\\','/');
await page.goto(file('popup-welcome-check.html'));await page.evaluate(()=>window.prepareWelcomeEffects());
await page.evaluate(()=>{window.litAt=null;new MutationObserver(()=>{if(document.querySelector('.update-helmet').dataset.eyes==='lit'&&!window.litAt)window.litAt=performance.now();}).observe(document.querySelector('.update-helmet'),{attributes:true});window.openedAt=performance.now();window.startWelcomeEffects(false);});
await settle(page, 300);assert.equal(await page.locator('.update-helmet').getAttribute('data-eyes'),'dark');
await page.waitForFunction(()=>window.litAt!=null);const welcomeDelay=await page.evaluate(()=>window.litAt-window.openedAt);assert(welcomeDelay>=620&&welcomeDelay<760,welcomeDelay);
await settle(page, 150);const signal=await page.evaluate(()=>{const {audio,analyser}=window.audios[0],values=new Float32Array(2048);analyser.getFloatTimeDomainData(values);return {state:audio.state,nonzero:values.some(v=>Math.abs(v)>.0001)};});assert(signal.nonzero);assert.equal(signal.state,'running');
// Disable sounds in the welcome window silences the fanfare at once and is saved with the answer.
await page.locator('[data-sound]').check();await settle(page, 100);assert.equal(await page.evaluate(()=>window.audios[0].audio.state),'closed','Disable sounds mutes the welcome fanfare');
await page.locator('[data-action=yes]').click();assert.equal(await page.title(),'mdlxl-welcome:yes-mute');
await page.goto(file('popup-fixture.html'));await page.locator('.update-helmet[data-eyes=lit]').waitFor();assert.equal(await page.evaluate(()=>window.audios.length),1);
await page.evaluate(()=>window.updateStatus({state:'downloading'}));await settle(page, 50);assert.equal(await page.evaluate(()=>window.audios.length),1);
await page.evaluate(()=>{window.updateStatus({state:'available'});window.remountPopup();});await page.locator('.update-helmet[data-eyes=lit]').waitFor();assert.equal(await page.evaluate(()=>window.audios.length),1,'remount does not replay audio');
await page.locator('[data-hotkey="update:disableSounds"]').check();await settle(page, 100);assert.equal(await page.evaluate(()=>window.audios[0].audio.state),'closed');assert.equal(await page.locator('.update-helmet').getAttribute('data-eyes'),'lit');
await page.locator('[data-hotkey="update:disableSounds"]').uncheck();await settle(page, 100);assert.equal(await page.evaluate(()=>window.audios.length),1);
await page.locator('[data-hotkey="update:later"]').click();await page.evaluate(()=>window.updateStatus({}));await page.locator('.update-helmet[data-eyes=lit]').waitFor();assert.equal(await page.evaluate(()=>window.audios.length),2,'reopen plays once');
await settle(page, 8100);assert.equal(await page.evaluate(()=>window.audios[1].audio.state),'closed');assert.equal(await page.locator('.update-helmet').getAttribute('data-eyes'),'lit','eyes continue after sound ends');
await page.locator('[data-hotkey="update:later"]').click();assert.equal(await page.locator('.update-helmet').count(),0);assert.deepEqual(errors,[]);
fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({welcomeDelay,signal,normalPopupRemount:true,mute:true,reopen:true,eyesAfterSound:true,errors},null,2));console.log('PASS both production popup runtimes: '+welcomeDelay.toFixed(1)+' ms; nonzero sound; remount/progress no replay; mute; reopen; continuous eyes; no runtime errors.');
}finally{await browser.close();if(path.dirname(run)!==output)throw Error("Unexpected browser test directory");fs.rmSync(run,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
