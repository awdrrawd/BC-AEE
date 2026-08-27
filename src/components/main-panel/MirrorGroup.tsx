import type {AeeLayerOverride} from '@/core/types';
import {t} from '@/i18n/i18n';
import {toggleMirror} from '@/controllers/uiController';
import {MirrorAxisInput} from '@/components/main-panel/MirrorAxisInput';
import {DragCheck} from '@/components/main-panel/DragCheck';
import type {DragMode} from '@/core/types';
import {MirrorButton} from '@/components/main-panel/MirrorButton';

export function MirrorGroup({layerOverride, activeDrag = null}: { layerOverride: AeeLayerOverride & { Opacity: number }; activeDrag?: DragMode }) {
  return <div className="mb-2">
    <div className="mb-1 text-sm text-zinc-100">{t('mirror-group-mode-title')} / {t('mirror-group-copy-title')} <span className="cursor-help" title={t('experimental-feature-tooltip')}>⚠️</span></div>
    <div className="mb-2 flex items-center justify-between gap-2">
        <span className="w-14 shrink-0 text-sm text-zinc-100">{t('mirror-group-mode-title')}</span>
        <div className="flex items-center gap-1">
          <MirrorButton active={!!layerOverride.FlipX} label={t('mirror-group-mode-horizontal-button')}
                        onClick={() => toggleMirror('FlipX')}/>
          <MirrorButton active={!!layerOverride.FlipY} label={t('mirror-group-mode-vertical-button')}
                        onClick={() => toggleMirror('FlipY')}/>
        </div>
    </div>
    <div className="mb-2 flex items-center justify-between gap-2">
        <span className="w-14 shrink-0 text-sm text-zinc-100">{t('mirror-group-copy-title')}</span>
        <div className="flex items-center gap-1">
          <MirrorButton active={!!layerOverride.MirrorCopy} label={t('mirror-group-copy-horizontal-button')}
                        onClick={() => toggleMirror('MirrorCopy')}/>
          <MirrorButton active={!!layerOverride.MirrorCopyV} label={t('mirror-group-copy-vertical-button')}
                        onClick={() => toggleMirror('MirrorCopyV')}/>
          <DragCheck mode="mirror" label={t('edit-section-position-drag-label')} activeDrag={activeDrag}/>
        </div>
    </div>
    <div className="flex flex-col gap-2 text-[11px] text-zinc-400">
      <MirrorAxisInput label="H" ctrl="fcx" value={layerOverride.MirrorCopyAxisX ?? 0.5}/>
      <MirrorAxisInput label="V" ctrl="fcy" value={layerOverride.MirrorCopyAxisY ?? 0.5}/>
    </div>
  </div>;
}
