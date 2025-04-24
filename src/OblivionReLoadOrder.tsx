/* eslint-disable */
import React from 'react';
import path from 'path';
import { fs, selectors, types, util } from 'vortex-api';

import { DATA_PATH, GAME_ID, GAMEBRYO_PLUGIN_EXTENSIONS, MOD_TYPE_DATAPATH } from './common';
import { walkPath, findModByFile, resolveNativePlugins,
  deserializePluginsFile, serializePluginsFile, getManagementType } from './util';

import { InfoPanel } from './views/InfoPanel';

class OblivionReLoadOrder implements types.ILoadOrderGameInfo {
  public gameId: string;
  public toggleableEntries?: boolean | undefined;
  public clearStateOnPurge?: boolean | undefined;
  public usageInstructions?: React.ComponentType<{}>;
  public noCollectionGeneration?: boolean | undefined;

  private mApi: types.IExtensionApi;

  constructor(api: types.IExtensionApi) {
    this.gameId = GAME_ID;
    this.clearStateOnPurge = false;
    this.toggleableEntries = true;
    this.noCollectionGeneration = undefined;
    this.usageInstructions = (() => (<InfoPanel/>));
  
    this.mApi = api;
    this.deserializeLoadOrder = this.deserializeLoadOrder.bind(this);
    this.serializeLoadOrder = this.serializeLoadOrder.bind(this);
    this.validate = this.validate.bind(this);
    this.condition = this.condition.bind(this);
  }

  public async serializeLoadOrder(loadOrder: types.LoadOrder, prev: types.LoadOrder): Promise<void> {
    return serializePluginsFile(this.mApi, loadOrder);
  }

  public async deserializeLoadOrder(): Promise<types.LoadOrder> {
    const state = this.mApi.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    if (discovery?.path === undefined) {
      return Promise.resolve([]);
    }

    const invalidEntries: types.LoadOrder = [];
    const loadOrder: types.LoadOrder = [];

    // Find out which plugins are actually deployed to the data folder.
    const fileEntries = await walkPath(path.join(discovery.path, DATA_PATH), { recurse: false });
    const plugins = fileEntries.filter(file => ['.esp', '.esm'].includes(path.extname(file.filePath)));

    const isInDataFolder = (plugin: string) => plugins.some(file => path.basename(file.filePath).toLowerCase() === plugin.toLowerCase());
    const isModEnabled = (modId: string) => {
      const state = this.mApi.getState();
      const profile = selectors.activeProfile(state);
      return util.getSafe(profile, ['modState', modId, 'enabled'], false);
    };

    const currentLO = await deserializePluginsFile(this.mApi);
    const deploymentNeeded = util.getSafe(this.mApi.getState(), ['persistent', 'deployment', 'needToDeploy', GAME_ID], false);
    for (const plugin of currentLO) {
      if (!GAMEBRYO_PLUGIN_EXTENSIONS.includes(path.extname(plugin.trim().slice(1)))) {
        continue;
      }
      const name = plugin.replace(/\#/g, '');
      const mod = await findModByFile(this.mApi, name);
      const invalid = deploymentNeeded
        ? false
        : mod !== undefined
          ? isModEnabled(mod.id) && !isInDataFolder(name)
          : !isInDataFolder(name);
      const enabled = !plugin.startsWith('#');
      const loEntry: types.ILoadOrderEntry = {
        enabled: enabled && !invalid,
        id: name,
        name: name,
        modId: !!mod?.id ? isModEnabled(mod.id) ? mod.id : undefined : undefined,
        locked: invalid,
        data: {
          isInvalid: invalid,
        }
      }
      if (invalid) {
        invalidEntries.push(loEntry);
      } else {
        if (isInDataFolder(name)) {
          loadOrder.push(loEntry);
        }
      }
    }

    for (const plugin of plugins) {
      const pluginName = path.basename(plugin.filePath);
      if (loadOrder.find(entry => entry.name === pluginName)) {
        continue;
      }
      const mod = await findModByFile(this.mApi, pluginName);
      const loEntry: types.ILoadOrderEntry = {
        enabled: true,
        id: pluginName,
        name: pluginName,
        modId: !!mod?.id ? isModEnabled(mod.id) ? mod.id : undefined : undefined,
      }
      loadOrder.push(loEntry);
    }

    return Promise.resolve(loadOrder);
  }

  public async validate(prev: types.LoadOrder, current: types.LoadOrder): Promise<types.IValidationResult | undefined> {
    const state = this.mApi.getState();
    const invalid: { id: string, reason: string }[] = [];
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    const dataPath = path.join(discovery.path, DATA_PATH);
    for (const entry of current) {
      try {
        await fs.statAsync(path.join(dataPath, entry.name));
      } catch (err) {
        invalid.push({ id: entry.id, reason: 'File not found' });
      }
    }

    return invalid.length > 0 ? Promise.resolve({ invalid }) : Promise.resolve(undefined);
  }

  public async onFixInvalidPlugins(): Promise<void> {
    const deserialzed = await this.deserializeLoadOrder();
    const valid = deserialzed.filter(entry => entry.data?.isInvalid !== true);
    await this.serializeLoadOrder(valid, []);
    return Promise.resolve();
  }

  public condition(): boolean {
    return (getManagementType(this.mApi) === 'dnd');
  }
}

export default OblivionReLoadOrder;