// PCA tab extras: statistical suggestion of what to tick, exact/category weights, semi-subjective 3D summary map
(function () {
  const $ = G.$, X = {}; G.ext = X;
  const GRP = () => G.D.group_order;

  // ------------------------------------------------------------- statistical suggestion (3 screening steps, as in the R app)
  function suggest(prevMin, rMax, commMin) {
    const D = G.D, n = G.n, pool = G.inScope();
    const info = pool.map(f => { const c = G.col.get(f), v = D.X.map(r => r[c]), bin = v.every(x => x === 0 || x === 1), mean = G.mean(v); return { f, c, v, bin, mean, prev: bin ? 100 * mean : null, constant: new Set(v).size < 2 }; });
    const res = new Map(info.map(i => [i.f, { feature: i.f, label: G.F[i.f].label, category: D.group_titles[G.F[i.f].group], type: i.bin ? '0/1' : 'number', prevalence: i.bin ? +i.prev.toFixed(1) : null, maxr: null, similar: '', comm: null, decision: 'IN', reason: '' }]));
    info.forEach(i => { const r = res.get(i.f);   // step 1: constant / prevalence
      if (i.constant) { r.decision = 'OUT'; r.reason = 'constant'; }
      else if (i.bin && (i.prev < prevMin || i.prev > 100 - prevMin)) { r.decision = 'OUT'; r.reason = `prevalence ${Math.round(i.prev)}% outside ${prevMin}-${100 - prevMin}% (fewer than ~${Math.ceil(n * prevMin / 100)} articles in the minority class)`; } });
    let alive = info.filter(i => res.get(i.f).decision === 'IN');
    if (alive.length > 1) {   // step 2: redundancy, greedy, most informative first
      const ordered = alive.map((i, idx) => ({ i, idx, inf: i.bin ? i.mean * (1 - i.mean) : 0.25 })).sort((a, b) => b.inf - a.inf || a.idx - b.idx).map(o => o.i);
      ordered.forEach(i => { const m = i.mean, sd = Math.sqrt(i.v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)); i.z = i.v.map(x => (x - m) / sd); });
      const kept = [];
      for (const i of ordered) {
        if (kept.length) { let best = -1, bj = null; kept.forEach(k => { let d = 0; for (let t = 0; t < n; t++) d += i.z[t] * k.z[t]; const r = Math.abs(d / (n - 1)); if (r > best) { best = r; bj = k; } });
          const rr = res.get(i.f); rr.maxr = +best.toFixed(2); rr.similar = G.F[bj.f].label;
          if (best >= rMax) { rr.decision = 'OUT'; rr.reason = `duplicates ${rr.similar} (|r| = ${best.toFixed(2)})`; continue; } }
        kept.push(i);
      }
      alive = kept;
    }
    if (alive.length >= 4) {   // step 3: communality on the retained PCs
      const { Z } = G.C.standardize(D.X, alive.map(i => i.c), null), P = G.C.pca(Z), tot = P.sdev2.reduce((a, b) => a + Math.max(b, 0), 0);
      let cum = 0, npc = 2; for (let j = 0; j < P.sdev2.length; j++) { cum += P.sdev2[j] / tot; if (cum >= 0.70) { npc = Math.max(2, j + 1); break; } }
      alive.forEach((i, k) => { let c = 0; for (let j = 0; j < npc; j++) c += (P.loadings[j][k] * Math.sqrt(Math.max(P.sdev2[j], 0))) ** 2; const r = res.get(i.f); r.comm = +c.toFixed(2);
        if (c < commMin) { r.decision = 'OUT'; r.reason = `communality ${c.toFixed(2)} < ${commMin.toFixed(2)} on the ${npc} PCs covering 70% of the variance (poorly represented)`; } });
    }
    res.forEach(r => { if (r.decision === 'IN') r.reason = 'passes all three checks'; });
    return pool.map(f => res.get(f));
  }
  X.suggest = suggest;
  let sug = [];
  function renderSuggest() {
    if (!$('sugbox').open) return;
    const a = +$('sg1').value, b = +$('sg2').value, c = +$('sg3').value; $('sg1v').textContent = a; $('sg2v').textContent = b.toFixed(2); $('sg3v').textContent = c.toFixed(2);
    sug = suggest(a, b, c); const inn = sug.filter(r => r.decision === 'IN').length;
    $('sugsum').innerHTML = `<b>${inn} of ${sug.length}</b> features of this scope pass; ${sug.length - inn} are suggested OUT (constant or rare: ${sug.filter(r => /^(constant|prevalence)/.test(r.reason)).length}, redundant: ${sug.filter(r => /^duplicates/.test(r.reason)).length}, poorly represented: ${sug.filter(r => /^communality/.test(r.reason)).length}).`;
    $('sugtable').innerHTML = `<table class="t"><tr><th>Feature</th><th>Category</th><th>Type</th><th>Prev. %</th><th>max |r|</th><th>Similar to</th><th>Comm.</th><th>Decision</th><th>Reason</th><th>Ticked now</th></tr>${sug.map(r => `<tr><td>${G.esc(r.label)}</td><td>${G.esc(r.category)}</td><td>${r.type}</td><td>${r.prevalence ?? ''}</td><td>${r.maxr ?? ''}</td><td>${G.esc(r.similar)}</td><td>${r.comm ?? ''}</td><td><span class="badge ${r.decision === 'IN' ? 'b-CAT' : 'b-FILTER'}">${r.decision}</span></td><td>${G.esc(r.reason)}</td><td>${G.st.ticks.has(r.feature) ? 'yes' : ''}</td></tr>`).join('')}</table>`;
  }

  // ------------------------------------------------------------- exact weights + category weights
  function weightsPanel() {
    const st = G.st, D = G.D, scope = G.inScope(), box = $('wbox'); if (!box) return;
    const gs = GRP().filter(g => D.features.some(f => f.group === g && scope.includes(f.key)));
    box.innerHTML = '<h5 style="margin:14px 0 4px">Category weights</h5><div class="row">' + gs.map(g => `<label style="min-width:190px">${G.esc(D.group_titles[g])} <b data-v="${g}">${st.cw[g].toFixed(2)}</b><br><input type="range" min="0" max="3" step="0.05" value="${st.cw[g]}" data-cw="${g}" style="width:100%"></label>`).join('') + '</div>' +
      '<h5 style="margin:14px 0 4px">Individual feature weights (all features of this scope)</h5><p class="help">A weight above 0 switches the feature on, 0 switches it off. The final weight of a feature is its own weight times its category weight.</p>' +
      gs.map(g => `<div style="margin-bottom:6px"><b style="font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#546E7A">${G.esc(D.group_titles[g])}</b><div class="row" style="gap:6px 14px">${D.features.filter(f => f.group === g && scope.includes(f.key)).map(f => `<label style="width:170px;font-size:12px">${G.esc(f.label)}<br><input type="number" min="0" max="5" step="0.25" value="${st.w[f.key]}" data-fw="${f.key}" style="width:80px"></label>`).join('')}</div></div>`).join('');
    box.querySelectorAll('[data-cw]').forEach(r => r.oninput = () => { st.cw[r.dataset.cw] = +r.value; box.querySelector(`[data-v="${r.dataset.cw}"]`).textContent = (+r.value).toFixed(2); G.emit('state'); });
    box.querySelectorAll('[data-fw]').forEach(i => i.onchange = () => { const v = Math.max(0, +i.value || 0); st.w[i.dataset.fw] = v; if (v > 0) st.ticks.add(i.dataset.fw); else st.ticks.delete(i.dataset.fw); G.emit('state'); });
  }
  X.weightsPanel = weightsPanel;

  // ------------------------------------------------------------- semi-subjective 3D summary map (all source papers)
  const PURP = { 'Genetic architecture & selection': '#6A3D9A', 'Life history & demography': '#0072B2', 'Interactions & co-evolution': '#D55E00', 'Spatial dynamics & dispersal': '#009E73', 'Environmental change & persistence': '#E69F00', 'Management & harvest': '#CC79A7' };
  let sumDone = false;
  async function renderSummary() {
    if (sumDone) return; sumDone = true;
    await Promise.all([G.extra(), G.need3d()]);
    const S = G.D.summary, hv = r => `<b>W${r.id} · ${G.esc(r.title)}</b><br>${G.esc(r.authors)} (${r.year ?? 'n/a'})<br><b>Field:</b> ${G.esc(r.field)}<br><b>Initial detail:</b> ${G.esc(r.detail)}<br><b>Study style:</b> ${G.esc(r.quant)}<br><b>Main purpose:</b> ${G.esc(r.purpose)}<br><b>Status:</b> ${r.retained ? 'Retained for analysis' : 'Excluded from analysis'}${r.model ? '<br><b>One of the 27 model papers</b>' : ''}`;
    const tr = Object.keys(PURP).map(pu => { const rs = S.filter(r => r.retained && r.purpose === pu); return { type: 'scatter3d', mode: 'markers', name: pu, x: rs.map(r => r.x), y: rs.map(r => r.y), z: rs.map(r => r.z), customdata: rs.map(r => r.id), text: rs.map(hv), hoverinfo: 'text', marker: { size: 5.5, opacity: 0.78, color: PURP[pu], line: { width: 0.5, color: '#fff' } } }; });
    const ex = S.filter(r => !r.retained); tr.push({ type: 'scatter3d', mode: 'markers', name: 'Excluded from PCA/clustering', x: ex.map(r => r.x), y: ex.map(r => r.y), z: ex.map(r => r.z), customdata: ex.map(r => r.id), text: ex.map(hv), hoverinfo: 'text', marker: { size: 6.5, opacity: 0.8, color: '#8A8A8A', line: { color: '#4F4F4F', width: 1 } } });
    $('sum3d').innerHTML = '';
    Plotly.react('sum3d', tr, { margin: { l: 0, r: 0, b: 90, t: 10 }, legend: { orientation: 'h', x: 0, y: -0.02 }, paper_bgcolor: '#fff',
      scene: { aspectmode: 'cube', camera: { eye: { x: 0.78, y: 0.78, z: 0.62 } },
        xaxis: { title: 'Field', tickmode: 'array', tickvals: [1, 2, 3, 4, 5], ticktext: ['Theory', 'Pop. genetics', 'Eco-evo', 'Conservation', 'Management'], tickfont: { size: 9 }, range: [0.65, 5.35] },
        yaxis: { title: 'Initial detail', tickmode: 'array', tickvals: [0, 1, 2, 3, 4, 5], ticktext: ['Abstract', 'Single locus', 'QTL', 'QTL detail', 'Corr./structure', 'LD/dom./epi.'], tickfont: { size: 9 }, range: [-0.35, 5.35] },
        zaxis: { title: 'Study style', tickmode: 'array', tickvals: [1, 2, 3, 4, 5], ticktext: ['Conceptual', 'Scenarios', 'Quant. exp.', 'Empirical', 'Calibrated'], tickfont: { size: 9 }, range: [0.65, 5.35] } } }, { displaylogo: false, responsive: true });
    $('sum3d').on('plotly_click', e => { const r = S.find(x => x.id === e.points[0].customdata); if (!r) return;
      $('suminfo').innerHTML = `<h4>3D-map paper inspector</h4><p style="margin:4px 0"><b>W${r.id}</b> ${G.esc(r.title)}</p><p class="help" style="margin:0">${G.esc(r.authors)} · ${r.year ?? 'n/a'} · ${r.retained ? 'retained for analysis' : 'excluded from analysis'}${r.model ? ' · one of the 27 model papers' : ''}<br>X: ${G.esc(r.field)} · Y: ${G.esc(r.detail)} · Z: ${G.esc(r.quant)} · purpose: ${G.esc(r.purpose)}</p>`; });
  }

  // ------------------------------------------------------------- wiring
  X.render = function () { renderSuggest(); };
  X.setup = function () {
    $('sugbox').addEventListener('toggle', renderSuggest);
    ['sg1', 'sg2', 'sg3'].forEach(id => $(id).oninput = renderSuggest);
    $('sugapply').onclick = () => { sug.forEach(r => { if (r.decision === 'IN') { G.st.ticks.add(r.feature); if (G.st.w[r.feature] <= 0) G.st.w[r.feature] = 1; } else G.st.ticks.delete(r.feature); }); weightsPanel(); G.emit('state'); };
    $('wbox-eq').onclick = () => { const st = G.st, cnt = GRP().map(g => G.D.features.filter(f => f.group === g && st.ticks.has(f.key)).length), act = cnt.filter(c => c > 0).length, tot = cnt.reduce((a, b) => a + b, 0);
      GRP().forEach((g, i) => st.cw[g] = cnt[i] > 0 ? +((tot / act) / cnt[i]).toFixed(2) : 1); weightsPanel(); G.emit('state'); };
    $('wbox-reset').onclick = () => { G.D.columns.forEach(c => G.st.w[c] = 1); GRP().forEach(g => G.st.cw[g] = 1); weightsPanel(); G.emit('state'); };
    G.on('scope', weightsPanel); weightsPanel();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); renderSummary(); } }, { rootMargin: '300px' }); io.observe($('sum3d'));
  };
})();
