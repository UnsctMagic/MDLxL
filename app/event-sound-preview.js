import { loadEventCatalog, resolveEventSound } from './node-event-data.js';
import { crossedSoundEvents } from './node-effect-controls.js';

export function createEventSoundPreview({ model, modelPath, onWarning, desktop = window.desktop }) {
  let disposed = false, previous, generation = 0;
  const sounds = new Map(), urls = new Set(), playing = new Set(), automatic = new Set();
  const events = (model.EventObjects || []).filter(node => node.Name?.slice(0,3).toUpperCase() === 'SND');
  const ready = events.length && desktop?.resolveEventResources ? loadEventCatalog(modelPath).then(async catalog => {
    await Promise.all([...new Set(events.map(node => node.Name))].map(async name => {
      const file = catalog.SND.find(sound => sound.id === name.slice(4))?.files?.[0];
      if (!file) { onWarning?.(`Sound definition unavailable: ${name}`); return; }
      const sound = await resolveEventSound(desktop.resolveEventResources,file,modelPath);
      if (disposed) return;
      const url = URL.createObjectURL(new Blob([sound.bytes],{type:sound.mime})); urls.add(url); sounds.set(name,url);
    }));
  }).catch(cause => { if (!disposed) onWarning?.(cause.message); }) : Promise.resolve();
  function stop(list = playing) { for (const audio of [...list]) { audio.onended = audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); playing.delete(audio); automatic.delete(audio); } }
  async function play(id, authored = false) {
    const requestedGeneration = generation;
    await ready;
    if (disposed || authored && requestedGeneration !== generation) return;
    const event = events.find(node => node.ObjectId === id), url = sounds.get(event?.Name);
    if (!url) return;
    const audio = new Audio(url); playing.add(audio); if(authored)automatic.add(audio);
    audio.onended = () => stop([audio]);
    audio.onerror = () => { stop([audio]); onWarning?.(`Sound format could not be played: ${event.Name}`); };
    try { await audio.play(); } catch (cause) { stop([audio]); onWarning?.(cause.message); }
  }
  return {
    ready, play, stop:()=>{generation++;stop();},
    update(current, enabled) {
      if (!enabled || !current.playing || current.seek) { generation++; stop(automatic); }
      if (enabled && !current.seek) for (const event of crossedSoundEvents(model,previous,current)) void play(event.ObjectId,true);
      previous = current;
    },
    dispose() { disposed = true; stop(); for (const url of urls) URL.revokeObjectURL(url); urls.clear(); sounds.clear(); },
  };
}
