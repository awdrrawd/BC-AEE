import {MASK_PRIORITY, PROP_KEY, PROP_SPS_KEY} from '../constants';
import {settings} from '@/core/settings';
import {slotLoad, slotExit} from './lifecycle';
import {slotDraw, slotClick} from './ui';

/** R132 serializes custom properties only when the extended item declares them. */
export function freeDrawExtendedConfig(index: number): NoArchItemConfig {
  return {
    Archetype: ExtendedArchetype.NOARCH,
    BaselineProperty: {
      [PROP_KEY]: '',
      [PROP_SPS_KEY]: null,
      OffsetX: 0,
      OffsetY: 0,
      MaskPriority: MASK_PRIORITY,
    },
    // Let BC install these callbacks on every asset registration/reload. Keep
    // its NOARCH Init so omitted default properties are restored on receipt.
    ScriptHooks: {
      Load: () => {
        if (!settings.enableFreeDraw.get()) {
          if (typeof DialogLeaveFocusItem === 'function') DialogLeaveFocusItem();
          return;
        }
        void slotLoad(index).catch(error => {
          console.error('[AEE Mask] Load 錯誤：', error);
          slotExit();
        });
      },
      Draw: () => { try { slotDraw(); } catch (error) { console.error('[AEE Mask] Draw 錯誤：', error); } },
      Click: () => { try { slotClick(); } catch (error) { console.error('[AEE Mask] Click 錯誤：', error); } },
      Exit: () => { try { slotExit(); } catch (error) { console.error('[AEE Mask] Exit 錯誤：', error); } },
    },
  };
}
