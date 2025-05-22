import semver from 'semver';
import { types, util } from 'vortex-api';

import { setOblivionMigrationVersion } from './actions';
import { GAME_ID } from './common';

const MIGRATIONS = {
};

export async function migrate(api: types.IExtensionApi): Promise<void> {
  const state = api.getState();
  const requiredMigrations = [];
  const lastMigrationVersion = util.getSafe(state, ['settings', GAME_ID, 'migrations', 'lastOblivionMigrationVersion'], '0.0.0');
  for (const [version, migration] of Object.entries(MIGRATIONS)) {
    if (semver.gt(version, lastMigrationVersion)) {
      requiredMigrations.push({ version, migration });
    }
  }

  if (requiredMigrations.length === 0) {
    return;
  }

  try {
    for (const entry of requiredMigrations) {
      await entry.migration(api);
    }
    const newVersion = requiredMigrations[requiredMigrations.length - 1].version;
    api.store.dispatch(setOblivionMigrationVersion(newVersion));
  } catch (err) {
    api.showErrorNotification('Failed to migrate', err);
  }

  return;
}
