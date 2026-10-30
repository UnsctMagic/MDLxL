const fs = require('node:fs');
const path = require('node:path');
const APPLICATION_THEMES = require('../src/application-themes.json');
const { showThemedPrompt, escapeHtml } = require('./themed-prompt.cjs');

// The native Windows message box plays the alert sound and only fits a small
// icon, so the first-launch welcome is a small frameless themed window like the close
// prompt: the big MDLxL icon beside a blue welcome title.
// The heading shows the LowPolyWorks MDLxL wordmark image (captured from the site) in place of the word.
function wordmark(html) {
  for (const file of ['../dist/branding/mdlxl-wordmark.png', '../public/branding/mdlxl-wordmark.png']) {
    try { return html.replace('MDLxL', `<img class="wordmark" src="data:image/png;base64,${fs.readFileSync(path.join(__dirname, file)).toString('base64')}" alt="MDLxL">`); } catch {}
  }
  return html;
}

function welcomePromptHtml({ heading, question, detail, note, labels, icon, theme, effectsScript = '', modelLook, disableSounds = false }) {
  const { colors, scheme } = APPLICATION_THEMES[theme] || APPLICATION_THEMES.light;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
${fs.readFileSync(path.join(__dirname,'../src/update-helmet.css'),'utf8')}
:root{color-scheme:${scheme}}
.wordmark{height:24px;width:auto;vertical-align:-3px;margin-left:0;filter:contrast(1.18) brightness(1.04)}
*{box-sizing:border-box}
html{border:1px solid ${colors.border};height:100%}
body{margin:0;padding:18px 20px 18px;font:12px/1.45 Tahoma,Verdana,"Segoe UI",sans-serif;background:${colors.panel};color:${colors.text};user-select:none;-webkit-app-region:drag}
.row{display:flex;gap:18px;align-items:flex-start}
img{width:96px;height:96px;flex:none}
h1{margin:2px 0 10px;font-size:22px;font-weight:normal;color:${colors.link}}
p{margin:0 0 6px;overflow-wrap:anywhere}
.detail{color:${colors.muted}}
.note{margin-top:14px;color:${colors.muted}}
.look{margin-top:14px}.choices{display:flex;gap:8px;margin-top:8px}.choices button{flex:none}.choices [aria-pressed="true"]{border-color:${colors.link};box-shadow:inset 0 0 0 1px ${colors.link};background:${colors.hover}}
.buttons{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:18px}.sound{margin-right:auto;display:flex;align-items:center;gap:5px;color:${colors.muted};-webkit-app-region:no-drag;cursor:pointer}
button{-webkit-app-region:no-drag;min-width:110px;min-height:28px;padding:0 14px;font:inherit;border:1px solid ${colors.border};border-radius:2px;background:${colors.field};color:${colors.text};cursor:pointer}
button:hover{background:${colors.hover}}
button:focus-visible{outline:2px solid ${colors.link};outline-offset:2px}
.yes{background:${colors.link};border-color:${colors.link};color:#fff;font-weight:bold}
.yes:hover{background:${colors.link};filter:brightness(1.06)}
</style></head><body>
<div class="row">${icon ? `<span class="update-helmet" id="welcome-update-helmet" aria-hidden="true"><img src="${escapeHtml(icon)}" alt=""><canvas data-helmet="" width="256" height="256"></canvas><canvas data-particles="" width="384" height="384"></canvas></span>` : ''}<div>
<h1>${wordmark(escapeHtml(heading))}</h1>
<p><b>${escapeHtml(question)}</b></p>
<p class="detail">${escapeHtml(detail)}</p>
<p class="note">${escapeHtml(note)}</p>
</div></div>
${modelLook ? `<div class="look"><p><b>${escapeHtml(modelLook.question)}</b></p><div class="choices"><button type="button" data-look="smooth" aria-pressed="true" autofocus title="${escapeHtml(modelLook.smoothDetail)}">${escapeHtml(modelLook.smooth)}</button><button type="button" data-look="classic" aria-pressed="false" title="${escapeHtml(modelLook.classicDetail)}">${escapeHtml(modelLook.classic)}</button></div><p class="detail">${escapeHtml(modelLook.note)}</p></div>` : ''}
<div class="buttons"><label class="sound"><input type="checkbox" data-sound ${disableSounds ? 'checked' : ''}>${escapeHtml(labels.sounds || 'Disable sounds')}</label><button class="yes" data-action="yes" ${modelLook ? '' : 'autofocus'}>${escapeHtml(labels.yes)}</button><button data-action="no">${escapeHtml(labels.no)}</button></div>
<script>
let look='smooth';
for(const button of document.querySelectorAll('[data-look]'))button.onclick=()=>{look=button.dataset.look;for(const choice of document.querySelectorAll('[data-look]'))choice.setAttribute('aria-pressed',String(choice===button));};
const sound=document.querySelector('[data-sound]');
// Disable sounds mutes at once and is saved with the answer, like the update popup.
sound.onchange=()=>window.setWelcomeMuted?.(sound.checked);
const answer=action=>{document.title='mdlxl-welcome:'+action+${modelLook ? "'-'+look" : "''"}+(sound.checked?'-mute':'-sound');};
for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>answer(button.dataset.action);
addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();answer('no');}});
</script><script>${effectsScript.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}

