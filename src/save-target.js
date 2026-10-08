import { removeEditorData } from './editor-data.js';

/** User-facing Save As preflight. Low-level codec conversion warnings require
 * a policy at the UI boundary; the editor never silently drops opaque sections.
 */
export function prepareModelSave(doc, format = doc.format, name = doc.name) {
  if (!['mdl', 'mdx'].includes(format)) throw new Error('Choose MDL text or MDX binary.');
  const unknown = doc.saveImpact().preservedUnknown;
  if (format !== doc.format && unknown.length) throw new Error(`Cannot convert this file container without losing unrecognized source data: ${unknown.join(', ')}. Save in its original ${doc.format.toUpperCase()} format.`);
  const bytes = doc.serialize(format), stripped = removeEditorData(bytes, format);
  return { format, name: name.replace(/\.(mdl|mdx)$/i, '') + '.' + format, bytes,
    editorDataBytes: stripped.removedBytes, withoutEditorData: stripped.removedBytes ? stripped.bytes : null };
}
