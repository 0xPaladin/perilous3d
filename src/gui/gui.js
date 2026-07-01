import GUI from 'lil-gui';
import { TEMPLATE_WATER_LEVELS } from '../terrain/config.js';

export function initGUI({ app, generate, initialTemplate, initialTerrain, initialClimate, initialSafety, initialSize, initialWaterLevel = 0.5 }) {
  const gui = new GUI({ title: 'Perilous Shores' });

  const options = {
    template: initialTemplate || 'island',
    terrain: initialTerrain != null ? initialTerrain : 'highland',
    climate: initialClimate != null ? initialClimate : 'Temperate',
    safety: initialSafety != null ? initialSafety : 0,
    size: initialSize != null ? initialSize : 320,
    waterLevel: initialWaterLevel != null ? initialWaterLevel : 0.5,
  };

  const infoFolder = gui.addFolder('Info');

  const seedProxy = {
    get value() {
      return app.seed || '--';
    }
  };

  infoFolder.add(seedProxy, 'value').name('Seed').listen();

  const templateFolder = gui.addFolder('Template');
  let waterLevelController;
  templateFolder.add(options, 'template', ['island', 'archipelago', 'bay', 'fjord', 'lake', 'land'])
    .name('Template').onFinishChange(() => {
      const wl = TEMPLATE_WATER_LEVELS[options.template];
      if (wl != null) {
        options.waterLevel = wl;
        if (waterLevelController) waterLevelController.updateDisplay();
      }
    });

  const paramsFolder = gui.addFolder('Parameters');
  paramsFolder.add(options, 'terrain', ['wetland', 'lowland', 'woodland', 'highland', 'wasteland']).name('Terrain');
  paramsFolder.add(options, 'climate', ['Arctic', 'Sub-arctic', 'Temperate', 'Sub-tropical', 'Tropical']).name('Climate');
  paramsFolder.add(options, 'safety', { Perilous: 0, Dangerous: 1, Unsafe: 2, Safe: 3 }).name('Safety');
  paramsFolder.add(options, 'size', 50, 400, 10).name('Map Size (km)');
  waterLevelController = paramsFolder.add(options, 'waterLevel', 0, 0.95, 0.01).name('Water Level')
    .onChange(() => {
      if (!app.seedStr) return;
      generate(options.template, app.seedStr, options.terrain, options.climate, options.safety, options.size, options.waterLevel);
    });

  const actionsFolder = gui.addFolder('Actions');
  actionsFolder.add({
    fn: () => {
      const seed = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      generate(options.template, seed, options.terrain, options.climate, options.safety, options.size, options.waterLevel);
    }
  }, 'fn').name('New Region');

  actionsFolder.add({
    fn: () => {
      if (!app.seedStr) return;
      generate(options.template, app.seedStr, options.terrain, options.climate, options.safety, options.size, options.waterLevel);
    }
  }, 'fn').name('Update');

  return { gui, options, waterLevelController };
}
