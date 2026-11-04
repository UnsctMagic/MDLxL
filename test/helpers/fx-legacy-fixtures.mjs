import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const {testModel}=createRequire(import.meta.url)('./fixtures.cjs');
// These are the complete files saved at 676aaf6f before the empty-default edit.
// Immutable fixture files were reproduced with source at 676aaf6f and verified below.
// Never rebuild old-save fixtures with the current FX compiler.
const hashes={mdx:'868c6e372253e126530be6a9952391b8923771b05d6611f5fd11d9d56323776e',mdl:'57901bb7ac529410c6df7d2e5a888d9279339d827022bcfaa24922bff4c94860'};
export function legacyFlamingSword(out){
 return Object.entries(hashes).map(([ext,expected])=>{
  const bytes=fs.readFileSync(testModel('fx-legacy','legacy-flaming-sword.'+ext)),file=path.join(out,'legacy-flaming-sword.'+ext);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,'legacy '+ext+' matches the pre-change save');
  fs.writeFileSync(file,bytes);return file;
 });
}
