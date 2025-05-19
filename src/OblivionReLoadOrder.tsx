/* eslint-disable */
import React from 'react';
import path from 'path';
import { fs, log, selectors, types, util } from 'vortex-api';

import { DATA_PATH, GAME_ID, GAMEBRYO_PLUGIN_EXTENSIONS } from './common';
import { walkPath, serializePluginsFile, getManagementType,
  generateLoadOrderEntry, parsePluginsFile, forceRefresh
} from './util';

import { InfoPanel } from './views/InfoPanel';
import { testLoadOrderChangeDebouncer } from './tests';

class OblivionReLoadOrder implements types.ILoadOrderGameInfo {
  public static suppressValidation = false;
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
    const currIsAlphabeticallySorted = this.isSortedAlphabetically(loadOrder);
    let serializeableLoadOrder = [...loadOrder];
    if (currIsAlphabeticallySorted) {
      // LO should never be sorted alphabetically, try to use prev instead to avoid
      //  breaking the load order.
      // TODO: this is a temporary fix, we should find a better way to handle this in the core app.
      log('warn', 'Load order entries are not sorted alphabetically.');
      const prevIsAlphabeticallySorted = this.isSortedAlphabetically(prev);
      if (!prevIsAlphabeticallySorted) {
        serializeableLoadOrder = [...prev];
      }
    }
    return serializePluginsFile(this.mApi, serializeableLoadOrder)
      .then(() => testLoadOrderChangeDebouncer.schedule(undefined, this.mApi, serializeableLoadOrder));
  }

  public async deserializeLoadOrder(): Promise<types.LoadOrder> {
    const state = this.mApi.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    if (discovery?.path === undefined) {
      return Promise.resolve([]);
    }

    // Find out which plugins are actually deployed to the data folder.
    const fileEntries = await walkPath(path.join(discovery.path, DATA_PATH), { recurse: false });
    const confirmedPlugins = fileEntries.filter(file => GAMEBRYO_PLUGIN_EXTENSIONS.includes(path.extname(file.filePath)));
    const isInDataFolder = (plugin: string) =>
      confirmedPlugins.some(file => path.basename(file.filePath).toLowerCase() === plugin.toLowerCase());

    const currentLO = await parsePluginsFile(this.mApi, isInDataFolder);
    const confirmedPluginsWithState = confirmedPlugins.map(plugin => {
      const pluginName = path.basename(plugin.filePath).toLowerCase();
      const pluginInCurrentLO = currentLO.find(entry => entry.name.toLowerCase() === pluginName);
      return {
        ...plugin,
        enabled: pluginInCurrentLO ? pluginInCurrentLO.enabled : true,
      };
    });

    const loadOrderEntries = await Promise.all(confirmedPluginsWithState.map(confirmedPlugin =>
      generateLoadOrderEntry(this.mApi, {
        pluginName: path.basename(confirmedPlugin.filePath),
        enabled: confirmedPlugin.enabled,
      })));
    loadOrderEntries.sort((a, b) => {
      const indexA = currentLO.findIndex(entry => entry.id.toLowerCase() === a.id.toLowerCase());
      const indexB = currentLO.findIndex(entry => entry.id.toLowerCase() === b.id.toLowerCase());

      const isInvalidA = a.locked || a.data?.isInvalid;
      const isInvalidB = b.locked || b.data?.isInvalid;

      if (isInvalidA && !isInvalidB) {
        return 1; // a is invalid, move it to the bottom
      } else if (!isInvalidA && isInvalidB) {
        return -1; // b is invalid, move it to the bottom
      }

      if (indexA === -1 && indexB === -1) {
        return 0; // Both are not in currentLO, maintain their relative order
      } else if (indexA === -1) {
        return 1; // a is not in currentLO, move it to the bottom
      } else if (indexB === -1) {
        return -1; // b is not in currentLO, move it to the bottom
      } else {
        return indexA - indexB; // Sort based on their order in currentLO
      }
    });
    
    return Promise.resolve(loadOrderEntries);
  }

  public async validate(prev: types.LoadOrder, current: types.LoadOrder): Promise<types.IValidationResult | undefined> {
    if (OblivionReLoadOrder.suppressValidation) {
      OblivionReLoadOrder.suppressValidation = false;
      return Promise.resolve(undefined);
    }
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

  public condition(): boolean {
    return (getManagementType(this.mApi) === 'dnd');
  }

  private isSortedAlphabetically(loadOrder: types.LoadOrder): boolean {
    return loadOrder.every((entry, index, array) => {
      if (index === 0) return true;
      return array[index - 1].name.toLowerCase() <= entry.name.toLowerCase();
    });
  }
}

export default OblivionReLoadOrder;