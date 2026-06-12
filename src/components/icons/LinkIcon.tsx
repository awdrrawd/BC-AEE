export function LinkIcon({locked}: { locked: boolean }) {
  return locked
    ? <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="10" height="10" rx="4"/>
      <rect x="9" y="2" width="10" height="10" rx="4"/>
    </svg>
    : <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="10" height="10" rx="4" opacity="0.35"/>
      <rect x="10" y="2" width="10" height="10" rx="4"/>
    </svg>;
}
