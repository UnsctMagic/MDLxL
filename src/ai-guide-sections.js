// Named sections keep a narrow edit from carrying an entire handbook guide.
// The model can fetch any listed section (or the complete guide) later.
function sections(markdown) {
  return [...markdown.matchAll(/^## (.+?)\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)]
    .map(match => ({ title: match[1].trim(), text: match[0].trim() }));
}
export function readGuideSection(markdown, title) {
  const items = sections(markdown);
  const found = items.find(item => item.title.toLowerCase() === String(title).trim().toLowerCase());
  if (!found) throw Error('Choose a guide section: ' + items.map(item => item.title).join(', '));
  return found.text;
}
export function initialGuideText(markdown, request) {
  const items = sections(markdown);
  if (items.length < 3) return markdown;
  const query = String(request).toLowerCase();
  const terms = query.match(/[\p{L}\p{N}]+/gu) || [];
  if (/брон|наплеч|armadur|护甲|肩甲|rigid|armou?r|pauldron|plate/.test(query)) terms.push('rigid');
  if (/плащ|пелерин|capa|披风|cape|cloth/.test(query)) terms.push('layer', 'contact');
  const ignored = new Set(['the', 'and', 'this', 'for', 'model', 'with', 'its', 'into', 'one', 'edit', 'add']);
  const selected = items.map((item, i) => ({ i, score: [...new Set(terms)].filter(term =>
    term.length >= 3 && !ignored.has(term) && item.title.toLowerCase().includes(term)).length }))
    .filter(row => row.score).sort((a, b) => b.score - a.score).slice(0, 2);
  const keep = new Set([0, ...selected.map(row => row.i)]);
  return items.filter((_, i) => keep.has(i)).map(item => item.text).join('\n\n') +
    '\n\nOther sections available through mdlxl_help: ' + items.filter((_, i) => !keep.has(i)).map(item => item.title).join(' | ');
}
