// View AI work: one 3D view's share of a replay. The view calls begin() before it draws
// its model (old positions glide to the new ones in the view's own buffers) and end()
// after (marker, glow and the old picture leaving, on one overlay canvas). Everything
// runs inside the view's own frame: at most once per display frame, nothing when no
// replay is running.
import { aiReplay, REPLAY_HOLD_MS } from './ai-replay.js';
import { glideInto, growInto, replayPhase } from '../src/ai-replay.js';
import { exposeReplayForTests } from './test-hook.js';

// The picture from just before an edit, per model tab and view kind. A preview that
// rebuilds itself for the edited model finds its old picture here.
const pictures = new Map();
const TAU = Math.PI * 2;
// Read-only, for the test hook: the replay running now and what each mounted view shows of it.
const stages = new Set();
exposeReplayForTests(() => {
  const sample = aiReplay.sample(), plan = sample?.plan;
  return {
    armed: !!aiReplay.armed,
    color: aiReplay.color,
    ...(sample ? { id: sample.id, p: sample.p, ms: plan.ms, look: !!plan.look, fade: plan.fade, span: plan.span, focus: plan.focus,
      counts: Object.fromEntries(['glides', 'grows', 'uvs', 'ghosts', 'pivots', 'emitters', 'bones', 'glow', 'keyFrames'].map(key => [key, plan[key].length])) } : {}),
    views: [...stages].map(stage => stage.read()),
  };
});
const rgbOf = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));

