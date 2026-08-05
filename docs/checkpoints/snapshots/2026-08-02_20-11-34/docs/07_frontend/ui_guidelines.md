# UI/UX Frontend Design System Guidelines

This document details styling rules, design tokens, and components for both Web and Mobile.

---

## 1. Typography & Hierarchy
- **Primary Font**: `Inter` (Sleek, highly readable).
- **Heading Font**: `Outfit` (Modern, premium editorial look).
- **Scale**:
  - `h1`: 32px / Bold / Outfit
  - `h2`: 24px / Semibold / Outfit
  - `body`: 14px / Regular / Inter

---

## 2. Palette (Sleek Dark Mode Baseline)

For the web BI dashboards and mobile apps, use a curated HSL palette:

| Token | HSL Value | Purpose |
|-------|-----------|---------|
| **`background`** | HSL(224, 71%, 4%) | Premium deep blue/dark backdrop |
| **`card`** | HSL(224, 71%, 7%) | Elevated containers |
| **`primary`** | HSL(263, 70%, 50%)| Vibrant violet signature |
| **`accent`** | HSL(190, 90%, 50%)| Sleek cyan for highlights |
| **`muted`** | HSL(215, 20%, 65%)| Subdued text and borders |
| **`destructive`**| HSL(0, 85%, 60%) | Fraud and violation alerts |

---

## 3. UI Component Specifications
- **Borders & Shadows**: Radii must conform to `rounded-xl` (12px) for cards, and `rounded-md` (8px) for buttons. Use subtle, diffuse glow shadows (`shadow-purple-500/10`) on active states.
- **Micro-Animations**: All button hover states must transitions linearly over `150ms` (e.g. scale up by `1.02` on tap/hover).
- **Gradients**: Use background gradients: `bg-gradient-to-tr from-violet-600 to-cyan-500` for primary call-to-actions.

---

## 4. UI/UX Pro Libraries

Pharma OS leverages premium components:
- **Tailwind UI Pro**: Dashboard containers, table components, and form groups must match Tailwind UI Pro standards.
- **Glassmorphism Layering**: Active modals use backdrop blur filters (`backdrop-blur-md bg-white/5 border border-white/10`) to establish depth.

