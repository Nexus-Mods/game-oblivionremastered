/* eslint-disable */
import path from 'path';
import { types } from 'vortex-api';
import { ExtensionRequirements, IExtensionRequirement } from './types';
import { findModByFile, findDownloadIdByPattern, getEnabledMods, resolveVersion } from './util';

export const DEBUG_ENABLED = false;
export const DEBUG_APP_VERSION = '1.12.0';
export const CONSTRAINT_LOOT_FUNCTIONALITY = '^1.12.0';

export const GAME_ID = 'oblivionremastered';
export const NOTIF_ID_BP_MODLOADER_DISABLED = `notif-${GAME_ID}-bp-modloader-disabled`;
export const NOTIF_ID_REQUIREMENTS = `notif-${GAME_ID}-requirements-download-notification`;
export const NOTIF_ID_UE4SS_UPDATE = `notif-${GAME_ID}-ue4ss-version-update`;

export const DIALOG_ID_RESET_PLUGINS_FILE = `dialog-${GAME_ID}-reset-plugins-file`;

export const DEFAULT_EXECUTABLE = 'OblivionRemastered.exe';
export const XBOX_EXECUTABLE = 'gamelaunchhelper.exe';

export const XBOX_APP_X_MANIFEST = 'appxmanifest.xml';

export const NS = `game-${GAME_ID}`;
export const XBOX_ID = 'BethesdaSoftworks.ProjectAltar';
export const STEAMAPP_ID = '2623190';

export const MAIN_UE_PATH = path.join('OblivionRemastered'); // Includes the Binaries, Content, etc folders.
export const BINARIES_PATH = path.join(MAIN_UE_PATH, 'Binaries');
export const DATA_PATH = path.join(MAIN_UE_PATH, 'Content', 'Dev', 'ObvData', 'Data');
export const PAK_MODSFOLDER_PATH = path.join(MAIN_UE_PATH, 'Content', 'Paks', '~mods'); // relative to game root
export const BPPAK_MODSFOLDER_PATH = path.join(MAIN_UE_PATH, 'Content', 'Paks', 'LogicMods');

export const LUA_EXTENSIONS = ['.lua'];
export const PAK_MOD_EXTENSIONS = ['.pak', '.utoc', '.ucas'];

export const GAMEBRYO_PLUGIN_EXTENSIONS = ['.esm', '.esp'];
export const GAMEBRYO_ASSET_EXTENSIONS = ['.bsa'];

export const MODS_FILE = 'mods.json';
export const MODS_FILE_BACKUP = 'mods.json.original';
export const UE4SS_ENABLED_FILE = 'enabled.txt';

export const IGNORE_CONFLICTS = [UE4SS_ENABLED_FILE, 'ue4sslogicmod.info', '.ue4sslogicmod', '.logicmod'];
export const IGNORE_DEPLOY = [MODS_FILE, MODS_FILE_BACKUP, UE4SS_ENABLED_FILE];

export const UE4SS_DWMAPI = 'dwmapi.dll';
export const UE4SS_MEMBER_VARIABLE_LAYOUT_FILE = 'MemberVariableLayout.ini';
export const UE4SS_SETTINGS_FILE = 'UE4SS-settings.ini';
export const UE4SS_FILES = [UE4SS_DWMAPI, UE4SS_SETTINGS_FILE];

export const UE_PAK_TOOL_FILES = [
  'UnrealPak.exe',
];

export const TOP_LEVEL_DIRECTORIES = [
  'Engine', MAIN_UE_PATH, 'Resources',
];

export const MOD_TYPE_PAK = `${GAME_ID}-pak-modtype`;
export const MOD_TYPE_LUA = `${GAME_ID}-lua-modtype`;
export const MOD_TYPE_BP_PAK = `${GAME_ID}-blueprint-modtype`;
export const MOD_TYPE_UNREAL_PAK_TOOL = `${GAME_ID}-unreal-pak-tool-modtype`;
export const MOD_TYPE_DATAPATH = `${GAME_ID}-data-folder`;
export const MOD_TYPE_BINARIES = `${GAME_ID}-binaries-modtype`;

export const UE_PAK_TOOL_FILENAME = 'UnrealPakTool.zip';

export const UE4SSRequirement: IExtensionRequirement = {
  id: 'ue4ss',
  userFacingName: 'Unreal Engine Scripting System',
  modType: '',
  assemblyFileName: UE4SS_DWMAPI,
  githubUrl: 'https://api.github.com/repos/UE4SS-RE/RE-UE4SS',
  findMod: (api: types.IExtensionApi) => findModByFile(api, UE4SS_SETTINGS_FILE, '', false),
  fileArchivePattern: new RegExp(/^UE4SS.*v(\d+\.\d+\.\d+(-\w+(\.\d+)?)?)/, 'i'),
  isRequired: async (api: types.IExtensionApi) => {
    const enabledBPMods = getEnabledMods(api, MOD_TYPE_BP_PAK);
    const enabledLuaMods = getEnabledMods(api, MOD_TYPE_LUA);
    if ([].concat(enabledBPMods, enabledLuaMods).length === 0) {
      return false;
    }
    const isInstalled = await findModByFile(api, UE4SS_SETTINGS_FILE, '') !== undefined;
    if (!isInstalled) {
      return true;
    }
    return false;
  }
}

export const DEFAULT_REQUIREMENTS: IExtensionRequirement[] = [
  { 
    ...UE4SSRequirement,
    findDownloadId: (api: types.IExtensionApi) => findDownloadIdByPattern(api, UE4SSRequirement),
    resolveVersion: (api: types.IExtensionApi) => resolveVersion(api, UE4SSRequirement),
  },
];

export const EXTENSION_REQUIREMENTS: ExtensionRequirements = {
  steam: DEFAULT_REQUIREMENTS,
  xbox: DEFAULT_REQUIREMENTS,
};

export const PLUGINS_TXT = path.join(DATA_PATH, 'plugins.txt');
export const NATIVE_PLUGINS = [
  'oblivion.esm',
  'dlcbattlehorncastle.esp',
  'dlcfrostcrag.esp',
  'dlchorsearmor.esp',
  'dlcmehrunesrazor.esp',
  'dlcorrery.esp',
  'dlcshiveringisles.esp',
  'dlcspelltomes.esp',
  'dlcthievesden.esp',
  'dlcvilelair.esp',
  'knights.esp',
  'altarespmain.esp',
  'altardeluxe.esp',
  'altaresplocal.esp',
];