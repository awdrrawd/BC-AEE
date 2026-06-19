import {setSetting} from '@/controllers/uiController';
import {Switch} from '@/components/Switch';

export function SettingRow({label, settingKey, value}: { label: string; settingKey: string; value: boolean }) {
  return <div className="flex items-center justify-between border-b border-zinc-800 py-2" title={label}>
    <span className="text-xs text-zinc-300">{label}</span>
    <Switch checked={value} onChange={checked => setSetting(settingKey, checked)} ariaLabel={label}/>
  </div>;
}
