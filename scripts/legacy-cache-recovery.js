async function recoverLegacyNavigation(scope) {
  const index = new URL('index.html', scope).href;
  let restored = false;
  for (const name of await caches.keys()) {
    if (!/^recipe-book-shell-\d{8}-\d+$/.test(name)) continue;
    const cache = await caches.open(name);
    const original = await cache.match(scope);
    const current = await cache.match(index);
    if (!original || !current) continue;
    const oldText = await original.text();
    const newText = await current.text();
    const legacyEntry = /<script\b[^>]*\bsrc=["'](?:\.\/)?js\/app\.js(?:\?[^"']*)?["']/i;
    if (!legacyEntry.test(oldText) || oldText.includes('name="recipe-book-release"') || !newText.includes('name="recipe-book-release"')) continue;
    const notice = '<section id="recipe-book-upgrade-recovery" role="alert"><h2>Previous offline version</h2><p>The update could not finish. Reconnect and reload to complete it. If you used the newer app, this older version cannot show or save those newer changes. Your saved data is retained; keep this browser\'s site data.</p></section>';
    const recovered = oldText.replace(/<body\b[^>]*>/i, (body) => body + notice);
    if (recovered === oldText) continue;
    await cache.put(index, new Response(recovered, {headers: {'Content-Type': 'text/html; charset=utf-8'}}));
    restored = true;
  }
  return restored;
}
