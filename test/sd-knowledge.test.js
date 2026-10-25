import test from 'node:test';
import assert from 'node:assert/strict';
import * as know from '../src/sd-knowledge.js';

test('SD knowledge finds native paint by look, with the region inside its real UV island', () => {
  const iron = know.findMaterials('dark iron gold rim');
  assert.ok(iron.length >= 4);
  assert.ok(iron.some(r => /infernalcannon/i.test(r.sheet)), 'Infernal Cannon black iron and gold rims');
  for (const r of iron) {
    assert.ok(r.uv.every(v => v >= 0 && v <= 1) && r.uv[2] > r.uv[0] && r.uv[3] > r.uv[1]);
    assert.ok(r.tags.join(' ').match(/iron|metal|gold/i) || r.label.match(/iron|metal|gold/i));
  }
  // The owner's reuse is in it: the Graveguard shield front on the undead inventory cover.
  const shield = know.sheetInfo('UI\\Console\\Undead\\UndeadUITile-InventoryCover.blp');
  assert.ok(shield.regions.some(r => r.label === 'shield carved front panel' && r.model === 'Graveguard' && r.from === 'owner'));
  // Colour that comes from tint, not from the sheet, is kept with the region.
  const nurgle = know.findMaterials('green skull').find(r => r.tint);
  assert.ok(nurgle, 'a tinted green skull region');
  assert.ok(nurgle.tint.length === 3);
  assert.deepEqual(know.findMaterials(''), []);
});

test('SD knowledge shows how real parts are built and what a category measures', () => {
  const [blades] = know.findFamilies('sword blade');
  assert.ok(blades.members.some(m => m.model === 'Footman' && m.tris === 9), 'Footman blade, 9 triangles');
  assert.ok(know.findFamilies('chain').some(f => f.family === 'chain'));
  const unit = know.categoryNorms('unit');
  assert.ok(unit.count > 300 && unit.bodyTriangles.median > 300 && unit.bodyTriangles.median < 500);
  assert.equal(know.guessCategory('make a footman-style knight'), 'unit');
  assert.equal(know.guessCategory('make me a chalice worthy of mordor'), 'item');
  assert.equal(know.guessCategory('build an orc hut'), 'building');
  assert.equal(know.findFactions('a knight of nurgle')[0].id, 'lpw-warriors-of-chaos');
  assert.ok(know.findChapters('sword').some(c => c.id === 'families/weapons-sword-blades'));
  assert.match(know.chapter('findings'), /inventory panel can become a shield/);
  assert.throws(() => know.chapter('nope'), /Unknown chapter/);
});

test('SD knowledge writes a bounded evidence block for the art director', () => {
  const text = know.briefEvidence('make an orc axe');
  assert.ok(text.length > 1500 && text.length <= 9100, String(text.length));
  assert.match(text, /Axe and polearm heads/);
  assert.match(text, /Grunt/);
  assert.match(text, /Native paint/);
  assert.match(text, /Observed item population/);
  assert.match(know.briefEvidence('make a chaos knight of khorne'), /Chaos/);
  assert.ok(!/D:\/Codex|\.webp|\]\(/.test(know.briefEvidence('make a skull helmet')), 'no local paths or links');
});

test('SD knowledge compares a model with its category', () => {
  const model = {
    Geosets: [{ Faces: new Uint16Array(300 * 3), MaterialID: 0 }, { Faces: new Uint16Array(600), MaterialID: 0 }],
    GeosetAnims: [{ GeosetId: 1, Alpha: 0 }],
    Materials: [{ Layers: [{ TextureID: 0 }] }],
    Textures: [{ Image: 'Textures\\Footman.blp', ReplaceableId: 0 }],
  };
  const check = know.checkAgainstNorms(model, 'unit');
  assert.equal(check.triangles, 300);
  assert.equal(check.sheets, 1);
  assert.match(check.reading, /within the Blizzard p10–p90 range/);
  assert.throws(() => know.checkAgainstNorms(model, 'spaceship'), /No norms/);
});
