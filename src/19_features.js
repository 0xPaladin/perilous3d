function d(rng, sides) {
  return Math.floor(rng() * sides) + 1;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function rollIndex(rng, sides) {
  return d(rng, sides) - 1;
}

// ---- MAGIC TYPE (DETAILS table) ----
const MAGIC_TYPES = [
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

// ---- ELEMENT (DETAILS table) ----
const ELEMENTS = [
  'void',
  'death/darkness',
  'fire/metal/smoke',
  'earth/stone/vegetation',
  'water/ice/mist',
  'air/wind/storm',
  'life/light',
  'stars/cosmos',
];

// ---- FACTION TYPE ----
const FACTION_TYPES = [
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

// ---- PRIMARY GOAL ----
const PRIMARY_GOALS = [
  'hunt/oppose faction',
  'hunt/oppose creature',
  'spy/sabotage/infiltrate',
  'hold/expand territory',
  'establish outpost/base',
  'locate/exploit resource',
  'map territory',
  'establish/maintain trade',
];

// ---- CONDITION ----
const CONDITIONS = [
  'failing/shrinking',
  'nascent/incipient',
  'stable/sustained',
  'stable/sustained',
  'successful/expanding',
  'dominating',
];

function naturalHazard(rng) {
  const roll = d(rng, 8);
  switch (roll) {
    case 1: return 'oddity-based';
    case 2: return 'tectonic/volcanic';
    case 3: return 'precipitous (chasm, crevasse, abyss, rift)';
    case 4: return 'ensnaring (bog, mire, tarpit, quicksand, etc.)';
    case 5: return 'defensive (trap created by local creature/faction)';
    case 6: return 'meteorological (blizzard, thunderstorm, sandstorm, etc.)';
    case 7: return 'seasonal (fire, flood, avalanche, etc.)';
    case 8: return 'impairing (mist, fog, murk, gloom, miasma, etc.)';
  }
}

function generateHazard(rng) {
  const cat = d(rng, 10);
  if (cat === 1) {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: case 2: case 3: case 4:
        return { category: 'unnatural', type: 'taint/blight/curse' };
      case 5: case 6: {
        const base = naturalHazard(rng);
        return { category: 'unnatural', type: 'magical', base, magic: pick(MAGIC_TYPES, rng) };
      }
      case 7: {
        const base = naturalHazard(rng);
        return { category: 'unnatural', type: 'planar', base, element: pick(ELEMENTS, rng) };
      }
      case 8: {
        const base = naturalHazard(rng);
        return { category: 'unnatural', type: 'divine', base };
      }
    }
  } else {
    return { category: 'natural', type: naturalHazard(rng) };
  }
}

function generateObstacle(rng) {
  const cat = d(rng, 10);
  if (cat === 1) {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: case 2: case 3: case 4: case 5: case 6: {
        return { category: 'unnatural', type: 'magical', magic: pick(MAGIC_TYPES, rng) };
      }
      case 7: {
        return { category: 'unnatural', type: 'planar', element: pick(ELEMENTS, rng) };
      }
      case 8: {
        return { category: 'unnatural', type: 'divine' };
      }
    }
  } else {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: return { category: 'natural', type: 'oddity-based' };
      case 2: return { category: 'natural', type: 'defensive (barrier created by local creature/faction)' };
      case 3: case 4: return { category: 'natural', type: 'impenetrable (cliff, escarpment, crag, bluff, etc.)' };
      case 5: case 6: return { category: 'natural', type: 'penetrable (dense forest/jungle, etc.)' };
      case 7: case 8: return { category: 'natural', type: 'traversable (river, ravine, crevasse, chasm, abyss, etc.)' };
    }
  }
}

function generateArea(rng) {
  const cat = d(rng, 10);
  if (cat === 1) {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: case 2: case 3: case 4: case 5: case 6: {
        return { category: 'unnatural', type: 'magical', magic: pick(MAGIC_TYPES, rng) };
      }
      case 7: {
        return { category: 'unnatural', type: 'planar', element: pick(ELEMENTS, rng) };
      }
      case 8: {
        return { category: 'unnatural', type: 'divine' };
      }
    }
  } else {
    const sub = d(rng, 8);
    switch (sub) {
      case 1: return { category: 'natural', type: 'oddity-based' };
      case 2: return { category: 'natural', type: 'hazard-based (roll hazard, expand its reach)' };
      case 3: case 4: return { category: 'natural', type: 'obstacle-based (roll obstacle, expand its footprint)' };
      case 5: return { category: 'natural', type: 'hunting/gathering ground of local creature' };
      case 6: return { category: 'natural', type: 'claimed as territory by local faction' };
      case 7: case 8: return { category: 'natural', type: 'difficult terrain (icefield, rocky land, dense forest, etc.)' };
    }
  }
}

