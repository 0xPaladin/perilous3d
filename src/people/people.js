import { createRng } from "../terrain/terrain.js";

const PEOPLES = {
  Marine:
    "Water,Storm,Plains,Time/4,2,1,0.5::Feathered,Fanged,Finned,Tentacled,Shelled,Selachii,Bato,Angui/1,1,2,2,2,1,1,1",
  Desert:
    "Fire,Storm,Time,Plains,Mountain/3,1,0.5,2,2::Feathered,Scaled,Fanged,Hooved,Roda,Lago,Web,Formic,Opteri,Koleo,Chirops,Skoraps/1,1,1,1,1,1,1,1,1,1,1,1",
  Plains:
    "Fire,Water,Plains,Forest,Storm,Frost,Time/1,1,3,1,2,1,0.5::Feathered,Scaled,Fanged,Hooved,Roda,Lago,Web,Formic,Opteri,Koleo,Chirops,Skoraps/1,1,1,1,1,1,1,1,1,1,1,1",
  Forest:
    "Water,Mountain,Forest,Storm,Frost,Time/2,1,3,2,1,0.5::Feathered,Scaled,Fanged,Hooved,Roda,Lago,Web,Formic,Opteri,Koleo,Chirops,Skoraps/1,1,1,1,1,1,1,1,1,1,1,1",
  Cold: "Mountain,Plains,Forest,Storm,Frost,Time/2,1,1,1,3,0.5::Feathered,Scaled,Fanged,Hooved,Roda,Lago,Chirops,Web,Formic,Opteri,Koleo/2,2,2,2,2,2,2,1,1,1,1",
  Wetland:
    "Water,Forest,Storm,Time/3,2,1,1::Feathered,Scaled,Fanged,Hooved,Roda,Lago,Finned,Tentacled,Web,Formic,Opteri,Koleo,Shelled,Chirops,Bato,Angui,Skoraps/2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1",
};

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

export function generatePeople(seed, region) {
  const rng = createRng(seed ^ 0xd0ce);
  const count = Math.floor(rng() * 2) + 1;

  const groups = [];
  for (let i = 0; i < count; i++) {
    const alignment = weightedPick(ALIGNMENTS, ALIGNMENT_WEIGHTS, rng);
    groups.push({
      rarity: weightedPick(RARITIES, RARITY_WEIGHTS, rng),
      alignment,
      ...determineValues(alignment, rng),
      economy: rollEconomy(rng),
      military: rollMilitary(rng),
      populace: rollPopulace(rng),
    });
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
