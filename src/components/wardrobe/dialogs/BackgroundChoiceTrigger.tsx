import {t} from '@/i18n/i18n';
import {backgroundColorValue, backgroundUrl, colorBackgroundPath} from '@/util/wardrobeBackground';
import {ColorInput, FileInput} from '@/components/ui/Fields';
import {BackgroundChoiceIcon} from '@/components/wardrobe/dialogs/BackgroundCard';
import {
  BACKGROUND_PREVIEW_CLASS,
  type BackgroundChoice,
  backgroundChoiceLabel,
} from '@/components/wardrobe/dialogs/backgroundChoices';

export function BackgroundChoiceTrigger({
                                          choice,
                                          current,
                                          onApply,
                                          onUpload,
                                          onPrompt,
                                        }: {
  choice: BackgroundChoice;
  current: string;
  onApply: (path: string) => void;
  onUpload: (file: File) => void;
  onPrompt: (choice: BackgroundChoice) => void;
}) {
  if (choice.type === 'color') {
    return <ColorInput
      className={BACKGROUND_PREVIEW_CLASS}
      value={backgroundColorValue(current)}
      ariaLabel={t('wardrobe-bg-solid')}
      onColorChange={color => onApply(colorBackgroundPath(color))}
    />;
  }

  if (choice.type === 'upload') {
    return <FileInput
      className={BACKGROUND_PREVIEW_CLASS}
      accept="image/*"
      ariaLabel={t('wardrobe-bg-upload')}
      onSelect={onUpload}
    >
      <BackgroundChoiceIcon type={choice.type}/>
    </FileInput>;
  }

  const preview = choice.type === 'image' && choice.path ? backgroundUrl(choice.path) : null;

  return <button
    type="button"
    className={BACKGROUND_PREVIEW_CLASS}
    style={preview ? {backgroundImage: `url("${preview}")`} : undefined}
    aria-label={backgroundChoiceLabel(choice)}
    onClick={() => onPrompt(choice)}
  >
    {preview ? null : <BackgroundChoiceIcon type={choice.type}/>}
  </button>;
}
