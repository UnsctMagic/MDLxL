// Warcraft multiplies the sampled texture by the geoset tint. Keep full-colour
// art neutral by default and give the greyscale ember/energy masks their colour.
const native = ['Native colour','#ffffff'];
const frost = ['Frostfire','#55caff'];
const arcane = ['Amethyst','#c58dff'];
const fel = ['Fel green','#8dff68'];
const gold = ['Sun gold','#ffd783'];
const ember = ['Ember red','#ff7645'];
const palettes = {
  native: [native,gold,frost,fel,arcane],
  solar: [['Sun gold','#ffb732'],ember,native,frost],
  copper: [['Hot copper','#ff762c'],gold,ember,native],
  glacier: [['Glacier','#70d6ff'],frost,arcane,native],
  lilac: [['Soul violet','#ad63ff'],frost,fel,native],
  moss: [['Venom','#6cde38'],['Jade','#72e8a9'],gold,native],
  honey: [['Warm light','#ffcd63'],gold,ember,native],
  azure: [['Azure','#519dff'],frost,arcane,native],
  sand: [['Sandstone','#deba94'],native,ember,gold],
  flame: [['Flame gold','#ffe2ad'],native,ember,['Copper','#ffac73']],
  embers: [['Fire Lord orange','#ff3600'],gold,frost,fel,arcane,native],
  arcane: [['Azure','#70b3ff'],arcane,gold,fel,native],
  gold: [gold,native,ember,arcane],
  ice: [native,['Glacier','#9de8ff'],arcane,['Deep blue','#7fa8ff']],
  venom: [native,['Acid lime','#d1ff65'],['Viridian','#75e4b4'],['Moss','#b6ce71']],
};
export const surfacePalette = effect => palettes[effect.palette || 'native'];
export const tintFromHex = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export const hexFromTint = tint => '#'+tint.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
