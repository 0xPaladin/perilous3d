import { mulberry32 } from "../core/prng.js";

const PEOPLES = {
  Marine: "Water,Storm,Plains,Time/4,2,1,0.5",
  Desert: "Fire,Storm,Time,Plains,Mountain/3,1,0.5,2,2",
  Plains: "Fire,Water,Plains,Forest,Storm,Frost,Time/1,1,3,1,2,1,0.5",
  Forest: "Water,Mountain,Forest,Storm,Frost,Time/2,1,3,2,1,0.5",
  Cold: "Mountain,Plains,Forest,Storm,Frost,Time/2,1,1,1,3,0.5",
  Wetland: "Water,Forest,Storm,Time/3,2,1,1",
};

const BODY_CATEGORIES = ["Humanoid", "Animal", "Artificial", "Alien"];
const BODY_CATEGORY_WEIGHTS = [55, 15, 20, 10];

const BODY_SUBTYPES = {
  Humanoid: {
    items: ["Standard_Human", "Humanoid_Elemental", "Humanoid_Form", "Humanoid_Both"],
    weights: [50, 10, 20, 20],
  },
  Animal: {
    items: ["Animal"],
    weights: [1],
  },
  Artificial: {
    items: ["Artificial_Humanoid", "Artificial_Geometric", "Artificial_Animal", "Artificial_Hologram", "Artificial_Cloud", "Artificial_Elemental"],
    weights: [1, 1, 1, 1, 1, 1],
  },
  Alien: {
    items: ["Alien_PlantAnimal", "Alien_AnimalOddity", "Alien_Slime", "Alien_GeometricOddity", "Alien_AnimalElemental", "Alien_GeometricElementOddity"],
    weights: [1, 1, 1, 1, 1, 1],
  },
};

const BEAST_TABLES = {
  WATERGOING: ["whale/narwhal", "squid/octopus", "dolphin/shark/alligator", "turtle/clam/snail/crab", "fish/eel/snake", "frog/toad", "jelly/anemone", "insect/barnacle"],
  AIRBORNE: ["pteranadon/condor", "eagle/owl/hawk/falcon", "heron/crane/ostrich", "crow/raven/gull", "songbird/parrot", "chicken/duck/goose", "bee/wasp/hornet/locust", "butterfly/moth/mosquito"],
  EARTHBOUND: ["dinosaur/elephant", "ox/rhino/bear/apex hunter", "deer/horse/camel", "panther/wolf/boar", "snake/lizard/armadillo", "mouse/rat/weasel/cat", "ant/centipede/scorpion", "slug/worm/tick/beetle"],
};

const ARTIFICIAL_VARIATIONS = ["Humanoid", "Geometric", "Beast-like", "Hologram", "Cloud", "Elemental"];

const PLANT_VARIATIONS = ["Shrub", "Tree", "Flower", "Cactus", "Vine", "Fungus"];

const ODDITY_LIST = [
  "bright/garish/harsh",
  "geometric/concentric",
  "web/network",
  "crystalline/glassy",
  "fungal/slimy/moldy",
  "gaseous/misty/illusory",
  "volcanic/explosive",
  "magnetic/repellant",
  "multilevel/tiered",
  "absurd/impossible",
];

const ALIEN_VARIATIONS = [
  "Chimeric, {{C_C.Beast}} and {{C_C.Beast}}",
  "Chimeric, {{C_C.Beast}} and {{C_C.Beast}} and {{C_C.Beast}}",
  "Hybrid {{C_C.Beast}} and {{eval VNPC.PlantVariation}}",
  "Chimeric, {{C_C.Beast}} and {{C_C.Beast}} with {{eval C_D.Oddity}} features",
  "Slime - amorphous form",
  "Geometric with {{eval C_D.Oddity}} features",
  "{{C_C.Beast}}-like, {{eval C_D.ElementType}}-features",
  "Geometric, {{eval C_D.ElementType}}-features and {{eval C_D.Oddity}}",
];

