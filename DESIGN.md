# Design System — needaname

## Product Context
- **What this is:** Universal name availability checker — describe your project, get names checked across domain, npm, GitHub, and Telegram simultaneously.
- **Who it's for:** Developers naming projects, bots, packages, and products.
- **Space/industry:** Developer tools, naming/branding utilities.
- **Project type:** Single-page web app + Telegram bot + API/MCP.

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — function-first, data-dense, monospace accents, muted palette.
- **Decoration level:** Minimal — typography and data density do the work. No illustrations, gradients, or blobs.
- **Mood:** Power tool. Like `htop` meets Linear. Respects the developer's time. The product does one thing and does it fast.
- **Reference sites:** Linear (dark mode, minimal), GitHub (developer-focused), Vercel (Geist typography).

## Typography
- **Display/Hero:** Geist 700 — clean geometric sans, built for developer products. Authoritative without being corporate.
- **Body:** Geist 400 — same family for consistency. Works at small sizes on dark backgrounds.
- **UI/Labels:** Geist Mono 400 — monospace for platform labels, scores, and technical metadata.
- **Data/Names:** Geist Mono 500 — names are code artifacts (usernames, package names). They should look like code.
- **Code:** Geist Mono 400.
- **Loading:** Google Fonts CDN: `https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap`
- **Scale:**
  - Hero: 36px / 700
  - H1: 20px / 600
  - Body: 14px / 400
  - Small: 13px / 400
  - Label: 11px / 500, uppercase, 0.1em letter-spacing
  - Mono name: 14px / 500
  - Mono label: 12px / 400

## Color
- **Approach:** Restrained — one accent (green for "available"), everything else neutral zinc.
- **Background:** `#09090b` (zinc-950)
- **Surface:** `#18181b` (zinc-900, elevated elements)
- **Border:** `#27272a` (zinc-800)
- **Text primary:** `#fafafa` (zinc-50)
- **Text secondary:** `#a1a1aa` (zinc-400)
- **Text tertiary:** `#71717a` (zinc-500)
- **Accent / Available:** `#22c55e` (green-500)
- **Accent dim:** `#166534` (green-800, for hover/border states)
- **Taken:** `#3f3f46` (zinc-700, muted — positive framing, NOT red)
- **Semantic:**
  - Success: bg `#052e16`, border `#22c55e`, text `#86efac`
  - Warning: bg `#451a03`, border `#f59e0b`, text `#fcd34d`
  - Error: bg `#450a0a`, border `#ef4444`, text `#fca5a5`
  - Info: bg `#172554`, border `#3b82f6`, text `#93c5fd`
- **Dark mode:** This IS dark mode. No light mode in v1.
- **Focus ring:** `#22c55e` (green, matches accent)

## Spacing
- **Base unit:** 4px
- **Density:** Compact — like a terminal, not a marketing page.
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Result row gap:** 0 (separated by 1px border)
- **Section gap:** 48px
- **Page padding:** 24px
- **Max content width:** 720px

## Layout
- **Approach:** Grid-disciplined — strict alignment, predictable structure. Single-page.
- **Grid:** Single column, centered. No sidebar, no nav.
- **Max content width:** 720px
- **Border radius:** sm: 4px, md: 6px, lg: 8px (minimal, dev-tool feel)
- **Responsive breakpoint:** 768px
  - Desktop: horizontal availability matrix (columns for platforms), input + button inline
  - Mobile: vertical matrix (stacked per name), button full-width below input

## Motion
- **Approach:** Minimal-functional
- **Easing:** enter: ease-out, exit: ease-in, move: ease-in-out
- **Duration:** micro: 50-100ms (hover), short: 150ms (border-color, opacity), medium: 300ms (expand/collapse)
- **Skeleton loading:** shimmer animation, 1.5s infinite, linear-gradient sweep
- **Results:** fade-in on arrival (opacity 0→1, 150ms)
- **Expand/collapse:** height transition, 300ms ease-in-out
- **No:** scroll animations, entrance choreography, parallax, or decorative motion

## Component Patterns
- **Input:** Dark surface bg, 1px border, 4px radius, monospace placeholder, green focus ring
- **Button primary:** Green bg, dark text, monospace font, 4px radius
- **Button secondary:** Transparent bg, 1px border, white text, monospace font
- **Button ghost:** No border, secondary text color, hover → primary text
- **Alert:** Left 3px border, tinted background, semantic colors
- **Result row:** Full-width, 1px bottom border, hover → surface bg
- **Expanded detail:** Surface bg, 6px radius, registration links + copy button

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-23 | Initial design system created | Created by /design-consultation based on product context and competitive research |
| 2026-03-23 | Geist as sole font family | Maximum coherence — one family (sans + mono) covers all roles |
| 2026-03-23 | Muted gray for "taken" instead of red | Positive framing — available names pop, taken names fade |
| 2026-03-23 | No hero section / no marketing copy | Input IS the product. Zero friction for developers. |
| 2026-03-23 | Dark mode only (v1) | Developer audience lives in dark mode. Light mode deferred. |
| 2026-03-23 | 720px max width | Single-column, compact. The matrix is the visual centerpiece. |
