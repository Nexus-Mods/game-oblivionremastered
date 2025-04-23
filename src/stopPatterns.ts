/* eslint-disable */
import { types } from 'vortex-api';

import { GAMEBRYO_PLUGIN_EXTENSIONS, LUA_EXTENSIONS, PAK_MOD_EXTENSIONS, TOP_LEVEL_DIRECTORIES } from './common';

function dirToWordExp(input: string, index?: number, array?: string[], escape?: boolean): string {
  return escape ? `(^|\/)${input}(\/|$)` : `(^|/)${input}(/|$)`;
}

function extToWordExp(input: string, index?: number, array?: string[], escape?: boolean): string {
  return escape ? `[^\/]*\\${input}$` : `[^/]*\\${input}$`;
}

function fileEndToWordExp(input: string) {
  // Wrap the input in a regex that will match a filename _exactly_ at the end of the filepath.
  return input + '$';
}

export function getGamebryoPatterns(escape: boolean = false): string[] {
  const uniPatterns: string[] = ['fomod'].map((val, idx, arr) => dirToWordExp(val.toLowerCase(), idx, arr, escape));
  const gamebryoFilePatterns = GAMEBRYO_PLUGIN_EXTENSIONS.map((val, idx, arr) => extToWordExp(val.toLowerCase(), idx, arr, escape));

  return [].concat(uniPatterns, gamebryoFilePatterns);
}

export function getStopPatterns(escape: boolean = false): string[] {
  const uniPatterns: string[] = ['fomod'].map((val, idx, arr) => dirToWordExp(val.toLowerCase(), idx, arr, escape));
  const gamebryoFilePatterns = GAMEBRYO_PLUGIN_EXTENSIONS.map((val, idx, arr) => extToWordExp(val.toLowerCase(), idx, arr, escape));
  const pakFilePatterns: string[] = PAK_MOD_EXTENSIONS.map((val, idx, arr) => extToWordExp(val.toLowerCase(), idx, arr, escape));
  const luaFilePatterns: string[] = LUA_EXTENSIONS.map((val, idx, arr) => extToWordExp(val.toLowerCase(), idx, arr, escape));
  const luaFolderPatterns: string[] = ['scripts'].map((val, idx, arr) => dirToWordExp(val.toLowerCase(), idx, arr, escape));

  // fomods first, followed by top level directories (Engine, OblivionRemastered, Resources), then everything else.
  return [].concat(uniPatterns, getTopLevelPatterns(), gamebryoFilePatterns, pakFilePatterns, luaFolderPatterns, luaFilePatterns);
}

export function getTopLevelPatterns(escape: boolean = false): string[] {
  // This function is used to generate the patterns for the root folder.
  //  We use these when attempting to ascertain the mod's modType.
  //  These patterns will be run first, and if they match then we can assume that the mod is a root folder mod.
  
  // The top level folders that are known to be deployed to the game's root folder.
  const topLevelDirs = TOP_LEVEL_DIRECTORIES.map((val, idx, arr) => dirToWordExp(val.toLowerCase(), idx, arr, escape));

  // The order still matters here, although we don't want to match too quickly as we may get false positives.
  return [].concat(topLevelDirs as any);
}

//#region StopPatterns utility functions
export function testStopPatterns(instructions: types.IInstruction[], patterns: string[]): boolean {
  // We want to sort the instructions so that the longest paths are first
  //  this will make the modType recognition faster.
  const sorted = instructions
    .filter(inst => inst.type === 'copy')
    .sort((a, b) => b.destination.length - a.destination.length);
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
  return runThroughPatterns(patterns);
}
//#endregion