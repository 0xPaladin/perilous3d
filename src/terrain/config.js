export const TEMPLATE_WATER_LEVELS = {
  island: 0.25,
  archipelago: 0.25,
  bay: 0.03,
  lake: 0.03,
  land: 0.01,
};

export const TERRAIN_STATE_CMDS = {
  wetland:   ['Scale 0.5', 'Rainfall 1.8'],
  lowland:   ['Scale 0.8', 'Rainfall 1.0'],
  woodland:  ['Scale 1.0', 'Rainfall 1.3'],
  highland:  ['Scale 1.5', 'Rainfall 0.8'],
  wasteland: ['Scale 0.6', 'Rainfall 0.4'],
};

export const TEMPLATE_SCRIPTS = {
  island: [
    'Ratio',
    'Hill 5, 0.5, 30-70, 30-70',
    'Hill 5, 0.3, 30-70, 30-70',
    'Hill 5, 1, 30-70, 30-70',
    'Apply',
    'IslandMask',
  ],
  archipelago: [
    'Radius 10',
    'Pit 1, 1, 45-55, 45-55',
    'Apply',
    'Radius 3',
    'Ratio',
    'Pit 5, 2, 25-75, 25-75',
    'Apply',
    'Radius 1',
    'Hill 10, 1, 10-90, 10-90',
    'Apply',
    'IslandMask',
  ],
  bay: [
    'Radius 10',
    'Pit 1, 2, 20-40, 80-100',
    'Pit 1, 2, 40-60, 90-100',
    'Pit 1, 2, 60-80, 80-100',
    'Apply',
    'Radius 1',
    'Ratio',
    'Pit 10, 1, 80-100, 20-80',
  ],
  lake: [
    'Radius 4',
    'Pit 8, 3, 40-60, 40-60',
    'Apply',
  ],
  land: [
    'Ratio',
    'Hill 10, 0.5, 10-90, 10-90',
    'Apply',
  ],
};

// Voronoi-based terrain commands — new pipeline
export const VORONOI_TERRAIN_SCRIPTS = {
  wetland:   ['Land 60 noedge', 'Lake 15, 0.3, neighbors'],
  lowland:   ['Land 70 noedge'],
  woodland:  ['Land 65 noedge', 'Hill 20, 0.4, random', 'Lake 10, 0.2, neighbors'],
  highland:  ['Land 50 noedge', 'Hill 30, 0.7, random', 'Range 50, 0.6, random, random'],
  wasteland: ['Land 40 noedge'],
};

export const VORONOI_TEMPLATE_SCRIPTS = {
  island: [
    'Land 60 noedge',
    'Hill 20, 0.5, random',
    'Range 40, 0.7, random, random',
  ],
  archipelago: [
    'Land 30 noedge',
    'Land 15 noedge',
    'Hill 15, 0.4, random',
  ],
  bay: [
    'Land 50 east',
    'Lake 15, 0.3, neighbors',
    'Hill 10, 0.3, random',
  ],
  lake: [
    'Land 60 noedge',
    'Lake 20, 0.2, neighbors',
  ],
  land: [
    'Land 100',
    'Hill 25, 0.5, random',
    'Range 30, 0.6, random, random',
  ],
};

export const HIGHLANDS_RIDGE = 'Range 1, 0, 20, 100, 40';

export const BIOMES_MATRIX = [
  new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]),
  new Uint8Array([3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10]),
];

export const HABITABILITY = [0, 4, 10, 22, 30, 50, 100, 90, 80, 12, 4, 0, 12];

export const TROUBLE_TYPES = [
  'Ancient Evil',
  'Ancient Fort',
  'Aspiring Warlord',
  'Cult',
  'Cursed Earth',
  'Supernatural Master',
  'Outcasts',
  'Mad Wizard',
  'Magical Gate',
  'Renegades',
  'School of Dark Sorcery',
  "Thieve's Stronghold",
  'Bandit Camp',
  'Bandit Camp',
  'Bandit Camp',
  'Marauders',
  'Marauders',
  'Marauders',
  'Monster Nest',
  'Monster Nest',
  'Monster Nest',
];

export const RESOURCE_TYPES = [
  'game/hide/fur',
  'timber/clay',
  'herb/spice/dye',
  'copper/tin/iron',
  'silver/gold/gems',
  'exotic',
];

