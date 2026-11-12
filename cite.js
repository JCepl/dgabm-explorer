// Tab 3: Cross-citations (internal citation network among the retained articles, from the OpenAlex cache exported by R)
(function () {
  const $ = G.$, CI = {}; G.cite = CI;
  let E, nodes, deg, adj, focus = null;      // edges as [citing_index, cited_index] (0-based), connected nodes, degree, undirected adjacency
  const ci = c => G.PAL[(c - 1) % 12];

  function prepare() {
    E = G.D.edges.map(e => [e[0] - 1, e[1] - 1]).filter(e => e[0] >= 0 && e[1] >= 0 && e[0] < G.n && e[1] < G.n);
    deg = new Map(); adj = new Map();
    const add = (a, b) => { (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); };
    E.forEach(([a, b]) => { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); add(a, b); add(b, a); });
    nodes = [...deg.keys()].sort((a, b) => deg.get(b) - deg.get(a) || a - b);
    focus = nodes[0];
    $('cfocus').innerHTML = nodes.map(i => `<option value="${i}">#${G.D.articles[i].id} (${deg.get(i)} links) ${G.esc(G.D.articles[i].title.slice(0, 60))}</option>`).join('');
    $('cstatus').textContent = `${E.length} citation links among ${nodes.length} of the ${G.n} retained articles (source: OpenAlex reference lists, cached by the R pipeline).`;
  }

  // Fruchterman-Reingold layout with weak gravity (keeps disconnected pieces near the centre), deterministic
  const layouts = new Map();
  function layout(ids, edges) {
    const key = ids.join(',');
    if (layouts.has(key)) return layouts.get(key);
    const m = ids.length, pos = new Map(); let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    ids.forEach(i => pos.set(i, [rnd() * 2 - 1, rnd() * 2 - 1]));
    const kk = 1.6 / Math.sqrt(Math.max(m, 1)); let t = 0.5;
    for (let it = 0; it < 400; it++) {
      const disp = new Map(ids.map(i => [i, [0, 0]]));
      for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) { const pa = pos.get(ids[a]), pb = pos.get(ids[b]); let dx = pa[0] - pb[0], dy = pa[1] - pb[1], d = Math.hypot(dx, dy) || 0.01, f = kk * kk / d; dx /= d; dy /= d; disp.get(ids[a])[0] += dx * f; disp.get(ids[a])[1] += dy * f; disp.get(ids[b])[0] -= dx * f; disp.get(ids[b])[1] -= dy * f; }
      edges.forEach(([a, b]) => { const pa = pos.get(a), pb = pos.get(b); let dx = pa[0] - pb[0], dy = pa[1] - pb[1], d = Math.hypot(dx, dy) || 0.01, f = d * d / kk; dx /= d; dy /= d; disp.get(a)[0] -= dx * f; disp.get(a)[1] -= dy * f; disp.get(b)[0] += dx * f; disp.get(b)[1] += dy * f; });
      ids.forEach(i => { const p = pos.get(i), d = disp.get(i); d[0] -= p[0]; d[1] -= p[1]; const l = Math.hypot(d[0], d[1]) || 0.01, step = Math.min(l, t); p[0] += d[0] / l * step; p[1] += d[1] / l * step; });
      t *= 0.99;
    }
    if (layouts.size >= 24) layouts.delete(layouts.keys().next().value);
    layouts.set(key, pos);
    return pos;
  }

  function visible() {
    const scope = document.querySelector('input[name=cscope]:checked').value;
    if (scope === 'all') return { ids: nodes, edges: E };
    const depth = +$('cdepth').value, seen = new Set([focus]); let fr = [focus];
    for (let d = 0; d < depth; d++) { const nx = []; fr.forEach(a => adj.get(a).forEach(b => { if (!seen.has(b)) { seen.add(b); nx.push(b); } })); fr = nx; }
    return { ids: [...seen], edges: E.filter(([a, b]) => seen.has(a) && seen.has(b)) };
  }

  CI.render = function () {
    if (!E) return;
    const cur = G.cur(), lab = cur ? cur.lab : new Int32Array(G.n).fill(1), V = visible(), pos = layout(V.ids, V.edges), showId = $('clab').checked;
    $('cfocus').value = focus;
    // network
    const ink = G.font(), ex = [], ey = [];
    V.edges.forEach(([a, b]) => { const p = pos.get(a), q = pos.get(b); ex.push(p[0], q[0], null); ey.push(p[1], q[1], null); });
    const tr = [{ type: 'scatter', mode: 'lines', x: ex, y: ey, line: { color: 'rgba(120,130,140,.45)', width: 1 }, hoverinfo: 'skip' }];
    const ann = V.edges.map(([a, b]) => { const p = pos.get(a), q = pos.get(b); return { x: q[0], y: q[1], ax: p[0], ay: p[1], xref: 'x', yref: 'y', axref: 'x', ayref: 'y', showarrow: true, arrowhead: 2, arrowsize: 1, arrowwidth: 1, arrowcolor: 'rgba(90,100,110,.55)', standoff: 9, startstandoff: 9, text: '' }; });
    const ids = V.ids;
    tr.push({ type: 'scatter', mode: showId ? 'markers+text' : 'markers', x: ids.map(i => pos.get(i)[0]), y: ids.map(i => pos.get(i)[1]), text: ids.map(i => G.D.articles[i].id), textposition: 'middle center', textfont: { size: 9, color: '#fff' }, customdata: ids,
      marker: { size: ids.map(i => 15 + 2.2 * Math.sqrt(deg.get(i) || 1)), color: ids.map(i => ci(lab[i])), line: { color: ids.map(i => i === focus ? '#111' : (G.D.articles[i].model ? '#E6A800' : '#fff')), width: ids.map(i => i === focus ? 3 : (G.D.articles[i].model ? 2.5 : 1)) } },
      hovertext: ids.map(i => `<b>#${G.D.articles[i].id}</b> C${lab[i]} · ${deg.get(i)} links<br>${G.esc(G.D.articles[i].title.slice(0, 90))}`), hoverinfo: 'text' });
    Plotly.react('cnet', tr, { uirevision: V.ids.join(','), margin: { l: 10, r: 10, t: 10, b: 10 }, xaxis: { visible: false }, yaxis: { visible: false, scaleanchor: 'x' }, showlegend: false, annotations: ann, paper_bgcolor: '#fff', plot_bgcolor: '#fff', font: { color: ink } }, { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d'] });
    const el = $('cnet'); if (el.removeAllListeners) el.removeAllListeners('plotly_click');
    el.on('plotly_click', e => { const p = e.points.find(x => x.customdata != null); if (p) { focus = p.customdata; document.querySelector('input[name=cscope][value=focus]').checked = true; G.measureUpdate(CI.render); } });
    // summary of the focus
    const a = G.D.articles[focus], out = E.filter(e => e[0] === focus).length, inn = E.filter(e => e[1] === focus).length;
    $('csummary').innerHTML = `<b>Focus: #${a.id}</b> ${G.esc(a.title)} (C${lab[focus]}) · cites ${out} and is cited by ${inn} of the retained articles${G.D.cited_by[focus] != null ? ` · ${G.D.cited_by[focus]} citations in total (OpenAlex)` : ''}. Showing ${V.ids.length} articles and ${V.edges.length} links. Arrows point from the citing to the cited article; yellow rim = model paper.`;
    // cluster matrix
    const k = Math.max(...lab), cnt = Array.from({ length: k }, () => new Array(k).fill(0)); E.forEach(([x, y]) => cnt[lab[x] - 1][lab[y] - 1]++);
    const meas = document.querySelector('input[name=cmeas]:checked').value, rows = cnt.map(r => { const s = r.reduce((u, v) => u + v, 0); return r.map(v => meas === 'share' ? (s ? v / s : 0) : v); });
    G.lazyPlot('cmat', () => Plotly.react('cmat', [{ type: 'heatmap', x: rows.map((_, i) => 'C' + (i + 1)), y: rows.map((_, i) => 'C' + (i + 1)), z: rows, text: rows.map(r => r.map(v => meas === 'share' ? Math.round(100 * v) + '%' : String(v))), texttemplate: '%{text}', hovertemplate: 'citing %{y} → cited %{x}: %{text}<extra></extra>', colorscale: [[0, '#F7FBFF'], [1, '#08519C']], showscale: false }],
      { margin: { l: 50, r: 10, t: 24, b: 50 }, xaxis: { title: 'cited cluster', side: 'bottom' }, yaxis: { title: 'citing cluster', autorange: 'reversed' }, paper_bgcolor: '#fff', plot_bgcolor: '#fff', font: { color: ink } }, { displaylogo: false, responsive: true, displayModeBar: false }));
    // edge table
    $('cedges').innerHTML = `<table class="t"><tr><th>Citing</th><th>Cluster</th><th>Cited</th><th>Cluster</th></tr>${V.edges.map(([x, y]) => `<tr><td>#${G.D.articles[x].id} ${G.esc(G.D.articles[x].title.slice(0, 90))}</td><td>C${lab[x]}</td><td>#${G.D.articles[y].id} ${G.esc(G.D.articles[y].title.slice(0, 90))}</td><td>C${lab[y]}</td></tr>`).join('')}</table>`;
  };
  CI.setup = function () {
    prepare();
    $('cfocus').onchange = e => { focus = +e.target.value; document.querySelector('input[name=cscope][value=focus]').checked = true; G.measureUpdate(CI.render); };
    document.querySelectorAll('input[name=cscope],input[name=cmeas]').forEach(r => r.onchange = () => G.measureUpdate(CI.render));
    $('cdepth').onchange = $('clab').onchange = () => G.measureUpdate(CI.render);
  };
})();
