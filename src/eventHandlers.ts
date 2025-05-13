import { log, selectors, types, util } from 'vortex-api'

import { GAME_ID } from './common';
import { onAddMod, onRemoveMod } from './modsFile';
import { testBluePrintModManager, testLoadOrderChangeDebouncer } from './tests'
import { dismissNotifications, isLuaMod, parsePluginsFile, resolveRequirements, trySetPrimaryTool } from './util';
import { download } from './downloader';
import { applyLoadOrderRedundancy, setLoadOrderRedundancy } from './actions';

//#region API event handlers
export const onGameModeActivated = (api: types.IExtensionApi) => async (gameMode: string) => {
  if (gameMode !== GAME_ID) {
    dismissNotifications(api);
    return;
  }

  try {
    await testBluePrintModManager(api, 'gamemode-activated');
    const loadOrder = await parsePluginsFile(api, () => true);
    testLoadOrderChangeDebouncer.schedule(undefined, api, loadOrder);
  } catch (err) {
    // All errors should've been handled in the test - if this
    //  notification is reported - please fix the test.
    api.showErrorNotification!('Failed to execute gamemode activation tests', err);
    return;
  }
}

export const onBakeSettings = (api: types.IExtensionApi) => async (gameMode: string): Promise<void> => {
  if (gameMode !== GAME_ID) {
    return Promise.resolve();
  }
  const profileId = selectors.lastActiveProfileForGame(api.getState(), GAME_ID);
  const unappliedLORedundancy = util.getSafe(api.getState(), ['session', GAME_ID, 'redundancies', profileId], []);
  if (unappliedLORedundancy.length > 0) {
    applyLoadOrderRedundancy(api, profileId);
  }
  const currentLoadOrder = util.getSafe(api.getState(), ['persistent', 'loadOrder', profileId], []);
  const loadOrder = unappliedLORedundancy.length > 0 ? unappliedLORedundancy : (currentLoadOrder ?? await parsePluginsFile(api, () => true));
  testLoadOrderChangeDebouncer.schedule(undefined, api, loadOrder);
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
      await trySetPrimaryTool(api)
      await testBluePrintModManager(api, 'did-deploy');
      // await testMemberVariableLayout(api, 'did-deploy');
      await onDidDeployLuaEvent(api, profile);
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

  const loadOrder = await parsePluginsFile(api, () => true);
  api.store.dispatch(setLoadOrderRedundancy(profileId, loadOrder));

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