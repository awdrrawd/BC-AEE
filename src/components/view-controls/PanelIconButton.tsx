import type {ReactNode} from 'react';
import {panelButtonClass} from '@/components/view-controls/styles';

export function PanelIconButton({children, onClick}: { children: ReactNode; onClick: () => void }) {
  return <button className={panelButtonClass} onClick={onClick}>{children}</button>;
}
