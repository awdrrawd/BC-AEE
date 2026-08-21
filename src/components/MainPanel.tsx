import type {AeeState} from '@/core/types';
import {PartsFloat} from '@/components/main-panel/PartsFloat';

export function MainPanel({state}: { state: AeeState }) {
  return <PartsFloat state={state}/>;
}
