import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runtimeGuides } from './lib/runtime-guides.mjs';
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
export const discordDescriptionLimit = 4096;
export const portableZip = 'MDLxL-win32-x64.zip', ffmpegSourceZip = 'MDLxL-FFmpeg-corresponding-source.zip';
const guideTitles = {'New-Features':'New in ','AI-Guide':'AI console','AI-Sign-in':'AI sign-in','Interface-Map':'Interface map'};
// What a "New in <version>" guide covers. Add the entry when its guide is written.
const newFeatureTopics = {'0.38.0':'layout and geoset tabs, Workplane Constraints, FX, EMTR effects, Sphereomancer, World Editor Style textures, Nuclear Weld, Fix model'};
const separator = ' · ';
function guideLabel(guide) {
 const match = /^(\d+\.\d+\.\d+)-(.+)$/.exec(guide);
 if (!match || !guideTitles[match[2]]) throw Error('Unknown guide: ' + guide);
 if (match[2] !== 'New-Features') return guideTitles[match[2]];
 return 'New in ' + match[1] + (newFeatureTopics[match[1]] ? ' (' + newFeatureTopics[match[1]] + ')' : '');
}
export async function releaseMaterial({version,docs,maxLength = discordDescriptionLimit}) {
 if (!sixLanguageRelease(version)) throw Error('Six-language material starts after 0.38.0; historical releases are unchanged.');
 const notes = {};
 for (const [locale,,suffix] of releaseLanguages) {
  const name = 'RELEASE-' + version + (locale === 'en' ? '' : '-' + suffix) + '.md';
  const text = await fs.readFile(path.join(docs,name),'utf8');
  if (!text.trim()) throw Error('Empty release notes: ' + name);
  const heading = text.split(/\r?\n/,1)[0];
  if (heading !== '# MDLxL ' + version) throw Error('Release notes heading must be exactly "# MDLxL ' + version + '" (no suffix, any language): ' + name);
  notes[locale] = text;
 }
 // Every runtime PDF guide is attached to each release: this release's new guides
 // (six languages) plus the historical guides (their original four languages).
 const guides = (await runtimeGuides(docs,version)).filter(name => name.endsWith('.pdf'));
 const groups = new Map();
 for (const file of guides) {
  const match = /^MDLxL-(.*)-(EN|ES|RU|ZH-CN|FR|DE)\.pdf$/.exec(file);
  if (!match) throw Error('Unknown guide language: ' + file);
  await fs.access(path.join(docs,file));
  const group = groups.get(match[1]) || new Map(); group.set(match[2],file); groups.set(match[1],group);
 }
 for (const [guide,languages] of groups) if (guide.startsWith(version + '-'))
  for (const [,,suffix] of releaseLanguages) if (!languages.has(suffix)) throw Error('Missing guide: ' + guide + '-' + suffix + '.pdf');
 const asset = name => 'https://github.com/UnsctMagic/MDLxL/releases/download/v' + version + '/' + name;
 const links = releaseLanguages.map(([locale,label]) => '[' + label + '](https://www.lowpolyworks.com/mdlxl/?version=' + version + '&lang=' + locale + ')').join(separator);
 const guideLines = [...groups].sort(([a],[b]) => b.startsWith(version + '-') - a.startsWith(version + '-')).map(([guide,languages]) => guideLabel(guide) + ': ' + releaseLanguages.filter(([,,suffix]) => languages.has(suffix)).map(([,label,suffix]) => '[' + label + '](' + asset(languages.get(suffix)) + ')').join(separator));
 const summary = notes.en.replace(/^[^\n]*\n/,'').trim();
 const body = '[MDLxL ' + version + '](https://www.lowpolyworks.com/mdlxl/?version=' + version + ')\n\n' + summary +
  '\n\nDownload: [Windows portable ZIP](' + asset(portableZip) + ')' + separator + '[SHA-256](' + asset(portableZip + '.sha256') + ')' + separator + '[FFmpeg corresponding source](' + asset(ffmpegSourceZip) + ')' +
  '\n\nRead patch notes in:\n' + links + '\n\nGuides (PDF):\n' + guideLines.join('\n') + '\n';
 const length = [...body.trimEnd()].length;
 if (length > maxLength) throw Error('The release body is ' + length + ' characters; Discord shows at most ' + maxLength + ' and would cut the post. Shorten the English notes or the guide list; nothing is truncated automatically.');
 return {post:{version,notes},body,guides:guides.sort()};
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
