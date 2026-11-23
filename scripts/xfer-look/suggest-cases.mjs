// Fill the live Transplant cases while preparing the sheet, before opening it.
// node scripts/xfer-look/suggest-cases.mjs <cases.json> <output.json>
import fs from 'node:fs';
import { openDocument } from '../../src/editor-document.js';
import { suggestToggles } from '../../src/xfer-suggest-toggles.js';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Provide the input cases file and the output path.');
const sheet = JSON.parse(fs.readFileSync(source, 'utf8'));
const open = file => openDocument(fs.readFileSync(file), file).model;

for (const item of sheet.cases) {
  const transplant = item.variants.find(variant => variant.transplant)?.transplant;
  if (!transplant) continue;
  const { recipient, donor, options } = transplant;
  item.suggestion = suggestToggles(open(recipient), open(donor), options);
}

fs.writeFileSync(destination, JSON.stringify(sheet, null, 2) + '\n');
