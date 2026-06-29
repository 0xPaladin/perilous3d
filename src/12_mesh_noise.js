export function createPerm(seed) {
  const p = new Uint32Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed || 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

const _seed = ((Math.random() * 2147483647) | 0);
const _perm = createPerm(_seed);

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export function perlin2(x, y, perm) {
  const p = perm || _perm;
  const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  const a = p[xi] + yi, b = p[xi + 1] + yi;
  return lerp(
    lerp(grad(p[a], xf, yf), grad(p[b], xf - 1, yf), u),
    lerp(grad(p[a + 1], xf, yf - 1), grad(p[b + 1], xf - 1, yf - 1), u),
    v
  );
}

export function fbm(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5, perm) {
  let v = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += perlin2(x * freq, y * freq, perm) * amp;
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return v / max;
}

export function domainWarp(x, y, warp = 0.15, perm) {
  const qx = fbm(x + 5.2, y + 1.3, 6, 2, 0.5, perm);
  const qy = fbm(x + 9.1, y + 3.7, 6, 2, 0.5, perm);
  return [fbm(x + warp * qx, y + warp * qy, 6, 2, 0.5, perm), qx, qy];
}

export function gaussianPeak(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return Math.exp(-(dx * dx + dy * dy) / 2);
}
