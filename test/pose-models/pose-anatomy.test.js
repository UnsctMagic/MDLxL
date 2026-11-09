import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { realAnatomyCases, loadAnatomyCase, hash, nameVariants, challengeCase, anatomyProblems } from '../helpers/pose-anatomy-fixtures.mjs';
const source=process.env.MDLXL_POSE_SOURCE ? path.resolve(process.env.MDLXL_POSE_SOURCE,'pose-ik.js') : new URL('../../src/pose-ik.js',import.meta.url);
const pose=await import(source instanceof URL?source:pathToFileURL(source));
const selected=(process.env.MDLXL_POSE_CASES||'').split(',').filter(Boolean),variants=(process.env.MDLXL_POSE_VARIANTS||'').split(',').filter(Boolean);
const includes=key=>!selected.length||selected.includes(key),modes=variants.length?variants:nameVariants;
for(const spec of realAnatomyCases.filter(s=>includes(s.key)))for(const mode of modes)test(`POSE anatomy: ${spec.key}, ${mode}`,()=>{
 const input=loadAnatomyCase(spec),{model,expected}=challengeCase(input.model,spec,mode),before=structuredClone(model),sequence=0,frame=model.Sequences?.[0]?.Interval?.[0]||0;
 const rig=pose.suggestPoseRig(model,frame,sequence),problems=anatomyProblems(model,rig,expected,pose);
 assert.deepEqual(model,before,'recognition is read-only');assert.equal(hash(fs.readFileSync(input.file)),input.sha256,'supplied model remains unchanged');
 assert.deepEqual(problems,[],`${spec.key}/${mode}: ${problems.join('; ')}`);
});
