import { sampleTrack } from '../src/animation.js';

/** Gates the renderer's own controllers without removing nodes or touching the
 * editing model. A manual test has its own wall clock, including while paused. */
export function installNodeEffectControls(native, getOptions, invalidate, now = () => performance.now()) {
  const pulses = new Map(), controllers = [['particles',native.particlesController],['ribbons',native.ribbonsController]];
  const originals = [];
  const clear = emitter => {
    if (emitter.particles) emitter.particles.length = 0;
    if (emitter.creationTimes) emitter.creationTimes.length = 0;
    emitter.emission = 0; if ('squirtFrame' in emitter) emitter.squirtFrame = -1;
  };
  for (const [kind, controller] of controllers) {
    if (!controller) continue;
    const update = controller.updateEmitter;
    originals.push([controller,update]);
    controller.updateEmitter = function(emitter, delta) {
      const options = getOptions(), until = pulses.get(emitter.props.ObjectId), testing = until > now();
      if (until && !testing) { pulses.delete(emitter.props.ObjectId); clear(emitter); }
      if (!(options[kind] ?? true) && !testing) { clear(emitter); return; }
      if (!testing) return update.call(this,emitter,delta);
      const props = emitter.props, saved = { Visibility:props.Visibility, EmissionRate:props.EmissionRate, Squirt:props.Squirt };
      const interval = native.model.Sequences?.[native.getSequence()]?.Interval;
      const rate = sampleTrack(props.EmissionRate,native.getFrame(),{ interval,globalSequences:native.model.GlobalSequences,fallback:0 });
      props.Visibility = 1;
      props.EmissionRate = Math.max(Number(rate?.[0] ?? rate) || 0, ...((saved.EmissionRate?.Keys || []).map(key => Number(key.Vector?.[0]) || 0)));
      props.Squirt = false;
      try { return update.call(this,emitter,delta); }
      finally { Object.assign(props,saved); }
    };
  }
  return {
    trigger(id) {
      const emitter = controllers.flatMap(([,controller]) => controller?.emitters || []).find(emitter => emitter.props.ObjectId === id);
      if (!emitter) return false;
      clear(emitter); pulses.set(id,now()+500); invalidate?.(); return true;
    },
    // Keep scheduling until an update consumes expired tests and clears them.
    get active() { return pulses.size > 0; },
    cancelTests() { pulses.clear(); for(const [,controller] of controllers)for(const emitter of controller?.emitters||[])clear(emitter); invalidate?.(); },
    advancePaused(delta) {
      // Updating only the controllers leaves the model pose and timeline fixed.
      for (const [,controller] of controllers) if (controller) {
        const emitters = controller.emitters;
        controller.emitters = emitters.filter(emitter => pulses.has(emitter.props.ObjectId));
        try { controller.update(delta); } finally { controller.emitters = emitters; }
      }
    },
    dispose() { pulses.clear(); for (const [controller,update] of originals) controller.updateEmitter = update; },
  };
}

/** Crossed event keys only: pause, a seek or a toggle must not repeat audio. */
export function crossedSoundEvents(model, previous, current) {
  if (!previous || previous.sequenceIndex !== current.sequenceIndex || !current.playing) return [];
  const interval = model.Sequences?.[current.sequenceIndex]?.Interval;
  return (model.EventObjects || []).filter(event => {
    if (event.Name?.slice(0,3).toUpperCase() !== 'SND') return false;
    const globalId = event.GlobalSeqId ?? event.GlobalSequenceId;
    if (Number.isInteger(globalId) && globalId >= 0) {
      const duration = model.GlobalSequences?.[globalId];
      if (!(duration > 0) || current.globalTime < previous.globalTime) return false;
      return Array.from(event.EventTrack || []).some(frame => frame <= duration && Math.floor((current.globalTime-frame)/duration) > Math.floor((previous.globalTime-frame)/duration));
    }
    if (!interval) return false;
    return Array.from(event.EventTrack || []).some(frame => frame >= interval[0] && frame <= interval[1] &&
      (current.frame >= previous.frame ? (previous.playing ? frame > previous.frame : frame >= previous.frame) && frame <= current.frame : frame > previous.frame || frame >= interval[0] && frame <= current.frame));
  });
}
