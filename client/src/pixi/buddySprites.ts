/** Buddy sprite data from Claude Code companion system. */

export type BuddySpecies =
  | 'duck' | 'goose' | 'blob' | 'cat' | 'dragon' | 'octopus'
  | 'owl' | 'penguin' | 'turtle' | 'snail' | 'ghost' | 'axolotl'
  | 'capybara' | 'cactus' | 'robot' | 'rabbit' | 'mushroom' | 'chonk';

export const BUDDY_SPECIES: BuddySpecies[] = [
  'duck', 'goose', 'blob', 'cat', 'dragon', 'octopus',
  'owl', 'penguin', 'turtle', 'snail', 'ghost', 'axolotl',
  'capybara', 'cactus', 'robot', 'rabbit', 'mushroom', 'chonk',
];

/** 3 animation frames per species, each frame is an array of lines (5 rows x 12 chars). */
export const BUDDY_BODIES: Record<BuddySpecies, string[][]> = {
  duck: [
    ['    __      ', '  <(\u00b7 )___  ', '   (  ._>   ', '    `--\u00b4    '],
    ['    __      ', '  <(\u00b7 )___  ', '   (  ._>   ', '    `--\u00b4~   '],
    ['    __      ', '  <(\u00b7 )___  ', '   (  .__>  ', '    `--\u00b4    '],
  ],
  goose: [
    ['     (\u00b7>    ', '     ||     ', '   _(__)_   ', '    ^^^^    '],
    ['    (\u00b7>     ', '     ||     ', '   _(__)_   ', '    ^^^^    '],
    ['     (\u00b7>>   ', '     ||     ', '   _(__)_   ', '    ^^^^    '],
  ],
  blob: [
    ['   .----.   ', '  ( \u00b7  \u00b7 )  ', '  (      )  ', '   `----\u00b4   '],
    ['  .------.  ', ' (  \u00b7  \u00b7  ) ', ' (        ) ', '  `------\u00b4  '],
    ['    .--.    ', '   (\u00b7  \u00b7)   ', '   (    )   ', '    `--\u00b4    '],
  ],
  cat: [
    ['   /\\_/\\    ', '  ( \u00b7   \u00b7)  ', '  (  \u03c9  )   ', '  (")_(")   '],
    ['   /\\_/\\    ', '  ( \u00b7   \u00b7)  ', '  (  \u03c9  )   ', '  (")_(")~  '],
    ['   /\\-/\\    ', '  ( \u00b7   \u00b7)  ', '  (  \u03c9  )   ', '  (")_(")   '],
  ],
  dragon: [
    ['  /^\\  /^\\  ', ' <  \u00b7  \u00b7  > ', ' (   ~~   ) ', '  `-vvvv-\u00b4  '],
    ['  /^\\  /^\\  ', ' <  \u00b7  \u00b7  > ', ' (        ) ', '  `-vvvv-\u00b4  '],
    ['  /^\\  /^\\  ', ' <  \u00b7  \u00b7  > ', ' (   ~~   ) ', '  `-vvvv-\u00b4  '],
  ],
  octopus: [
    ['   .----.   ', '  ( \u00b7  \u00b7 )  ', '  (______)  ', '  /\\/\\/\\/\\  '],
    ['   .----.   ', '  ( \u00b7  \u00b7 )  ', '  (______)  ', '  \\/\\/\\/\\/  '],
    ['   .----.   ', '  ( \u00b7  \u00b7 )  ', '  (______)  ', '  /\\/\\/\\/\\  '],
  ],
  owl: [
    ['   /\\  /\\   ', '  ((\u00b7)(\u00b7))  ', '  (  ><  )  ', '   `----\u00b4   '],
    ['   /\\  /\\   ', '  ((\u00b7)(\u00b7))  ', '  (  ><  )  ', '   .----.   '],
    ['   /\\  /\\   ', '  ((\u00b7)(-))  ', '  (  ><  )  ', '   `----\u00b4   '],
  ],
  penguin: [
    ['  .---.     ', '  (\u00b7>\u00b7)     ', ' /(   )\\    ', '  `---\u00b4     '],
    ['  .---.     ', '  (\u00b7>\u00b7)     ', ' |(   )|    ', '  `---\u00b4     '],
    ['  .---.     ', '  (\u00b7>\u00b7)     ', ' /(   )\\    ', '  `---\u00b4     '],
  ],
  turtle: [
    ['   _,--._   ', '  ( \u00b7  \u00b7 )  ', ' /[______]\\ ', '  ``    ``  '],
    ['   _,--._   ', '  ( \u00b7  \u00b7 )  ', ' /[______]\\ ', '   ``  ``   '],
    ['   _,--._   ', '  ( \u00b7  \u00b7 )  ', ' /[======]\\ ', '  ``    ``  '],
  ],
  snail: [
    [' \u00b7    .--.  ', '  \\  ( @ )  ', '   \\_`--\u00b4   ', '  ~~~~~~~   '],
    ['  \u00b7   .--.  ', '  |  ( @ )  ', '   \\_`--\u00b4   ', '  ~~~~~~~   '],
    [' \u00b7    .--.  ', '  \\  ( @  ) ', '   \\_`--\u00b4   ', '   ~~~~~~   '],
  ],
  ghost: [
    ['   .----.   ', '  / \u00b7  \u00b7 \\  ', '  |      |  ', '  ~`~``~`~  '],
    ['   .----.   ', '  / \u00b7  \u00b7 \\  ', '  |      |  ', '  `~`~~`~`  '],
    ['   .----.   ', '  / \u00b7  \u00b7 \\  ', '  |      |  ', '  ~~`~~`~~  '],
  ],
  axolotl: [
    ['}~(______)~{', '}~(\u00b7 .. \u00b7)~{', '  ( .--. )  ', '  (_/  \\_)  '],
    ['~}(______){~', '~}(\u00b7 .. \u00b7){~', '  ( .--. )  ', '  (_/  \\_)  '],
    ['}~(______)~{', '}~(\u00b7 .. \u00b7)~{', '  (  --  )  ', '  ~_/  \\_~  '],
  ],
  capybara: [
    ['  n______n  ', ' ( \u00b7    \u00b7 ) ', ' (   oo   ) ', '  `------\u00b4  '],
    ['  n______n  ', ' ( \u00b7    \u00b7 ) ', ' (   Oo   ) ', '  `------\u00b4  '],
    ['  u______n  ', ' ( \u00b7    \u00b7 ) ', ' (   oo   ) ', '  `------\u00b4  '],
  ],
  cactus: [
    [' n  ____  n ', ' | |\u00b7  \u00b7| | ', ' |_|    |_| ', '   |    |   '],
    ['    ____    ', ' n |\u00b7  \u00b7| n ', ' |_|    |_| ', '   |    |   '],
    [' n  ____  n ', ' | |\u00b7  \u00b7| | ', ' |_|    |_| ', '   |    |   '],
  ],
  robot: [
    ['   .[||].   ', '  [ \u00b7  \u00b7 ]  ', '  [ ==== ]  ', '  `------\u00b4  '],
    ['   .[||].   ', '  [ \u00b7  \u00b7 ]  ', '  [ -==- ]  ', '  `------\u00b4  '],
    ['   .[||].   ', '  [ \u00b7  \u00b7 ]  ', '  [ ==== ]  ', '  `------\u00b4  '],
  ],
  rabbit: [
    ['   (\\__/)   ', '  ( \u00b7  \u00b7 )  ', ' =(  ..  )= ', '  (")__(")  '],
    ['   (|__/)   ', '  ( \u00b7  \u00b7 )  ', ' =(  ..  )= ', '  (")__(")  '],
    ['   (\\__/)   ', '  ( \u00b7  \u00b7 )  ', ' =( .  . )= ', '  (")__(")  '],
  ],
  mushroom: [
    [' .-o-OO-o-. ', '(__________)', '   |\u00b7  \u00b7|   ', '   |____|   '],
    [' .-O-oo-O-. ', '(__________)', '   |\u00b7  \u00b7|   ', '   |____|   '],
    [' .-o-OO-o-. ', '(__________)', '   |\u00b7  \u00b7|   ', '   |____|   '],
  ],
  chonk: [
    ['  /\\    /\\  ', ' ( \u00b7    \u00b7 ) ', ' (   ..   ) ', '  `------\u00b4  '],
    ['  /\\    /|  ', ' ( \u00b7    \u00b7 ) ', ' (   ..   ) ', '  `------\u00b4  '],
    ['  /\\    /\\  ', ' ( \u00b7    \u00b7 ) ', ' (   ..   ) ', '  `------\u00b4~ '],
  ],
};

