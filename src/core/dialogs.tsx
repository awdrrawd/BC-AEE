import type {ReactNode} from 'react';
import {createExternalStore} from '@/core/externalStore';

export interface OpenDialog {
  id: number;
  render: (close: () => void) => ReactNode;
}

const store = createExternalStore<{ dialogs: OpenDialog[] }>({dialogs: []});
let lastId = 0;

export function useDialogs(): OpenDialog[] {
  return store.useStore().dialogs;
}

export function openDialog(render: (close: () => void) => ReactNode): () => void {
  const id = ++lastId;
  store.patchState({dialogs: [...store.getState().dialogs, {id, render}]});
  return () => closeDialog(id);
}

export function closeDialog(id: number) {
  store.patchState({dialogs: store.getState().dialogs.filter(dialog => dialog.id !== id)});
}

export function closeAllDialogs() {
  if (store.getState().dialogs.length) store.patchState({dialogs: []});
}