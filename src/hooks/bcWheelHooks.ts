import {settings} from '@/core/settings';
import {withFilteredGroups} from '@/controllers/partsFilterController';

export function initBcWheelScroll() {
  const canvas = document.getElementById('MainCanvas');
  if (!canvas) return;

  canvas.addEventListener('wheel', (event: WheelEvent) => {
    if (!settings.bcWheelScroll.get()) return;
    if (CurrentScreen !== 'Appearance' || CharacterAppearanceMode !== '') return;

    withFilteredGroups(() => {
      if (CharacterAppearanceGroups.length <= CharacterAppearanceNumGroupPerPage) return;

      // Only swallow the wheel when there is actually a character to page;
      // otherwise let it fall through to the view controller zoom.
      if (!CharacterAppearanceSelection) return;

      event.stopPropagation();
      event.preventDefault();
      CharacterAppearanceMoveGroup(CharacterAppearanceSelection, event.deltaY < 0 ? -1 : 1);
    });
  }, {passive: false, capture: true});
}