export type BuddyRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const BUDDY_RARITIES: { name: BuddyRarity; color: string; hex: number }[] = [
  { name: 'common',    color: 'rgb(120,120,150)', hex: 0x787896 },
  { name: 'uncommon',  color: 'rgb(80,200,120)',  hex: 0x50c878 },
  { name: 'rare',      color: 'rgb(100,149,237)', hex: 0x6495ed },
  { name: 'epic',      color: 'rgb(200,120,255)', hex: 0xc878ff },
  { name: 'legendary', color: 'rgb(255,200,60)',  hex: 0xffc83c },
];

const STORAGE_KEY = 'clawd-buddy-species';
const RARITY_KEY = 'clawd-buddy-rarity';

export function loadBuddySpecies(): BuddySpecies {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && BUDDY_SPECIES.includes(saved as BuddySpecies)) {
      return saved as BuddySpecies;
    }
  } catch { /* ignore */ }
  return 'snail';
}

export function saveBuddySpecies(species: BuddySpecies): void {
  try {
    localStorage.setItem(STORAGE_KEY, species);
  } catch { /* ignore */ }
}

export function loadBuddyRarity(): BuddyRarity {
  try {
    const saved = localStorage.getItem(RARITY_KEY);
    if (saved && BUDDY_RARITIES.some((r) => r.name === saved)) {
      return saved as BuddyRarity;
    }
  } catch { /* ignore */ }
  return 'uncommon';
}

export function saveBuddyRarity(rarity: BuddyRarity): void {
  try {
    localStorage.setItem(RARITY_KEY, rarity);
  } catch { /* ignore */ }
}
