import { types, util } from 'vortex-api';
import { setOblivionMigrationVersion } from './actions';

export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [setOblivionMigrationVersion as any]: (state, payload) => {
      const { version } = payload;
      return util.setSafe(state, ['lastOblivionMigrationVersion'], version);
    },
  },
  defaults: {},
};
