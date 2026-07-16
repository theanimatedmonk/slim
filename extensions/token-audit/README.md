# SlimVG Token Audit — Chrome Extension

Visual design-token audit overlay for local development. Highlights naked hex codes, primitive token leaks, hardcoded lengths, and off-palette colors directly on the page.

Works alongside `npm run audit:tokens` (CI / pre-commit). The extension is for **in-browser review** while you build UI.

## Install (unpacked)

1. Sync shared audit rules and bundle the content script:

   ```bash
   npm run sync:token-audit
   ```

2. Open Chrome → **Extensions** → enable **Developer mode**.

3. Click **Load unpacked** (or **Reload** if already loaded) and select:

   ```
   extensions/token-audit
   ```

4. Start the frontend dev server:

   ```bash
   npm run dev:frontend
   ```

5. Open `http://localhost:5173`, **refresh the tab**, then click the **Token Audit** extension icon → **Enable overlay**.

> If the popup shows dashes for counts, refresh the dev page once after loading the extension, then click **Rescan page**.

## What it shows

| Rule | Severity | On-page signal |
|------|----------|----------------|
| `no-naked-color` | error | Red outline — `#hex` / `rgb()` outside `var()` |
| `no-primitive-in-component` | error | Red outline — `var(--primitive-*)` in component CSS |
| `no-naked-length` | warn | Amber outline — raw `rem`/`px` on spacing props |
| `no-naked-z-index` | warn | Amber outline — numeric `z-index` |
| `unknown-color` | error | Red outline — computed color not in token palette |

- **Highlights** — one element at a time with a dimmed backdrop
- **Callout** — anchored tooltip showing value + violation type (e.g. "Color is #000" / "Hard coded HEX value")
- **Step through** — use **← →** buttons on the callout (or keyboard arrow keys) to move between findings

## Popup controls

- **Enable overlay** — toggle highlights on/off (state persists)
- **Rescan page** — re-run audit after HMR / navigation

## Shared audit core

Rules live in `packages/token-audit-core/`. Both the npm script and extension use the same logic:

```
packages/token-audit-core/src/   ← source of truth
scripts/audit-design-tokens.mjs  ← CI / terminal
extensions/token-audit/lib/      ← copied for Chrome (run sync:token-audit after core changes)
```

After editing `token-audit-core`, run:

```bash
npm run sync:token-audit
```

Then reload the extension in Chrome.

## Limitations

- **localhost only** — manifest matches `http://localhost/*` and `http://127.0.0.1/*`
- **Same-origin CSS** — cross-origin stylesheets cannot be read from CSSOM
- **Computed vs source** — `unknown-color` uses resolved values; token-backed colors that resolve to hex are OK if they're in the palette
- **Complex selectors** — pseudo-selectors (`:hover`, `::before`) are skipped for element matching

## Regenerate icons

```bash
node scripts/generate-token-audit-icons.mjs
```
