export function CloseupIcon({active}: {active?: boolean}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    {active ? <line x1="3" y1="3" x2="21" y2="21" stroke="#f87"/> : null}
  </svg>;
}
