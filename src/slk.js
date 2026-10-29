function slkFields(line) {
  const fields = []; let current = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      current += char;
      if (quoted && line[i + 1] === '"') { current += line[++i]; continue; }
      quoted = !quoted;
    } else if (char === ';' && !quoted) { fields.push(current); current = ''; }
    else current += char;
  }
  fields.push(current); return fields;
}

/** Read SYLK cell records, retaining omitted coordinates and quoted delimiters. */
export function parseSlk(text) {
  const cells = new Map(); let x = 1, y = 1;
  for (const line of String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const fields = slkFields(line);
    if (fields[0] !== 'C') continue;
    let value;
    for (const field of fields.slice(1)) {
      if (/^X\d+$/.test(field)) x = Number(field.slice(1));
      else if (/^Y\d+$/.test(field)) y = Number(field.slice(1));
      else if (field.startsWith('K')) {
        const raw = field.slice(1);
        value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : /^[-+]?\d+(?:\.\d*)?(?:e[-+]?\d+)?$/i.test(raw) ? Number(raw) : raw;
      }
    }
    if (value !== undefined && Number.isInteger(x) && Number.isInteger(y) && x > 0 && y > 0) {
      if (!cells.has(y)) cells.set(y, new Map());
      cells.get(y).set(x, value);
    }
  }
  const rows = new Map(), header = cells.get(1);
  if (!header) return rows;
  for (const [rowIndex, fields] of cells) {
    if (rowIndex === 1 || !fields.has(1)) continue;
    const row = Object.create(null);
    for (const [column, value] of fields) if (header.has(column)) row[String(header.get(column))] = value;
    rows.set(String(fields.get(1)), row);
  }
  return rows;
}
