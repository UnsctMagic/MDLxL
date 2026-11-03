const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { writeFileAtomic } = require('./atomic-file.cjs');

function candidatePath(folder, chat, fingerprint) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(chat) || !/^[a-f0-9]{64}$/.test(fingerprint)) throw Error('Invalid saved candidate.');
  return path.join(folder, 'candidate-' + chat + '.' + fingerprint + '.mdx');
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function keepCandidateFile(folder, chat, { bytes, fingerprint }) {
  const file = candidatePath(folder, chat, fingerprint);
  if (!(bytes instanceof Uint8Array) || digest(bytes) !== fingerprint) throw Error('Candidate fingerprint changed before saving.');
  await writeFileAtomic(file, bytes, { verify: true });
}
async function readCandidateFile(folder, chat, fingerprint) {
  const bytes = await fs.readFile(candidatePath(folder, chat, fingerprint));
  if (digest(bytes) !== fingerprint) throw Error('The saved candidate fingerprint does not match.');
  return bytes;
}
const removeCandidateFile = (folder, chat, fingerprint) => fs.rm(candidatePath(folder, chat, fingerprint), { force: true });
module.exports = { keepCandidateFile, readCandidateFile, removeCandidateFile };
