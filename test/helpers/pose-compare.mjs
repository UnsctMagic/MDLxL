// Plays two versions of a model side by side through war3-model's ModelRenderer, frame by frame, to prove an
// edit kept the motion. Used by OptimizeXL repair tests and the manual optimizexl-*-models.mjs checks.
import { ModelRenderer } from 'war3-model';

// Calls visit({ a, b, sequence, frame }) for every frame of every sequence of `before` (step apart), with both
// renderers set to that frame. updateNodes: also recompute node matrices. Returns the number of samples.
export function comparePoses(before, after, visit, { step = 1, updateNodes = false } = {}) {
  const a = new ModelRenderer(structuredClone(before)), b = new ModelRenderer(structuredClone(after));
  let samples = 0;
  for (const [sequence, animation] of before.Sequences.entries()) {
    a.setSequence(sequence); b.setSequence(sequence);
    for (let frame = animation.Interval[0]; frame <= animation.Interval[1]; frame += step) {
      a.setFrame(frame); b.setFrame(frame);
      if (updateNodes) { a.updateNode(a.rendererData.rootNode); b.updateNode(b.rendererData.rootNode); }
      visit({ a, b, sequence, frame }); samples++;
    }
  }
  return samples;
}

// Largest difference between any node matrix element of the two models over all sampled frames.
export function maxNodeMatrixDifference(before, after, options = {}) {
  let max = 0;
  const samples = comparePoses(before, after, ({ a, b }) => {
    const left = a.rendererData.nodes.filter(Boolean), right = b.rendererData.nodes.filter(Boolean);
    if (left.length !== right.length) { max = Infinity; return; }
    left.forEach((node, i) => node.matrix.forEach((value, j) => { max = Math.max(max, Math.abs(value - right[i].matrix[j])); }));
  }, { ...options, updateNodes: true });
  return { max, samples };
}
