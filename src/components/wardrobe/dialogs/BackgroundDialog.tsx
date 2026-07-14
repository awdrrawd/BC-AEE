import {ChevronLeft} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {showToast} from '@/util/toast';
import {CUSTOM_BG_PATH, writeCustomBackground} from '@/core/wardrobeStorage';
import {backgroundDisplayName} from '@/util/wardrobeBackground';
import {closeDialog} from '@/controllers/wardrobeController';
import {askText} from '@/core/prompts';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {BackgroundCard} from '@/components/wardrobe/dialogs/BackgroundCard';
import {BackgroundChoiceTrigger} from '@/components/wardrobe/dialogs/BackgroundChoiceTrigger';
import {
  BACKGROUND_CHOICES,
  type BackgroundChoice,
  isChoiceSelected,
} from '@/components/wardrobe/dialogs/backgroundChoices';
import {settings, useSetting} from '@/core/settings';

export function BackgroundDialog() {
  const current = useSetting(settings.wardrobeBgImage);
  const apply = (path: string) => settings.wardrobeBgImage.set(path);

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string' || !writeCustomBackground(reader.result)) {
        showToast(t('wardrobe-alert-image-too-big'));
        return;
      }
      apply(CUSTOM_BG_PATH);
      closeDialog();
    });
    reader.addEventListener('error', () => showToast(t('wardrobe-toast-import-failed')));
    reader.readAsDataURL(file);
  };

  const choose = async (choice: BackgroundChoice) => {
    if (choice.type === 'url') {
      const url = await askText(t('wardrobe-prompt-bg-url'), 'https://');
      if (!url?.trim()) return;
      apply(url.trim());
    } else if (choice.type === 'custom') {
      const path = await askText(t('wardrobe-prompt-bg-path'), current);
      if (!path?.trim()) return;
      apply(path.trim());
    } else if (choice.path) {
      apply(choice.path);
    } else {
      return;
    }
    closeDialog();
  };

  return <Dialog onDismiss={closeDialog} className="w-150 p-6">
    <header className="mb-4 flex flex-col items-center gap-1">
      <h1 className="text-[28px] text-[#f0eee4]">{t('wardrobe-bg-pick-title')}</h1>
      <p className="text-[20px] text-white/70">{t('wardrobe-bg-current')}{backgroundDisplayName()}</p>
    </header>

    <div className="grid grid-cols-2 gap-3">
      {BACKGROUND_CHOICES.map(choice => <BackgroundCard
        key={choice.label}
        choice={choice}
        selected={isChoiceSelected(choice, current)}
      >
        <BackgroundChoiceTrigger
          choice={choice}
          current={current}
          onApply={apply}
          onUpload={upload}
          onPrompt={value => void choose(value)}
        />
      </BackgroundCard>)}
    </div>

    <Button density="stage"
            className="mt-5 h-9 w-30"
            onClick={closeDialog}
            icon={<ChevronLeft className="h-4 w-4"/>}
    >{t('wardrobe-back')}</Button>
  </Dialog>;
}
