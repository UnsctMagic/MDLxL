// A dark western-fantasy fanfare made on the spot, so no sound file ships with
// the app: a timpani boom and low strings under a solemn three-note horn call,
// all in a large stone hall.
export function playUpdateChime({audio=new AudioContext(),startAt}={}){
  const t=startAt??audio.currentTime+.05,out=audio.createGain(),dry=audio.createGain(),wet=audio.createGain(),hall=audio.createConvolver(),dark=audio.createBiquadFilter();
  const seconds=3.6,impulse=audio.createBuffer(2,audio.sampleRate*seconds,audio.sampleRate);
  for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2.5);}
  hall.buffer=impulse;dark.type='lowpass';dark.frequency.value=2200;out.gain.value=.5;dry.gain.value=.6;wet.gain.value=.6;
  dry.connect(out);hall.connect(dark).connect(wet).connect(out);out.connect(audio.destination);
  const send=node=>{node.connect(dry);node.connect(hall);};
  // Timpani: a pitched thud plus a short muffled skin noise.
  const timpani=(at,f,level)=>{
    const tone=audio.createOscillator(),gain=audio.createGain();tone.frequency.setValueAtTime(f*1.5,at);tone.frequency.exponentialRampToValueAtTime(f,at+.08);
    gain.gain.setValueAtTime(level,at);gain.gain.exponentialRampToValueAtTime(.001,at+1.6);send(tone.connect(gain));tone.start(at);tone.stop(at+1.7);
    const noise=audio.createBufferSource(),buffer=audio.createBuffer(1,audio.sampleRate*.3,audio.sampleRate),d=buffer.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
    const low=audio.createBiquadFilter(),ng=audio.createGain();low.type='lowpass';low.frequency.value=400;ng.gain.value=level*.6;
    noise.buffer=buffer;send(noise.connect(low).connect(ng));noise.start(at);
  };
  // Brass or strings: detuned saws through a lowpass that opens as the note swells.
  const voice=(f,at,length,level,attack,bright,detunes=[-6,6])=>{
    const filter=audio.createBiquadFilter(),gain=audio.createGain();filter.type='lowpass';filter.Q.value=1.5;
    filter.frequency.setValueAtTime(bright*.35,at);filter.frequency.linearRampToValueAtTime(bright,at+attack*1.5);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+attack);gain.gain.setValueAtTime(level,at+length*.6);gain.gain.exponentialRampToValueAtTime(.0008,at+length);
    send(filter.connect(gain));
    for(const detune of detunes){const tone=audio.createOscillator(),vib=audio.createOscillator(),depth=audio.createGain();
      tone.type='sawtooth';tone.frequency.value=f;tone.detune.value=detune;vib.frequency.value=5;depth.gain.value=f*.004;
      vib.connect(depth).connect(tone.frequency);tone.connect(filter);tone.start(at);vib.start(at);tone.stop(at+length+.05);vib.stop(at+length+.05);}
  };
  // Low strings hold D under everything.
  voice(73.42,t,3.4,.11,.5,700);voice(110,t,3.4,.07,.5,700);
  timpani(t,73.42,.55);
  // Horn call: three heavy notes, D, A and the high D, the last one ringing out.
  [[146.83,0,.42],[220,.42,.42],[293.66,.84,1.6]].forEach(([f,at,length])=>voice(f,t+at,length+.25,.09,.06,1200));
  const timer=setTimeout(()=>audio.close(),8000);
  return ()=>{clearTimeout(timer);if(audio.state!=='closed')void audio.close();};
}
