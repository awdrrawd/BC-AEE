import {SquarePen, Star} from 'lucide-react';
import {t} from '@/i18n/i18n';

import {setFilter} from '@/controllers/wardrobeController';
import {openDialog} from '@/core/dialogs';
import {Button} from '@/components/ui/Button';
import {CategoryDialog} from '@/components/wardrobe/dialogs/CategoryDialog';
import type {WardrobeFilter} from '@/core/types';
import {settings, useSetting} from '@/core/settings';

export function FilterBar({activeFilter}: { activeFilter: WardrobeFilter }) {
  const enabled = useSetting(settings.wardrobeCategoriesEnabled);
  const all = useSetting(settings.wardrobeCategories);
  const categories = enabled ? all : [];

  const select = (value: WardrobeFilter) => setFilter(activeFilter === value ? null : value);

  return <div className="flex h-full min-w-0 flex-1 items-center gap-1.5">
    <Button density="stage"
            className="h-full min-w-0 flex-1"
            selected={activeFilter == null}
            onClick={() => setFilter(null)}
    >{t('wardrobe-filter-all')}</Button>

    <Button density="stage"
            className="h-full min-w-0 flex-1"
            selected={activeFilter === 'favorite'}
            onClick={() => select('favorite')}
            icon={<Star fill="currentColor" className="h-5 w-5"/>}
    >{t('wardrobe-filter-favorite')}</Button>

    {categories.map(name => <Button density="stage"
                                    key={name}
                                    className="h-full min-w-0 flex-1"
                                    selected={activeFilter === name}
                                    onClick={() => select(name)}
    >{name}</Button>)}

    <Button density="stage"
            className="h-full w-10 shrink-0"
            onClick={() => openDialog(close => <CategoryDialog onClose={close}/>)}
            icon={<SquarePen className="h-5 w-5"/>}
            aria-label={t('wardrobe-prompt-edit-categories')}
    />
  </div>;
}
