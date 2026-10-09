import test from 'node:test';
import assert from 'node:assert/strict';
import { getLanguage, loadLanguage, russian, setLanguage, translate } from '../src/localization.js';

test('English starts without catalogs and loading another language does not switch presentation', async () => {
  assert.equal(russian, undefined);
  assert.equal(getLanguage(), 'en');
  await loadLanguage('en'); await loadLanguage('invalid');
  assert.equal(russian, undefined);
  assert.equal(translate('Save'), 'Save');
  const first = loadLanguage('ru'), repeated = loadLanguage('ru');
  assert.equal(first, repeated, 'simultaneous requests share the same pack load');
  await Promise.all([first, loadLanguage('es'), loadLanguage('zh'), loadLanguage('mordor')]);
  assert.equal(getLanguage(), 'en');
  assert.equal(Object.isFrozen(russian), true);
  for (const [locale, expected] of [['ru', 'Сохранить'], ['es', 'Guardar'], ['zh', '保存']]) {
    setLanguage(locale);
    assert.equal(translate('Save'), expected);
    assert.equal(await loadLanguage(locale), await loadLanguage(locale));
  }
  setLanguage('en');
  assert.equal(translate('Save'), 'Save');
});
