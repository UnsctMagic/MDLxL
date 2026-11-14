import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { vertexForgeDraft, vertexForgeResult, vertexForgeFaces } from '../src/forge-vertex.js';
import { createForgeShape, transformForgeSelection, insetForgeFaces, extrudeForgeFaces,
  forgeSelectionNormal, forgeCutFrame, cutForgeShape } from '../src/forge-shape-editing.js';
import { bevelForgeShape, forgeMoldState, prepareForgeMold, previewForgeMold } from '../src/forge-molding.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = (...keys) => { const absent = keys.filter(key => { const file = fixturePath(key); return !file || !fs.existsSync(file); }); return absent.length ? `private test model not on this machine: ${absent.join(', ')}` : false; };

// Independent whole-geoset reference: use the shape owner directly, without
// vertexForgeDraft's local extraction or its private remainder bookkeeping.
function wholeDraft(model, gi, ids) {
  const shape = createForgeShape({ geosets: [model.Geosets[gi]] }, {
    id: gi, name: `Geoset ${gi + 1}`, trackSources: true,
    vertexKey: (g, i) => [g.VertexGroup?.[i], ...Array.from(g.SkinWeights?.slice(i * 8, i * 8 + 8) || [])].join(','),
  });
  return { shapes: [shape], selection: { [gi]: [...new Set(ids.map(i => shape.sourceVertices[i]))] }, mode: 'Vertices' };
}

function mold(draft, tool, amount) {
  const state = { ...forgeMoldState(draft, tool), amount };
  return previewForgeMold(draft, prepareForgeMold(draft, state), state);
}

const operations = {
  Move: draft => ({ ...draft, shapes: draft.shapes.map(shape => transformForgeSelection(shape,
    draft.selection[shape.id], 'Vertices', { translation: [1, 2, 3] })) }),
  Bevel: draft => ({ ...draft, mode: 'Shape', selection: { [draft.shapes[0].id]: ['shape'] },
    shapes: draft.shapes.map(shape => bevelForgeShape(shape, draft.selection[shape.id], 'Vertices', .3, true)) }),
  Taper: draft => mold(draft, 'Taper', .5),
  Bend: draft => mold(draft, 'Bend', 40),
  Twist: draft => mold(draft, 'Twist', 60),
  Inset: draft => ({ ...draft, shapes: draft.shapes.map(shape => insetForgeFaces(shape, draft.selection[shape.id], .2)) }),
  Extrude: draft => ({ ...draft, shapes: draft.shapes.map(shape => extrudeForgeFaces(shape,
    draft.selection[shape.id], forgeSelectionNormal([shape], draft.selection).map(n => n * 2))) }),
  Cut: draft => ({ ...draft, shapes: draft.shapes.map(shape => {
    const ids = draft.selection[shape.id];
    return cutForgeShape(shape, forgeCutFrame(shape, ids[0], false, ids), [.5], ids);
  }) }),
};

// These five selections already reject in the whole-geoset reference. An
// unexpected rejection must fail, even if both paths start throwing together.
const expectedRejections = {
  Bevel: { regions: ['2:3', '4:13', '4:33'], message: 'Select solid edges or the complete border of a thin surface to bevel.' },
  Inset: { regions: ['1:3', '2:8'], message: 'Select faces that follow the same surface to inset.' },
};

// Preserve winding and every corner stream; ignore only face order and vertex
// numbering. Round differences to 4 decimals rather than rounding each value:
// Float32 neighbors can straddle a decimal boundary (94.871948 vs 94.871956).
function triangles(g) {
  const stream = (values, width, i) => values?.length ? Array.from(values.slice(i * width, (i + 1) * width), v => {
    assert.ok(Number.isFinite(v), 'triangle attributes must be finite');
    return v;
  }) : [];
  const corner = i => [stream(g.Vertices, 3, i), stream(g.Normals, 3, i),
    ...g.TVertices.map(uv => stream(uv, 2, i)), stream(g.VertexGroup, 1, i),
    stream(g.SkinWeights, 8, i), stream(g.Tangents, 4, i)].flat();
  const result = [];
  for (let f = 0; f < g.Faces.length; f += 3) {
    result.push(Array.from(g.Faces.slice(f, f + 3), corner));
  }
  return result;
}

