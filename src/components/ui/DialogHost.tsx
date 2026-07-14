import {Fragment} from 'react';
import {closeDialog, useDialogs} from '@/core/dialogs';

export function DialogHost() {
  const dialogs = useDialogs();
  return <>
    {dialogs.map(dialog => <Fragment key={dialog.id}>
      {dialog.render(() => closeDialog(dialog.id))}
    </Fragment>)}
  </>;
}