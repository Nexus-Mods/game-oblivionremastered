/* eslint-disable */
import * as React from 'react';
import { useSelector } from 'react-redux';
import { Alert } from 'react-bootstrap';
import { MainContext, selectors, tooltip, types, util } from 'vortex-api';

import { GAME_ID, NS } from '../common';
import { forceRefresh, lootSortingAllowed } from '../util';

interface IConnectedProps {
  loadOrder: types.ILoadOrderEntry[];
  discovery: types.IDiscoveryResult;
}

export function InfoPanel() {
  const { api } = React.useContext(MainContext);
  const [isXbox, setIsXbox] = React.useState(false);
  const t = (input: string) => api.translate(input, { ns: NS });
  const { loadOrder, discovery } = useSelector(mapStateToProps);
  React.useEffect(() => {
    if (!isXbox && discovery?.store === 'xbox') {
      setIsXbox(true);
    }
  }, [isXbox, setIsXbox, discovery]);
  const renderXboxWarningEnabledSystem = () => {
    return isXbox ? (
      <Alert bsStyle='warning'>
        <p>{t('If you encounter the "This library isn\'t supported" error when launching the game - purge your mods and verify file integrity through the Xbox Game Pass App before deploying your mods again')}</p>
      </Alert>
    ) : null;
  };

  return (
    <>
      <p>
        {t(
          'Drag and Drop the plugins to reorder how the game loads them. Please note, this screen will show all plugins available in the plugins directory, regardless of whether they were installed by Vortex or not.'
        )}
      </p>
      <p>{t('Mod descriptions from mod authors may have information to determine the best order.')}</p>
      <h4>{t('Additional Information:')}</h4>
      <ul>
        <li>{t('Vortex will create the "plugins.txt" file (if missing) upon installation of new plugins.')}</li>
        <li>{t('If installing a collection - wait for it to complete before re-visiting this page.')}</li>
        <li>{t('Press the "Remove Plugins File" button if your "plugins.txt" file is in a corrupted state. This will remove the file entirely.')}</li>
        <li>{t('Press the "Refresh List" button to refresh/sync changes.')}</li>
        {displayLootInstruction(api, t)}
      </ul>
    </>
  );
}

function displayLootInstruction(api: types.IExtensionApi, t: any) {
  return lootSortingAllowed(api)
    ? <li>{t('Press the "Sort via LOOT" button to sort your plugins based on the Oblivion Remastered masterlist.')}</li>
    : null;
}

function mapStateToProps(state: any): IConnectedProps {
  const profile = selectors.activeProfile(state);
  return {
    loadOrder: util.getSafe(state, ['persistent', 'loadOrder', profile?.id], []),
    discovery: selectors.discoveryByGame(state, GAME_ID),
  };
}
