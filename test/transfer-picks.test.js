import test from 'node:test';
import assert from 'node:assert/strict';
import { caseLetters, firstOpenCase, GRADES, lookNodes, parseAnswers, parseCases, withAnswer, withGrade } from '../src/transfer-picks.js';

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

// The grade sheet: a case with `grade: true` takes a 0-10 grade and a comment instead of picks.
const graded = (change = data => data) => compare(data => { data.cases[0].grade = true; delete data.cases[0].answers; delete data.cases[0].flip; delete data.cases[0].looks; return change(data); });

test('a grade case is read, and a malformed one names what is wrong', () => {
  const [item] = parseCases(graded()).cases;
  assert.equal(item.grade, true);
  assert.deepEqual(item.choices, []);
  assert.equal(parseCases(compare()).cases[0].grade, false, 'cases without "grade" are not graded');
  assert.deepEqual(GRADES, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.throws(() => parseCases(graded(data => { data.cases[0].grade = 'yes'; return data; })), /Case 1 \(transplant\): "grade" must be true or false/);
  assert.throws(() => parseCases(graded(data => { data.cases[0].answers = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]; return data; })), /Case 1 \(transplant\): "grade" and "answers" cannot be used together/);
});

test('a grade and its comment are saved together, each kept when the other changes', () => {
  const { cases } = parseCases(graded(data => { data.cases.push({ ...data.cases[0], id: 'second' }); return data; }));
  const [first] = cases;
  const typed = withGrade({}, first, { comment: 'Arms go through the chest' }, 't1');
  assert.deepEqual(typed.transplant, { grade: null, comment: 'Arms go through the chest', at: 't1' }, 'a comment before a grade');
  assert.equal(firstOpenCase(cases, typed), 0, 'a comment alone does not finish a case');
  const both = withGrade(typed, first, { grade: 3 }, 't2');
  assert.deepEqual(both.transplant, { grade: 3, comment: 'Arms go through the chest', at: 't2' }, 'the grade keeps the comment');
  assert.equal(firstOpenCase(cases, both), 1, 'a grade finishes the case');
  assert.deepEqual(withGrade(both, first, { comment: '' }, 't3').transplant, { grade: 3, comment: '', at: 't3' }, 'the comment can be emptied, the grade stays');
  assert.deepEqual(withGrade(both, first, { grade: 0 }, 't4').transplant.grade, 0, '0 is a grade');
  assert.deepEqual(withGrade(both, first, { grade: 10 }, 't4').transplant.grade, 10);
  for (const bad of [-1, 11, 2.5, '5']) assert.throws(() => withGrade({}, first, { grade: bad }), /grade must be a whole number from 0 to 10/);
  assert.deepEqual(parseAnswers(JSON.stringify(both)), both);
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

test('a live transplant sheet keeps view order and the chosen repairs with the grade', () => {
  const donor = 'D:/models/Knightess.mdx';
  const transplant = { recipient: 'D:/models/Paladin.mdx', donor, options: { mirror: false } };
  const [item] = parseCases(JSON.stringify({ answers: 'D:/review/answers.json', cases: [{
    id: 'paladin', question: 'Knightess to Paladin', grade: true, model: donor,
    variants: [{ id:'donor', file:donor }, { id:'before', transplant }, { id:'after', transplant }],
    sequences: ['Attack - 1'], looks: [{ label:'Blade', sequence:'Attack - 1', from:0, to:500, bones:['Hand_R'] }],
    suggestion: { visible: ['detached','looseAxis'], suggested: ['detached'] },
  }] })).cases;
  assert.equal(item.kind, 'transplant');
  assert.deepEqual(caseLetters(item), {A:'donor',B:'before',C:'after'});
  const draft = withGrade({}, item, { comment:'blade moved', toggles:['detached','looseAxis'] }, 'draft');
  assert.deepEqual(withGrade(draft,item,{ grade:8 },'graded').paladin, {
    grade:8, comment:'blade moved', toggles:['detached','looseAxis'], suggested:['detached'], at:'graded',
  });
});

// Seam fix was removed on the owner's word (26 Nov 2026, "Remove it"); old sheets and answers still name it.
const oldSheet = (visible, suggested) => {
  const donor = 'D:/models/RedDragon.mdx';
  const transplant = { recipient: 'D:/models/Wyvern.mdx', donor, options: { mirror: false } };
  return JSON.stringify({ answers: 'D:/review/answers.json', cases: [{
    id: 'reasonable-46', question: 'Red Dragon to Wind Rider', grade: true, model: donor,
    variants: [{ id:'donor', file:donor }, { id:'before', transplant }, { id:'after', transplant }],
    suggestion: { visible, suggested },
  }] });
};

test('an old sheet that names the retired Seam fix opens without it; a key that never existed still fails', () => {
  const [item] = parseCases(oldSheet(['rootHeight', 'seamFix', 'donorPose'], ['seamFix', 'seatWeapon'])).cases;
  assert.deepEqual(item.suggestion.visible, ['rootHeight', 'donorPose']);
  assert.deepEqual(item.suggestion.suggested, ['seatWeapon']);
  assert.throws(() => parseCases(oldSheet(['rootHeight', 'madeUpFix'], [])), /a saved repair suggestion is required/);
});

test('grading an old answer drops the retired Seam fix for that pair only', () => {
  const [item] = parseCases(oldSheet(['seamFix', 'seatWeapon'], ['seamFix', 'seatWeapon'])).cases;
  const saved = { 'reasonable-46': { grade: 0, comment: 'holes', toggles: ['seamFix', 'seatWeapon'], suggested: ['seamFix', 'seatWeapon'], at: 'old' },
    'random-03': { grade: 0, comment: 'ogre chest', toggles: ['seamFix'], suggested: ['seamFix'], at: 'old' } };
  const next = withGrade(saved, item, { grade: 2 }, 'new');
  assert.deepEqual(next['reasonable-46'].toggles, ['seatWeapon']);
  assert.deepEqual(next['random-03'], saved['random-03'], 'another pair\'s saved answer is written back untouched');
});

// Mirror legs carries the Leg timing slider; the sheet keeps its value beside the ticks.
test('an answer keeps the Leg timing beside the ticks', () => {
  const [item] = parseCases(oldSheet(['mirrorLegs', 'useArms'], ['mirrorLegs'])).cases;
  const set = withGrade({}, item, { toggles: ['mirrorLegs'], legTiming: 35 }, 't1');
  assert.equal(set['reasonable-46'].legTiming, 35);
  const graded = withGrade(set, item, { grade: 7 }, 't2');
  assert.deepEqual(graded['reasonable-46'], { grade: 7, comment: '', at: 't2', toggles: ['mirrorLegs'], suggested: ['mirrorLegs'], legTiming: 35 });
  assert.equal(withGrade({}, item, { grade: 5 }, 't3')['reasonable-46'].legTiming, undefined, 'no slider value is written until one is set');
});
