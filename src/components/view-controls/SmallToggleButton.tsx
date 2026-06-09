import {smallToggleClass, smallToggleOnClass} from './styles';

export function SmallToggleButton({enabled, onClick}: {enabled: boolean; onClick: () => void}) {
  return <button className={`${smallToggleClass} ${enabled ? smallToggleOnClass : ''}`} onClick={onClick}/>;
}