export const RESOURCE_BIOME_WEIGHT = {
  'game/hide/fur':    [0, 0, 0, 3, 3, 1, 2, 1, 1, 2, 2, 0, 1],
  'timber/clay':      [0, 0, 0, 1, 1, 2, 3, 2, 3, 2, 0, 0, 1],
  'herb/spice/dye':   [0, 0, 0, 1, 1, 3, 2, 3, 3, 0, 0, 0, 1],
  'copper/tin/iron':  [0, 0, 2, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0],
  'silver/gold/gems': [0, 1, 3, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0],
  'exotic':           [0, 0, 0, 1, 1, 3, 2, 3, 3, 0, 0, 0, 2],
};

export const FEATURE_TERRAIN_TYPES = ['land', 'mountains', 'hills', 'forest', 'river', 'water'];

export const MAGIC_TYPES = [
  'necromancy',
  'evocation/destruction',
  'conjuration/summoning',
  'illusion/glamour',
  'enchantment/artifice',
  'transformation',
  'warding/binding',
  'elemental (roll element)',
  'restoration/healing',
  'divination/scrying',
];

export const ELEMENTS = [
  'void',
  'death/darkness',
  'fire/metal/smoke',
  'earth/stone/vegetation',
  'water/ice/mist',
  'air/wind/storm',
  'life/light',
  'stars/cosmos',
];

export const FACTION_TYPES = [
  'rebel/subversive',
  'criminal/corrupt',
  'immigrant/outsider',
  'industrial/labor',
  'religious/theological',
  'mercantile/trade/guild',
  'martial/mercenary',
  'nationalist/loyalist',
  'academic/arcane',
  { _special: 'combined' },
];

export const PRIMARY_GOALS = [
  'hunt/oppose faction',
  'hunt/oppose creature',
  'spy/sabotage/infiltrate',
  'hold/expand territory',
  'establish outpost/base',
  'locate/exploit resource',
  'map territory',
  'establish/maintain trade',
];

export const CONDITIONS = [
  'failing/shrinking',
  'nascent/incipient',
  'stable/sustained',
  'stable/sustained',
  'successful/expanding',
  'dominating',
];

export const PLACE_NAMES = [
  'Barrier', 'Beach', 'Bowl', 'Camp', 'Cave', 'Circle', 'City', 'Cliff', 'Crater', 'Crossing',
  'Crypt', 'Den', 'Ditch', 'Falls', 'Fence', 'Field', 'Fort', 'Gate', 'Grove', 'Hill',
  'Hole', 'Hut', 'Keep', 'Lake', 'Marsh', 'Meadow', 'Mountain', 'Pit', 'Post', 'Ridge',
  'Ring', 'Rise', 'Road', 'Rock', 'Ruin', 'Shrine', 'Spire', 'Spring', 'Stone', 'Tangle',
  'Temple', 'Throne', 'Tomb', 'Tower', 'Town', 'Tree', 'Vale', 'Valley', 'Village', 'Wall',
  'Barrier', 'Beach', 'Bowl', 'Camp', 'Cave', 'Circle', 'City', 'Cliff', 'Crater', 'Crossing',
  'Crypt', 'Den', 'Ditch', 'Falls', 'Fence', 'Field', 'Fort', 'Gate', 'Grove', 'Hill',
  'Hole', 'Hut', 'Keep', 'Lake', 'Marsh', 'Meadow', 'Mountain', 'Pit', 'Post', 'Ridge',
  'Ring', 'Rise', 'Road', 'Rock', 'Ruin', 'Shrine', 'Spire', 'Spring', 'Stone', 'Tangle',
  'Temple', 'Throne', 'Tomb', 'Tower', 'Town', 'Tree', 'Vale', 'Valley', 'Village', 'Wall',
];

