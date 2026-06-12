import {isZh} from '@/core/lang';
import {applyPose, getPoseIconUrl} from '@/controllers/viewController';

export function PoseButton({pose, index, active}: {
  pose: { name: AssetPoseName; zh: string; en: string };
  index: number;
  active: boolean
}) {
  return <button
    className={`flex h-[58px] w-[58px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border p-0.5 transition ${active ? 'border-violet-400 bg-violet-500/30' : 'border-white/10 bg-white/5 hover:border-violet-400 hover:bg-violet-500/25'}`}
    title={isZh() ? pose.zh : pose.en} onClick={() => applyPose(index)}>
    <img className="block h-10.5 w-10.5 object-contain" src={getPoseIconUrl(pose.name)} alt={pose.name}
         onError={event => {
           (event.currentTarget as HTMLImageElement).style.display = 'none';
         }}/>
    <span
      className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-[7px] text-zinc-400">{isZh() ? pose.zh : pose.en}</span>
  </button>;
}
