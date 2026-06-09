import {ruleLabel} from './ruleLabel';

export function HarmonyRuleButton({name, active, onClick}: {name: string; active: boolean; onClick: () => void}) {
  return <button className={`rounded-full border px-2 py-0.5 text-[11px] transition ${active ? 'border-violet-400 bg-violet-500/15 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`} onClick={onClick}>
    {ruleLabel(name)}
  </button>;
}
