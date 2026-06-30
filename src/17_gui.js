import GUI from 'lil-gui';

export function initGUI({ app, generate, initialTemplate, initialTerrain, initialClimate, initialSafety }) {
  const gui = new GUI({ title: 'Perilous Shores' });

  const options = {
    template: initialTemplate || 'island',
    terrain: initialTerrain != null ? initialTerrain : 'highland',
    climate: initialClimate != null ? initialClimate : 'Temperate',
    safety: initialSafety != null ? initialSafety : 0,
  };

  const infoFolder = gui.addFolder('Info');

  const seedProxy = {
    get value() {
      return app.seed || '--';
    }
  };

  infoFolder.add(seedProxy, 'value').name('Seed').listen();

  const templateFolder = gui.addFolder('Template');
  templateFolder.add(options, 'template', ['island', 'archipelago', 'bay', 'fjord', 'lake', 'land'])
    .name('Template');

  const paramsFolder = gui.addFolder('Parameters');
  paramsFolder.add(options, 'terrain', ['wetland', 'lowland', 'woodland', 'highland', 'wasteland']).name('Terrain');
  paramsFolder.add(options, 'climate', ['Arctic', 'Sub-arctic', 'Temperate', 'Sub-tropical', 'Tropical']).name('Climate');
  paramsFolder.add(options, 'safety', { Perilous: 0, Dangerous: 1, Unsafe: 2, Safe: 3 }).name('Safety');

  const actionsFolder = gui.addFolder('Actions');
  actionsFolder.add({
    fn: () => {
      const seed = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      generate(options.template, seed, options.terrain, options.climate, options.safety);
    }
  }, 'fn').name('New Region');

  actionsFolder.add({
    fn: () => {
      if (!app.seedStr) return;
      generate(options.template, app.seedStr, options.terrain, options.climate, options.safety);
    }
  }, 'fn').name('Update');

  return { gui, options };
}
