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

  const scope = 'https://www.googleapis.com/auth/drive.file';
  let config, tokenClient, token, expiresAt, initialization, rows = [], busy = false;

  async function request(range, options = {}) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}`;
    const response = await fetch(url, {
      ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const error = new Error(response.status === 403
        ? 'Ask the Sheet owner for access. Saving requires edit access.'
        : 'Google Sheets could not complete the request.');
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function viewHash(link) {
    try {
      const hash = new URL(link).hash;
      if (hash.startsWith('#pca?view=')) {
        read(new URLSearchParams(hash.slice(5)).get('view'));
        return hash;
      }
    } catch {}
    return '';
  }

  async function refresh() {
    const {values = []} = await request('A2:D');
    rows = values.filter(row => viewHash(row[3])).reverse();
    $('saved-pca-views').replaceChildren(...rows.map(([name, author, date], i) =>
      new Option([name, author, String(date ?? '').slice(0, 10)].filter(Boolean).join(' · '), String(i))));
  }

  function updateControls() {
    const connected = Boolean(token && Date.now() < expiresAt);
    $('connect-view-sheet').hidden = !tokenClient || connected;
    $('connect-view-sheet').disabled = busy;
    $('shared-pca-views').disabled = !connected;
    $('save-to-sheet').disabled = busy;
    $('load-from-sheet').disabled = busy || rows.length === 0;
    $('refresh-view-sheet').disabled = busy;
  }

  function connection(message) {
    $('view-connection-status').textContent = message;
    updateControls();
  }

  async function initialize() {
    try {
      const response = await fetch('saved-views-sheets.json', {cache: 'no-store'});
      if (!response.ok) throw new Error();
      config = await response.json();
      if (!/^[\w-]+$/.test(config.spreadsheetId || '') || !config.clientId || !config.apiKey ||
          !/^\d+$/.test(config.projectNumber || '')) throw new Error();
      await G.loadScript('https://accounts.google.com/gsi/client');
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: config.clientId, scope,
        callback: acceptToken,
        error_callback: () => connection('Google sign-in did not finish. Try connecting again.')
      });
      connection('Connect your Google account to access the team’s saved views.');
    } catch {
      connection('Save and Load will be available once the shared Google Sheet is connected. You can copy a restore link now.');
    }
  }

  async function chooseSheet() {
    await G.loadScript('https://apis.google.com/js/api.js');
    await new Promise((resolve, reject) => gapi.load('picker', {callback: resolve, onerror: reject}));
    const dialog = $('save-view-dialog');
    dialog.close();
    return new Promise(resolve => {
      const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
      new google.picker.PickerBuilder().addView(view).setAppId(config.projectNumber)
        .setDeveloperKey(config.apiKey).setOAuthToken(token)
        .setOrigin(window.location.origin).setTitle('Select DG-ABM saved PCA views')
        .setCallback(data => {
          if (data.action !== google.picker.Action.PICKED && data.action !== google.picker.Action.CANCEL) return;
          dialog.showModal();
          resolve(data.action === google.picker.Action.PICKED && data.docs[0]?.id === config.spreadsheetId);
        }).build().setVisible(true);
    });
  }

  async function acceptToken(response) {
    if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response, scope)) {
      connection('Google sign-in was incomplete. Try again.');
      return;
    }
    busy = true;
    token = response.access_token;
    expiresAt = Date.now() + (Number(response.expires_in) - 30) * 1000;
    try {
      try {
        await refresh();
      } catch (error) {
        if (![403, 404].includes(error.status)) throw error;
        if (!await chooseSheet()) throw new Error('Select the team’s dedicated DG-ABM saved PCA views Sheet.');
        await refresh();
      }
      connection(rows.length ? 'Connected to the team’s Google Sheet.' : 'Connected. No saved views yet.');
    } catch (error) {
      token = null;
      connection(error.message);
    } finally {
      busy = false;
      updateControls();
    }
  }

  async function run(task) {
    busy = true;
    $('save-view-status').textContent = '';
    updateControls();
    try {
      if (Date.now() >= expiresAt) throw Object.assign(new Error(), {status: 401});
      await task();
    } catch (error) {
      if (error.status === 401) {
        token = null;
        connection('Reconnect Google to continue.');
      } else {
        $('save-view-status').textContent = error.message || 'Google Sheets could not complete the request.';
      }
    } finally {
      busy = false;
      updateControls();
    }
  }

  V.setup = () => {
    const dialog = $('save-view-dialog');
    $('save-view').onclick = () => {
      $('save-view-status').textContent = '';
      $('save-view-copy').hidden = true;
      dialog.showModal();
      updateControls();
      if (!initialization) initialization = initialize();
      else if (token && Date.now() < expiresAt && !busy) run(refresh);
    };
    $('close-save-view').onclick = () => dialog.close();
    $('copy-view-link').onclick = async () => {
      const link = V.link(), field = $('save-view-copy');
      field.hidden = true;
      try {
        await navigator.clipboard.writeText(link);
        $('save-view-status').textContent = 'Restore link copied.';
      } catch {
        field.value = link;
        field.hidden = false;
        field.select();
        $('save-view-status').textContent = 'Copy the selected restore link.';
      }
    };
    $('connect-view-sheet').onclick = () => tokenClient.requestAccessToken();
    $('refresh-view-sheet').onclick = () => run(refresh);
    $('view-name').oninput = event => event.target.setCustomValidity('');
    $('save-view-form').onsubmit = event => {
      event.preventDefault();
      const name = $('view-name').value.trim();
      if (!name) {
        $('view-name').setCustomValidity('Enter a name for this view.');
        $('view-name').reportValidity();
        return;
      }
      const row = [name, $('view-author').value.trim(), new Date().toISOString(), V.link()];
      run(async () => {
        await request('A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
          method: 'POST', body: JSON.stringify({ values: [row] })
        });
        $('view-name').value = '';
        $('save-view-status').textContent = 'Saved to Google Sheets.';
        try { await refresh(); } catch {
          $('save-view-status').textContent = 'Saved to Google Sheets. Use Refresh list to see the new view.';
        }
      });
    };
    $('load-from-sheet').onclick = () => {
      const row = rows[Number($('saved-pca-views').value)];
      const hash = row && viewHash(row[3]);
      if (!hash) return;
      dialog.close();
      if (location.hash === hash) window.dispatchEvent(new Event('hashchange'));
      else location.hash = hash;
    };
  };
})();
