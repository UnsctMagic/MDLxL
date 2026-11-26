// Inspect a sheet of saved XFER models against the native recipient triangles.
// node scripts/xfer-review/surface-review.mjs <pick-sheet.json> <pair-list.json> <report.json>
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { openDocument } from '../../src/editor-document.js';
import { sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset, visitTracks } from '../../src/animation.js';
import { geosetMaterialLayers, isAdditiveLayer } from '../../src/geoset-extras.js';

export function frameTimes(sequence, keys) {
  const [start, end] = sequence.Interval;
  const times = new Set([start, end]);
  for (let n = 0; start + n * 1000 / 60 < end; n++) times.add(Math.round(start + n * 1000 / 60));
  for (const frame of keys) if (frame >= start && frame <= end) times.add(frame);
  return [...times].sort((a, b) => a - b);
}

export function authoredTimes(model) {
  const times = new Set();
  visitTracks(model, track => {
    if (track.GlobalSeqId == null || track.GlobalSeqId < 0) {
      for (const key of track.Keys) times.add(key.Frame);
    }
  });
  return times;
}

export function surfaceVisible(model, gi, frame, sequence) {
  if (sampleGeosetAnimation(model, gi, frame, sequence).alpha <= 0.001) return false;
  const layers = geosetMaterialLayers(model, model.Geosets[gi]);
  const options = { interval: model.Sequences[sequence].Interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback: 1 };
  return layers.some(layer => !isAdditiveLayer(layer) && sampleTrack(layer.Alpha, frame, options) > 0.001);
}

// Treat texture seams and material splits as one position. This also catches
// reindexed versions of the same mesh. A shared skeleton by itself is insufficient.
function bindPositions(model) {
  const positions = new Set();
  for (const { Vertices } of model.Geosets) {
    for (let i = 0; i < Vertices.length; i += 3) {
      positions.add([0, 1, 2].map(k => Math.round(10 * Vertices[i + k])).join(','));
    }
  }
  return positions;
}

function selection(own, donor) {
  const a = bindPositions(own), b = bindPositions(donor);
  let shared = 0;
  for (const key of a) if (b.has(key)) shared++;
  // Select examples conservatively when even the larger mesh shares almost
  // all its positions. Variants at a different scale still need visual review.
  const sharedFraction = shared / Math.max(1, a.size, b.size);
  return {
    disposition: sharedFraction >= 0.9 ? 'exclude shared geometry' : 'needs visual review',
    shared, receiverPositions: a.size, donorPositions: b.size, sharedFraction,
  };
}

function edges(geo) {
  const byPair = new Map();
  for (let i = 0; i < geo.Faces.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const first = geo.Faces[i + k], second = geo.Faces[i + (k + 1) % 3];
      const a = Math.min(first, second), b = Math.max(first, second);
      if (a !== b) byPair.set(a + ',' + b, [a, b]);
    }
  }
  return [...byPair.values()];
}

function edgeLength(points, a, b) {
  const x = points[3 * a] - points[3 * b];
  const y = points[3 * a + 1] - points[3 * b + 1];
  const z = points[3 * a + 2] - points[3 * b + 2];
  return Math.sqrt(x * x + y * y + z * z);
}

function connectivity(geo) {
  const { Faces } = geo;
  return createHash('sha256').update(Buffer.from(Faces.buffer, Faces.byteOffset, Faces.byteLength)).digest('hex');
}

function nativeEdges(model) {
  return model.Geosets.map(geo => {
    const pairs = edges(geo);
    return { pairs, max: new Float64Array(pairs.length), connectivity: connectivity(geo), count: geo.Vertices.length };
  });
}

function examine(model, reference) {
  const native = reference == null;
  const geosets = reference ?? nativeEdges(model);
  if (geosets.length !== model.Geosets.length ||
      geosets.some((g, i) => model.Geosets[i].Vertices.length !== g.count || connectivity(model.Geosets[i]) !== g.connectivity)) {
    throw Error('Recipient/result topology differs. Cannot compare vertices by index.');
  }
  const changed = geosets.map(g => new Float64Array(g.pairs.length));
  const buffers = geosets.map(g => new Float32Array(g.count));
  const keys = authoredTimes(model), clips = [];
  for (const [si, sequence] of model.Sequences.entries()) {
    const frames = frameTimes(sequence, keys);
    let worst = null;
    for (const frame of frames) {
      const matrices = sampleNodeMatrices(model, frame, si);
      for (const [gi, g] of geosets.entries()) {
        if (!surfaceVisible(model, gi, frame, si)) continue;
        const points = skinGeoset(model.Geosets[gi], matrices, buffers[gi]);
        for (let i = 0; i < g.pairs.length; i++) {
          const [a, b] = g.pairs[i], size = edgeLength(points, a, b);
          if (native) {
            g.max[i] = Math.max(g.max[i], size);
            continue;
          }
          if (!g.max[i]) continue;
          const excess = size - g.max[i];
          changed[gi][i] = Math.max(changed[gi][i], excess);
          if (excess > (worst?.excess ?? 0)) {
            worst = { gi, a, b, frame, ms: frame - sequence.Interval[0], native: g.max[i], result: size, excess };
          }
        }
      }
    }
    clips.push({ sequence: sequence.Name, frames: frames.length, worst });
  }
  if (native) return geosets;
  const largestEdges = geosets.flatMap((g, gi) => g.pairs.map(([a, b], i) => ({ gi, a, b, native: g.max[i], excess: changed[gi][i] })));
  return { clips, largestEdges: largestEdges.sort((a, b) => b.excess - a.excess).slice(0, 12) };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [sheetFile, listFile, output] = process.argv.slice(2);
  const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const sheet = read(sheetFile), pairs = read(listFile);
  if (pairs.length !== sheet.cases.length) throw Error('Pick sheet and source list have different lengths');
  const cache = new Map(), loadModel = f => openDocument(fs.readFileSync(f), f).model;
  const timeline = m => JSON.stringify(m.Sequences.map(s => [s.Name.trim(), ...s.Interval]));
  const rows = [];
  for (const [i, c] of sheet.cases.entries()) {
    const { own, donor } = pairs[i], resultFile = c.variants.find(v => v.id === 'result').file;
    const receiver = loadModel(own.file), source = loadModel(donor.file), saved = loadModel(resultFile);
    if (timeline(saved) !== timeline(source)) throw Error('The saved result and source donor timelines differ in ' + c.id);
    if (!cache.has(own.file)) cache.set(own.file, examine(receiver));
    const result = examine(saved, cache.get(own.file));
    rows.push({ id: c.id, own: own.file, donor: donor.file, result: resultFile, selection: selection(receiver, source), ...result });
    console.log(i + 1, c.question, result.clips.reduce((sum, clip) => sum + clip.frames, 0) + ' frames');
  }
  fs.writeFileSync(output, JSON.stringify(rows, null, 2));
}
