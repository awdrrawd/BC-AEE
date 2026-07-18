import {useState} from 'react';
import {ArrowRightLeft, RotateCcw, Trash2} from 'lucide-react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {settings, useSetting} from '@/core/settings';
import {resetPanelLayout, swapPanels, togglePanel} from '@/controllers/wardrobeController';
import {Button} from '@/components/ui/Button';

type Mode = 'move' | 'delete' | null;

const PANELS = [
  {id: 'list', letter: 'A', labelKey: 'wardrobe-panel-a'},
  {id: 'grid', letter: 'B', labelKey: 'wardrobe-panel-b'},
  {id: 'manage', letter: 'C', labelKey: 'wardrobe-panel-c'},
  {id: 'preview', letter: 'D', labelKey: 'wardrobe-panel-d'},
] as const;

function meta(id: string) {
  return PANELS.find(panel => panel.id === id) ?? PANELS[0];
}

export function PanelLayoutTab() {
  const layout = useSetting(settings.wardrobePanelLayout);
  const [mode, setMode] = useState<Mode>(null);
  const [first, setFirst] = useState<string | null>(null);

  const hidden = PANELS.filter(panel => !layout.includes(panel.id)).map(panel => panel.id);
  const ordered = [...layout, ...hidden];

  const toggleMode = (next: Mode) => {
    setMode(current => (current === next ? null : next));
    setFirst(null);
  };

  const restore = () => {
    resetPanelLayout();
    setMode(null);
    setFirst(null);
  };

  const onTile = (id: string) => {
    if (mode === 'move') {
      if (!layout.includes(id)) return; // hidden panels can't be reordered
      if (first === null) {
        setFirst(id);
        return;
      }
      if (first !== id) swapPanels(first, id);
      setFirst(null);
    } else if (mode === 'delete') {
      togglePanel(id);
    }
  };

  const hint = mode === 'move'
    ? t('wardrobe-panel-hint-move')
    : mode === 'delete'
      ? t('wardrobe-panel-hint-delete')
      : t('wardrobe-panel-hint-idle');

  return <div className="flex flex-col gap-5">
    <div className="flex gap-2.5">
      <Button density="stage"
              className="h-12 flex-1"
              selected={mode === 'move'}
              onClick={() => toggleMode('move')}
              icon={<ArrowRightLeft className="h-5 w-5"/>}
      >{t('wardrobe-panel-move')}</Button>
      <Button density="stage"
              className="h-12 flex-1"
              selected={mode === 'delete'}
              onClick={() => toggleMode('delete')}
              icon={<Trash2 className="h-5 w-5"/>}
      >{t('wardrobe-panel-delete')}</Button>
      <Button density="stage"
              className="h-12 flex-1"
              onClick={restore}
              icon={<RotateCcw className="h-5 w-5"/>}
      >{t('wardrobe-panel-restore')}</Button>
    </div>

    <p className="text-center text-[20px] text-white/50">{hint}</p>

    <div className="grid grid-cols-4 gap-3">
      {ordered.map(id => {
        const panel = meta(id);
        const isHidden = !layout.includes(id);
        const isFirst = mode === 'move' && first === id;
        return <button
          key={id}
          type="button"
          onClick={() => onTile(id)}
          disabled={mode === null || (mode === 'move' && isHidden)}
          className={cn(
            'flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 p-2 text-center transition',
            isHidden
              ? 'border-dashed border-white/15 bg-white/3 opacity-45'
              : 'border-white/12 bg-[rgba(24,24,34,0.6)]',
            mode !== null && !(mode === 'move' && isHidden) && 'hover:border-white/30',
            isFirst && 'border-(--aee-accent) bg-(--aee-accent-16)',
          )}
          style={isFirst ? {boxShadow: '0 0 12px var(--aee-accent)'} : undefined}
        >
          <span className={cn('text-[40px] font-semibold', isHidden ? 'text-white/40' : 'text-(--aee-accent)')}>
            {panel.letter}
          </span>
          <span className="text-[19px] leading-tight text-[#f0eee4]">{t(panel.labelKey)}</span>
          {isHidden ? <span className="text-[16px] text-white/40">{t('wardrobe-panel-hidden')}</span> : null}
        </button>;
      })}
    </div>
  </div>;
}
