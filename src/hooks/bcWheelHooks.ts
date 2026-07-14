import {settings} from '@/core/settings';
import {withFilteredGroups} from '@/controllers/partsFilterController';

export function initBcWheelScroll() {
  const canvas = document.getElementById('MainCanvas');
  if (!canvas) return;

  canvas.addEventListener('wheel', (event: WheelEvent) => {
    if (CurrentScreen !== 'Appearance' || CharacterAppearanceMode !== '') return;

    withFilteredGroups(() => {
      if (CharacterAppearanceGroups.length <= CharacterAppearanceNumGroupPerPage) return;

      event.stopPropagation();
      event.preventDefault();

      if (!settings.bcWheelScroll.get()) return;

      if (!CharacterAppearanceSelection) return;
      CharacterAppearanceMoveGroup(CharacterAppearanceSelection, event.deltaY < 0 ? -1 : 1);
    });
  }, {passive: false, capture: true});
}
