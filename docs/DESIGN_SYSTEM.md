# Slim SVG — Design System

Three-level token architecture for consistent UI polish across light and dark modes.

## Token layers

```
Primitive  →  Semantic  →  Component
(raw values)  (meaning)     (UI parts)
```

### 1. Primitive tokens

Raw, context-free values. **Never use directly in components.**

Defined in `apps/frontend/src/styles/tokens/primitives.css`:

- **Color palettes** — brand (sky), neutral (slate), success (emerald), warning (amber), error (rose)
- **Alpha overlays** — white/black at 5%, 10%, 50%, 80%
- **Spacing** — 0–96 scale (4px base)
- **Typography** — font families, sizes, weights, line heights, letter spacing
- **Radius** — sm → full
- **Shadows** — sm → 2xl (raw rgba stacks)
- **Motion** — durations (fast / normal / slow) and easings
- **Z-index** — dropdown, sticky, drawer, overlay, modal

### 2. Semantic tokens

Purpose-driven aliases that **change per theme** (`data-theme="dark"` | `data-theme="light"`).

Defined in `apps/frontend/src/styles/tokens/semantic.css`:

| Category | Examples |
|----------|----------|
| Background | `--color-bg-canvas`, `--color-bg-elevated`, `--color-bg-subtle`, `--color-bg-overlay` |
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse` |
| Brand | `--color-primary`, `--color-primary-hover`, `--color-primary-subtle`, `--color-primary-text` |
| Border | `--color-border-default`, `--color-border-subtle`, `--color-border-focus` |
| Status | `--color-success-*`, `--color-warning-*`, `--color-error-*` |
| Shadow | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-drawer` |
| Space | `--space-page-x`, `--space-section-y`, `--space-stack-*`, `--space-inline-*` |
| Type | `--font-size-*`, `--font-weight-*`, `--line-height-*` |
| Motion | `--duration-*`, `--ease-*` |

### 3. Component tokens

Scoped to a single UI piece. Defined at the top of each `*.css` file next to its `*.tsx`.

Component tokens **must reference semantic tokens** (and only reach for primitives when no semantic token fits).

Example (`Layout.css`):

```css
.layout {
  --layout-header-height: var(--space-14);
  --layout-header-bg: var(--color-bg-elevated);
  --layout-header-border: var(--color-border-default);
}
```

## File structure

```
apps/frontend/src/
  index.css                          ← master entry (primitives + semantics + global)
  styles/tokens/
    primitives.css
    semantic.css
  components/
    Layout.tsx + Layout.css
    AssetRow.tsx + AssetRow.css
    …
  pages/
    LandingPage.tsx + LandingPage.css
    WorkspacePage.tsx + WorkspacePage.css
```

Each component/page imports its own CSS:

```tsx
import './Layout.css';
```

## Theming

Set theme on `<html>`:

```html
<html data-theme="dark">
```

Toggle in JS:

```ts
document.documentElement.dataset.theme = 'light'; // or 'dark'
localStorage.setItem('theme', 'light');
```

Default: **light** (set in `main.tsx` / `index.html`). Users with `theme: dark` in localStorage keep their preference.

## Rules

1. **Components use component classes**, not primitive hex values.
2. **Semantic tokens** are the only layer that differs between light/dark.
3. **New colors** → add primitive → map to semantic → use in component token.
4. **Shared patterns** (primary button, ghost button) reuse the same semantic tokens across component CSS files.
5. Keep **BEM-style** naming: `.block`, `.block__element`, `.block--modifier`.

## Tailwind

Tailwind v4 remains imported for optional utility use during migration. New UI work should prefer the token + component CSS system above.

## Complexity & status badges

Badge modifier classes live in `AssetRow.css`:

- `.asset-row__status--optimizing`
- `.asset-row__complexity--simple | --moderate | --complex | --unknown`

Use `complexityClass()` from `utils/format.ts` for complexity level class names.
