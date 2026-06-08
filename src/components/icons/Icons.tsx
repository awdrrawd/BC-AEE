export function LayersIcon() {
  return <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="1" y="1" width="12" height="3" rx="1"/>
    <rect x="1" y="5.5" width="12" height="3" rx="1"/>
    <rect x="1" y="10" width="12" height="3" rx="1"/>
  </svg>;
}

export function MoveIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M8 2v12M2 8h12M8 2L6 4M8 2l2 2M8 14l-2-2M8 14l2-2M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2"/>
  </svg>;
}

export function RotateIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5.25 12.76A5.5 5.5 0 1 1 10.75 3.24"/>
    <path d="M10.75 3.24A5.5 5.5 0 0 1 5.25 12.76" strokeDasharray="2 1.8"/>
    <polyline points="13,3.5 10.75,3.24 12,5.2"/>
    <rect x="6.3" y="6.3" width="3.4" height="3.4" transform="rotate(45 8 8)" fill="currentColor" stroke="none"/>
  </svg>;
}

export function ScaleIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/>
  </svg>;
}

export function SkewIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13h6M5 3h6"/>
    <line x1="3" y1="13" x2="5" y2="3"/>
    <line x1="9" y1="13" x2="11" y2="3"/>
  </svg>;
}

export function ColorIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(45 6.5 6.5)">
      <rect x="2.5" y="2.5" width="8" height="8" rx="0.8" fill="currentColor"/>
      <path d="M2.9 6.5 L2.9 3.3 Q2.9 2.9 3.3 2.9 L9.2 2.9 Q9.6 2.9 9.6 3.3 Z" fill="var(--bg,#1a1a2e)"/>
    </g>
    <ellipse cx="13.2" cy="13.2" rx="1.3" ry="1.6" fill="currentColor"/>
    <line x1="10.2" y1="10.2" x2="12.2" y2="12.0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>;
}

export function OpacityIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <rect width="16" height="16" rx="2" fill="rgba(255,255,255,0.2)"/>
    <rect x="0" y="0" width="8" height="8" fill="currentColor" opacity="0.7"/>
    <rect x="8" y="8" width="8" height="8" fill="currentColor" opacity="0.7"/>
    <rect width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
  </svg>;
}

export function ResetIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8A5 5 0 1 0 4 4.5"/>
    <path d="M1 2v3h3"/>
    <line x1="8" y1="5" x2="8" y2="8"/>
    <line x1="8" y1="8" x2="10" y2="10"/>
  </svg>;
}

type ChevronDirection = 'up' | 'down' | 'left' | 'right';

const chevronPoints: Record<ChevronDirection, string> = {
  up: '18 15 12 9 6 15',
  down: '6 9 12 15 18 9',
  left: '15 6 9 12 15 18',
  right: '9 6 15 12 9 18',
};

export function ChevronIcon({direction, size = 14, strokeWidth = 2.5}: {direction: ChevronDirection; size?: number; strokeWidth?: number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points={chevronPoints[direction]}/>
  </svg>;
}

export function LinkIcon({locked}: {locked: boolean}) {
  return locked
    ? <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2" width="10" height="10" rx="4"/><rect x="9" y="2" width="10" height="10" rx="4"/></svg>
    : <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2" width="10" height="10" rx="4" opacity="0.35"/><rect x="10" y="2" width="10" height="10" rx="4"/></svg>;
}

export function BgIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5" fill="#fff" stroke="none"/>
    <path d="M21 15l-5-5L5 21"/>
  </svg>;
}

export function OffsetIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <path d="M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4"/>
    <path d="M12 5v14M8 9l4-4 4 4M8 15l4 4 4-4"/>
  </svg>;
}

export function PoseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="4" r="2"/>
    <path d="M9 8h6l-1 6H10zM10 14l-2 7M14 14l2 7M9 11l-3 2M15 11l3 2"/>
  </svg>;
}

export function HideIcon({active}: {active?: boolean}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    {active ? <line x1="1" y1="1" x2="23" y2="23" stroke="#f87"/> : null}
  </svg>;
}

export function FullBodyIcon({active}: {active?: boolean}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v7M9 10l3 2 3-2M9 21l3-7 3 7"/>
    {active ? <line x1="3" y1="3" x2="21" y2="21" stroke="#f87"/> : null}
  </svg>;
}

export function CloseupIcon({active}: {active?: boolean}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    {active ? <line x1="3" y1="3" x2="21" y2="21" stroke="#f87"/> : null}
  </svg>;
}
