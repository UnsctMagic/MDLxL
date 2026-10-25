import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { sdLessonChecks, identifyBase, lessonsText, SD_LESSONS } from '../src/sd-lessons.js';

// A small model: boxes bound to named bones, each with its own texture.
function model(boxes) {
  const m = { Version: 800, Bones: [], Helpers: [], Textures: [], Materials: [], Geosets: [], GeosetAnims: [] };
  const bone = name => { let b = m.Bones.find(x => x.Name === name); if (!b) m.Bones.push((b = { Name: name, ObjectId: m.Bones.length })); return b.ObjectId; };
  for (const { lo, hi, bone: name, texture = 'Textures\\Footman.blp', team = false } of boxes) {
    const V = [], U = [], F = [];
    for (let i = 0; i < 8; i++) { V.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]); U.push((i & 1) * 0.5, ((i >> 1) & 1) * 0.5); }
    for (const q of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) F.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    let tex = m.Textures.findIndex(t => t.Image === texture);
    if (tex < 0) tex = m.Textures.push({ Image: texture, ReplaceableId: 0, Flags: 0 }) - 1;
    const layers = [{ TextureID: tex, FilterMode: 0 }];
    if (team) layers.unshift({ TextureID: m.Textures.push({ Image: '', ReplaceableId: 1, Flags: 0 }) - 1, FilterMode: 0 });
    m.Materials.push({ Layers: layers });
    m.Geosets.push({ Vertices: new Float32Array(V), TVertices: [new Float32Array(U)], Faces: new Uint16Array(F), MaterialID: m.Materials.length - 1, VertexGroup: new Uint8Array(8), Groups: [[bone(name)]] });
  }
  return m;
}
const named = (checks, id) => checks.find(c => c.name.startsWith(`Lesson ${id}:`));
const head = { lo: [-5, -5, 90], hi: [5, 5, 100], bone: 'Bone_Head' }, body = { lo: [-10, -10, 0], hi: [10, 10, 90], bone: 'Bone_Chest' };

test('SD lessons travel with every task as plain rules', () => {
  const text = lessonsText([{ rule: 'Keep capes off the ground.', owner: 'capes drag' }]);
  for (const l of SD_LESSONS) assert.ok(text.includes(l.rule));
  assert.match(text, new RegExp(`${SD_LESSONS.length + 1}\\. Keep capes off the ground\\. \\(owner: "capes drag"\\)`));
  assert.ok(SD_LESSONS.some(l => l.id === 'keep-face') && SD_LESSONS.some(l => l.id === 'real-kitbash'));
});

test('SD lesson head-gear-size: head gear close to the head passes, horns far out fail', () => {
  const before = model([body, head]);
  const helm = model([body, head, { lo: [-7, -7, 95], hi: [7, 7, 104], bone: 'Bone_Head' }]);
  assert.equal(named(sdLessonChecks({ before, model: helm }), 'head-gear-size').passed, true);
  const wide = model([body, head, { lo: [-30, -6, 95], hi: [24, 6, 110], bone: 'Bone_Head' }]);
  const check = named(sdLessonChecks({ before, model: wide }), 'head-gear-size');
  assert.equal(check.passed, false);
  assert.match(check.expected, /front to back is too large/);
});

test('SD lesson real-kitbash: a base with a part added fails, a transformed one passes', () => {
  const base = model([body, head, { lo: [-12, 8, 20], hi: [12, 30, 40], bone: 'Bone_Arm' }]);
  const empty = model([]);
  const references = [{ name: 'herodeathknight.mdx', model: base }];
  const added = model([body, head, { lo: [-12, 8, 20], hi: [12, 30, 40], bone: 'Bone_Arm' }, { lo: [10, 0, 40], hi: [14, 4, 120], bone: 'Bone_Sword' }]);
  const check = named(sdLessonChecks({ before: empty, model: added, request: 'undead knight', references }), 'real-kitbash');
  assert.equal(check.passed, false);
  assert.match(check.actual, /100% of herodeathknight\.mdx is still untouched/);
  const reshaped = model([{ ...body, lo: [-14, -12, 0], texture: 'Textures\\InfernalCannon.blp' }, { ...head, hi: [6, 5, 101] }, { lo: [-12, 8, 20], hi: [12, 30, 40], bone: 'Bone_Arm' }]);
  assert.equal(named(sdLessonChecks({ before: empty, model: reshaped, request: 'undead knight', references }), 'real-kitbash').passed, true);
  // Items combine parts nearly whole: no transformation demanded.
  assert.equal(named(sdLessonChecks({ before: empty, model: added, request: 'make an orc axe', references }), 'real-kitbash'), undefined);
});

