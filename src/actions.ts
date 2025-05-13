import { createAction } from 'redux-act';
import { actions, types, selectors, util } from 'vortex-api';

import { GAME_ID } from './common';

export const setOblivionMigrationVersion = createAction('SET_OBLIVION_REMASTER_MIGRATION_VERSION', (version: string) => ({ version }));

export const setLoadOrderRedundancy = createAction('SET_OBLIVION_REMASTER_LOADORDER_REDUNDANCY', (profileId: string, loadOrder: types.LoadOrder) => ({ profileId, loadOrder }));

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