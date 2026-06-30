import Chance from 'https://cdn.jsdelivr.net/npm/chance@1.1.11/+esm';

const CHANCE_LCG_A = 0x2455;
const CHANCE_LCG_C = 0xc091;
const CHANCE_LCG_M = 0x38f40;

export function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash; // 32-bit clamp
  }
  return Math.abs(hash) || 42;
}

export function createChance(seed) {
  const ch = new Chance(seed);
  // Validate the chance instance is deterministic
  return ch;
}

export function chanceSeedRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
