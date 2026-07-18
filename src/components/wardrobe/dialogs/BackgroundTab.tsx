import {t} from '@/i18n/i18n';
import {showToast} from '@/util/toast';
import {CUSTOM_BG_PATH, writeCustomBackground} from '@/core/wardrobeStorage';
import {backgroundDisplayName} from '@/util/wardrobeBackground';
import {askText} from '@/core/prompts';
import {openDialog} from '@/core/dialogs';
import {settings, useSetting} from '@/core/settings';
import {BackgroundCard} from '@/components/wardrobe/dialogs/BackgroundCard';
import {BackgroundChoiceTrigger} from '@/components/wardrobe/dialogs/BackgroundChoiceTrigger';
import {GameBackgroundDialog} from '@/components/wardrobe/dialogs/GameBackgroundDialog';
import {
  BACKGROUND_CHOICES,
  type BackgroundChoice,
  isChoiceSelected,
} from '@/components/wardrobe/dialogs/backgroundChoices';

export function BackgroundTab() {
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
      openDialog(close => <GameBackgroundDialog
        current={current}
        onSelect={path => {
          apply(path);
          close();
        }}
        onClose={close}
      />);
    } else if (choice.path) {
      apply(choice.path);
    }
  };

  return <div className="flex flex-col gap-4">
    <p className="text-[22px] text-white/70">{t('wardrobe-bg-current')}{backgroundDisplayName()}</p>

    <div className="grid grid-cols-3 gap-3">
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
  </div>;
}
