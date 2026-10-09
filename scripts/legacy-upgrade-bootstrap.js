(() => {
  if (!('caches' in globalThis) || !navigator.serviceWorker?.controller) return;
  const scope = new URL(/*__APP_BASE__*/null, location.origin).href;
  const recovery = navigator.serviceWorker.getRegistration(scope)
    .then((registration) => registration?.scope === scope ? recoverLegacyNavigation(scope) : false)
    .catch(() => false);
  // Only an unavailable entry module can trigger this recovery reload. No new
  // application state exists yet, and later dynamic imports never match it.
  window.addEventListener('error', (event) => {
    if (!event.target?.hasAttribute?.('data-recipe-book-entry')) return;
    void recovery.then((restored) => {
      if (restored && !navigator.onLine) { location.reload(); return; }
      const root = document.getElementById('root');
      if (!root || root.childNodes.length) return;
      const panel = document.createElement('section');
      panel.setAttribute('role', 'alert');
      const title = document.createElement('h1'); title.textContent = 'The update could not finish loading';
      const detail = document.createElement('p');
      detail.textContent = restored
        ? 'Your previous offline version is available. Reconnect and reload to finish the update. Keep this browser’s site data to retain your saved changes.'
        : 'Reconnect and reload to try again. Keep this browser’s site data to retain your saved changes.';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Reload';
      retry.addEventListener('click', () => location.reload());
      panel.append(title, detail, retry); root.append(panel);
    });
  }, true);
})();
