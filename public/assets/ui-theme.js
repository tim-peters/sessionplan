// Apply the same explicit preference as next-themes before the first paint.
(() => {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    let preference;
    try { preference = localStorage.getItem('sp:theme'); } catch { /* System fallback when storage is unavailable. */ }
    const dark = preference === 'dark' || (preference !== 'light' && system.matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#ffffff');
  };
  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', (event) => { if (!event.key || event.key === 'sp:theme') apply(); });
})();
