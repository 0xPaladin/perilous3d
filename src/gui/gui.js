import GUI from 'lil-gui';
// lil-gui initialization: folders for Display (Scope/DisplayMode/TileSize), Parameters (terrain or site), Actions, Info
// Scope toggle switches between terrain and site parameter folders; site mode is ASCII-only
export function initGUI({ app, generate, generateSite, generateArea, initialScope, initialTemplate, initialTerrain, initialClimate, initialSafety, initialSize, initialNumPoints, initialFeaturesEnabled, initialDisplayMode, initialTileSize, initialSiteTemplate, initialSiteW, initialSiteH, initialSiteFloors, initialAreaTemplate, initialAreaW, initialAreaH, initialAreaRiver, initialAreaBay }) {
  const gui = new GUI({ title: 'Perilous Shores' });

  const options = {
    scope: initialScope || 'terrain',
    template: initialTemplate || 'island',
    terrain: initialTerrain != null ? initialTerrain : 'highland',
    climate: initialClimate != null ? initialClimate : 'Temperate',
    safety: initialSafety != null ? initialSafety : 0,
    size: initialSize != null ? initialSize : 320,
    points: initialNumPoints != null ? initialNumPoints : 0,
    features: initialFeaturesEnabled != null ? initialFeaturesEnabled : true,
    displayMode: initialDisplayMode != null ? initialDisplayMode : '3d',
    tileSize: initialTileSize != null ? initialTileSize : 10,
    siteTemplate: initialSiteTemplate || 'hideout',
    siteW: initialSiteW != null ? initialSiteW : 40,
    siteH: initialSiteH != null ? initialSiteH : 30,
    siteFloors: initialSiteFloors != null ? initialSiteFloors : 1,
    areaTemplate: initialAreaTemplate || 'fantasy-town',
    areaW: initialAreaW != null ? initialAreaW : 60,
    areaH: initialAreaH != null ? initialAreaH : 60,
    areaRiver: initialAreaRiver != null ? initialAreaRiver : true,
    areaBay: initialAreaBay != null ? initialAreaBay : true,
  };

  const displayFolder = gui.addFolder('Display');
  const displayModeController = displayFolder.add(options, 'displayMode', ['3d', 'ascii']).name('Display Mode');
  const tileSizeController = displayFolder.add(options, 'tileSize', 1, 50, 1).name('Tile Size (km)');
  const scopeController = displayFolder.add(options, 'scope', ['terrain', 'site', 'area']).name('Scope');

  const seedProxy = {
    get value() {
      return app.seed || '--';
    }
  };

  const terrainParamsFolder = gui.addFolder('Parameters');
  terrainParamsFolder.add(seedProxy, 'value').name('Seed').listen();
  terrainParamsFolder.add(options, 'template', ['island', 'archipelago', 'coast', 'lake', 'land'])
    .name('Template');
  terrainParamsFolder.add(options, 'terrain', ['wetland', 'lowland', 'woodland', 'highland', 'wasteland']).name('Terrain');
  terrainParamsFolder.add(options, 'climate', ['Arctic', 'Sub-arctic', 'Temperate', 'Sub-tropical', 'Tropical']).name('Climate');
  terrainParamsFolder.add(options, 'safety', { Perilous: 0, Dangerous: 1, Unsafe: 2, Safe: 3 }).name('Safety');
  terrainParamsFolder.add(options, 'size', 50, 400, 2).name('Map Size (km)');
  terrainParamsFolder.add(options, 'points', 0, 50000, 500).name('Points (0=auto)');
  terrainParamsFolder.add(options, 'features').name('Place Features');

  const areaParamsFolder = gui.addFolder('Parameters');
  areaParamsFolder.add(seedProxy, 'value').name('Seed').listen();
  areaParamsFolder.add(options, 'areaTemplate', ['fantasy-town', 'fantasy-city', 'fantasy-city-ruins', 'sci-fi-city-district', 'post-epoc-ruins', 'alien-ruins'])
    .name('Template');
  areaParamsFolder.add(options, 'areaW', 10, 256, 2).name('Width');
  areaParamsFolder.add(options, 'areaH', 10, 256, 2).name('Height');
  areaParamsFolder.add(options, 'areaRiver').name('River');
  areaParamsFolder.add(options, 'areaBay').name('Bay');

  const siteParamsFolder = gui.addFolder('Parameters');
  siteParamsFolder.add(seedProxy, 'value').name('Seed').listen();
  siteParamsFolder.add(options, 'siteTemplate', ['hideout', 'bandit-camp', 'lair', 'warehouse', 'dungeon'])
    .name('Template');
  siteParamsFolder.add(options, 'siteW', 10, 256, 2).name('Width');
  siteParamsFolder.add(options, 'siteH', 10, 256, 2).name('Height');
  siteParamsFolder.add(options, 'siteFloors', 1, 10, 1).name('Floors');

  // Site generation is ASCII-only — hide 3D option when scope=site
  function updateDisplayModeState() {
    if (options.scope === 'site' || options.scope === 'area') {
      displayModeController.disable();
      tileSizeController.disable();
    } else {
      displayModeController.enable();
      updateTileSizeState();
    }
  }

  function updateTileSizeState() {
    if (options.displayMode === 'ascii') {
      tileSizeController.enable();
    } else {
      tileSizeController.disable();
    }
  }

  function updateScopeFolders() {
    if (options.scope === 'site') {
      terrainParamsFolder.hide();
      areaParamsFolder.hide();
      siteParamsFolder.show();
    } else if (options.scope === 'area') {
      terrainParamsFolder.hide();
      siteParamsFolder.hide();
      areaParamsFolder.show();
    } else {
      siteParamsFolder.hide();
      areaParamsFolder.hide();
      terrainParamsFolder.show();
    }
  }

  function regenerate() {
    if (options.scope === 'site') {
      generateSite({
        seed: app.seedStr,
        template: options.siteTemplate,
        w: options.siteW,
        h: options.siteH,
        floors: options.siteFloors,
      });
    } else if (options.scope === 'area') {
      generateArea({
        seed: app.seedStr,
        template: options.areaTemplate,
        w: options.areaW,
        h: options.areaH,
        addRiver: options.areaRiver,
        addBay: options.areaBay,
      });
    } else {
      generate(options.template, app.seedStr, options.terrain, options.climate, options.safety, options.size, options.points, options.features, options.displayMode, options.tileSize);
    }
  }

  scopeController.onChange((val) => {
    updateScopeFolders();
    updateDisplayModeState();
    regenerate();
  });

  displayModeController.onChange((val) => {
    updateTileSizeState();
    if (options.scope === 'terrain') {
      generate(options.template, app.seedStr, options.terrain, options.climate, options.safety, options.size, options.points, options.features, val, options.tileSize);
    }
  });

  // Initial folder state
  updateScopeFolders();
  updateDisplayModeState();

  const actionsFolder = gui.addFolder('Actions');
  actionsFolder.add({
    fn: () => {
      const seed = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      if (options.scope === 'site') {
        generateSite({
          seed,
          template: options.siteTemplate,
          w: options.siteW,
          h: options.siteH,
          floors: options.siteFloors,
        });
      } else if (options.scope === 'area') {
        generateArea({
          seed,
          template: options.areaTemplate,
          w: options.areaW,
          h: options.areaH,
          addRiver: options.areaRiver,
          addBay: options.areaBay,
        });
      } else {
        generate(options.template, seed, options.terrain, options.climate, options.safety, options.size, options.points, options.features, options.displayMode, options.tileSize);
      }
    }
  }, 'fn').name('New Region');

  actionsFolder.add({
    fn: () => {
      if (!app.seedStr) return;
      if (options.scope === 'site') {
        generateSite({
          seed: app.seedStr,
          template: options.siteTemplate,
          w: options.siteW,
          h: options.siteH,
          floors: options.siteFloors,
        });
      } else if (options.scope === 'area') {
        generateArea({
          seed: app.seedStr,
          template: options.areaTemplate,
          w: options.areaW,
          h: options.areaH,
          addRiver: options.areaRiver,
          addBay: options.areaBay,
        });
      } else {
        generate(options.template, app.seedStr, options.terrain, options.climate, options.safety, options.size, options.points, options.features, options.displayMode, options.tileSize);
      }
    }
  }, 'fn').name('Update');

  return { gui, options };
}
