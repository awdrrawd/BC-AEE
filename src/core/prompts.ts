import {createExternalStore} from '@/core/externalStore';

export interface TextPrompt {
  kind: 'text';
  message: string;
  defaultValue: string;
  placeholder?: string;
  resolve: (value: string | null) => void;
}

export interface ConfirmPrompt {
  kind: 'confirm';
  message: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
}

export type AeePrompt = TextPrompt | ConfirmPrompt;

const store = createExternalStore<{ prompt: AeePrompt | null }>({prompt: null});

export function usePrompt(): AeePrompt | null {
  return store.useStore().prompt;
}

export function askText(message: string, defaultValue = '', placeholder?: string): Promise<string | null> {
  return new Promise(resolve => {
    store.patchState({prompt: {kind: 'text', message, defaultValue, placeholder, resolve}});
  });
}

export function askConfirm(message: string, danger = false): Promise<boolean> {
  return new Promise(resolve => {
    store.patchState({prompt: {kind: 'confirm', message, danger, resolve}});
  });
}

export function settlePrompt(prompt: AeePrompt, value: string | null | boolean) {
  store.patchState({prompt: null});
  if (prompt.kind === 'text') prompt.resolve(typeof value === 'string' ? value : null);
  else prompt.resolve(value === true);
}

export function dismissPrompt() {
  const {prompt} = store.getState();
  if (prompt) settlePrompt(prompt, prompt.kind === 'text' ? null : false);
}
