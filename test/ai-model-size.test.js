import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { mdxChunks, mdxSizeBreakdown, textureUses } from '../src/ai-model-size.js';
import { textureInfo, texturePixels } from '../src/texture-pixels.js';
import { thumbnailPixels } from '../src/texture-thumbnail.js';
import { aiAssets } from '../app/ai-assets.js';
import { AI_TOOLS } from '../src/ai-tools.js';
import { validateArguments } from '../electron/ai-mcp.cjs';

const { fixturePath, testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const footmanFile = fixturePath('footman'), textureFile = testModel('pose/Textures/Footman.blp');
const missing = (...files) => files.some(file => !file || !fs.existsSync(file)) && 'test model not on this machine';
const footman = () => openDocument(fs.readFileSync(footmanFile), 'Footman.mdx');

test('size breakdown: chunk groups add up to the saved bytes; geosets and tracks are named', { skip: missing(footmanFile) }, () => {
  const doc = footman(), bytes = doc.serialize('mdx'), size = mdxSizeBreakdown(bytes, doc.model);
  assert.equal(size.total, bytes.byteLength);
  assert.equal(Object.values(size.groups).reduce((a, b) => a + b, 4), bytes.byteLength, 'groups plus the 4-byte MDLX magic');
  assert.ok(size.groups.geosets > size.groups.texturePaths && size.groups.nodes > 0);
  assert.equal(size.biggestGeosets[0].geoset, 0, 'the body geoset is the biggest');
  assert.equal(size.biggestGeosets[0].vertices, doc.model.Geosets[0].Vertices.length / 3);
  const geos = mdxChunks(bytes).find(c => c.tag === 'GEOS');
  assert.equal(size.biggestGeosets.reduce((n, g) => n + g.bytes, 0), geos.bytes - 8, 'every geoset counted (5 geosets)');
  assert.ok(size.tracks.bytes > 0 && size.tracks.biggest.length === 5);
  // A doubled body geoset adds about its own bytes to the geosets group, nothing to the others.
  doc.apply('Copy body', ['Geosets'], () => doc.model.Geosets.push(structuredClone(doc.model.Geosets[0])));
  const bigger = mdxSizeBreakdown(doc.serialize('mdx'), doc.model);
  assert.equal(bigger.groups.geosets - size.groups.geosets, size.biggestGeosets[0].bytes);
  assert.equal(bigger.groups.nodes, size.groups.nodes);
});

test('texture inventory: file format, size and bytes, what uses each texture, and the total', { skip: missing(footmanFile, textureFile) }, async () => {
  const doc = footman(), blp = fs.readFileSync(textureFile);
  const info = textureInfo(blp, 'Footman.blp');
  assert.deepEqual([info.format, info.width, info.height, info.bytes], ['DDS DXT5', 256, 256, blp.byteLength], 'this Footman.blp holds DDS data; the header decides');
  assert.ok(info.mipmaps >= 1);
  const uses = textureUses(doc.model);
  assert.deepEqual(uses[0].geosets.slice().sort(), doc.model.Geosets.flatMap((g, i) => uses[0].materials.includes(g.MaterialID) ? [i] : []).sort());
  const resolveTextures = async ({ names }) => names.filter(n => /footman\.blp$/i.test(n)).map(name => ({ name, bytes: new Uint8Array(blp) }));
  const host = { state: () => ({ model: doc.model, session: { path: footmanFile, assets: new Map() } }) };
  const result = await aiAssets({ source: 'model', action: 'search' }, host, () => {}, { resolveTextures });
  const body = result.items.find(t => /footman\.blp$/i.test(t.Image));
  assert.equal(body.file.width, 256); assert.equal(body.file.bytes, blp.byteLength);
  assert.ok(body.usedBy.triangles > 300 && body.usedBy.geosets.includes(0));
  assert.ok(result.items.some(t => t.file.replaceable === 1), 'team colour is a replaceable texture');
  assert.equal(result.textureBytes.total, blp.byteLength);
  assert.equal(result.textureBytes.missing, doc.model.Textures.filter(t => t.Image && !/footman\.blp$/i.test(t.Image)).length);
});

test('pixels: a grid and stats of the real texture, and find locates a mark painted at a known UV', { skip: missing(textureFile) }, async () => {
  const image = thumbnailPixels({ name: 'Footman.blp', bytes: fs.readFileSync(textureFile) });
  const whole = texturePixels(image);
  assert.equal(whole.grid.columns, 16); assert.equal(whole.grid.colors.length, 16);
  assert.ok(whole.grid.colors.every(row => row.split(' ').length === 16 && row.split(' ').every(c => /^#[0-9a-f]{6}$/.test(c))));
  assert.ok(whole.stats.main.length > 0 && whole.stats.main[0].share > 0);
  const absent = texturePixels(image, { find: { color: '#ff00ff', tolerance: 10 } });
  assert.equal(absent.found.regions.length, 0, 'no magenta in the Footman texture');
  // Paint a 6x4 magenta mark at pixels 200..206, 40..44 and find it again.
  const marked = { width: image.width, height: image.height, data: Uint8ClampedArray.from(image.data) };
  for (let y = 40; y < 44; y++) for (let x = 200; x < 206; x++) marked.data.set([255, 0, 255, 255], (y * marked.width + x) * 4);
  const found = texturePixels(marked, { find: { color: '#ff00ff', tolerance: 10 } }).found;
  assert.equal(found.regions.length, 1);
  assert.deepEqual(found.regions[0].pixels, [200, 40, 206, 44]);
  assert.deepEqual(found.regions[0].uv, [200 / 256, 40 / 256, 206 / 256, 44 / 256].map(v => Number(v.toFixed(4))));
  const zoomed = texturePixels(marked, { region: [190, 35, 214, 51], units: 'pixels', grid: 8 });
  assert.equal(zoomed.grid.columns, 8); assert.ok(zoomed.grid.colors.join(' ').includes('#ff00ff'));
  // Through the assets tool by model texture id.
  const doc = openDocument(fs.readFileSync(fixturePath('footman')), 'Footman.mdx'), id = doc.model.Textures.findIndex(t => /footman\.blp$/i.test(t.Image || ''));
  const host = { state: () => ({ model: doc.model, session: { path: null, assets: new Map() } }) };
  const viaTool = await aiAssets({ source: 'model', action: 'pixels', textureId: id, region: [0, 0, .5, .5], grid: 4 }, host, () => {},
    { resolveTextures: async ({ names }) => [{ name: names[0], bytes: new Uint8Array(fs.readFileSync(textureFile)) }] });
  assert.equal(viaTool.file.format, 'DDS DXT5'); assert.deepEqual(viaTool.region.pixels, [0, 0, 128, 128]); assert.equal(viaTool.grid.rows, 4);
  const schema = AI_TOOLS.find(t => t.name === 'mdlxl_assets').inputSchema;
  validateArguments(schema, { target: 't', source: 'model', action: 'pixels', textureId: 0, region: [0, 0, 1, 1], units: 'uv', grid: 64, find: { color: '#ff0000', tolerance: 30 } });
  assert.throws(() => validateArguments(schema, { target: 't', source: 'model', action: 'pixels', grid: 65 }), /out of range/);
});
