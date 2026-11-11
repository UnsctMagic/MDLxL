import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { vertexForgeDraft, vertexForgeResult } from '../src/forge-vertex.js';
import { transformForgeSelection } from '../src/forge-shape-editing.js';
import { forgeMoldState, prepareForgeMold, previewForgeMold } from '../src/forge-molding.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const positionKey = (g, i) => Array.from(g.Vertices.slice(i * 3, i * 3 + 3), v => Math.round(v * 1e4)).join(':');

// The same seam neighborhoods as Claude's seam-probe.mjs, without its open-edge
// heuristic: authored borders can legitimately change during other operations.
function seamRegions(g) {
  const byPosition = new Map(), used = new Set(g.Faces);
  for (let i = 0; i < g.Vertices.length / 3; i++) {
    const key = positionKey(g, i);
    if (!byPosition.has(key)) byPosition.set(key, []);
    byPosition.get(key).push(i);
  }
  return [...byPosition.values()].filter(ids => ids.length > 1 && ids.every(i => used.has(i)) &&
    new Set(ids.map(i => g.TVertices[0].slice(i * 2, i * 2 + 2).join(','))).size > 1).slice(0, 4).map(group => {
    const ring = new Set(group);
    for (let f = 0; f < g.Faces.length; f += 3) {
      const triangle = Array.from(g.Faces.slice(f, f + 3));
      if (triangle.some(i => group.includes(i))) triangle.forEach(i => ring.add(i));
    }
    return { group, selection: [...ring] };
  });
}

const operations = {
  Move: draft => ({ ...draft, shapes: draft.shapes.map(shape => transformForgeSelection(shape,
    draft.selection[shape.id], 'Vertices', { translation: [1, 2, 3] })) }),
  Taper: draft => {
    const state = { ...forgeMoldState(draft, 'Taper'), amount: .5 };
    return previewForgeMold(draft, prepareForgeMold(draft, state), state);
  },
};

for (const fixture of ['citadel-footman', 'forge-hd-footman']) for (const [tool, operation] of Object.entries(operations)) {
  test(`${fixture}: ${tool} keeps UV seam copies together and their UVs unchanged`, t => {
    const model = openDocument(fs.readFileSync(fixturePath(fixture)), 'Footman.mdx').model;
    const failures = [];
    let cases = 0;
    model.Geosets.forEach((g, gi) => {
      for (const { group, selection } of seamRegions(g)) {
        cases++;
        const label = `geoset ${gi}, seam [${group}]`;
        const draft = vertexForgeDraft(model, { [gi]: selection });
        const out = vertexForgeResult(model, draft, operation(draft)).Geosets[gi];
        assert.notDeepEqual(out.Vertices, g.Vertices, `${label}: operation actually reshapes the mesh`);
        if (out.Vertices.length !== g.Vertices.length) failures.push(`${label}: vertex count changed`);
        if (out.Faces.length !== g.Faces.length) failures.push(`${label}: triangle count changed`);
        if (new Set(group.map(i => positionKey(out, i))).size !== 1) failures.push(`${label}: seam copies split apart in position`);
        for (const i of group) for (let set = 0; set < g.TVertices.length; set++) {
          if (![0, 1].every(axis => out.TVertices[set][i * 2 + axis] === g.TVertices[set][i * 2 + axis])) {
            failures.push(`${label}: vertex ${i}, UV set ${set} changed`);
          }
        }
      }
    });
    assert.equal(cases, fixture === 'citadel-footman' ? 12 : 128, 'all probe seam neighborhoods were exercised');
    t.diagnostic(`${cases} seam neighborhoods checked`);
    assert.deepEqual(failures, [], `${tool}: UV seams must remain joined with their authored UVs`);
  });
}
