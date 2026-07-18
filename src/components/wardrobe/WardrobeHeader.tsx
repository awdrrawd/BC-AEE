import {Camera, LogOut, Settings} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {openDialog} from '@/core/dialogs';
import {settings, useSetting} from '@/core/settings';
import {wardrobeExit} from '@/hooks/wardrobeHooks';
import {Button} from '@/components/ui/Button';
import {SettingsDialog} from '@/components/wardrobe/dialogs/SettingsDialog';
import {PhotoDialog} from '@/components/wardrobe/dialogs/PhotoDialog';

export function WardrobeHeader() {
  const photoEnabled = useSetting(settings.wardrobePhoto);

  return <header
    className="relative flex h-17.5 shrink-0 items-center justify-between border-b border-white/6 bg-black/25 px-10"
  >
    <Button density="stage"
            className="h-10 w-10"
            onClick={() => openDialog(close => <SettingsDialog onClose={close}/>)}
            icon={<Settings className="h-5 w-5"/>}
            aria-label={t('wardrobe-settings')}
    />

    <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[32px] text-zinc-200/85">
      {t('wardrobe-title')}
    </h1>

    <div className="flex items-center gap-2.5">
      {photoEnabled ? <Button density="stage"
                              className="h-10 w-10"
                              onClick={() => openDialog(close => <PhotoDialog onClose={close}/>)}
                              icon={<Camera className="h-5 w-5"/>}
                              aria-label={t('wardrobe-camera')}
      /> : null}

      <Button density="stage"
              className="h-10 w-15"
              onClick={wardrobeExit}
              icon={<LogOut className="h-5 w-5"/>}
              aria-label={t('wardrobe-back')}
      />
    </div>
  </header>;
}
