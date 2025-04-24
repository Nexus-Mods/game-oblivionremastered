/* eslint-disable */
import { getFileVersion } from 'exe-version';
import path from 'path';
import semver from 'semver';
import turbowalk, { IWalkOptions, IEntry } from 'turbowalk';
import { fs, log, selectors, types, util } from 'vortex-api';
import {  parseStringPromise } from 'xml2js';

import { BINARIES_PATH, GAME_ID, NOTIF_ID_BP_MODLOADER_DISABLED,
  MOD_TYPE_LUA, NOTIF_ID_UE4SS_UPDATE, XBOX_APP_X_MANIFEST,
  DATA_PATH, NATIVE_PLUGINS, GAMEBRYO_PLUGIN_EXTENSIONS, EXTENSION_REQUIREMENTS,
  DIALOG_ID_RESET_PLUGINS_FILE
} from './common';

import { IExtensionRequirement, LoadOrderManagementType } from './types';

export function isGameActive(api: types.IExtensionApi): boolean {
  const state = api.getState();
  const gameId = selectors.activeGameId(state);
  return gameId === GAME_ID;
}

export const lootSortingAllowed = (api: types.IExtensionApi) => {
  return false;
  // const state = api.getState();
  // const appVersion = DEBUG_ENABLED ? DEBUG_APP_VERSION : util.getSafe(state, ['app', 'appVersion'], '0.0.1');
  // return appVersion === '0.0.1' || semver.satisfies(util.semverCoerce(appVersion), CONSTRAINT_LOOT_FUNCTIONALITY);
}

export function resolveUE4SSPath(api: types.IExtensionApi): string {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const architecture = discovery?.store === 'xbox' ? 'WinGDK' : 'Win64';
  return path.join(BINARIES_PATH, architecture, 'ue4ss');
}

export function resolveRequirements(api: types.IExtensionApi): IExtensionRequirement[] {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  return EXTENSION_REQUIREMENTS[discovery.store] ?? EXTENSION_REQUIREMENTS.steam;
}

export async function resolveVersionByPattern(api: types.IExtensionApi, requirement: IExtensionRequirement): Promise<string> {
  const state = api.getState();
  const files: types.IDownload[] = util.getSafe(state, ['persistent', 'downloads', 'files'], []);
  const latestVersion = Object.values(files).reduce((prev, file) => {
    const match = requirement.fileArchivePattern.exec(file.localPath);
    if (match?.[1] && !semver.satisfies(`^${match[1]}`, prev)) {
      prev = match[1];
    }
    return prev;
  }, '0.0.0');
  return latestVersion;
}

export async function resolveVersion(api: types.IExtensionApi, requirement: IExtensionRequirement): Promise<string> {
  const mod = await requirement.findMod(api);
  if (mod?.attributes?.version) {
    return mod.attributes.version;
  } else {
    return resolveVersionByPattern(api, requirement);
  }
}

export async function fileAccessible(filePath: string): Promise<boolean> {
  try {
    await fs.statAsync(filePath);
    return true;
  }
  catch (err) {
    log('debug', `File not accessible: ${filePath}`, err);
    return false;
  }
}

export function getManagementType(api: types.IExtensionApi): LoadOrderManagementType {
  const state = api.store.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  return util.getSafe(state, ['settings', GAME_ID, 'loadOrderManagementType', profileId], 'dnd');
}

export function getEnabledMods(api: types.IExtensionApi, modType?: string): types.IMod[] {
  const state = api.getState();
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile = util.getSafe(state, ['persistent', 'profiles', profileId], {});
  const isEnabled = (modId) => util.getSafe(profile, ['modState', modId, 'enabled'], false);
  const predicate = (mod: types.IMod) => !!modType
    ? isEnabled(mod.id) && mod.type === modType
    : isEnabled(mod.id);
  return Object.values(mods).filter(predicate) as types.IMod[];
}

export async function findModByFile(api: types.IExtensionApi, fileName: string, modType?: string): Promise<types.IMod> {
  const mods = getEnabledMods(api, modType);
  const installationPath = selectors.installPathForGame(api.getState(), GAME_ID);
  for (const mod of mods) {
    const modPath = path.join(installationPath, mod.installationPath);
    const files = await walkPath(modPath);
    if (files.some(file => path.basename(file.filePath).toLowerCase() === path.basename(fileName).toLowerCase())) {
      return mod;
    }
  }
  return undefined;
}

