import { decryptJson } from './crypto.mjs?v=91a497546ba3';

const form = document.getElementById('unlock-form');
const password = document.getElementById('unlock-password');
const button = document.getElementById('unlock-button');
const message = document.getElementById('unlock-message');
let packet;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src + '?v=91a497546ba3';
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error('A file could not load. Please reload and try again.'));
    document.head.appendChild(script);
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const unlockStart = performance.now();
  button.disabled = true;
  button.textContent = 'Unlocking…';
  message.textContent = '';
  let unlocked;
  try {
    if (!crypto.subtle) throw new Error('Use a modern browser over HTTPS to unlock this app.');
    if (!packet) {
      const response = await fetch('dataset.enc.json?v=91a497546ba3');
      if (!response.ok) throw new Error('The encrypted dataset could not load. Please try again.');
      packet = await response.json();
    }
    unlocked = await decryptJson(packet, password.value);
  } catch (error) {
    message.textContent = error.name === 'OperationError' ? 'Wrong password. Please try again.' : error.message;
    button.disabled = false;
    button.textContent = 'Open explorer';
    password.focus();
    return;
  }

  // Decrypted records and the password are never written to browser storage.
  password.value = '';
  window.DGABM_DATA = unlocked;
  let sourceAssets;
  window.DGABM_GET_ASSETS = () => sourceAssets || (sourceAssets = fetch(unlocked.core.downloads.asset).then(response => {
    if (!response.ok) throw new Error('Shiny source could not load. Try again.');
    return response.json();
  }).then(packet => decryptJson(packet, unlocked.core.downloads.key)).catch(error => {sourceAssets = null; throw error;}));
  document.body.classList.remove('locked');
  document.getElementById('boot').innerHTML = '<div class="spin"></div>Opening the explorer…';
  try {
    await Promise.all(['vendor/plotly-cartesian.min.js', 'core.js', 'preset.js', 'author_links.js', 'common.js', 'variables.js', 'pca.js',
      'extras.js', 'fm.js', 'cite.js', 'coding_catalogue.js', 'dict.js', 'zip.js', 'table_exports.js', 'downloads.js', 'layout.js', 'main.js'].map(loadScript));
    await window.G.latestUpdate;
    document.documentElement.dataset.unlockMs = (performance.now() - unlockStart).toFixed(1);
  } catch (error) {
    const boot = document.getElementById('boot');
    boot.textContent = error.message;
    const reload = document.createElement('button');reload.className = 'btn';reload.textContent = 'Reload';reload.onclick = () => location.reload();boot.appendChild(reload);
  }
});
