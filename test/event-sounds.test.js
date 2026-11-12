import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { tempDir } from './helpers/fixtures.cjs';
const require = createRequire(import.meta.url), {CascTextures, soundCandidates} = require('../electron/casc.cjs');
const {TextureResolver} = require('../electron/texture-resolver.cjs');

test('sound resolution uses exact identity, installed locale and base before HD', () => {
  const stem = 'units\\human\\hero\\warcry1', base = 'war3.w3mod:';
  const names = [`${base}_hd.w3mod:_locales\\enus.w3mod:${stem}.ogg`, `${base}_locales\\dede.w3mod:${stem}.ogg`, `${base}_locales\\enus.w3mod:${stem}.ogg`, `${base}${stem}other.ogg`];
  assert.deepEqual(soundCandidates(`${base}${stem}.flac`, names, ['enus']), [names[2], names[0]]);
  assert.deepEqual(soundCandidates(`${base}_hd.w3mod:${stem}.flac`, names, ['enus']), [names[0]]);
  assert.deepEqual(soundCandidates(`${base}${stem}.flac`, names, ['dede']), [names[1]]);
});

test('cached missing filename does not block indexed CKey audio; restart reuses index', async () => {
  const dir = tempDir('mdlxl-sound-'), folder = path.join(dir, 'game'), cacheDirectory = path.join(dir, 'cache');
  const {mkdir} = await import('node:fs/promises'); await mkdir(folder); await writeFile(path.join(folder, '.build.info'), 'enUS speech?');
  const requested = 'war3.w3mod:units\\human\\hero\\warcry1.flac', sourceName = 'war3.w3mod:_locales\\enus.w3mod:units\\human\\hero\\warcry1.ogg', key = 'ab'.repeat(16), bytes = Buffer.from('OggS data');
  let listed = 0, reads = 0;
  const openReader = () => ({read:async name => { reads++; return name === '@ckey:' + key ? bytes : null; }, list:async kind => { assert.equal(kind, 'sounds'); listed++; return {names:[sourceName], keys:{[sourceName]:key}}; }, close(){}});
  try {
    for (let i = 0; i < 2; i++) {
      const casc = new CascTextures({cacheDirectory, openReader});
      assert.deepEqual(await casc.readSound(requested, [folder]), {bytes, sourceName}); await casc.close();
    }
    assert.equal(listed, 1); assert.equal(reads, 2);
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('event resource IPC preserves requested name and actual sound format', async () => {
  const bytes = Buffer.from('OggS'), name = 'war3.w3mod:units\\hero.flac';
  const resolver = new TextureResolver({casc:{readSound:async () => ({bytes,sourceName:'war3.w3mod:_locales\\enus.w3mod:units\\hero.ogg'})}});
  assert.deepEqual(await resolver.resolve([name], {cascFolders:['game']}, ['flac']), [{name,bytes,sourceName:'war3.w3mod:_locales\\enus.w3mod:units\\hero.ogg'}]);
});

test('sound table rows whose file moved folder or is numbered still find the game file', () => {
  const {soundFallbacks} = require('../electron/casc.cjs'), base = 'war3.w3mod:';
  const names = [`${base}buildings\\nightelf\\ancientoflore\\ancientoftheearthattack1.ogg`, `${base}_de.w3mod:abilities\\spells\\human\\blizzard\\blizzardtarget2.ogg`, `${base}_de.w3mod:abilities\\spells\\human\\blizzard\\blizzardtarget1.ogg`, `${base}a\\shared.ogg`, `${base}b\\shared.ogg`, `${base}units\\x\\warcry12.ogg`];
  assert.deepEqual(soundFallbacks(`${base}Buildings/NightElf/AncientOfTheEarth/AncientOfTheEarthAttack1.flac`, names, ['enus']), [names[0]]);
  assert.deepEqual(soundFallbacks(`${base}Abilities/Spells/Human/Blizzard/BlizzardTarget.flac`, names, ['enus']), [names[2], names[1]]);
  assert.deepEqual(soundFallbacks(`${base}c/Shared.flac`, names, ['enus']), [], 'two folders: no guess');
  assert.deepEqual(soundFallbacks(`${base}Units/X/Warcry1.flac`, names, ['enus']), [], 'a numbered name is not extended');
  assert.deepEqual(soundFallbacks(`${base}Units/Undead/FrostWyrm/FrostwyrmDeath.flac`, names, ['enus']), []);
});

test('missing sounds are reported from the game listing and moved files play', async () => {
  const dir = tempDir('mdlxl-sound-missing-'), folder = path.join(dir, 'game');
  const {mkdir} = await import('node:fs/promises'); await mkdir(folder); await writeFile(path.join(folder, '.build.info'), 'enUS speech?');
  const moved = 'war3.w3mod:buildings\\nightelf\\ancientoflore\\ancientoftheearthattack1.ogg', key = 'cd'.repeat(16), bytes = Buffer.from('OggS moved');
  const openReader = () => ({read:async name => name === '@ckey:' + key ? bytes : null, list:async () => ({names:[moved], keys:{[moved]:key}}), close(){}});
  const casc = new CascTextures({cacheDirectory:path.join(dir, 'cache'), openReader});
  const wanted = 'war3.w3mod:Buildings/NightElf/AncientOfTheEarth/AncientOfTheEarthAttack1.flac', gone = 'war3.w3mod:Units/Undead/FrostWyrm/FrostwyrmDeath.flac';
  try {
    assert.deepEqual(await casc.missingSounds([wanted, gone], [folder]), [gone]);
    assert.deepEqual(await casc.readSound(wanted, [folder]), {bytes, sourceName:moved});
    assert.deepEqual(await casc.missingSounds([gone], []), [], 'no installation: nothing is marked');
    await casc.close();
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('sound rows with no game file are marked missing', async () => {
  const {markMissingSounds} = await import('../app/node-event-data.js');
  const catalog = {SND:[{id:'DFRW', files:['gone.flac']}, {id:'KAOE', files:['moved.flac']}, {id:'TWO', files:['gone.flac', 'moved.flac']}]};
  await markMissingSounds(catalog, async ({names}) => names.filter(name => name === 'gone.flac'), 'model.mdx');
  assert.deepEqual(catalog.SND.map(row => !!row.missing), [true, false, false]);
  const failing = {SND:[{id:'DFRW', files:['gone.flac']}]};
  await markMissingSounds(failing, async () => { throw Error('offline'); });
  assert.equal(failing.SND[0].missing, undefined);
});
