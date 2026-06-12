import {isZh} from '../../core/lang';
import {setSetting} from '../../controllers/uiController';
import {Switch} from '../Switch';

export function SettingRow({label, settingKey, value}: {label: string; settingKey: string; value: boolean}) {
  return <div className="flex items-center justify-between border-b border-zinc-800 py-2">
    <span className="text-xs text-zinc-300">{label}</span>
    <Switch checked={value} onChange={checked => setSetting(settingKey, checked)} ariaLabel={label} className="text-xs text-zinc-500">
      <span>{value ? (isZh() ? '啟用' : 'ON') : (isZh() ? '停用' : 'OFF')}</span>
    </Switch>
  </div>;
}
