// Tab 2: Feature matrix (table, co-occurrence, clustered co-occurrence, rescaled, cross two features)
(function () {
  const $ = G.$, FM = {}; G.fm = FM; let built = {}, sub = '1';
  let M, K, nF, counts, own;      // 0/1 matrix (articles x features), keys, counts (features x features)

  function prepare() {
    const keys = G.binKeys, cols = keys.map(k => G.col.get(k)); K = keys; nF = keys.length;
    M = G.D.X.map(r => cols.map(c => r[c])); counts = Array.from({ length: nF }, () => new Float64Array(nF));
    M.forEach(r => { for (let a = 0; a < nF; a++) if (r[a]) for (let b = 0; b < nF; b++) if (r[b]) counts[a][b]++; });
    own = counts.map((r, i) => r[i]);
    $('fa').innerHTML = $('fb').innerHTML = G.D.group_order.filter(g => g !== 'continuous').map(g => `<optgroup label="${G.esc(G.D.group_titles[g])}">${keys.filter(k => G.F[k].group === g).map(k => `<option value="${k}">${G.esc(G.F[k].label)}</option>`).join('')}</optgroup>`).join('');
    $('fa').value = 'trait_growth_or_maturation'; $('fb').value = 'management_included';
    $('fm1note').textContent = `All ${nF} candidate binary features, one dot per article that has it, grouped like the PCA tab. n in each column header is how many of the ${G.n} retained articles carry the feature; Var = p(1-p). Tick a box to put the feature into the PCA.`;
  }
  const lab = k => G.F[k].label;

  // ------------------------------------------------------------- 1 table
  function table() {
    const st = G.st, groups = []; K.forEach((k, i) => { const g = G.F[k].group; if (!groups.length || groups[groups.length - 1].g !== g) groups.push({ g, n: 0 }); groups[groups.length - 1].n++; });
    const bnd = new Set(); let acc = 0; groups.forEach(g => { acc += g.n; bnd.add(acc - 1); });
    const head1 = `<tr><th class="g-x" style="left:0">&nbsp;</th>${groups.map(g => `<th colspan="${g.n}" style="color:${G.GCOL[g.g]};border-right:2px solid #b0bec5">${G.esc(G.D.group_titles[g.g])}</th>`).join('')}</tr>`;
    const head2 = `<tr><th style="text-align:left">Article</th>${K.map((k, i) => { const p = G.prev[k] / G.n; return `<th class="g-${G.F[k].group}"${bnd.has(i) ? ' style="border-right:2px solid #b0bec5"' : ''} title="${G.esc(lab(k))}"><label><input type="checkbox" data-k="${k}"${G.excluded.has(k) ? ' disabled title="Management is excluded from PCA"' : ''}${st.ticks.has(k) ? ' checked' : ''}> ${G.esc(lab(k))}</label><span class="small">n=${G.prev[k]} · Var=${(p * (1 - p)).toFixed(2)}</span></th>`; }).join('')}</tr>`;
    const body = M.map((r, i) => { const a = G.D.articles[i]; return `<tr><td title="${G.esc(a.title)}" style="text-align:left">#${a.id} ${G.esc(a.authors.split(';')[0])}${a.year ? ' ' + a.year : ''}</td>${r.map((v, j) => `<td class="dot"${bnd.has(j) ? ' style="border-right:2px solid #b0bec5"' : ''}>${v ? '●' : ''}</td>`).join('')}</tr>`; }).join('');
    $('fmtable').innerHTML = `<table class="mat"><thead>${head1}${head2}</thead><tbody>${body}</tbody></table>`;
    $('fmtable').querySelectorAll('input[data-k]').forEach(c => c.onchange = () => G.toggle(c.dataset.k));
  }
  function dl(onlyTicked) {
    const keys = onlyTicked ? K.filter(k => G.st.ticks.has(k)) : K, idx = keys.map(k => K.indexOf(k));
    G.csv([['article_id', 'authors', 'title', 'year', ...keys.map(lab)], ...M.map((r, i) => { const a = G.D.articles[i]; return [a.id, a.authors, a.title, a.year, ...idx.map(j => r[j])]; })], onlyTicked ? 'feature_matrix_ticked.csv' : 'feature_matrix_full.csv');
  }

  // ------------------------------------------------------------- heatmaps
  // dendrogram segments from merges, leaves positioned by 'pos'
  function dendLines(merges, n, pos) {
    const node = new Map(), X = [], Y = [];
    merges.forEach(q => { const xa = q.a < n ? pos.get(q.a) : node.get(q.a).x, xb = q.b < n ? pos.get(q.b) : node.get(q.b).x, ya = q.a < n ? 0 : node.get(q.a).h, yb = q.b < n ? 0 : node.get(q.b).h;
      node.set(q.id, { x: (xa + xb) / 2, h: q.height }); X.push(xa, xa, xb, xb, null); Y.push(ya, q.height, q.height, yb, null); });
    return { X, Y, hmax: merges[merges.length - 1].height };
  }
  // generic heatmap: keys (ordered), Z (values), optional tree {merges, order}
  function heat(el, keys, Z, o) {
    const m = keys.length, text = keys.map((a, i) => keys.map((b, j) => o.hover(i, j)));
    const lbls = keys.map(k => `<span style="color:${G.GCOL[G.F[k].group]}">${G.esc(lab(k).length > 24 ? lab(k).slice(0, 22) + '…' : lab(k))}</span>`);
    const tr = [{ type: 'heatmap', x: keys.map((_, i) => i), y: keys.map((_, i) => i), z: Z, text, hoverinfo: 'text', colorscale: o.scale, zmin: o.zmin, zmax: o.zmax, xaxis: 'x', yaxis: 'y', xgap: 0, ygap: 0, colorbar: { orientation: 'h', x: 1, xanchor: 'right', y: 1.0, yanchor: 'bottom', len: 0.3, thickness: 10, title: { text: o.cbar, side: 'top' } } }];
    // A fixed cell size keeps the matrix square and its numbers readable.
    const cell=G.cell||14,mg=o.tree?{l:20,r:190,t:20,b:190}:{l:190,r:20,t:20,b:190},inner=Math.ceil(m*cell/(o.tree?.88:1)),W=inner+mg.l+mg.r,H=inner+mg.t+mg.b,dom=o.tree?{x:[.12,1],y:[0,.88]}:{x:[0,1],y:[0,1]};
    const tickSize=Math.max(5,Math.min(10,Math.round(cell*.72))),numSize=Math.max(6,Math.min(12,Math.round(cell*.34)));
    $(el).style.width=W+'px';$(el).style.height=H+'px';
    const xs=[],ys=[],numbers=[],colours=[];
    Z.forEach((row,i)=>row.forEach((v,j)=>{
      if(v==null||!Number.isFinite(v))return;
      xs.push(j);ys.push(i);numbers.push(o.format?o.format(v):String(v));
      const scale=Math.max(0,Math.min(1,(v-o.zmin)/(o.zmax-o.zmin)));
      colours.push(o.zmin<0?(scale<.22||scale>.78?'#fff':'#263238'):(scale>.55?'#fff':'#263238'));
    }));
    if(cell>=20)tr.push({type:'scatter',mode:'text',x:xs,y:ys,text:numbers,textfont:{size:numSize,color:colours},hoverinfo:'skip',showlegend:false});
    const lay = {width:W,height:H,autosize:false,margin:mg,paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{size:10,color:G.font()},
      xaxis:{domain:dom.x,tickmode:'array',tickvals:keys.map((_,i)=>i),ticktext:lbls,tickangle:90,tickfont:{size:tickSize},range:[-.5,m-.5],showgrid:false,zeroline:false,automargin:false,constrain:'domain'},
      yaxis:{domain:dom.y,tickmode:'array',tickvals:keys.map((_,i)=>i),ticktext:lbls,tickfont:{size:tickSize},range:[m-.5,-.5],showgrid:false,zeroline:false,side:o.tree?'right':'left',automargin:false,scaleanchor:'x',scaleratio:1,constrain:'domain'},shapes:[],showlegend:false};
    if (o.bounds) o.bounds.forEach(b => { lay.shapes.push({ type: 'line', x0: b - 0.5, x1: b - 0.5, y0: -0.5, y1: m - 0.5, line: { color: '#fff', width: 3 } }, { type: 'line', y0: b - 0.5, y1: b - 0.5, x0: -0.5, x1: m - 0.5, line: { color: '#fff', width: 3 } }); });
    if (o.tree) {
      const pos = new Map(o.tree.order.map((l, i) => [l, i])), d = dendLines(o.tree.merges, m, pos);
      tr.push({ type: 'scatter', mode: 'lines', x: d.X, y: d.Y, xaxis: 'x2', yaxis: 'y2', line: { color: '#37474F', width: 1 }, hoverinfo: 'skip' });
      tr.push({ type: 'scatter', mode: 'lines', x: d.Y, y: d.X, xaxis: 'x3', yaxis: 'y3', line: { color: '#37474F', width: 1 }, hoverinfo: 'skip' });
      lay.xaxis2 = { domain: dom.x, range: [-0.5, m - 0.5], visible: false, anchor: 'y2' }; lay.yaxis2 = { domain: [0.90, 1], range: [0, d.hmax * 1.02], visible: false, anchor: 'x2' };
      lay.xaxis3 = { domain: [0, 0.10], range: [d.hmax * 1.02, 0], visible: false, anchor: 'y3' }; lay.yaxis3 = { domain: dom.y, range: [m - 0.5, -0.5], visible: false, anchor: 'x3' };
    }
    Plotly.react(el, tr, lay, { displaylogo: false, responsive: false, scrollZoom: false, modeBarButtonsToRemove: ['select2d', 'lasso2d'] });
    const div = $(el); if (div.removeAllListeners) div.removeAllListeners('plotly_click');
    div.on('plotly_click', e => { const p = e.points.find(x => (x.data.type === 'heatmap' || x.data.mode === 'text')); if (!p) return; openCross(keys[Math.round(p.y)], keys[Math.round(p.x)]); });
  }
  const BLUES = [[0, '#F7FBFF'], [1, '#08519C']], DIV = [[0, '#B2182B'], [.5, '#F7F7F7'], [1, '#2166AC']];
  const idx = keys => keys.map(k => K.indexOf(k));
  const hoverCount = (keys, extra) => (i, j) => { const a = keys[i], b = keys[j], ia = K.indexOf(a), ib = K.indexOf(b); const exp = own[ia] * own[ib] / G.n;
    return `<b>${G.esc(lab(a))}</b> × <b>${G.esc(lab(b))}</b><br>both: ${counts[ia][ib]} articles (${a === b ? 'own n' : 'expected if independent: ' + exp.toFixed(1)})<br>${G.esc(lab(a))}: ${own[ia]} · ${G.esc(lab(b))}: ${own[ib]}` + (extra ? '<br>' + extra(i, j) : '') + '<br><i>click: cross these two features</i>'; };

  function cooc() {
    let mx = 0; for (let i = 0; i < nF; i++) for (let j = 0; j < nF; j++) if (i !== j) mx = Math.max(mx, counts[i][j]);
    const b = []; let acc = 0, last = null; K.forEach((k, i) => { const g = G.F[k].group; if (last !== null && g !== last) b.push(i); last = g; });
    heat('cooc', K, K.map((a, i) => K.map((c, j) => counts[i][j])), { scale: BLUES, zmin: 0, zmax: mx, cbar: 'articles', hover: hoverCount(K), bounds: b });
  }
  function jaccardTree() {
    const D = new Float64Array(nF * nF); for (let i = 0; i < nF; i++) for (let j = 0; j < nF; j++) { const u = own[i] + own[j] - counts[i][j]; D[i * nF + j] = i === j ? 0 : (u ? 1 - counts[i][j] / u : 1); }
    const merges = G.C.upgma(D, nF), order = G.C.leafOrder(merges, nF); return { merges, order };
  }
  function clus() {
    const t = jaccardTree(), keys = t.order.map(i => K[i]), ix = t.order;
    let mx = 0; for (let i = 0; i < nF; i++) for (let j = 0; j < nF; j++) if (i !== j) mx = Math.max(mx, counts[i][j]);
    heat('clus', keys, ix.map(a => ix.map(b => counts[a][b])), { scale: BLUES, zmin: 0, zmax: mx, cbar: 'articles', hover: hoverCount(keys), tree: t });
  }
  function resc() {
    const method = document.querySelector('input[name=resc]:checked').value, V = counts.map((r, i) => Array.from(r, (c, j) => method === 'share' ? c / own[i] : 0));
    let values, tree, scale, zmin, zmax, note, shown, cbar, skipDiag = false;
    if (method === 'share') { values = V.map((r, i) => r.map((v, j) => v)); const cl = values.map((r, i) => r.map((v, j) => i === j ? 0 : v)); tree = treeFrom(euclidRows(cl)); scale = BLUES; zmin = 0; zmax = 1; cbar = 'share'; shown = (v) => Math.round(100 * v) + '% of the row feature\'s articles';
      note = 'Each row is divided by its own n, so every feature is a row of percentages: of the articles that have the ROW feature, how many also have the COLUMN feature. Rare and common features are now comparable, but the matrix is not symmetric. Clustering: Euclidean distance between rows, average linkage.'; }
    else if (method === 'phi') { values = counts.map((r, i) => Array.from(r, (c, j) => { const pa = own[i] / G.n, pb = own[j] / G.n, den = Math.sqrt(pa * (1 - pa) * pb * (1 - pb)); return den ? (c / G.n - pa * pb) / den : 0; })); const D = new Float64Array(nF * nF); values.forEach((r, i) => r.forEach((v, j) => D[i * nF + j] = i === j ? 0 : 1 - v)); tree = treeFromD(D); scale = DIV; zmin = -1; zmax = 1; cbar = 'phi'; skipDiag = true; shown = v => 'phi x100 = ' + Math.round(100 * v);
      note = 'Phi = Pearson correlation of two 0/1 features (x100): +100 always together, 0 unrelated, -100 never together. It is already corrected for how common each feature is. Clustering: 1 - phi, average linkage.'; }
    else { values = counts.map((r, i) => Array.from(r, (c, j) => i === j ? 0 : Math.log2((c + 0.5) / (own[i] * own[j] / G.n + 0.5)))); tree = treeFrom(euclidRows(values)); scale = DIV; zmin = -3; zmax = 3; cbar = 'log2 lift'; skipDiag = true; shown = v => 'log2 lift = ' + v.toFixed(1);
      note = 'Lift = observed co-occurrence divided by what would be expected if the two features were independent (log2 scale, +0.5 added to avoid log of zero, clipped at ±3). +1 = twice as often as expected, -1 = half as often. Clustering: Euclidean distance between rows, average linkage.'; }
    $('rescnote').textContent = note;
    const ix = tree.order, keys = ix.map(i => K[i]), Z = ix.map(a => ix.map(b => (skipDiag && a === b) ? null : values[a][b]));
    heat('resc', keys, Z, { scale, zmin, zmax, cbar, tree, format: v => method==='share'?Math.round(100*v)+'%':v.toFixed(2), hover: (i, j) => hoverCount(keys, (x, y) => (ix[x] === ix[y] && skipDiag) ? 'diagonal' : 'rescaled: ' + shown(values[ix[x]][ix[y]]))(i, j) });
  }
  function corrTab() {
    const D = G.D, n = G.n, groups = [...document.querySelectorAll('#corr-groups input:checked')].map(i => i.value);
    const vars = D.features.filter(f => groups.includes(f.group)).map(f => { const c = G.col.get(f.key), v = D.X.map(r => r[c]), m = G.mean(v), sd = Math.sqrt(v.reduce((q, x) => q + (x - m) ** 2, 0) / (n - 1)); return { k: f.key, z: sd > 0 ? v.map(x => (x - m) / sd) : null }; }).filter(x => x.z);
    const m = vars.length; G.lastCorrN = m; if (m < 2) { $('traitcorr').innerHTML = '<p class="help" style="padding:20px">Tick at least two groups of variables.</p>'; return; }
    const R = vars.map(a => vars.map(b => { let d = 0; for (let t = 0; t < n; t++) d += a.z[t] * b.z[t]; return d / (n - 1); }));
    const clustered = document.querySelector('input[name=corder]:checked').value === 'cluster', absD = document.querySelector('input[name=cdist]:checked').value === 'abs';
    let order = vars.map((_, i) => i), tree;
    if (clustered) { const Dm = new Float64Array(m * m); for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) Dm[i * m + j] = i === j ? 0 : Math.max(0, 1 - (absD ? Math.abs(R[i][j]) : R[i][j])); const merges = G.C.upgma(Dm, m); order = G.C.leafOrder(merges, m); tree = { merges, order }; }
    const keys = order.map(i => vars[i].k), Z = order.map(a => order.map(b => R[a][b]));
    heat('traitcorr', keys, Z, { scale: DIV, zmin: -1, zmax: 1, cbar: 'Pearson r', tree, format: v => Math.abs(v) < .005 ? '0.00' : v.toFixed(2),
      hover: (i, j) => `<b>${G.esc(lab(keys[i]))}</b> × <b>${G.esc(lab(keys[j]))}</b><br>r = ${Z[i][j].toFixed(3)}${keys[i] === keys[j] ? ' (diagonal)' : ''}<br><i>click: cross these two features (0/1 features only)</i>` });
  }
  function euclidRows(R) { const m = R.length, D = new Float64Array(m * m); for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) { let s = 0; for (let k = 0; k < R[i].length; k++) s += (R[i][k] - R[j][k]) ** 2; D[i * m + j] = D[j * m + i] = Math.sqrt(s); } return D; }
  function treeFromD(D) { const merges = G.C.upgma(D, nF); return { merges, order: G.C.leafOrder(merges, nF) }; }
  function treeFrom(D) { return treeFromD(D); }

  // ------------------------------------------------------------- cross two features
  function cross() {
    const a = $('fa').value, b = $('fb').value, ia = K.indexOf(a), ib = K.indexOf(b); if (ia < 0 || ib < 0) return;
    const c = [[0, 0], [0, 0]], ids = [[[], []], [[], []]]; M.forEach((r, i) => { c[r[ia]][r[ib]]++; ids[r[ia]][r[ib]].push(i); });
    const N = G.n, r0 = c[0][0] + c[0][1], r1 = c[1][0] + c[1][1], c0 = c[0][0] + c[1][0], c1 = c[0][1] + c[1][1];
    let html = `<table class="t" style="width:auto"><tr><th></th><th>${G.esc(lab(b))}: no</th><th>${G.esc(lab(b))}: yes</th><th>total</th></tr>` +
      [0, 1].map(x => `<tr><th>${G.esc(lab(a))}: ${x ? 'yes' : 'no'}</th>${[0, 1].map(y => `<td><b>${c[x][y]}</b> <span class="help">(${(x ? r1 : r0) ? Math.round(100 * c[x][y] / (x ? r1 : r0)) : 0}% of row)</span></td>`).join('')}<td>${x ? r1 : r0}</td></tr>`).join('') + `<tr><th>total</th><td>${c0}</td><td>${c1}</td><td>${N}</td></tr></table>`;
    const den = r0 * r1 * c0 * c1;
    if (!den) html += '<p class="warn">One of these features has no variation (always 0 or always 1): no test possible.</p>';
    else {
      const ad = Math.abs(c[0][0] * c[1][1] - c[0][1] * c[1][0]), chi = N * Math.max(ad - N / 2, 0) ** 2 / den, p = G.chi1p(chi), exp = [r0 * c0, r0 * c1, r1 * c0, r1 * c1].map(v => v / N), small = exp.filter(v => v < 5).length, phi = (c[0][0] * c[1][1] - c[0][1] * c[1][0]) / Math.sqrt(den);
      html += `<div class="${small ? 'card warn' : 'card'}" style="margin-top:10px"><h4>Chi-square check</h4><b>X² = ${chi.toFixed(2)}</b>, df = 1, p = ${p < 0.001 ? '<0.001' : p.toFixed(3)} (Yates continuity correction, as in R) · phi = ${phi.toFixed(2)}${small ? `<br>${small} of the 4 expected counts are below 5, so treat the p-value as approximate.` : ''}</div>`;
    }
    const both = ids[1][1]; html += `<details style="margin-top:8px"><summary>Articles with both (${both.length})</summary><p class="help">${both.map(i => `#${G.D.articles[i].id} ${G.esc(G.D.articles[i].title.slice(0, 80))}`).join('<br>') || 'none'}</p></details>`;
    $('crossout').innerHTML = html;
  }
  function openCross(a, b) { if (K.indexOf(a) < 0 || K.indexOf(b) < 0) return; $('fa').value = a; $('fb').value = b; cross(); const d = $('crossbox'); d.open = true; }

  // ------------------------------------------------------------- wiring
  FM.render = function () {
    if (!M) return;
    if (sub === '1') {
      if (!built[1]) { table(); built[1] = true; }
      else $('fmtable').querySelectorAll('input[data-k]').forEach(input => input.checked = G.st.ticks.has(input.dataset.k));
    }
    else if (!built[sub]) { ({ 2: cooc, 3: clus, 4: resc, 5: corrTab })[sub](); built[sub] = true; }
  };
  // zoom: cell size in pixels (default small); numbers appear from 20 px
  FM.setCell = function (v, keepScroll) {
    G.cell = Math.max(6, Math.min(44, Math.round(v))); $('zm').value = G.cell; $('zval').textContent = G.cell + ' px per cell' + (G.cell >= 20 ? ' (numbers shown)' : '');
    built = { 1: built[1] }; FM.render(); window.dispatchEvent(new Event('resize'));
  };
  FM.fit = function () {
    const box = document.querySelector('.sub.on .matrix-scroll'); if (!box) return; const sb = +sub, m = sb === 5 ? (G.lastCorrN || 57) : K.length;
    const tree = sb === 3 || sb === 4 || (sb === 5 && document.querySelector('input[name=corder]:checked').value === 'cluster');
    FM.setCell(Math.floor((box.clientWidth - 210) * (tree ? .88 : 1) / m));
  };
  FM.setup = function () {
    prepare(); G.cell = G.cell || 14;
    $('corr-groups').innerHTML = G.D.group_order.map(g => `<label><input type="checkbox" value="${g}" checked> ${G.esc(G.D.group_titles[g])}</label>`).join('');
    $('corr-groups').querySelectorAll('input').forEach(i => i.onchange = () => { built[5] = false; FM.render(); });
    document.querySelectorAll('input[name=corder],input[name=cdist]').forEach(r => r.onchange = () => { built[5] = false; FM.render(); });
    $('zm').value = G.cell; $('zval').textContent = G.cell + ' px per cell';
    $('zm').oninput = () => FM.setCell(+$('zm').value); $('zm-').onclick = () => FM.setCell(G.cell * 0.85); $('zm+').onclick = () => FM.setCell(G.cell * 1.18); $('zfit').onclick = FM.fit;
    document.querySelectorAll('#tab-fm .matrix-scroll').forEach(b => b.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); FM.setCell(G.cell * (e.deltaY < 0 ? 1.12 : 0.9)); } }, { passive: false }));
    $('fmtabs').querySelectorAll('button').forEach(b => b.onclick = () => { sub = b.dataset.s; $('zoombar').style.display = +sub >= 2 ? '' : 'none'; $('fmtabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.sub').forEach(s => s.classList.toggle('on', s.id === 'fm' + sub)); G.measureUpdate(FM.render); window.dispatchEvent(new Event('resize')); });
    document.querySelectorAll('input[name=resc]').forEach(r => r.onchange = () => { built[4] = false; G.measureUpdate(FM.render); window.dispatchEvent(new Event('resize')); });
    $('fa').onchange = $('fb').onchange = cross; $('fm-dl-all').onclick = () => dl(false); $('fm-dl-tick').onclick = () => dl(true); cross();
  };
})();
