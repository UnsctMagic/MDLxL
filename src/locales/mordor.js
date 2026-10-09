import russian from './ru.js';
import reviewedSpanish from './es-reviewed.json' with { type: 'json' };
import { mordor } from './short-ui-locales.js';
import { broadMordor } from './broad-ui-locales.js';

// Tolkien published only a small Black Speech corpus. Mordor mode is therefore
// deliberately a non-semantic Black Speech cipher for interface prose.
const words = Object.freeze(['ash', 'nazg', 'durb', 'atulûk', 'gimb', 'krimp', 'burzum', 'ishi', 'agh', 'ghâsh', 'snaga', 'uruk', 'lugbúrz', 'nazgûl']);
const literals = new Set(['MDLxL','MDLVis','MdlVis','Warcraft','III','RGB','UV','XYZ','XYZW','XY','XZ','ZX','YZ','DPI','MDL','MDX','BLP','DDS','DXT','PNG','JPG','JPEG','GIF','WebP','BMP','CASC','MPQ','JSON','API','UTF','Ctrl','Alt','Shift','Win','Enter','Escape','Delete','Backspace','Tab','Space','Page','Up','Down','Home','End','MB','MiB','KB','KiB','ID','IDs','GPU','FPS','ms','px']);
export function blackSpeechCipher(text) {
  if (/^[A-Za-z]:[\\/]/.test(text)) return text;
  return text.replace(/(?:[\w.-]+[\\/])+[\w.-]+|\b[\w-]+\.(?:mdl|mdx|blp|dds|png|jpe?g|gif|webp|bmp|json|zip|txt|wav|mp3|w3x|w3m)\b|[A-Za-z]{2,}/gi, word => {
    if (/[\\/.]/.test(word) || literals.has(word)) return word;
    let hash = 0;
    for (const letter of word.toLowerCase()) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
    return words[hash % words.length];
  });
}
const keys = { ...russian, ...reviewedSpanish, ...mordor, ...broadMordor };
export default Object.freeze({ ...Object.fromEntries(Object.keys(keys).map(key => [key, blackSpeechCipher(key)])), 'Image/Video': blackSpeechCipher('Image') + '/' + blackSpeechCipher('Video') });
