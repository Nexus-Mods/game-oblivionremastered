import { createAction } from 'redux-act';

export const setOblivionMigrationVersion = createAction('OBLIVION_REMASTER_SET_MIGRATION_VERSION', (version: string) => ({ version }));