const NO_VIRTUES = { evil: 0, chaotic: 1, neutral: 1, lawful: 2, good: 3 };
const NO_VICES = { evil: 3, chaotic: 3, neutral: 1, lawful: 1, good: 0 };

const RARITIES = ["common", "uncommon", "rare"];
const RARITY_WEIGHTS = [6, 4, 2];
const ALIGNMENTS = ["evil", "chaotic", "neutral", "lawful", "good"];
const ALIGNMENT_WEIGHTS = [1, 2, 7, 2, 1];

const VALUES = {
  good: {
    1: "Empathy",
    2: "Generosity",
    3: "Generosity",
    4: "Valor",
    5: "Valor",
    6: "Trust",
    7: "Trust",
    8: "Cooperation",
    9: "Cooperation",
    10: "Love",
    11: "reroll_lawful",
    12: "reroll_neutral",
  },
  lawful: {
    1: "Truth",
    2: "Justice",
    3: "Justice",
    4: "Discipline",
    5: "Discipline",
    6: "Loyalty",
    7: "Loyalty",
    8: "Order",
    9: "Order",
    10: "Honor",
    11: "reroll_good",
    12: "reroll_neutral",
  },
  neutral: {
    1: "Knowledge",
    2: "Balance",
    3: "Balance",
    4: "Advancement",
    5: "Advancement",
    6: "Independence",
    7: "Independence",
    8: "Investment",
    9: "Investment",
    10: "Fate",
    11: "reroll_lawful",
    12: "reroll_chaotic",
  },
  chaotic: {
    1: "Satisfaction",
    2: "Impulse",
    3: "Impulse",
    4: "Conflict",
    5: "Conflict",
    6: "Celebration",
    7: "Celebration",
    8: "Disruption",
    9: "Disruption",
    10: "Passion",
    11: "reroll_evil",
    12: "reroll_neutral",
  },
  evil: {
    1: "Ignorance",
    2: "Control",
    3: "Control",
    4: "Subjugation",
    5: "Subjugation",
    6: "Greed",
    7: "Greed",
    8: "Power",
    9: "Power",
    10: "Hatred",
    11: "reroll_lawful",
    12: "reroll_neutral",
  },
};

function rollD12(rng) {
  return Math.floor(rng() * 12) + 1;
}

function rollValue(alignment, rng) {
  let raw = VALUES[alignment][rollD12(rng)];
  while (raw.startsWith("reroll_")) {
    const target = raw.replace("reroll_", "");
    raw = VALUES[target][rollD12(rng)];
  }
  return raw;
}

