// Tab 4: Data dictionary (the raw workbook, with the PCA features each column produced)
(function () {
  const $ = G.$, DT = {}; G.dict = DT;
  let q = '', renderedQuery = null;
  const trunc = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;

  DT.render = function () {
    if (!G.hasExtra) { $('dtable').innerHTML = '<div class="skeleton" style="height:200px">Loading the workbook…</div>'; G.extra().then(DT.render); return; }
    if($('catalogue-coding').classList.contains('on')){G.catalogue.render();return;}
    const D = G.D, st = G.st, ql = q.toLowerCase(),key=ql+'|'+G.n;
    if (renderedQuery === key) {
      $('dtable').querySelectorAll('.chip[data-f]').forEach(chip => {
        const on = st.ticks.has(chip.dataset.f);
        chip.classList.toggle('on', on);
        chip.title = (G.F[chip.dataset.f]?.label || chip.dataset.f) + ': click to ' + (on ? 'remove from' : 'add to') + ' the PCA';
      });
      return;
    }
    renderedQuery = key;
    const head = D.dict.map(d => `<th style="min-width:130px;vertical-align:top;text-align:left"><div>${d.roles.map(r => `<span class="badge b-${r}">${r}</span>`).join('')}</div>` +
      `<div style="margin:3px 0">${d.feeds.map(f => `<span class="chip${st.ticks.has(f) ? ' on' : ''}" data-f="${f}" aria-disabled="${G.excluded.has(f)}" title="${G.F[f] ? G.esc(G.F[f].label) : ''}: click to ${st.ticks.has(f) ? 'remove from' : 'add to'} the PCA">${G.esc(G.F[f] ? G.F[f].label : f)}</span>`).join('')}</div>` +
      `<div title="${G.esc(d.full)}">${d.col}. ${G.esc(d.name)}</div>${(() => { const i = d.full.indexOf(' ('); return i > 0 && d.full.endsWith(')') ? `<div class="defn" title="${G.esc(d.full)}">${G.esc(d.full.slice(i + 2, -1))}</div>` : ''; })()}</th>`).join('');
    const rows = [];
    D.raw.forEach((r, i) => { if (ql && !r.some(c => c.toLowerCase().includes(ql))) return; rows.push(`<tr><td style="text-align:right;color:#888">${i + 1}</td>${r.map(c => `<td><span class="cell" title="${G.esc(c.slice(0, 700))}">${G.esc(trunc(c, 90))}</span></td>`).join('')}</tr>`); });
    $('dtable').innerHTML = `<table class="mat"><thead><tr><th style="top:0">#</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    $('dcount').textContent = `${rows.length} of ${D.raw.length} articles`;
    $('dtable').querySelectorAll('.chip[data-f]').forEach(c => c.onclick = () => G.toggle(c.dataset.f));
  };
  DT.setup = function () {
    G.catalogue.setup();
    document.querySelectorAll('[data-catalogue]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-catalogue]').forEach(b=>b.classList.toggle('on',b===button));document.querySelectorAll('.catalogue-view').forEach(v=>v.classList.toggle('on',v.id==='catalogue-'+button.dataset.catalogue));G.measureUpdate(DT.render);});
    let searchTimer;
    $('dsearch').oninput = e => { q = e.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => G.measureUpdate(DT.render), 120); };
    $('dl-raw').onclick = async () => { await G.extra(); G.csv([G.D.dict.map(d => d.name), ...G.D.raw], 'dgabm_workbook_retained_articles.csv'); };
  };
})();
