// The desktop bridge from electron/preload.cjs, or null in a plain browser run.
// New renderer code checks features through here instead of window.desktop.
export const desktop = globalThis.window?.desktop ?? null;

/** True when the desktop app offers `name` (for example 'resolveTextures'). */
export const hasDesktop = name => typeof desktop?.[name] === 'function';

/**
 * Looks up model textures and other game files: next to the model, in the
 * chosen Warcraft III installation and in added sources.
 * Resolves to an empty list in the browser, where game files are unavailable.
 */
export async function resolveGameFiles(names, modelPath) {
  if (!hasDesktop('resolveTextures') || !names?.length) return [];
  return (await desktop.resolveTextures({ names, path: modelPath })) || [];
}