function weightedPick(arr, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

function determineValues(alignment, rng) {
  const v1 = rollValue(alignment, rng);
  const v2 = rollValue(alignment, rng);
  const values = [v1, v2];
  if (v1 === v2) {
    return { values, primary: v1 };
  }
  return { values, primary: null };
}

function rollEconomy(rng) {
  const roll = rollD12(rng);
  if (roll === 1) return "struggling";
  if (roll <= 3) return "poor";
  if (roll <= 9) return "comfortable";
  if (roll <= 11) return "wealthy";
  return "booming";
}

function rollMilitary(rng) {
  const roll = rollD12(rng);
  if (roll === 1) return "pathetic";
  if (roll <= 3) return "weak";
  if (roll <= 9) return "capable";
  if (roll <= 11) return "strong";
  return "mighty";
}

function rollPopulace(rng) {
  const roll = rollD12(rng);
  if (roll === 1) return "rebellious";
  if (roll <= 3) return "restive";
  if (roll <= 9) return "resigned";
  if (roll <= 11) return "content";
  return "exuberant";
}

function determinePeoplesType(region) {
  const { template, terrain, baseTemp } = region;
  if (baseTemp < 0) return 'Cold';
  if (baseTemp >= 20) {
    if (template === 'island' || template === 'coast') return 'Marine';
    if (terrain === 'wetland') return 'Wetland';
    if (terrain === 'wasteland' || terrain === 'highland') return 'Desert';
    return 'Desert';
  }
  if (template === 'island' || template === 'coast') return 'Marine';
  if (terrain === 'wetland') return 'Wetland';
  if (terrain === 'woodland') return 'Forest';
  return 'Plains';
}

function parseElementEntry(str) {
  const [items, w] = str.split('/');
  return { items: items.split(','), weights: w.split(',').map(Number) };
}

function rollBodyType(rng) {
  const category = weightedPick(BODY_CATEGORIES, BODY_CATEGORY_WEIGHTS, rng);
  const { items, weights } = BODY_SUBTYPES[category];
  return { category, subtype: weightedPick(items, weights, rng) };
}

function rollBeastType(rng) {
  const roll = rollD12(rng);
  let cat;
  if (roll <= 2) cat = "WATERGOING";
  else if (roll <= 5) cat = "AIRBORNE";
  else cat = "EARTHBOUND";
  const types = BEAST_TABLES[cat];
  return { beastCategory: cat, beastType: types[Math.floor(rng() * types.length)] };
}

function rollArtificialVariation(rng, element) {
  const base = ARTIFICIAL_VARIATIONS[Math.floor(rng() * ARTIFICIAL_VARIATIONS.length)];
  switch (base) {
    case "Beast-like": {
      const allBeasts = Object.values(BEAST_TABLES).flat();
      return allBeasts[Math.floor(rng() * allBeasts.length)] + "-like";
    }
    case "Elemental":
      return element + "-elemental";
    default:
      return base;
  }
}

function pickBeast(rng) {
  const allBeasts = Object.values(BEAST_TABLES).flat();
  return allBeasts[Math.floor(rng() * allBeasts.length)];
}

function rollOddity(rng) {
  const roll = rollD12(rng);
  if (roll <= 11) {
    return ODDITY_LIST[Math.floor(rng() * ODDITY_LIST.length)];
  }
  const i = Math.floor(rng() * ODDITY_LIST.length);
  let j = Math.floor(rng() * (ODDITY_LIST.length - 1));
  if (j >= i) j++;
  return ODDITY_LIST[i] + " + " + ODDITY_LIST[j];
}

function rollAlienVariation(rng, element) {
  const templates = ALIEN_VARIATIONS;
  const template = templates[Math.floor(rng() * templates.length)];
  return template
    .replace(/\{\{C_C\.Beast\}\}/g, () => pickBeast(rng))
    .replace(/\{\{eval VNPC\.PlantVariation\}\}/g, () => PLANT_VARIATIONS[Math.floor(rng() * PLANT_VARIATIONS.length)])
    .replace(/\{\{eval C_D\.Oddity\}\}/g, () => rollOddity(rng))
    .replace(/\{\{eval C_D\.ElementType\}\}/g, () => element);
}

export function generatePeoples(seed, region) {
  const rng = mulberry32(seed ^ 0xd0ce);
  const count = Math.floor(rng() * 2) + 1;
  const type = determinePeoplesType(region);
  const elements = parseElementEntry(PEOPLES[type]);
  const groups = [];
  for (let i = 0; i < count; i++) {
    const alignment = weightedPick(ALIGNMENTS, ALIGNMENT_WEIGHTS, rng);
    const { category, subtype } = rollBodyType(rng);
    const element = weightedPick(elements.items, elements.weights, rng);
    const group = {
      type,
      element,
      body: subtype,
      bodyCategory: category,
      alignment,
      ...determineValues(alignment, rng),
      economy: rollEconomy(rng),
      military: rollMilitary(rng),
      populace: rollPopulace(rng),
    };
    if (category === "Animal") {
      Object.assign(group, rollBeastType(rng));
    } else if (category === "Artificial") {
      group.artificialVariation = rollArtificialVariation(rng, element);
    } else if (category === "Alien") {
      group.alienVariation = rollAlienVariation(rng, element);
    }
    groups.push(group);
  }
  return groups;
}

/*
1. Add generatePeoples to buildRegion in terrain.js
use region climate,  template and terrain to determine peoples - don't use biome array
Remove rarity use PEOPLES to generate people based upon region object provided
:: designates a 50% split between the groups
the numbers to ther right of the / designates the weights of that group
*/
