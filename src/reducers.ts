import { types, util } from 'vortex-api';
import { setOblivionMigrationVersion, setLoadOrderRedundancy } from './actions';

export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [setOblivionMigrationVersion as any]: (state, payload) => {
      const { version } = payload;
      return util.setSafe(state, ['lastOblivionMigrationVersion'], version);
    },
  },
  defaults: {},
};

export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [setLoadOrderRedundancy as any]: (state, payload) => {
      const { loadOrder, profileId } = payload;
      return util.setSafe(state, ['redundancies', profileId], loadOrder);
    },
  },
  defaults: {},
}