export const PLACE_ADJECTIVES = [
  'Ancient', 'Ashen', 'Black', 'Bloody', 'Blue', 'Bright', 'Broken', 'Burning', 'Clouded', 'Copper',
  'Cracked', 'Dark', 'Dead', 'Doomed', 'Endless', 'Fallen', 'Far', 'Fearsome', 'Floating', 'Forbidden',
  'Frozen', 'Ghostly', 'Gloomy', 'Golden', 'Grim', 'Hidden', 'High', 'Iron', 'Jagged', 'Lonely',
  'Lost', 'Low', 'Near', 'Petrified', 'Red', 'Screaming', 'Sharp', 'Shattered', 'Shifting', 'Shining',
  'Shivering', 'Shrouded', 'Silver', 'Stalwart', 'Stoney', 'Sunken', 'Thorny', 'Thundering', 'White', 'Withered',
  'Ancient', 'Ashen', 'Black', 'Bloody', 'Blue', 'Bright', 'Broken', 'Burning', 'Clouded', 'Copper',
  'Cracked', 'Dark', 'Dead', 'Doomed', 'Endless', 'Fallen', 'Far', 'Fearsome', 'Floating', 'Forbidden',
  'Frozen', 'Ghostly', 'Gloomy', 'Golden', 'Grim', 'Hidden', 'High', 'Iron', 'Jagged', 'Lonely',
  'Lost', 'Low', 'Near', 'Petrified', 'Red', 'Screaming', 'Sharp', 'Shattered', 'Shifting', 'Shining',
  'Shivering', 'Shrouded', 'Silver', 'Stalwart', 'Stoney', 'Sunken', 'Thorny', 'Thundering', 'White', 'Withered',
];

export const PLACE_NOUNS = [
  'Arm', 'Ash', 'Blood', 'Child', 'Cinder', 'Corpse', 'Crystal', 'Dagger', 'Death', 'Demon',
  'Devil', 'Doom', 'Eye', 'Fear', 'Finger', 'Fire', 'Foot', 'Ghost', 'Giant', 'God',
  'Gold', 'Hand', 'Head', 'Heart', 'Hero', 'Hope', 'King', 'Knave', 'Knight', 'Muck',
  'Mud', 'Priest', 'Queen', 'Sailor', 'Silver', 'Skull', 'Smoke', 'Souls', 'Spear', 'Spirit',
  'Stone', 'Sword', 'Thief', 'Troll', 'Warrior', 'Water', 'Witch', 'Wizard',
  'Arm', 'Ash', 'Blood', 'Child', 'Cinder', 'Corpse', 'Crystal', 'Dagger', 'Death', 'Demon',
  'Devil', 'Doom', 'Eye', 'Fear', 'Finger', 'Fire', 'Foot', 'Ghost', 'Giant', 'God',
  'Gold', 'Hand', 'Head', 'Heart', 'Hero', 'Hope', 'King', 'Knave', 'Knight', 'Muck',
  'Mud', 'Priest', 'Queen', 'Sailor', 'Silver', 'Skull', 'Smoke', 'Souls', 'Spear', 'Spirit',
  'Stone', 'Sword', 'Thief', 'Troll', 'Warrior', 'Water', 'Witch', 'Wizard',
];

export const SITE_LAIR_TYPES = [
  'inhabited ruin',
  'inhabited ruin',
  'inhabited cave',
  'den/burrow/hideout',
  'den/burrow/hideout',
  'hive/aerie/nest',
  'hovel/hut/encampment',
  'farmstead/homestead',
];

export const SITE_RUIN_TYPES = [
  'tomb/crypt/necropolis',
  'tomb/crypt/necropolis',
  'shrine/temple',
  'mine/quarry/excavation',
  'shrine/temple',
  'shrine/temple',
  'ancient outpost',
  'ancient settlement',
];

export const SITE_OUTPOST_TYPES = [
  'planar/magical',
  'faction outpost',
  'tollhouse/checkpoint',
  'meeting/trading post',
  'camp/roadhouse/inn',
  'camp/roadhouse/inn',
  'tower/fort/base',
  'tower/fort/base',
];

export const SITE_LANDMARK_TYPES = [
  'oddity-based',
  'plant/tree-based',
  'earth/rock-based',
  'earth/rock-based',
  'water-based',
  'faction-based',
  'megalith/obelisk/statue',
  'magical',
];

export const SITE_RESOURCE_TYPES = [
  'oddity-based',
  'game/hide/fur',
  'timber/clay/stone',
  'timber/clay/stone',
  'herb/spice/dye',
  'copper/tin/iron',
  'silver/gold/gems',
  'magical',
];
