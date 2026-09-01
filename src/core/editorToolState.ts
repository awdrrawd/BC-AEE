import type {AeeState} from '@/core/types';

export function isCanvasGestureActive(state: AeeState) {
  return !!state.activeDrag || state.editTool === 'gizmo';
}

export function clearCanvasGesture(draft: AeeState) {
  draft.activeDrag = null;
  draft.rotationOverlayOpen = false;
  if (draft.editTool === 'gizmo') draft.editTool = null;
}
