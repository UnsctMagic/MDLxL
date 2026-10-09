import { paintSpanish } from './paint-ui-locales.js';
import showcase from './showcase.json' with { type: 'json' };
import reviewed from './es-reviewed.json' with { type: 'json' };
import { spanish } from './short-ui-locales.js';
import { broadSpanish } from './broad-ui-locales.js';
import { release015Spanish } from './v015-ui-locales.js';
import { currentSpanish } from './current-ui-locales.js';

export default Object.freeze({ ...currentSpanish, ...paintSpanish, ...Object.fromEntries(Object.entries(showcase).map(([key, values]) => [key, values[1]])), ...spanish, ...broadSpanish, ...reviewed, ...release015Spanish });