function assertSameTriangles(actual, expected, label) {
  assert.equal(actual.TVertices.length, expected.TVertices.length, `${label}: UV set count`);
  const remaining = triangles(expected);
  const observed = triangles(actual);
  assert.equal(observed.length, remaining.length, `${label}: triangle count`);
  let maxDifference = 0;
  for (const triangle of observed) {
    // Each expected triangle is consumed once. Only cyclic rotations are allowed,
    // so duplicate triangles, missing triangles and reversed winding still fail.
    let difference;
    const index = remaining.findIndex(candidate => [0, 1, 2].some(rotation => {
      if (!triangle.every((corner, k) => corner.length === candidate[(k + rotation) % 3].length)) return false;
      const deltas = triangle.flatMap((corner, k) => corner.map((v, a) => v - candidate[(k + rotation) % 3][a]));
      if (!deltas.every(delta => Math.round(delta * 1e4) === 0)) return false;
      difference = Math.max(...deltas.map(Math.abs));
      return true;
    }));
    assert.ok(index !== -1, `${label}: no matching rounded triangle for ${JSON.stringify(triangle)}`);
    maxDifference = Math.max(maxDifference, difference);
    remaining.splice(index, 1);
  }
  return maxDifference;
}

function regions(model) {
  return model.Geosets.flatMap((g, gi) => {
    const used = [...new Set(g.Faces)];
    return used.filter((_, i) => i % Math.max(1, Math.floor(used.length / 5)) === 3).slice(0, 5).map(seed => {
      const ring = new Set([seed]);
      for (let f = 0; f < g.Faces.length; f += 3) {
        const triangle = Array.from(g.Faces.slice(f, f + 3));
        if (triangle.includes(seed)) triangle.forEach(i => ring.add(i));
      }
      return { gi, seed, selection: [...ring] };
    });
  });
}

for (const [tool, operation] of Object.entries(operations)) test(`citadel-footman: local ${tool} triangles match a whole-geoset draft`, { skip: missing('citadel-footman') }, t => {
  const bytes = fs.readFileSync(fixturePath('citadel-footman'));
  const localModel = openDocument(bytes, 'Footman.mdx').model, wholeModel = openDocument(bytes, 'Footman.mdx').model;
  let compared = 0, rejected = 0, reduced = 0, empty = 0, maxDifference = 0;
  for (const { gi, seed, selection } of regions(localModel)) {
    const local = vertexForgeDraft(localModel, { [gi]: selection }), whole = wholeDraft(wholeModel, gi, selection);
    if (local.shapes[0].faces.length < whole.shapes[0].faces.length) reduced++;
    const run = (model, draft) => {
      if (['Inset', 'Extrude', 'Cut'].includes(tool)) draft = vertexForgeFaces(draft);
      if (!draft.selection[gi].length) return { geoset: model.Geosets[gi], empty: true };
      try { return { geoset: vertexForgeResult(model, draft, operation(draft)).Geosets[gi] }; }
      catch (error) { return { error: error.message }; }
    };
    const a = run(localModel, local), b = run(wholeModel, whole), label = `${tool}, geoset ${gi}, seed ${seed}`;
    assert.equal(a.empty, b.empty, `${label}: face selection agrees`);
    assert.equal(a.error, b.error, `${label}: both drafts accept or reject the same operation`);
    const expected = expectedRejections[tool];
    assert.equal(a.error, expected?.regions.includes(`${gi}:${seed}`) ? expected.message : undefined,
      `${label}: only the known unsupported selections reject`);
    if (a.error !== undefined) { rejected++; t.diagnostic(`${label}: ${a.error}`); continue; }
    maxDifference = Math.max(maxDifference, assertSameTriangles(a.geoset, b.geoset, label));
    if (a.empty) empty++;
    compared++;
  }
  assert.equal(reduced, 20, 'all probe regions exercise a genuinely reduced local draft');
  assert.equal(rejected, expectedRejections[tool]?.regions.length || 0, 'known rejection count');
  assert.equal(compared, 20 - rejected, 'all remaining probe outputs were compared');
  assert.equal(empty, ['Inset', 'Extrude', 'Cut'].includes(tool) ? 3 : 0, 'empty face selections are counted separately');
  t.diagnostic(`${compared} matching outputs (${empty} empty face selections), ${rejected} matching rejections, ${reduced} reduced drafts; max corner difference ${maxDifference}`);
});
