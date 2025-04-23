import { types } from 'vortex-api';

export type LoadOrder = types.ILoadOrderEntry;
export type EventType = 'did-deploy' | 'gamemode-activated';
export type LoadOrderManagementType = 'gamebryo' | 'dnd';

export interface IPakFileInfo {
  fileName: string;
  offset: number;
  size: number;
  sha1: string;
  compression: string;
}

export interface IPakExtractionInfo {
  mountPoint: string;
  files: IPakFileInfo[];
  modType: string | null;
}

export interface IGitHubRelease {
  url: string;
  id: number;
  tag_name: string;
  name: string;
  assets: IGitHubAsset[];
  prerelease: boolean;
}

export interface IGitHubAsset {
  url: string;
  id: number;
  name: string;
  label: string | null;
  state: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
  release: IGitHubRelease;
}

export interface IGithubDownload {
  fileName: string;
  url: string;
}

export type GamesMap = { [gameId: string]: ModsMap };
export type ModsMap = { [modId: string]: types.IMod };

export type ExtensionRequirements = { [storeId: string]: IExtensionRequirement[] }
export interface IExtensionRequirement {
  // The unique id of this requirement
  id: string;
  // The name of the requirement to be displayed to the user
  userFacingName: string;
  // The mod type this requirement is for
  modType: string;
  assemblyFileName?: string;
  // The modId of the requirement, if applicable(nxm)
  modId?: number;
  // The URL to the github release page
  githubUrl?: string;
  // The URL to the mod page on Nexus Mods (used for fallback)
  modUrl?: string;
  // Used to determine the correct asset from GH
  fileArchivePattern?: RegExp;
  // Used to simplify the process of finding out if the requirement is installed
  findMod?: (api: types.IExtensionApi) => Promise<types.IMod>;
  // Used to find the download id of the mod
  findDownloadId?: (api: types.IExtensionApi) => string;
  // We may need to resolve the version of some requirements
  resolveVersion?: (api: types.IExtensionApi) => Promise<string>;
  fileFilter?: (file: string) => boolean;
}

export interface ISerializableData {
  // The prefix we want to add to the folder name on deployment.
  prefix: string;
}
