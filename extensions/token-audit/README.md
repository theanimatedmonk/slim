# SlimVG Token Inspect — Chrome Extension

Click-to-inspect for design tokens — like DevTools, but for your token tree.

```
Component CSS  →  Semantic token  →  Primitive token  →  raw value
.icon-btn--download
  background: var(--color-bg-inverse)
    → --color-bg-inverse
      → --primitive-brand-800 = #262626
```

The **npm audit** (`npm run audit:tokens`) stays separate for CI. This extension no longer audits; it only inspects.

## Install

1. Bundle:

   ```bash
   npm run sync:token-audit
   ```

2. Chrome → **Extensions** → **Developer mode** → **Load unpacked** (or **Reload**)

   Select: `extensions/token-audit`

3. Run the app: `npm run dev:frontend` → open `http://localhost:5173`

4. Click the extension → **Start inspect**

5. Click any element on the page. Expand a token chip to see the full chain.

**Esc** or the panel **×** exits inspect mode.

## What you see

| UI | Meaning |
|----|---------|
| Blue dashed box | Hover target |
| Blue solid box | Selected element |
| Panel header | Primary selector (e.g. `.icon-btn--download`) |
| Property row | Declared CSS value |
| Token chip + ▸ | Click to expand semantic → primitive → hex/rem |
| Layer badges | `component` / `semantic` / `primitive` |

## Shared core

Token resolution lives in `packages/token-audit-core/`. After editing it:

```bash
npm run sync:token-audit
```

Then reload the extension in Chrome.

## Limitations

- **localhost only**
- Pseudo-states (`:hover`) are matched in a simplified way — hover styles may not always appear
- Cross-origin stylesheets cannot be read
