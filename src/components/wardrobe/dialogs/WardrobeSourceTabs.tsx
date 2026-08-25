import {t} from '@/i18n/i18n';
import {settings, useSetting} from '@/core/settings';
import type {WardrobeSourceId} from '@/core/types';
import {Button} from '@/components/ui/Button';

const SOURCES: WardrobeSourceId[] = ['online', 'local', 'sps'];

export function WardrobeSourceTabs({source, onChange}: {
  source: WardrobeSourceId;
  onChange: (source: WardrobeSourceId) => void;
}) {
  const spsEnabled = useSetting(settings.wardrobeSpsEnabled);
  return <div className="flex shrink-0 gap-2">
    {SOURCES.filter(id => id !== 'sps' || spsEnabled).map(id => <Button
      key={id}
      density="stage"
      className="h-12"
      selected={source === id}
      onClick={() => onChange(id)}
    >{t(`wardrobe-source-${id}-short`)}</Button>)}
  </div>;
}

