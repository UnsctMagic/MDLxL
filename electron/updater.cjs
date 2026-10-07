const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const WEBSITE = 'https://www.lowpolyworks.com';
const REPOSITORY = 'UnsctMagic/MDLxL';
const MANIFEST = 'mdlxl-update-manifest.json';
const PREVIOUS = '.mdlxl-previous';
const PERSONAL = /^(?:Addons|Backgrounds|BitsAndParts|Textures)(?:\/|$)/i;
const PROTECTED = /^(?:resources\/app\/profile|profile|Showcase Recordings|\.mdlxl-previous)(?:\/|$)/i;
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const digest = async file => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');

function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value || '');
  return match ? match.slice(1).map(Number) : null;
}
function newerVersion(next, current) {
  const a = versionParts(next), b = versionParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function releaseURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && /^\/(?:UnsctMagic|KlugerA)\/MDLxL\/(?:releases\/|blob\/)/i.test(url.pathname) && !url.username && !url.password;
  } catch { return false; }
}
function externalURL(value) { return value === WEBSITE || value === WEBSITE + '/' || releaseURL(value); }
function releaseMetadata(release, current) {
  if (!release || release.draft || release.prerelease || !newerVersion(release.tag_name, current)) return null;
  const version = release.tag_name.replace(/^v/, '');
  const asset = release.assets?.find(item => item.name === `MDLxL-${version}-win32-x64.zip`);
  if (!asset || !releaseURL(asset.browser_download_url) || !releaseURL(release.html_url)) throw Error('The update package is unavailable.');
  const notes = {};
  for (const [, label, url] of (release.body || '').matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)) {
    if (!releaseURL(url)) continue;
    if (label === 'English') notes.en = url;
    if (label === 'Русский') notes.ru = url;
    if (label === '简体中文') notes.zh = url;
  }
  return { version, title: release.name || `MDLxL ${version}`, url: release.html_url, notes, asset, body: release.body || '', checksum: release.assets?.find(item => item.name === asset.name + '.sha256') };
}
function summaryLines(markdown) {
  return markdown.split(/\r?\n/).filter(line => /^\s*[-*]\s+/.test(line)).map(line => line.replace(/^\s*[-*]\s+/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').trim()).filter(Boolean);
}
function safeRelative(relative) {
  return typeof relative === 'string' && relative.length > 0 && relative.split('/').every(part => part && part !== '.' && part !== '..' && !/[\\:\x00-\x1f<>"|?*]/.test(part) && !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) && !PROTECTED.test(relative);
}
function validateManifest(manifest, version) {
  if (manifest?.schema !== 1 || manifest.product !== 'mdlxl' || manifest.platform !== 'win32' || manifest.arch !== 'x64' || manifest.version !== version || !manifest.files || Array.isArray(manifest.files)) throw Error('The update package is invalid.');
  const seen = new Set();
  for (const [relative, hash] of Object.entries(manifest.files)) {
    if (!safeRelative(relative) || relative === MANIFEST || !/^[a-f0-9]{64}$/.test(hash) || seen.has(relative.toLowerCase())) throw Error('The update package is invalid.');
    seen.add(relative.toLowerCase());
  }
  for (const file of ['MDLxL.exe', 'resources/app/package.json', 'resources/app/electron/main.cjs', 'resources/app/dist/index.html']) if (!manifest.files[file]) throw Error('The update package is invalid.');
  return manifest;
}
async function listFiles(root, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isSymbolicLink()) throw Error('Linked update paths are unsupported.');
    if (entry.isDirectory()) files.push(...await listFiles(root, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}
async function regularTarget(root, relative) {
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw Error('Linked update paths are unsupported.'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
  }
}
async function installPlan(source, target, next, previous) {
  validateManifest(next, next.version); validateManifest(previous, previous.version);
  if ((await fs.lstat(target)).isSymbolicLink() || await fs.realpath(target) !== path.resolve(target)) throw Error('Linked update paths are unsupported.');
  const actual = await listFiles(source);
  if (JSON.stringify(actual) !== JSON.stringify([...Object.keys(next.files), MANIFEST].sort())) throw Error('The update package is invalid.');
  const operations = [];
  for (const [relative, hash] of Object.entries(next.files)) {
    if (await digest(path.join(source, relative)) !== hash) throw Error('Update verification failed.');
    await regularTarget(target, relative);
    let existing = null;
    try { existing = await digest(path.join(target, relative)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Shipped examples and user libraries are only seeded where no file exists.
    if (PERSONAL.test(relative) && existing !== null || existing === hash) continue;
    if (existing !== null && existing !== previous.files[relative]) throw Error('A program file has local changes. Update was not installed.');
    operations.push({ relative, hash, before: existing });
  }
  // Remove only obsolete, unchanged files recorded by the installed package.
  for (const [relative, hash] of Object.entries(previous.files)) if (!next.files[relative] && !PERSONAL.test(relative)) {
    await regularTarget(target, relative);
    let existing;
    try { existing = await digest(path.join(target, relative)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (existing === hash) operations.push({ relative, hash: null, before: hash });
  }
  await regularTarget(target, MANIFEST);
  operations.push({ relative: MANIFEST, hash: await digest(path.join(source, MANIFEST)), before: await digest(path.join(target, MANIFEST)) });
  return operations;
}
async function extractArchive(archive, destination) {
  await run(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'update-extract.ps1'), archive, destination], { windowsHide: true, timeout: 180000 });
}

class Updater {
  constructor({ currentVersion, installRoot, profile, packaged, onStatus = () => {}, fetcher = fetch, extract = extractArchive }) {
    Object.assign(this, { currentVersion, installRoot, profile, packaged, onStatus, fetcher, extract });
    this.state = { state: 'idle', currentVersion, canInstall: packaged && process.platform === 'win32' && process.arch === 'x64' };
    this.pending = false;
    this.abortController=new AbortController();
  }
  status() { return this.state; }
  async initialize() {
    try {
      const snapshot = JSON.parse(await fs.readFile(path.join(this.installRoot, PREVIOUS, 'snapshot.json'), 'utf8'));
      if (snapshot.schema === 1 && snapshot.product === 'mdlxl' && newerVersion(this.currentVersion, snapshot.version)) this.publish({ previousVersion: snapshot.version });
    } catch (error) { if (error.code !== 'ENOENT') this.publish({ error: 'The previous version could not be read.' }); }
  }
  publish(change) { this.state = { ...this.state, ...change }; this.onStatus(this.state); return this.state; }
  async response(url, timeout = 20000) {
    const response = await this.fetcher(url, { headers: { 'User-Agent': `MDLxL/${this.currentVersion}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.any([this.abortController.signal,AbortSignal.timeout(timeout)]) });
    if (!response.ok) throw Error(response.status === 403 || response.status === 429 ? 'Update checks are temporarily limited. Try again later.' : 'Could not reach the update server.');
    return response;
  }
  async check(language = 'en') {
    if (this.checking) return this.checking;
    if (['downloading', 'ready', 'reverting'].includes(this.state.state)) return this.state;
    this.checking = this.performCheck(language).finally(() => { this.checking = null; });
    return this.checking;
  }
  async performCheck(language) {
    this.publish({ state: 'checking', error: null });
    try {
      const metadata = releaseMetadata(await (await this.response(`https://api.github.com/repos/${REPOSITORY}/releases/latest`)).json(), this.currentVersion);
      if (!metadata) { this.release = null; return this.publish({ state: 'current', release: null }); }
      const noteURL = metadata.notes[language] || metadata.notes.en;
      let summary = summaryLines(metadata.body);
      if (noteURL) {
        const raw = noteURL.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace('/blob/', '/');
        try { summary = summaryLines(await (await this.response(raw)).text()); }
        catch { /* The release page remains usable when its notes cannot be fetched. */ }
      }
      this.release = metadata;
      return this.publish({ state: 'available', release: { version: metadata.version, title: metadata.title, url: metadata.url, notes: metadata.notes, summary }, error: null });
    } catch (error) { return this.publish({ state: 'error', error: error.message }); }
  }
  async prepare() {
    if (this.preparing) return this.preparing;
    if (!this.state.canInstall || !this.release) throw Error('Updates can be installed in the portable Windows app.');
    this.preparing = this.performPrepare().finally(() => { this.preparing = null; });
    return this.preparing;
  }
  async performPrepare() {
    if (this.prepared) { this.pending = true; return this.publish({ state: 'ready', error: null }); }
    this.publish({ state: 'downloading', received: 0, total: this.release.asset.size, error: null });
    let stage;
    try {
      const previous = validateManifest(JSON.parse(await fs.readFile(path.join(this.installRoot, MANIFEST), 'utf8')), this.currentVersion);
      let checksum = /^sha256:([a-f0-9]{64})$/.exec(this.release.asset.digest || '')?.[1];
      if (!checksum && releaseURL(this.release.checksum?.browser_download_url)) checksum = /^([a-f0-9]{64})\s/i.exec(await (await this.response(this.release.checksum.browser_download_url)).text())?.[1].toLowerCase();
      if (!checksum) throw Error('The update checksum is unavailable.');
      stage = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-update-'));
      const archive = path.join(stage, 'update.zip'), file = await fs.open(archive, 'wx');
      const hash = crypto.createHash('sha256'); let received = 0, last = 0;
      try {
        const response = await this.response(this.release.asset.browser_download_url, 600000);
        for await (const bytes of response.body) {
          received += bytes.length;
          if (received > this.release.asset.size || received > 1024 * 1024 * 1024) throw Error('The update package is invalid.');
          hash.update(bytes); await file.writeFile(bytes);
          if (Date.now() - last > 250) { last = Date.now(); this.publish({ received }); }
        }
      } finally { await file.close(); }
      if (received !== this.release.asset.size || hash.digest('hex') !== checksum) throw Error('Update verification failed.');
      const destination = path.join(stage, 'extracted'); await fs.mkdir(destination);
      await this.extract(archive, destination);
      const source = path.join(destination, 'MDLxL-win32-x64');
      const next = validateManifest(JSON.parse(await fs.readFile(path.join(source, MANIFEST), 'utf8')), this.release.version);
      const packageInfo = JSON.parse(await fs.readFile(path.join(source, 'resources/app/package.json'), 'utf8'));
      if (packageInfo.name !== 'mdlxl' || packageInfo.version !== next.version) throw Error('The update package is invalid.');
      const operations = await installPlan(source, this.installRoot, next, previous);
      const snapshotRoot = path.join(stage, 'previous'); await fs.mkdir(snapshotRoot);
      const snapshotFiles = {};
      for (const relative of [...Object.keys(previous.files).filter(file => !PERSONAL.test(file)), MANIFEST]) {
        await regularTarget(this.installRoot, relative);
        const original = path.join(this.installRoot, relative), copy = path.join(snapshotRoot, relative);
        try { await fs.mkdir(path.dirname(copy), { recursive: true }); await fs.copyFile(original, copy); snapshotFiles[relative] = await digest(copy); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      await fs.writeFile(path.join(snapshotRoot, 'snapshot.json'), JSON.stringify({schema:1,product:'mdlxl',version:previous.version,files:snapshotFiles}));
      const plan = { source, target: this.installRoot, operations, snapshotRoot, mode: 'update', pid: process.pid, executable: path.join(this.installRoot, 'MDLxL.exe'), profile: this.profile, result: path.join(this.profile, 'update-result.json') };
      const planFile = path.join(stage, 'plan.json');
      await fs.copyFile(path.join(__dirname, 'update-install.ps1'), path.join(stage, 'install.ps1'));
      await fs.writeFile(planFile, JSON.stringify(plan));
      this.prepared = { stage, planFile }; this.pending = true;
      return this.publish({ state: 'ready', received, error: null });
    } catch (error) {
      if (stage) await fs.rm(stage, { recursive: true, force: true });
      this.pending = false;
      return this.publish({ state: 'available', error: error.code === 'ENOENT' ? 'This installation has no update manifest. Download the new portable release.' : error.message });
    }
  }
  async prepareRevert() {
    if (!this.state.canInstall || !this.state.previousVersion || this.preparing || this.pending) throw Error('No previous version is available.');
    this.preparing=this.performRevert().finally(()=>{this.preparing=null;});
    return this.preparing;
  }
  async performRevert() {
    this.publish({state:'reverting',error:null});
    let stage;
    try {
      const retained = path.join(this.installRoot, PREVIOUS);
      if ((await fs.lstat(retained)).isSymbolicLink()) throw Error('Linked update paths are unsupported.');
      const snapshot = JSON.parse(await fs.readFile(path.join(retained, 'snapshot.json'), 'utf8'));
      if(snapshot.schema!==1||snapshot.product!=='mdlxl'||snapshot.version!==this.state.previousVersion||!snapshot.files||!newerVersion(this.currentVersion,snapshot.version))throw Error('The previous version could not be read.');
      const previous = validateManifest(JSON.parse(await fs.readFile(path.join(retained,MANIFEST),'utf8')),snapshot.version);
      const current = validateManifest(JSON.parse(await fs.readFile(path.join(this.installRoot,MANIFEST),'utf8')),this.currentVersion);
      for(const relative of ['MDLxL.exe','resources/app/package.json','resources/app/electron/main.cjs','resources/app/dist/index.html',MANIFEST])if(!snapshot.files[relative])throw Error('The previous version could not be read.');
      stage = await fs.mkdtemp(path.join(os.tmpdir(),'mdlxl-update-'));
      const source=path.join(stage,'restore');await fs.mkdir(source);
      const operations=[];
      for(const [relative,hash] of Object.entries(snapshot.files)){
        if(!safeRelative(relative)||PERSONAL.test(relative)||relative!==MANIFEST&&!previous.files[relative]||!/^[a-f0-9]{64}$/.test(hash))throw Error('The previous version could not be read.');
        await regularTarget(retained,relative);await regularTarget(this.installRoot,relative);
        if(await digest(path.join(retained,relative))!==hash)throw Error('Previous version verification failed.');
        const copy=path.join(source,relative);await fs.mkdir(path.dirname(copy),{recursive:true});await fs.copyFile(path.join(retained,relative),copy);
        let before=null;try{before=await digest(path.join(this.installRoot,relative));}catch(error){if(error.code!=='ENOENT')throw error;}
        if(relative!==MANIFEST&&before!==null&&before!==hash&&before!==current.files[relative])throw Error('A program file has local changes. Update was not installed.');
        if(before!==hash)operations.push({relative,hash,before});
      }
      for(const [relative,hash] of Object.entries(current.files))if(!snapshot.files[relative]&&!PERSONAL.test(relative)){
        await regularTarget(this.installRoot,relative);
        let before;try{before=await digest(path.join(this.installRoot,relative));}catch(error){if(error.code==='ENOENT')continue;throw error;}
        if(before===hash)operations.push({relative,hash:null,before});
      }
      const planFile=path.join(stage,'plan.json');
      await fs.copyFile(path.join(__dirname,'update-install.ps1'),path.join(stage,'install.ps1'));
      await fs.writeFile(planFile,JSON.stringify({source,target:this.installRoot,operations,mode:'revert',pid:process.pid,executable:path.join(this.installRoot,'MDLxL.exe'),profile:this.profile,result:path.join(this.profile,'update-result.json')}));
      this.prepared={stage,planFile};this.pending=true;
      return this.publish({state:'ready',action:'revert'});
    }catch(error){if(stage)await fs.rm(stage,{recursive:true,force:true});return this.publish({state:'error',error:error.message});}
  }
  cancelClose() { this.pending = false; const prepared=this.prepared;this.prepared=null;if(prepared)void fs.rm(prepared.stage,{recursive:true,force:true}).catch(error=>console.warn(error.message));if (this.state.state === 'ready') this.publish({ state: this.release ? 'available' : 'idle', action:null }); }
  async shutdown() { if(!this.pending)this.abortController.abort();await Promise.allSettled([this.checking,this.preparing].filter(Boolean)); }
  async launchInstaller() {
    if (!this.pending || !this.prepared) return;
    // Windows PowerShell can exit before -File when spawned with DETACHED_PROCESS.
    // Start-Process gives the installer an independent hidden process instead.
    await run(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'update-launch.ps1'), this.prepared.planFile], { windowsHide: true });
  }
}
module.exports = { Updater, WEBSITE, REPOSITORY, MANIFEST, PREVIOUS, newerVersion, releaseMetadata, summaryLines, externalURL, validateManifest, installPlan, listFiles, digest, extractArchive };
