import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMDL} from 'war3-model';
import {createNode, openDocument} from '../src/editor-document.js';
import {createStarterDocument} from '../src/starter-model.js';
import {assertModelEquivalent} from '../src/save-equivalence.js';
import {mdlMembers} from '../src/mdl-compatibility.js';

// Original in-memory fixtures. Patch independent MDX offsets so agreement
// between the writer and reader cannot conceal a lost integer or RGB value.
function chunk(bytes, tag) {
  for (let p = 4; p < bytes.length;) {
    const size = bytes.readUInt32LE(p + 4);
    if (bytes.toString('ascii', p, p + 4) === tag) return {start:p + 8, end:p + 8 + size};
    p += 8 + size;
  }
  throw new Error('Missing ' + tag);
}
function records(bytes, tag) {
  const section = chunk(bytes, tag), result = [];
  for (let p = section.start; p < section.end; p += bytes.readUInt32LE(p)) result.push(p);
  return result;
}
const triplet = (bytes, offset) => [0,4,8].map(n => bytes.readFloatLE(offset + n));
const vector = values => Float32Array.from(values);
function savedMdl(doc) {
  const before = structuredClone(doc.model), history = doc.historyStats;
  const text = Buffer.from(doc.serialize('mdl')).toString();
  assert.deepEqual(doc.model, before, 'saving leaves the live fields untouched');
  assert.deepEqual(doc.historyStats, history, 'saving leaves undo history untouched');
  const reopened = openDocument(text, 'saved.mdl');
  assert.equal(reopened.readOnly, false);
  return {text, reopened};
}
// Limit the dependency check to the standard owner syntax; the full document
// contains compatibility fields that the upstream parser does not implement.
function standardOwner(text, name) {
  const tree = mdlMembers(text);
  const blocks = tree.members.filter(m => m.name === name).map(m => tree.bytes.subarray(m.start, m.end).toString()).join('\n');
  return parseMDL(blocks.replace(/(\}[,\t ]*)\/\/ MDLXL_RAW_MDX_V1:[^\r\n]*/g, '$1'));
}
function filterFixture(value) {
  const doc = createStarterDocument();
  doc.apply('Five synthetic materials', ['Materials'], model => {
    model.Materials = Array.from({length:5}, () => structuredClone(model.Materials[0]));
  });
  const bytes = Buffer.from(doc.serialize('mdx'));
  const offset = records(bytes, 'MTLS')[4] + 20 + 4;
  bytes.writeUInt32LE(value, offset);
  return {doc:openDocument(bytes, 'filter.mdx'), offset, bytes};
}
for (const value of [44644536, 7, 0xffffffff]) test(`MDL retains raw layer FilterMode ${value} (N002 and uint32 boundaries)`, () => {
  const {doc, offset, bytes} = filterFixture(value);
  assert.equal(doc.model.Materials[4].Layers[0].FilterMode, value);
  assert.deepEqual(Buffer.from(doc.serialize('mdx')), bytes);
  const {text, reopened} = savedMdl(doc);
  assert.match(text, /FilterMode None,/);
  assert.ok(text.includes('// MDLXL_RAW_MDX_V1: FilterMode ' + value));
  assert.equal(standardOwner(text, 'Materials').Materials[4].Layers[0].FilterMode, 0, 'ordinary MDL parser reads the standard spelling');
  assert.equal(reopened.model.Materials[4].Layers[0].FilterMode, value);
  const back = Buffer.from(reopened.serialize('mdx'));
  assert.equal(back.readUInt32LE(records(back, 'MTLS')[4] + 20 + 4), value);
  reopened.apply('Edit layer alpha', ['Materials'], m => {m.Materials[4].Layers[0].Alpha = .5;});
  const edited = savedMdl(reopened).reopened;
  assert.equal(edited.model.Materials[4].Layers[0].FilterMode, value);
  assert.equal(edited.model.Materials[4].Layers[0].Alpha, .5);
  reopened.apply('Choose standard None', ['Materials'], m => {m.Materials[4].Layers[0].FilterMode = 0;});
  const reset = savedMdl(reopened);
  assert.equal(reset.reopened.model.Materials[4].Layers[0].FilterMode, 0);
  assert.ok(!reset.text.includes('MDLXL_RAW_MDX_V1: FilterMode'));
  const stripped = openDocument(text.replace(/(\}[,\t ]*)\/\/ MDLXL_RAW_MDX_V1:[^\r\n]*/g, '$1'), 'stripped.mdl');
  assert.throws(() => assertModelEquivalent(doc.model, stripped.model, {keys:['Materials'], format:'mdl'}), /Materials\[4\].Layers\[0\].FilterMode/);
});

