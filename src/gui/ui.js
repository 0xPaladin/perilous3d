// UI helpers for Perilous Shores 3D — progress overlay and button handlers.
// Mirrors the "STEP x OF 4" progress pattern from proceduralisland.

export const progressPanel = {
  el: null, stepEl: null, titleEl: null, detailEl: null,

  init() {
    this.el = document.getElementById('progress-panel');
    this.stepEl = document.getElementById('progress-step');
    this.titleEl = document.getElementById('progress-title');
    this.detailEl = document.getElementById('progress-detail');
  },

  show(step, total, title, detail) {
    if (!this.el) return;
    this.stepEl.textContent = `STEP ${step} OF ${total}`;
    this.titleEl.textContent = title;
    this.detailEl.textContent = detail;
    this.el.style.display = 'block';
  },

  hide() {
    if (this.el) this.el.style.display = 'none';
  }
};

export function updateSeedDisplay(seed) {
  const el = document.getElementById('seed-display');
  if (el) el.textContent = `seed: ${seed}`;
}
