import GUI from 'lil-gui';

export function initGUI({ app, generate, initialTemplate, initialMountains, initialTemp, initialSafety }) {
  const gui = new GUI({ title: 'Perilous Shores' });

  const options = {
    template: initialTemplate || 'island',
    mountains: initialMountains != null ? initialMountains : 200,
    baseTemp: initialTemp != null ? initialTemp : 22,
    safety: initialSafety != null ? initialSafety : 0,
  };

  const infoFolder = gui.addFolder('Info');

  const seedProxy = {
    get value() {
      return app.seed || '--';
    }
  };

  infoFolder.add(seedProxy, 'value').name('Seed').listen();

  const biomeProxy = {
    get value() {
      return app.sceneState && app.sceneState.biomeView ? app.sceneState.biomeView.visible : false;
    },
    set value(v) {
      if (!app.sceneState || !app.sceneState.toggleBiomeView) return;
      if (app.sceneState.biomeView.visible !== v) app.sceneState.toggleBiomeView();
    }
  };

  const templateFolder = gui.addFolder('Template');
  templateFolder.add(options, 'template', ['island', 'archipelago', 'bay', 'fjord', 'lake', 'land'])
    .name('Template');

  const paramsFolder = gui.addFolder('Parameters');
  paramsFolder.add(options, 'mountains', 0, 500, 1).name('Mountains');
  paramsFolder.add(options, 'baseTemp', 0, 35, 1).name('Base Temp');
  paramsFolder.add(options, 'safety', { Perilous: 0, Dangerous: 1, Unsafe: 2, Safe: 3 }).name('Safety');

  const actionsFolder = gui.addFolder('Actions');
  actionsFolder.add({
    fn: () => {
      const seed = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      generate(options.template, seed, options.mountains, options.baseTemp, options.safety);
    }
  }, 'fn').name('New Region');

  actionsFolder.add({
    fn: () => {
      if (!app.seedStr) return;
      generate(options.template, app.seedStr, options.mountains, options.baseTemp, options.safety);
    }
  }, 'fn').name('Update');

  actionsFolder.add(biomeProxy, 'value').name('Biome View');

  return { gui, options };
}
