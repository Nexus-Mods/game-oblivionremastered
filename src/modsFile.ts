/* eslint-disable */
import path from 'path';
import { log, types, selectors, fs, util } from 'vortex-api';
import { MODS_FILE, GAME_ID, MODS_FILE_BACKUP, UE4SSRequirement } from './common';
import { resolveUE4SSPath } from './util';
import { IUE4SSLuaModEntry } from './types';

export async function onAddMod(api: types.IExtensionApi, modId: string) {
  try {
    await esureModsFileEntryAdded(api, modId);
  } catch (err) {
    api.showErrorNotification('Failed to add mod to mods file', err);
  }
}

export async function onRemoveMod(api: types.IExtensionApi, modId: string) {
  try {
    await esureModsFileEntryRemoved(api, modId);
  } catch (err) {
    api.showErrorNotification('Failed to remove mod from mods file', err);
  }
}

async function esureModsFileEntryAdded(api: types.IExtensionApi, modId: string) {
  let ue4ssModsFile;
  try {
    ue4ssModsFile = await ensureModsFile(api);
  } catch (err) {
    if (err instanceof util.NotFound) {
      // If UE4SS isn't installed - there's not much we can do.
      return;
    }
    throw err;
  }
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const mod = mods[modId];
  if (!mod) {
    throw new util.NotFound(modId);
  }
  const folderId = mod.attributes?.folderId ?? mod.installationPath;
  try {
    const data = await fs.readFileAsync(ue4ssModsFile, { encoding: 'utf8' });
    const parsed: IUE4SSLuaModEntry[] = JSON.parse(util.deBOM(data.trim()));
    const found = parsed.find(x => x.mod_name === folderId);
    if (found) {
      // If the entry already exists, we don't need to do anything.
      return;
    }
    const newEntry: IUE4SSLuaModEntry = {
      mod_name: folderId,
      mod_enabled: true,
    };
    parsed.push(newEntry);
    await fs.writeFileAsync(ue4ssModsFile, JSON.stringify(parsed, null, 2), { encoding: 'utf8' });
  } catch (err) {
    log('warn', 'Failed to modify mods file', err);
    return;
  }
}

// Obviously ensure you call this function while the mod entry is still installed!!
async function esureModsFileEntryRemoved(api: types.IExtensionApi, modId: string) {
  // regardless of what happens next, the mods file needs to be updated.
  let ue4ssModsFile;
  try {
    ue4ssModsFile = await ensureModsFile(api);
  } catch (err) {
    if (err instanceof util.NotFound) {
      // If UE4SS isn't installed - there's not much we can do.
      return;
    }
    throw err;
  }
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const mod = mods[modId];
  if (!mod) {
    // Not much we can do if the mod is gone. This can get called during deploy and purge
    //  too, so it's better we don't spam the user.
    return;
  }
  const folderId = mod.attributes?.folderId ?? mod.installationPath;
  try {
    const data = await fs.readFileAsync(ue4ssModsFile, { encoding: 'utf8' });
    const parsed: IUE4SSLuaModEntry[] = JSON.parse(util.deBOM(data.trim()));
    const filtered = parsed.filter(x => x.mod_name !== folderId);
    await fs.writeFileAsync(ue4ssModsFile, JSON.stringify(filtered, null, 2), { encoding: 'utf8' });
  } catch (err) {
    log('warn', 'Failed to modify mods file', err);
    return;
  }
}

export async function ensureModsFile(api: types.IExtensionApi): Promise<string> {
  const state = api.getState();
  const discovery: types.IDiscoveryResult = selectors.discoveryByGame(state, GAME_ID);
  if (discovery?.path === undefined) {
    throw new util.NotFound(GAME_ID);
  }

  const mod = await UE4SSRequirement.findMod(api);
  if (!mod) {
    throw new util.NotFound(UE4SSRequirement.userFacingName);
  }
  const ue4ssPath = resolveUE4SSPath(api);
  const relPath = path.join(ue4ssPath, 'Mods', MODS_FILE);
  const modsFilePath = path.join(discovery.path, relPath);
  const exists = await fs.statAsync(modsFilePath).then(() => true).catch(() => false);
  if (!exists) {
    const staging = selectors.installPathForGame(state, GAME_ID);
    const modsFileBackup = path.join(staging, mod.installationPath, MODS_FILE_BACKUP);
    await fs.copyAsync(modsFileBackup, modsFilePath);
  }

  return modsFilePath;
}

