// Blocking, same-origin initialization keeps the first paint aligned with the user's choice.
(() => {
  let theme = 'system';
  try { const saved = localStorage.getItem('offline_recipebook_theme_v1'); if (['light','dark','system'].includes(saved)) theme = saved; } catch { /* Blocked storage uses the system preference. */ }
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
