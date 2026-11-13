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
    const value = typeof next === 'function' ? (next as (current: T) => T)(state) : next;
    if (Object.is(state, value)) return;
    state = value;
    listeners.forEach(listener => listener());
  };
  const patchState = (patch: Partial<T>) => {
    const keys = Object.keys(patch) as (keyof T)[];
    if (keys.some(key => !Object.is(state[key], patch[key]))) setState({...state, ...patch});
  };
  const useStore = () => useSyncExternalStore(subscribe, getState, getState);

  return {getState, setState, patchState, subscribe, useStore};
}
