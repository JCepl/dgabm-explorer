// View switches keep the current analysis and only resize the newly visible plots.
(function () {
  function resizeVisiblePlots() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.js-plotly-plot').forEach(plot => {
        if (plot.getClientRects().length) Plotly.Plots.resize(plot);
      });
      window.dispatchEvent(new Event('resize'));
    });
  }
  const viewButtons = document.querySelectorAll('#workspace-tabs [data-view]');
  viewButtons.forEach(button => button.onclick = () => {
    viewButtons.forEach(other => {
      other.classList.toggle('on', other === button);
      other.setAttribute('aria-selected', String(other === button));
    });
    document.querySelectorAll('.workspace-view').forEach(view => view.classList.toggle('on', view.id === 'view-' + button.dataset.view));
    resizeVisiblePlots();
  });
  const citationButtons = document.querySelectorAll('#citation-tabs [data-cview]');
  citationButtons.forEach(button => button.onclick = () => {
    citationButtons.forEach(other => other.classList.toggle('on', other === button));
    document.querySelectorAll('.citation-view').forEach(view => view.classList.toggle('on', view.id === 'citation-' + button.dataset.cview));
    resizeVisiblePlots();
  });
  document.getElementById('crossbox').addEventListener('toggle', resizeVisiblePlots);

  // enlarge a plot card to a full window (Esc or the button closes it)
  function toggleExpand(button) {
    const card = button.closest('.plot-card'), on = card.classList.toggle('expanded');
    button.textContent = on ? '✕ Close' : '⤢ Enlarge'; resizeVisiblePlots(); setTimeout(resizeVisiblePlots, 250);
  }
  document.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => toggleExpand(b));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const c = document.querySelector('.plot-card.expanded'); if (c) toggleExpand(c.querySelector('[data-expand]')); } });
})();
