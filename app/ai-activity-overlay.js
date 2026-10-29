import * as THREE from 'three';
import { visualOptions } from '../src/preferences.js';

// One transparent canvas; projection uses the viewport's posed geometry and camera.
// Coarse areas are projected bounds, not guessed per-vertex progress.
export function drawAiActivity(canvas, activities, entries, camera, width, height, pixelRatio, preferences, hiddenVertices, now) {
  canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext('2d');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const point = new THREE.Vector3(), visual = visualOptions(preferences);
  const project = value => {
    point.copy(value).project(camera);
    return point.z >= -1 && point.z <= 1 && Number.isFinite(point.x) && Number.isFinite(point.y);
  };
  for (const activity of activities) {
    const running = activity.phase === 'target';
    const opacity = running ? .35 + .18 * Math.sin((now - activity.started) / 240) : .85 * Math.min(1, (activity.until - now) / 250);
    context.strokeStyle = running ? '#e6bd68' : '#70dbed';
    context.fillStyle = context.strokeStyle; context.lineWidth = 1.5; context.globalAlpha = opacity;
    for (const area of activity.areas) {
      const entry = entries[area.geoset];
      if (!entry?.group.visible) continue;
      const position = entry.geometry.attributes.position;
      if (area.vertices) {
        const hidden = hiddenVertices?.[area.geoset];
        context.beginPath();
        for (const id of area.vertices) {
          if (id >= position.count || (hidden instanceof Set ? hidden.has(id) : hidden?.includes(id))) continue;
          point.fromBufferAttribute(position, id);
          if (!project(point)) continue;
          const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
          const radius = Math.max(4, visual.vertexSize / 2 + 2) + (running ? opacity * 2 : 0);
          context.moveTo(x + radius, y); context.arc(x, y, radius, 0, Math.PI * 2);
        }
        context.stroke();
      } else {
        // Bounding spheres are already maintained by the viewport's pose/drag path.
        const sphere = entry.geometry.boundingSphere;
        if (!sphere || !Number.isFinite(sphere.radius)) continue;
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (let i = 0; i < 8; i++) {
          point.set(sphere.center.x + (i & 1 ? 1 : -1) * sphere.radius,
            sphere.center.y + (i & 2 ? 1 : -1) * sphere.radius,
            sphere.center.z + (i & 4 ? 1 : -1) * sphere.radius);
          if (!project(point)) continue;
          const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (!Number.isFinite(left)) continue;
        context.globalAlpha = opacity * .10; context.fillRect(left, top, right - left, bottom - top);
        context.globalAlpha = opacity; context.strokeRect(left, top, right - left, bottom - top);
      }
    }
  }
}
