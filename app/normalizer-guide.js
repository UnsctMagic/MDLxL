import { Vector3 } from 'three';
import { projectGridSegment } from './preview-overlays.js';

/** Projected world-space rings share the viewport camera and do not capture navigation. */
export function drawNormalizerGuide(context, camera, width, height, normalizer, ratio) {
  if (!['outward', 'inward'].includes(normalizer.mode)) return;
  const { center, radius } = normalizer;
  context.save(); context.scale(ratio, ratio);
  context.strokeStyle = '#bb841e'; context.lineWidth = 1.25; context.globalAlpha = .8;
  context.beginPath();
  for (const [a, b] of [[0,1],[0,2],[1,2]]) for (let step = 0; step < 96; step++) {
    const from = [...center], to = [...center];
    from[a] += radius * Math.cos(step * Math.PI / 48); from[b] += radius * Math.sin(step * Math.PI / 48);
    to[a] += radius * Math.cos((step + 1) * Math.PI / 48); to[b] += radius * Math.sin((step + 1) * Math.PI / 48);
    const segment = projectGridSegment(camera, width, height, from, to);
    if (segment) { context.moveTo(segment[0].x, segment[0].y); context.lineTo(segment[1].x, segment[1].y); }
  }
  context.stroke(); context.globalAlpha = 1;
  const point = new Vector3(...center).project(camera);
  if (point.z >= -1 && point.z <= 1) {
    const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
    context.fillStyle = '#ffcb58'; context.strokeStyle = '#473008'; context.lineWidth = 2;
    context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(x - 13, y); context.lineTo(x + 13, y); context.moveTo(x, y - 13); context.lineTo(x, y + 13); context.stroke();
  }
  context.restore();
}
