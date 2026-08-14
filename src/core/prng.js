/**
 * PRNG utilities — consolidated mulberry32 implementation.
 *
 * mulberry32 is a fast, deterministic, seedable PRNG.
 * All modules in the project should import from here instead of
 * defining their own copy.
 */

/**
 * Create a mulberry32 PRNG function from a numeric seed.
 * @param {number} seed - 32-bit integer seed
 * @returns {function(): number} A function that returns a float in [0, 1)
 */
export function mulberry32(seed) {
  seed = typeof seed === "string" ? seedFromString(seed) : seed;
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a string to a numeric seed (32-bit).
 * @param {string} str - The string to hash
 * @returns {number} A 32-bit integer seed
 */
export function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash; // 32-bit clamp
  }
  return Math.abs(hash) || 42;
}

/*
  Random helper functions
*/

export function randInt(rng, min, max) {
  if (max <= min) {
    return min;
  }

  return Math.floor(
    rng() * (max - min + 1)
  ) + min;
}

export function pick(rng, array) {
  return array[
    Math.floor(rng() * array.length)
  ];
}

export function shuffle(rng, array) {
  // Loop from the last element down to the second
  for (let i = array.length - 1; i > 0; i--) {
    // Pick a random index from 0 to i
    const j = Math.floor(rng() * (i + 1));

    // Swap elements using destructuring assignment
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