// Resolves yes/no, with a Smooth/Classic suffix on the first run. Closing
// declines auto updates and retains the highlighted Smooth choice.
function showWelcomePrompt(parent, { title, heading, question, detail, note, labels, icon, theme, disableSounds = false, modelLook }) {
  const effectsScript=fs.readFileSync(path.join(__dirname,'../dist/update-popup-effects.js'),'utf8');
  return showThemedPrompt(parent, {
    html: welcomePromptHtml({ heading, question, detail, note, labels, icon, theme, effectsScript, modelLook, disableSounds }), title, theme, width: 520, height: 240,
    prefix: 'mdlxl-welcome', answers: (modelLook ? ['yes-smooth', 'yes-classic', 'no-smooth', 'no-classic'] : ['yes', 'no']).flatMap(a => [a + '-sound', a + '-mute']), fallback: (modelLook ? 'no-smooth' : 'no') + (disableSounds ? '-mute' : '-sound'), frame: false, modal: !!parent,
    webPreferences: { autoplayPolicy: 'no-user-gesture-required' },
    onLoaded: async prompt => {
      try {
        await prompt.webContents.executeJavaScript('window.prepareWelcomeEffects?.()');
      } catch (error) { console.warn('Welcome effects unavailable.', error); }
    },
    onShown: prompt => prompt.webContents.executeJavaScript(`requestAnimationFrame(()=>window.startWelcomeEffects?.(${!!disableSounds}))`).catch(error=>console.error(error)),
  });
}

// Shared by the first-run caller and persistence tests. Existing users receive
// only the update question, so their saved graphics choice is never overwritten.
function welcomePreferences(answer) {
  const parts = answer.split('-'), sound = ['sound', 'mute'].includes(parts.at(-1)) ? parts.pop() : null, [updates, look] = parts;
  return { updateOfferAnswered: true, checkUpdatesOnStartup: updates === 'yes',
    ...(look ? { modelLookAnswered: true, graphics: { antialias: look === 'smooth' } } : {}),
    ...(sound ? { disableSounds: sound === 'mute' } : {}) };
}

function modelLookStrings(t) {
  return { question: t('How should your models look?'), smooth: t('Smooth'),
    smoothDetail: t('Clean, soft edges. Bones and lines stay sharp.'), classic: t('Classic MDLVis'),
    classicDetail: t('Crisp pixel edges, like the old MDLVis.'), note: t('You can change this any time in Settings → Graphics.') };
}

module.exports = { showWelcomePrompt, welcomePromptHtml, welcomePreferences, modelLookStrings };
