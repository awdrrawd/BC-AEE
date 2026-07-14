import {Switch} from '@/components/ui/Switch';
import cn from '@/util/cn';

export function SettingToggle({label, checked, onChange, density = 'compact', className}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  density?: 'compact' | 'stage';
  className?: string;
}) {
  return <div className={cn('flex w-full items-center justify-between gap-4', className)} title={label}>
    <span
      className={cn('min-w-0 truncate text-[var(--aee-text)]', density === 'stage' ? 'text-[24px]' : 'text-xs')}>{label}</span>
    <Switch checked={checked} onChange={onChange} ariaLabel={label} size={density === 'stage' ? 'md' : 'sm'}/>
  </div>;
}
