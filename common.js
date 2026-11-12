// Shared state and helpers for all tabs (namespace G).
(function () {
  const G = window.G = { C: AmaiaCore, KR: [2, 12], handlers: {} };
  G.$ = id => document.getElementById(id);
  const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  G.PAL = ['#0072B2', '#D55E00', '#6A3D9A', '#E31A1C', '#009E73', '#E69F00', '#8C510A', '#56B4E9', '#CC79A7', '#4D4D4D', '#117733', '#882255'];
  G.GCOL = { interaction: '#0072B2', traits: '#009E73', genetics: '#6A3D9A', management: '#B8860B', outputs: '#C0392B', continuous: '#546E7A' };
  G.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  G.on = (ev, fn) => (G.handlers[ev] = G.handlers[ev] || []).push(fn);
  G.emit = ev => (G.handlers[ev] || []).forEach(fn => fn());
  G.font = () => getComputedStyle(document.body).color;
  G.csv = (rows, name) => {
    const q = v => { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  // upper tail of chi-square with 1 df
  G.erfc = x => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; };
  G.chi1p = chi => G.erfc(Math.sqrt(chi / 2));

  // ---- lazy loading: the small plotly build is in index.html; the full build (3D) and extra.json (raw workbook, dictionary, summary map) load on demand
  G.loadScript = src => new Promise((res, rej) => { const t = document.createElement('script'); t.src = src; t.onload = res; t.onerror = rej; document.head.appendChild(t); });
  G.patchPlotly = () => {   // one look for every plot: system font, tidy hover labels
    if (!window.Plotly || Plotly.__patched === window.Plotly.react) return; const r = Plotly.react;
    Plotly.react = (el, d, l, c) => { l = l || {}; l.font = Object.assign({ family: FONT, size: 12 }, l.font); l.hoverlabel = Object.assign({ font: { family: FONT, size: 12 }, bgcolor: '#fff', bordercolor: '#cfd8de' }, l.hoverlabel); return r.call(Plotly, el, d, l, c); };
    Plotly.__patched = Plotly.react;
  };
  G.need3d = () => G.p3d || (G.p3d = G.loadScript('vendor/plotly.min.js').then(() => { G.has3d = true; G.patchPlotly(); }));
  G.extra = () => G.px || (G.px = Promise.resolve(window.DGABM_DATA.extra).then(x => { Object.assign(G.D, x); G.hasExtra = true; G.emit('extra'); }));
  // Lower-page charts only render when they are near the viewport.
  const deferredPlots = new Map();
  const plotObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const task = deferredPlots.get(entry.target);
      task.visible = entry.isIntersecting;
      if (task.visible && task.dirty) { task.dirty = false; task.draw(); }
    });
  }, { rootMargin: '150px' });
  G.lazyPlot = (id, draw) => {
    const el = G.$(id);
    let task = deferredPlots.get(el);
    if (!task) {
      task = { visible: false }; deferredPlots.set(el, task); plotObserver.observe(el);
    }
    task.draw = draw; task.dirty = true;
    if (task.visible) { task.dirty = false; draw(); }
  };
  G.ew = f => G.st.w[f] * G.st.cw[G.F[f].group];          // effective weight = feature weight x category weight

  G.init = async function () {
    G.patchPlotly();
    const D = G.D = window.DGABM_DATA.core;
    G.n = D.n; G.col = new Map(D.columns.map((c, i) => [c, i])); G.F = Object.fromEntries(D.features.map(f => [f.key, f]));
    G.binKeys = D.features.filter(f => f.group !== 'continuous' && f.binary).map(f => f.key);       // the 47 candidate 0/1 features, in group order
    G.prev = Object.fromEntries(G.binKeys.map(k => [k, D.X.reduce((s, r) => s + r[G.col.get(k)], 0)]));
    G.st = { scope: 'inputs', ticks: new Set(D.startup), w: Object.fromEntries(D.columns.map(c => [c, 1])), cw: Object.fromEntries(D.group_order.map(g => [g, 1])), k: 7, auto: true, sel: null, cache: new Map(), load: true, topn: 7, mark: true, d3: false, wmode: false };
    G.inScope = () => G.st.scope === 'all' ? D.columns : D.scopes[G.st.scope];
  };

  // analysis for the current selection (cached)
  G.compute = function () {
    const st = G.st, D = G.D, feats = G.inScope().filter(f => st.ticks.has(f) && G.ew(f) > 0);
    const key = feats.map(f => f + ':' + G.ew(f)).join('|');
    if (!st.cache.has(key)) {
      const idx = feats.map(f => G.col.get(f)), res = feats.length >= 3 ? G.C.analyse(D.X, idx, feats.map(f => G.ew(f)), G.KR) : { error: 'few' };
      res.feats = feats; res.key = key;
      // Slider exploration should not keep every past analysis in memory.
      if (st.cache.size >= 24) st.cache.delete(st.cache.keys().next().value);
      st.cache.set(key, res);
    }
    return st.cache.get(key);
  };
  G.labels = R => G.C.cutree(R.merges, G.n, G.st.k);   // Int32Array of 1..k
  G.curK = R => (G.st.auto ? R.bestK : G.st.k);
  G.cur = function () { const R = G.compute(); if (R.error) return null; if (G.st.auto) G.st.k = R.bestK; return { R, lab: G.labels(R) }; };
  // toggle one feature in the shared selection
  G.toggle = function (key) { const st = G.st; if (st.ticks.has(key)) st.ticks.delete(key); else { st.ticks.add(key); if (st.w[key] <= 0) st.w[key] = 1; } G.emit('state'); };
  G.mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  G.prevIn = (key, ids) => ids.length ? G.mean(ids.map(i => G.D.X[i][G.col.get(key)])) : 0;
})();
