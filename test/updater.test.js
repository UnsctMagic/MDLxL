import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizePreferences } from '../src/preferences.js';
const { Updater, newerVersion, releaseMetadata, summaryLines, externalURL, validateManifest, installPlan, digest, MANIFEST, extractArchive } = createRequire(import.meta.url)('../electron/updater.cjs');
const run = promisify(execFile);
const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const metadata = (version = '0.19.0') => ({ tag_name: `v${version}`, name: 'MDLxL', html_url: `https://github.com/UnsctMagic/MDLxL/releases/tag/v${version}`, body: '[English](https://github.com/UnsctMagic/MDLxL/blob/v0.19.0/docs/RELEASE-0.19.0.md)\n[Русский](https://github.com/UnsctMagic/MDLxL/blob/v0.19.0/docs/RELEASE-0.19.0-RU.md)\n[简体中文](https://github.com/UnsctMagic/MDLxL/blob/v0.19.0/docs/RELEASE-0.19.0-ZH-CN.md)', assets: [{ name: `MDLxL-${version}-win32-x64.zip`, browser_download_url: `https://github.com/UnsctMagic/MDLxL/releases/download/v${version}/MDLxL-${version}-win32-x64.zip` }] });
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-update-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'installed-Русский-中文'), source = path.join(directory, 'new');
  async function pack(root, version) {
    const contents = { 'MDLxL.exe': version, 'resources/app/package.json': JSON.stringify({ name: 'mdlxl', version }), 'resources/app/electron/main.cjs': 'program-' + version, 'resources/app/dist/index.html': 'renderer-' + version, 'Addons/default.json': 'addon-' + version, 'Backgrounds/default.png': 'image-' + version, 'BitsAndParts/default.mdx': 'model-' + version, 'Textures/default.blp': 'texture-' + version };
    const files = {};
    for (const [relative, text] of Object.entries(contents)) { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); files[relative] = await digest(file); }
    const manifest = { schema: 1, product: 'mdlxl', version, platform: 'win32', arch: 'x64', files };
    await fs.writeFile(path.join(root, MANIFEST), JSON.stringify(manifest));
    return manifest;
  }
  const previous = await pack(target, '0.18.8'), next = await pack(source, '0.19.0');
  return { directory, target, source, previous, next };
}
test('startup update checks are opt-in and versions compare numerically', () => {
  assert.equal(normalizePreferences({}).checkUpdatesOnStartup, false);
  assert.equal(normalizePreferences({checkUpdatesOnStartup:true}).checkUpdatesOnStartup, true);
  assert.equal(newerVersion('v0.19.0', '0.18.8'), true);
  assert.equal(newerVersion('v0.18.10', '0.18.9'), true);
  for (const version of ['0.18.8', '0.17.9', '0.19.0-beta.1', 'unrelated']) assert.equal(newerVersion(version, '0.18.8'), false);
  for (const field of ['prerelease','draft']) assert.equal(releaseMetadata({...metadata(),[field]:true}, '0.18.8'),null);
  assert.equal(releaseMetadata(metadata('0.18.8'), '0.18.8'),null);
});
test('0.21.1 offers the 0.21.2 full portable ZIP without downloading it during the check', async () => {
  const release = metadata('0.21.2'), requested = [];
  const updater = new Updater({ currentVersion: '0.21.1', packaged: true, fetcher: async url => {
    requested.push(url);
    return new Response(url.includes('/releases/latest') ? JSON.stringify(release) : '- EMTR and UV hotfix.');
  } });
  const offered = await updater.check('en');
  assert.equal(offered.state, 'available');
  assert.equal(offered.release.version, '0.21.2');
  assert.equal(updater.release.asset.name, 'MDLxL-0.21.2-win32-x64.zip');
  assert.equal(requested.some(url => url.endsWith('.zip')), false);
  assert.equal(releaseMetadata(release, '0.21.2'), null);
});
test('release links use the existing three logs and reject arbitrary targets', () => {
  assert.deepEqual(Object.keys(releaseMetadata(metadata(),'0.18.8').notes),['en','ru','zh']);
  assert.deepEqual(summaryLines('# Update\n- **One** [change](https://example.com)\n- Second\nDownload now'),['One change','Second']);
  assert.equal(externalURL('https://www.lowpolyworks.com'),true);
  for(const url of ['javascript:alert(1)','file:///C:/Windows','https://github.com.evil.test/UnsctMagic/MDLxL/releases/latest','https://github.com/other/repo/releases/latest']) assert.equal(externalURL(url),false);
});

