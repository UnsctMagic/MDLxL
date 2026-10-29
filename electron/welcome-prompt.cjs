const fs = require('node:fs');
const path = require('node:path');
const APPLICATION_THEMES = require('../src/application-themes.json');
const { showThemedPrompt, escapeHtml } = require('./themed-prompt.cjs');

// The native Windows message box plays the alert sound and only fits a small
// icon, so the first-launch welcome is a small frameless themed window like the close
// prompt: the big MDLxL icon beside a blue welcome title.
function welcomePromptHtml({ heading, question, detail, note, labels, icon, theme, effectsScript = '', modelLook }) {
  const { colors, scheme } = APPLICATION_THEMES[theme] || APPLICATION_THEMES.light;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
${fs.readFileSync(path.join(__dirname,'../src/update-helmet.css'),'utf8')}
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
.look{margin-top:14px}.choices{display:flex;gap:8px;margin-top:8px}.choices button{flex:1;text-align:left;padding:8px 10px}.choices small{display:block;font-weight:normal;margin-top:4px}.choices [aria-pressed="true"]{border-color:${colors.link};box-shadow:inset 0 0 0 1px ${colors.link};background:${colors.hover}}
.buttons{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
button{-webkit-app-region:no-drag;min-width:110px;min-height:28px;padding:0 14px;font:inherit;border:1px solid ${colors.border};border-radius:2px;background:${colors.field};color:${colors.text};cursor:pointer}
button:hover{background:${colors.hover}}
button:focus-visible{outline:2px solid ${colors.link};outline-offset:2px}
.yes{background:${colors.link};border-color:${colors.link};color:#fff;font-weight:bold}
.yes:hover{background:${colors.link};filter:brightness(1.12)}
</style></head><body>
<div class="row">${icon ? `<span class="update-helmet" id="welcome-update-helmet" aria-hidden="true"><img src="${escapeHtml(icon)}" alt=""><canvas data-helmet="" width="256" height="256"></canvas><canvas data-particles="" width="384" height="384"></canvas></span>` : ''}<div>
<h1>${escapeHtml(heading)}</h1>
<p><b>${escapeHtml(question)}</b></p>
<p class="detail">${escapeHtml(detail)}</p>
<p class="note">${escapeHtml(note)}</p>
</div></div>
${modelLook ? `<div class="look"><p><b>${escapeHtml(modelLook.question)}</b></p><div class="choices"><button type="button" data-look="smooth" aria-pressed="true" autofocus><b>${escapeHtml(modelLook.smooth)}</b><small>${escapeHtml(modelLook.smoothDetail)}</small></button><button type="button" data-look="classic" aria-pressed="false"><b>${escapeHtml(modelLook.classic)}</b><small>${escapeHtml(modelLook.classicDetail)}</small></button></div><p class="detail">${escapeHtml(modelLook.note)}</p></div>` : ''}
<div class="buttons"><button class="yes" data-action="yes" ${modelLook ? '' : 'autofocus'}>${escapeHtml(labels.yes)}</button><button data-action="no">${escapeHtml(labels.no)}</button></div>
<script>
let look='smooth';
for(const button of document.querySelectorAll('[data-look]'))button.onclick=()=>{look=button.dataset.look;for(const choice of document.querySelectorAll('[data-look]'))choice.setAttribute('aria-pressed',String(choice===button));};
const answer=action=>{document.title='mdlxl-welcome:'+action+${modelLook ? "'-'+look" : "''"};};
for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>answer(button.dataset.action);
addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();answer('no');}});
</script><script>${effectsScript.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}

// Resolves yes/no, with a Smooth/Classic suffix on the first run. Closing
// declines auto updates and retains the highlighted Smooth choice.
function showWelcomePrompt(parent, { title, heading, question, detail, note, labels, icon, theme, disableSounds = false, modelLook }) {
  const effectsScript=fs.readFileSync(path.join(__dirname,'../dist/update-popup-effects.js'),'utf8');
  return showThemedPrompt(parent, {
    html: welcomePromptHtml({ heading, question, detail, note, labels, icon, theme, effectsScript, modelLook }), title, theme, width: 520, height: 240,
    prefix: 'mdlxl-welcome', answers: modelLook ? ['yes-smooth', 'yes-classic', 'no-smooth', 'no-classic'] : ['yes', 'no'], fallback: modelLook ? 'no-smooth' : 'no', frame: false, modal: !!parent,
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
  const [updates, look] = answer.split('-');
  return { updateOfferAnswered: true, checkUpdatesOnStartup: updates === 'yes',
    ...(look ? { modelLookAnswered: true, graphics: { antialias: look === 'smooth' } } : {}) };
}

function modelLookStrings(t) {
  return { question: t('How should your models look?'), smooth: t('Smooth'),
    smoothDetail: t('Clean, soft edges. Bones and lines stay sharp.'), classic: t('Classic MDLVis'),
    classicDetail: t('Crisp pixel edges, like the old MDLVis.'), note: t('You can change this any time in Settings → Graphics.') };
}

module.exports = { showWelcomePrompt, welcomePromptHtml, welcomePreferences, modelLookStrings };