test('standard FilterModes use their named MDL spelling and override a stale raw comment', () => {
  for (let mode = 0; mode <= 6; mode++) {
    const {doc} = filterFixture(mode), {text, reopened} = savedMdl(doc);
    assert.equal(reopened.model.Materials[4].Layers[0].FilterMode, mode);
    assert.ok(!text.includes('MDLXL_RAW_MDX_V1:'));
  }
  const {text} = savedMdl(filterFixture(44644536).doc);
  const edited = openDocument(text.replaceAll('FilterMode None,', 'FilterMode Blend,'), 'named-mode.mdl');
  assert.equal(edited.model.Materials[4].Layers[0].FilterMode, 2);
});

function flagsFixture(count, animated = false, flags = 26) {
  const doc = createStarterDocument();
  doc.apply('Synthetic GEOA records', ['Geosets','GeosetAnims','GlobalSequences'], model => {
    model.Geosets = Array.from({length:count}, () => structuredClone(model.Geosets[0]));
    model.GlobalSequences = animated ? [1000] : [];
    model.GeosetAnims = Array.from({length:count}, (_, GeosetId) => ({GeosetId, Alpha:1, Flags:2,
      Color:animated ? {LineType:1, GlobalSeqId:0, Keys:[{Frame:0, Vector:vector([1,1,1])}, {Frame:1000, Vector:vector([.25,.5,.75])}]} : vector([1,1,1])}));
  });
  const bytes = Buffer.from(doc.serialize('mdx'));
  for (const p of records(bytes, 'GEOA')) bytes.writeUInt32LE(flags, p + 8);
  return {doc:openDocument(bytes, 'flags.mdx'), bytes};
}
for (const [name, count, animated] of [['N007',11,false], ['N024',10,false], ['N037',10,false], ['N038',21,true], ['N060',8,false]]) {
  test(`${name}: every GeosetAnim.Flags retains 26 across MDL and MDX`, () => {
    const {doc, bytes} = flagsFixture(count, animated);
    assert.deepEqual(Buffer.from(doc.serialize('mdx')), bytes);
    const {text, reopened} = savedMdl(doc);
    assert.equal((text.match(/MDLXL_RAW_MDX_V1: Flags 24/g) || []).length, count);
    const ordinary = standardOwner(text, 'GeosetAnim');
    for (let i = 0; i < count; i++) {
      assert.equal(reopened.model.GeosetAnims[i].Flags, 26, `GeosetAnims[${i}].Flags`);
      assert.equal(ordinary.GeosetAnims[i].Flags & 1, 0, 'reserved bits never become DropShadow');
    }
    assertModelEquivalent(doc.model, reopened.model, {keys:['GeosetAnims'], format:'mdl'});
    const back = Buffer.from(reopened.serialize('mdx'));
    for (const p of records(back, 'GEOA')) assert.equal(back.readUInt32LE(p + 8), 26);
    reopened.apply('Edit GEOA alpha', ['GeosetAnims'], m => {m.GeosetAnims[0].Alpha = .5;});
    const edited = savedMdl(reopened).reopened;
    assert.equal(edited.model.GeosetAnims[0].Alpha, .5);
    assert.ok(edited.model.GeosetAnims.every(a => a.Flags === 26));
    const stripped = openDocument(text.replace(/(\}[,\t ]*)\/\/ MDLXL_RAW_MDX_V1:[^\r\n]*/g, '$1'), 'stripped.mdl');
    assert.throws(() => assertModelEquivalent(doc.model, stripped.model, {keys:['GeosetAnims'], format:'mdl'}), /GeosetAnims\[0\].Flags/);
  });
}

