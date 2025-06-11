/* eslint-disable */
import * as _ from 'lodash';
import path from 'path';

import { fs, types, selectors, util } from 'vortex-api';

import {
  DEFAULT_EXECUTABLE, GAME_ID, IGNORE_CONFLICTS,
  PAK_MODSFOLDER_PATH, STEAMAPP_ID, XBOX_ID,
  MOD_TYPE_PAK, MOD_TYPE_LUA, MOD_TYPE_BP_PAK,
  BPPAK_MODSFOLDER_PATH, IGNORE_DEPLOY,
  MOD_TYPE_DATAPATH, NATIVE_PLUGINS, DATA_PATH,
  MOD_TYPE_BINARIES, OBSE64_EXECUTABLE, TOOL_ID_OBSE64,
  MOD_TYPE_ROOT, MOD_TYPE_INI_TWEAKS,
} from './common';

import {
  onDidDeployEvent, onGameModeActivated, onModsEnabled,
  onWillDeployEvent, onModsRemoved,
} from './eventHandlers';

import { sessionReducer, settingsReducer } from './reducers';

import { getStopPatterns } from './stopPatterns';

import {
  getRootPath, testRootPath, getBPPakPath, getPakPath, testBPPakPath, testPakPath,
  getLUAPath, testLUAPath, getDataPath, testDataPath,
  getBinariesPath, testBinariesPath,
} from './modTypes';

import { installLuaMod, installRootMod, installUE4SSInjector,
  testLuaMod, testRootMod, testUE4SSInjector
} from './installers';

import { migrate } from './migrations';

import { getGameVersionAsync, isGameActive, trySetPrimaryTool,
  resetPluginsFile, resolvePluginsFilePath, resolveRequirements,
  resolveUE4SSPath,
  lootSortingAllowed,
  lootSort
} from './util';

import { testExcludedPlugins, testExcludedPluginsDebouncer } from './tests';

import { download } from './downloader';

import Settings from './views/Settings';

import OblivionReLoadOrder from './OblivionReLoadOrder'

const supportedTools: types.ITool[] = [
  {
    id: TOOL_ID_OBSE64,
    name: 'Oblivion Remastered Script Extender',
    shortName: 'OBSE64',
    executable: () => OBSE64_EXECUTABLE,
    requiredFiles: [
      OBSE64_EXECUTABLE,
    ],
    relative: true,
    exclusive: true,
  },
];

const gameFinderQuery = {
  steam: [{ id: STEAMAPP_ID, prefer: 0 }],
  xbox: [{ id: XBOX_ID }],
};

