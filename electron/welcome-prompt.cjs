const APPLICATION_THEMES = require('../src/application-themes.json');

const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// The native Windows message box plays the alert sound and only fits a small
// icon, so the first-launch welcome is a small frameless themed window like the close
// prompt: the big MDLxL icon beside a blue welcome title.
function welcomePromptHtml({ heading, question, detail, note, labels, icon, theme }) {
  const { colors, scheme } = APPLICATION_THEMES[theme] || APPLICATION_THEMES.light;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
:root{color-scheme:${scheme}}
*{box-sizing:border-box}
html{border:1px solid ${colors.border};height:100%}
body{margin:0;padding:18px 20px 18px;font:12px/1.45 Tahoma,Verdana,"Segoe UI",sans-serif;background:${colors.panel};color:${colors.text};user-select:none;-webkit-app-region:drag}
.row{display:flex;gap:18px;align-items:flex-start}
img{width:96px;height:96px;flex:none}
h1{margin:2px 0 10px;font-size:22px;font-weight:normal;color:${colors.link}}
p{margin:0 0 6px;overflow-wrap:anywhere}
.detail{color:${colors.muted}}
.note{margin-top:14px;color:${colors.muted}}
.buttons{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
button{-webkit-app-region:no-drag;min-width:110px;min-height:28px;padding:0 14px;font:inherit;border:1px solid ${colors.border};border-radius:2px;background:${colors.field};color:${colors.text};cursor:pointer}
button:hover{background:${colors.hover}}
button:focus-visible{outline:2px solid ${colors.link};outline-offset:2px}
.yes{background:${colors.link};border-color:${colors.link};color:#fff;font-weight:bold}
.yes:hover{background:${colors.link};filter:brightness(1.12)}
</style></head><body>
<div class="row">${icon ? `<img src="${escapeHtml(icon)}" alt="">` : ''}<div>
<h1>${escapeHtml(heading)}</h1>
<p><b>${escapeHtml(question)}</b></p>
<p class="detail">${escapeHtml(detail)}</p>
<p class="note">${escapeHtml(note)}</p>
</div></div>
<div class="buttons"><button class="yes" data-action="yes" autofocus>${escapeHtml(labels.yes)}</button><button data-action="no">${escapeHtml(labels.no)}</button></div>
<script>
for(const button of document.querySelectorAll('button'))button.onclick=()=>{document.title='mdlxl-welcome:'+button.dataset.action;};
addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();document.title='mdlxl-welcome:no';}});
// A dark western-fantasy fanfare made on the spot, so no sound file ships with
// the app: a timpani boom and low strings under a solemn three-note horn call,
// all in a large stone hall.
function chime(){
  const audio=new AudioContext(),t=audio.currentTime+.05,out=audio.createGain(),dry=audio.createGain(),wet=audio.createGain(),hall=audio.createConvolver(),dark=audio.createBiquadFilter();
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
}
</script></body></html>`;
}

// Resolves 'yes' or 'no'. Closing the window itself counts as no.
function showWelcomePrompt(parent, { title, heading, question, detail, note, labels, icon, theme }) {
  // Loaded on use so main.cjs stays loadable where Electron is stubbed or absent.
  const { BrowserWindow } = require('electron');
  const width = 520;
  return new Promise(resolve => {
    const prompt = new BrowserWindow({
      parent, modal: !!parent, show: false, frame: false, width, height: 240, useContentSize: true, title,
      resizable: false, minimizable: false, maximizable: false, fullscreenable: false, autoHideMenuBar: true,
      backgroundColor: (APPLICATION_THEMES[theme] || APPLICATION_THEMES.light).colors.panel,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, autoplayPolicy: 'no-user-gesture-required' },
    });
    let answer = 'no';
    prompt.setMenu(null);
    prompt.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    prompt.webContents.on('will-navigate', event => event.preventDefault());
    // Buttons report through the page title; the window keeps its own title.
    prompt.on('page-title-updated', (event, pageTitle) => {
      event.preventDefault();
      const action = /^mdlxl-welcome:(yes|no)$/.exec(pageTitle)?.[1];
      if (action && !prompt.isDestroyed()) { answer = action; prompt.close(); }
    });
    prompt.webContents.once('did-finish-load', async () => {
      try {
        const height = await prompt.webContents.executeJavaScript('document.documentElement.scrollHeight');
        if (!prompt.isDestroyed()) prompt.setContentSize(width, Math.min(600, Math.ceil(height)));
      } catch {}
      if (!prompt.isDestroyed() && process.env.MDLVIS_HEADLESS !== '1') { prompt.show(); prompt.webContents.focus(); prompt.webContents.executeJavaScript('chime()').catch(() => {}); }
    });
    prompt.on('closed', () => resolve(answer));
    prompt.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(welcomePromptHtml({ heading, question, detail, note, labels, icon, theme })));
  });
}

module.exports = { showWelcomePrompt, welcomePromptHtml };
