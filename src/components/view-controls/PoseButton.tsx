import {t} from '@/i18n/i18n';
import {applyPose, getPoseIconUrl} from '@/controllers/viewController';

export function PoseButton({pose, index, active}: {
  pose: { name: AssetPoseName; labelKey: string };
  index: number;
  active: boolean
}) {
  const label = t(pose.labelKey);
  return <button
    className={`flex h-14.5 w-14.5 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border p-0.5 transition ${active ? 'border-(--aee-accent) bg-(--aee-accent-22)' : 'border-white/10 bg-white/5 hover:border-(--aee-accent) hover:bg-(--aee-accent-22)'}`}
    title={label} onClick={() => applyPose(index)}>
    <img className="block h-10.5 w-10.5 object-contain" src={getPoseIconUrl(pose.name)} alt={pose.name}
         onError={event => {
           (event.currentTarget as HTMLImageElement).style.display = 'none';
         }}/>
    <span
      className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-[7px] text-zinc-400">{label}</span>
  </button>;
}
