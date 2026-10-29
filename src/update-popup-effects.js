import { ModelRenderer, parseMDX, decodeBLP, getBLPImageData } from 'war3-model';
import { Matrix4, Vector3 } from 'three';
import { playUpdateChime } from './update-chime.js';
import { eyeScene, eyeTextures } from './update-helmet-assets.js';

export const POPUP_EFFECT_DELAY = 650;
const bytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

// Follow the two connected red eye regions, including their brighter centers.
// A rectangular color threshold also darkens the helmet's gold trim.
export function darkEyePixels(source, width, height) {
  const result = new Uint8ClampedArray(source), size = width * height;
  const visited = new Uint8Array(size), mask = new Uint8Array(size);
  const queue = [[Math.round(width * .3515625), Math.round(height * .546875)], [Math.round(width * .578125), Math.round(height * .546875)]];
  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const index = y * width + x;
    if (visited[index]) continue;
    visited[index] = 1;
    const offset = index * 4, r = source[offset], g = source[offset + 1], b = source[offset + 2];
    if (!(r > g * 2.5 && r > b * 2.5 && r > 30)) continue;
    mask[index] = 1;
    queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  const outside = new Uint8Array(size), exterior = [0];
  while (exterior.length) {
    const index = exterior.pop();
    if (outside[index] || mask[index]) continue;
    outside[index] = 1;
    const x = index % width, y = Math.floor(index / width);
    if (x > 0) exterior.push(index - 1);
    if (x + 1 < width) exterior.push(index + 1);
    if (y > 0) exterior.push(index - width);
    if (y + 1 < height) exterior.push(index + width);
  }
  for (let index = 0; index < size; index++) if (mask[index] || !outside[index]) {
    for (let channel = 0; channel < 3; channel++) result[index * 4 + channel] = Math.round(source[index * 4 + channel] * .04);
  }
  return result;
}

class HelmetView {
  constructor(element) {
    this.element = element;
    this.picture = element.querySelector('[data-helmet]');
    this.canvas = element.querySelector('[data-particles]');
  }
  initialize() {
    this.context = this.picture.getContext('2d', { willReadFrequently: true });
    this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!this.gl) throw Error('The update helmet needs WebGL.');
    this.native = new ModelRenderer(parseMDX(bytes(eyeScene).buffer));
    this.native.initGL(this.gl);
    this.native.setSequence(0);
    this.native.setCamera([100, 0, 0], [0, 0, 0, 1]);
    for (const [path, value] of Object.entries(eyeTextures)) {
      const texture = decodeBLP(bytes(value).buffer);
      this.native.setTextureImageData(path, [getBLPImageData(texture, 0)]);
    }
    this.view = new Matrix4().lookAt(new Vector3(100, 0, 0), new Vector3(), new Vector3(0, 0, 1)).setPosition(100, 0, 0).invert().elements;
    this.projection = new Matrix4().makeOrthographic(-24, 24, 24, -24, .1, 200).elements;
    this.clear();
    return this.loadImage();
  }
  async loadImage() {
    const image = this.element.querySelector('img');
    await image.decode();
    if (this.disposed) return;
    this.context.drawImage(image, 0, 0, this.picture.width, this.picture.height);
    this.lit = this.context.getImageData(0, 0, this.picture.width, this.picture.height);
    this.dark = new ImageData(darkEyePixels(this.lit.data, this.lit.width, this.lit.height), this.lit.width, this.lit.height);
    this.reset();
  }
  clear() {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }
  reset() {
    if (this.disposed) return;
    for (const emitter of this.native.particlesController.emitters) {
      emitter.particles.length = 0; emitter.emission = 0; emitter.squirtFrame = -1;
    }
    this.burning = false; this.lastTime = null;
    if (this.dark) this.context.putImageData(this.dark, 0, 0);
    this.element.dataset.eyes = 'dark';
    this.clear();
  }
  render(time, deadline) {
    if (this.disposed || !this.dark || time < deadline) return;
    if (!this.burning) {
      this.burning = true;
      this.context.putImageData(this.lit, 0, 0);
      this.element.dataset.eyes = 'lit';
    }
    this.native.update(this.lastTime == null ? 0 : Math.min(50, Math.max(0, time - this.lastTime)));
    this.lastTime = time;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.clear();
    this.native.render(this.view, this.projection, { wireframe: false, env: false, useEnvironmentMap: false });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    delete this.element.dataset.effects;
    // Same pinned SD cleanup compatibility as GamePreview: upstream also tries
    // to destroy HD shader objects that were never created for this model.
    if (this.native) {
      const destroyShader = this.native.destroyShaderProgramObject;
      this.native.destroyShaderProgramObject = function(shader) { if (shader) return destroyShader.call(this, shader); };
    }
    try { this.native?.destroy(); }
    catch (error) { console.warn('Could not finish update helmet cleanup.', error); }
    finally { this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
  }
}

