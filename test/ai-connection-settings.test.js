import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const providers = JSON.parse(readFileSync(new URL('../src/ai-providers.json', import.meta.url)));
const noop = () => {};
const cases = providers.flatMap(({ id }) => [0, 1, 2, 3].map(state => ({
  name: id + ' / ' + state,
  props: {
    settings: { provider: id, model: state ? 'chosen' : '', hasKey: state > 0,
      lighterModels: state ? [{ id: 'light', name: 'Light' }] : [], allowLighter: state === 2,
      baseUrl: state ? 'http://localhost:1234/v1' : '', effort: state === 2 ? 'xhigh' : '',
      spendLimit: state ? '12' : '', stepLimit: state ? '25' : '', cleanupDays: state ? '7' : '',
      executable: state ? 'provider.exe' : '', outsideCheck: state !== 2, routing: state === 2 ? 'automatic' : 'manual' },
    providers, models: [{ id: 'chosen', name: 'Chosen' }], authBusy: state === 3, anyBusy: state === 2,
    signedIn: state === 1 ? true : state === 2 ? false : null, apiKey: state ? 'draft-key' : '',
    setSettings: noop, saveSettings: noop, authenticate: noop, loadModels: noop,
    setApiKey: noop, changeProvider: noop, action: noop, setStatus: noop,
  },
})));
async function loadComponent(file) {
  const result = await build({ entryPoints: [file], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports.default;
}
const markup = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const digest = html => createHash('sha256').update(html).digest('hex');

// Static markup of the inline form: 879b6c8d before WP-3.8, updated for the
// Model dropdown (PR #461) and for the longer provider list (Claude first, more
// providers, 19 Nov 2026). Each hash covers every rendered byte, including
// labels, classes and hotkeys.
const before = [
  "6343f6a2fb2a6039a4cdc269a15e8198b2c20c55a5d62e2fa37ecf20a2baf4c5",
  "c496bbd101c818ddb7129be9e2fa0172a556dec9d1ff1f265758ebebf777deec",
  "40f889f06290388389f311bf4c45284efe10b6905a6c90a20f8f60393b6acc9b",
  "39e314a94af885907b0b824f225bacd8b4415a3f2a615185232497d0ae8b1d3b",
  "8c04b15715df189bae8c3c2380aa728ad38d3e80134f385a29161d8ffe6ace2a",
  "31142a8b13bd10ccaae7053fbe4074a6f7041faa850ef022689d1640e0dd85c9",
  "9d4742a20ecd346cb4923a0d1e7550a212a07a9dbb55dcc146ff1c3c821d4408",
  "df1abcc4d45c7300ab9517cbaedbacc804076f858bc19adae9fd3d80c5e8587a",
  "1758e365f45b2e6510c2e07e01381a23ebfcfe0425e46a11806ab83571779c9a",
  "0e4832b706d200750a7b092e0381c9642b3f2ad9bcda98cbc4f929cd4282f23d",
  "2d3bd79a6a59a899513e4b8d0e292367fd35f7337788236687c990d5be97fcb2",
  "a7fbf1f8be2afaedeedf2141b0aa5d02a605a0e6b14743c7c6c698e2c67cfa46",
  "45cb243ec509aae89201d2adc8fb88d910bc23fcf8eaef7a6549eff60a0052c3",
  "61a461463f7073127ba9b10490ae5467a9a8f9992a76b4353643d87ca87b3236",
  "3fdb55076fe40adcb184852a079a24d6ef3fe47d53b42d839c27daafb3292275",
  "7a7ca0208eafd0853b128eb52b68182efc5b7872faebe25302903b168d0b6436",
  "6650957c0115264cf760091ecd8d2c16e6b5d6a4859c5dc67a684fef8c240b05",
  "6b8e8a178883cd22fda0b1739e00221bd872db44d17a5a39418b55550b664b90",
  "a6192afb19ecf7ddab348a515a0f22db19c047ca7a28cfa9a83a3c0f068d8b78",
  "9fd9c4f3f632646ce59ffe0a5d66243b04684af14b637b8573ad3a29db2d3c89",
  "84e9b16b8ee5622b010c8336fcdeb035bbe8ee8308915bcde62ebefa470f15d3",
  "a1019320d12f9017f2ae4a1fbc943c986d8bcd9036df16b93caaa6dfa0d5c8d5",
  "d214440910417593d48c27c3f4c69ddb248a0e0dd903c9236b5470af7dd2a430",
  "2de37a9e83391959920bbd499fa73cde66dcc8c0f99b156928d51c039c890516",
  "6998bbe996ead702dcabe45d2b2ea42b00f46852618b5d56e71ca4677a301a2f",
  "38455d97f5cfd0b8013d2deeb8b7756b4b0fd66de2cd68edfe535d7f39f8978a",
  "acff85acd8e5c6b567536c4c65e16610ea88f4bf3c97b9cbf3ef52e67dfe1613",
  "382dea3b09824d62a2bc1b48cfbd740c78c4a6eac84706c1bce4dc5149adcb3c",
  "fd570bbca43a272ac83e10654479a4a55e966b2627e25e78d56fd025537ce1e9",
  "f089f7d5740ebc7130082b52275f478647862988a8468182a96f19a18e60ba9f",
  "04c85259b34892b7de5498e94c1a2a1c96a93e319bca28cc2d95b17f9fbf46d3",
  "0e8dbcfbd98568ce52e801e0cb2950125e08e24b203665c8e1e59fabeb3a9aaf",
  "6993f415139d4954a02934a7d6c4da070bc5042816bb01753759d919721b7c11",
  "b900208dce1a0530cd0318a993c167402130650ee64e6ca02643dfb39b8365f3",
  "c26c149bafd734309f60c2772eb810322d87848261a67665c8deb53ea31ce81b",
  "196d0c39af24f702e8449fce87171028717400605ca18f2f4eda75a10cc79e4a",
  "c41281c08cd654d5581afc7cde6bd52d68d5c19ccfe380b46329b58ea236bf48",
  "7bc35f54d05d0d05d3e505ed5c72bfa24102b1915ae4ca4b7ddba6e497f51da4",
  "3cb3a4416a4d4af8931f8b84fd91e8fac0f00c9beee1826326828c52bc47f332",
  "3ca25d9b850777d12f03aec33557931267c93195b2de73c1932eeae62580a7ce",
  "29c1c968d630b3d22f801211a4e34e645e840739db8eeb027b67e39f446eb9f6",
  "0c62f0737477d69a27f7c301f49c5d8843929015d1fe4a8f082c8ac5fcd385c6",
  "106457d1998f235554200ea06a97bb05c182e5b127523e74c1c540bc27ea065f",
  "b470c4d87496494813a60721476f25b3fe277a02b05d992aadecff4663c6634a",
  "ddde6a7455aecc435c9a2fd769e9acdaecb2df43c336f11605a1929834c5a2e6",
  "39b7d3eae0a3cd5dcfea5c18838c5c284f4bdba9b77630bc4b0366b91bded5c7",
  "6e6f3e2ba11f989c73a01769e1237dfd93e6ec66d0ef6d9fbb297e14fe7be22f",
  "c84a05133d723318d02407d37f5368bbf5134fb3864de27bc42efbc62bbcb438",
  "a44e1de7879835630b4caa3ca98d142d0944477ef024e67d1f96bfdc4d80a63f",
  "e9367e9bdd737872568813a3af12a3d1fff4f685effcbd5534bee9ca72c14e3c",
  "3af89dbcc2b0262dd9ebecd620b6f05f942222b987ff893bce65fce88eb0acf3",
  "54f6d1960ccb229e6e3df493d5943b45888c92af98cfa2f01d32075f2a8b470b",
  "5b5d993e50cad18268e8b3df1d6993f77504befcb6db015dc73de6c91861c614",
  "42005aece284fd6e1eaecf1242c53168b89bf6b0c483d4215bb758b7c152b107",
  "76f1723947e955a850047aeaef6833ce22982835b36976c07ecefea8a32112bc",
  "e92b9bdbfbeae7c904b9d6953be4909e365ed49e373ba8fc3c15714adbd18757",
  "d53736ccd333cd20e5b68041efb00b839eca9205c78400a01e69bea0cdbff3b6",
  "a3a3fae8e91ddbc9de6f47669ae38a3c40845dd71661cd0812582b5c436ee41e",
  "84058e8d8e40e39a05178e575562cc96c2934ff35991aeb09f56d144d70458d3",
  "919142c954d234eedde4723cc6ca368fe0d464d53068bc189540dc146905d05f",
  "ea3cc0446f0aa2ce1d9cad3910a270cd4e485e9c16c2bee2983b094d4775a004",
  "7c98045e7ed255fb62c92eed5c104092bd16b8cff8ffbc29d553b76f6c12467e",
  "4ae4f1f52582f81a501ef1383d1c1a0564a483ce95fc5d8def87ae26e2a8730e",
  "06394581508938af833a2b77be65ecf7ed707865c95438ba398dfa4581718fd4",
  "f9a5a653e899975815886d8adccd64e6e7596ea0f34d15f41c6346877e9c017e",
  "0a5e55bc76dfa7da792e06ea7b83c1130191d3aa7ab0dc02a8f52a7d7bcf8016",
  "861877441f8b106c22062bfc3869d17d174ae17dcbad259327537f6c4c85fcb1",
  "c6bf3d19f670ef5509cd7d6f68f160d2bc56aad1cac856ce912d1ae989bbf186"
];
const Component = await loadComponent(fileURLToPath(new URL('../app/AiConnectionSettings.jsx', import.meta.url)));
for (const [index, { name, props }] of cases.entries()) {
  test('connection settings remove only delegation controls: ' + name, () => {
    const html = markup(Component, props);
    assert.doesNotMatch(html, /Job routing|Lighter model|Allow lighter/);
    assert.equal(digest(html), before[index]);
  });
}
