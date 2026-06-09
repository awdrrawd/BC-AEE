export function FullBodyIcon({active}: {active?: boolean}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v7M9 10l3 2 3-2M9 21l3-7 3 7"/>
    {active ? <line x1="3" y1="3" x2="21" y2="21" stroke="#f87"/> : null}
  </svg>;
}
