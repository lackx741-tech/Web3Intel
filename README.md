# Website Intelligence Toolkit (Phase 1)

Website Intelligence Toolkit is a real Manifest V3 browser extension for Chrome/Edge/Brave that analyzes the active tab and shows a structured dashboard.

## What it does in Phase 1

- Framework detection: React, Next.js, Vue, Angular, Svelte, Preact, Solid, Astro, Nuxt
- DOM analysis: forms, buttons, inputs, dialogs, tables, links, images, iframes, scripts, stylesheets, custom elements, open shadow roots, service worker visibility
- Resource analysis: scripts, stylesheets, images, fonts (observable), videos, lazy-loaded images (best-effort)
- Storage analysis: localStorage keys, sessionStorage keys, IndexedDB names (where API allows), Cache Storage names (where allowed)
- Web3 detection:
  - Providers/signals: MetaMask, Coinbase Wallet, Phantom, WalletConnect indicators
  - Libraries/signals: ethers.js, viem, web3.js, wagmi
- Runtime network instrumentation after injection:
  - fetch, XMLHttpRequest, WebSocket, EventSource
  - API kind inference: REST / GraphQL / JSON-RPC / WebSocket / SSE
- Performance overview:
  - navigation timing, paint timing, LCP, CLS, long tasks, memory (browser support varies)
- Security overview:
  - third-party scripts, mixed-content candidates, accessible cookie names, CSP/Permissions Policy only where observable from the page
- JSON export from popup

## Extension structure

- `manifest.json`
- `background.js`
- `content.js`
- `injected.js`
- `popup/popup.html`
- `popup/popup.js`
- `popup/popup.css`
- `modules/framework.js`
- `modules/dom.js`
- `modules/resources.js`
- `modules/storage.js`
- `modules/performance.js`
- `modules/security.js`
- `modules/report.js`

## Important limitations (honest scope)

- This extension only sees what browser extension APIs and page context make observable.
- Runtime network instrumentation starts **after** the extension content/injected scripts load on a page.
- Header-level security data such as full CSP response headers is not directly readable from content scripts.
- Only cookies available via `document.cookie` are shown; HttpOnly cookies are not accessible.
- Cross-origin iframe internals are not readable due to browser security boundaries.
- Some APIs are browser/version/context dependent (for example `indexedDB.databases()`, `performance.memory`, policy interfaces).

## Load unpacked in Chrome/Edge/Brave

1. Open extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder (`Web3Intel`).
5. Open any target website, then click the extension icon.
6. Click **Analyze / Refresh** to collect data.
7. Click **Export JSON** to save the report.

## Validation commands

Install and run the local checks:

```bash
npm install
npm test
```

`npm test` validates:
- `manifest.json` parses as valid JSON
- all required extension files exist
- popup and manifest paths are internally consistent
- JavaScript files parse without syntax errors
