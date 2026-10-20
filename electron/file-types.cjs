const path = require('node:path');
const { execFile } = require('node:child_process');

// Registers MDL, MDX and Paint Project files under a per-user file type
// (HKCU, no administrator rights) so Explorer can show a document icon that
// differs from the program icon. It never takes over an existing default
// program: .mdl/.mdx only gain MDLxL in "Open with", and Windows' own Default
// apps page remains the place where the user chooses the default.
const PROG_ID = 'MDLxL.Model';
const EXTENSIONS = ['.mdx', '.mdl', '.mdlxlpaint'];
const FILE_ICONS = Object.freeze({ page: 'file-page.ico', 'dark-page': 'file-dark-page.ico', tile: 'file-tile.ico', program: null });
const CLASSES = 'HKCU\\Software\\Classes';
const CAPABILITIES = 'Software\\MDLxL\\Capabilities';

function iconLocation(choice, executable, brandingDirectory) {
  const file = FILE_ICONS[choice] ?? (choice === 'program' ? null : FILE_ICONS.page);
  return file ? path.join(brandingDirectory, file) : `"${executable}",0`;
}

function registryEntries({ choice, executable, brandingDirectory }) {
  const command = `"${executable}" "%1"`, icon = iconLocation(choice, executable, brandingDirectory);
  return [
    [`${CLASSES}\\${PROG_ID}`, null, 'REG_SZ', 'Warcraft III model'],
    [`${CLASSES}\\${PROG_ID}\\DefaultIcon`, null, 'REG_SZ', icon],
    [`${CLASSES}\\${PROG_ID}\\shell\\open\\command`, null, 'REG_SZ', command],
    ...EXTENSIONS.map(extension => [`${CLASSES}\\${extension}\\OpenWithProgids`, PROG_ID, 'REG_NONE', '']),
    // Paint Projects belong to MDLxL alone, so they get the file type directly.
    [`${CLASSES}\\.mdlxlpaint`, null, 'REG_SZ', PROG_ID],
    [`HKCU\\${CAPABILITIES}`, 'ApplicationName', 'REG_SZ', 'MDLxL'],
    [`HKCU\\${CAPABILITIES}`, 'ApplicationDescription', 'REG_SZ', 'Warcraft III model editor'],
    ...EXTENSIONS.map(extension => [`HKCU\\${CAPABILITIES}\\FileAssociations`, extension, 'REG_SZ', PROG_ID]),
    ['HKCU\\Software\\RegisteredApplications', 'MDLxL', 'REG_SZ', CAPABILITIES],
  ];
}

function addArguments([key, name, type, data]) {
  return ['add', key, ...(name === null ? ['/ve'] : ['/v', name]), '/t', type, ...(type === 'REG_NONE' ? [] : ['/d', data]), '/f'];
}

const defaultRun = (file, args) => new Promise((resolve, reject) => execFile(file, args, { windowsHide: true }, (error, stdout) => error ? reject(error) : resolve(String(stdout))));

async function currentValue(run, key) {
  try {
    const line = (await run('reg.exe', ['query', key, '/ve'])).split(/\r?\n/).find(text => /\sREG_SZ\s/.test(text));
    return line ? line.replace(/^.*?\sREG_SZ\s+/, '').trimEnd() : null;
  } catch { return null; }
}

const NOTIFY = "Add-Type -Namespace MDLxL -Name Shell -MemberDefinition '[DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int e, uint f, IntPtr a, IntPtr b);'; [MDLxL.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)";

class FileTypeRegistration {
  constructor({ executable, brandingDirectory, run = defaultRun }) {
    Object.assign(this, { executable, brandingDirectory, run });
    this.queue = Promise.resolve();
  }
  apply(choice) {
    const operation = this.queue.catch(() => {}).then(() => this.write(choice));
    this.queue = operation;
    return operation;
  }
  async write(choice) {
    const entries = registryEntries({ choice, executable: this.executable, brandingDirectory: this.brandingDirectory });
    const [, , , icon] = entries[1], [, , , command] = entries[2];
    if (await this.registered() && await currentValue(this.run, entries[1][0]) === icon && await currentValue(this.run, entries[2][0]) === command) return false;
    for (const entry of entries) await this.run('reg.exe', addArguments(entry));
    // Explorer caches file icons; tell it the associations changed.
    await this.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', NOTIFY]).catch(() => {});
    return true;
  }
  async registered() {
    try { return /\sMDLxL\s/.test(await this.run('reg.exe', ['query', 'HKCU\\Software\\RegisteredApplications', '/v', 'MDLxL'])); }
    catch { return false; }
  }
}

module.exports = { FileTypeRegistration, FILE_ICONS, PROG_ID, registryEntries, addArguments };
