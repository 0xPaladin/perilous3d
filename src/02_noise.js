// Perlin noise implementation matching Perilous Shores behavior.
// Reconstructed from compiled Haxe/OpenFL output analysis.
//
// PS uses:
//   - Seeded permutation table (256 values, Fisher-Yates shuffled)
//   - 8 gradient vectors (cardinal/intercardinal directions)
//   - 4096-entry smoothstep lookup: 6t^5 - 15t^4 + 10t^3
//   - Fractal noise: 6 octaves, gridSize doubling, amplitude * persistence
//   - Classic Perlin bilinear interpolation

export class Perlin {
  constructor(seed) {
    this.gridSize = 1;
    this.amplitude = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 8 gradient vectors matching PS cardinal/intercardinal directions
    this.gradients = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    // 4096-entry smoothstep lookup
    this.smooth = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      const t = i / 4095;
      this.smooth[i] = 6 * t * t * t * t * t - 15 * t * t * t * t + 10 * t * t * t;
    }

    // Seeded permutation table
    this.perm = this.buildPermutation(seed);
    this.permMod8 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.permMod8[i] = this.perm[i & 255] % 8;
    }
  }

  buildPermutation(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Fisher-Yates shuffle seeded by LCG
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 2654435761) >>> 0; // Knuth multiplicative hash
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate to avoid mod wraparound
    const result = new Uint8Array(512);
    for (let i = 0; i < 512; i++) result[i] = p[i & 255];
    return result;
  }

  dot(gi, x, y) {
    const g = this.gradients[gi];
    return g[0] * x + g[1] * y;
  }

  sample(gx, gy) {
    const X = Math.floor(gx) & 255;
    const Y = Math.floor(gy) & 255;

    const x = gx - Math.floor(gx);
    const y = gy - Math.floor(gy);

    // Smoothstep from lookup table
    const u = this.smooth[Math.min(Math.floor(x * 4095 + 0.5), 4095)];
    const v = this.smooth[Math.min(Math.floor(y * 4095 + 0.5), 4095)];

    const a = this.permMod8[X] + Y;
    const b = this.permMod8[X + 1] + Y;

    const g00 = this.perm[a];
    const g10 = this.perm[b];
    const g01 = this.perm[a + 1];
    const g11 = this.perm[b + 1];

    const l00 = this.dot(g00, x, y);
    const l10 = this.dot(g10, x - 1, y);
    const l01 = this.dot(g01, x, y - 1);
    const l11 = this.dot(g11, x - 1, y - 1);

    const x1 = l00 + u * (l10 - l00);
    const x2 = l01 + u * (l11 - l01);

    return x1 + v * (x2 - x1); // range ~[-1, 1]
  }

  get(x, y) {
    return this.sample(x / this.gridSize + this.offsetX, y / this.gridSize + this.offsetY) * this.amplitude;
  }
}

export class FractalNoise {
  constructor(octaves, baseGridSize, persistence, seed) {
    this.octaves = octaves;
    this.persistence = persistence || 0.5;
    this.noises = [];

    let gridSize = baseGridSize;
    let amplitude = 1;
    let freq = 1;
    let maxAmp = 0;

    for (let i = 0; i < octaves; i++) {
      this.noises.push(new Perlin(seed + i));
      this.noises[i].gridSize = gridSize;
      this.noises[i].amplitude = amplitude;
      maxAmp += amplitude;
      amplitude *= this.persistence;
      gridSize *= 2;
      freq *= 2;
    }
    this.maxAmp = maxAmp;
  }

  get(x, y) {
    let val = 0;
    for (const n of this.noises) {
      val += n.get(x, y);
    }
    return val / this.maxAmp; // normalized to ~[-1, 1]
  }
}
