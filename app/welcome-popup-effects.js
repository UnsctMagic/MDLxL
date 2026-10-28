import { UpdatePopupEffects } from '../src/update-popup-effects.js';

const effects = new UpdatePopupEffects();
const helmet = document.getElementById('welcome-update-helmet');
const detach = helmet ? effects.attach(helmet) : () => {};
window.prepareWelcomeEffects = () => effects.ready;
window.startWelcomeEffects = muted => effects.open({ muted });
window.addEventListener('pagehide', () => { effects.close(); detach(); }, { once: true });