export function createReplayStage({ replay = aiReplay, kind, host, target, size, source, viewports, geometry, displayed, nodePoint, invalidate, blocked = () => false, posed = false }) {
  let canvas = null, applied = null, appliedId = 0, wrote = false, phase = null, stamp = -1, holdSince = 0, holdTimer = 0, disposed = false;
  const settled = new Set(), scratch = new Map(), tails = new Map();
  const pictureKey = () => target().documentId + ':' + kind;
  const buffer = (map, key, length) => {
    let array = map.get(key);
    if (!array || array.length !== length) map.set(key, (array = new Float32Array(length)));
    return array;
  };
  function capture() {
    const armed = replay.armed, at = target();
    if (!armed || armed.documentId !== at.documentId) return;
    try {
      const drawn = source();
      if (!drawn?.width || !drawn.height) return;
      let picture = pictures.get(pictureKey());
      if (!picture) pictures.set(pictureKey(), (picture = { canvas: host.ownerDocument.createElement('canvas') }));
      if (picture.canvas.width !== drawn.width) picture.canvas.width = drawn.width;
      if (picture.canvas.height !== drawn.height) picture.canvas.height = drawn.height;
      const context = picture.canvas.getContext('2d');
      context.globalCompositeOperation = 'copy';
      context.drawImage(drawn, 0, 0);
      Object.assign(picture, { view: viewports()[0]?.key, revision: at.revision });
    } catch {}
  }
  const unsubscribe = replay.subscribe(reason => {
    if (disposed) return;
    if (reason === 'arm') return capture();
    // A replay that ends (or is stopped for a picture of the real model) lets go of the
    // view's buffers at once, not a frame later.
    if (reason === 'end') {
      restore();
      applied = null;
      appliedId = 0;
      clear();
    }
    holdSince = 0;
    invalidate();
  });
  function restore() {
    if (wrote) geometry.restore();
    wrote = false;
    scratch.clear();
    tails.clear();
  }
  // Old positions glide to the new ones, new parts grow, UVs slide: written into the
  // view's own buffers for this frame only.
  function write(plan, now) {
    if (plan.geosetCount !== undefined && geometry.count() !== plan.geosetCount) return;
    for (const act of plan.glides) {
      if (geometry.length(act.geoset) !== act.to.length) continue;
      const rest = glideInto(buffer(scratch, act.geoset, act.to.length), act.from, act.to, now.glide);
      if (geometry.write(act.geoset, rest)) wrote = true;
    }
    for (const act of plan.grows) {
      if (geometry.length(act.geoset) !== act.to.length) continue;
      const rest = growInto(buffer(scratch, act.geoset, act.to.length), act.to, act.center, now.grow);
      if (geometry.write(act.geoset, rest)) wrote = true;
    }
    for (const act of plan.uvs) {
      const sets = act.to.map((to, index) => glideInto(buffer(scratch, 'uv' + act.geoset + ':' + index, to.length), act.from[index], to, now.glide));
      if (geometry.uv?.(act.geoset, sets)) wrote = true;
    }
  }
  function begin(frameStamp) {
    if (disposed) return null;
    if (frameStamp === stamp) return phase;
    stamp = frameStamp;
    const sample = replay.sample(), at = target();
    const mine = sample && sample.documentId === at.documentId && sample.revision === at.revision ? sample : null;
    if ((mine?.id || 0) !== appliedId) {
      restore();
      applied = mine?.plan || null;
      appliedId = mine?.id || 0;
    }
    if (!mine) return (phase = null);
    phase = replayPhase(mine.plan, mine.p);
    if (!settled.has(mine.id) && !blocked()) write(mine.plan, phase);
    else if (wrote) restore();
    return phase;
  }
  function overlay() {
    const { width, height } = size();
    if (!canvas) {
      canvas = host.ownerDocument.createElement('canvas');
      canvas.dataset.aiReplay = '';
      canvas.style.cssText = 'position:absolute;z-index:30;inset:0;width:100%;height:100%;pointer-events:none';
      host.appendChild(canvas);
    }
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, width, height);
    return context;
  }
  function clear() {
    if (canvas) canvas.remove();
    canvas = null;
  }
  function end() {
    if (disposed) return;
    const at = target(), picture = pictures.get(pictureKey()), { width, height } = size();
    const pictureFits = picture && picture.canvas.width === width && picture.canvas.height === height;
    if (!applied) {
      // The edit is on the model but its replay has not started: keep the old picture for
      // these few frames so the result is not seen before its own replay.
      const armed = replay.armed;
      const waiting = armed && armed.documentId === at.documentId && armed.revision !== at.revision && pictureFits && picture.revision === armed.revision;
      if (waiting && !holdSince) {
        holdSince = performance.now();
        clearTimeout(holdTimer);
        holdTimer = setTimeout(invalidate, REPLAY_HOLD_MS + 20);
      }
      if (waiting && performance.now() - holdSince < REPLAY_HOLD_MS) overlay().drawImage(picture.canvas, 0, 0);
      else clear();
      return;
    }
    holdSince = 0;
    const views = viewports(), context = overlay(), scale = width / Math.max(1, host.clientWidth);
    const sameView = pictureFits && views[0] && picture.view === views[0].key;
    draw(context, applied, phase, views, sameView ? picture.canvas : null, scale, width, height);
  }
  const point2 = [0, 0];
  function draw(context, plan, now, views, picture, scale, width, height) {
    const [r, g, b] = rgbOf(replay.color), ink = alpha => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
    const first = views[0];
    if (!first) return;
    // Displayed positions of every lit part, once per frame.
    const shown = new Map();
    const positions = geoset => {
      if (!shown.has(geoset)) shown.set(geoset, displayed(geoset, null));
      return shown.get(geoset);
    };
    const projectAll = (view, vertices) => {
      const out = new Float32Array((vertices.length / 3) * 2);
      for (let i = 0, o = 0; i < vertices.length; i += 3, o += 2) {
        if (view.project(vertices[i], vertices[i + 1], vertices[i + 2], point2)) {
          out[o] = point2[0];
          out[o + 1] = point2[1];
        } else out[o] = out[o + 1] = NaN;
      }
      return out;
    };
    const trianglePath = (points, faces) => {
      context.beginPath();
      for (let i = 0; i + 2 < faces.length; i += 3) {
        const a = faces[i] * 2, c = faces[i + 1] * 2, e = faces[i + 2] * 2;
        if (Number.isNaN(points[a]) || Number.isNaN(points[c]) || Number.isNaN(points[e])) continue;
        context.moveTo(points[a], points[a + 1]);
        context.lineTo(points[c], points[c + 1]);
        context.lineTo(points[e], points[e + 1]);
        context.closePath();
      }
    };
    const lit = plan.glow.map(item => ({ ...item, vertices: positions(item.geoset) })).filter(item => item.vertices && item.faces);

    // 1. The old picture leaves: a crossfade, or a brush pass for new texture pixels.
    if (plan.fade && picture) {
      if (plan.fade === 'cross') {
        context.globalAlpha = 1 - now.fade;
        context.drawImage(picture, 0, 0);
        context.globalAlpha = 1;
      } else {
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        const tilt = -.3, ux = Math.cos(tilt), uy = Math.sin(tilt);
        for (const item of lit) {
          const points = projectAll(first, item.vertices);
          for (let i = 0; i < points.length; i += 2) {
            if (Number.isNaN(points[i])) continue;
            const u = points[i] * ux + points[i + 1] * uy, v = -points[i] * uy + points[i + 1] * ux;
            if (u < minU) minU = u;
            if (u > maxU) maxU = u;
            if (v < minV) minV = v;
            if (v > maxV) maxV = v;
          }
        }
        if (!(maxU > minU)) {
          minU = first.x;
          maxU = first.x + first.width;
          minV = first.y;
          maxV = first.y + first.height;
        }
        const soft = Math.max(24 * scale, (maxU - minU) * .22), edge = minU - soft * .2 + (maxU - minU + soft * 1.4) * now.fade;
        context.drawImage(picture, 0, 0);
        const wipe = context.createLinearGradient((edge - soft) * ux, (edge - soft) * uy, edge * ux, edge * uy);
        wipe.addColorStop(0, 'rgba(0,0,0,1)');
        wipe.addColorStop(1, 'rgba(0,0,0,0)');
        context.globalCompositeOperation = 'destination-out';
        context.fillStyle = wipe;
        context.fillRect(0, 0, width, height);
        // The brush itself: a soft band of light on the edge of the pass.
        context.globalCompositeOperation = 'lighter';
        context.lineCap = 'round';
        const mid = edge - soft * .35, x0 = mid * ux - minV * uy, y0 = mid * uy + minV * ux, x1 = mid * ux - maxV * uy, y1 = mid * uy + maxV * ux;
        for (const [wide, alpha] of [[20, .05], [9, .1], [2.5, .34]]) {
          context.strokeStyle = ink(alpha * now.glow);
          context.lineWidth = wide * scale;
          context.beginPath();
          context.moveTo(x0, y0);
          context.lineTo(x1, y1);
          context.stroke();
        }
        context.globalCompositeOperation = 'source-over';
      }
    }

    for (const view of views) {
      context.save();
      context.beginPath();
      context.rect(view.x, view.y, view.width, view.height);
      context.clip();

      // 2. Removed parts shrink toward their middle and fade.
      for (const ghost of plan.ghosts) {
        if (now.ghostAlpha <= .004) continue;
        const points = projectAll(view, ghost.vertices);
        if (!view.project(ghost.center[0], ghost.center[1], ghost.center[2], point2)) continue;
        const cx = point2[0], cy = point2[1];
        context.save();
        context.translate(cx, cy);
        context.scale(now.ghostScale, now.ghostScale);
        context.translate(-cx, -cy);
        trianglePath(points, ghost.faces);
        if (picture && view === first) {
          context.save();
          context.clip();
          context.globalAlpha = now.ghostAlpha;
          context.drawImage(picture, 0, 0);
          context.restore();
        } else {
          context.fillStyle = ink(.16 * now.ghostAlpha);
          context.fill();
        }
        context.globalCompositeOperation = 'lighter';
        context.strokeStyle = ink(.3 * now.ghostAlpha);
        context.lineWidth = 1.1 * scale / Math.max(.3, now.ghostScale);
        context.stroke();
        context.restore();
      }

      // 3. The changed part glows softly.
      context.globalCompositeOperation = 'lighter';
      context.lineJoin = 'round';
      for (const item of lit) {
        trianglePath(projectAll(view, item.vertices), item.faces);
        context.strokeStyle = ink(.07 * now.glow);
        context.lineWidth = 4.5 * scale;
        context.stroke();
        context.strokeStyle = ink(.3 * now.glow);
        context.lineWidth = 1.1 * scale;
        context.stroke();
      }

      // 4. Moving points leave a short trail behind them.
      context.lineCap = 'round';
      let anchor = null;
      for (const act of plan.glides) {
        const head = positions(act.geoset), rest = scratch.get(act.geoset);
        if (!head || !rest || now.glide <= 0 || now.glide >= 1) {
          if (head && !anchor) anchor = averageOf(view, head, act.trails);
          continue;
        }
        const tail = displayed(act.geoset, glideInto(buffer(tails, act.geoset, act.to.length), act.from, act.to, Math.max(0, now.glide - .3)));
        if (!tail) continue;
        context.lineWidth = 1.6 * scale;
        for (const id of act.trails) {
          if (!view.project(tail[id * 3], tail[id * 3 + 1], tail[id * 3 + 2], point2)) continue;
          const tx = point2[0], ty = point2[1];
          if (!view.project(head[id * 3], head[id * 3 + 1], head[id * 3 + 2], point2)) continue;
          if (Math.hypot(point2[0] - tx, point2[1] - ty) < .75) continue;
          const stroke = context.createLinearGradient(tx, ty, point2[0], point2[1]);
          stroke.addColorStop(0, ink(0));
          stroke.addColorStop(1, ink(.55 * now.glow));
          context.strokeStyle = stroke;
          context.beginPath();
          context.moveTo(tx, ty);
          context.lineTo(point2[0], point2[1]);
          context.stroke();
        }
        if (!anchor) anchor = averageOf(view, head, act.trails);
      }

      // 5. Bones that got keys, emitters that start or stop, pivots that glide.
      const glowDot = (x, y, radius, alpha) => {
        const halo = context.createRadialGradient(x, y, 0, x, y, radius);
        halo.addColorStop(0, ink(alpha));
        halo.addColorStop(1, ink(0));
        context.fillStyle = halo;
        context.beginPath();
        context.arc(x, y, radius, 0, TAU);
        context.fill();
      };
      const place = (id, at) => {
        const world = nodePoint(id, at);
        return world && view.project(world[0], world[1], world[2], point2) ? [point2[0], point2[1]] : null;
      };
      for (const bone of plan.bones) {
        const at = place(bone.id, bone.at);
        if (!at) continue;
        glowDot(at[0], at[1], 11 * scale, .5 * now.glow);
        anchor ||= at;
      }
      for (const emitter of plan.emitters) {
        const at = place(emitter.id, emitter.at);
        if (!at) continue;
        const amount = emitter.on ? now.grow : 1 - now.grow, alpha = emitter.on ? now.glow : now.ghostAlpha;
        glowDot(at[0], at[1], (5 + 13 * amount) * scale, .45 * alpha);
        context.strokeStyle = ink(.6 * alpha);
        context.lineWidth = 1.3 * scale;
        context.beginPath();
        context.arc(at[0], at[1], (3 + 11 * amount) * scale, 0, TAU);
        context.stroke();
        anchor ||= at;
      }
      for (const pivot of plan.pivots) {
        const from = place(null, pivot.from), to = place(null, [0, 1, 2].map(axis => pivot.from[axis] + (pivot.to[axis] - pivot.from[axis]) * now.glide));
        if (!from || !to) continue;
        const stroke = context.createLinearGradient(from[0], from[1], to[0], to[1]);
        stroke.addColorStop(0, ink(0));
        stroke.addColorStop(1, ink(.6 * now.glow));
        context.strokeStyle = stroke;
        context.lineWidth = 1.6 * scale;
        context.beginPath();
        context.moveTo(from[0], from[1]);
        context.lineTo(to[0], to[1]);
        context.stroke();
        glowDot(to[0], to[1], 9 * scale, .6 * now.marker);
        anchor ||= to;
      }
      context.globalCompositeOperation = 'source-over';

      // 6. The marker hovers where the AI works.
      if (!anchor && lit[0]) anchor = averageOf(view, lit[0].vertices, lit[0].faces);
      const focus = (posed && plan.focusPosed) || plan.focus;
      if (!anchor && focus && view.project(focus[0], focus[1], focus[2], point2)) anchor = [point2[0], point2[1]];
      if (anchor && now.marker > .004) marker(context, anchor[0], anchor[1], now, scale, ink);
      context.restore();
    }
  }
  function averageOf(view, vertices, ids) {
    let x = 0, y = 0, count = 0;
    const step = Math.max(1, Math.floor(ids.length / 48));
    for (let i = 0; i < ids.length; i += step) {
      const id = ids[i];
      if (!view.project(vertices[id * 3], vertices[id * 3 + 1], vertices[id * 3 + 2], point2)) continue;
      x += point2[0];
      y += point2[1];
      count++;
    }
    return count ? [x / count, y / count] : null;
  }
  // A small ring floating just above the spot, on a thin stem. It drifts gently; its
  // brightness only follows the replay's own smooth curve.
  function marker(context, x, y, now, scale, ink) {
    const drift = Math.sin(performance.now() / 420) * 2 * scale, top = y - 20 * scale + drift, ring = 6 * scale, alpha = now.marker;
    context.globalCompositeOperation = 'lighter';
    const halo = context.createRadialGradient(x, top, 0, x, top, 18 * scale);
    halo.addColorStop(0, ink(.32 * alpha));
    halo.addColorStop(1, ink(0));
    context.fillStyle = halo;
    context.beginPath();
    context.arc(x, top, 18 * scale, 0, TAU);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    const stem = context.createLinearGradient(x, top + ring, x, y);
    stem.addColorStop(0, ink(.7 * alpha));
    stem.addColorStop(1, ink(.1 * alpha));
    context.strokeStyle = stem;
    context.lineWidth = 1.2 * scale;
    context.beginPath();
    context.moveTo(x, top + ring);
    context.lineTo(x, y);
    context.stroke();
    context.strokeStyle = `rgba(0,0,0,${.4 * alpha})`;
    context.lineWidth = 3.4 * scale;
    context.beginPath();
    context.arc(x, top, ring, 0, TAU);
    context.stroke();
    context.strokeStyle = ink(.95 * alpha);
    context.lineWidth = 1.7 * scale;
    context.beginPath();
    context.arc(x, top, ring, 0, TAU);
    context.stroke();
    context.fillStyle = ink(alpha);
    context.beginPath();
    context.arc(x, top, 1.9 * scale, 0, TAU);
    context.fill();
    context.beginPath();
    context.arc(x, y, 1.6 * scale, 0, TAU);
    context.fill();
  }
  const reading = {
    read: () => ({ kind, overlay: !!canvas, playing: appliedId, wrote, frame: applied && phase ? phase.frame : null,
      // Up to 'limit' displayed points of one part: [x, y, z, ...].
      shown: (geoset, limit = 8) => { const all = displayed(geoset, null); return all ? Array.from(all.subarray(0, limit * 3)) : null; } }),
  };
  stages.add(reading);
  return {
    begin,
    end,
    // The frame of the changed animation span to show now, or null.
    frame: () => (applied && phase && !settled.has(appliedId) ? phase.frame : null),
    sequence: () => applied?.span?.sequence ?? -1,
    // True while this view must keep drawing every frame.
    active() {
      if (disposed) return false;
      const sample = replay.sample(), at = target();
      return !!sample && sample.documentId === at.documentId && sample.revision === at.revision;
    },
    // The user starts their own drag: the model shows its real positions from here on.
    settle() {
      if (appliedId) settled.add(appliedId);
      restore();
    },
    dispose() {
      disposed = true;
      stages.delete(reading);
      unsubscribe();
      clearTimeout(holdTimer);
      restore();
      clear();
    },
  };
}

// A closed model tab keeps no picture.
export function forgetReplayPictures(documentId) {
  for (const key of [...pictures.keys()]) if (key.startsWith(documentId + ':')) pictures.delete(key);
}
