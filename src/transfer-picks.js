// The Transfer pick sheet (test builds only): the cases file, the shuffled letters and the answers.
// Contract: docs/agent-tasks/transfer-xl.md "Pick sheet as built".

export const LETTERS = ['A', 'B', 'C', 'D'];
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\\\\[^\\]|\/)/;
const MODEL_FILE = /\.(?:mdx|mdl)$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const RESERVED = new Set(['same', 'none']);
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const isIndex = value => Number.isInteger(value) && value >= 0;
const text = value => typeof value === 'string' && value.trim().length > 0;

/**
 * Reads a cases file strictly. Throws an Error whose message names the case, variant or field that is
 * wrong. Recipes are returned untouched (the engine may know fields this reader does not).
 */
export function parseCases(source) {
  let data;
  try { data = JSON.parse(source); } catch (error) { throw new Error(`The cases file is not valid JSON: ${error.message}`); }
  if (!isObject(data)) throw new Error('The cases file must be a JSON object with "answers" and "cases".');
  if (!text(data.answers) || !ABSOLUTE.test(data.answers) || !/\.json$/i.test(data.answers)) throw new Error('"answers" must be the absolute path of a .json file.');
  if (!Array.isArray(data.cases) || !data.cases.length) throw new Error('"cases" must be a list with at least one case.');
  const caseIds = new Set();
  const cases = data.cases.map((item, index) => {
    const where = `Case ${index + 1}${isObject(item) && typeof item.id === 'string' ? ` (${item.id})` : ''}`;
    if (!isObject(item)) throw new Error(`${where} must be an object.`);
    if (typeof item.id !== 'string' || !ID.test(item.id)) throw new Error(`${where}: "id" must be 1 to 80 letters, digits, dots, dashes or underscores.`);
    if (caseIds.has(item.id)) throw new Error(`${where}: the id is used twice.`);
    caseIds.add(item.id);
    if (!text(item.question)) throw new Error(`${where}: "question" is missing.`);
    if (item.hint != null && typeof item.hint !== 'string') throw new Error(`${where}: "hint" must be text.`);
    if (!text(item.model) || !ABSOLUTE.test(item.model) || !MODEL_FILE.test(item.model)) throw new Error(`${where}: "model" must be the absolute path of an .mdx or .mdl file.`);
    const donors = item.donors ?? {};
    if (!isObject(donors)) throw new Error(`${where}: "donors" must be an object of names and model paths.`);
    for (const [key, file] of Object.entries(donors)) {
      if (!ID.test(key) || key === 'self') throw new Error(`${where}: donor name "${key}" is not allowed.`);
      if (!text(file) || !ABSOLUTE.test(file) || !MODEL_FILE.test(file)) throw new Error(`${where}: donor "${key}" must be the absolute path of an .mdx or .mdl file.`);
    }
    if (!Array.isArray(item.variants) || item.variants.length < 2 || item.variants.length > 4) throw new Error(`${where}: needs 2 to 4 variants.`);
    const variantIds = new Set();
    const variants = item.variants.map((variant, v) => {
      const at = `${where}, variant ${v + 1}${isObject(variant) && typeof variant.id === 'string' ? ` (${variant.id})` : ''}`;
      if (!isObject(variant)) throw new Error(`${at} must be an object.`);
      if (typeof variant.id !== 'string' || !ID.test(variant.id) || RESERVED.has(variant.id)) throw new Error(`${at}: "id" must be 1 to 80 letters, digits, dots, dashes or underscores, and not "same" or "none".`);
      if (variantIds.has(variant.id)) throw new Error(`${at}: the id is used twice in this case.`);
      variantIds.add(variant.id);
      if (variant.label != null && typeof variant.label !== 'string') throw new Error(`${at}: "label" must be text.`);
      const label = typeof variant.label === 'string' ? variant.label.trim() : '';
      if (variant.file != null && variant.recipe != null) throw new Error(`${at}: give "file" or "recipe", not both.`);
      if (variant.file != null) {
        if (!text(variant.file) || !ABSOLUTE.test(variant.file) || !MODEL_FILE.test(variant.file)) throw new Error(`${at}: "file" must be the absolute path of an .mdx or .mdl file.`);
        return { id: variant.id, label, file: variant.file };
      }
      const recipe = variant.recipe;
      if (!isObject(recipe)) throw new Error(`${at}: "file" or "recipe" is missing.`);
      if (!isObject(recipe.base) || !isIndex(recipe.base.sequence)) throw new Error(`${at}: "recipe.base.sequence" must be an animation number (0 or more).`);
      if (!isObject(recipe.parts)) throw new Error(`${at}: "recipe.parts" must be an object.`);
      for (const [key, part] of Object.entries(recipe.parts)) {
        if (!isObject(part)) throw new Error(`${at}: part "${key}" must be an object.`);
        if (part.source !== 'self' && !Object.hasOwn(donors, part.source)) throw new Error(`${at}: part "${key}" comes from "${part.source}", which is not "self" or one of the donors.`);
        if (!isIndex(part.sequence)) throw new Error(`${at}: part "${key}" needs "sequence", an animation number (0 or more).`);
      }
      return { id: variant.id, label, recipe };
    });
    const kind = variants[0].file ? 'file' : 'recipe';
    if (variants.some(variant => (variant.file ? 'file' : 'recipe') !== kind)) throw new Error(`${where}: variants must all be files or all recipes.`);
    return { id: item.id, question: item.question.trim(), hint: typeof item.hint === 'string' ? item.hint.trim() : '', model: item.model, donors: { ...donors }, kind, variants, ...compareFields(item, where, kind, variantIds) };
  });
  return { answers: data.answers, cases };
}

