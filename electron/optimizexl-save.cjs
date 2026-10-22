const fs = require('node:fs/promises');
const path = require('node:path');

/** Copy the model file beside itself as Name_backup.ext (or _backup_2, ...).
 * Exclusive creation: an existing file is never overwritten. */
async function backupModelFile(source, io = fs) {
  const extension = path.extname(source), stem = path.basename(source, extension), directory = path.dirname(source);
  if (!/^\.(mdx|mdl)$/i.test(extension)) throw Error('Only MDL and MDX files can be backed up.');
  for (let suffix = 1; suffix < 100000; suffix++) {
    const target = path.join(directory, `${stem}_backup${suffix > 1 ? '_' + suffix : ''}${extension}`);
    try { await io.copyFile(source, target, fs.constants?.COPYFILE_EXCL ?? 1); }
    catch (error) { if (error.code === 'EEXIST') continue; throw error; }
    if (!(await io.readFile(target)).equals(await io.readFile(source))) { await io.unlink(target).catch(() => {}); throw Error('Backup verification failed.'); }
    return target;
  }
  throw Error('No free backup name was found.');
}
module.exports = { backupModelFile };