test('official four-language posts provide localized summaries without downloading the ZIP', async()=>{
 const release=metadata('0.20.0');release.body='[English](https://www.lowpolyworks.com/mdlxl/?version=0.20.0&lang=en)\n[Русский](https://www.lowpolyworks.com/mdlxl/?version=0.20.0&lang=ru)\n[简体中文](https://www.lowpolyworks.com/mdlxl/?version=0.20.0&lang=zh)';
 const calls=[];const updater=new Updater({currentVersion:'0.19.0',fetcher:async url=>{calls.push(url);return new Response(JSON.stringify(url.includes('api.github')?release:{version:'0.20.0',notes:{en:'- Updates.',es:'- Actualizaciones y restauración.'}}));}});
 const status=await updater.check('es');assert.equal(status.state,'available');assert.deepEqual(status.release.summary,['Actualizaciones y restauración.']);assert.match(status.release.notes.es,/lang=es$/);assert.equal(calls[1],'https://www.lowpolyworks.com/mdlxl/releases/0.20.0.json');assert.equal(calls.length,2);assert.equal(updater.pending,false);
 assert.equal(externalURL(status.release.notes.es),true);
 for(const url of ['https://www.lowpolyworks.com.evil.test/mdlxl','https://www.lowpolyworks.com/mdlxl-evil','https://user:pass@www.lowpolyworks.com/mdlxl'])assert.equal(externalURL(url),false);
});
test('checks are deduplicated, retrieve the selected language, and never download the ZIP', async () => {
  const calls = [];
  const updater = new Updater({currentVersion:'0.18.8',packaged:true,fetcher:async url=>{calls.push(url);return new Response(url.includes('api.github')?JSON.stringify(metadata()):'- Исправлено сохранение.');}});
  await Promise.all([updater.check('ru'),updater.check('ru')]);
  assert.equal(calls.length,2); assert.ok(calls[1].endsWith('-RU.md'));
  assert.equal(updater.status().state,'available'); assert.deepEqual(updater.status().release.summary,['Исправлено сохранение.']);
  assert.equal(updater.pending,false); assert.equal(updater.prepared,undefined);
  assert.ok(!calls.some(url=>url.endsWith('.zip')));
});
test('offline checks report an error and notes failure still permits opening the log', async () => {
  const failed = new Updater({currentVersion:'0.18.8',fetcher:async()=>{throw Error('offline');}});
  assert.equal((await failed.check()).state,'error');
  const fallback = new Updater({currentVersion:'0.18.8',fetcher:async url=>{if(!url.includes('api.github'))throw Error('offline');return new Response(JSON.stringify(metadata()));}});
  const status = await fallback.check('zh'); assert.equal(status.state,'available'); assert.equal(status.release.summary.length,0); assert.ok(status.release.notes.zh);
});
test('manifest validation rejects traversal, duplicates and profile payloads', async t => {
  const {next} = await fixture(t);
  for(const relative of ['../personal.mdx','.mdlxl-installing/owner.json','resources/app/profile/settings.json','PROFILE/settings.json','resources\\app\\bad','CON.txt','resources/app/main.cjs.','mdlxL.exe']) assert.throws(()=>validateManifest({...next,files:{...next.files,[relative]:'a'.repeat(64)}},next.version));
});
test('installation preserves all profile, libraries, settings, saves and untracked files', async t => {
  const {directory,target,source,previous,next} = await fixture(t);
  const personal = ['resources/app/profile/settings.json','resources/app/profile/particles/my.mdx','resources/app/profile/recovery/save.mdl','Addons/default.json','Backgrounds/default.png','BitsAndParts/default.mdx','Textures/default.blp','Showcase Recordings/take.gif','resources/app/personal.mdx','My Save.mdl'];
  const before = {};
  for(const relative of personal){const file=path.join(target,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'personal '+relative);before[relative]=await digest(file);}
  const operations = await installPlan(source,target,next,previous);
  assert.ok(!operations.some(row=>/^(Addons|Backgrounds|BitsAndParts|Textures|Showcase Recordings)\//.test(row.relative)||row.relative.includes('/profile/')));
  const planFile = path.join(directory,'plan.json');
  await fs.writeFile(planFile,JSON.stringify({source,target,operations,pid:0,profile:path.join(target,'resources/app/profile'),result:path.join(directory,'result.json')}));
  await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('electron/update-install.ps1'),planFile],{windowsHide:true});
  const result=JSON.parse(await fs.readFile(path.join(directory,'result.json'),'utf8')); assert.equal(result.ok,true,result.error);
  assert.equal(await fs.readFile(path.join(target,'MDLxL.exe'),'utf8'),'0.19.0');
  assert.equal(JSON.parse(await fs.readFile(path.join(target,MANIFEST),'utf8')).version,'0.19.0');
  for(const relative of personal)assert.equal(await digest(path.join(target,relative)),before[relative],relative);
});
test('corruption and local program edits prevent installation before any files change', async t => {
  const {target,source,previous,next} = await fixture(t);
  await fs.writeFile(path.join(target,'MDLxL.exe'),'local modification');
  await assert.rejects(installPlan(source,target,next,previous),/local changes/);
  await fs.writeFile(path.join(target,'MDLxL.exe'),'0.18.8');
  await fs.writeFile(path.join(source,'MDLxL.exe'),'tampered');
  await assert.rejects(installPlan(source,target,next,previous),/verification failed/);
  assert.equal(await fs.readFile(path.join(target,'MDLxL.exe'),'utf8'),'0.18.8');
});
test('the Windows helper rolls back program files on a partial copy failure', async t => {
  const {directory,target,source} = await fixture(t);
  await fs.writeFile(path.join(target,'blocked'),'personal file');
  await fs.mkdir(path.join(source,'blocked'));await fs.writeFile(path.join(source,'blocked/second'),'new');
  const operations=[{relative:'MDLxL.exe',hash:await digest(path.join(source,'MDLxL.exe')),before:await digest(path.join(target,'MDLxL.exe'))},{relative:'blocked/second',hash:await digest(path.join(source,'blocked/second')),before:null}];
  const planFile=path.join(directory,'rollback.json');
  await fs.writeFile(planFile,JSON.stringify({source,target,operations,pid:0,profile:path.join(target,'resources/app/profile'),result:path.join(directory,'result.json')}));
  await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('electron/update-install.ps1'),planFile],{windowsHide:true});
  assert.equal(JSON.parse(await fs.readFile(path.join(directory,'result.json'),'utf8')).ok,false);
  assert.equal(await fs.readFile(path.join(target,'MDLxL.exe'),'utf8'),'0.18.8');
  assert.equal(await fs.readFile(path.join(target,'blocked'),'utf8'),'personal file');
});
test('download checksum mismatch never prepares an installer', async t => {
  const {target} = await fixture(t), release=metadata();
  release.assets[0].size=4;release.assets[0].digest='sha256:'+'0'.repeat(64);
  const updater=new Updater({currentVersion:'0.18.8',installRoot:target,packaged:true,fetcher:async url=>new Response(url.endsWith('.zip')?'evil':url.includes('api.github')?JSON.stringify(release):'- Fix')});
  await updater.check();await updater.prepare();
  assert.equal(updater.status().error,'Update verification failed.');assert.equal(updater.pending,false);assert.equal(updater.prepared,undefined);
});
test('Windows archive extraction rejects traversal before writing any entry', async t => {
  const {directory}=await fixture(t), zip=path.join(directory,'bad.zip'), destination=path.join(directory,'extract');
  await fs.mkdir(destination);
  const script=path.join(directory,'zip.ps1');
  await fs.writeFile(script,"param($Destination)\nAdd-Type -AssemblyName System.IO.Compression.FileSystem\n$zip=[IO.Compression.ZipFile]::Open($Destination,'Create')\n$null=$zip.CreateEntry('MDLxL-win32-x64/../../escape.mdx')\n$zip.Dispose()\n");
  await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,zip],{windowsHide:true});
  await assert.rejects(extractArchive(zip,destination));assert.deepEqual(await fs.readdir(destination),[]);
});
test('two updates retain exactly one previous version and offline revert restores it', async t => {
  const {directory,target,source,next} = await fixture(t);
  const profile=path.join(target,'resources/app/profile');await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'personal.json'),'my settings');
  async function update(currentVersion,version){
    const release=metadata(version);release.assets[0].size=4;release.assets[0].digest='sha256:'+await (async()=>{const file=path.join(directory,'archive');await fs.writeFile(file,'data');return digest(file);})();
    const updater=new Updater({currentVersion,installRoot:target,profile,packaged:true,fetcher:async url=>new Response(url.endsWith('.zip')?'data':url.includes('api.github')?JSON.stringify(release):'- Program update'),extract:async(_,destination)=>fs.cp(source,path.join(destination,'MDLxL-win32-x64'),{recursive:true})});
    await updater.initialize();await updater.check();await updater.prepare();
    assert.equal(updater.status().state,'ready',updater.status().error);
    const plan=JSON.parse(await fs.readFile(updater.prepared.planFile,'utf8'));plan.pid=0;await fs.writeFile(updater.prepared.planFile,JSON.stringify(plan));
    await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(updater.prepared.stage,'install.ps1'),updater.prepared.planFile],{windowsHide:true});
    const result=JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8'));assert.equal(result.ok,true,result.error);
  }
  await update('0.18.8','0.19.0');
  const retained=path.join(target,'.mdlxl-previous');
  assert.equal(JSON.parse(await fs.readFile(path.join(retained,'snapshot.json'),'utf8')).version,'0.18.8');
  assert.equal(await fs.readFile(path.join(retained,'MDLxL.exe'),'utf8'),'0.18.8');
  await fs.writeFile(path.join(source,'MDLxL.exe'),'0.20.0');next.files['MDLxL.exe']=await digest(path.join(source,'MDLxL.exe'));
  await fs.writeFile(path.join(source,'resources/app/package.json'),JSON.stringify({name:'mdlxl',version:'0.20.0'}));next.files['resources/app/package.json']=await digest(path.join(source,'resources/app/package.json'));next.version='0.20.0';await fs.writeFile(path.join(source,MANIFEST),JSON.stringify(next));
  await update('0.19.0','0.20.0');
  assert.equal(JSON.parse(await fs.readFile(path.join(retained,'snapshot.json'),'utf8')).version,'0.19.0');
  assert.equal(await fs.readFile(path.join(retained,'MDLxL.exe'),'utf8'),'0.19.0');
  const reverting=new Updater({currentVersion:'0.20.0',installRoot:target,profile,packaged:true,fetcher:async()=>{throw Error('network must not be used');}});
  await reverting.initialize();assert.equal(reverting.status().previousVersion,'0.19.0');await reverting.prepareRevert();assert.equal(reverting.status().state,'ready',reverting.status().error);
  const plan=JSON.parse(await fs.readFile(reverting.prepared.planFile,'utf8'));plan.pid=0;await fs.writeFile(reverting.prepared.planFile,JSON.stringify(plan));
  await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(reverting.prepared.stage,'install.ps1'),reverting.prepared.planFile],{windowsHide:true});
  const result=JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8'));assert.equal(result.ok,true,result.error);
  assert.equal(await fs.readFile(path.join(target,'MDLxL.exe'),'utf8'),'0.19.0');
  assert.equal(await fs.readFile(path.join(profile,'personal.json'),'utf8'),'my settings');
  await assert.rejects(fs.access(retained));
});


