// The Help menu's Sanity Check for the AI: the same report (src/sanity-check.js with the bundled Hive
// checker), as counts and a page of findings.

/** report: checkSanity's result. Returns status, counts and up to `limit` findings (type, path,
 * message), errors and severe first. */
export function sanityForAi(report, { offset = 0, limit = 200 } = {}) {
  const hive = report?.hive, order = { error: 0, severe: 1, warning: 2, unused: 3 };
  const findings = (hive?.findings || []).map(f => ({ type: f.type, path: f.path, message: f.message }))
    .sort((a, b) => (order[a.type] ?? 4) - (order[b.type] ?? 4));
  return {
    status: report?.status, version: report?.version, ...(report?.limitation ? { limitation: report.limitation } : {}),
    ...(hive ? { counts: { errors: hive.errors, severe: hive.severe, warnings: hive.warnings, unused: hive.unused } } : {}),
    total: findings.length, offset, truncated: offset + limit < findings.length,
    findings: findings.slice(offset, offset + limit),
    note: 'Advisory, from the bundled mdx-m3-viewer checker; IDs are zero-based. Naming, unused data and old heuristics need review; they are not proof of a game failure.',
  };
}
