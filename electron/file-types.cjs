const path = require('node:path');
const { execFile } = require('node:child_process');

// Registers MDL, MDX and Paint Project files under per-user file types
// (HKCU, no administrator rights) so Explorer can show document icons that
// differ from the program icon, and MDL can differ from MDX. It never takes
// over an existing default program: .mdl/.mdx only gain MDLxL in "Open with",
// and Windows' own Default apps page remains the place where the user chooses
// the default. MDLxL.Model is the original shared type; it stays for Paint
// Projects and for defaults chosen before MDL and MDX had their own types.
const PROG_ID = 'MDLxL.Model';
const MODEL_TYPES = Object.freeze({ '.mdl': { progId: 'MDLxL.MDL', kind: 'mdl', name: 'Warcraft III model (MDL text)' }, '.mdx': { progId: 'MDLxL.MDX', kind: 'mdx', name: 'Warcraft III model (MDX)' } });
const EXTENSIONS = ['.mdx', '.mdl', '.mdlxlpaint'];
const FILE_ICONS = Object.freeze({ page: 'file-page.ico', 'dark-page': 'file-dark-page.ico', tile: 'file-tile.ico', program: null });
// Labelled variations exist once per model format: label-page → file-mdl-page.ico.
const LABELLED = Object.freeze({ 'label-page': 'page', 'label-dark-page': 'dark-page', 'label-tile': 'tile', 'label-tag': 'program', 'label-letters': 'tile' });
const CLASSES = 'HKCU\\Software\\Classes';
const CAPABILITIES = 'Software\\MDLxL\\Capabilities';

function iconLocation(choice, executable, brandingDirectory, kind) {
  if (LABELLED[choice]) return kind ? path.join(brandingDirectory, `file-${kind}-${choice.slice(6)}.ico`) : iconLocation(LABELLED[choice], executable, brandingDirectory);
  const file = FILE_ICONS[choice] ?? (choice === 'program' ? null : FILE_ICONS.page);
  return file ? path.join(brandingDirectory, file) : `"${executable}",0`;
}

// `choice` is one icon for every type, or { mdl, mdx } (Paint Projects follow MDX).
function registryEntries({ choice, executable, brandingDirectory }) {
  const choices = typeof choice === 'object' && choice ? choice : { mdl: choice, mdx: choice };
  const command = `"${executable}" "%1"`;
  const fileType = (progId, name, icon) => [
    [`${CLASSES}\\${progId}`, null, 'REG_SZ', name],
    [`${CLASSES}\\${progId}\\DefaultIcon`, null, 'REG_SZ', icon],
    [`${CLASSES}\\${progId}\\shell\\open\\command`, null, 'REG_SZ', command],
  ];
  const progIdFor = extension => MODEL_TYPES[extension]?.progId ?? PROG_ID;
  return [
    ...fileType(PROG_ID, 'Warcraft III model', iconLocation(choices.mdx, executable, brandingDirectory)),
    ...Object.values(MODEL_TYPES).flatMap(({ progId, kind, name }) => fileType(progId, name, iconLocation(choices[kind], executable, brandingDirectory, kind))),
    ...EXTENSIONS.map(extension => [`${CLASSES}\\${extension}\\OpenWithProgids`, progIdFor(extension), 'REG_NONE', '']),
    // Paint Projects belong to MDLxL alone, so they get the file type directly.
    [`${CLASSES}\\.mdlxlpaint`, null, 'REG_SZ', PROG_ID],
    [`HKCU\\${CAPABILITIES}`, 'ApplicationName', 'REG_SZ', 'MDLxL'],
    [`HKCU\\${CAPABILITIES}`, 'ApplicationDescription', 'REG_SZ', 'Warcraft III model editor'],
    ...EXTENSIONS.map(extension => [`HKCU\\${CAPABILITIES}\\FileAssociations`, extension, 'REG_SZ', progIdFor(extension)]),
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
    const checked = entries.filter(([key, name]) => name === null && /\\(DefaultIcon|command)$/.test(key));
    if (await this.registered() && (await Promise.all(checked.map(async ([key, , , data]) => await currentValue(this.run, key) === data))).every(Boolean)) return false;
    for (const entry of entries) await this.run('reg.exe', addArguments(entry));
    // MDL and MDX now have their own types; drop the shared one from their Open with lists.
    for (const extension of Object.keys(MODEL_TYPES)) await this.run('reg.exe', ['delete', `${CLASSES}\\${extension}\\OpenWithProgids`, '/v', PROG_ID, '/f']).catch(() => {});
    // Explorer caches file icons; tell it the associations changed.
    await this.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', NOTIFY]).catch(() => {});
    return true;
  }
  // True when Windows still opens .mdl or .mdx through the shared type, so both
  // show the MDX icon until MDLxL is chosen again in Default apps.
  async usesSharedDefault() {
    for (const extension of Object.keys(MODEL_TYPES)) for (const choice of ['UserChoice', 'UserChoiceLatest']) {
      try {
        const output = await this.run('reg.exe', ['query', `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${extension}\\${choice}`, '/v', 'ProgId']);
        if (new RegExp(`\\sREG_SZ\\s+${PROG_ID.replace('.', '\\.')}\\s*$`, 'm').test(output)) return true;
      } catch {}
    }
    return false;
  }
  async registered() {
    try { return /\sMDLxL\s/.test(await this.run('reg.exe', ['query', 'HKCU\\Software\\RegisteredApplications', '/v', 'MDLxL'])); }
    catch { return false; }
  }
}

module.exports = { FileTypeRegistration, FILE_ICONS, MODEL_TYPES, PROG_ID, registryEntries, addArguments };
