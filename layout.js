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
  document.getElementById('variables-jump').onclick=()=>document.getElementById('variable-search').focus();
  const citationButtons = document.querySelectorAll('#citation-tabs [data-cview]');
  citationButtons.forEach(button => button.onclick = () => {
    citationButtons.forEach(other => other.classList.toggle('on', other === button));
    document.querySelectorAll('.citation-view').forEach(view => view.classList.toggle('on', view.id === 'citation-' + button.dataset.cview));
    resizeVisiblePlots();
  });
  document.getElementById('crossbox').addEventListener('toggle', resizeVisiblePlots);

  function setPlotSize(card, size) {
    const larger = size === 'larger', full = size === 'full';
    card.classList.toggle('larger', larger);
    card.classList.toggle('expanded', full);
    const mediumButton = card.querySelector('[data-medium]');
    const fullButton = card.querySelector('[data-expand]');
    mediumButton.setAttribute('aria-pressed', String(larger));
    fullButton.setAttribute('aria-pressed', String(full));
    mediumButton.textContent = larger ? 'Normal size' : 'Larger';
    fullButton.textContent = full ? 'Exit full screen' : 'Full screen';
    resizeVisiblePlots();
  }
  document.querySelectorAll('.plot-size button').forEach(button => button.onclick = () => {
    const card = button.closest('.plot-card');
    const open = document.querySelector('.plot-card.larger, .plot-card.expanded');
    if (open && open !== card) setPlotSize(open, 'normal');
    setPlotSize(card, button.getAttribute('aria-pressed') === 'true' ? 'normal' : (button.hasAttribute('data-medium') ? 'larger' : 'full'));
  });
  document.addEventListener('keydown', event => {
    const card = document.querySelector('.plot-card.larger, .plot-card.expanded');
    if (event.key === 'Escape' && card) setPlotSize(card, 'normal');
  });
})();
