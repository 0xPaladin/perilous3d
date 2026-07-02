export function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash; // 32-bit clamp
  }
  return Math.abs(hash) || 42;
}
