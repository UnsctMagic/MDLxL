import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {releaseLanguages,sixLanguageRelease,releaseMaterial} from '../scripts/release-material.mjs';
test('six-language material starts strictly after 0.38.0',async()=>{
 for(const version of ['0.1.0','0.37.2','0.38.0']){
  assert.equal(sixLanguageRelease(version),false);
  await assert.rejects(releaseMaterial({version,docs:'unused'}),/starts after 0.38.0/);
 }
 for(const version of ['0.38.1','0.39.0','1.0.0'])assert.equal(sixLanguageRelease(version),true);
});
test('future release body and post require six authored notes and complete new guide sets',async t=>{
 const docs=await fs.mkdtemp(path.join(os.tmpdir(),'mdlxl-six-languages-'));t.after(()=>fs.rm(docs,{recursive:true,force:true}));
 for(const [locale,,suffix]of releaseLanguages)await fs.writeFile(path.join(docs,'RELEASE-9.9.9'+(locale==='en'?'':'-'+suffix)+'.md'),'- '+locale+' change.');
 const material=await releaseMaterial({version:'9.9.9',docs});
 assert.deepEqual(Object.keys(material.post.notes),['en','es','ru','zh','fr','de']);
 for(const [locale,label]of releaseLanguages)assert(material.body.includes('['+label+'](https://www.lowpolyworks.com/mdlxl/?version=9.9.9&lang='+locale+')'));
 await fs.writeFile(path.join(docs,'MDLxL-9.9.9-New-Features-EN.pdf'),'fixture');
 await assert.rejects(releaseMaterial({version:'9.9.9',docs}),/Missing guide: .*ES.pdf/);
 for(const [,,suffix]of releaseLanguages.slice(1))await fs.writeFile(path.join(docs,'MDLxL-9.9.9-New-Features-'+suffix+'.pdf'),'fixture');
 assert.equal((await releaseMaterial({version:'9.9.9',docs})).guides.length,6);
 await fs.unlink(path.join(docs,'RELEASE-9.9.9-DE.md'));
 await assert.rejects(releaseMaterial({version:'9.9.9',docs}),/ENOENT/);
});
