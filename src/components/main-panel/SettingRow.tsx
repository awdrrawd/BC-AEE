import {isZh} from '../../core/lang';
import {setSetting} from '../../controllers/uiController';

export function SettingRow({label, settingKey, value}: {label: string; settingKey: string; value: boolean}) {
  return <div className="flex items-center justify-between border-b border-zinc-800 py-2">
    <span className="text-xs text-zinc-300">{label}</span>
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
      <input className="accent-violet-500" type="checkbox" checked={value} onChange={event => setSetting(settingKey, event.target.checked)}/>
      <span>{value ? (isZh() ? '啟用' : 'ON') : (isZh() ? '停用' : 'OFF')}</span>
    </label>
  </div>;
}
