import test from 'node:test';
import assert from 'node:assert/strict';
import { caseLetters, firstOpenCase, lookNodes, parseAnswers, parseCases, withAnswer } from '../src/transfer-picks.js';

const recipe = (amount = 1) => ({ base: { sequence: 0 }, length: null, sources: {}, parts: { armL: { source: 'd0', sequence: 2, amount, future: { kept: true } } } });
const sheet = (change = data => data) => JSON.stringify(change({
  answers: 'D:\\picks\\answers.json',
  cases: [{ id: 'pads-kurgan', question: 'Which shoulder pads look right?', hint: 'Watch the left arm.', model: 'D:\\models\\Kurgan.mdx', donors: { d0: 'D:\\models\\Grunt.mdx' },
    variants: [{ id: 'off', recipe: recipe(0) }, { id: 'half', recipe: recipe(0.5) }, { id: 'full', recipe: recipe(1) }] }],
}));

test('a good cases file is read with its recipes untouched', () => {
  const { answers, cases } = parseCases(sheet());
  assert.equal(answers, 'D:\\picks\\answers.json');
  assert.equal(cases.length, 1);
  assert.deepEqual(cases[0].variants[2].recipe, recipe(1), 'fields the reader does not know stay in the recipe');
  assert.equal(cases[0].hint, 'Watch the left arm.');
});

test('a malformed cases file names what is wrong', () => {
  const fails = (change, pattern) => assert.throws(() => parseCases(sheet(change)), pattern);
  assert.throws(() => parseCases('{nope'), /not valid JSON/);
  fails(data => ({ ...data, answers: 'answers.json' }), /"answers" must be the absolute path/);
  fails(data => ({ ...data, cases: [] }), /at least one case/);
  fails(data => { data.cases[0].variants = data.cases[0].variants.slice(0, 1); return data; }, /Case 1 \(pads-kurgan\): needs 2 to 4 variants/);
  fails(data => { data.cases[0].variants[1].id = 'off'; return data; }, /variant 2 \(off\): the id is used twice/);
  fails(data => { data.cases[0].variants[1].id = 'none'; return data; }, /not "same" or "none"/);
  fails(data => { data.cases[0].variants[0].recipe.parts.armL.source = 'd1'; return data; }, /variant 1 \(off\): part "armL" comes from "d1"/);
  fails(data => { data.cases[0].variants[0].recipe.base.sequence = '0'; return data; }, /recipe\.base\.sequence/);
  fails(data => { data.cases[0].model = 'D:\\models\\Kurgan.png'; return data; }, /"model" must be the absolute path of an \.mdx or \.mdl file/);
  fails(data => { data.cases.push({ ...data.cases[0] }); return data; }, /Case 2 \(pads-kurgan\): the id is used twice/);
});

test('letters are shuffled by the case id and the same on every run', () => {
  const [item] = parseCases(sheet()).cases;
  const letters = caseLetters(item);
  assert.deepEqual(Object.keys(letters), ['A', 'B', 'C']);
  assert.deepEqual(Object.values(letters).sort(), ['full', 'half', 'off']);
  assert.deepEqual(caseLetters(item), letters);
  const orders = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => Object.values(caseLetters({ ...item, id })).join()));
  assert.ok(orders.size > 1, 'different cases get different orders');
});

// The compare sheet: finished model files as variants, looks, flip and answer buttons.
const compare = (change = data => data) => JSON.stringify(change({
  answers: 'D:\\review\\answers.json',
  cases: [{ id: 'transplant', question: 'Transplant: warrior on the Tauren skeleton', model: 'D:\\models\\Tauren.mdx',
    variants: [{ id: 'donor', label: 'Tauren (donor)', file: 'D:\\models\\Tauren.mdx' }, { id: 'v01', label: '01 nothing kept', file: 'D:\\models\\TEST TRANSPLANT 01.mdx' }, { id: 'v02', file: 'D:\\models\\TEST TRANSPLANT 02.mdl' }],
    sequences: ['Stand -1', 'Walk', 'Attack - 1'],
    looks: [{ label: 'Hammer — Attack 1', sequence: 'Attack - 1', from: 417, to: 817, bones: ['Wep', 'Bone_HandR'] }, { label: 'Feet — Walk', sequence: 'Walk', from: 100, to: 567, bones: ['LLF'], speed: 50 }],
    flip: ['v01', 'v02'],
    answers: [{ id: 'good', label: 'Good' }, { id: 'needs-work', label: 'Needs work' }] }],
}));

test('file variants, looks, flip and answer buttons are read', () => {
  const [item] = parseCases(compare()).cases;
  assert.equal(item.kind, 'file');
  assert.deepEqual(item.variants.map(v => [v.id, v.label, v.file]), [['donor', 'Tauren (donor)', 'D:\\models\\Tauren.mdx'], ['v01', '01 nothing kept', 'D:\\models\\TEST TRANSPLANT 01.mdx'], ['v02', '', 'D:\\models\\TEST TRANSPLANT 02.mdl']]);
  assert.deepEqual(item.sequences, ['Stand -1', 'Walk', 'Attack - 1']);
  assert.deepEqual(item.looks[0], { label: 'Hammer — Attack 1', sequence: 'Attack - 1', from: 417, to: 817, bones: ['Wep', 'Bone_HandR'], speed: 25 }, 'viewing speed defaults to 25%');
  assert.equal(item.looks[1].speed, 50);
  assert.deepEqual(item.flip, ['v01', 'v02']);
  assert.deepEqual(item.choices, [{ id: 'good', label: 'Good' }, { id: 'needs-work', label: 'Needs work' }]);
  assert.deepEqual(caseLetters(item), { A: 'donor', B: 'v01', C: 'v02' }, 'labelled file views keep their order');
  assert.deepEqual(withAnswer({}, item, 'good', 'now').transplant, { pick: 'good', letters: { A: 'donor', B: 'v01', C: 'v02' }, at: 'now' });
});

