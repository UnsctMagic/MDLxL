import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { allNodes, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { automaticParts, pushOutVertices, rigPartLabels, sweepIntersections } from '../src/mesh-intersect.js';
import { sampleAiModel } from '../src/ai-sampling.js';
import { AI_SWEEP_SCHEMA } from '../src/ai-tools.js';

const { fixturePath, testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const footmanFile = fixturePath('citadel-footman'), knightFile = testModel('corpus-sd/undead__herodeathknight.mdx');
const missing = (...files) => files.some(file => !file || !fs.existsSync(file)) && 'test model not on this machine';
const load = file => openDocument(fs.readFileSync(file), 'model.mdx').model;
const id = (model, name) => allNodes(model).find(n => n.Name === name).ObjectId;
const sword = model => ({ nodeIds: [id(model, 'Cone11')] }), head = model => ({ nodeIds: [id(model, 'Bone_Head')] });

// Moves the sword (vertices bound to Cone11 and below) so its vertex nearest the helmet's centre sits
// `depth` units inside the helmet along the line between them.
function pierceHelmet(model, depth) {
  const g = model.Geosets[0], matrices = sampleNodeMatrices(model, 0, -1), posed = skinGeoset(g, matrices);
  const labels = rigPartLabels(model), swordIds = [], headIds = [];
  const cone = id(model, 'Cone11'), helm = id(model, 'Bone_Head'), nodes = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  const under = (bone, root) => { for (let at = bone; at != null; at = nodes.get(at)?.Parent) if (at === root) return true; return false; };
  for (let v = 0; v < g.Vertices.length / 3; v++) {
    const bones = Array.from(g.Groups[g.VertexGroup[v]]);
    if (bones.every(b => under(b, cone))) swordIds.push(v); else if (bones.every(b => under(b, helm))) headIds.push(v);
  }
  assert.ok(labels.get(cone) === 'weapon' && swordIds.length > 10 && headIds.length > 10);
  const centre = [0, 1, 2].map(k => headIds.reduce((s, v) => s + posed[v * 3 + k], 0) / headIds.length);
  const near = swordIds.reduce((best, v) => Math.hypot(...[0, 1, 2].map(k => posed[v * 3 + k] - centre[k])) < Math.hypot(...[0, 1, 2].map(k => posed[best * 3 + k] - centre[k])) ? v : best);
  const radius = Math.max(...headIds.map(v => Math.hypot(...[0, 1, 2].map(k => posed[v * 3 + k] - centre[k])))) * .5;
  const from = [0, 1, 2].map(k => g.Vertices[near * 3 + k]), toward = [0, 1, 2].map(k => centre[k] - from[k]), length = Math.hypot(...toward);
  const goal = [0, 1, 2].map(k => centre[k] - toward[k] / length * Math.max(0, radius - depth));
  for (const v of swordIds) for (let k = 0; k < 3; k++) g.Vertices[v * 3 + k] += goal[k] - from[k];
  return model;
}

test('rig parts: the Footman sword, helmet, arms and legs, and the Death Knight horse as a mount', { skip: missing(footmanFile, knightFile) }, () => {
  const footman = load(footmanFile), labels = rigPartLabels(footman);
  assert.equal(labels.get(id(footman, 'Cone11')), 'weapon');
  assert.equal(labels.get(id(footman, 'Bone_Head')), 'head');
  assert.equal(labels.get(id(footman, 'Bone_Arm1_R')), 'arm');
  assert.equal(labels.get(id(footman, 'Bone_Foot_L')), 'leg');
  assert.ok(![...labels.values()].includes('mount'), 'a soldier on foot has no mount');
  const knight = load(knightFile), parts = automaticParts(knight), knightLabels = rigPartLabels(knight);
  assert.equal(knightLabels.get(id(knight, 'Bone Horse')), 'mount');
  assert.equal(knightLabels.get(id(knight, 'Bone Hors8')), 'mount', 'a hoof belongs to the mount');
  assert.equal(knightLabels.get(id(knight, 'Bone_Chest')), 'body', 'the rider is not the mount');
  assert.ok(parts.pairs.some(([a, b]) => a === 'weapon' && b === 'mount'));
});

test('a sword pushed into the helmet clips at rest; the untouched and a far-away sword do not', { skip: missing(footmanFile) }, async () => {
  const original = load(footmanFile), stand = 0;
  const run = model => sweepIntersections(model, { a: sword(model), b: head(model), sequences: [stand] });
  const clean = await run(original);
  assert.equal(clean.pairs[0].rest, 0);
  assert.equal(clean.pairs[0].rows[0][2], 0, 'Stand - 1 has no crossing frames');
  assert.equal(clean.stepMs, 5);
  assert.equal(clean.pairs[0].rows[0][1], 301, 'every 5 ms through 1500 ms, both ends included');
  const pierced = await run(pierceHelmet(load(footmanFile), 6));
  const [row] = pierced.pairs[0].rows;
  assert.ok(pierced.pairs[0].rest > 0, `crossings at rest: ${pierced.pairs[0].rest}`);
  assert.equal(row[2], row[1], 'every frame of Stand - 1 clips');
  assert.ok(pierced.pairs[0].worst.depth > 1 && pierced.pairs[0].worst.extent > 0, JSON.stringify(pierced.pairs[0].worst));
  assert.ok(pierced.pairs[0].worst.vertices.a[0].length > 0 && pierced.pairs[0].worst.vertices.b[0].length > 0);
  const far = load(footmanFile), g = far.Geosets[0];
  const moved = pierceHelmet(load(footmanFile), 6).Geosets[0].Vertices;
  for (let i = 0; i < g.Vertices.length; i += 3) if (moved[i] !== g.Vertices[i]) g.Vertices[i] += 500;
  const away = await run(far);
  assert.equal(away.pairs[0].rest, 0);
  assert.equal(away.pairs[0].rows[0][2], 0);
});

test('push-out moves the pierced sword vertices out of the helmet and clears most crossings', { skip: missing(footmanFile) }, () => {
  const model = pierceHelmet(load(footmanFile), 4), before = structuredClone(model.Geosets[0].Vertices);
  const result = pushOutVertices(model, { a: sword(model), b: head(model), margin: .5 });
  assert.ok(result.before > 0 && result.moved > 0, JSON.stringify(result));
  assert.ok(result.after < result.before, JSON.stringify(result));
  const changed = [...before].filter((v, i) => v !== model.Geosets[0].Vertices[i]).length;
  assert.ok(changed > 0 && changed <= result.moved * 3);
});

test('the sample tool sweeps automatic parts of the mounted Death Knight at 5 ms', { skip: missing(knightFile) }, async () => {
  const knight = load(knightFile), attack = knight.Sequences.findIndex(s => /^attack/i.test(s.Name));
  assert.ok(!AI_SWEEP_SCHEMA.required.includes('a') && AI_SWEEP_SCHEMA.properties.kind.enum.includes('intersect'));
  const result = await sampleAiModel(knight, { sequence: 0, frame: 0 }, { sweep: { kind: 'intersect', sequences: [attack] } });
  assert.equal(result.kind, 'intersect');
  assert.ok(['weapon', 'arm', 'head', 'body', 'mount'].every(part => part in result.parts), JSON.stringify(result.parts));
  const lance = result.pairs.find(p => p.a === 'weapon' && p.b === 'mount');
  assert.equal(lance.rows[0][1], Math.ceil((knight.Sequences[attack].Interval[1] - knight.Sequences[attack].Interval[0]) / 5) + 1);
  assert.deepEqual(result.columns, ['clip', 'framesSampled', 'framesHit', 'worst', 'worstMs', 'firstHitMs', 'lastHitMs']);
  await assert.rejects(sampleAiModel(knight, { sequence: 0 }, { sweep: { kind: 'intersect', a: { geosets: [0] } } }), /both parts/);
  await assert.rejects(sampleAiModel(knight, { sequence: 0 }, { sweep: { kind: 'intersect', a: { nodeId: 1 }, b: { geosets: [0] } } }), /geosets, nodeIds and exclude/);
  await assert.rejects(sampleAiModel(knight, { sequence: 0 }, { sweep: { kind: 'clear' } }), /point A/);
});
