import { Buffer } from 'buffer';
import { parseMdl } from './mdl-lossless.js';

export const MODEL_COMMENTS_KEY = '_ModelComments';
function headerComments(bytes) {
  const records = [];
  for (const token of parseMdl(bytes).tokens) {
    if (token.kind === 'whitespace') continue;
    if (!['line-comment', 'block-comment'].includes(token.kind)) break;
    if (!token.raw.toString('utf8').startsWith('// MDLXL_')) records.push(token);
  }
  return records;
}
export function readModelComments(input, format) {
  if (format !== 'mdl') return '';
  return headerComments(Buffer.from(input)).map(token => {
    const text = token.raw.toString('utf8');
    if (token.kind === 'block-comment') return text.slice(2, -2).trim();
    return text.slice(2).replace(/^ /, '').replace(/^\\(?=MDLXL_|\\)/, '');
  }).join('\n');
}
export function writeModelComments(input, format, text = '') {
  const bytes = Buffer.from(input);
  if (format !== 'mdl' || readModelComments(bytes, format) === text) return bytes;
  const parts = []; let cursor = 0;
  for (const token of headerComments(bytes)) {
    parts.push(bytes.subarray(cursor, token.start)); cursor = token.end;
    if (bytes[cursor] === 13) cursor++;
    if (bytes[cursor] === 10) cursor++;
  }
  parts.push(bytes.subarray(cursor));
  const body = Buffer.concat(parts);
  return text ? Buffer.concat([Buffer.from(text.replace(/\r\n?/g, '\n').split('\n').map(line => '// ' + line.replace(/^(?=MDLXL_|\\)/, '\\')).join('\n') + '\n', 'utf8'), body]) : body;
}