export function findDownloadIdByPattern(api: types.IExtensionApi, requirement: IExtensionRequirement): string | null {
  if (!requirement.fileArchivePattern) {
    log('warn', `no fileArchivePattern defined for "${requirement.userFacingName}"`, 'findDownloadIdByPattern');
    return null;
  }
  const state = api.getState();
  const downloads: { [dlId: string]: types.IDownload } = util.getSafe(state, ['persistent', 'downloads', 'files'], {});
  const id: string | null = Object.entries(downloads).reduce((prev: string | null, [dlId, dl]: [string, types.IDownload]) => {
    if (!prev && !!requirement.fileArchivePattern) {
      const match = requirement.fileArchivePattern.exec(dl.localPath);
      if (match) {
        prev = dlId;
      }
    }
    return prev;
  }, null);
  return id;
}

export function findDownloadIdByFile(api: types.IExtensionApi, fileName: string): string {
  const state = api.getState();
  const downloads: { [dlId: string]: types.IDownload } = util.getSafe(state, ['persistent', 'downloads', 'files'], {});
  return Object.entries(downloads).reduce((prev, [dlId, dl]) => {
    if (path.basename(dl.localPath).toLowerCase() === fileName.toLowerCase()) {
      prev = dlId;
    }
    return prev;
  }, '');
}

// This function is used to find the mod folder of a mod which is still in the installation phase.
export async function findInstallFolderByFile(api: types.IExtensionApi, filePath: string): Promise<string> {
  const installationPath = selectors.installPathForGame(api.getState(), GAME_ID);
  const pathContents = await fs.readdirAsync(installationPath);
  const modFolders = pathContents.filter(folder => path.extname(folder) === '.installing');
  if (modFolders.length === 1) {
    return path.join(installationPath, modFolders[0]);
  } else {
    for (const folder of modFolders) {
      const modPath = path.join(installationPath, folder);
      const files = await walkPath(modPath);
      if (files.find(file => file.filePath.endsWith(filePath))) {
        return path.join(installationPath, folder);
      }
    }
  }
  return undefined;
}

export async function getGameVersionAsync(api: types.IExtensionApi): Promise<string> {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (!discovery?.path) {
    return Promise.reject(new util.GameNotFound(GAME_ID));
  }
  if (discovery.store === 'xbox') {
    try {
      const appManifest = path.join(discovery.path, XBOX_APP_X_MANIFEST);
      await fs.statAsync(appManifest);
      const data = await fs.readFileAsync(appManifest, { encoding: 'utf8' });
      const parsed = await parseStringPromise(data);
      return Promise.resolve(parsed?.Package?.Identity?.[0]?.$?.Version);
    } catch (err) {
      return Promise.reject(new Error('failed to parse appxmanifest.xml'));
    }
  } else {
    const game = util.getGame(GAME_ID);
    const exePath = path.join(discovery.path, discovery.executable || game.executable());
    try {
      const version = await getFileVersion(exePath);
      return Promise.resolve(version);
    } catch (err) {
      return Promise.reject(new util.NotFound(exePath));
    }
  }
}

export async function walkPath(dirPath: string, walkOptions?: IWalkOptions): Promise<IEntry[]> {
  walkOptions = !!walkOptions
    ? { ...walkOptions, skipHidden: true, skipInaccessible: true, skipLinks: true }
    : { skipLinks: true, skipHidden: true, skipInaccessible: true };
  const walkResults: IEntry[] = [];
  return new Promise<IEntry[]>(async (resolve, reject) => {
    await turbowalk(dirPath, (entries: IEntry[]) => {
      walkResults.push(...entries);
      return Promise.resolve() as any;
      // If the directory is missing when we try to walk it; it's most probably down to a collection being
      //  in the process of being installed/removed. We can safely ignore this.
    }, walkOptions).catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err));
    return resolve(walkResults);
  });
}

// Staging folder file operations require the mod to be purged and re-deployed once the
//  staging operation is complete. This function will remove the mod with the specified modId
//  and run the specified function before re-deploying the mod.
// IMPORTANT: all operations within the provided functor should ensure to only apply to the provided
//  modId to ensure we avoid deployment corruption.
export async function runStagingOperationOnMod(api: types.IExtensionApi, modId: string, func: (...args: any[]) => Promise<void>): Promise<void> {
  try {
    await api.emitAndAwait('deploy-single-mod', GAME_ID, modId, false);
    await func(api, modId);
    await api.emitAndAwait('deploy-single-mod', GAME_ID, modId);
  } catch (err) {
    api.showErrorNotification('Failed to run staging operation', err);
    return;
  }
}

