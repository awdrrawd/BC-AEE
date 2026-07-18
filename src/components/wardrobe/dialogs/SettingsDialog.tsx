import {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {useWardrobeStore} from '@/core/wardrobeStore';
import type {WardrobeSettingsTab} from '@/core/types';
import {GeneralTab} from '@/components/wardrobe/dialogs/GeneralTab';
import {BackgroundTab} from '@/components/wardrobe/dialogs/BackgroundTab';
import {AppearanceTab} from '@/components/wardrobe/dialogs/AppearanceTab';
import {PanelLayoutTab} from '@/components/wardrobe/dialogs/PanelLayoutTab';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {setBackdropPreview} from '@/core/dialogs';

const TABS: Array<{ id: WardrobeSettingsTab; labelKey: string }> = [
  {id: 'general', labelKey: 'wardrobe-settings-general'},
  {id: 'background', labelKey: 'wardrobe-settings-background'},
  {id: 'appearance', labelKey: 'wardrobe-settings-appearance'},
  {id: 'panels', labelKey: 'wardrobe-settings-panels'},
];

export function SettingsDialog({onClose}: { onClose: () => void }) {
  const [tab, setTab] = useState<WardrobeSettingsTab>('general');
  const {theme} = useWardrobeStore();

  // On the background tab, lift the stage dimming so the picked background is actually visible.
  const previewBackground = tab === 'background';
  useEffect(() => {
    setBackdropPreview(previewBackground);
    return () => setBackdropPreview(false);
  }, [previewBackground]);

  return <Dialog
    onDismiss={onClose}
    className="h-[720px] w-[900px] p-10"
    backdropClassName={previewBackground ? 'bg-black/25' : 'bg-black/90'}
  >
    <header className="mb-4 flex shrink-0 items-center justify-between">
      <h1 className="text-[40px] text-[#f0eee4]">{t('wardrobe-settings')}</h1>
      <Button density="stage"
              className="h-9 w-9"
              onClick={onClose}
              icon={<X className="h-5 w-5"/>}
              aria-label={t('wardrobe-cancel')}
      />
    </header>

    <div className="mx-auto mb-4 flex shrink-0 gap-1.5 rounded-full border border-white/8 bg-black/35 p-1">
      {TABS.map(entry => <Button density="stage"
                                 key={entry.id}
                                 className="h-[42px] w-[160px] rounded-full"
                                 selected={tab === entry.id}
                                 onClick={() => setTab(entry.id)}
      >{t(entry.labelKey)}</Button>)}
    </div>

    <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-[var(--aee-accent-35)] to-transparent"/>

    <div className="aee-scroll mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
      {tab === 'general' ? <GeneralTab/>
        : tab === 'background' ? <BackgroundTab/>
          : tab === 'panels' ? <PanelLayoutTab/>
            : <AppearanceTab theme={theme}/>}
    </div>
  </Dialog>;
}
