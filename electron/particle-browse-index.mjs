import fs from 'node:fs/promises';
import path from 'node:path';
import {readWorldEditorSources} from './game-file-library.cjs';
import {buildLocales} from './casc.cjs';
import {buildWorldEditorCatalog, WORLD_EDITOR_ORIGIN_FILES, isWorldEditorStringFile} from '../src/world-editor-catalog.js';
import {buildParticleBrowse,particleNamingEvidence,resolveParticleArtPaths} from '../src/particle-library-browse.js';
import {reviewFor} from './particle-review.cjs';
import {writeFileAtomic} from './atomic-file.cjs';
import {browseRevision} from './particle-review.cjs';

// Owned by the utility process. A complete old catalogue can acquire this sidecar
// without re-extracting a single recipe or touching personal metadata.
export async function prepareParticleBrowse(reader, build, cache) {
  const listing = await reader.list('files'), locale = buildLocales(build)[0];
  const source = await readWorldEditorSources(Object.keys(listing.keys),locale,WORLD_EDITOR_ORIGIN_FILES,
    isWorldEditorStringFile,name=>reader.readKey(listing.keys[name]));
  const {objects} = buildWorldEditorCatalog(new Map(source.files),source.strings,{particleOrigins:true});
  if (!objects.length) throw Error('World Editor tables could not be read from this installation.');
  const resolved = resolveParticleArtPaths(objects,listing.names);
  const evidence = new Map();
  return async (entries, shouldCancel) => {
    for (const item of entries) {
      if (shouldCancel()) return;
      if (evidence.has(item.id) || item.blocked) continue;
      // The same fields exist on legacy and newly indexed recipes. Read once, in the worker.
      const recipe = JSON.parse(await fs.readFile(path.join(cache,item.id+'.json'),'utf8'));
      evidence.set(item.id,particleNamingEvidence(recipe));
    }
    const browse=buildParticleBrowse(resolved,entries,evidence,reviewFor);
    const revision=browseRevision(await fs.stat(path.join(cache,'catalog.json'),{bigint:true}));
    await writeFileAtomic(path.join(cache,'browse.json'),JSON.stringify({revision,locale,...browse}));
  };
}
