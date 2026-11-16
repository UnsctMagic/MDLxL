// The desktop bridge from electron/preload.cjs, or null in a plain browser run.
// New renderer code checks features through here instead of window.desktop.
export const desktop = globalThis.window?.desktop ?? null;

/** True when the desktop app offers `name` (for example 'resolveTextures'). */
export const hasDesktop = name => typeof desktop?.[name] === 'function';

export async function saveArtifact(blob, name, kind) {
  if (hasDesktop('saveArtifact')) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return !!(await desktop.saveArtifact({ name, bytes, kind }));
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Looks up model textures and other game files: next to the model, in the
 * chosen Warcraft III installation and in added sources.
 * Resolves to an empty list in the browser, where game files are unavailable.
 */
export async function resolveGameFiles(names, modelPath) {
  if (!hasDesktop('resolveTextures') || !names?.length) return [];
  return (await desktop.resolveTextures({ names, path: modelPath })) || [];
}
