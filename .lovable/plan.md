- Landing Page Critic

A single-page SaaS tool: paste a URL, get an AI critique of the landing page with a score, copy the report, or share it via a public link.

### Screens

- **/** — hero + URL input with "Analyze" button, "Try demo" (pre-filled example URL), loading animation, then the report rendered inline.
- **/r/$id** — read-only shared report page (same report layout, no input), so shared links work for anyone.

### Report layout

- Header card: overall **score /100** with an animated circular gauge, site title/URL, one-line verdict.
- Three sections, each with a sub-score, strengths, and specific issues:
  1. **UI/UX** — layout, hierarchy, spacing, color
  2. **Copywriting** — headline clarity, CTA strength, messaging
  3. **Conversion** — prioritized suggestions to lift signups/sales
- Actions bar: **Copy report** (markdown to clipboard), **Share report** (saves + copies link).
- Bottom CTA: "Want me to implement these fixes? Contact" → mailto/contact link.

### How analysis works

1. Server fetches the URL's HTML and extracts title, meta description, headings (h1–h3), visible body text, button/link labels, and image alt counts. HTML-only fetch (no headless browser) — heavily JS-rendered pages return thin content, and the report will say so rather than guessing.
2. Extracted content goes to Lovable AI (`google/gemini-3.6-flash`) with a critic prompt, returning structured JSON: scores, verdict, and per-section findings.
3. Report renders from that JSON. Errors (unreachable site, blocked by bot protection, AI rate limit / credits) surface as clear inline messages.

### Backend

Lovable Cloud is enabled so shared reports persist:

- `reports` table: id, url, site_title, overall_score, report JSON, created_at.
- Public read policy (reports are only readable by link/id); inserts happen server-side.
- Analysis and saving run in server functions so the AI key and scraping stay off the client.

### Design

Stripe/Vercel-flavored: near-black and off-white surfaces, one restrained accent, tight geometric sans, subtle grid/gradient glow in the hero, thin borders, generous whitespace. Dark and light mode with a toggle (dark default). Smooth entrance animations on the report sections and an animated score gauge; nothing bouncy.

### Technical notes

- TanStack Start (React + Tailwind v4). Route files: `src/routes/index.tsx`, `src/routes/r.$id.tsx`.
- Analysis via `createServerFn` (scrape + AI + optional save); no Express server needed.
- Structured output with a small, constraint-free schema plus a fallback parse so malformed model output degrades instead of crashing.
- Report length capped by trimming extracted page text before the model call.
- Add a download report option so user can download the website report into a pdf file