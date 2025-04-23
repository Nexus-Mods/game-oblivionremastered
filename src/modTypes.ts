/* eslint-disable */
import path from 'path';
import { log, selectors, types } from 'vortex-api';
import {
  BPPAK_MODSFOLDER_PATH, PAK_MODSFOLDER_PATH,
  PAK_MOD_EXTENSIONS, IGNORE_CONFLICTS, LUA_EXTENSIONS, UE_PAK_TOOL_FILES, MOD_TYPE_PAK, MOD_TYPE_BP_PAK,
  DATA_PATH,
  GAME_ID
} from './common';
import { getStopPatterns, getTopLevelPatterns } from './stopPatterns';
import { resolveUE4SSPath, findInstallFolderByFile } from './util';

import { listPak } from './unrealPakParser';

//#region Utility
const hasModTypeInstruction = (instructions: types.IInstruction[]) => instructions.find(instr => instr.type === 'setmodtype');

const runPakTool = async (api: types.IExtensionApi, instructions: types.IInstruction[]) => {
  let modDir: string = undefined;
  const filtered = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy') && (path.extname(inst.source) === '.pak'));
  for (const pak of filtered) {
    if (!modDir) {
      modDir = await findInstallFolderByFile(api, pak.source);
      if (!modDir) {
        return null;
      }
    }
    const data = await listPak(api, path.join(modDir, pak.source));
    return data.modType;
  }
}
//#endregion

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
  const sorted = instructions
    .filter(inst => inst.type === 'copy')
    .sort((a, b) => b.destination.length - a.destination.length);
  const dataLevelPatterns = getStopPatterns(true);
  const topLevelPatterns = getTopLevelPatterns(true);
  const runThroughPatterns = (patterns: string[]) => {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      for (const inst of sorted) {
        const normal = inst.destination.replace(/\\/g, '/');
        if (regex.test(normal)) {
          return true;
        }
      }
    }
    return false;
  };
  const isDataLevel = () => runThroughPatterns(dataLevelPatterns);
  const isTopLevel = () => runThroughPatterns(topLevelPatterns);
  // Make sure the instructions aren't data level first
  const supported = isDataLevel() ? true : isTopLevel() ? false : true;
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
    return Promise.resolve(false);
  }
  try {
    const modType = await runPakTool(api, instructions);
    if (modType && modType === MOD_TYPE_BP_PAK) {
      return true;
    }
  } catch (err) {
    // Pak tool fudged up - resume default stop pattern installation.
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

  const excludeInstructions: types.IInstruction[] = instructions.filter((inst => {
    if (inst.type !== 'copy') return false;
    const segments = inst.source.toLowerCase().split(path.sep);
    if (IGNORE_CONFLICTS.includes(segments[segments.length - 1])) {
      return true;
    }
    return false;
  }))

  const supported = filteredPaks.length > 0 && excludeInstructions.length === 0;
  return Promise.resolve(supported) as any;
}
//#endregion

//#region UnrealPakTool
// Pak tool only needs a test function.
export function testUnrealPakTool(instructions: types.IInstruction[]): Promise<boolean> {
  if (hasModTypeInstruction(instructions)) {
    return Promise.resolve(false);
  }
  const filtered = instructions
    .filter((inst: types.IInstruction) => (inst.type === 'copy')
      && UE_PAK_TOOL_FILES.includes(path.basename(inst.source)));

  const supported = filtered.length === UE_PAK_TOOL_FILES.length;
  return Promise.resolve(supported) as any;
}
//#endregion