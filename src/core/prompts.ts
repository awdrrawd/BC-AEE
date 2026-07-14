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

export interface ListPrompt {
  kind: 'list';
  message: string;
  values: string[];
  suggestions: string[];
  placeholder?: string;
  resolve: (value: string[] | null) => void;
}

export type AeePrompt = TextPrompt | ConfirmPrompt | ListPrompt;
export type PromptResult = string | string[] | boolean | null;

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

export function askList(message: string, values: string[], options: {
  suggestions?: string[];
  placeholder?: string;
} = {}): Promise<string[] | null> {
  return new Promise(resolve => {
    store.patchState({
      prompt: {
        kind: 'list',
        message,
        values,
        suggestions: options.suggestions ?? [],
        placeholder: options.placeholder,
        resolve,
      },
    });
  });
}

export function settlePrompt(prompt: AeePrompt, value: PromptResult) {
  store.patchState({prompt: null});
  switch (prompt.kind) {
    case 'text':
      prompt.resolve(typeof value === 'string' ? value : null);
      break;
    case 'list':
      prompt.resolve(Array.isArray(value) ? value : null);
      break;
    default:
      prompt.resolve(value === true);
      break;
  }
}

export function dismissPrompt() {
  const {prompt} = store.getState();
  if (prompt) settlePrompt(prompt, prompt.kind === 'confirm' ? false : null);
}