/**
 * The compare sheet's fields of one case: `sequences` (animation names for the row of animation
 * buttons), `looks` (where to look: an animation, a window from..to in ms from its start, the bones to
 * highlight, a viewing speed in percent, 25 by default), `flip` (two variant ids shown in place of each
 * other) and `answers` (buttons in place of the picks, returned as `choices`). Looks and sequences need
 * file variants, whose animations are chosen by name.
 */
function compareFields(item, where, kind, variantIds) {
  const sequences = item.sequences ?? [];
  if (!Array.isArray(sequences) || sequences.some(name => !text(name))) throw new Error(`${where}: "sequences" must be a list of animation names.`);
  const looks = item.looks ?? [];
  if (!Array.isArray(looks)) throw new Error(`${where}: "looks" must be a list.`);
  if ((looks.length || sequences.length) && kind !== 'file') throw new Error(`${where}: "looks" and "sequences" need file variants.`);
  const time = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const parsedLooks = looks.map((look, l) => {
    const at = `${where}, look ${l + 1}`;
    if (!isObject(look)) throw new Error(`${at} must be an object.`);
    if (!text(look.label)) throw new Error(`${at}: "label" is missing.`);
    if (!text(look.sequence)) throw new Error(`${at}: "sequence" must be an animation name.`);
    if (sequences.length && !sequences.includes(look.sequence)) throw new Error(`${at}: "${look.sequence}" is not in "sequences".`);
    if (!time(look.from)) throw new Error(`${at}: "from" must be a time in ms (0 or more).`);
    if (!time(look.to) || look.to <= look.from) throw new Error(`${at}: "to" must be after "from".`);
    if (!Array.isArray(look.bones) || !look.bones.length || look.bones.some(name => !text(name))) throw new Error(`${at}: "bones" must be a list of bone names.`);
    if (look.speed != null && !(typeof look.speed === 'number' && look.speed >= 1 && look.speed <= 400)) throw new Error(`${at}: "speed" must be 1 to 400 (percent).`);
    return { label: look.label.trim(), sequence: look.sequence, from: look.from, to: look.to, bones: [...look.bones], speed: look.speed ?? 25 };
  });
  const flip = item.flip ?? null;
  if (flip != null && (!Array.isArray(flip) || flip.length !== 2 || flip[0] === flip[1] || !flip.every(id => variantIds.has(id)))) throw new Error(`${where}: "flip" must name two different variants of this case.`);
  const answers = item.answers ?? [];
  if (!Array.isArray(answers) || (answers.length && (answers.length < 2 || answers.length > 6))) throw new Error(`${where}: "answers" must be 2 to 6 buttons.`);
  const ids = new Set();
  const choices = answers.map((answer, a) => {
    const at = `${where}, answer ${a + 1}`;
    if (!isObject(answer)) throw new Error(`${at} must be an object.`);
    if (typeof answer.id !== 'string' || !ID.test(answer.id)) throw new Error(`${at}: "id" must be 1 to 80 letters, digits, dots, dashes or underscores.`);
    if (ids.has(answer.id)) throw new Error(`${at}: the id is used twice.`);
    ids.add(answer.id);
    if (!text(answer.label)) throw new Error(`${at}: "label" is missing.`);
    return { id: answer.id, label: answer.label.trim() };
  });
  return { sequences: [...sequences], looks: parsedLooks, flip: flip && [...flip], choices };
}

/** Answers already written: an object of case id → answer. A missing or unreadable file is no answers. */
export function parseAnswers(source) {
  if (source == null || source === '') return {};
  try { const data = JSON.parse(source); return isObject(data) ? data : {}; } catch { return {}; }
}

// A small seeded generator (mulberry32 over an FNV-1a hash of the seed text).
function seeded(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** The letters of one case: { A: variant id, ... } in an order shuffled by the case id, the same every run.
 * File variants (labelled, compared rather than picked blind) keep the case's order. */
export function caseLetters(item) {
  const ids = item.variants.map(variant => variant.id), random = seeded(item.id);
  if (item.kind === 'file') return Object.fromEntries(ids.map((id, i) => [LETTERS[i], id]));
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return Object.fromEntries(ids.map((id, i) => [LETTERS[i], id]));
}

/** The first case without an answer, or cases.length when every case has one. */
export function firstOpenCase(cases, answers) {
  const index = cases.findIndex(item => !answers[item.id]);
  return index < 0 ? cases.length : index;
}

/** The answers with one case answered: a variant id, 'same' or 'none'. */
export function withAnswer(answers, item, pick, at = new Date().toISOString()) {
  return { ...answers, [item.id]: { pick, letters: caseLetters(item), at } };
}
