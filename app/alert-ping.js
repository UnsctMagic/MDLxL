// Every warning line ([role=alert], or [data-alert] on a status line that is showing an error) flashes red once
// and keeps a pulsing red dot (styles.css). CSS starts that when the warning appears; this restarts it when the
// warning's text changes while it stays on screen, so a new warning is never mistaken for the old one.
const WARNING = '[role=alert],[data-alert]';

export function installAlertPing(root = document.body) {
  const restart = element => {
    for (const animation of element.getAnimations({ subtree: true })) {
      if (!animation.animationName?.startsWith('alert-')) continue;
      animation.currentTime = 0; animation.play();
    }
  };
  const observer = new MutationObserver(records => {
    const changed = new Set();
    for (const record of records) {
      const node = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      const warning = node?.closest(WARNING);
      if (warning) changed.add(warning);
    }
    changed.forEach(restart);
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true });
  return () => observer.disconnect();
}
