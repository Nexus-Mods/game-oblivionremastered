/* eslint-disable */
import path from 'path';
import { fs, types, util } from 'vortex-api';
import { ExtensionRequirements, IExtensionRequirement } from './types';
import { findModByFile, findDownloadIdByPattern, getEnabledMods, resolveVersion } from './util';
import { getBinariesPath } from './modTypes';

export const DEBUG_ENABLED = false;
export const DEBUG_APP_VERSION = '1.13.7';
export const CONSTRAINT_LOOT_FUNCTIONALITY = '^1.14.0-beta.4';

export const GAME_ID = 'oblivionremastered';
export const NOTIF_ID_BP_MODLOADER_DISABLED = `notif-${GAME_ID}-bp-modloader-disabled`;
export const NOTIF_ID_REQUIREMENTS = `notif-${GAME_ID}-requirements-download-notification`;
export const NOTIF_ID_UE4SS_UPDATE = `notif-${GAME_ID}-ue4ss-version-update`;
export const NOTIF_ID_UE4SS_VARIABLE_LAYOUT = `notif-${GAME_ID}-ue4ss-member-variable-layout`;
export const NOTIF_ID_NATIVE_PLUGINS_ISSUES = `notif-${GAME_ID}-native-plugins-issues`;
export const NOTIF_ID_EXCLUDED_PLUGINS_DETECTED = `notif-${GAME_ID}-excluded-plugins-detected`;
export const NOTIF_ID_UE4SS_REQUIREMENT_CONSENT = `notif-${GAME_ID}-ue4ss-requirement-consent`;
export const NOTIF_ID_OBSE_REQUIREMENT_CONSENT = `notif-${GAME_ID}-obse64-requirement-consent`;
export const NOTIF_ID_LOOT_SORTING = `notif-${GAME_ID}-loot-sorting`;

export const NOTIFICATION_IDS = [
  NOTIF_ID_BP_MODLOADER_DISABLED,
  NOTIF_ID_REQUIREMENTS,
  NOTIF_ID_UE4SS_UPDATE,
  NOTIF_ID_UE4SS_VARIABLE_LAYOUT,
  NOTIF_ID_NATIVE_PLUGINS_ISSUES,
  NOTIF_ID_EXCLUDED_PLUGINS_DETECTED,
  NOTIF_ID_UE4SS_REQUIREMENT_CONSENT,
  NOTIF_ID_OBSE_REQUIREMENT_CONSENT,
  NOTIF_ID_LOOT_SORTING,
];

export const DIALOG_ID_RESET_PLUGINS_FILE = `dialog-${GAME_ID}-reset-plugins-file`;

export const DEFAULT_EXECUTABLE = 'OblivionRemastered.exe';
export const XBOX_EXECUTABLE = 'gamelaunchhelper.exe';
export const OBSE64_EXECUTABLE = 'obse64_loader.exe';

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

export const GAMEBRYO_PLUGIN_EXTENSIONS = ['.esp', '.esm'];
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

export const TOOL_ID_OBSE64 = 'tool-obse64';

export const MOD_TYPE_PAK = `${GAME_ID}-pak-modtype`;
export const MOD_TYPE_LUA = `${GAME_ID}-lua-modtype`;
export const MOD_TYPE_BP_PAK = `${GAME_ID}-blueprint-modtype`;
export const MOD_TYPE_UNREAL_PAK_TOOL = `${GAME_ID}-unreal-pak-tool-modtype`;
export const MOD_TYPE_DATAPATH = `${GAME_ID}-data-folder`;
export const MOD_TYPE_BINARIES = `${GAME_ID}-binaries-modtype`;

export const UE_PAK_TOOL_FILENAME = 'UnrealPakTool.zip';

const ue4ssFileArchivePattern = new RegExp(/^UE4SS.*/, 'i');
export const UE4SSRequirement: IExtensionRequirement = {
  id: 'ue4ss',
  userFacingName: 'Unreal Engine Scripting System',
  modType: '',
  assemblyFileName: UE4SS_DWMAPI,
  modId: 32,
  findMod: (api: types.IExtensionApi) => findModByFile(api, UE4SS_SETTINGS_FILE, '', false),
  findDownloadId: (api: types.IExtensionApi) => findDownloadIdByPattern(api, UE4SSRequirement),
  fileArchivePattern: ue4ssFileArchivePattern,
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

const obseFileArchivePattern = new RegExp(/^OBSE64.*\.7z$/, 'i');
const findOBSE64 = (api: types.IExtensionApi): Promise<types.IMod> => findModByFile(api, 'obse64_loader.exe', BINARIES_PATH, false);
export const obseRequirement: IExtensionRequirement = {
  id: 'obse64',
  userFacingName: 'OBSE64',
  modType: MOD_TYPE_BINARIES,
  modId: 282,
  fileArchivePattern: obseFileArchivePattern,
  findDownloadId: (api: types.IExtensionApi) => findDownloadIdByPattern(api, obseRequirement),
  findMod: (api: types.IExtensionApi) => findOBSE64(api),
  isRequired: async (api: types.IExtensionApi) => {
    try {
      const mod = await findOBSE64(api);
      if (mod) {
        return false; // OBSE64 is already present
      }
      // Check if OBSE64 is already present in the game folder
      const obseExecFilePath = path.join(getBinariesPath(api), OBSE64_EXECUTABLE);
      const hasOBSE64 = await fs.statAsync(obseExecFilePath).then(() => true).catch(() => false);
      return !hasOBSE64;
    } catch (err) {
      api.showErrorNotification('Failed to check for OBSE64 installation.', '', err);
    }
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
  steam: [].concat([obseRequirement], DEFAULT_REQUIREMENTS),
  xbox: DEBUG_ENABLED ? [].concat([obseRequirement], DEFAULT_REQUIREMENTS) : DEFAULT_REQUIREMENTS,
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

export const NATIVE_PLUGINS_EXCLUDED = [
  'altargymnavigation.esp',
  'tamrielleveledregion.esp',
];