// Provider form adapters. Only user input is converted here; no tools or files execute.
function choiceEntries(field) {
  const items = field.type === 'array' ? field.items || {} : field;
  if (Array.isArray(items.oneOf)) return items.oneOf.map(o => ({ value: o.const, label: o.title || String(o.const) }));
  return (items.enum || []).map((value, i) => ({ value, label: items.enumNames?.[i] || String(value) }));
}
function mcpForm(params) {
  const schema = params.requestedSchema;
  if (!['form', 'openai/form', 'openaiForm'].includes(params.mode) || schema?.type !== 'object' || !schema.properties)
    throw Error('This MCP request needs a form with named input fields.');
  const fields = Object.entries(schema.properties);
  if (!fields.length) fields.push(['confirm', { type: 'boolean', title: params.message || 'Continue?' }]);
  const questions = fields.map(([id, field]) => {
    if (!['string', 'number', 'integer', 'boolean', 'array'].includes(field.type) || (field.type === 'array' && !choiceEntries(field).length))
      throw Error('Unsupported MCP form field: ' + id + '. Ask for this value in chat.');
    const choices = choiceEntries(field);
    if (new Set(choices.map(o => o.label)).size !== choices.length) throw Error('MCP choices must have distinct labels.');
    return { id, question: field.title || id, description: field.description || '', required: !Object.keys(schema.properties).length || (schema.required || []).includes(id),
      multiSelect: field.type === 'array', options: field.type === 'boolean' ? [{ label: 'Yes' }, { label: 'No' }] : choices.map(o => ({ label: o.label })),
      allowCustom: !choices.length && !['boolean', 'array'].includes(field.type), inputType: ['number', 'integer'].includes(field.type) ? 'number' : 'text',
      minimum: field.minimum, maximum: field.maximum, minLength: field.minLength, maxLength: field.maxLength, step: field.type === 'integer' ? 1 : 'any' };
  });
  const content = answers => Object.fromEntries(fields.flatMap(([id, field]) => {
    const values = answers[id]?.answers || [];
    if (!values.length) return [];
    const choices = choiceEntries(field);
    const convert = text => {
      if (field.type === 'boolean') { if (!['Yes', 'No'].includes(text)) throw Error('Choose Yes or No for ' + id); return text === 'Yes'; }
      if (choices.length) { const selected = choices.find(o => o.label === text); if (!selected) throw Error('Choose an available value for ' + id); return selected.value; }
      if (['number', 'integer'].includes(field.type)) {
        const value = Number(text);
        if (!Number.isFinite(value) || (field.type === 'integer' && !Number.isInteger(value)) || (field.minimum != null && value < field.minimum) || (field.maximum != null && value > field.maximum)) throw Error('Enter a valid ' + field.type + ' for ' + id);
        return value;
      }
      if ((field.minLength != null && text.length < field.minLength) || (field.maxLength != null && text.length > field.maxLength)) throw Error('Check the answer length for ' + id);
      if (field.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw Error('Enter an email address for ' + id);
      if (field.format === 'uri') { try { new URL(text); } catch { throw Error('Enter a URL for ' + id); } }
      if (['date', 'date-time'].includes(field.format) && Number.isNaN(Date.parse(text))) throw Error('Enter a valid date for ' + id);
      return text;
    };
    if (field.type === 'array' && ((field.minItems != null && values.length < field.minItems) || (field.maxItems != null && values.length > field.maxItems))) throw Error('Check the number of choices for ' + id);
    const value = field.type === 'array' ? values.map(convert) : convert(values[0]);
    return Object.keys(schema.properties).length ? [[id, value]] : [];
  }));
  return { questions, validateAnswers: content, content, empty: !Object.keys(schema.properties).length };
}
// Only plain question text and choices pass from a provider; links, input types and
// validators come from MDLxL's own adapters.
function providerQuestion(q) {
  return { id: q.id, question: q.question, description: typeof q.description === 'string' ? q.description : '',
    options: Array.isArray(q.options) ? q.options.map(o => ({ label: o?.label, description: typeof o?.description === 'string' ? o.description : '' })) : undefined,
    multiSelect: q.multiSelect === true, isSecret: q.isSecret === true, ...(q.isOther === false && q.options?.length ? { allowCustom: false } : {}) };
}
function codexQuestions(params) {
  return { message: typeof params?.message === 'string' ? params.message : '', questions: Array.isArray(params?.questions) ? params.questions.map(q => providerQuestion(q || {})) : params?.questions };
}
function claudeQuestions(input) {
  if (!Array.isArray(input?.questions) || !input.questions.length) throw Error('Claude did not supply a question.');
  return input.questions.map((q, i) => ({ ...providerQuestion(q || {}), id: String(i), required: true }));
}
function questionCancelled(message) { return Object.assign(Error(message), { code: 'AI_QUESTION_CANCELLED' }); }
module.exports = { mcpForm, codexQuestions, claudeQuestions, questionCancelled };
