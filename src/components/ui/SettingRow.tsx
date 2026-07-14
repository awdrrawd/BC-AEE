import {type BooleanSetting, useSetting} from '@/core/settings';
import {SettingToggle} from '@/components/ui/SettingToggle';
import cn from '@/util/cn';

export function SettingRow({label, setting, density = 'compact', className}: {
  label: string;
  setting: BooleanSetting;
  density?: 'compact' | 'stage';
  className?: string;
}) {
  const checked = useSetting(setting);
  const base = density === 'stage'
    ? 'flex h-[50px] shrink-0 items-center rounded-lg border border-white/8 bg-black/35 px-4'
    : 'flex items-center justify-between border-b border-zinc-800 py-2';
  return <div className={cn(base, className)} title={label}>
    <SettingToggle label={label} checked={checked} onChange={() => setting.toggle()} density={density}/>
  </div>;
}
