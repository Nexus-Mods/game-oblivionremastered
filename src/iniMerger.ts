import * as ini from 'ini';
import * as path from 'path';
import { enabledModKeys } from './selectors';
import { actions, fs, types, log, selectors, util } from 'vortex-api';

import { GAME_ID, MOD_TYPE_INI_TWEAKS, SUPPORTED_INI_FILES, INI_TWEAKS_PATH_SEG, MERGED_INI_MOD_PREFIX } from './common';
import { fileExists, getDocumentsPath, walkPath } from './util';
import { IEntry } from 'turbowalk';

export const mergeIniFiles = async (api: types.IExtensionApi) => {
  const state = api.getState();
  const activeProfile = selectors.activeProfile(state);
  if (activeProfile?.gameId !== GAME_ID) {
    return Promise.resolve();
  }
  const tweakIdSet = new Set<string>();
  try {
    await ensureIniMergeMod(api, activeProfile);
    const enabledMods = enabledModKeys(state);
    if (!enabledMods.some(m => m.type === MOD_TYPE_INI_TWEAKS)) {
      log('info', 'INI tweaks mod is disabled, skipping merge.');
      return Promise.resolve();
    }
    const modName = `${MERGED_INI_MOD_PREFIX}${activeProfile.name}`;
    const stagingPath = selectors.installPathForGame(state, GAME_ID);
    const targetMergeDir = path.join(stagingPath, modName, INI_TWEAKS_PATH_SEG);
    await fs.ensureDirWritableAsync(targetMergeDir);
    const existingMerges = await walkPath(targetMergeDir, { recurse: false });
    if (existingMerges.length > 0) {
      log('info', `Found existing INI merge files in ${targetMergeDir}, removing them.`);
      await Promise.all(existingMerges.map(entry => fs.removeAsync(entry.filePath)));
    }
    await enabledMods.reduce(async (prevP, mod) => {
      await prevP;
      if ([MOD_TYPE_INI_TWEAKS].includes(mod.type)) {
        // Filter out mods of unsupported type.
        return Promise.resolve();
      }
      if (!mod.installationPath) {
        log('warn', `Mod ${mod.id} does not have an installation path, skipping INI merge.`);
        return Promise.resolve();
      }
      const fileEntries: IEntry[] = await walkPath(path.join(stagingPath, mod.installationPath), { recurse: true });
      const filteredEntries = fileEntries
        .filter(entry => isFileSupported(path.basename(entry.filePath)))
        .map(entry => entry.filePath);
      for (const filePath of filteredEntries) {
        const tweakId = `[${path.basename(filePath, path.extname(filePath))}].ini`;
        if (!tweakIdSet.has(tweakId)) tweakIdSet.add(tweakId);
        await mergeIni(api, filePath, targetMergeDir);
      }
      return Promise.resolve();
    }, Promise.resolve());
    const batched = Array.from(tweakIdSet).map(tweakId => actions.setINITweakEnabled(GAME_ID, modName, tweakId, true));
    util.batchDispatch(api.store, batched);
  } catch (err) {
    api.showErrorNotification('Failed to create INI merge mod', err, { allowReport: false });
    return Promise.resolve();
  }
}

const mergeIni = async (api: types.IExtensionApi, modFilePath: string, targetMergeDir: string) => {
  const modData = await fs.readFileAsync(modFilePath, { encoding: 'utf8' });
  const tweakId = `[${path.basename(modFilePath, path.extname(modFilePath))}].ini`;
  const modIniData = ini.parse(modData);
  const currentIniFile = await parseIniFile(api, modFilePath, targetMergeDir);
  const mergedIniData = (currentIniFile.length > 2)
    ? ini.parse(currentIniFile)
    : {};
  Object.keys(modIniData).forEach(section => {
    if (!mergedIniData[section]) {
      mergedIniData[section] = modIniData[section];
    } else {
      Object.keys(modIniData[section]).forEach(key => {
        mergedIniData[section][key] = modIniData[section][key];
      });
    }
  });

  const mergedIniString = ini.stringify(mergedIniData);
  await fs.ensureDirWritableAsync(targetMergeDir);
  return fs.writeFileAsync(path.join(targetMergeDir, tweakId), mergedIniString);
}

