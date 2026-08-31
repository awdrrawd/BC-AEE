import {type BooleanSetting, useSetting} from '@/core/settings';
import {SettingToggle} from '@/components/ui/SettingToggle';
import cn from '@/util/cn';

export function SettingRow({label, setting, density = 'compact', className, tooltip}: {
  label: string;
  setting: BooleanSetting;
  density?: 'compact' | 'stage';
  className?: string;
  /** Hover text; defaults to the label when omitted. */
  tooltip?: string;
}) {
  const checked = useSetting(setting);
  const base = density === 'stage'
    ? 'flex h-[50px] shrink-0 items-center rounded-lg border border-white/8 bg-black/35 px-4 transition-colors hover:border-(--aee-accent-55) hover:bg-(--aee-accent-16)'
    : 'flex items-center justify-between border-b border-zinc-800 px-1 py-2 transition-colors hover:border-(--aee-accent-55) hover:bg-(--aee-accent-16)';
  // Tooltip is resolved once inside SettingToggle and rendered by AeeTooltip.
  return <div className={cn(base, className)}>
    <SettingToggle label={label} tooltip={tooltip} checked={checked} onChange={() => setting.toggle()} density={density}/>
  </div>;
}
