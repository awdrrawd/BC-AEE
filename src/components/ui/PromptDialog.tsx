import {useEffect, useRef, useState} from 'react';
import {t} from '@/i18n/i18n';
import {type AeePrompt, settlePrompt} from '@/core/prompts';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {TextInput} from '@/components/ui/Fields';

type PromptScale = 'stage' | 'panel';

const SIZES: Record<PromptScale, { dialog: string; message: string; input: string; button: string }> = {
  stage: {
    dialog: 'w-[720px] gap-6 p-8',
    message: 'text-[26px] leading-relaxed',
    input: 'h-14 px-4 text-[24px]',
    button: 'h-12 w-[140px]',
  },
  panel: {
    dialog: 'w-[420px] gap-4 p-5',
    message: 'text-sm leading-relaxed',
    input: 'h-9 px-2 text-sm',
    button: 'h-8 w-[96px]',
  },
};

export function PromptDialog({prompt, scale}: { prompt: AeePrompt; scale: PromptScale }) {
  const [value, setValue] = useState(prompt.kind === 'text' ? prompt.defaultValue : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const size = SIZES[scale];
  const density = scale === 'stage' ? 'stage' : 'compact';

  useEffect(() => {
    if (prompt.kind !== 'text') return;
    setValue(prompt.defaultValue);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [prompt]);

  const cancel = () => settlePrompt(prompt, prompt.kind === 'confirm' ? false : null);
  const accept = () => settlePrompt(prompt, prompt.kind === 'text' ? value : true);

  return <Dialog onDismiss={cancel} className={size.dialog}>
    <p className={`whitespace-pre-line text-[#f0eee4] ${size.message}`}>{prompt.message}</p>

    {prompt.kind === 'text' ? <TextInput
      density={density}
      ref={inputRef}
      type="text"
      value={value}
      placeholder={prompt.placeholder}
      onChange={event => setValue(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') accept();
        if (event.key === 'Escape') cancel();
      }}
      className={size.input}
    /> : null}

    <div className="flex justify-end gap-3">
      <Button density={density} className={size.button} onClick={cancel}>{t('wardrobe-cancel')}</Button>
      <Button density={density}
              className={size.button}
              selected={!(prompt.kind === 'confirm' && prompt.danger)}
              onClick={accept}
              style={prompt.kind === 'confirm' && prompt.danger
                ? {backgroundColor: 'rgba(220,38,38,0.35)', borderColor: '#ef4444', borderWidth: 2}
                : undefined}
      >{t('wardrobe-confirm')}</Button>
    </div>
  </Dialog>;
}