test('checksum-verified legacy ZIPs get a local manifest without changing the installed program', async t => {
  const {target,source}=await fixture(t);
  await fs.unlink(path.join(source,MANIFEST));
  const bytes=Buffer.from('verified legacy archive'),release=metadata();
  release.assets[0].size=bytes.length;
  release.assets[0].digest='sha256:'+createRequire(import.meta.url)('node:crypto').createHash('sha256').update(bytes).digest('hex');
  const updater=new Updater({currentVersion:'0.18.8',installRoot:target,profile:path.join(target,'resources/app/profile'),packaged:true,fetcher:async url=>new Response(url.includes('api.github')?JSON.stringify(release):bytes),extract:async(_,destination)=>fs.cp(source,path.join(destination,'MDLxL-win32-x64'),{recursive:true})});
  await updater.check();await updater.prepare();assert.equal(updater.status().state,'ready',updater.status().error);
  const plan=JSON.parse(await fs.readFile(updater.prepared.planFile,'utf8'));
  const generated=JSON.parse(await fs.readFile(path.join(plan.source,MANIFEST),'utf8'));
  assert.equal(validateManifest(generated,'0.19.0').version,'0.19.0');
  assert.equal(JSON.parse(await fs.readFile(path.join(target,'resources/app/package.json'),'utf8')).version,'0.18.8');
  updater.pending=false;await fs.rm(updater.prepared.stage,{recursive:true,force:true});
});
