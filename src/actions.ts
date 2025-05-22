import { createAction } from 'redux-act';
import { actions, types, selectors, util } from 'vortex-api';

import { GAME_ID } from './common';
import { LoadOrderManagementType } from './types';

export const setOblivionMigrationVersion = createAction('SET_OBLIVION_REMASTERED_MIGRATION_VERSION',
  (version: string) => ({ version }));

export const setLoadOrderManagementType = createAction('SET_OBLIVION_REMASTERED_LOAD_ORDER_MANAGEMENT_TYPE',
  (profileId: string, type: LoadOrderManagementType) => ({ profileId, type }));

// No longer required as of Vortex 1.14.0-beta.3
export const setLoadOrderRedundancy = createAction('SET_OBLIVION_REMASTERED_LOADORDER_REDUNDANCY',
  (profileId: string, loadOrder: types.LoadOrder) => ({ profileId, loadOrder }));

// This will apply the saved load order and clear the redundancy
export const applyLoadOrderRedundancy = (api: types.IExtensionApi, profileId: string) => {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId); 
  const gameId = profile?.gameId;
  if (gameId !== GAME_ID) {
    return;
  }

  const loadOrder = util.getSafe(state, ['session', GAME_ID, 'redundancies', profileId], []);
  if (loadOrder.length > 0) {
    util.batchDispatch(api.store, [
      actions.setFBLoadOrder(profileId, loadOrder),
      setLoadOrderRedundancy(profileId, []),
    ]);
  }
  return;
};