test('raw GEOA comments preserve high bits while DropShadow and tint remain editable', () => {
  for (const flags of [24, 25, 27, 0xffffffff]) {
    const {doc} = flagsFixture(1, false, flags), {text, reopened} = savedMdl(doc);
    assert.equal(reopened.model.GeosetAnims[0].Flags, flags | 0, 'use the existing signed bitset representation of the MDX reader');
    assert.equal(text.includes('DropShadow,'), !!(flags & 1));
    assert.equal(text.includes('static Color'), !!(flags & 2));
    const back = Buffer.from(reopened.serialize('mdx'));
    assert.equal(back.readUInt32LE(records(back, 'GEOA')[0] + 8), flags);
  }
  const {reopened} = savedMdl(flagsFixture(1).doc);
  reopened.apply('Enable shadow, disable tint', ['GeosetAnims'], m => {m.GeosetAnims[0].Flags = 25;});
  assert.equal(savedMdl(reopened).reopened.model.GeosetAnims[0].Flags, 25);
  reopened.apply('Clear reserved flags', ['GeosetAnims'], m => {m.GeosetAnims[0].Flags = 2;});
  const reset = savedMdl(reopened);
  assert.equal(reset.reopened.model.GeosetAnims[0].Flags, 2);
  assert.ok(!reset.text.includes('MDLXL_RAW_MDX_V1: Flags'));
});

test('raw MDX annotations are scoped to their owner and never read from strings or nested tracks', () => {
  const doc = flagsFixture(2, true).doc;
  doc.apply('Synthetic path', ['Textures'], m => {m.Textures[0].Image = '// MDLXL_RAW_MDX_V1: Flags 16';});
  const {text} = savedMdl(doc);
  const stripped = text.replace(/(\}[,\t ]*)\/\/ MDLXL_RAW_MDX_V1:[^\r\n]*/g, '$1');
  const nested = stripped.replace('Color 2 {', 'Color 2 {\n// MDLXL_RAW_MDX_V1: Flags 16\n');
  const reopened = openDocument(nested, 'scoped.mdl');
  assert.ok(reopened.model.GeosetAnims.every(a => a.Flags === 2));
  assert.equal(reopened.model.Textures[0].Image, '// MDLXL_RAW_MDX_V1: Flags 16');
});

test('N066: both white RibbonEmitter.Color vectors are explicit and retain independent MDX bytes', () => {
  const doc = createStarterDocument();
  doc.apply('Two synthetic ribbons', [], model => {
    for (let i = 0; i < 2; i++) {const ribbon = createNode(model, 'RibbonEmitter'); ribbon.Name = 'Ribbon ' + i; ribbon.Color = vector([1,1,1]);}
  });
  const bytes = Buffer.from(doc.serialize('mdx')), input = openDocument(bytes, 'white-ribbons.mdx');
  for (const p of records(bytes, 'RIBB')) assert.deepEqual(triplet(bytes, p + 4 + bytes.readUInt32LE(p + 4) + 12), [1,1,1]);
  const {text, reopened} = savedMdl(input);
  assert.equal((text.match(/static Color \{ 1, 1, 1 \}/g) || []).length, 2);
  for (let i = 0; i < 2; i++) assert.deepEqual([...reopened.model.RibbonEmitters[i].Color], [1,1,1], `RibbonEmitters[${i}].Color`);
  assertModelEquivalent(input.model, reopened.model, {keys:['RibbonEmitters'], format:'mdl'});
  const back = Buffer.from(reopened.serialize('mdx'));
  for (const p of records(back, 'RIBB')) assert.deepEqual(triplet(back, p + 4 + back.readUInt32LE(p + 4) + 12), [1,1,1]);
  reopened.apply('Edit ribbon alpha', ['RibbonEmitters'], m => {m.RibbonEmitters[0].Alpha = .5;});
  assert.deepEqual([...savedMdl(reopened).reopened.model.RibbonEmitters[1].Color], [1,1,1]);
  const stripped = openDocument(text.replace(/static Color \{ 1, 1, 1 \},/g, ''), 'stripped.mdl');
  assert.throws(() => assertModelEquivalent(input.model, stripped.model, {keys:['RibbonEmitters'], format:'mdl'}), /RibbonEmitters\[0\].Color/);
});