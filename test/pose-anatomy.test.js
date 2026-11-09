import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { nameVariants, challengeCase, anatomyProblems, analyticalCases, analyticalRig } from './helpers/pose-anatomy-fixtures.mjs';
const source=process.env.MDLXL_POSE_SOURCE ? path.resolve(process.env.MDLXL_POSE_SOURCE,'pose-ik.js') : new URL('../src/pose-ik.js',import.meta.url);
const pose=await import(source instanceof URL?source:pathToFileURL(source));
const selected=(process.env.MDLXL_POSE_CASES||'').split(',').filter(Boolean),variants=(process.env.MDLXL_POSE_VARIANTS||'').split(',').filter(Boolean);
const includes=key=>!selected.length||selected.includes(key),modes=variants.length?variants:nameVariants;
for(const spec of analyticalCases.filter(s=>includes(s.key)))for(const mode of modes)test(`POSE anatomy: ${spec.key}, ${mode}`,()=>{
 const {model:original,expected:groundTruth}=analyticalRig(spec.options),{model,expected}=challengeCase(original,groundTruth,mode),before=structuredClone(model),rig=pose.suggestPoseRig(model,0,0),problems=anatomyProblems(model,rig,expected,pose);
 assert.deepEqual(model,before,'recognition preserves anatomy and skin');assert.deepEqual(problems,[],`${spec.key}/${mode}: ${problems.join('; ')}`);
});
