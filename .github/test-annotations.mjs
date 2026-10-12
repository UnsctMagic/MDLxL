// node:test reporter that turns failing tests into a GitHub Actions annotation,
// so failures are listed on the pull request without opening the job log.
export default async function* githubAnnotations(source) {
  const failures = [];
  for await (const event of source) {
    if (event.type !== 'test:fail') continue;
    const { name, file, details } = event.data;
    // Skip file-level wrappers whose failure only repeats a failing subtest.
    if (details?.error?.failureType === 'subtestsFailed') continue;
    const reason = String(details?.error?.cause?.message ?? details?.error?.message ?? '')
      .split('\n')[0]
      .slice(0, 200);
    const where = file ? file.replace(/^.*[\\/]test[\\/]/, 'test/') : '';
    failures.push(`${where} › ${name}${reason ? ` — ${reason}` : ''}`);
  }
  if (!failures.length) return;
  const escape = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  yield `::error title=${failures.length} failing tests::${escape(failures.join('\n'))}\n`;
}
