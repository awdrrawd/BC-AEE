export type ChevronDirection = 'up' | 'down' | 'left' | 'right';

const chevronPoints: Record<ChevronDirection, string> = {
  up: '18 15 12 9 6 15',
  down: '6 9 12 15 18 9',
  left: '15 6 9 12 15 18',
  right: '9 6 15 12 9 18',
};

export function ChevronIcon({direction, size = 14, strokeWidth = 2.5}: {
  direction: ChevronDirection;
  size?: number;
  strokeWidth?: number
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points={chevronPoints[direction]}/>
  </svg>;
}
