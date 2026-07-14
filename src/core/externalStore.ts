import {useSyncExternalStore} from 'react';

export interface ExternalStore<T> {
  getState: () => T;
  setState: (next: T | ((current: T) => T)) => void;
  patchState: (patch: Partial<T>) => void;
  subscribe: (listener: () => void) => () => void;
  useStore: () => T;
}

export function createExternalStore<T>(initialState: T): ExternalStore<T> {
  let state = initialState;
  const listeners = new Set<() => void>();

  const getState = () => state;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const setState = (next: T | ((current: T) => T)) => {
    state = typeof next === 'function' ? (next as (current: T) => T)(state) : next;
    listeners.forEach(listener => listener());
  };
  const patchState = (patch: Partial<T>) => setState(current => ({...current, ...patch}));
  const useStore = () => useSyncExternalStore(subscribe, getState, getState);

  return {getState, setState, patchState, subscribe, useStore};
}
