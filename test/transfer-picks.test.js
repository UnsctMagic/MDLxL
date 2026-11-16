import test from 'node:test';
import assert from 'node:assert/strict';
import { caseLetters, firstOpenCase, parseAnswers, parseCases, withAnswer } from '../src/transfer-picks.js';

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
