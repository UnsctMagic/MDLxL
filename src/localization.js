// Load a non-English pack before rendering or switching to that language.
// English startup does not import or construct any translation catalogs.
const loaders = {
  ru: () => import('./locales/ru.js'),
  es: () => import('./locales/es.js'),
  zh: () => import('./locales/zh.js'),
  mordor: () => import('./locales/mordor.js'),
};
const dictionaries = {}, loading = new Map();
export let russian;
let blackSpeechCipher;
export const LANGUAGES = Object.freeze([
  Object.freeze({ id: 'en', label: 'English', nativeLabel: 'English' }),
  Object.freeze({ id: 'ru', label: 'Russian', nativeLabel: 'Русский' }),
  Object.freeze({ id: 'es', label: 'Spanish', nativeLabel: 'Español' }),
  Object.freeze({ id: 'zh', label: 'Chinese', nativeLabel: '中文' }),
  Object.freeze({ id: 'mordor', label: 'The Language of Mordor', nativeLabel: 'The Language of Mordor' }),
]);
let language = 'en';
export function isLanguage(value) { return LANGUAGES.some(item => item.id === value); }
export function loadLanguage(value) {
  const locale = isLanguage(value) ? value : 'en';
  if (locale === 'en') return Promise.resolve();
  if (!loading.has(locale)) loading.set(locale, loaders[locale]().then(module => {
    dictionaries[locale] = module.default;
    if (locale === 'ru') russian = module.default;
    if (locale === 'mordor') blackSpeechCipher = module.blackSpeechCipher;
    return module.default;
  }).catch(error => { loading.delete(locale); throw error; }));
  return loading.get(locale);
}
export function setLanguage(value) { language = isLanguage(value) ? value : 'en'; }
export function getLanguage() { return language; }
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patternCache = new Map();
function patternsFor(locale) {
  if (patternCache.has(locale)) return patternCache.get(locale);
  const patterns = Object.entries(dictionaries[locale] || {}).filter(([key]) => /\{\d+\}/.test(key)).map(([key,value]) => {
  const parts=key.split(/(\{\d+\})/), ids=[];
  const source=parts.map(part=>/^\{\d+\}$/.test(part)?(ids.push(part),'(.*?)'):escape(part)).join('');
  return { regex:new RegExp('^'+source+'$'), value, ids, weight:key.replace(/\{\d+\}/g,'').length };
  }).filter(p=>p.weight>2).sort((a,b)=>b.weight-a.weight);
  patternCache.set(locale, patterns); return patterns;
}

/** Translate presentation text only; model fields and file bytes never pass here. */
export function translate(text, locale = language, depth = 0) {
  if (locale === 'en' || !dictionaries[locale] || typeof text !== 'string' || !/[a-z]/i.test(text)) return text;
  const trimmed=text.trim(), before=text.slice(0,text.indexOf(trimmed)), after=text.slice(text.indexOf(trimmed)+trimmed.length);
  let translated=dictionaries[locale][trimmed];
  // A complete reviewed label beats a generic template such as "Material {0}".
  // Keep the community Chinese lookup behavior exactly as supplied.
  if (translated === undefined && (locale === 'ru' || locale === 'es')) {
    const decorated = /^(.*?)(:|…|\.\.\.)$/.exec(trimmed);
    const label = decorated && dictionaries[locale][decorated[1]];
    if (label !== undefined && label !== null) translated = label + decorated[2];
  }
  if(translated===undefined && depth<3) for(const pattern of patternsFor(locale)){
    const match=pattern.regex.exec(trimmed);if(!match)continue;
    translated=pattern.value.replace(/\{\d+\}/g,id=>{const index=pattern.ids.indexOf(id);return index<0?id:translate(match[index+1],locale,depth+1);});break;
  }
  // Labels commonly carry a trailing colon, ellipsis, or a native menu mnemonic.
  if(translated===undefined && depth<3){
    if(trimmed.startsWith('&')) translated=translate(trimmed.slice(1),locale,depth+1);
    else { const match=/^(.*?)(:|…|\.\.\.)$/.exec(trimmed);if(match){const value=translate(match[1],locale,depth+1);if(value!==match[1])translated=value+match[2];} }
  }
  if (translated === undefined && locale === 'mordor') translated = blackSpeechCipher(trimmed);
  return translated===undefined?text:before+translated+after;
}
