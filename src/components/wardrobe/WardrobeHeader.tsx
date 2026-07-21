import {Camera, LogOut, Settings} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {openDialog} from '@/core/dialogs';
import {settings, useSetting} from '@/core/settings';
import {wardrobeExit} from '@/hooks/wardrobeHooks';
import {useStage} from '@/components/wardrobe/stageContext';
import {Button} from '@/components/ui/Button';
import {SettingsDialog} from '@/components/wardrobe/dialogs/SettingsDialog';
import {PhotoDialog} from '@/components/wardrobe/dialogs/PhotoDialog';
import {LayoutIcon} from '@/components/wardrobe/icons/LayoutIcon';

export function WardrobeHeader() {
  const photoEnabled = useSetting(settings.wardrobePhoto);
  const layout = useSetting(settings.wardrobePanelLayout);
  const collapseEnabled = useSetting(settings.wardrobeCollapseEnabled);
  const collapsed = useSetting(settings.wardrobeListCollapsed);
  const {portrait} = useStage();
  // Collapsing/expanding only makes sense while the outfit-list panel exists (never in portrait).
  const canCollapse = layout.includes('list') && !portrait;

  return <header
    className="relative flex h-17.5 shrink-0 items-center justify-between border-b border-white/6 bg-black/25 px-10"
  >
    <div className="flex items-center gap-2.5">
      {collapseEnabled ? <Button density="stage"
              className="h-11 w-15"
              disabled={!canCollapse}
              selected={canCollapse && collapsed}
              onClick={() => settings.wardrobeListCollapsed.toggle()}
              icon={<LayoutIcon className="h-9 w-9"/>}
              aria-label={t('wardrobe-toggle-list')}
      /> : null}
      <Button density="stage"
              className="h-11 w-15"
              onClick={() => openDialog(close => <SettingsDialog onClose={close}/>)}
              icon={<Settings className="h-9 w-9"/>}
              aria-label={t('wardrobe-settings')}
      />
    </div>

    <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[32px] text-zinc-200/85">
      {t('wardrobe-title')}
    </h1>

    <div className="flex items-center gap-2.5">
      {photoEnabled ? <Button density="stage"
                              className="h-11 w-15"
                              onClick={() => openDialog(close => <PhotoDialog onClose={close}/>)}
                              icon={<Camera className="h-9 w-9"/>}
                              aria-label={t('wardrobe-camera')}
      /> : null}

      <Button density="stage"
              className="h-11 w-15"
              onClick={wardrobeExit}
              icon={<LogOut className="h-9 w-9"/>}
              aria-label={t('wardrobe-back')}
      />
    </div>
  </header>;
}
