import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export const releaseLanguages = Object.freeze([
 ['en','English','EN'], ['es','Español','ES'], ['ru','Русский','RU'],
 ['zh','简体中文','ZH-CN'], ['fr','Français','FR'], ['de','Deutsch','DE'],
]);
export function sixLanguageRelease(version) {
 const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
 if (!match) throw Error('A stable release version is required.');
 const [major,minor,patch] = match.slice(1).map(Number);
 return major > 0 || minor > 38 || minor === 38 && patch > 0;
}
export async function releaseMaterial({version,docs}) {
 if (!sixLanguageRelease(version)) throw Error('Six-language material starts after 0.38.0; historical releases are unchanged.');
 const notes = {};
 for (const [locale,,suffix] of releaseLanguages) {
  const name = 'RELEASE-' + version + (locale === 'en' ? '' : '-' + suffix) + '.md';
  const text = await fs.readFile(path.join(docs,name),'utf8');
  if (!text.trim()) throw Error('Empty release notes: ' + name);
  notes[locale] = text;
 }
 const files = await fs.readdir(docs), prefix = 'MDLxL-' + version + '-';
 const groups = new Map();
 for (const file of files.filter(name => name.startsWith(prefix) && name.endsWith('.pdf'))) {
  const match = /^(.*)-(EN|ES|RU|ZH-CN|FR|DE)\.pdf$/.exec(file);
  if (!match) throw Error('Unknown guide language: ' + file);
  const group = groups.get(match[1]) || new Set(); group.add(match[2]); groups.set(match[1],group);
 }
 for (const [guide,languages] of groups) for (const [,,suffix] of releaseLanguages)
  if (!languages.has(suffix)) throw Error('Missing guide: ' + guide + '-' + suffix + '.pdf');
 const links = releaseLanguages.map(([locale,label]) => '[' + label + '](https://www.lowpolyworks.com/mdlxl/?version=' + version + '&lang=' + locale + ')').join(' · ');
 return {post:{version,notes},body:notes.en.trimEnd() + '\n\nRead patch notes in:\n' + links + '\n',guides:files.filter(name => name.startsWith(prefix) && name.endsWith('.pdf')).sort()};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
 const [version,output] = process.argv.slice(2);
 if (!output) throw Error('Usage: node scripts/release-material.mjs <version> <output-directory>');
 const docs = path.resolve('docs'), material = await releaseMaterial({version,docs});
 await fs.mkdir(output,{recursive:true});
 await fs.writeFile(path.join(output,'release-body.md'),material.body);
 await fs.writeFile(path.join(output,version + '.json'),JSON.stringify(material.post,null,2) + '\n');
 await fs.writeFile(path.join(output,'guides.json'),JSON.stringify(material.guides,null,2) + '\n');
 console.log('Prepared six-language release material for ' + version);
}
