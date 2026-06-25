import {type MouseEvent as ReactMouseEvent, useRef} from 'react';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {getElementOverlayAnchor} from '@/core/overlay';
import {deselectLayer, setTab, togglePartsOpen} from '@/controllers/uiController';
import {LayersIcon} from '@/components/icons/LayersIcon';
import {ReturnIcon} from '@/components/icons/ReturnIcon';
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

  const panelRef = useRef<HTMLDivElement>(null);

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
        <div ref={panelRef} className={`${panelClass} pointer-events-auto`} style={{width: panelWidth}}>
          <div className="flex shrink-0 border-b border-zinc-700">
            {panelTabs.map(([tab, label]) =>
              <button
                key={tab}
                className={[
                  'h-9 flex-1 text-xs font-bold tracking-wide transition',
                  state.tab === tab
                    ? 'text-violet-300'
                    : 'text-zinc-400 hover:text-zinc-100',
                ].join(' ')}
                style={state.tab === tab ? {boxShadow: 'inset 0 -2px 0 #8b5cf6'} : undefined}
                onClick={() => setTab(tab)}
              >
                {t(label)}
              </button>
            )}
          </div>
          <div className="relative flex shrink-0 items-center border-b border-zinc-700 bg-zinc-900 px-2 py-1">
            {state.selectedLayer !== null ? (
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-700 text-zinc-100 transition hover:border-violet-400 hover:text-violet-200"
                title={t('main-panel-deselect-button-title')}
                onClick={deselectLayer}
              >
                <ReturnIcon/>
              </button>
            ) : (
              <div className="h-8 w-8 shrink-0"/>
            )}
            <span className="aee-wave-text absolute inset-x-0 text-center text-lg font-bold"
                  style={{pointerEvents: 'none'}}>AEE v{state.version}</span>
            <button
              className={`ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded border transition ${state.partsOpen ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-zinc-700 text-zinc-400 hover:border-violet-400 hover:text-violet-200'}`}
              title={t('main-panel-parts-button-title')}
              onClick={openParts}
            >
              <LayersIcon/>
            </button>
          </div>
          <div
            className="aee-tab-content min-h-0 flex-1 overflow-y-auto p-0 [scrollbar-width:thin] [scrollbar-color:#8b5cf6_transparent]">
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
