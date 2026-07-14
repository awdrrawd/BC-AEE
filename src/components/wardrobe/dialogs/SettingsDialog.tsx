import {X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {closeDialog, setSettingsTab} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import type {WardrobeSettingsTab} from '@/core/types';
import {GeneralTab} from '@/components/wardrobe/dialogs/GeneralTab';
import {AppearanceTab} from '@/components/wardrobe/dialogs/AppearanceTab';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';

const TABS: Array<{ id: WardrobeSettingsTab; labelKey: string }> = [
  {id: 'general', labelKey: 'wardrobe-settings-general'},
  {id: 'appearance', labelKey: 'wardrobe-settings-appearance'},
];

export function SettingsDialog({state}: { state: WardrobeState }) {
  return <Dialog onDismiss={closeDialog} className="h-[720px] w-[900px] p-10">
    <header className="mb-4 flex shrink-0 items-center justify-between">
      <h1 className="text-[40px] text-[#f0eee4]">{t('wardrobe-settings')}</h1>
      <Button density="stage"
              className="h-9 w-9"
              onClick={closeDialog}
              icon={<X className="h-5 w-5"/>}
              aria-label={t('wardrobe-cancel')}
      />
    </header>

    <div className="mx-auto mb-4 flex shrink-0 gap-1.5 rounded-full border border-white/8 bg-black/35 p-1">
      {TABS.map(tab => <Button density="stage"
                               key={tab.id}
                               className="h-[42px] w-[160px] rounded-full"
                               selected={state.settingsTab === tab.id}
                               onClick={() => setSettingsTab(tab.id)}
      >{t(tab.labelKey)}</Button>)}
    </div>

    <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-[var(--aee-accent-35)] to-transparent"/>

    <div className="aee-scroll mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
      {state.settingsTab === 'general' ? <GeneralTab/> : <AppearanceTab theme={state.theme}/>}
    </div>
  </Dialog>;
}
