const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseMDX } = require('war3-model');
const { CascTextures } = require('../electron/casc.cjs');
const { TextureResolver } = require('../electron/texture-resolver.cjs');
const { gameFolder, tempDir } = require('./helpers/fixtures.cjs');

// The diagnosed groups for the installed Warcraft III SpawnData table.
const particleIds = 'HBL0 HBF0 HBK0 HBM0 HBP0 HBPR HBR0 HBSR OBHE OBHS OBFS OBWD OBWR OBT0 UBAB DBCR NBAR NBDT NBDR NBDB NBDA NBKG HBBM HBSB NBMF DBBM IFPW HBCE OBCE'.split(' ');
const zeroIds = 'HBNE OBTC OBKB OBWY OBG0 OBP0 UBGA UBGH UBAC NBDC NBHU NBDH NBCH NBHG DBPT OBBT OBSH CBAL NBWS'.split(' ');
const modernIds = 'UEGG GCBL UDIS EENT DNAM DNAS DUME DUSM INFR INFL INFU DNBL CLID HFSS DBPB PEFI DNBD FTSO TOBO IFP0 IFP1 FRBS PBSX GDCR'.split(' ');
const lookupIds = 'EDIS DDIS ODIS HDIS OBWV OKBP INIT TEST'.split(' ');
// Found through the app's resolver but refused by the event decoder (measured 15 Nov 2026), so the picker omits them.
const hdIds = 'UBSC UBCC CHMA CHMB TYCA MFCA MDII USDM'.split(' ');
const noEffectIds = 'HBS0 HBS1 HBL1 NBVW NBMP'.split(' ');
const emptyIds = 'HBDH NBFD NBWD NBMG OBSW UBCL UBOB DBDR DBSW DBPL'.split(' ');

let cache, resolver, table, assetByPath, parseEffect, definition, toKey;
test.before(async () => {
  const folder = await gameFolder();
  cache = tempDir('spawn-game-');
  resolver = new TextureResolver({ casc: new CascTextures({ cacheDirectory: cache }) });
  const resolve = names => resolver.resolve(names, { cascFolders: [folder] }, ['slk', 'mdx', 'mdl']);
  const { EVENT_TABLE_PATHS, parseSlk, resolveEventDefinition } = await import('../app/event-preview-data.js');
  const { gamePathKey } = await import('../src/game-path.js');
  toKey = gamePathKey;
  const source = process.env.MDLXL_SPAWN_DECODER_SOURCE;
  const decoder = source ? await import(pathToFileURL(path.resolve(source)).href) : await import('../app/event-render-model.js');
  parseEffect = decoder.parseEventRenderModel;
  const [record] = await resolve([EVENT_TABLE_PATHS.SPN]);
  assert.ok(record?.bytes?.length, 'The configured game must contain SpawnData.slk');
  table = parseSlk(new TextDecoder().decode(record.bytes));
  definition = id => resolveEventDefinition('SPNx' + id, { SPN: table });
  const names = [...table.keys()].flatMap(id => {
    const row = definition(id);
    return row ? [row.resourcePath] : [];
  });
  assetByPath = new Map((await resolve(names)).map(asset => [toKey(asset.name), asset]));
});

test.after(async () => {
  try { await resolver?.close(); }
  finally { if (cache) await fs.rm(cache, { recursive: true, force: true }); }
});

function assetFor(id) {
  const row = definition(id);
  return row && assetByPath.get(toKey(row.resourcePath));
}

function decode(id) {
  const asset = assetFor(id);
  assert.ok(asset?.bytes?.length, id + ' must resolve through the game resource resolver');
  const original = Buffer.from(asset.bytes);
  let model;
  try { model = parseEffect(asset.bytes, asset.name); }
  catch (error) { throw new Error(id + ' (' + asset.name + '): ' + error.message); }
  assert.deepEqual(Buffer.from(asset.bytes), original, id + ' must keep the original asset bytes');
  return model;
}

test('UBGH previews its original particles with a zero-length global sequence', () => {
  const model = decode('UBGH');
  assert.equal(model.Version, 1800);
  assert.ok(model.GlobalSequences.includes(0));
  assert.ok(model.ParticleEmitters2.length);
});

test('UEGG previews format-1800 geometry and materials through the editor decoder', () => {
  const model = decode('UEGG');
  assert.equal(model.Version, 1800);
  assert.ok(model.Geosets.some(geoset => geoset.Faces.length));
  assert.ok(model.Materials.length);
});

test('every SpawnData row is classified and the 29 existing particle models are identical', async () => {
  const { convertMdxGeosetColorTracks } = await import('../src/geoset-color-codec.js');
  const groups = new Map([
    ...particleIds.map(id => [id, 'particle']), ...zeroIds.map(id => [id, 'zero']),
    ...modernIds.map(id => [id, 'modern']), ...lookupIds.map(id => [id, 'lookup']),
    ...emptyIds.map(id => [id, 'empty']), ...hdIds.map(id => [id, 'hd']), ...noEffectIds.map(id => [id, 'noEffects']),
  ]);
  // The shipped table spells OBKB with a trailing space; event names and the picker use the four characters.
  assert.deepEqual([...table.keys()].map(id => id.trim()).sort(), [...groups.keys()].sort(), 'Every installed row must have an expected group');
  const counts = {};
  for (const [id, group] of groups) {
    if (group === 'empty') assert.equal(definition(id), null, id);
    else if (group === 'hd') assert.throws(() => decode(id), /HD models aren't supported yet/, id);
    else if (group === 'noEffects') assert.throws(() => decode(id), /no effects the preview can display/, id);
    else if (group === 'lookup') {
      if (id === 'INIT' || id === 'TEST') assert.equal(assetFor(id), undefined, id);
      else if (assetFor(id)) decode(id);
    } else {
      const model = decode(id);
      if (group === 'particle') {
        const { bytes } = assetFor(id);
        const before = parseMDX(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        before.GeosetAnims = convertMdxGeosetColorTracks(before.GeosetAnims);
        assert.deepEqual(model, before, id + ' must retain the existing particle render model');
      } else if (group === 'zero') {
        assert.ok(model.GlobalSequences.includes(0) && model.ParticleEmitters2.length, id);
      } else {
        assert.equal(model.Version, 1800, id);
        assert.ok(model.Geosets.length || model.ParticleEmitters2.length || model.RibbonEmitters.length, id);
      }
    }
    counts[group] = (counts[group] || 0) + 1;
  }
  console.log('SpawnData rows:', counts);
});