test('recipe cases still read as before, with no looks or answer buttons', () => {
  const [item] = parseCases(sheet()).cases;
  assert.equal(item.kind, 'recipe');
  assert.deepEqual([item.sequences, item.looks, item.flip, item.choices], [[], [], null, []]);
  const [flipped] = parseCases(sheet(data => { data.cases[0].flip = ['off', 'full']; data.cases[0].variants[0].label = 'Off'; return data; })).cases;
  assert.deepEqual(flipped.flip, ['off', 'full']);
  assert.equal(flipped.variants[0].label, 'Off');
});

test('a malformed compare case names what is wrong', () => {
  const fails = (change, pattern) => assert.throws(() => parseCases(compare(change)), pattern);
  fails(data => { data.cases[0].variants[1].file = 'TEST TRANSPLANT 01.mdx'; return data; }, /variant 2 \(v01\): "file" must be the absolute path of an \.mdx or \.mdl file/);
  fails(data => { data.cases[0].variants[1].recipe = recipe(); return data; }, /variant 2 \(v01\): give "file" or "recipe", not both/);
  fails(data => { delete data.cases[0].variants[1].file; return data; }, /variant 2 \(v01\): "file" or "recipe" is missing/);
  fails(data => { data.cases[0].variants[2] = { id: 'v02', recipe: { base: { sequence: 0 }, parts: {} } }; return data; }, /Case 1 \(transplant\): variants must all be files or all recipes/);
  fails(data => { data.cases[0].variants[0].label = 7; return data; }, /variant 1 \(donor\): "label" must be text/);
  fails(data => { data.cases[0].sequences = ['Walk', '']; return data; }, /"sequences" must be a list of animation names/);
  fails(data => { data.cases[0].looks[0].to = 400; return data; }, /look 1: "to" must be after "from"/);
  fails(data => { data.cases[0].looks[0].from = -1; return data; }, /look 1: "from" must be a time in ms/);
  fails(data => { data.cases[0].looks[1].bones = []; return data; }, /look 2: "bones" must be a list of bone names/);
  fails(data => { data.cases[0].looks[1].sequence = 'Spell'; return data; }, /look 2: "Spell" is not in "sequences"/);
  fails(data => { data.cases[0].looks[1].speed = 0; return data; }, /look 2: "speed" must be 1 to 400/);
  fails(data => { data.cases[0].looks[0].label = ''; return data; }, /look 1: "label" is missing/);
  fails(data => { data.cases[0].flip = ['v01', 'v09']; return data; }, /"flip" must name two different variants of this case/);
  fails(data => { data.cases[0].answers = [{ id: 'good', label: 'Good' }]; return data; }, /"answers" must be 2 to 6 buttons/);
  fails(data => { data.cases[0].answers[1].id = 'good'; return data; }, /answer 2: the id is used twice/);
  fails(data => { data.cases[0].answers[1].label = ' '; return data; }, /answer 2: "label" is missing/);
  assert.throws(() => parseCases(sheet(data => { data.cases[0].looks = [{ label: 'x', sequence: 'Walk', from: 0, to: 1, bones: ['a'] }]; return data; })), /"looks" and "sequences" need file variants/);
});

test('a look\'s bones light up by role in a model that names them differently', () => {
  const node = (ObjectId, Name) => ({ ObjectId, Name });
  const donor = { Bones: [node(0, 'Bone_UpperlegL'), node(1, 'Bone_Leg2L'), node(2, 'Bone_Leg3L'), node(3, 'Bone_FootL'), node(4, 'Bone_Totum')] };
  const result = { Bones: [node(10, 'RL1'), node(11, 'RL2'), node(12, 'RLF'), node(13, 'Wep')] };
  const rigs = { donor: { parts: { legL: { key: 'legL', joints: [0, 1, 2, 3] } } }, result: { parts: { legL: { key: 'legL', joints: [10, 11, 12] } } } };
  const found = lookNodes([{ id: 'donor', model: donor, rig: rigs.donor }, { id: 'result', model: result, rig: rigs.result }], ['Bone_FootL', 'LLF', 'Wep']);
  assert.deepEqual(found.donor, { ids: [3], missing: ['LLF', 'Wep'] }, 'the foot by name; nothing else of the look is in the donor');
  assert.deepEqual(found.result, { ids: [12, 13], missing: ['LLF'] }, 'the donor foot found as the end of the same leg, the hammer by name');
  const none = lookNodes([{ id: 'result', model: result, rig: rigs.result }], ['Bone_Head']);
  assert.deepEqual(none.result, { ids: [], missing: ['Bone_Head'] });
});

test('answers resume at the first unanswered case', () => {
  const { cases } = parseCases(sheet(data => { data.cases.push({ ...data.cases[0], id: 'second' }); return data; }));
  assert.equal(firstOpenCase(cases, {}), 0);
  const one = withAnswer({}, cases[0], 'half', '2026-11-16T10:00:00.000Z');
  assert.deepEqual(one['pads-kurgan'], { pick: 'half', letters: caseLetters(cases[0]), at: '2026-11-16T10:00:00.000Z' });
  assert.equal(firstOpenCase(cases, one), 1);
  assert.equal(firstOpenCase(cases, withAnswer(one, cases[1], 'none')), 2);
  assert.deepEqual(parseAnswers(null), {});
  assert.deepEqual(parseAnswers('not json'), {});
  assert.deepEqual(parseAnswers(JSON.stringify(one)), one);
});
