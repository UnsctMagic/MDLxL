import { paintRussian } from './paint-ui-locales.js';
import showcase from './showcase.json' with { type: 'json' };
import core from './ru-core.json' with { type: 'json' };
import editor from './ru-editor.json' with { type: 'json' };
import engine from './ru-engine.json' with { type: 'json' };
import additions from './ru-additions.json' with { type: 'json' };
import forge from './ru-forge.json' with { type: 'json' };
import descriptors from './ru-descriptors.json' with { type: 'json' };
import materials from './ru-materials.json' with { type: 'json' };
import previewCache from './ru-preview-cache.json' with { type: 'json' };
import optimizer from './ru-optimizer.json' with { type: 'json' };
import reviewed from './ru-reviewed.json' with { type: 'json' };
import { release015Russian } from './v015-ui-locales.js';
import { currentRussian } from './current-ui-locales.js';

export default Object.freeze({ ...currentRussian, ...paintRussian, ...Object.fromEntries(Object.entries(showcase).map(([key, values]) => [key, values[0]])), ...core, ...editor, ...engine, ...additions, ...forge, ...descriptors, ...materials, ...previewCache, ...optimizer, ...reviewed, ...release015Russian });
