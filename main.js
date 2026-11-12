(async function () {
  await G.init();
  const mods = { pca: G.pca, fm: G.fm, cite: G.cite, dict: G.dict };
  Object.values(mods).forEach(m => m.setup()); G.ext.setup();
  const dirty = new Set(Object.keys(mods)); let cur = 'pca';
  function show(t) {
    cur = t; document.querySelectorAll('nav a[data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === t));
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
    if (dirty.has(t)) { dirty.delete(t); mods[t].render(); }
    if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
    window.dispatchEvent(new Event('resize'));
  }
  let renderFrame = null;
  G.on('state', () => {
    Object.keys(mods).forEach(t => dirty.add(t));
    // Coalesce slider events; paint controls before updating the plots.
    if (renderFrame !== null) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      if (dirty.has(cur)) { dirty.delete(cur); mods[cur].render(); }
    });
  });
  G.on('view', () => { if (cur === 'pca') G.pca.renderView(); else dirty.add('pca'); });
  document.querySelectorAll('nav a[data-tab]').forEach(a => a.onclick = () => show(a.dataset.tab));
  const start = (location.hash || '#pca').slice(1); show(mods[start] ? start : 'pca');
  G.$('foot').textContent = `Data exported ${G.D.generated} from the R pipeline · ${G.n} articles · all analysis runs in your browser (PCA, Ward clustering and silhouettes agree with R to ~1e-12).`;
  G.$('boot').remove();
  (window.requestIdleCallback || (f => setTimeout(f, 600)))(() => G.extra());   // raw workbook etc. in the background
  window.__G = G;
})().catch(error => {
  console.error(error);
  const boot = G.$('boot') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'boot' }));
  boot.innerHTML = '<p>The explorer could not load. Please reload the page.</p><button class="btn" onclick="location.reload()">Reload</button>';
});
