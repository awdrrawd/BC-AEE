import type {AeeLayerOverride} from '@/core/types';
import {t} from '@/i18n/i18n';
import {resetEditProperty, toggleMirror} from '@/controllers/uiController';
import {MirrorAxisInput} from '@/components/main-panel/MirrorAxisInput';
import {MirrorButton} from '@/components/main-panel/MirrorButton';

export function MirrorGroup({layerOverride}: { layerOverride: AeeLayerOverride & { Opacity: number } }) {
  return <div className="mb-2">
    <div className="mb-1 text-xs font-bold tracking-wide text-zinc-100">{t('mirror-group-title')}</div>
    <div className="mb-1 grid grid-cols-2 gap-2">
      <div>
        <div
          className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-zinc-500">{t('mirror-group-mode-title')}</div>
        <div className="flex gap-1">
          <MirrorButton active={!!layerOverride.FlipX} label={t('mirror-group-mode-horizontal-button')} onClick={() => toggleMirror('FlipX')}/>
          <MirrorButton active={!!layerOverride.FlipY} label={t('mirror-group-mode-vertical-button')} onClick={() => toggleMirror('FlipY')}/>
        </div>
      </div>
      <div>
        <div
          className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-zinc-500">{t('mirror-group-copy-title')}</div>
        <div className="flex gap-1">
          <MirrorButton active={!!layerOverride.MirrorCopy} label={t('mirror-group-copy-horizontal-button')}
                        onClick={() => toggleMirror('MirrorCopy')}/>
          <MirrorButton active={!!layerOverride.MirrorCopyV} label={t('mirror-group-copy-vertical-button')}
                        onClick={() => toggleMirror('MirrorCopyV')}/>
        </div>
      </div>
    </div>
    <div className="flex w-full items-center gap-1 text-[11px] text-zinc-400">
      <span className="shrink-0">{t('mirror-group-axis-label')}</span>
      <MirrorAxisInput label="H" ctrl="fcx" value={layerOverride.MirrorCopyAxisX ?? 0.5}/>
      <MirrorAxisInput label="V" ctrl="fcy" value={layerOverride.MirrorCopyAxisY ?? 0.5}/>
      <button
        className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-red-300 hover:text-red-200"
        onClick={() => resetEditProperty('mc')}>↺
      </button>
    </div>
  </div>;
}
