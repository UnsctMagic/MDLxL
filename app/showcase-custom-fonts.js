// Fonts the user loads for Showcase text. Files persist in the profile's
// IndexedDB, like signature presets, and register as document fonts so the
// preview and the GIF export draw them with the same canvas text renderer.
const DATABASE = 'mdlxl-showcase-fonts';
const loaded = new Map();
const listeners = new Set();
let version = 0, ready = null;

function transact(mode, operation) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('fonts', { keyPath: 'id' });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result, transaction = database.transaction('fonts', mode);
      const request = operation(transaction.objectStore('fonts'));
      let result;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(transaction.error || Error('Font storage was interrupted.')); };
    };
  });
}

function notify() { version++; for (const listener of listeners) listener(); }

async function register(row) {
  if (loaded.has(row.id)) return loaded.get(row.id);
  const family = 'Showcase User ' + row.id;
  const face = new FontFace(family, await row.blob.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  const font = { id: row.id, name: row.name, family, face };
  loaded.set(row.id, font);
  return font;
}

export const customFonts = () => [...loaded.values()];
export const customFontFamily = id => loaded.get(id)?.family;
export const customFontsVersion = () => version;
export function subscribeCustomFonts(listener) { listeners.add(listener); return () => listeners.delete(listener); }

export function loadCustomFonts() {
  ready ||= transact('readonly', store => store.getAll()).then(async rows => {
    for (const row of rows.sort((a, b) => a.added - b.added)) {
      try { await register(row); } catch { /* A damaged font file stays stored but unused. */ }
    }
    notify();
    return customFonts();
  }).catch(error => { ready = null; throw error; });
  return ready;
}

export async function addCustomFont(file) {
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw Error('Choose a TTF, OTF, WOFF or WOFF2 font file.');
  const row = { id: 'user-' + crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ''), added: Date.now(), blob: new Blob([await file.arrayBuffer()], { type: file.type || 'font/ttf' }) };
  let font;
  try { font = await register(row); } catch { throw Error('This file is not a font Showcase can read.'); }
  await transact('readwrite', store => store.put(row));
  notify();
  return font;
}

// Text that used a removed font falls back to the first built-in font.
export async function removeCustomFont(id) {
  await transact('readwrite', store => store.delete(id));
  const font = loaded.get(id);
  if (font) { document.fonts.delete(font.face); loaded.delete(id); }
  notify();
}