// Owned by useUpdates, rather than its remountable dialog, so progress or
// startup preference renders cannot replay the fanfare or reset its deadline.
export class UpdatePopupEffects {
  constructor() {
    this.audioToken = 0;
    this.frame = 0;
    this.onVisible = () => { if (document.visibilityState !== 'hidden') this.begin(); };
  }
  attach(element) {
    const view = new HelmetView(element);
    this.view = view;
    const fallback = error => {
      if (this.view === view) { cancelAnimationFrame(this.frame); this.frame = 0; this.view = null; }
      view.dispose();
      console.warn('Update helmet effects unavailable; using the static icon.', error);
    };
    try {
      this.ready = view.initialize().then(() => {
        if (this.view !== view) return;
        element.dataset.effects = 'ready';
        if (this.started) this.animate();
      }).catch(fallback);
    } catch (error) {
      fallback(error);
      this.ready = Promise.resolve();
    }
    return () => {
      if (this.view === view) { cancelAnimationFrame(this.frame); this.frame = 0; this.view = null; }
      view.dispose();
    };
  }
  open({ muted = false } = {}) {
    if (this.active) return;
    this.active = true; this.muted = muted;
    document.addEventListener('visibilitychange', this.onVisible);
    this.onVisible();
  }
  begin() {
    if (!this.active || this.started) return;
    this.started = true;
    this.deadline = performance.now() + POPUP_EFFECT_DELAY;
    this.animate();
    if (!this.muted) void this.prepareAudio();
  }
  animate() {
    if (this.frame || !this.active || !this.started || !this.view) return;
    this.frame = requestAnimationFrame(time => {
      this.frame = 0;
      if (!this.active) return;
      this.view?.render(time, this.deadline);
      this.animate();
    });
  }
  async prepareAudio() {
    const token = ++this.audioToken, audio = new AudioContext();
    this.audio = audio;
    try {
      await audio.resume();
      if (token !== this.audioToken || !this.active || this.muted) return;
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 180);
        this.cancelWarmup = () => { clearTimeout(timer); resolve(); };
      });
      if (token !== this.audioToken || !this.active || this.muted) return;
      this.cancelWarmup = null;
      this.stopFanfare = playUpdateChime({ audio, startAt: audio.currentTime + Math.max(0, this.deadline - performance.now()) / 1000 });
    } catch (error) {
      if (token === this.audioToken) console.error(error);
    }
  }
  stopAudio() {
    this.audioToken++;
    this.cancelWarmup?.(); this.cancelWarmup = null;
    if (this.stopFanfare) this.stopFanfare();
    else if (this.audio && this.audio.state !== 'closed') void this.audio.close();
    this.stopFanfare = null; this.audio = null;
  }
  setMuted(muted) {
    this.muted = muted;
    if (muted) this.stopAudio();
  }
  close() {
    this.active = false; this.started = false;
    document.removeEventListener('visibilitychange', this.onVisible);
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.stopAudio();
    this.view?.reset();
  }
}