export function dismissNotifications(api: types.IExtensionApi) {
  // We're not dismissing the downloader notifications intentionally.
  [NOTIF_ID_BP_MODLOADER_DISABLED, NOTIF_ID_UE4SS_UPDATE].forEach(id => api.dismissNotification(id));
}

export function isLuaMod(mod: types.IMod): boolean {
  if (!mod?.type) {
    return false;
  }
  return [MOD_TYPE_LUA].includes(mod.type);
}

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

//#region plugins file
export const resolvePluginsFilePath = async (api: types.IExtensionApi): Promise<string> => {
  const discovery = selectors.discoveryByGame(api.getState(), GAME_ID);
  if (!discovery?.path) {
    return Promise.reject(new util.GameNotFound(GAME_ID));
  }
  const pluginsFile = path.join(discovery.path, DATA_PATH, 'plugins.txt');
  return Promise.resolve(pluginsFile);
}


export const resetPluginsFile = async (api: types.IExtensionApi) => {
  api.showDialog('info', 'Resetting plugins file', {
    text: 'The plugins file will be reset to the default state. Are you sure?',
  }, [
    { label: 'Cancel' },
    { label: 'Reset', action: async () => {
      const pluginsFile = await resolvePluginsFilePath(api);
      try {
        await fs.removeAsync(pluginsFile);
        const nativePlugins = await resolveNativePlugins(api);
        await fs.writeFileAsync(pluginsFile, nativePlugins.filter(plug => !!plug).join('\n'), { encoding: 'utf8' });
        forceRefresh(api);
      } catch (err) {
        log('warn', 'failed to remove plugins file', err);
      }
    }}
  ], DIALOG_ID_RESET_PLUGINS_FILE);
}

export const isNativePlugin = (fileName: string) => {
  // Any additional pattern matching to automatically resolve new
  //  native plugins should be added here!
  return false;
}

export const resolveNativePlugins = async (api: types.IExtensionApi): Promise<string[]> => {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const dataPath = path.join(discovery.path, DATA_PATH);
  const dirContents = await fs.readdirAsync(dataPath);
  const filtered = dirContents.filter(file => GAMEBRYO_PLUGIN_EXTENSIONS.includes(path.extname(file.toLowerCase())));
  const nativePlugins = dirContents
    .filter(file => NATIVE_PLUGINS.includes(path.basename(file).toLowerCase()))
    .sort((a, b) => NATIVE_PLUGINS.indexOf(path.basename(a).toLowerCase()) - NATIVE_PLUGINS.indexOf(path.basename(b).toLowerCase()));
  const matched = filtered.reduce((accum, file) => {
    if (isNativePlugin(file)) {
      accum.push(file.toLowerCase());
    }
    return accum;
  }, []);
  const defaultNatives = Array.from(new Set<string>([].concat(nativePlugins, matched)));
  return defaultNatives;
}

export async function serializePluginsFile(api: types.IExtensionApi, plugins: types.ILoadOrderEntry[]): Promise<void> {
  const data: string[] = plugins.reduce((acc, plugin) => {
    if (plugin?.name === undefined) {
      return acc;
    }
    const disabled = (plugin.data?.isInvalid || !plugin.enabled) ? '#' : '';
    acc.push(`${disabled}${plugin.name}`);
    return acc;
  }, ['# This file was automatically generated by Vortex. Do not edit this file.']);
  const pluginsFile = await resolvePluginsFilePath(api);
  await fs.writeFileAsync(pluginsFile, data.filter(plug => !!plug).join('\n'), { encoding: 'utf8' });
}

export async function deserializePluginsFile(api: types.IExtensionApi): Promise<string[]> {
  try {
    const targetFile = await resolvePluginsFilePath(api);
    if (!fileAccessible(targetFile)) {
      return [];
    }
    const data = await fs.readFileAsync(targetFile, 'utf8');
    const lines = data.split('\n').filter(line => line.trim().length > 0);
    return Array.from(new Set(lines));
  } catch (err) {
    return [];
  }
}
//#endregion

//#region evil state manipulation
export function forceRefresh(api: types.IExtensionApi) {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const action = {
    type: 'SET_FB_FORCE_UPDATE',
    payload: {
      profileId,
    },
  };
  api.store.dispatch(action);
}

export function setPluginManagementEnabled(api: types.IExtensionApi, enabled: boolean) {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const action = {
    type: 'GAMEBRYO_SET_PLUGIN_MANAGEMENT_ENABLED',
    payload: {
      profileId,
      enabled,
    },
  };
  api.store.dispatch(action);
}
//#endregion