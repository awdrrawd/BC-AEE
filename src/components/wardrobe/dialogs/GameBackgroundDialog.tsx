import {useMemo, useState} from 'react';
import {X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {backgroundUrl} from '@/util/wardrobeBackground';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {TextInput} from '@/components/ui/Fields';

function gameBackgroundPath(name: string): string {
  return `Backgrounds/${name}.jpg`;
}

/** Lists every built-in game background (BackgroundsList) so the user can pick one directly. */
export function GameBackgroundDialog({current, onSelect, onClose}: {
  current: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const names = useMemo(() => {
    const list = (typeof BackgroundsList !== 'undefined' ? BackgroundsList : []) as { Name: string }[];
    return list.map(entry => entry.Name).filter(Boolean);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? names.filter(name => name.toLowerCase().includes(term)) : names;
  }, [names, search]);

  return <Dialog onDismiss={onClose} className="h-[720px] w-[960px] p-8">
    <header className="mb-4 flex shrink-0 items-center gap-4">
      <h1 className="text-[30px] text-[#f0eee4]">{t('wardrobe-bg-game')}</h1>
      <TextInput
        density="stage"
        className="ml-2 h-11 w-80"
        value={search}
        placeholder={t('wardrobe-search-placeholder')}
        onChange={event => setSearch(event.currentTarget.value)}
      />
      <span className="text-[20px] text-white/45">{filtered.length}</span>
      <Button density="stage"
              className="ml-auto h-10 w-10"
              onClick={onClose}
              icon={<X className="h-8 w-8"/>}
              aria-label={t('wardrobe-cancel')}
      />
    </header>

    <div className="aee-scroll grid min-h-0 flex-1 grid-cols-4 content-start gap-3 overflow-y-auto pr-1">
      {filtered.map(name => {
        const path = gameBackgroundPath(name);
        const url = backgroundUrl(path);
        const selected = current === path;
        return <button
          key={name}
          type="button"
          onClick={() => onSelect(path)}
          className={cn(
            'flex h-32 flex-col overflow-hidden rounded-xl border bg-[rgba(24,24,34,0.7)] transition hover:border-white/25',
            selected ? 'border-2' : 'border-white/8',
          )}
          style={selected ? {borderColor: 'var(--aee-accent)', boxShadow: '0 0 10px var(--aee-accent)'} : undefined}
        >
          <span
            className="min-h-0 flex-1 bg-black/40 bg-cover bg-center"
            style={url ? {backgroundImage: `url("${url}")`} : undefined}
          />
          <span className="shrink-0 truncate px-2 py-1 text-center text-[18px] text-[#f0eee4]">{name}</span>
        </button>;
      })}
    </div>
  </Dialog>;
}
