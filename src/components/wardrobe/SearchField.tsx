import {Search, X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {setSearch} from '@/controllers/wardrobeController';
import {TextInput} from '@/components/ui/Fields';

export function SearchField({value}: { value: string }) {
  return <div className="relative h-11 shrink-0">
    <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40"
          aria-hidden="true"
    />
    <TextInput
      density="stage"
      type="text"
      value={value}
      maxLength={30}
      placeholder={t('wardrobe-search-placeholder')}
      onChange={event => setSearch(event.currentTarget.value)}
      className="h-full w-full pl-10 pr-10 text-[22px]"
    />
    {value ? <button
      type="button"
      aria-label="clear search"
      onClick={() => setSearch('')}
      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded"
      style={{color: 'var(--aee-accent)'}}
    >
      <X className="h-4 w-4"/>
    </button> : null}
  </div>;
}
