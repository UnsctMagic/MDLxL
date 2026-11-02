import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {openDocument} from '../../src/editor-document.js';
import {findLook,partFrame} from '../../src/global-animation-looks.js';
import {compileAnimation,FX_SECTIONS} from '../../src/global-animation-model.js';
import {authoredStack} from './fx-authored-stack.js';
const {testModel}=createRequire(import.meta.url)('./fixtures.cjs');
// These are the complete files saved at 676aaf6f before the empty-default edit.
// Rebuild this test setup only if it is byte-identical to those actual old saves.
const hashes={mdx:'868c6e372253e126530be6a9952391b8923771b05d6611f5fd11d9d56323776e',mdl:'57901bb7ac529410c6df7d2e5a888d9279339d827022bcfaa24922bff4c94860'};
export function legacyFlamingSword(out){
 const doc=openDocument(fs.readFileSync(testModel('WH_WOC_WarriorSlaaneshDual01.mdx')),'slaanesh.mdx');
 const stack=authoredStack(findLook('flaming-sword'),partFrame(doc.model.Geosets[28]),'legacy-flaming');
 doc.apply('Flaming sword before empty defaults',FX_SECTIONS,m=>compileAnimation(m,28,stack));
 return Object.entries(hashes).map(([ext,expected])=>{
  const bytes=doc.serialize(ext),file=path.join(out,'legacy-flaming-sword.'+ext);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,'legacy '+ext+' matches the pre-change save');
  fs.writeFileSync(file,bytes);return file;
 });
}
