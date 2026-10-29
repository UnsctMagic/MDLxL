// "Painting / art" in the texture library means real illustrations: loading
// screens, campaign key art, score-screen victory paintings and menu paintings.
// Skins, terrain, icons, UI frames and the rendered profile portraits
// (webui\portraits, 3D renders rather than paintings) are not included.
// Paths were checked against the installed 3.0.1 game files (classic and Reforged).
import { gamePathKey } from './game-path.js';
const ART_PATHS = [
  /^ui\\glues\\loading\\backgrounds\\(?!.*(?:locationicons|symbol))/,      // classic loading screens and campaign maps, not their map icons
  /^webui\\loadingscreen\\(?!.*(?:frame|piece|fill|lineart|crest|bar))/,   // Reforged loading screens, not their frames
  /^webui\\campaign\\campaignselect\\backgrounds\\/,                       // campaign key art
  /^webui\\backgrounds\\(?!.*(?:ultrawide|frame|endcap))/,                // menu and splash backgrounds
  /^webui\\expansions\\backgrounds\\/,
  /^webui\\blizzcon\\/,
  /^webui\\common\\homescreen\./,
  /^webui\\campaign\\(?:victoryscreen\\)?wc3_victoryscreen_banner/,
  /^webui\\campaign\\definitive-banner\./,
  /^ui\\glues\\scorescreen\\scorescreen-(?:(?:human|orc|undead|nightelf)victory|defeat|background)/,
  /keyart|_concept|concept\d|splashscreen|interstitial/,
  /^ui\\console\\[a-z]+\\(?:humanuitile-timeindicator|day-indicator-texture)\./, // painted sun and moon dial
];
const ART_WORDS = ['painting', 'paintings', 'painted art', 'art', 'artwork', 'artworks', 'illustration', 'illustrations', 'drawing', 'drawings', 'concept art', 'key art', 'keyart', 'loading screen', 'loading screens'];

/** Whether a native texture path (with or without its CASC module prefix) is a work of art. */
export function isArtworkPath(sourcePath, annotation = null) {
  const logical = gamePathKey(sourcePath).split(':').at(-1);
  if (ART_PATHS.some(rule => rule.test(logical))) return true;
  // Reviewed catalog entries tagged as painted artwork; photographs and logos are not paintings.
  return !!annotation?.tags?.includes('artwork') && /paint|illustrat|concept/i.test(annotation.notes || '') && !/photograph|logo/i.test(annotation.notes || '');
}

/** Removes an art phrase from a search; returns null when the query does not ask for art. */
export function artworkQuery(query) {
  const text = ' ' + String(query || '').toLowerCase().replace(/[/_-]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  for (const phrase of [...ART_WORDS].sort((a, b) => b.length - a.length)) {
    // With other words, "art" is usually a name fragment ("art clo", "undead art" for Arthas),
    // so it means artwork only on its own; "orc painting" combines.
    const at = phrase === 'art' ? (text === ' art ' ? 0 : -1) : text.indexOf(' ' + phrase + ' ');
    if (at >= 0) return (text.slice(0, at) + ' ' + text.slice(at + phrase.length + 1)).replace(/\s+/g, ' ').trim();
  }
  return null;
}
