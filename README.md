# Website Intelligence Toolkit

Website Intelligence Toolkit is a real Manifest V3 browser extension for Chromium-based browsers (Chrome, Edge, Brave) that analyzes the active tab and presents a structured dashboard in the popup.

## Phase 1 capabilities

- Framework detection for React, Next.js, Vue, Angular, Svelte, Preact, Solid, Astro, and Nuxt using DOM and page-context signals.
- DOM analysis for forms, buttons, inputs, dialogs, tables, links, images, iframes, scripts, stylesheets, custom elements, and open shadow roots.
- Resource exploration for scripts, stylesheets, images, fonts, and lazy-loaded images.
- Storage inspection for localStorage keys, sessionStorage keys, IndexedDB names (when `indexedDB.databases()` is supported), Cache Storage names, and service worker presence.
- Web3 inspection for wallet/provider signals plus common libraries such as ethers.js, viem, web3.js, and wagmi.
- Runtime instrumentation for `fetch`, `XMLHttpRequest`, `WebSocket`, and `EventSource` after the extension is injected.
- Performance summary for navigation timing, paint timing, LCP, CLS, long tasks, and memory where supported.
- Security overview for third-party scripts, mixed-content URLs, observable CSP/Permissions Policy metadata, and cookie names/flags available through extension permissions.
- JSON export from the popup.

## Project structure

- `/manifest.json`
- `/background.js`
- `/content.js`
- `/injected.js`
- `/modules/shared.js`
- `/modules/content-helpers.js`
- `/modules/popup-render.js`
- `/popup/popup.html`
- `/popup/popup.js`
- `/popup/popup.css`

## Load the unpacked extension

1. Open Chrome, Edge, or Brave.
2. Go to the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository root: `/home/runner/work/Web3Intel/Web3Intel`.
6. Open any HTTP or HTTPS page.
7. Click the extension icon and press **Analyze** if analysis does not run automatically.

## Manual test flow

1. Load the unpacked extension.
2. Open a site you want to inspect.
3. Reload the page if you want the runtime network instrumentation to start as early as possible.
4. Use the popup to review:
   - Frameworks
   - Web3 signals
   - Resources
   - DOM counts
   - Storage
   - Network/API events
   - Performance metrics
   - Security hints
5. Click **Export JSON** to download the structured report.

## Local validation

This repository includes a lightweight `npm test` command that performs syntax checks for the JavaScript files and validates the manifest JSON.

```bash
cd /home/runner/work/Web3Intel/Web3Intel
npm test
```

## Notes and limitations

- Runtime network instrumentation only captures activity that happens **after** the extension has injected into the page.
- Response bodies and restricted headers are not claimed unless they are genuinely observable from the page context.
- Cookie values are intentionally omitted; only names and flags are reported.
- Some APIs depend on browser support, page permissions, or page timing, so sections may report partial data when the browser does not expose more detail.
