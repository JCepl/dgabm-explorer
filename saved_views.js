// A saved PCA view carries settings in the link fragment. The workbook stays in the app.
(function () {
  const $ = G.$, V = G.views = {};
  const toggles = {
    auto: 'auto', mark: 'mark', nums: 'nums', load: 'load',
    focusLoadings: 'focus-loadings', d3: 'd3', wmode: 'wmode', includeExcluded: 'inclx'
  };
  const nonUnitWeights = weights => Object.fromEntries(Object.entries(weights).filter(([, weight]) => weight !== 1));

  V.capture = () => {
    const st = G.st;
    return {
      version: 1, data: G.D.generated,
      ticks: G.inScope().filter(key => st.ticks.has(key)),
      weights: nonUnitWeights(st.w), categoryWeights: nonUnitWeights(st.cw),
      toggles: Object.fromEntries(Object.entries(toggles).map(([key, id]) => [key, $(id).checked])),
      k: st.k, arrows: $('topn').value,
      component: +$('pcsel').dataset.v || 0, bars: $('loading-count').value,
      step: $('wstep').value, paper: G.D.articles[st.sel]?.id,
      panel: document.querySelector('#workspace-tabs [data-view].on')?.dataset.view
    };
  };

  V.link = () => {
    const bytes = new TextEncoder().encode(JSON.stringify(V.capture()));
    const token = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
      .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    const url = new URL(location.href);
    url.hash = `pca?view=${token}`;
    return url.href;
  };

  function read(token) {
    if (!/^[A-Za-z0-9_-]{1,30000}$/.test(token)) throw new Error('Invalid saved view.');
    const bytes = Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const view = JSON.parse(new TextDecoder().decode(bytes));
    if (view?.version !== 1 || typeof view.data !== 'string' || !Array.isArray(view.ticks) ||
        !view.ticks.every(key => typeof key === 'string')) throw new Error('Invalid saved view.');
    return view;
  }

  function weightsFor(keys, saved) {
    return Object.fromEntries(keys.map(key => {
      const weight = saved?.[key];
      return [key, Number.isFinite(weight) && weight >= 0 ? weight : 1];
    }));
  }

  function selectOption(id, value) {
    const select = $(id);
    if ([...select.options].some(option => option.value === value)) select.value = value;
  }

  function apply(view) {
    const st = G.st, keys = new Set(G.inScope());
    st.ticks = new Set(view.ticks.filter(key => keys.has(key)));
    st.w = weightsFor(G.D.columns, view.weights);
    st.cw = weightsFor(G.D.group_order, view.categoryWeights);
    if (Number.isInteger(view.k) && view.k >= G.KR[0] && view.k <= G.KR[1]) st.k = view.k;
    $('k').value = st.k;
    for (const [key, id] of Object.entries(toggles)) {
      if (key === 'includeExcluded' || typeof view.toggles?.[key] !== 'boolean') continue;
      st[key] = $(id).checked = view.toggles[key];
    }
    const include = view.toggles?.includeExcluded === true;
    $('inclx').checked = include;
    if (include !== st.includeExcluded) G.setIncludeExcluded(include);
    const paperIndex = G.D.articles.findIndex(paper => paper.id === view.paper);
    st.sel = paperIndex < 0 ? null : paperIndex;
    G.emit('papers');
    selectOption('topn', view.arrows);
    selectOption('loading-count', view.bars);
    selectOption('wstep', view.step);
    st.topn = +$('topn').value;
    st.wstep = +$('wstep').value;
    $('pcsel').dataset.v = Number.isInteger(view.component) && view.component >= 0 ? view.component : 0;
    G.ext.weightsPanel();
    const panel = [...document.querySelectorAll('#workspace-tabs [data-view]')].find(button => button.dataset.view === view.panel);
    if (panel && !panel.classList.contains('on')) panel.click();
    return view.data !== G.D.generated || view.ticks.some(key => !keys.has(key));
  }

  V.restore = hash => {
    const query = hash.slice('#pca?'.length);
    if (!hash.startsWith('#pca?') || !new URLSearchParams(query).has('view')) return false;
    try {
      const changed = apply(read(new URLSearchParams(query).get('view')));
      if (changed) showMessage('This view was saved with a different data release. Check the selected variables and results.');
    } catch (error) {
      console.warn('Saved PCA view could not be restored.', error);
      showMessage('This saved view link could not be read. Ask the sender to copy it again.');
      return false;
    }
    return true;
  };

  function showMessage(message) {
    $('save-view-status').textContent = message;
    if (!$('save-view-dialog').open) $('save-view-dialog').showModal();
  }

  // Keep user-entered values in a single cell and prevent evaluation as a formula.
  const cell = value => value.trim().replace(/[\t\r\n]+/g, ' ').replace(/^[=+@-]/, match => "'" + match);

  async function copy(text, message) {
    const field = $('save-view-copy');
    field.hidden = true;
    try {
      await navigator.clipboard.writeText(text);
      $('save-view-status').textContent = message;
    } catch {
      field.value = text;
      field.hidden = false;
      field.select();
      $('save-view-status').textContent = 'Copy the selected text.';
    }
  }

  V.setup = () => {
    const dialog = $('save-view-dialog');
    $('save-view').onclick = () => {
      $('save-view-status').textContent = '';
      $('save-view-copy').hidden = true;
      dialog.showModal();
    };
    $('close-save-view').onclick = () => dialog.close();
    $('copy-view-link').onclick = () => copy(V.link(), 'Restore link copied.');
    $('view-name').oninput = event => event.target.setCustomValidity('');
    $('save-view-form').onsubmit = event => {
      event.preventDefault();
      const name = cell($('view-name').value);
      if (!name) {
        $('view-name').setCustomValidity('Enter a name for this view.');
        $('view-name').reportValidity();
        return;
      }
      const date = new Date().toISOString();
      const row = [name, cell($('view-author').value), date, V.link()].join('\t');
      copy(row, 'Row copied. Paste it into the first column of an empty row in Google Sheets.');
    };
  };
})();
