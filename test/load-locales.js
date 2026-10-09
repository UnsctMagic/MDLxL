// Tests that inspect every catalog explicitly load it; normal English startup
// intentionally leaves those catalogs unloaded.
import { loadLanguage } from '../src/localization.js';
await Promise.all(['ru', 'es', 'zh', 'mordor'].map(loadLanguage));
