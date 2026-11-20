import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { vertexBones } from '../src/part-bones.js';
import { transferRig } from '../src/anim-transfer.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';

const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
for (const [source,provider] of [
  ['nightelf__archer','orc__herotaurenchieftain'],
  ['creeps__highelfarcher','orc__headhunter'],
]) {
  const files = [source,provider].map(name=>testModel('corpus-sd/'+name+'.mdx'));
  test(source + ' keeps the entire bow and string together through a donor weapon swing',
    {skip:files.some(file=>!fs.existsSync(file))?'private SD archer fixture unavailable':false}, () => {
    const [own,donor] = files.map(f=>openDocument(new Uint8Array(fs.readFileSync(f)),f).model);
    const a = transferRig(own), b = transferRig(donor);
    const mirror = !!(a.weaponSide && b.weaponSide && a.weaponSide !== b.weaponSide);
    const {model,report} = transplantSkeleton(own,donor,{mirror,extents:false});
    const grip = own.Attachments.find(n=>/^weapon ref$/i.test(n.Name)).Parent;
    const tree = nodeIndex(own);
    let bowVertices = 0, carried = 0;
    for (const [gi,g] of own.Geosets.entries()) for (let vi=0; vi<g.Vertices.length/3; vi++) {
      const original = vertexBones(g,vi);
      if (!original.length || !original.every(id=>tree.isAncestor(id,grip))) continue;
      bowVertices++;
      const bound = vertexBones(model.Geosets[gi],vi);
      if (bound.length && bound.every(id=>id===report.weapon.bone)) carried++;
    }
    assert.ok(bowVertices >= 30);
    assert.equal(carried,bowVertices,'vertices on the donor weapon, including the rigid grip and string');
  });
}
