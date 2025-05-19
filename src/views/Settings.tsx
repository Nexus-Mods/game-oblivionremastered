/* eslint-disable */
import * as React from 'react';
import { ControlLabel, DropdownButton, FormGroup, Panel, MenuItem, HelpBlock } from 'react-bootstrap';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { MainContext, More, selectors, types, util } from 'vortex-api';

import { setLoadOrderManagementType } from '../actions';

import { NS, GAME_ID } from '../common';

import { setPluginManagementEnabled, switchToLoot } from '../util';
import { LoadOrderManagementType } from '../types';
import { useTranslation } from 'react-i18next';

interface IBaseProps {
  allowLootSorting: () => boolean;
  sort: () => Promise<void>;
}

interface IConnectedProps {
  activeProfile: types.IProfile;
  loManagementType: LoadOrderManagementType;
}

type IProps = IBaseProps;

const dropDownItems: { [value: string]: string } = {
  dnd: 'Drag and Drop (Default)',
  gamebryo: 'Rules-based (Classic)',
};

function renderLOManagementType(props: IBaseProps & IConnectedProps): JSX.Element {
  const { t } = useTranslation(NS);
  const { activeProfile } = props;
  const context = React.useContext(MainContext);
  const [selected, setSelected] = React.useState(dropDownItems[props.loManagementType]);
  const dispatch = useDispatch();
  const store = useStore();
  const onSetManageType = React.useCallback((evt) => {
    if (props.allowLootSorting()) {
      context.api.showDialog('info', t('Changing Load Order management method'), {
        text: t('Are you sure you want to change how the load order is managed? Due to the differences in how each method works, there is the potential that some changes you\'ve made will be lost and will need re-doing.'),
      }, [
        { label: 'Cancel' },
        { label: 'Change' },
      ])
        .then(async (res) => {
          if (res.action === 'Change') {
            const api = context.api;
            const prev = props.loManagementType;
            dispatch(setLoadOrderManagementType(activeProfile.id, evt));
            setSelected(dropDownItems[evt]);
            setPluginManagementEnabled(context.api, evt === 'gamebryo');
            if (evt === 'gamebryo') {
              try {
                await switchToLoot(api);
              } catch (err) {
                dispatch(setLoadOrderManagementType(activeProfile.id, prev));
                setSelected(dropDownItems[prev]);
                setPluginManagementEnabled(context.api, false);
                return;
              }
            }
            api.events.emit('show-main-page', 'Dashboard', false);
          }
        })
    }
  }, [context, store, setSelected, activeProfile, dispatch]);
  return (
    <div>
      <DropdownButton
        id='sf-btn-set-management-type'
        title={t(selected)}
        dropup
        onSelect={onSetManageType}
        disabled={!props.allowLootSorting()}
      >
        {
          Object.entries(dropDownItems).map(([value, text]) => (
            <MenuItem key={value} eventKey={value} selected={value === selected}>{t(text)}</MenuItem>
          ))
        }
      </DropdownButton>
    </div>
  );
}

export default function Settings(props: IProps) {
  const { t } = useTranslation(NS);
  const connectedProps = useSelector(mapStateToProps);
  const combined = { ...props, ...connectedProps };
  return (
    <form id={`${GAME_ID}-settings-form`}>
      <FormGroup controlId='default-enable'>
        <ControlLabel className={`${GAME_ID}-settings-heading`}>{t('Oblivion Remastered Settings')}</ControlLabel>
        <Panel key='load-order-management-method'>
          <Panel.Body>
            <ControlLabel className={`${GAME_ID}-settings-subheading`}>
              {t('Load Order Management Method')}
              <More id='more-deploy' name={t('Mangement Methods')} >
                {t('Default uses the "Load Order" page which allows plugins to be sorted via drag and drop and also via LOOT. Classic uses the "Plugins" page that will be familiar for modders of other Bethesda games and is an automated rules-based approach via LOOT.')}
              </More>
            </ControlLabel>
            {renderLOManagementType(combined)}
            <HelpBlock>
              {t('Switch between the load order management methods, Drag and Drop (Default) or Rules-based (Classic).')}
            </HelpBlock>
          </Panel.Body>
        </Panel>
      </FormGroup>
    </form>
  );
}

function mapStateToProps(state: any): IConnectedProps {
  const profile = selectors.activeProfile(state);
  return {
    activeProfile: profile,
    loManagementType: util.getSafe(state, ['settings', GAME_ID, 'loadOrderManagementType', profile.id], 'dnd'),
  };
}