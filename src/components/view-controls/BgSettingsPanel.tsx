import {useEffect, useRef, useState} from 'react';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {
  defaultBgSettingsPosition,
  moveBgSettings,
  openBgColorPicker,
  openBgSettings,
  setBgColor,
  setBgEnabled,
  setBgImageEnabled,
  setBgImageFile,
  setBgImageUrl,
  setGridEnabled,
  setGridColor,
  setGridLayer,
  setGridMode,
  setGridPx,
} from '@/controllers/backgroundController';
import {BgSection} from '@/components/view-controls/BgSection';
import {ColorSwatch, TextInput} from '@/components/ui/Fields';
import {Button} from '@/components/ui/Button';
import {X} from '@/components/view-controls/Icons';
import {Panel} from '@/components/ui/Panel';
import {RangeInput} from '@/components/main-panel/RangeInput';
import {useSetting} from '@/core/settings';
import {getViewSettings} from '@/core/viewSettings';
import {localBackgroundId} from '@/core/backgroundImageStore';
import {Pencil} from '@/components/main-panel/icons/Icons';

function ColorSettingRow({color, onChange, onPick}: {
  color: string;
  onChange: (color: string) => void;
  onPick: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(color);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setDraft(color); }, [color, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const raw = draft.trim();
    const value = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(value)) onChange(value.toUpperCase());
    else setDraft(color);
    setEditing(false);
  };

  return <div className="flex items-center gap-2">
    <span className="w-14 text-[13px] text-zinc-400">{t('background-settings-grid-color-label')}</span>
    <ColorSwatch color={color} checkerboard className="h-7 w-7" onClick={onPick}/>
    {editing
      ? <TextInput ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)}
                   className="h-7 w-20 font-mono text-[13px] uppercase" maxLength={7}
                   onBlur={commit} onKeyDown={event => {
                     if (event.key === 'Enter') commit();
                     else if (event.key === 'Escape') { setDraft(color); setEditing(false); }
                   }}/>
      : <span className="w-20 font-mono text-[13px] uppercase text-teal-300">{color}</span>}
    <Button iconOnly className="-ml-1 h-7 w-7" aria-label={t('background-settings-color-code-edit-button')}
            onPointerDown={event => event.preventDefault()} onClick={() => setEditing(true)}>
      <Pencil className="h-3.5 w-3.5"/>
    </Button>
    <Button className="ml-auto h-7" onClick={onPick}>{t('background-settings-solid-edit-button')}</Button>
  </div>;
}

export function BgSettingsPanel({state}: { state: AeeState }) {
  const view = getViewSettings();
  const bgColor = useSetting(view.bgColor);
  const bgEnabled = useSetting(view.bgEnabled);
  const bgGridColor = useSetting(view.bgGridColor);
  const bgGridEnabled = useSetting(view.bgGridEnabled);
  const bgGridLayer = useSetting(view.bgGridLayer);
  const bgGridMode = useSetting(view.bgGridMode);
  const bgGridPx = useSetting(view.bgGridPx);
  const bgImgEnabled = useSetting(view.bgImgEnabled);
  const bgImgUrl = useSetting(view.bgImgUrl);
  const [uploading, setUploading] = useState(false);
  const drag = useRef<{ pointerId: number; sx: number; sy: number; left: number; top: number } | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
          <ColorSettingRow color={bgColor} onChange={setBgColor} onPick={() => openBgColorPicker('solid')}/>
        </BgSection>
        <BgSection title={t('background-settings-grid-section-title')} enabled={bgGridEnabled}
                   onChange={setGridEnabled}>
          <ColorSettingRow color={bgGridColor} onChange={setGridColor} onPick={() => openBgColorPicker('grid')}/>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[13px] text-zinc-400">{t('background-settings-grid-size-label')}</span>
            <RangeInput className="h-1 min-w-0 flex-1 appearance-none rounded bg-zinc-800" min={5} max={200} step={5}
                        value={bgGridPx} onChange={setGridPx}/>
            <span className="w-9 text-right font-mono text-[13px] text-teal-300">{bgGridPx}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[13px] text-zinc-400">{t('background-settings-grid-style-label')}</span>
            <div className="ml-auto flex w-[65%] gap-1">
              <Button className="flex-1 text-[10px]" selected={bgGridMode === 'line'}
                      onClick={() => setGridMode('line')}>{t('background-settings-grid-line-mode-button')}</Button>
              <Button className="flex-1 text-[10px]" selected={bgGridMode === 'checker'}
                      onClick={() => setGridMode('checker')}>{t('background-settings-grid-checker-mode-button')}</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[13px] text-zinc-400">{t('background-settings-grid-position-label')}</span>
            <div className="ml-auto flex w-[65%] gap-1">
              <Button className="flex-1 text-[10px]" selected={bgGridLayer === 'above'}
                      onClick={() => setGridLayer('above')}>{t('background-settings-grid-layer-above-button')}</Button>
              <Button className="flex-1 text-[10px]" selected={bgGridLayer === 'below'}
                      onClick={() => setGridLayer('below')}>{t('background-settings-grid-layer-below-button')}</Button>
            </div>
          </div>
        </BgSection>
        <BgSection title={t('background-settings-image-section-title')} enabled={bgImgEnabled}
                   onChange={setBgImageEnabled}>
          <div className="flex items-center gap-1.5">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              setUploading(true);
              try {
                await setBgImageFile(file);
                if (urlRef.current) urlRef.current.value = '';
              } catch (error) {
                console.warn('[AEE] Failed to store background image', error);
              } finally {
                setUploading(false);
              }
            }}/>
            <TextInput ref={urlRef} type="text" className="min-w-0 flex-1 text-[13px]"
                       defaultValue={localBackgroundId(bgImgUrl) ? '' : bgImgUrl}
                       placeholder={localBackgroundId(bgImgUrl)
                         ? t('background-settings-image-uploaded-value')
                         : t('background-settings-image-url-placeholder')}/>
            <Button tone="primary" className="h-8" data-aee-tooltip={t('background-settings-image-load-tooltip')} onClick={() => {
              const value = urlRef.current?.value.trim() || '';
              if (value) setBgImageUrl(value);
            }}>{t('background-settings-image-load-button')}</Button>
            <Button disabled={uploading} className="h-8" data-aee-tooltip={t('background-settings-image-upload-tooltip')}
                    onClick={() => fileRef.current?.click()}>{t('background-settings-image-upload-short-button')}</Button>
            <Button tone="danger" iconOnly className="h-8 w-8 rounded-md" aria-label={t('background-settings-image-section-title')}
                    onClick={() => {
                      if (urlRef.current) urlRef.current.value = '';
                      setBgImageUrl('');
                    }}><X className="h-4 w-4"/></Button>
          </div>
        </BgSection>
      </div>
    </Panel>
  </div>;
}
