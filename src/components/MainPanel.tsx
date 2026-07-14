import {type MouseEvent as ReactMouseEvent, useRef} from 'react';
import {clamp} from '@/util/math';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {getElementOverlayAnchor} from '@/core/overlay';
import {deselectLayer, setTab, togglePartsOpen} from '@/controllers/uiController';
import {Layers, Undo2} from 'lucide-react';
import {EditTab} from '@/components/main-panel/EditTab';
import {LayersTab} from '@/components/main-panel/LayersTab';
import {OpacityTab} from '@/components/main-panel/OpacityTab';
import {PartsFloat} from '@/components/main-panel/PartsFloat';
import {SettingsTab} from '@/components/main-panel/SettingsTab';
import {panelClass, panelTabs} from '@/components/main-panel/styles';
import {ToggleBar} from '@/components/main-panel/ToggleBar';
import {Button, IconButton} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';

export function MainPanel({state}: { state: AeeState }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rect = state.canvasRect;
  if (!rect || !state.visible || !state.item) return null;
  const panelWidth = clamp(rect.width * 0.27, 200, 320);
  const toggleWidth = 34;
  const openParts = (event: ReactMouseEvent<HTMLButtonElement>) => {
    togglePartsOpen(undefined, getElementOverlayAnchor(event.currentTarget));
  };

  const dimForEyedropper = state.colorPicker.open && state.colorPicker.eyedropperActive;
  return <div className="fixed z-999998 pointer-events-none"
              style={{
                left: rect.left, top: rect.top, width: rect.width, height: rect.height,
                opacity: dimForEyedropper ? 0.12 : 1,
                transition: 'opacity 0.15s ease',
              }}>
    <div className="pointer-events-none absolute left-0 top-0 h-full overflow-hidden"
         style={{width: panelWidth + toggleWidth}}>
      <div
        className="flex h-full"
        style={{
          transform: state.collapsed ? `translateX(-${panelWidth}px)` : 'translateX(0)',
          transition: 'transform 0.35s ease'
        }}
      >
        <Panel ref={panelRef} className={`${panelClass} pointer-events-auto rounded-none`}
               style={{width: panelWidth, borderWidth: '0 1px 0 0'}}>
          <div className="flex shrink-0 border-b border-zinc-700">
            {panelTabs.map(([tab, label]) =>
              <Button
                key={tab}
                tone="ghost"
                className={[
                  'h-9 flex-1 rounded-none border-0 text-xs font-bold',
                  state.tab === tab
                    ? 'text-(--aee-accent)'
                    : 'text-zinc-400',
                ].join(' ')}
                style={state.tab === tab ? {boxShadow: 'inset 0 -2px 0 var(--aee-accent)'} : undefined}
                onClick={() => setTab(tab)}
              >
                {t(label)}
              </Button>
            )}
          </div>
          <div className="relative flex shrink-0 items-center border-b border-zinc-700 bg-zinc-900 px-2 py-1">
            {state.selectedLayer !== null ? (
              <IconButton
                className="h-8 w-8"
                title={t('main-panel-deselect-button-title')}
                icon={<Undo2 className="h-4.5 w-4.5"/>}
                onClick={deselectLayer}
              />
            ) : (
              <div className="h-8 w-8 shrink-0"/>
            )}
            <span className="aee-wave-text absolute inset-x-0 text-center text-lg font-bold"
                  style={{pointerEvents: 'none'}}>AEE v{state.version}</span>
            <IconButton
              className="ml-auto h-8 w-8"
              selected={state.partsOpen}
              title={t('main-panel-parts-button-title')}
              icon={<Layers className="h-4.5 w-4.5"/>}
              onClick={openParts}
            />
          </div>
          <div
            className="aee-scroll min-h-0 flex-1 overflow-y-auto p-0">
            {state.tab === 'edit' ? <EditTab state={state}/> : null}
            {state.tab === 'opacity' ? <OpacityTab state={state}/> : null}
            {state.tab === 'layers' ? <LayersTab state={state}/> : null}
            {state.tab === 'settings' ? <SettingsTab/> : null}
          </div>
        </Panel>
        <div className="flex h-full items-center">
          <ToggleBar state={state}/>
        </div>
      </div>
    </div>
    <PartsFloat state={state}/>
  </div>;
}
