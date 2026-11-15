import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SNAPSHOT,compiledHash,donorsFor,freshModel} from './helpers/fx-legacy-snapshot.mjs';

// Stacks frozen as JSON on e81e50c9 (before per-layer editing). None carries a new layer
// field, so each must still compile to byte-identical native model data.
const {entries}=JSON.parse(fs.readFileSync(SNAPSHOT,'utf8'));
const NEW_FIELDS=['unshaded','unfogged','twoSided','loop','repeats','glyphScale','glyphTurn','glyphSlide','glyphAcross','tint2','inflate'];
test('frozen legacy stacks hold no new layer fields',()=>{
 assert.ok(entries.length>300);
 for(const e of entries)for(const l of e.stack.layers)for(const key of NEW_FIELDS)assert.equal(key in l,false,e.look+' '+key);
});
for(const name of ['demo','knight'])test('legacy FX stacks compile byte-identically on the '+name+' model',()=>{
 const donors=donorsFor(freshModel(name)),changed=[];
 for(const e of entries.filter(e=>e.model===name))if(compiledHash(name,e.stack,donors)!==e.hash)changed.push(e.look+' '+e.kind);
 assert.deepEqual(changed,[]);
});
