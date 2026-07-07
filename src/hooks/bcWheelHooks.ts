import {getAeeSetting} from '@/core/settings';
import {withFilteredGroups} from '@/controllers/partsFilterController';

export function initBcWheelScroll() {
  const canvas = document.getElementById('MainCanvas');
  if (!canvas) return;

  canvas.addEventListener('wheel', (event: WheelEvent) => {
    const currentScreen = typeof CurrentScreen !== 'undefined' ? CurrentScreen : null;
    if (currentScreen !== 'Appearance') return;

    const mode = typeof CharacterAppearanceMode !== 'undefined' ? CharacterAppearanceMode : null;
    if (mode !== '') return;

    withFilteredGroups(() => {
      if (typeof CharacterAppearanceGroups === 'undefined'
        || typeof CharacterAppearanceNumGroupPerPage === 'undefined') return;
      if (CharacterAppearanceGroups.length <= CharacterAppearanceNumGroupPerPage) return;

      // 奪取事件擁有權，讓設定能真正控制是否滾動（否則 BC 原生或 BC_LianDress 仍會處理）
      event.stopPropagation();
      event.preventDefault();

      if (!getAeeSetting('bcWheelScroll', false)) return;

      const C = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
      if (!C || typeof CharacterAppearanceMoveGroup !== 'function') return;
      CharacterAppearanceMoveGroup(C, event.deltaY < 0 ? -1 : 1);
    });
  }, {passive: false, capture: true});
}
