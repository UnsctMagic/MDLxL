import { removeEditorData } from './editor-data.js';
import { EDITOR_ONLY_CHUNKS } from './editor-document.js';

/** User-facing Save As preflight. Low-level codec conversion warnings require
 * a policy at the UI boundary; the editor never silently drops opaque sections.
 */
export function prepareModelSave(doc, format = doc.format, name = doc.name) {
  if (!['mdl', 'mdx'].includes(format)) throw new Error('Choose MDL text or MDX binary.');
  const impact = doc.saveImpact(format);
  const unknown = impact.preservedUnknown.filter(tag => !EDITOR_ONLY_CHUNKS.has(tag));
  if (format !== doc.format && unknown.length) throw new Error(`Cannot convert this file container without losing unrecognized source data: ${unknown.join(', ')}. Save in its original ${doc.format.toUpperCase()} format.`);
  const bytes = doc.serialize(format), unreadable = doc.lastSaveUnreadable;
  const stripped = unreadable ? { removedBytes: 0 } : removeEditorData(bytes, format);
  const verificationWarnings = doc.lastSaveWarnings;
  return { format, notes: [...impact.leftOut, ...verificationWarnings], verificationWarnings, unreadable, name: name.replace(/\.(mdl|mdx)$/i, '') + '.' + format, bytes,
    editorDataBytes: stripped.removedBytes, withoutEditorData: stripped.removedBytes ? stripped.bytes : null };
}
