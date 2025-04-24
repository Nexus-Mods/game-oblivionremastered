/* eslint-disable */
import * as _ from 'lodash';
import path from 'path';

import { fs, log, types, selectors, util } from 'vortex-api';

import { DEFAULT_EXECUTABLE, GAME_ID, IGNORE_CONFLICTS,
  PAK_MODSFOLDER_PATH, STEAMAPP_ID, XBOX_ID,
  MOD_TYPE_PAK, MOD_TYPE_LUA, MOD_TYPE_BP_PAK,
  BPPAK_MODSFOLDER_PATH, IGNORE_DEPLOY,
  MOD_TYPE_DATAPATH, NATIVE_PLUGINS, DATA_PATH,
  MOD_TYPE_BINARIES,
} from './common';

import { onCheckModVersion, onDidDeployEvent, onDidPurgeEvent, onGameModeActivated,
  onModsEnabled, onWillDeployEvent, onWillPurgeEvent, onModsRemoved
} from './eventHandlers';

import { settingsReducer } from './reducers';

import { getStopPatterns } from './stopPatterns';
import {
  getBPPakPath, getPakPath, testBPPakPath, testPakPath,
  getLUAPath, testLUAPath, getDataPath, testDataPath,
  getBinariesPath,
  testBinariesPath,
} from './modTypes';
import { installLuaMod, installRootMod, installUE4SSInjector, testLuaMod, testRootMod, testUE4SSInjector } from './installers';

import { migrate } from './migrations';

import { getGameVersionAsync, isGameActive, resetPluginsFile, resolvePluginsFilePath, resolveRequirements, resolveUE4SSPath, serializePluginsFile } from './util';
import { download } from './downloader';

import OblivionReLoadOrder from './OblivionReLoadOrder'

const supportedTools: types.ITool[] = [];

const gameFinderQuery = {
  steam: [{ id: STEAMAPP_ID, prefer: 0 }],
  xbox: [{ id: XBOX_ID }],
};

function main(context: types.IExtensionContext) {
  context.registerReducer(['settings', GAME_ID, 'migrations'], settingsReducer);
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

  context.registerAction('mod-icons', 300, 'open-ext', {},
                         'Open Logic Mods Folder', () => {
    const state = context.api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    const logicModsPath = path.join(discovery.path, BPPAK_MODSFOLDER_PATH);
    util.opn(logicModsPath).catch(() => null);
  }, () => isGameActive(context.api));

  context.registerAction('mod-icons', 300, 'open-ext', {},
                         'Open LUA Mods Folder', () => {
    const state = context.api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    const ue4ssPath = resolveUE4SSPath(context.api);
    const openPath = path.join(discovery.path, ue4ssPath, 'Mods');
    util.opn(openPath).catch(() => null);
  }, () => isGameActive(context.api));

  context.registerAction('mod-icons', 300, 'open-ext', {},
                         'Open Plugins Folder', () => {
    util.opn(getDataPath(context.api)).catch(() => null);
    }, () => isGameActive(context.api));

  context.registerAction(
    'fb-load-order-icons', 150, 'open-ext', {},
    'View Plugins File', () => {
      resolvePluginsFilePath(context.api)
        .then((filePath) => { util.opn(filePath).catch(() => null); });
    }, () => isGameActive(context.api));

  context.registerAction('fb-load-order-icons', 500, 'remove', {},
    'Reset Plugins File', () => { resetPluginsFile(context.api) }, () => isGameActive(context.api));

  context.registerInstaller(`${GAME_ID}-ue4ss`, 10, testUE4SSInjector as any, installUE4SSInjector(context.api) as any);

  // Runs after UE4SS to ensure that we don't accidentally install UE4SS as a root mod.
  //  But must run before lua and pak installers to ensure we don't install a root mod
  //  as a lua mod.
  context.registerInstaller(`${GAME_ID}-root-mod`, 15, testRootMod as any, installRootMod(context.api) as any);

  context.registerInstaller(`${GAME_ID}-lua-installer`, 30, testLuaMod as any, installLuaMod(context.api) as any);

  // BP_PAK modType must have a lower priority than regular PAKs
  //  this ensures that we get a chance to detect the LogicMods folder
  //  structure before we just deploy it to ~mods
  context.registerModType(
    MOD_TYPE_BP_PAK,
    5,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getBPPakPath(context.api, game),
    (instructions: types.IInstruction[]) => testBPPakPath(context.api, instructions) as any,
    { deploymentEssential: true, name: 'Blueprint Mod' }
  );

  context.registerModType(
    MOD_TYPE_PAK,
    10,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getPakPath(context.api, game),
    (instructions: types.IInstruction[]) => testPakPath(context.api, instructions) as any,
    { deploymentEssential: true, name: 'Pak Mod' }
  );

  context.registerModType(
    MOD_TYPE_LUA,
    10,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getLUAPath(context.api, game),
    testLUAPath as any,
    { deploymentEssential: true, name: 'LUA Mod' }
  );

  context.registerModType(
    MOD_TYPE_DATAPATH,
    20,
    (gameId) => GAME_ID === gameId,
    (game: types.IGame) => getDataPath(context.api),
    testDataPath as any,
    { deploymentEssential: true, name: 'Data Folder' }
  );

  context.registerModType(
    MOD_TYPE_BINARIES,
    30,
    (gameId) => GAME_ID === gameId,
    () => getBinariesPath(context.api),
    testBinariesPath as any,
    { deploymentEssential: true, name: 'Binaries Folder' });

  context.registerLoadOrder(new OblivionReLoadOrder(context.api));

  context.once(() => {
    context.api.events.on('gamemode-activated', onGameModeActivated(context.api));
    context.api.events.on('mods-enabled', onModsEnabled(context.api));
  
    context.api.onAsync('will-remove-mods', onModsRemoved(context.api));
    context.api.onAsync('will-deploy', onWillDeployEvent(context.api));
    context.api.onAsync('did-deploy', onDidDeployEvent(context.api));
    context.api.onAsync('will-purge', onWillPurgeEvent(context.api));
    context.api.onAsync('did-purge', onDidPurgeEvent(context.api));
    context.api.onAsync('check-mods-version', onCheckModVersion(context.api));
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
    await download(api, resolveRequirements(api));
  } catch (err) {
    api.showErrorNotification('Failed to setup extension', err);
    return;
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
  } else {
    return Promise.resolve(undefined);
  }
}

export default main;
