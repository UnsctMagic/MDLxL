// One way to replace an app-owned file: write a fresh temporary file next to
// it, then rename it over the old one. A crash leaves either the old or the
// new file, never half of one.
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

// Windows can briefly deny replacement while antivirus, the search indexer or
// another reader holds the file. Those errors are retried; anything else fails.
const BUSY = ['EPERM', 'EACCES', 'EBUSY'];
async function renameRetrying(from, to, attempts = 8) {
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(from, to); return; }
    catch (error) {
      if (!BUSY.includes(error.code) || attempt >= attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

/**
 * Replace `file` with `data`.
 * verify: read the temporary file back and compare before replacing.
 * backup: copy the current file to `file.previous` first.
 * The temporary file has a random name, is created exclusively (`wx`) and is
 * removed again when anything fails. The folder must already exist.
 */
async function writeFileAtomic(file, data, { verify = false, backup = false } = {}) {
  if (backup) try { await fs.copyFile(file, file + '.previous'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  try {
    await fs.writeFile(temporary, data, { flag: 'wx' });
    if (verify) {
      const expected = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      if (!(await fs.readFile(temporary)).equals(expected)) throw Error('Write verification failed.');
    }
    await renameRetrying(temporary, file);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

/**
 * Runs operations one after another. A failed operation is reported to its
 * own caller only; the next one still runs.
 * `idle()` waits for everything queued so far.
 */
function serialQueue() {
  let tail = Promise.resolve();
  const run = operation => {
    const result = tail.catch(() => {}).then(operation);
    tail = result;
    return result;
  };
  run.idle = () => tail.catch(() => {});
  return run;
}

module.exports = { writeFileAtomic, serialQueue };
