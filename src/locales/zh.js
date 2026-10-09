import { paintChinese } from './paint-ui-locales.js';
import showcase from './showcase.json' with { type: 'json' };
import { chinese } from './short-ui-locales.js';
import { broadChinese } from './broad-ui-locales.js';
import { release015Chinese } from './v015-ui-locales.js';
import { currentChinese } from './current-ui-locales.js';

export default Object.freeze({ ...currentChinese, ...paintChinese, ...Object.fromEntries(Object.entries(showcase).map(([key, values]) => [key, values[2]])), ...chinese, ...broadChinese, ...release015Chinese });