function main(context: types.IExtensionContext) {
  context.registerReducer(['settings', GAME_ID], settingsReducer);
  context.registerReducer(['session', GAME_ID], sessionReducer);
  context.registerGame({
    id: GAME_ID,
    name: 'Oblivion Remastered',
    mergeMods: true,
    queryArgs: gameFinderQuery,
    queryModPath: () => '.',
    logo: 'gameart.jpg',
    executable: () => DEFAULT_EXECUTABLE,
    requiredFiles: [
      path.join(DATA_PATH, 'Oblivion.esm'),
    ],
    getGameVersion: () => getGameVersionAsync(context.api),
    setup: setup(context.api) as any,
    supportedTools,
    requiresLauncher: requiresLauncher as any,
    details: {
      supportsSymlinks: false,
      customOpenModsPath: PAK_MODSFOLDER_PATH,
      steamAppId: +STEAMAPP_ID,
      stopPatterns: getStopPatterns(),
      ignoreDeploy: IGNORE_DEPLOY,
      ignoreConflicts: IGNORE_CONFLICTS,
      dataModType: MOD_TYPE_DATAPATH,
      nativePlugins: NATIVE_PLUGINS,
    },
  });

  context.registerSettings('Mods', Settings, () => ({
    t: context.api.translate,
    allowLootSorting: () => lootSortingAllowed(context.api),
    sort: () => lootSort(context.api),
  }), isGameActive(context.api), 150);

  context.registerAction('mod-icons', 300, 'open-ext', {},
    'Open Logic Mods Folder', () => {
      const state = context.api.getState();
      const discovery = selectors.discoveryByGame(state, GAME_ID);
      const logicModsPath = path.join(discovery.path, BPPAK_MODSFOLDER_PATH);
      util.opn(logicModsPath).catch(() => null);
    }, isGameActive(context.api));

  context.registerAction('mod-icons', 300, 'open-ext', {},
    'Open LUA Mods Folder', () => {
      const state = context.api.getState();
      const discovery = selectors.discoveryByGame(state, GAME_ID);
      const ue4ssPath = resolveUE4SSPath(context.api);
      const openPath = path.join(discovery.path, ue4ssPath, 'Mods');
      util.opn(openPath).catch(() => null);
    }, isGameActive(context.api));

  context.registerAction('mod-icons', 300, 'open-ext', {},
    'Open Plugins Folder', () => {
      util.opn(getDataPath(context.api)).catch(() => null);
    }, isGameActive(context.api));

  context.registerAction(
    'fb-load-order-icons', 150, 'open-ext', {},
    'View Plugins File', () => {
      resolvePluginsFilePath(context.api)
        .then((filePath) => { util.opn(filePath).catch(() => null); });
    }, isGameActive(context.api));

  context.registerAction(
    'fb-load-order-icons', 500, 'remove', {},
    'Reset Plugins File', () => {
      resetPluginsFile(context.api)
    }, isGameActive(context.api));

  context.registerAction(
    'fb-load-order-icons', 600, 'loot-sort', {},
    'Sort via LOOT', () => {
      lootSort(context.api)
    }, () => isGameActive(context.api)() && lootSortingAllowed(context.api),
  )

  context.registerInstaller(`${GAME_ID}-root-mod`, 5, testRootMod as any, installRootMod(context.api) as any);

  context.registerInstaller(`${GAME_ID}-ue4ss`, 10, testUE4SSInjector as any, installUE4SSInjector(context.api) as any);

  // Runs after UE4SS to ensure that we don't accidentally install UE4SS as a root mod.
  //  But must run before lua and pak installers to ensure we don't install a root mod
  //  as a lua mod.

  context.registerInstaller(`${GAME_ID}-lua-installer`, 30, testLuaMod as any, installLuaMod(context.api) as any);

  context.registerModType(
    MOD_TYPE_ROOT,
    5,
    isGameActive(context.api),
    (game: types.IGame) => getRootPath(context.api, game),
    (instructions: types.IInstruction[]) => testRootPath(context.api, instructions) as any,
    { deploymentEssential: true, name: 'Root Mod' }
  );

  // BP_PAK modType must have a lower priority than regular PAKs
  //  this ensures that we get a chance to detect the LogicMods folder
  //  structure before we just deploy it to ~mods

  context.registerModType(
    MOD_TYPE_BP_PAK,
    5,
    isGameActive(context.api),
    (game: types.IGame) => getBPPakPath(context.api, game),
    (instructions: types.IInstruction[]) => testBPPakPath(context.api, instructions) as any,
    { deploymentEssential: true, name: 'Blueprint Mod' }
  );

  context.registerModType(
    MOD_TYPE_PAK,
    10,
    isGameActive(context.api),
    (game: types.IGame) => getPakPath(context.api, game),
    (instructions: types.IInstruction[]) => testPakPath(context.api, instructions) as any,
    { deploymentEssential: true, name: 'Pak Mod' }
  );

  context.registerModType(
    MOD_TYPE_LUA,
    10,
    isGameActive(context.api),
    (game: types.IGame) => getLUAPath(context.api, game),
    testLUAPath as any,
    { deploymentEssential: true, name: 'LUA Mod' }
  );

  context.registerModType(
    MOD_TYPE_DATAPATH,
    20,
    isGameActive(context.api),
    (game: types.IGame) => getDataPath(context.api),
    testDataPath as any,
    { deploymentEssential: true, name: 'Data Folder' }
  );

  context.registerModType(
    MOD_TYPE_BINARIES,
    30,
    isGameActive(context.api),
    () => getBinariesPath(context.api),
    testBinariesPath as any,
    { deploymentEssential: true, name: 'Binaries Folder' });

  context.registerModType(
    MOD_TYPE_INI_TWEAKS,
    90,
    isGameActive(context.api),
    () => undefined,
    () => Promise.resolve(false) as any,
    { deploymentEssential: false, name: 'Merged INI (Do not use)', noConflicts: true, });

  context.registerLoadOrder(new OblivionReLoadOrder(context.api));

  context.registerTest('excluded-plugins-detected', 'plugins-changed',
    () => {
      testExcludedPluginsDebouncer.schedule(undefined, context.api);
      return Promise.resolve(undefined) as any;
    });

  context.once(() => {
    context.api.setStylesheet('oblivionremastered', path.join(__dirname, 'obr.scss'));
    context.api.events.on('gamemode-activated', onGameModeActivated(context.api));
    context.api.events.on('mods-enabled', onModsEnabled(context.api));

    context.api.onAsync('will-remove-mods', onModsRemoved(context.api));
    context.api.onAsync('did-deploy', onDidDeployEvent(context.api));
    context.api.onAsync('will-deploy', onWillDeployEvent(context.api));
    // context.api.onAsync('bake-settings', onBakeSettings(context.api));
    // context.api.onAsync('will-purge', onWillPurgeEvent(context.api));
  });

  return true;
}

const setup = (api: types.IExtensionApi) => async (discovery: types.IDiscoveryResult): Promise<void> => {
  if (!discovery || !discovery.path) return;

  // Make sure the folders exist
  const ensurePath = (filePath: string) => fs.ensureDirWritableAsync(path.join(discovery.path, filePath));
  try {
    const UE4SSPath = resolveUE4SSPath(api);
    await Promise.all([path.join(UE4SSPath, 'Mods'), PAK_MODSFOLDER_PATH, BPPAK_MODSFOLDER_PATH].map(ensurePath));
    await migrate(api);
  } catch (err) {
    api.showErrorNotification('Failed to setup extension', err);
    return;
  } finally {
    const requirements = resolveRequirements(api);
    download(api, requirements)
      .then(() => trySetPrimaryTool(api))
      .catch((err) => {
        api.showErrorNotification('Failed to download requirements', err);
      });
  }
}

async function requiresLauncher(gamePath: string, store?: string) {
  if (store === 'xbox') {
    return Promise.resolve({
      launcher: 'xbox',
      addInfo: {
        appId: XBOX_ID,
        parameters: [{ appExecName: 'AppUEGameShipping' }],
      },
    });
  } else if (store === 'steam') {
    return Promise.resolve({
      launcher: 'steam',
      addInfo: {
        appId: STEAMAPP_ID,
        parameters: [],
      }
    });
  } else {
    return Promise.resolve(undefined);
  }
}

export default main;
