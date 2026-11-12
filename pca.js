// Tab 1: PCA and hierarchy
(function () {
  const $ = G.$;
  const P = {};
  G.pca = P;
  const ci = c => G.PAL[(c - 1) % 12];

  // members (leaf indices) of a node of the merge tree
  function leaves(R, id) { const byId = R.byId || (R.byId = new Map(R.merges.map(q => [q.id, q]))); const out = [], st = [id]; while (st.length) { const x = st.pop(); if (x < G.n) out.push(x); else { const q = byId.get(x); st.push(q.a, q.b); } } return out; }

  // features whose prevalence differs most between two sets of papers (binary ticked features), signed A - B in percentage points
  function contrast(R, A, B, topn) {
    return R.feats.filter(f => G.F[f].binary).map(f => ({ f, d: 100 * (G.prevIn(f, A) - G.prevIn(f, B)) })).sort((u, v) => Math.abs(v.d) - Math.abs(u.d)).slice(0, topn || 3);
  }
  const fmtC = (arr) => arr.map(x => `${G.esc(G.F[x.f].label)} ${x.d >= 0 ? '+' : ''}${Math.round(x.d)} pp`).join(', ');

  function splitInfo(R, lab, k) {
    const q = R.merges[G.n - k], a = leaves(R, q.a), b = leaves(R, q.b), par = a.length + b.length;
    const ca = lab ? 'C' + lab[a[0]] : '', cb = lab ? 'C' + lab[b[0]] : '';
    return { k, q, a, b, par, ca, cb, top: contrast(R, a, b, 3) };
  }

  // ---------------------------------------------------------------- notes
  function notes(R, lab) {
    const st = G.st, p = R.P, silK = R.sil[R.ks.indexOf(st.k)], best = Math.max(...R.sil), edge = R.bestK === G.KR[0] || R.bestK === G.KR[1];
    $('scopenote').textContent = { inputs: 'Inputs only: how the models are built (interaction, traits, genetics, management, QTL / alleles / heritability / generations). The 16 output indicators are left out.', all: 'Inputs + outputs: how the models are built and what they report.', outputs: 'Outputs only: what the models report (16 output indicators and the number of outputs).' }[st.scope];
    $('quickstats').innerHTML = `<b>${G.n} papers</b><span>${R.feats.length} features</span><span>PC1–${p.nPc}: ${p.cumulative[p.nPc - 1].toFixed(1)}%</span><span>k = ${st.k}</span><span>Silhouette ${silK.toFixed(3)}</span>${best < 0.25 ? '<span class="warn">Weak cluster structure</span>' : ''}${edge ? '<span class="warn">Best k at range edge</span>' : ''}`;
    const mods = [...lab].map((l, i) => G.D.articles[i].model ? l : 0).filter(Boolean), dist = {}; mods.forEach(l => dist[l] = (dist[l] || 0) + 1);
    $('note').innerHTML = `<b>${R.feats.length} features</b>${R.feats.some(f => G.ew(f) !== 1) ? ' (weights applied)' : ''} standardized, PC1-PC${p.nPc} retained (${p.cumulative[p.nPc - 1].toFixed(1)}% of the variance), Ward.D2 on Euclidean distances between those PCs. Average silhouette at k = ${st.k}: <b>${silK.toFixed(3)}</b>; over k = ${G.KR[0]}-${G.KR[1]} the maximum is at k = ${R.bestK} (${best.toFixed(3)}). ` +
      (best < 0.25 ? '<span class="warn">Warning: the best silhouette is below 0.25, so the cluster structure is weak - treat the clusters as a rough guide, not as natural groups.</span> ' : '') +
      (edge ? `<span class="warn">Warning: the best k sits at the edge of the offered range (k = ${R.bestK}), so there is no clear natural number of clusters.</span> ` : '') +
      `The 27 model papers fall into: ${Object.keys(dist).map(c => 'C' + c + ': ' + dist[c]).join(', ')}.`;
    const excluded = R.skipped?.length ? `<div class="warn">Constant features left out: ${R.skipped.map(f => G.esc(G.F[f].label)).join(', ')}.</div>` : '';
    const bad = R.feats.filter(f => G.F[f].binary && G.prev[f] !== undefined && (G.prev[f] < 0.05 * G.n || G.prev[f] > 0.95 * G.n));
    const l1 = Array.from(p.loadings[0]), same = Math.max(l1.filter(v => v > 0).length, l1.filter(v => v < 0).length) / l1.length;
    $('featnote').innerHTML = excluded + (bad.length ? `<div class="warn">Note: ${bad.map(f => G.esc(G.F[f].label)).join(', ')} fall outside the 5-95% prevalence rule; standardizing near-constant columns amplifies noise.</div>` : '') +
      (same >= 0.8 ? `<div class="warn">Note: ${Math.round(100 * same)}% of the PC1 loadings have the same sign, so PC1 mostly measures how many of these features a paper has coded (a size axis), not a contrast between kinds of papers.</div>` : '');
  }

  // ---------------------------------------------------------------- PCA map
  function ellipse(pts, level) {
    const n = pts.length, mx = G.mean(pts.map(p => p[0])), my = G.mean(pts.map(p => p[1]));
    let sxx = 0, syy = 0, sxy = 0; pts.forEach(p => { sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; sxy += (p[0] - mx) * (p[1] - my); }); sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
    const tr = sxx + syy, det = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(tr * tr / 4 - det, 0)), l2 = tr / 2 - Math.sqrt(Math.max(tr * tr / 4 - det, 0));
    const th = Math.abs(sxy) < 1e-12 ? (sxx >= syy ? 0 : Math.PI / 2) : Math.atan2(l1 - sxx, sxy), r = Math.sqrt(-2 * Math.log(1 - level)), out = [];
    for (let t = 0; t <= 64; t++) { const a = 2 * Math.PI * t / 64, u = r * Math.sqrt(Math.max(l1, 0)) * Math.cos(a), v = r * Math.sqrt(Math.max(l2, 0)) * Math.sin(a); out.push([mx + u * Math.cos(th) - v * Math.sin(th), my + u * Math.sin(th) + v * Math.cos(th)]); }
    return out;
  }
  const hov = i => `<b>#${G.D.articles[i].id}</b> ${G.esc(G.D.articles[i].title.slice(0, 95))}`;
  function drawMap(R, lab) {
    const st = G.st, p = R.P, three = st.d3, tr = [], ann = [], k = st.k, ink = G.font();
    if (three && !G.has3d) { if (window.Plotly && $('pca').data) Plotly.purge('pca'); $('pca').innerHTML = '<div class="skeleton" style="height:100%">Loading the 3D engine…</div>'; G.need3d().then(() => { const cur = G.cur(); if (G.st.d3 && cur) drawMap(cur.R, cur.lab); }); return; }
    if ($('pca').querySelector('.skeleton')) $('pca').innerHTML = '';
    if (window.__lastDim !== undefined && window.__lastDim !== three) Plotly.purge('pca');   // 2D <-> 3D: start from a clean plot
    window.__lastDim = three;
    for (let c = 1; c <= k; c++) {
      const ids = [...lab].map((l, i) => l === c ? i : -1).filter(i => i >= 0); if (!ids.length) continue;
      if (!three && ids.length >= 4) { const e = ellipse(ids.map(i => [p.scores[i][0], p.scores[i][1]]), 0.68); tr.push({ x: e.map(v => v[0]), y: e.map(v => v[1]), type: 'scatter', mode: 'lines', fill: 'toself', fillcolor: ci(c) + '22', line: { width: 0 }, hoverinfo: 'skip', showlegend: false }); }
      const mk = i => st.mark && G.D.articles[i].model;
      const t = { x: ids.map(i => p.scores[i][0]), y: ids.map(i => p.scores[i][1]), text: ids.map(i => G.D.articles[i].id), customdata: ids, hovertext: ids.map(hov), hoverinfo: 'text', name: 'C' + c, type: three ? 'scatter3d' : 'scatter', mode: 'markers+text',
        textfont: { size: three ? 9 : 8, color: '#fff' }, marker: { color: ci(c), size: ids.map(i => mk(i) ? (three ? 13 : 21) : (three ? 10 : 16)), line: { color: ids.map(i => mk(i) ? '#FFD166' : '#fff'), width: ids.map(i => mk(i) ? 3 : 1) } } };
      if (three) { t.z = ids.map(i => p.scores[i][2]); t.marker.line = { color: '#fff', width: 1 }; }
      tr.push(t);
      if (!three) ann.push({ x: G.mean(ids.map(i => p.scores[i][0])), y: G.mean(ids.map(i => p.scores[i][1])), text: '<b>C' + c + '</b>', showarrow: false, font: { size: 13, color: ci(c) }, bgcolor: 'rgba(255,255,255,.85)', bordercolor: ci(c), borderpad: 2 });
    }
    const axT = j => `PC${j + 1} (${p.explained[j].toFixed(1)}%)`;
    const layout = { uirevision: R.key, margin: { l: 48, r: 8, t: 38, b: 48 }, legend: { orientation: 'h', y: 1.02, yanchor: 'bottom', font: { size: 9 } }, paper_bgcolor: '#fff', plot_bgcolor: '#fff', font: { color: ink } };
    if (three) layout.scene = { xaxis: { title: axT(0) }, yaxis: { title: axT(1) }, zaxis: { title: axT(2) } };
    else {
      layout.xaxis = { title: axT(0), zeroline: true, zerolinecolor: '#dde3e8', gridcolor: '#f0f3f6' }; layout.yaxis = { title: axT(1), zeroline: true, zerolinecolor: '#dde3e8', gridcolor: '#f0f3f6' };
      if (st.load) {
        const L = R.feats.map((f, i) => ({ f, a: p.loadings[0][i], b: p.loadings[1][i] })).sort((u, v) => (v.a ** 2 + v.b ** 2) - (u.a ** 2 + u.b ** 2)).slice(0, st.topn);
        const mx = Math.max(...p.scores.map(r => Math.abs(r[0]))), my = Math.max(...p.scores.map(r => Math.abs(r[1])));
        const sc = 0.72 * Math.min(mx / Math.max(...L.map(l => Math.abs(l.a))), my / Math.max(...L.map(l => Math.abs(l.b))));
        L.forEach(l => { ann.push({ x: l.a * sc, y: l.b * sc, ax: 0, ay: 0, axref: 'x', ayref: 'y', xref: 'x', yref: 'y', showarrow: true, arrowhead: 2, arrowsize: 1, arrowwidth: 1.4, arrowcolor: '#37474F', text: '' });
          ann.push({ x: l.a * sc * 1.06, y: l.b * sc * 1.06, xref: 'x', yref: 'y', showarrow: false, text: '<b>' + G.esc(G.F[l.f].label) + '</b>', font: { size: 10, color: '#263238' }, bgcolor: 'rgba(255,255,255,.7)' }); });
      }
      layout.annotations = ann;
    }
    Plotly.react('pca', tr, layout, { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d'] });
    const el = $('pca'); if (el.removeAllListeners) el.removeAllListeners('plotly_click');
    el.on('plotly_click', e => { const pt = e.points.find(x => x.customdata != null); if (pt) select(pt.customdata); });
  }

  // ---------------------------------------------------------------- dendrogram
  function drawDend(R, lab) {
    const st = G.st, n = G.n, svg = $('dend'), W = svg.clientWidth || 700, H = svg.clientHeight || 470, m = { l: 34, r: 8, t: 26, b: 14 }, C = G.C;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const order = C.leafOrder(R.merges, n), pos = new Map(order.map((l, i) => [l, i]));
    const hmax = R.merges[R.merges.length - 1].height, X = x => m.l + (x + 0.5) / n * (W - m.l - m.r), Y = h => H - m.b - 32 - (h / hmax) * (H - m.t - m.b - 32);
    const node = new Map(), out = [];
    R.merges.forEach(q => {
      const xa = q.a < n ? pos.get(q.a) : node.get(q.a).x, xb = q.b < n ? pos.get(q.b) : node.get(q.b).x, ya = q.a < n ? 0 : node.get(q.a).h, yb = q.b < n ? 0 : node.get(q.b).h;
      node.set(q.id, { x: (xa + xb) / 2, h: q.height });
      const cl = new Set(leaves(R, q.id).map(i => lab[i])), color = cl.size === 1 ? ci([...cl][0]) : '#263238';
      out.push(`<path d="M${X(xa)},${Y(ya)} V${Y(q.height)} H${X(xb)} V${Y(yb)}" fill="none" stroke="${color}" stroke-width="1.3"/>`);
    });
    R.merges.slice().sort((a, b) => b.height - a.height).slice(0, 11).forEach((q, r) => { const kk = r + 2, nd = node.get(q.id);
      out.push(`<g><circle class="fork" cx="${X(nd.x)}" cy="${Y(q.height)}" r="7" data-k="${kk}"${kk === st.k ? ' style="fill:#F4A261"' : ''}><title>cut here: k = ${kk}</title></circle><text x="${X(nd.x)}" y="${Y(q.height) - 10}" text-anchor="middle" font-size="9">${r === 0 ? 'root' : 'k=' + kk}</text></g>`); });
    order.forEach((l, i) => { const a = G.D.articles[l];
      out.push(`<circle cx="${X(i)}" cy="${Y(0) + 6}" r="${a.model && st.mark ? 3.8 : 2.4}" fill="${ci(lab[l])}" stroke="${a.model && st.mark ? '#E6A800' : 'none'}" stroke-width="1.8" data-i="${l}" style="cursor:pointer"><title>#${a.id} C${lab[l]}: ${G.esc(a.title.slice(0, 80))}</title></circle>`); });
    const step = Math.ceil(hmax / 5 / 5) * 5; for (let t = 0; t <= hmax; t += step) out.push(`<text x="2" y="${Y(t) + 3}">${t}</text><line x1="${m.l - 4}" x2="${m.l}" y1="${Y(t)}" y2="${Y(t)}" stroke="#888"/>`);
    // cluster names under the leaves
    const seen = new Set(); order.forEach((l, i) => { const c = lab[l]; if (seen.has(c)) return; seen.add(c); const idxs = order.map((x, j) => lab[x] === c ? j : -1).filter(j => j >= 0), mid = (idxs[0] + idxs[idxs.length - 1]) / 2;
      out.push(`<text x="${X(mid)}" y="${Y(0) + 22}" text-anchor="middle" font-size="11" font-weight="700" fill="${ci(c)}">C${c}</text>`); });
    svg.innerHTML = out.join('');
    svg.querySelectorAll('.fork').forEach(c => c.onclick = () => { st.auto = false; st.k = +c.dataset.k; G.emit('state'); });
    svg.querySelectorAll('circle[data-i]').forEach(c => c.onclick = () => select(+c.dataset.i));
  }

  function forkBox(R, lab) {
    const s = splitInfo(R, lab, G.st.k);
    $('fork').innerHTML = `<b>Fork creating k = ${G.st.k}</b><br>Parent: ${s.par} papers; children: <b>${s.ca}</b> (${s.a.length}) versus <b>${s.cb}</b> (${s.b.length}) at Ward height ${s.q.height.toFixed(2)}.<br>Features differing most between the two children (${s.ca} minus ${s.cb}): ${fmtC(s.top)}.`;
  }

  // ---------------------------------------------------------------- inspector
  function select(i) {
    G.st.sel = i; const a = G.D.articles[i], raw = G.hasExtra ? G.D.raw[i] : null, R = G.cur(), c = R ? R.lab[i] : '';
    const abs = raw ? raw[35] || '' : '', doi = G.hasExtra ? G.D.doi[i] : '';
    $('info').innerHTML = `<h4>Paper inspector</h4><p style="margin:4px 0"><b>#${a.id}</b> ${G.esc(a.title)}</p><p class="help" style="margin:0">${G.esc(a.authors)} · ${a.year ?? 'year n/a'}${R ? ` · <span class="sw" style="background:${ci(c)}"></span>cluster C${c}` : ''}${a.model ? ' · <b>one of the 27 model papers</b>' : ''}${G.D.cited_by[i] != null ? ` · cited by ${G.D.cited_by[i]} (OpenAlex)` : ''}${doi ? ` · <a href="https://doi.org/${G.esc(doi)}" target="_blank" rel="noopener">DOI</a>` : ''}</p>` + (abs ? `<details style="margin-top:6px"><summary>Show abstract</summary><p class="abs">${G.esc(abs)}</p></details>` : (G.hasExtra ? '' : '<p class="help">abstract loading…</p>'));
  }
  P.select = select;

  // ---------------------------------------------------------------- loadings, silhouette, tables
  function drawLoadings(R) {
    const p = R.P, pc = +$('pcsel').value || 0, L = R.feats.map((f, i) => ({ f, v: p.loadings[pc][i] })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 14).reverse();
    Plotly.react('loadplot', [{ type: 'bar', orientation: 'h', x: L.map(l => l.v), y: L.map(l => G.F[l.f].label), marker: { color: L.map(l => l.v >= 0 ? '#0072B2' : '#D55E00') }, hovertemplate: '%{y}: %{x:.3f}<extra></extra>' }],
      { margin: { l: 180, r: 10, t: 30, b: 36 }, title: { text: `PC${pc + 1} explains ${p.explained[pc].toFixed(1)}% of the standardized variation`, font: { size: 11 }, x: 0.02, y: 0.99, yanchor: 'top' }, xaxis: { title: 'loading', zeroline: true }, paper_bgcolor: '#fff', plot_bgcolor: '#fff', font: { color: G.font() } }, { displaylogo: false, responsive: true, displayModeBar: false });
  }
  function drawSil(R) {
    const st = G.st;
    Plotly.react('sil', [{ x: R.ks, y: R.sil, type: 'scatter', mode: 'lines+markers', marker: { color: R.ks.map(k => k === st.k ? '#E31A1C' : '#0072B2'), size: R.ks.map(k => k === st.k ? 13 : 7) }, hovertemplate: 'k=%{x}: %{y:.3f}<extra></extra>' }],
      { margin: { l: 50, r: 10, t: 10, b: 40 }, xaxis: { title: 'number of clusters k', dtick: 1 }, yaxis: { title: 'average silhouette' }, paper_bgcolor: '#fff', plot_bgcolor: '#fff', font: { color: G.font() },
        shapes: [{ type: 'line', x0: G.KR[0], x1: G.KR[1], y0: .25, y1: .25, line: { dash: 'dot', color: '#999' } }], annotations: [{ x: G.KR[1], y: .25, text: '0.25 = weak-structure line', showarrow: false, yshift: 10, xanchor: 'right', font: { size: 10, color: '#888' } }] },
      { displaylogo: false, responsive: true, displayModeBar: false });
    const el = $('sil'); if (el.removeAllListeners) el.removeAllListeners('plotly_click');
    el.on('plotly_click', e => { st.auto = false; st.k = e.points[0].x; G.emit('state'); });
  }
  function tables(R, lab) {
    const st = G.st, n = G.n, k = st.k, sil = G.C.silhouette(lab, R.D, n).perArticle, bin = R.feats.filter(f => G.F[f].binary), rows = [];
    for (let c = 1; c <= k; c++) {
      const ids = [...lab].map((l, i) => l === c ? i : -1).filter(i => i >= 0), rest = [...lab].map((l, i) => l !== c ? i : -1).filter(i => i >= 0);
      const top = bin.map(f => ({ f, v: G.prevIn(f, ids) })).sort((a, b) => b.v - a.v).slice(0, 3), con = contrast(R, ids, rest, 2), mod = ids.filter(i => G.D.articles[i].model).length;
      rows.push(`<tr><td><span class="sw" style="background:${ci(c)}"></span>C${c}</td><td>${ids.length}</td><td>${Math.round(100 * ids.length / n)}%</td><td>${G.mean(ids.map(i => sil[i])).toFixed(3)}</td><td>${mod}</td><td>${top.map(x => `${G.esc(G.F[x.f].label)} ${Math.round(100 * x.v)}%`).join(', ')}</td><td>${fmtC(con)}</td></tr>`);
    }
    $('ctab').innerHTML = `<table class="t"><tr><th>Cluster</th><th>Papers</th><th>Share</th><th>Silhouette</th><th>Model papers</th><th>Most frequent features</th><th>Strongest contrast vs rest</th></tr>${rows.join('')}</table>`;
    const srows = []; for (let kk = G.KR[0]; kk <= G.KR[1]; kk++) { const lb = G.C.cutree(R.merges, n, kk), s = splitInfo(R, lb, kk); srows.push(`<tr><td>${kk}</td><td>${s.par}</td><td>${s.ca} (${s.a.length}) / ${s.cb} (${s.b.length})</td><td>${s.q.height.toFixed(2)}</td><td>${fmtC(s.top)}</td></tr>`); }
    $('stab').innerHTML = `<table class="t"><tr><th>k</th><th>Parent size</th><th>Children (n)</th><th>Merge height</th><th>Features separating the two children</th></tr>${srows.join('')}</table>`;
  }

  // ---------------------------------------------------------------- chips
  function chips() {
    const st = G.st, D = G.D, box = $('chips'); box.innerHTML = '';
    D.group_order.forEach(g => {
      const members = D.features.filter(f => f.group === g && G.inScope().includes(f.key)); if (!members.length) return;
      const div = document.createElement('div'); div.className = 'grp';
      div.innerHTML = `<h5>${G.esc(D.group_titles[g])}</h5><div class="lk"><a data-a="all">all</a> · <a data-a="none">none</a></div>`;
      div.querySelectorAll('a').forEach(a => a.onclick = () => { members.forEach(m => { if (a.dataset.a === 'all') { st.ticks.add(m.key); if (st.w[m.key] <= 0) st.w[m.key] = 1; } else st.ticks.delete(m.key); }); G.emit('state'); });
      members.forEach(m => {
        const c = document.createElement('button'), on = st.ticks.has(m.key), add = st.w[m.key] - 1;
        c.type = 'button'; c.setAttribute('aria-pressed', String(on));
        c.className = 'chip' + (on ? ' on' : ''); c.textContent = m.label;
        if (on && add > 0) { const s = document.createElement('sup'); s.textContent = '+' + +add.toFixed(2); c.appendChild(s); }
        c.title = (m.binary ? '0/1 feature, n = ' + (G.prev[m.key] ?? '') : 'number') + ' - click to ' + (on ? 'remove' : 'add');
        c.onclick = e => { if (st.wmode && on) { st.w[m.key] = Math.max(1, st.w[m.key] + (e.shiftKey ? -1 : 1)); G.emit('state'); } else G.toggle(m.key); };
        div.appendChild(c);
      });
      box.appendChild(div);
    });
  }

  // ---------------------------------------------------------------- render + controls
  P.render = function () {
    const st = G.st; $('topw').style.display = st.load ? '' : 'none'; chips();
    const cur = G.cur();
    if (!cur) {
      $('quickstats').textContent = 'Choose at least 3 non-constant features with positive weights.';
      $('note').textContent = $('quickstats').textContent;
      ['pca', 'loadplot', 'sil'].forEach(id => { G.cancelPlot(id); Plotly.purge(id); $(id).replaceChildren(); });
      G.cancelPlot('dend'); $('dend').replaceChildren(); $('fork').textContent = ''; $('ctab').textContent = ''; $('stab').textContent = '';
      return;
    }
    const { R, lab } = cur;
    $('k').value = st.k; $('auto').checked = st.auto; $('k').disabled = st.auto && false;
    notes(R, lab); G.lazyPlot('pca', () => drawMap(R, lab)); G.lazyPlot('dend', () => drawDend(R, lab)); forkBox(R, lab); tables(R, lab);
    $('pcsel').dataset.v = Math.min(+$('pcsel').dataset.v || 0, R.P.nPc - 1);
    $('pcsel').innerHTML = Array.from({ length: R.P.nPc }, (_, i) => `<option value="${i}"${i === (+$('pcsel').dataset.v || 0) ? ' selected' : ''}>PC ${i + 1}</option>`).join('');
    G.lazyPlot('loadplot', () => drawLoadings(R));
    G.lazyPlot('sil', () => drawSil(R));
    if (st.sel != null) select(st.sel);
    G.ext.render();
  };
  // Display controls do not rebuild features, tables or the analytical charts.
  P.renderView = function () {
    $('topw').style.display = G.st.load ? '' : 'none';
    const cur = G.cur();
    if (cur) { G.lazyPlot('pca', () => drawMap(cur.R, cur.lab)); G.lazyPlot('dend', () => drawDend(cur.R, cur.lab)); }
  };
  P.setup = function () {
    const st = G.st; G.on('extra', () => { if (st.sel != null) select(st.sel); });
    $('k').innerHTML = Array.from({ length: 11 }, (_, i) => `<option>${i + 2}</option>`).join('');
    $('scope').querySelectorAll('button').forEach(b => b.onclick = () => { st.scope = b.dataset.s; $('scope').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); G.emit('scope'); G.emit('state'); });
    $('auto').onchange = e => { st.auto = e.target.checked; G.emit('state'); };
    $('k').onchange = e => { st.auto = false; st.k = +e.target.value; G.emit('state'); };
    $('mark').onchange = e => { st.mark = e.target.checked; G.emit('view'); };
    $('load').onchange = e => { st.load = e.target.checked; G.emit('view'); };
    $('topn').onchange = e => { st.topn = +e.target.value; G.emit('view'); };
    $('d3').onchange = e => { st.d3 = e.target.checked; G.emit('view'); };
    $('wmode').onchange = e => { st.wmode = e.target.checked; };
    $('pcsel').onchange = e => { $('pcsel').dataset.v = e.target.value; const c = G.cur(); if (c) drawLoadings(c.R); };
    $('rw').onclick = e => { e.preventDefault(); G.D.columns.forEach(c => st.w[c] = 1); G.emit('state'); };
    $('r20').onclick = e => { e.preventDefault(); st.ticks = new Set(G.D.default20); st.scope = 'all'; $('scope').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.s === 'all')); G.emit('scope'); G.emit('state'); };
    $('rst').onclick = e => { e.preventDefault(); st.ticks = new Set(G.D.startup); G.emit('state'); };
    window.addEventListener('resize', () => { const c = G.cur(); if (c && $('tab-pca').classList.contains('on')) drawDend(c.R, c.lab); });
  };
})();
