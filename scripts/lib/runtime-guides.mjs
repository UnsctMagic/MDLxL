import fs from 'node:fs/promises';

// Guides and docs that ship inside the portable package and are attached to every
// release. Historical guides keep their original four languages; never fabricate
// FR/DE filenames for them.
export const historicalGuideLanguages = ['EN', 'ES', 'RU', 'ZH-CN'];
export const historicalGuides = ['0.38.0-New-Features', '0.32.0-AI-Guide', '0.31.0-AI-Sign-in', '0.31.0-Interface-Map'];
const runtimeDocs = ['ADDONS.md', 'AI-HOOK.md', 'AI-SD-RULEBOOK.md', 'AI-SD-REFERENCE-STUDY.md', 'AI-SD-STUDY-DATA.json', 'COMMUNITY_RESEARCH.md'];

// New guides ship for the current release only, in all six languages.
export async function runtimeGuides(docs, version) {
  const guides = [...runtimeDocs, ...historicalGuides.flatMap(guide => historicalGuideLanguages.map(lang => `MDLxL-${guide}-${lang}.pdf`))];
  guides.push(...(await fs.readdir(docs)).filter(name => name.startsWith('MDLxL-' + version + '-') && /-(?:EN|ES|RU|ZH-CN|FR|DE)\.pdf$/.test(name) && !guides.includes(name)));
  return guides;
}
