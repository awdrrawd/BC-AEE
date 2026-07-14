import {LogOut, Settings} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {openDialog} from '@/controllers/wardrobeController';
import {wardrobeExit} from '@/hooks/wardrobeHooks';
import {Button} from '@/components/ui/Button';

export function WardrobeHeader() {
  return <header
    className="relative flex h-17.5 shrink-0 items-center justify-between border-b border-white/6 bg-black/25 px-10"
  >
    <Button density="stage"
            className="h-10 w-10"
            onClick={() => openDialog('settingsDialog')}
            icon={<Settings className="h-5 w-5"/>}
            aria-label={t('wardrobe-settings')}
    />

    <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[32px] text-zinc-200/85">
      {t('wardrobe-title')}
    </h1>

    <Button density="stage"
            className="h-10 w-15"
            onClick={wardrobeExit}
            icon={<LogOut className="h-5 w-5"/>}
            aria-label={t('wardrobe-back')}
    />
  </header>;
}
