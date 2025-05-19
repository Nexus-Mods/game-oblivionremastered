import { types, util } from 'vortex-api';
import { setOblivionMigrationVersion, setLoadOrderRedundancy, setLoadOrderManagementType } from './actions';

export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [setOblivionMigrationVersion as any]: (state, payload) => {
      const { version } = payload;
      return util.setSafe(state, ['migrations', 'lastOblivionMigrationVersion'], version);
    },
    [setLoadOrderManagementType as any]: (state, payload) => {
      const { profileId, type } = payload;
      return util.setSafe(state, ['loadOrderManagementType', profileId], type);
    }
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