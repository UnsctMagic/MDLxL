// node:test reporter that writes one line per failing test: "<file> › <test name>\t<reason>".
// .github/check-test-baseline.mjs compares these against the known-failure baseline.
// A final "#done" line records the pass/fail totals so a crashed run is not
// mistaken for a clean one.
export default async function* failingTests(source) {
  let passed = 0;
  let failed = 0;
  for await (const event of source) {
    if (event.type === 'test:pass' && event.data.details?.type !== 'suite') passed++;
    if (event.type !== 'test:fail') continue;
    failed++;
    const { name, file, details } = event.data;
    // Skip wrappers whose failure only repeats a failing subtest.
    if (details?.error?.failureType === 'subtestsFailed') continue;
    const where = file ? file.replace(/\\/g, '/').replace(/^.*\/test\//, 'test/') : '';
    const label = name.replace(/\\/g, '/');
    const reason = String(details?.error?.cause?.message ?? details?.error?.message ?? '')
      .split('\n')[0]
      .slice(0, 160);
    yield `${where} › ${label}\t${reason}\n`;
  }
  yield `#done\t${passed}\t${failed}\n`;
}