const isFileSupported = (fileName: string): boolean => {
  return SUPPORTED_INI_FILES.includes(fileName.toLowerCase());
}

async function parseIniFile(api: types.IExtensionApi, modFilePath: string, mergeDirPath: string) {
  const state = api.store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if (!discovery?.path) {
    return Promise.reject({ code: 'ENOENT', message: 'Game is not discovered' });
  }
  const tweakId = `[${path.basename(modFilePath, path.extname(modFilePath))}].ini`;
  const iniFilePath = path.join(getDocumentsPath(), path.basename(modFilePath));
  const mergedFilePath = path.join(mergeDirPath, tweakId);
  const backupFilePath = iniFilePath + '.base';
  try {
    if (await fileExists(mergedFilePath)) {
      return fs.readFileAsync(mergedFilePath, { encoding: 'utf8' });
    }
    if (await fileExists(backupFilePath)) {
      return fs.readFileAsync(backupFilePath, { encoding: 'utf8' });
    }
    return fs.readFileAsync(iniFilePath, { encoding: 'utf8' });
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function mergeIniFilesAsync(filePaths: string[]): Promise<Record<string, any>> {
  const mergedConfig: Record<string, any> = {};
  for (const filePath of filePaths) {
    try {
      const content = await fs.readFileAsync(filePath, 'utf-8');
      const parsed = ini.parse(content);
      mergeObjects(mergedConfig, parsed);
    } catch (err) {
      console.warn(`Could not read or parse file: ${filePath}`, err);
    }
  }

  return mergedConfig;
}

function mergeObjects(target: Record<string, any>, source: Record<string, any>) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object'
      && !Array.isArray(source[key])
      && source[key] !== null) {
      if (!target[key]) {
        target[key] = {};
      }
      mergeObjects(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

export async function createIniMergeMod(api: types.IExtensionApi, modName: string, profile: types.IProfile) {
  const mod = {
    id: modName,
    state: 'installed',
    attributes: {
      name: 'Oblivion Remastered INI Merge Mod',
      description: 'This mod is a collective merge of configuration files found across '
        + 'the mods which the user has installed. Feel free to disable this mod if not required.',
      logicalFileName: 'OBR INI Merge Mod',
      modId: 42,
      version: '1.0.0',
      installTime: new Date(),
    },
    installationPath: modName,
    type: MOD_TYPE_INI_TWEAKS,
  };

  return await new Promise<void>((resolve, reject) => {
    api.events.emit('create-mod', profile.gameId, mod, async (error) => {
      if (error !== null) {
        return reject(error);
      }
      resolve();
    });
  });
}

export async function ensureIniMergeMod(api: types.IExtensionApi, profile: types.IProfile) {
  const state = api.store.getState();
  const modName = `${MERGED_INI_MOD_PREFIX}${profile.name}`;
  const mod = util.getSafe(state, ['persistent', 'mods', profile.gameId, modName], undefined);
  if (mod === undefined) {
    try {
      await createIniMergeMod(api, modName, profile);
    } catch (err) {
      return Promise.reject(err);
    }
  } else {
    const batched = [
      actions.setModAttribute(profile.gameId, modName, 'installTime', new Date()),
      actions.setModAttribute(profile.gameId, modName, 'name', 'OBR INI Merge Mod'),
      actions.setModAttribute(profile.gameId, modName, 'type', MOD_TYPE_INI_TWEAKS),
      actions.setModAttribute(profile.gameId, modName, 'logicalFileName', 'OBR INI Merge Mod'),
      actions.setModAttribute(profile.gameId, modName, 'modId', 42),
      actions.setModAttribute(profile.gameId, modName, 'version', '1.0.0'),
    ];
    util.batchDispatch(api.store, batched);
  }
  return Promise.resolve(modName);
}