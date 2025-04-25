import path from 'path';
import { fs, log, selectors, types, util } from 'vortex-api'

import { GAME_ID } from './common';
import { onAddMod, onRemoveMod } from './modsFile';
import { testUE4SSVersion, testBluePrintModManager, testMemberVariableLayout, testPluginsFile } from './tests'
import { dismissNotifications, isLuaMod, resolvePluginsFilePath, resolveRequirements } from './util';
import { download } from './downloader';

//#region API event handlers
export const onGameModeActivated = (api: types.IExtensionApi) => async (gameMode: string) => {
  if (gameMode !== GAME_ID) {
    dismissNotifications(api);
    return;
  }

  try {
    await testUE4SSVersion(api);
    await testBluePrintModManager(api, 'gamemode-activated');
    await testPluginsFile(api, 'gamemode-activated');
  } catch (err) {
    // All errors should've been handled in the test - if this
    //  notification is reported - please fix the test.
    api.showErrorNotification!('Failed to execute gamemode activation tests', err);
    return;
  }
}

export const onDidDeployEvent = (api: types.IExtensionApi) =>
  async (profileId: string, deployment: types.IDeploymentManifest): Promise<void> => {
    const state = api.getState();
    const profile = selectors.profileById(state, profileId); 
    const gameId = profile?.gameId;
    if (gameId !== GAME_ID) {
      return Promise.resolve();
    }

    try {
      await download(api, resolveRequirements(api));
      await testBluePrintModManager(api, 'did-deploy');
      // await testMemberVariableLayout(api, 'did-deploy');
      await onDidDeployLuaEvent(api, profile);
      await testPluginsFile(api, 'did-deploy');
    } catch (err) {
      log('warn', 'failed to test BluePrint Mod Manager', err);
    }

    return Promise.resolve();
}

export const onWillPurgeEvent = (api: types.IExtensionApi) => async (profileId: string): Promise<void> => {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId); 
  if (profile?.gameId !== GAME_ID) {
    return;
  }

  // This is a temporary fix for 1.14 not restoring the plugins.txt file correctly.
  //  This should be removed once the issue is fixed in the core.
  // TODO: Remove this once the core issue is fixed.
  const pluginsFilePath = await resolvePluginsFilePath(api);
  const tempPluginsFile = path.join(util.getVortexPath('temp'), GAME_ID, profileId, path.basename(pluginsFilePath));
  try {
    await fs.ensureDirWritableAsync(path.dirname(tempPluginsFile));
    await fs.copyAsync(pluginsFilePath, tempPluginsFile, { overwrite: true });
  } catch (err) {
    log('warn', 'failed to copy plugins.txt', err);
  }

  return;
}

export const onDidPurgeEvent = (api: types.IExtensionApi) => async (profileId: string): Promise<void> => {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId); 
  const gameId = profile?.gameId;
  if (gameId !== GAME_ID) {
    return;
  }

  try {
    await onDidPurgeLuaEvent(api, profile);
  } catch (err) {
    log('warn', 'failed to remove lua entries from mods.txt', err);
  }

  return;
}

export const onWillDeployEvent = (api: types.IExtensionApi) => async (profileId: any, deployment: types.IDeploymentManifest): Promise<void> => {
  const state = api.getState();
  const profile = selectors.activeProfile(state);

  if (profile?.gameId !== GAME_ID) {
    return;
  }

  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (!discovery?.path || discovery?.store !== 'xbox') {
    // Game not discovered or not Xbox? bail.
    return;
  }

  // Check if we have a backup for the plugins.txt file - if we do - restore it.
  //  This is a temporary fix for 1.14 not restoring the plugins.txt file correctly.
  //  This should be removed once the issue is fixed in the core.
  // TODO: Remove this once the core issue is fixed.
  const pluginsFilePath = await resolvePluginsFilePath(api);
  const tempPluginsFile = path.join(util.getVortexPath('temp'), GAME_ID, profileId, path.basename(pluginsFilePath));
  const exists = await fs.statAsync(tempPluginsFile).then(() => true).catch(() => false);
  if (exists) {
    try {
      await fs.copyAsync(tempPluginsFile, pluginsFilePath, { overwrite: true });
      await fs.removeAsync(tempPluginsFile);
    } catch (err) {
      log('warn', 'failed to restore plugins.txt', err);
    }
  }
}

export const onCheckModVersion = (api: types.IExtensionApi) => async (gameId: string, mods: types.IMod[], forced?: boolean) => {
  const profile = selectors.activeProfile(api.getState());
  if (profile.gameId !== GAME_ID || gameId !== GAME_ID) {
    return;
  }
  try {
    await testUE4SSVersion(api);
  } catch (err) {
    log('warn', 'failed to test UE4SS version', err);
  }
}

export const onModsEnabled = (api: types.IExtensionApi) => async (modIds: string[], enabled: boolean, gameId: string) => {
  if (gameId !== GAME_ID) {
    return;
  }
  const func = enabled ? onModsInstalled : onModsRemoved;
  await func(api)(gameId, modIds);
}

export const onModsRemoved = (api: types.IExtensionApi) => async (gameId: string, modIds: string[]): Promise<void> => {
  if (gameId !== GAME_ID) {
    return;
  }
  for (const modId of modIds) {
    await onRemoveMod(api, modId);
  }
  return;
}

export const onModsInstalled = (api: types.IExtensionApi) => async (gameId: string, modIds: string[]): Promise<void> => {
  if (gameId !== GAME_ID) {
    return;
  }
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  for (const modId of modIds) {
    if (isLuaMod(mods[modId])) {
      await onAddMod(api, modId);
    } 
  }
  return;
}
//#endregion API event handlers

//#region LUA specific
async function onDidDeployLuaEvent(api: types.IExtensionApi, profile: types.IProfile): Promise<void> {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(profile, ['modState'], {});
  const enabled = Object.keys(modState).filter((key) => isLuaMod(mods?.[key]) && modState[key].enabled);
  const disabled = Object.keys(modState).filter((key) => isLuaMod(mods?.[key]) && !modState[key].enabled);
  await onModsInstalled(api)(profile.gameId, enabled);
  await onModsRemoved(api)(profile.gameId, disabled);
}

async function onDidPurgeLuaEvent(api: types.IExtensionApi, profile: types.IProfile): Promise<void> {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(profile, ['modState'], {});
  const enabled = Object.keys(modState).filter((key) => isLuaMod(mods?.[key]) && modState[key].enabled);
  const disabled = Object.keys(modState).filter((key) => isLuaMod(mods?.[key]) && !modState[key].enabled);
  await onModsRemoved(api)(profile.gameId, [].concat(enabled, disabled));
}
//#endregion LUA