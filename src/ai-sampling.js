import { Box3, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, skinGeoset } from './animation.js';
import { sweepAiRelation } from './ai-relation-sweep.js';
import { isolateGlobalSequence } from './global-sequence-preview.js';

/** Numeric pose inspection uses the same skinning implementation as the editor. */
export function sampleAiModel(
  model, context, args = {}, signal,
) {
  if (args.sweep !== undefined) return sweepAiRelation(model, args.sweep, signal);
  const {
    frames = [context.frame],
    sequence = context.sequence,
    globalSequence = context.globalSequence ?? null,
    nodeIds = context.selectedNodeIds || [],
    geosetIds,
    vertices = context.selection || {},
    offset = 0,
    limit = 200,
  } = args;
  if (!Number.isInteger(sequence) || sequence < -1 || sequence >= model.Sequences.length)
    throw Error('Animation index is out of range.');
  if (!Array.isArray(frames) || !frames.length || frames.length > 32 || frames.some(f => !Number.isFinite(f)))
    throw Error('Choose 1–32 finite sample frames.');
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw Error('Choose a vertex page of 1–1000.');
  if (
    globalSequence !== null &&
    (!Number.isInteger(globalSequence) || !(model.GlobalSequences?.[globalSequence] > 0))
  )
    throw Error('Global animation index is out of range.');
  let sampleModel = model,
    sampleSequence = sequence;
  if (globalSequence !== null) {
    sampleModel = isolateGlobalSequence(structuredClone(model), globalSequence);
    sampleSequence =
      sampleModel.Sequences.push({
        Name: 'AI global preview',
        Interval: new Uint32Array([0, model.GlobalSequences[globalSequence]]),
      }) - 1;
  }
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const ids = [...new Set(nodeIds)];
  if (ids.some(id => !Number.isInteger(id) || !nodes.has(id))) throw Error('Invalid sample node.');
  const meshes = [
    ...new Set(
      geosetIds ??
        (Object.keys(vertices).length ? Object.keys(vertices).map(Number) : context.checkedGeosets || []),
    ),
  ];
  if (meshes.some(id => !Number.isInteger(id) || !model.Geosets[id])) throw Error('Invalid sample geoset.');
  for (const [gi, selected] of Object.entries(vertices))
    if (
      !model.Geosets[gi] ||
      !Array.isArray(selected) ||
      selected.some(id => !Number.isInteger(id) || id < 0 || id >= model.Geosets[gi].Vertices.length / 3)
    )
      throw Error('Invalid sample vertices.');
  const point = new Vector3(),
    box = new Box3();
  return {
    sequence,
    globalSequence,
    space: 'model (after hierarchy and skinning)',
    cameraDependentNodes: [...nodes.values()].filter(n => n.Flags & 120).map(n => n.ObjectId),
    samples: frames.map(frame => {
      const matrices = sampleNodeMatrices(sampleModel, frame, sampleSequence);
      return {
        frame,
        nodes: ids.map(id => {
          const node = nodes.get(id),
            matrix = matrices.get(id);
          return {
            id,
            name: node.Name,
            position: point
              .fromArray(node.PivotPoint || model.PivotPoints[id] || [0, 0, 0])
              .applyMatrix4(matrix)
              .toArray(),
            matrix: matrix.toArray(),
          };
        }),
        geosets: meshes.map(id => {
          const geoset = model.Geosets[id],
            posed = skinGeoset(geoset, matrices),
            selected = vertices[id] || [];
          box.setFromArray(posed);
          const bounds = box.isEmpty()
            ? null
            : { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(point).toArray() };
          return {
            id,
            vertices: posed.length / 3,
            triangles: geoset.Faces.length / 3,
            bounds,
            selected: {
              total: selected.length,
              offset,
              truncated: offset + limit < selected.length,
              positions: selected
                .slice(offset, offset + limit)
                .map(vertex => ({
                  id: vertex,
                  position: Array.from(posed.subarray(vertex * 3, vertex * 3 + 3)),
                })),
            },
          };
        }),
      };
    }),
    note: 'CPU hierarchy/skinning measurements; use viewport captures for materials, billboards, particles and appearance.',
  };
}
