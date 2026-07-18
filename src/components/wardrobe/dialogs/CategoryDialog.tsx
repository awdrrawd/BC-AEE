import {useState} from 'react';
import {Plus, X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {saveWardrobeCategories} from '@/controllers/wardrobeController';
import {settings} from '@/core/settings';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {TextInput} from '@/components/ui/Fields';
import {CATEGORY_ICON_CHOICES} from '@/components/wardrobe/dialogs/categoryIcons';

interface Row {
  id: number;
  name: string;
  icon: string;
}

const MAX_CATEGORIES = 12;

function initialRows(): Row[] {
  const icons = settings.wardrobeCategoryIcons.get();
  return settings.wardrobeCategories.get().map((name, id) => ({id, name, icon: icons[name] ?? ''}));
}

export function CategoryDialog({onClose}: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [nextId, setNextId] = useState(() => rows.length);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const patch = (id: number, next: Partial<Row>) =>
    setRows(current => current.map(row => (row.id === id ? {...row, ...next} : row)));

  const remove = (id: number) => {
    setRows(current => current.filter(row => row.id !== id));
    if (pickerFor === id) setPickerFor(null);
  };

  const add = () => {
    setRows(current => [...current, {id: nextId, name: '', icon: ''}]);
    setNextId(id => id + 1);
  };

  const confirm = () => {
    const names: string[] = [];
    const icons: Record<string, string> = {};
    for (const row of rows) {
      const name = row.name.trim().slice(0, 24);
      if (!name || names.some(existing => existing.toLowerCase() === name.toLowerCase())) continue;
      names.push(name);
      if (row.icon) icons[name] = row.icon;
    }
    saveWardrobeCategories(names);
    settings.wardrobeCategoryIcons.set(icons);
    onClose();
  };

  return <Dialog onDismiss={onClose} className="w-180 gap-6 p-8">
    <h1 className="text-[26px] text-[#f0eee4]">{t('wardrobe-prompt-edit-categories')}</h1>

    <div className="flex flex-col gap-2.5">
      {rows.length === 0
        ? <p className="text-[20px] text-white/35">{t('wardrobe-list-empty')}</p>
        : rows.map(row => <div key={row.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <Button
              density="stage"
              className="h-12 w-14 shrink-0 text-[24px]"
              selected={pickerFor === row.id}
              onClick={() => setPickerFor(current => (current === row.id ? null : row.id))}
              aria-label={t('wardrobe-category-icon')}
            >{row.icon || '＋'}</Button>

            <TextInput
              density="stage"
              className="h-12 flex-1 text-[22px]"
              value={row.name}
              maxLength={24}
              placeholder={t('wardrobe-category-placeholder')}
              onChange={event => patch(row.id, {name: event.currentTarget.value})}
            />

            <Button
              density="stage"
              className="h-12 w-12 shrink-0"
              onClick={() => remove(row.id)}
              icon={<X className="h-5 w-5"/>}
              aria-label={t('wardrobe-list-remove', {name: row.name})}
            />
          </div>

          {pickerFor === row.id ? <div className="flex flex-wrap gap-1.5 rounded-xl border border-(--aee-accent-22) bg-black/30 p-2.5">
            <button
              type="button"
              onClick={() => {
                patch(row.id, {icon: ''});
                setPickerFor(null);
              }}
              className={cn(
                'flex h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-[18px] text-white/70 transition hover:border-(--aee-accent)',
                row.icon ? 'border-white/12' : 'border-(--aee-accent) bg-(--aee-accent-16)',
              )}
            >{t('wardrobe-icon-none')}</button>
            {CATEGORY_ICON_CHOICES.map(icon => <button
              key={icon}
              type="button"
              onClick={() => {
                patch(row.id, {icon});
                setPickerFor(null);
              }}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-lg border text-[24px] transition hover:border-(--aee-accent)',
                row.icon === icon ? 'border-(--aee-accent) bg-(--aee-accent-16)' : 'border-white/12',
              )}
            >{icon}</button>)}
          </div> : null}
        </div>)}

      {rows.length < MAX_CATEGORIES ? <Button
        density="stage"
        className="h-11 self-start px-5"
        onClick={add}
        icon={<Plus className="h-5 w-5"/>}
      >{t('wardrobe-category-add')}</Button> : null}
    </div>

    <div className="flex justify-end gap-3">
      <Button density="stage" className="h-12 w-35" onClick={onClose}>{t('wardrobe-cancel')}</Button>
      <Button density="stage" className="h-12 w-35" selected onClick={confirm}>{t('wardrobe-confirm')}</Button>
    </div>
  </Dialog>;
}
