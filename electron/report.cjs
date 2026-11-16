const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

// Test builds may point at an inbox on this PC only; any other override is ignored.
const LOCAL_TEST = /^http:\/\/127\.0\.0\.1:\d{2,5}\/api\/feedback$/.test(process.env.MDLXL_REPORT_ENDPOINT || '') ? process.env.MDLXL_REPORT_ENDPOINT : null;
const ENDPOINT = LOCAL_TEST || 'https://lowpolyworks-vault.lowpolyworks-internal-tracker.workers.dev/api/feedback';
const MAX_LENGTH = 2000;
const NAME_LENGTH = 40;
const ID_FILE = 'report-id.txt';

// The Windows machine id, read from the 64-bit registry view. Null when unreadable.
function readMachineGuid() {
  return new Promise(resolve => {
    execFile('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], { windowsHide: true, timeout: 10000 }, (error, stdout) => {
      const match = !error && /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(String(stdout));
      resolve(match ? match[1] : null);
    });
  });
}

class Reporter {
  constructor({ version, profile, fetcher = fetch, readGuid = readMachineGuid, release = os.release() }) {
    this.version = version;
    this.profile = profile;
    this.fetcher = fetcher;
    this.readGuid = readGuid;
    this.release = release;
  }
  headers(extra = {}) { return { 'User-Agent': `MDLxL/${this.version}`, ...extra }; }
  // SHA-256 of the machine id, or of a random id saved once in the profile when Windows gives none.
  async pc() {
    if (this.cached) return this.cached;
    let guid = null;
    try { guid = (await this.readGuid())?.trim() || null; } catch { /* use the saved id */ }
    if (guid) return this.cached = crypto.createHash('sha256').update('mdlxl-report:' + guid).digest('hex');
    const file = path.join(this.profile, ID_FILE);
    try {
      const saved = (await fs.readFile(file, 'utf8')).trim();
      if (/^[0-9a-f]{64}$/.test(saved)) return this.cached = saved;
    } catch { /* first run */ }
    const id = crypto.randomBytes(32).toString('hex');
    try { await fs.mkdir(this.profile, { recursive: true }); await fs.writeFile(file, id); } catch { /* the id then lasts for this run only */ }
    return this.cached = id;
  }
  osName() { return `Windows ${this.release}`; }
  // 'open', 'paused' or 'error'.
  async status() {
    try {
      const response = await this.fetcher(ENDPOINT, { method: 'GET', headers: this.headers({ Accept: 'application/json' }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) return 'error';
      const body = await response.json();
      return body?.open === false ? 'paused' : body?.open === true ? 'open' : 'error';
    } catch { return 'error'; }
  }
  // 'sent', 'paused', 'limit-pc', 'limit-ip', 'limit-day', 'invalid' or 'error'.
  async send(text, givenName = '') {
    const message = typeof text === 'string' ? text.trim() : '';
    const name = typeof givenName === 'string' ? givenName.trim().replace(/\s+/g, ' ') : '';
    if (!message || message.length > MAX_LENGTH || name.length > NAME_LENGTH) return 'invalid';
    try {
      const body = JSON.stringify({ message, name, pc: await this.pc(), version: this.version, os: this.osName() });
      const response = await this.fetcher(ENDPOINT, { method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body, signal: AbortSignal.timeout(10000) });
      if (response.status === 204) return 'sent';
      let reason = null;
      try { reason = (await response.json())?.error; } catch { /* no body */ }
      if (response.status === 503) return 'paused';
      if (response.status === 429) return reason === 'pc' || reason === 'ip' || reason === 'day' ? 'limit-' + reason : 'error';
      if (response.status === 400) return 'invalid';
      return 'error';
    } catch { return 'error'; }
  }
}

module.exports = { Reporter, ENDPOINT, MAX_LENGTH, NAME_LENGTH, readMachineGuid };
