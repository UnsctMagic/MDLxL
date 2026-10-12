// Compares the failing tests from the full suite with the known-failure baseline.
// Fails only when a test outside the baseline fails, so pre-existing failures do
// not block unrelated work while any new regression still stops the merge.
// Usage: node .github/check-test-baseline.mjs <failures file> <baseline file>
import fs from 'node:fs';

const [failuresPath, baselinePath] = process.argv.slice(2);
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const lines = read(failuresPath).split('\n').filter(Boolean);
const done = lines.find((line) => line.startsWith('#done\t'));
if (!done || Number(done.split('\t')[1]) === 0) {
  console.log('::error title=Full test suite did not complete::No completion record from the test reporter.');
  process.exit(1);
}
const failures = new Map(
  lines
    .filter((line) => !line.startsWith('#'))
    .map((line) => line.split('\t'))
    .map(([id, reason = '']) => [id, reason]),
);
const baseline = new Set(
  read(baselinePath)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
);

const fresh = [...failures].filter(([id]) => !baseline.has(id));
const fixed = [...baseline].filter((id) => !failures.has(id));

// GitHub truncates long annotation messages, so send the list in chunks.
const escape = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
function annotate(level, title, lines) {
  const chunks = [];
  let current = [];
  for (const line of lines) {
    if (current.join('\n').length + line.length > 3500) chunks.push(current), (current = []);
    current.push(line);
  }
  if (current.length) chunks.push(current);
  chunks.forEach((chunk, index) => {
    const part = chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : '';
    console.log(`::${level} title=${title}${part}::${escape(chunk.join('\n'))}`);
  });
}

console.log(`${done.split('\t')[1]} passing, ${failures.size} failing, ${baseline.size} in baseline, ${fresh.length} new, ${fixed.length} now passing.`);
if (fixed.length) annotate('notice', `${fixed.length} baseline tests now pass - remove them from .github/known-test-failures.txt`, fixed);
if (fresh.length) {
  annotate('error', `${fresh.length} new failing tests`, fresh.map(([id, reason]) => `${id}${reason ? ` — ${reason}` : ''}`));
  process.exitCode = 1;
}
