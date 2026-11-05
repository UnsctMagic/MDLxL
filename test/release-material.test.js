import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {releaseLanguages,sixLanguageRelease,releaseMaterial} from '../scripts/release-material.mjs';
import {runtimeGuides,historicalGuides} from '../scripts/lib/runtime-guides.mjs';
const historical=historicalGuides.flatMap(guide=>['EN','ES','RU','ZH-CN'].map(lang=>'MDLxL-'+guide+'-'+lang+'.pdf'));
async function fixture(t,version,{heading=version,notes='- change.'}={}){
 const docs=await fs.mkdtemp(path.join(os.tmpdir(),'mdlxl-six-languages-'));t.after(()=>fs.rm(docs,{recursive:true,force:true}));
 for(const [locale,,suffix]of releaseLanguages)await fs.writeFile(path.join(docs,'RELEASE-'+version+(locale==='en'?'':'-'+suffix)+'.md'),'# MDLxL '+heading+'\r\n\r\n'+notes+' '+locale+'\r\n');
 for(const name of historical)await fs.writeFile(path.join(docs,name),'fixture');
 return docs;
}
test('six-language material starts strictly after 0.38.0',async()=>{
 for(const version of ['0.1.0','0.37.2','0.38.0']){
  assert.equal(sixLanguageRelease(version),false);
  await assert.rejects(releaseMaterial({version,docs:'unused'}),/starts after 0.38.0/);
 }
 for(const version of ['0.38.1','0.39.0','1.0.0'])assert.equal(sixLanguageRelease(version),true);
});
test('release body starts with the linked title, then summary, download, patch notes and the guides link',async t=>{
 const docs=await fixture(t,'9.9.9');
 const material=await releaseMaterial({version:'9.9.9',docs});
 assert.deepEqual(Object.keys(material.post.notes),['en','es','ru','zh','fr','de']);
 assert(material.body.startsWith('[MDLxL 9.9.9](https://www.lowpolyworks.com/mdlxl/?version=9.9.9)\n\n- change. en'));
 assert(!/^# /m.test(material.body));
 for(const [locale,label]of releaseLanguages)assert(material.body.includes('['+label+'](https://www.lowpolyworks.com/mdlxl/?version=9.9.9&lang='+locale+')'));
 const base='https://github.com/UnsctMagic/MDLxL/releases/download/v9.9.9/';
 assert(material.body.includes('\n\nDownload: [Windows portable ZIP]('+base+'MDLxL-win32-x64.zip) · [SHA-256]('+base+'MDLxL-win32-x64.zip.sha256) · [FFmpeg corresponding source]('+base+'MDLxL-FFmpeg-corresponding-source.zip)\n'));
 assert(material.body.indexOf('Download:')<material.body.indexOf('Read patch notes in:')&&material.body.indexOf('Read patch notes in:')<material.body.indexOf('Guides (PDF):'));
 const guides=material.body.slice(material.body.indexOf('Guides (PDF):'));
 // Historical guides are attached but only linked through the release page (Discord's 4096 limit).
 assert.equal(guides,'Guides (PDF):\nAll guides: [release page](https://github.com/UnsctMagic/MDLxL/releases/tag/v9.9.9)\n');
 assert.deepEqual(material.guides,historical.slice().sort());
});
test('a new guide needs all six languages and joins the attached list',async t=>{
 const docs=await fixture(t,'9.9.9');
 await fs.writeFile(path.join(docs,'MDLxL-9.9.9-New-Features-EN.pdf'),'fixture');
 await assert.rejects(releaseMaterial({version:'9.9.9',docs}),/Missing guide: .*ES.pdf/);
 for(const [,,suffix]of releaseLanguages.slice(1))await fs.writeFile(path.join(docs,'MDLxL-9.9.9-New-Features-'+suffix+'.pdf'),'fixture');
 const material=await releaseMaterial({version:'9.9.9',docs});
 assert.equal(material.guides.length,historical.length+6);
 assert(material.body.includes('\nNew in 9.9.9: [English]'));
 assert(material.body.includes('[Deutsch](https://github.com/UnsctMagic/MDLxL/releases/download/v9.9.9/MDLxL-9.9.9-New-Features-DE.pdf)'));
 assert.deepEqual((await runtimeGuides(docs,'9.9.9')).filter(name=>name.endsWith('.pdf')).sort(),material.guides);
 await fs.unlink(path.join(docs,'RELEASE-9.9.9-DE.md'));
 await assert.rejects(releaseMaterial({version:'9.9.9',docs}),/ENOENT/);
});
test('every language heading must be exactly "# MDLxL <version>"',async t=>{
 for(const heading of ['9.9.9 — Hotfix','9.9.9 - Hotfix','9.9.8','9.9.9 ']){
  const docs=await fixture(t,'9.9.9',{heading});
  await assert.rejects(releaseMaterial({version:'9.9.9',docs}),/heading must be exactly "# MDLxL 9.9.9"/,heading);
 }
 const docs=await fixture(t,'9.9.9');
 await fs.writeFile(path.join(docs,'RELEASE-9.9.9-FR.md'),'# MDLxL 9.9.9 — Correctif urgent\r\n\r\n- change.\r\n');
 await assert.rejects(releaseMaterial({version:'9.9.9',docs}),/RELEASE-9.9.9-FR.md/);
});
test('a body over the Discord description limit fails instead of being truncated',async t=>{
 const docs=await fixture(t,'9.9.9',{notes:'- '+'long change '.repeat(400)});
 await assert.rejects(releaseMaterial({version:'9.9.9',docs}),/characters; Discord shows at most 4096/);
 const material=await releaseMaterial({version:'9.9.9',docs,maxLength:Infinity});
 assert((await fs.stat(docs)).isDirectory());
 assert(material.body.includes('long change long change'));
});
test('committed 0.38.x notes follow the title rule',async()=>{
 for(const version of ['0.38.1','0.38.2'])for(const [locale,,suffix]of releaseLanguages){
  const text=await fs.readFile(new URL('../docs/RELEASE-'+version+(locale==='en'?'':'-'+suffix)+'.md',import.meta.url),'utf8');
  assert.equal(text.split(/\r?\n/,1)[0],'# MDLxL '+version);
 }
});
