import GUI from 'lil-gui';
export function initGUI({ app, generate, initialTemplate, initialTerrain, initialClimate, initialSafety, initialSize, initialNumPoints, initialFeaturesEnabled, initialDisplayMode, initialTileSize }) {
  const gui = new GUI({ title: 'Perilous Shores' });

  const options = {
    template: initialTemplate || 'island',
    terrain: initialTerrain != null ? initialTerrain : 'highland',
    climate: initialClimate != null ? initialClimate : 'Temperate',
    safety: initialSafety != null ? initialSafety : 0,
    size: initialSize != null ? initialSize : 320,
    points: initialNumPoints != null ? initialNumPoints : 0,
    features: initialFeaturesEnabled != null ? initialFeaturesEnabled : true,
    displayMode: initialDisplayMode != null ? initialDisplayMode : '3d',
    tileSize: initialTileSize != null ? initialTileSize : 10,
  };

  const infoFolder = gui.addFolder('Info');

  const seedProxy = {
    get value() {
      return app.seed || '--';
    }
  };

  infoFolder.add(seedProxy, 'value').name('Seed').listen();

  const templateFolder = gui.addFolder('Template');
  templateFolder.add(options, 'template', ['island', 'archipelago', 'coast', 'lake', 'land'])
    .name('Template');

  const paramsFolder = gui.addFolder('Parameters');
  paramsFolder.add(options, 'terrain', ['wetland', 'lowland', 'woodland', 'highland', 'wasteland']).name('Terrain');
  paramsFolder.add(options, 'climate', ['Arctic', 'Sub-arctic', 'Temperate', 'Sub-tropical', 'Tropical']).name('Climate');
  paramsFolder.add(options, 'safety', { Perilous: 0, Dangerous: 1, Unsafe: 2, Safe: 3 }).name('Safety');
  paramsFolder.add(options, 'size', 50, 400, 10).name('Map Size (km)');
  paramsFolder.add(options, 'points', 0, 50000, 500).name('Points (0=auto)');
  paramsFolder.add(options, 'features').name('Place Features');

  const displayFolder = gui.addFolder('Display');
  const displayModeController = displayFolder.add(options, 'displayMode', ['3d', 'ascii']).name('Display Mode');
  const tileSizeController = displayFolder.add(options, 'tileSize', 5, 80, 1).name('Tile Size (km)');
  if (options.displayMode !== 'ascii') {
    tileSizeController.disable();
  }

  function updateTileSizeState() {
    if (options.displayMode === 'ascii') {
      tileSizeController.enable();
    } else {
      tileSizeController.disable();
    }
  }

  displayModeController.onChange(updateTileSizeState);

  const actionsFolder = gui.addFolder('Actions');
  actionsFolder.add({
    fn: () => {
      const seed = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      generate(options.template, seed, options.terrain, options.climate, options.safety, options.size, options.points, options.features, options.displayMode, options.tileSize);
    }
  }, 'fn').name('New Region');

  actionsFolder.add({
    fn: () => {
      if (!app.seedStr) return;
      generate(options.template, app.seedStr, options.terrain, options.climate, options.safety, options.size, options.points, options.features, options.displayMode, options.tileSize);
    }
  }, 'fn').name('Update');

  return { gui, options };
}