// ---- RANDOM PLACE name tables (d100) ----
const PLACE_NAMES = [
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

const PLACE_ADJECTIVES = [
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

const PLACE_NOUNS = [
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

function generatePlaceName(rng) {
  const template = d(rng, 12);
  const place = pick(PLACE_NAMES, rng);
  const adj = pick(PLACE_ADJECTIVES, rng);
  const noun = pick(PLACE_NOUNS, rng);
  switch (template) {
    case 1: case 2: return `The ${place}`;
    case 3: case 4: return `The ${adj}${place}`;
    case 5: case 6: return `The ${place} of the ${noun}`;
    case 7: case 8: return `The ${noun}'s ${place}`;
    case 9: case 10: return `${place} of the ${adj}${noun}`;
    case 11: case 12: return `The${adj} ${noun}`;
  }
}

// ---- SITE ----
const SITE_LAIR_TYPES = [
  'inhabited ruin',
  'inhabited ruin',
  'inhabited cave',
  'den/burrow/hideout',
  'den/burrow/hideout',
  'hive/aerie/nest',
  'hovel/hut/encampment',
  'farmstead/homestead',
];

const SITE_RUIN_TYPES = [
  'tomb/crypt/necropolis',
  'tomb/crypt/necropolis',
  'shrine/temple',
  'mine/quarry/excavation',
  'shrine/temple',
  'shrine/temple',
  'ancient outpost',
  'ancient settlement',
];

const SITE_OUTPOST_TYPES = [
  'planar/magical',
  'faction outpost',
  'tollhouse/checkpoint',
  'meeting/trading post',
  'camp/roadhouse/inn',
  'camp/roadhouse/inn',
  'tower/fort/base',
  'tower/fort/base',
];

const SITE_LANDMARK_TYPES = [
  'oddity-based',
  'plant/tree-based',
  'earth/rock-based',
  'earth/rock-based',
  'water-based',
  'faction-based',
  'megalith/obelisk/statue',
  'magical',
];

const SITE_RESOURCE_TYPES = [
  'oddity-based',
  'game/hide/fur',
  'timber/clay/stone',
  'timber/clay/stone',
  'herb/spice/dye',
  'copper/tin/iron',
  'silver/gold/gems',
  'magical',
];

function generateSite(rng) {
  const sub = d(rng, 10);
  if (sub <= 2) {
    return { category: 'dungeon' };
  } else if (sub <= 4) {
    return { category: 'lair/dwelling', type: pick(SITE_LAIR_TYPES, rng) };
  } else if (sub <= 6) {
    return { category: 'ruin', type: pick(SITE_RUIN_TYPES, rng) };
  } else if (sub === 7) {
    return { category: 'outpost', type: pick(SITE_OUTPOST_TYPES, rng) };
  } else if (sub <= 9) {
    return { category: 'landmark', type: pick(SITE_LANDMARK_TYPES, rng) };
  } else {
    return { category: 'resource', type: pick(SITE_RESOURCE_TYPES, rng) };
  }
}

// ---- FACTION PRESENCE ----
function generateFactionPresence(rng) {
  const ft = FACTION_TYPES[rollIndex(rng, 10)];
  let type;
  if (typeof ft === 'object' && ft._special === 'combined') {
    type = `${pick(FACTION_TYPES.slice(0, -1), rng)} + ${pick(FACTION_TYPES.slice(0, -1), rng)}`;
  } else {
    type = ft;
  }
  const goal = pick(PRIMARY_GOALS, rng);
  const condition = pick(CONDITIONS, rng);
  return { type, goal, condition };
}

// ---- CREATURE sub-type (existing) ----
function creatureSubtype(rng) {
  const sub = d(rng, 12);
  if (sub <= 5) {
    const subsub = d(rng, 12);
    let kind;
    if (subsub === 1) kind = 'legendary';
    else if (subsub <= 3) kind = 'extraplanar';
    else if (subsub <= 6) kind = 'undead';
    else kind = 'fearsome';
    return { category: 'monster', kind };
  } else if (sub <= 10) {
    const subsub = d(rng, 12);
    let kind;
    if (subsub <= 2) kind = 'water-going';
    else if (subsub <= 5) kind = 'airborne';
    else kind = 'earthbound';
    return { category: 'beast', kind };
  } else {
    const subsub = d(rng, 12);
    let kind;
    if (subsub <= 2) kind = 'rare';
    else if (subsub <= 5) kind = 'uncommon';
    else kind = 'common';
    return { category: 'humanoid', kind };
  }
}

export { generatePlaceName };

export function generateFeatures(safety, extentSize, rng) {
  const areaRatio = (extentSize / 320) ** 2;
  const numFeatures = Math.max(4, Math.round((8 + 2 * (1 + Math.floor(rng() * 8))) * areaRatio));
  const features = [];
  for (let i = 0; i < numFeatures; i++) {
    const roll = d(rng, 12) + safety;
    let type;
    if (roll <= 4) type = 'creature';
    else if (roll === 5) type = 'hazard';
    else if (roll === 6) type = 'obstacle';
    else if (roll === 7) type = 'area';
    else if (roll === 8) type = 'named place';
    else if (roll <= 11) type = 'site';
    else if (roll === 12) type = 'faction presence';
    else type = 'settlement';

    const feature = { type, roll };
    switch (type) {
      case 'creature':
        feature.subtype = creatureSubtype(rng);
        break;
      case 'hazard':
        feature.hazard = generateHazard(rng);
        break;
      case 'obstacle':
        feature.obstacle = generateObstacle(rng);
        break;
      case 'area':
        feature.area = generateArea(rng);
        break;
      case 'named place':
        feature.name = generatePlaceName(rng);
        break;
      case 'site':
        feature.site = generateSite(rng);
        break;
      case 'faction presence':
        feature.faction = generateFactionPresence(rng);
        break;
    }
    features.push(feature);
  }
  return features;
}
