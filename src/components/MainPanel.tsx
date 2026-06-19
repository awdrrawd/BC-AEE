import {type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent} from 'react';
import type {AeeState, AeeTab} from '@/core/types';
import {t} from '@/i18n/i18n';
import {getElementOverlayAnchor} from '@/core/overlay';
import {setTab, togglePartsOpen} from '@/controllers/uiController';
import {LayersIcon} from '@/components/icons/LayersIcon';
import {EditTab} from '@/components/main-panel/EditTab';
import {LayersTab} from '@/components/main-panel/LayersTab';
import {OpacityTab} from '@/components/main-panel/OpacityTab';
import {PartsFloat} from '@/components/main-panel/PartsFloat';
import {SettingsTab} from '@/components/main-panel/SettingsTab';
import {panelClass, panelTabs} from '@/components/main-panel/styles';
import {ToggleBar} from '@/components/main-panel/ToggleBar';

export function MainPanel({state}: { state: AeeState }) {
  const rect = state.canvasRect;
  if (!rect || !state.visible || !state.item) return null;
  const panelWidth = Math.max(200, Math.min(320, rect.width * 0.27));
  const toggleWidth = 34;
  const openParts = (event: ReactMouseEvent<HTMLButtonElement>) => {
    togglePartsOpen(undefined, getElementOverlayAnchor(event.currentTarget));
  };

  const tabOrder = panelTabs.map(([tab]) => tab) as AeeTab[];
  const onTabBarWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const currentIndex = tabOrder.indexOf(state.tab);
    const next = event.deltaY > 0
      ? tabOrder[(currentIndex + 1) % tabOrder.length]
      : tabOrder[(currentIndex - 1 + tabOrder.length) % tabOrder.length];
    setTab(next);
  };

  return <div className="fixed z-[999998] pointer-events-none"
              style={{left: rect.left, top: rect.top, width: rect.width, height: rect.height}}>
    <div className="pointer-events-none absolute left-0 top-0 h-full overflow-hidden"
         style={{width: panelWidth + toggleWidth}}>
      <div
        className="flex h-full"
        style={{
          transform: state.collapsed ? `translateX(-${panelWidth}px)` : 'translateX(0)',
          transition: 'transform 0.35s ease'
        }}
      >
        <div className={`${panelClass} pointer-events-auto`} style={{width: panelWidth}}>
          <div className="flex shrink-0 border-b border-zinc-700" onWheel={onTabBarWheel}>
            {panelTabs.map(([tab, label]) =>
              <button
                key={tab}
                className={[
                  'h-9 flex-1 border-b-2 text-xs font-bold tracking-wide transition',
                  state.tab === tab
                    ? 'border-violet-500 text-violet-300 ring-1 ring-inset ring-violet-500'
                    : 'border-transparent text-zinc-400 hover:text-zinc-100',
                ].join(' ')}
                onClick={() => setTab(tab)}
              >
                {t(label)}
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-700 bg-zinc-900 px-2 py-1">
            <span
              className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-zinc-400">AEE v{state.version}</span>
            <button
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${state.partsOpen ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-zinc-700 text-zinc-400 hover:border-violet-400 hover:text-violet-200'}`}
              title={t('main-panel-parts-button-title')}
              onClick={openParts}
            >
              <LayersIcon/>
            </button>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto p-0 [scrollbar-width:thin] [scrollbar-color:#8b5cf6_transparent]">
            {state.tab === 'edit' ? <EditTab state={state}/> : null}
            {state.tab === 'opacity' ? <OpacityTab state={state}/> : null}
            {state.tab === 'layers' ? <LayersTab state={state}/> : null}
            {state.tab === 'settings' ? <SettingsTab state={state}/> : null}
          </div>
        </div>
        <div className="flex h-full items-center">
          <ToggleBar state={state}/>
        </div>
      </div>
    </div>
    <PartsFloat state={state}/>
  </div>;
}
