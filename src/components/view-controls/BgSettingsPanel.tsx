import {useRef} from 'react';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {
  defaultBgSettingsPosition,
  moveBgSettings,
  openBgColorPicker,
  openBgSettings,
  setBgEnabled,
  setBgImageEnabled,
  setBgImageUrl,
  setGridEnabled,
  setGridLayer,
  setGridMode,
  setGridOpacity,
  setGridPx,
} from '@/controllers/backgroundController';
import {BgSection} from '@/components/view-controls/BgSection';
import {ColorSwatch, TextInput} from '@/components/ui/Fields';
import {Button} from '@/components/ui/Button';
import {X} from '@/components/view-controls/Icons';
import {Panel} from '@/components/ui/Panel';
import {NumberInput} from '@/components/main-panel/NumberInput';
import {RangeInput} from '@/components/main-panel/RangeInput';
import {useSetting} from '@/core/settings';
import {getViewSettings} from '@/core/viewSettings';

export function BgSettingsPanel({state}: { state: AeeState }) {
  const view = getViewSettings();
  const bgColor = useSetting(view.bgColor);
  const bgEnabled = useSetting(view.bgEnabled);
  const bgGridColor = useSetting(view.bgGridColor);
  const bgGridEnabled = useSetting(view.bgGridEnabled);
  const bgGridLayer = useSetting(view.bgGridLayer);
  const bgGridMode = useSetting(view.bgGridMode);
  const bgGridOpacity = useSetting(view.bgGridOpacity);
  const bgGridPx = useSetting(view.bgGridPx);
  const bgImgEnabled = useSetting(view.bgImgEnabled);
  const bgImgUrl = useSetting(view.bgImgUrl);
  const drag = useRef<{ pointerId: number; sx: number; sy: number; left: number; top: number } | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  if (!state.bg.settingsOpen) return null;
  const fallback = defaultBgSettingsPosition();
  const left = state.bg.panelLeft ?? fallback.left;
  const top = state.bg.panelTop ?? fallback.top;

  return <div className="fixed z-1000002 overflow-visible">
    <Panel className="fixed w-90"
           style={{left, top, transform: `scale(${state.canvasRect!.width / 2000 * 1.75})`, transformOrigin: 'top left'}}>
      <div
        className="flex min-h-[42px] cursor-grab items-center justify-between border-b border-zinc-700 bg-zinc-900 px-3 py-2 active:cursor-grabbing"
        onPointerDown={event => {
          if ((event.target as HTMLElement).closest('button')) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left, top};
        }}
        onPointerMove={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          moveBgSettings(drag.current.left + event.clientX - drag.current.sx, drag.current.top + event.clientY - drag.current.sy);
        }}
        onPointerUp={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          drag.current = null;
        }}
        onPointerCancel={event => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
        onLostPointerCapture={event => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
      >
        <span
          className="text-[13px] font-bold uppercase text-[var(--aee-accent)]">{t('background-settings-panel-title')}</span>
        <button type="button" className="h-[25px] w-[35px] rounded border border-red-800 bg-red-950/60 p-0 text-red-200 transition hover:border-red-300 hover:bg-red-900"
                aria-label={t('background-settings-panel-title')} onClick={() => openBgSettings(false)}><X className="mx-auto h-4 w-4"/></button>
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        <BgSection title={t('background-settings-solid-section-title')} enabled={bgEnabled} onChange={setBgEnabled}>
          <div className="flex items-center gap-2">
            <ColorSwatch color={bgColor} checkerboard className="h-8 w-8" onClick={() => openBgColorPicker('solid')}/>
            <span className="text-[13px] text-zinc-400">{t('background-settings-solid-click-to-pick')}</span>
          </div>
        </BgSection>
        <BgSection title={t('background-settings-grid-section-title')} enabled={bgGridEnabled}
                   onChange={setGridEnabled}>
          <div className="flex gap-1">
            <Button className="flex-1 text-[10px]" selected={bgGridMode === 'line'}
                    onClick={() => setGridMode('line')}>{t('background-settings-grid-line-mode-button')}</Button>
            <Button className="flex-1 text-[10px]" selected={bgGridMode === 'checker'}
                    onClick={() => setGridMode('checker')}>{t('background-settings-grid-checker-mode-button')}</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[13px] text-zinc-400">{t('background-settings-grid-color-label')}</span>
            <ColorSwatch color={bgGridColor} checkerboard className="h-7 w-7"
                         onClick={() => openBgColorPicker('grid')}/>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[13px] text-zinc-400">{t('background-settings-grid-size-label')}</span>
            <NumberInput
              className="w-14 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-center font-mono text-[13px] text-teal-300 outline-none focus:border-[var(--aee-accent)]"
              min={5} max={200} step={5} value={bgGridPx} onChange={setGridPx}/>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[13px] text-zinc-400">{t('background-settings-grid-opacity-label')}</span>
            <RangeInput className="h-1 flex-1 appearance-none rounded bg-zinc-800 accent-[var(--aee-accent)]" min={5}
                        max={80} step={5} value={Math.round(bgGridOpacity * 100)}
                        onChange={value => setGridOpacity(value / 100)}/>
            <span
              className="w-9 text-right font-mono text-[13px] text-teal-300">{Math.round(bgGridOpacity * 100)}%</span>
          </div>
          <div className="flex gap-1">
            <Button className="flex-1 text-[10px]" selected={bgGridLayer === 'below'}
                    onClick={() => setGridLayer('below')}>{t('background-settings-grid-layer-below-button')}</Button>
            <Button className="flex-1 text-[10px]" selected={bgGridLayer === 'above'}
                    onClick={() => setGridLayer('above')}>{t('background-settings-grid-layer-above-button')}</Button>
          </div>
        </BgSection>
        <BgSection title={t('background-settings-image-section-title')} enabled={bgImgEnabled}
                   onChange={setBgImageEnabled}>
          <div className="flex gap-1.5">
            <TextInput ref={urlRef} type="text"
                       className="min-w-0 flex-1 text-[13px]"
                       defaultValue={bgImgUrl} placeholder={t('background-settings-image-url-placeholder')}/>
            <Button tone="primary"
                    onClick={() => setBgImageUrl(urlRef.current?.value.trim() || '')}>{t('background-settings-image-load-button')}</Button>
            <Button tone="danger" iconOnly aria-label={t('background-settings-image-section-title')}
                    onClick={() => {
                      if (urlRef.current) urlRef.current.value = '';
                      setBgImageUrl('');
                    }}><X className="h-3.5 w-3.5"/></Button>
          </div>
        </BgSection>
      </div>
    </Panel>
  </div>;
}
