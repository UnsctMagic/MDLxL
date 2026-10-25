/** The owner's lessons for SD Brain: corrections of real results, read by the art director and the
 * builder on every request. The review checks them in src/sd-lessons.js. Kept free of imports so the
 * prompts can carry them without loading the knowledge pack. */
export const SD_LESSONS = [
  { id: 'keep-face', rule: "Never remove, cut out or cover the unit's face. A helmet, mask or hood fits around the face, which stays whole and visible.", why: 'Owner, on a Footman whose face was cut out for a helmet: "he cut out the face of the footman he cant do that."' },
  { id: 'head-gear-size', rule: "Helmets, horns, crests and masks stay close to the head's own outline from every side: about one and a half head widths at most, front to back as well as side to side.", why: 'Owner, on a Grunt with Thrall\'s head, a reshaped helm and Muradin\'s horns: "way too wide and stupid."' },
  { id: 'no-inflating', rule: 'Do not stretch a small Blizzard part into a much larger new shape (a 14-triangle sword into a cleaver, a 9-triangle shield into a big kite). Choose a part that is already close in size and shape, or build the shape new following the craft.', why: 'The brutal sword reshaped from the Doom Guard\'s sword: "total failure... not a sword."' },
  { id: 'combine-intact', rule: 'Real parts combined nearly whole, with small additions, work: the Grunt\'s haft with Gorehowl\'s head; the Captain\'s helm with the Necromancer\'s horns.', why: 'Owner: orc axe "good", helmet with horns "nice".' },
  { id: 'real-kitbash', rule: 'A new unit or kitbash must transform its base: replace or rebuild the gear, repaint body pieces from palette areas, reshape the silhouette, add trims and points. A Blizzard unit with one or two parts added is not a kitbash; it must not still read as the Death Knight, the Footman or the Grunt.', why: 'The undead knight left 93% of the Death Knight untouched; the Nurgle knight "just took a knight and kind of put stuff on it... a shit kitbash".' },
  { id: 'bitz-allowed', rule: "The owner's BITZ parts may be used.", why: 'Owner: "its okay if it used my bits!"' },
  { id: 'no-weapon-team', rule: 'No team colour on weapons unless the request asks for it.', why: 'Owner: team colour is a design choice, not part of general weapon making.' },
  { id: 'check-base', rule: 'Look at a base model before building on it; names mislead (the game\'s "Orc Warlord" file is the mounted Chaos Warlord).', why: 'The orc warlord started from a wolf rider.' },
  { id: 'base-fits-props', rule: 'Choose a base whose animations already do what the new unit does: a staff caster starts from a unit that holds a staff (the Human Mage, Medivh), a shield bearer from one that carries a shield. Never put a held weapon in hands animated for something else (the Blood Mage casts with floating orbs; the Dreadlord fights with claws).', why: 'Owner, on a necromancer built on the Blood Mage: "it wont fit with the blood animations, he doesnt hold a staff he has floating orbs."' },
  { id: 'preview-paint', rule: 'Preview every texture area before using it and choose by what the pixels show.', why: 'The banded AxeBladeBlueSteel strip was chosen three times without looking.' },
  { id: 'review-honestly', rule: 'Judge the result next to the model it started from and against these lessons. Your own review passed results the owner rejected; a result that fails a lesson check is not finished.', why: 'Six of eight gallery results passed the AI review; the owner rejected most of them.' },
];

/** The lessons as instructions, with any the owner added in the chat. */
export function lessonsText(owner = []) {
  const shipped = SD_LESSONS.map((l, i) => `${i + 1}. ${l.rule} (${l.why})`).join('\n');
  const own = owner.filter(l => l?.rule).map((l, i) => `${SD_LESSONS.length + i + 1}. ${l.rule}${l.owner ? ` (owner: "${l.owner}")` : ''}`).join('\n');
  return `The owner's lessons from reviewing real results. Follow every one; the review checks them:\n${shipped}${own ? '\n' + own : ''}`;
}
