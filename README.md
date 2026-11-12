# DG-ABM explorer — encrypted static publication

A browser-only literature explorer: PCA and hierarchy, feature matrices,
internal citations, and the data dictionary.

The application code is public. Its article records, raw table, abstracts,
summary records, and numerical matrix are published only inside
`dataset.enc.json`, compressed before encryption and encrypted with AES-256-GCM and a password-derived key
(PBKDF2-HMAC-SHA256, 600,000 iterations, random 16-byte salt and 12-byte IV).
The password and plaintext data are not included in this repository or its history.

Enter the existing shared password in the app to decrypt the dataset in your
browser. The password is not sent to GitHub or stored by the app. Reloading or
clicking Lock requires the password again. Authorized users can still download
the decrypted table. Internal Comments/Notes and Reader values are omitted.

This protects the dataset, not the public application source code. Anyone can
download the encrypted file and try passwords offline, so use a strong password.
Changing the hosted password cannot revoke previously downloaded copies.

GitHub Pages serves the root of the main branch. No R application server,
Cloudflare tunnel, or continuously running personal computer is required.
Updating the data requires rebuilding and encrypting the export locally, then
pushing only the resulting static files. Never add `data.json`, `extra.json`,
workbooks, password files, or the R/Shiny bundle to this repository.

To preview locally, run `python3 -m http.server 8079 --bind 127.0.0.1` and open
http://127.0.0.1:8079/. HTTPS (or localhost) is required for Web Crypto.
Plotly's license is included in its bundled JavaScript headers.

The layout uses a viewport-sized workspace with separate views for plots and
detailed tables. Release-specific asset URLs keep cached scripts and data aligned.
