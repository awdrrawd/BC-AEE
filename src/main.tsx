// Keep this bootstrap free of static imports so duplicate detection runs first.
window.Liko = window.Liko ?? {};

if (window.Liko.AEE) {
  console.warn('🐈‍⬛ [AEE] Already loaded, skipping duplicate init.');
} else {
  const namespace: { version?: string } = window.Liko.AEE = {};
  import('./app.tsx').catch(error => {
    if (window.Liko.AEE === namespace && !namespace.version) delete window.Liko.AEE;
    console.error('🐈‍⬛ [AEE] Failed to load:', error);
  });
}
