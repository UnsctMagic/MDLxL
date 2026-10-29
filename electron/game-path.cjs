// CommonJS twin of src/game-path.js (the Electron side cannot import the ESM module).
const gamePathKey = value => String(value || '').replaceAll('/', '\\').toLowerCase();

module.exports = { gamePathKey };