test('SD lesson no-weapon-team: team colour on a new weapon fails unless asked for', () => {
  const before = model([body]), after = model([body, { lo: [10, 0, 40], hi: [14, 4, 120], bone: 'Bone_Sword', team: true }]);
  assert.equal(named(sdLessonChecks({ before, model: after, request: 'give him a sword' }), 'no-weapon-team').passed, false);
  assert.equal(named(sdLessonChecks({ before, model: after, request: 'a sword with team colour' }), 'no-weapon-team'), undefined);
  const cape = model([body, { lo: [-10, 10, 20], hi: [10, 12, 90], bone: 'Bone_Chest', team: true }]);
  assert.equal(named(sdLessonChecks({ before, model: cape, request: 'give him a cape' }), 'no-weapon-team').passed, true);
});

test('SD lesson preview-paint: new paint must have been looked at; a donor keeps its own skin', () => {
  const before = model([body]), after = model([body, { lo: [10, 0, 40], hi: [14, 4, 120], bone: 'Bone_Sword', texture: 'Textures\\InfernalCannon.blp' }]);
  const unseen = named(sdLessonChecks({ before, model: after }), 'preview-paint');
  assert.equal(unseen.passed, false);
  assert.match(unseen.actual, /InfernalCannon/);
  assert.equal(named(sdLessonChecks({ before, model: after, previewed: ['textures/infernalcannon.blp'] }), 'preview-paint').passed, true);
  assert.equal(named(sdLessonChecks({ before, model: after, previewed: ['model#1'] }), 'preview-paint').passed, true);
  const donor = model([{ ...body, texture: 'Textures\\InfernalCannon.blp' }]);
  assert.equal(named(sdLessonChecks({ before, model: after, references: [{ name: 'donor.mdx', model: donor }] }), 'preview-paint').passed, true);
});

// The face check needs the real Footman (listed in the box of parts); it reads the installed game.
const game = 'D:/Warcraft III', bridge = new URL('../electron/casc/CascBridge-0.9.0.exe', import.meta.url);
test('SD lesson keep-face: the Footman keeps a visible face', { skip: !(fs.existsSync(game) && fs.existsSync(bridge)) && 'needs the installed game' }, async () => {
  const { CascReader } = createRequire(import.meta.url)('../electron/casc.cjs');
  const casc = new CascReader(game, new URL('../electron', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  let bytes;
  try { await casc.ready; bytes = await casc.read('war3.w3mod:units\\human\\footman\\footman.mdx'); } finally { casc.process.kill(); }
  const before = openDocument(bytes, 'footman.mdx').model;
  assert.equal(identifyBase(before)?.id, 'footman', 'recognised as the Footman, not the Captain whose three parts also fit');
  assert.equal(named(sdLessonChecks({ before, model: structuredClone(before) }), 'keep-face').passed, true);
  // A mask plate in front of the face, on the head bone: the face is covered.
  const masked = structuredClone(before), headBone = masked.Bones.find(b => b.Name === 'Box02').ObjectId;
  const plate = model([{ lo: [14, -8, 86], hi: [16, 8, 100], bone: 'x' }]).Geosets[0];
  plate.Groups = [[headBone]]; plate.MaterialID = masked.Geosets[0].MaterialID;
  masked.Geosets.push(plate);
  const covered = named(sdLessonChecks({ before, model: masked }), 'keep-face');
  assert.equal(covered.passed, false);
  assert.match(covered.actual, /of the face that showed before \(\d+%\), \d+% is now hidden/);
  // The face removed.
  const cut = structuredClone(before), g = cut.Geosets[0], faces = [];
  const facePiece = identifyBase(before).parts.find(p => p.label === 'Face and moustache'), first = g.Faces.length;
  for (let f = 0; f < first / 3; f++) faces.push(f);
  const pieceVerts = new Set(identifyBase(before).piecesOf(0).find(p => p.piece === facePiece.piece).vertices);
  g.Faces = Uint16Array.from(faces.filter(f => ![0, 1, 2].every(k => pieceVerts.has(g.Faces[f * 3 + k]))).flatMap(f => [g.Faces[f * 3], g.Faces[f * 3 + 1], g.Faces[f * 3 + 2]]));
  assert.equal(named(sdLessonChecks({ before, model: cut }), 'keep-face').passed, false);
});
