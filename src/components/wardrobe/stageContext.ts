import {createContext, useContext} from 'react';

export interface StageInfo {
  /** Screen pixels per virtual pixel — used to convert pointer deltas into stage coordinates. */
  scale: number;
  portrait: boolean;
}

export const StageContext = createContext<StageInfo>({scale: 1, portrait: false});

export function useStage(): StageInfo {
  return useContext(StageContext);
}
