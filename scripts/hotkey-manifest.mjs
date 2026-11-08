// Builds src/hotkey-manifest.json: every data-hotkey-manual control (a control with no default key that
// the user can bind), so Settings lists windows never opened on this PC.
// Usage: node scripts/hotkey-manifest.mjs   (test/hotkey-default-overlaps.test.js fails when it is stale)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = /data-hotkey="([^"]+)" data-hotkey-manual(?:="")?(?: data-hotkey-label="([^"]+)")?/g;

/** The id's first segment → the window it lives in (`group`, as controlWindow reports it) and its Settings category. */
export const MANUAL_WINDOWS = Object.freeze({
  eachPiece: { group: 'editor', category: 'Tools' },
  particles: { group: 'Particle Editor', category: 'Particle Editor' },
  'particle-library': { group: 'Particle Editor', category: 'Particle Library' },
  'particle-picture': { group: 'Particle Editor', category: 'Particle Editor' },
  animxl: { group: 'animxl', category: 'AnimXL' },
  'texture-library': { group: 'texture-library', category: 'Texture Library' },
  'game-files': { group: 'texture-library', category: 'Game files' },
  showcase: { group: 'editor', category: 'Showcase' },
  optimizexl: { group: 'optimizexl', category: 'OptimizeXL' },
  'forge-image': { group: 'Forge', category: 'Forge' },
  uv: { group: 'UV Wrapper', category: 'UV' },
  'uv-wrapper': { group: 'UV Wrapper', category: 'UV Wrapper' },
  'animation-controller': { group: 'editor', category: 'Animation Controller' },
  portrait: { group: 'editor', category: 'Portrait' },
  pose: { group: 'editor', category: 'POSE' },
  'geoset-tabs': { group: 'editor', category: 'Geoset tabs' },
  'auto-corpse': { group: 'Auto Corpse', category: 'Auto Corpse' },
  'sort-my-mess': { group: 'Sort My Mess', category: 'Sort My Mess' },
  'surface-effects': { group: 'Surface Effects', category: 'Surface Effects' },
});

/** AnimXL builds its effect cards from a table: one card key and, for effects with a value, one switch key each. */
function animXlEffects(source) {
  const table = source.slice(source.indexOf('const EFFECTS = ['), source.indexOf('];', source.indexOf('const EFFECTS = [')));
  return [...table.matchAll(/\{ id: '([^']+)', name: '([^']+)'[^\n]*/g)].flatMap(([row, id, name]) => [
    [`animxl:effect:${id}`, name],
    ...(/\bkey: '/.test(row) ? [[`animxl:effect-switch:${id}`, `${name} on / off`]] : []),
  ]);
}

export function buildManifest(root = repoRoot) {
  const entries = new Map();
  const add = (id, label) => {
    const window = MANUAL_WINDOWS[id.split(':')[0]];
    if (!window) throw new Error(`No window is listed for ${id}: add its first segment to MANUAL_WINDOWS.`);
    if (entries.has(id) && entries.get(id).label !== label) throw new Error(`${id} has two labels: ${entries.get(id).label} and ${label}.`);
    entries.set(id, { id, label, ...window });
  };
  const dir = path.join(root, 'app');
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.jsx')).sort()) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const match of source.matchAll(MARKER)) add(match[1], match[2] || source.slice(match.index, match.index + 300).match(/aria-label="([^"]+)"/)?.[1]);
    if (file === 'AnimXL.jsx') for (const [id, label] of animXlEffects(source)) add(id, label);
  }
  return [...entries.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export const manifestText = entries => '[\r\n' + entries.map(entry => '  ' + JSON.stringify(entry)).join(',\r\n') + '\r\n]\r\n';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = buildManifest();
  fs.writeFileSync(path.join(repoRoot, 'src/hotkey-manifest.json'), manifestText(entries));
  console.log(`${entries.length} bindable controls with no default key.`);
}
