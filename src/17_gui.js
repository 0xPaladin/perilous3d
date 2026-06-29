import GUI from 'lil-gui';

export function initGUI({ app, generate, initialTemplate, initialMountains, initialTemp }) {
  const gui = new GUI({ title: 'Perilous Shores' });

  const options = {
    template: initialTemplate || 'island',
    mountains: initialMountains != null ? initialMountains : 200,
    baseTemp: initialTemp != null ? initialTemp : 22,
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

  const actionsFolder = gui.addFolder('Actions');
  actionsFolder.add({
    fn: () => {
      const seed = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      generate(options.template, seed, options.mountains, options.baseTemp);
    }
  }, 'fn').name('New Region');

  actionsFolder.add({
    fn: () => {
      if (!app.sceneState) return;
      app.sceneState.camera.position.set(0, 120, 260);
      app.sceneState.controls.target.set(0, 0, 0);
      app.sceneState.controls.update();
    }
  }, 'fn').name('Reset View');

  actionsFolder.add(biomeProxy, 'value').name('Biome View');

  return { gui, options };
}
