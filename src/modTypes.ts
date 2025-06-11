/* eslint-disable */
import path from 'path';
import { log, selectors, types } from 'vortex-api';
import {
  BPPAK_MODSFOLDER_PATH, PAK_MODSFOLDER_PATH,
  PAK_MOD_EXTENSIONS, IGNORE_CONFLICTS, LUA_EXTENSIONS, UE_PAK_TOOL_FILES, MOD_TYPE_PAK, MOD_TYPE_BP_PAK,
  DATA_PATH,
  GAME_ID,
  BINARIES_PATH
} from './common';
import { getGamebryoPatterns, getStopPatterns, getTopLevelPatterns, testStopPatterns } from './stopPatterns';
import { resolveUE4SSPath, findInstallFolderByFile } from './util';

//#region Utility
const hasModTypeInstruction = (instructions: types.IInstruction[]) => instructions.find(instr => instr.type === 'setmodtype');
//#endregion

export function getRootPath(api: types.IExtensionApi, game: types.IGame) {
  const discovery = selectors.discoveryByGame(api.getState(), game.id);
  if (!discovery || !discovery.path) {
    return '.';
  }
  return discovery.path;
}

export async function testRootPath(
    api: types.IExtensionApi,
    instructions: types.IInstruction[]
): Promise<boolean> {
    // Skip if another installer has already set modtype
    if (hasModTypeInstruction(instructions)) {
        return false;
    }
    // Detect FOMOD package by ModuleConfig.xml in copy list
    return instructions.some(inst =>
        inst.type === 'copy' &&
        path.basename(inst.source as string).toLowerCase() === 'moduleconfig.xml'
    );
}

//#region MOD_TYPE_PAK
export function getPakPath(api: types.IExtensionApi, game: types.IGame) {
  const discovery = selectors.discoveryByGame(api.getState(), game.id);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const pakPath = path.join(discovery.path, PAK_MODSFOLDER_PATH);
  return pakPath;
}

export async function testPakPath(api: types.IExtensionApi, instructions: types.IInstruction[]): Promise<boolean> {
  if (hasModTypeInstruction(instructions)) {
    return Promise.resolve(false);
  }

  const filteredPaks = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy')
      && (PAK_MOD_EXTENSIONS.includes(path.extname(inst.source as any))));

  const excludeInstructions: types.IInstruction[] = instructions.filter((inst => {
    if (inst.type !== 'copy') return false;
    const segments = inst.source.split(path.sep);
    if (IGNORE_CONFLICTS.includes(segments[segments.length - 1])) {
      return true;
    }
    return false;
  }))

  const supported = filteredPaks.length > 0 && excludeInstructions.length === 0;
  return Promise.resolve(supported) as any;
}
//#endregion

//#region MOD_TYPE_BINARIES
export function getBinariesPath(api: types.IExtensionApi) {
  const discovery = selectors.discoveryByGame(api.getState(), GAME_ID);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const gameStore = discovery.store ?? 'steam';
  const architecture = gameStore === 'xbox' ? 'WinGDK' : 'Win64';
  const binariesPath = path.join(discovery.path, BINARIES_PATH, architecture);
  return binariesPath;
}

export function testBinariesPath(instructions: types.IInstruction[]): Promise<boolean> {
  if (hasModTypeInstruction(instructions)) {
    return Promise.resolve(false);
  }
  const filtered = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy')
      && (['.dll'].includes(path.extname(inst.source))));

  const supported = filtered.length > 0;
  return Promise.resolve(supported) as any;
}
//#endregion

//#region MOD_TYPE_DATAPATH
export function getDataPath(api: types.IExtensionApi) {
  const discovery = selectors.discoveryByGame(api.getState(), GAME_ID);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const dataPath = path.join(discovery.path, DATA_PATH);
  return dataPath;
}

export function testDataPath(instructions: types.IInstruction[]): Promise<boolean> {
  // We want to sort the instructions so that the longest paths are first
  //  this will make the modType recognition faster.
  const dataLevelPatterns = getGamebryoPatterns(true);
  const isDataLevel = () => testStopPatterns(instructions, dataLevelPatterns);
  // Make sure the instructions aren't data level first
  const supported = isDataLevel();
  return Promise.resolve(supported) as any;
}
//#endregion

//#region MOD_TYPE_LUA
export function getLUAPath(api: types.IExtensionApi, game: types.IGame) {
  const discovery = selectors.discoveryByGame(api.getState(), game.id);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const ue4ssPath = resolveUE4SSPath(api);
  const luaPath = path.join(discovery.path, ue4ssPath);
  return luaPath;
}

export function testLUAPath(instructions: types.IInstruction[]): Promise<boolean> {
  if (hasModTypeInstruction(instructions)) {
    return Promise.resolve(false);
  }
  // Pretty basic set up right now.
  const filtered = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy')
      && (LUA_EXTENSIONS.includes(path.extname(inst.source as any))));

  const supported = filtered.length > 0;
  return Promise.resolve(supported) as any;
}
//#endregion

//#region MOD_TYPE_BP_PAK
export function getBPPakPath(api: types.IExtensionApi, game: types.IGame) {
  const discovery = selectors.discoveryByGame(api.getState(), game.id);
  if (!discovery || !discovery.path) {
    return '.';
  }
  const luaPath = path.join(discovery.path, BPPAK_MODSFOLDER_PATH);
  return luaPath;
}

export async function testBPPakPath(api: types.IExtensionApi, instructions: types.IInstruction[]): Promise<boolean> {
  if (hasModTypeInstruction(instructions)) {
    return false;
  }
  const filteredPaks = instructions
    .filter((inst: types.IInstruction) => {
      if (inst.type !== 'copy') {
        return false;
      }
      if (!PAK_MOD_EXTENSIONS.includes(path.extname(inst.source as any))) {
        return false;
      }
      const segments = inst.source.toLowerCase().split(path.sep);
      if (!segments.includes('logicmods')) {
        return false;
      }
      return true;
    });

  const supported = filteredPaks.length > 0;
  return Promise.resolve(supported) as any;
}
//#endregion
