# 🖍️ Napkin 
**Draw it on a napkin. Ship it to production. Enjoy!**

[![Open Source](https://img.shields.io/badge/Open%20Source-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Hacktoberfest 2026](https://img.shields.io/badge/Hacktoberfest-Kumasi_2026-orange.svg)](https://hacktoberfest.com/)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Powered by Gemini & Gemma](https://img.shields.io/badge/AI-Gemini%20%26%20Gemma-4285F4)](https://ai.google.dev/)

Napkin is an open-source developer tool that converts hand-drawn UI sketches into fully functional, responsive HTML & CSS in seconds. Built by **Felix & Nonydev** for **Hacktoberfest Hack Day Kumasi 2026**.

## ✨ Features
- **Sketch-to-UI Engine:** Multimodal vision AI powered by Google Gemini (`gemini-3.8-flash`) or free local Gemma via Ollama.
- **Glassmorphism & Parallax:** A visually stunning, scroll-linked GenZ landing page using Framer Motion.
- **Live Code Editor:** Tweak the generated UI in real-time with an embedded Monaco editor and live debounced sandbox preview.
- **Device Targeting:** Select custom dimensions (Mobile, Tablet, Desktop, or Custom) before generating.
- **Interactive Onboarding:** 10-second tour guide for first-time users.
- **Auth & Cloud Saves:** Free-tier Supabase integration. Anyone can generate, and logging in unlocks saved projects, safe HTML exports, and public sharing.
- **Accessible Light / Dark Mode:** Custom themes with Monaco editor sync and persistent preference.

## 🛠️ Tech Stack
- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4
- **Animations:** Framer Motion
- **Backend & Auth:** Supabase (PostgreSQL, Auth, RLS)
- **AI / LLM:** Google Gemini API (`gemini-3.8-flash`) & Local Ollama (`gemma3n:e2b`)
- **Live Editor:** `@monaco-editor/react`

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install

```bash
git clone https://github.com/nonydev27/napkin.git
cd napkin
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Environment Variables (`.env.local`)

```dotenv
# Google Gemini API (default)
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash

# Optional: Free local Ollama with Gemma
OLLAMA_BASE_URL=http://127.0.0.1:11434
GEMMA_MODEL=gemma3n:e2b

# Supabase (optional, for accounts, private saving & public shares)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Rate limiting for /api/generate (per hour; defaults shown)
RATE_LIMIT_ANON_PER_HOUR=5
RATE_LIMIT_USER_PER_HOUR=30
```

---

## ☁️ Deployment (Vercel)

1. Push your repository to GitHub.
2. In [Vercel Dashboard](https://vercel.com/new), import your `napkin` repository.
3. In **Project Settings → Environment Variables**, add:
   - `AI_PROVIDER`: `gemini` (Production, Preview, and Development).
   - `GEMINI_API_KEY`: Your key from [Google AI Studio](https://aistudio.google.com/apikey).
   - `GEMINI_MODEL`: `gemini-3.8-flash`.
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`).
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Your Supabase Publishable / Anon key.
   - `NEXT_PUBLIC_SITE_URL`: Your deployed Vercel domain (`https://your-napkin.vercel.app`).
4. Redeploy the Production deployment after adding or changing these variables.
5. In **Supabase Dashboard → Authentication → URL Configuration**:
   - Set **Site URL** to `https://your-napkin.vercel.app`.
   - Add `https://your-napkin.vercel.app/**` and `https://your-napkin.vercel.app/auth/callback` to **Redirect URLs**.

---

## 🗄️ Supabase Setup (Free Tier)

1. Create a Supabase project on the Free-plan.
2. In the **SQL Editor**, run [`supabase/migrations/20261024000000_projects.sql`](supabase/migrations/20261024000000_projects.sql). It creates the projects table and owner-scoped Row Level Security (RLS) policies.
3. Run [`supabase/migrations/20261111000000_rate_limits.sql`](supabase/migrations/20261111000000_rate_limits.sql). It creates the `rate_limits` table and the `consume_rate_limit` function used to rate-limit generation.
4. For GitHub login, enable GitHub in **Authentication → Providers** and configure the OAuth callback with Supabase.

---

## ⏱️ Rate limiting

`POST /api/generate` is rate limited per hour so anonymous traffic cannot drain the Gemini API key:

| Caller | Default | Env var |
| --- | --- | --- |
| Anonymous (per IP) | 5 / hour | `RATE_LIMIT_ANON_PER_HOUR` |
| Signed-in (per user id) | 30 / hour | `RATE_LIMIT_USER_PER_HOUR` |

When Supabase is configured, counts are stored in Postgres through the `consume_rate_limit` RPC, which increments atomically and works across serverless instances. The `rate_limits` table has RLS enabled with no policies, so clients cannot read or write it directly. Run the [rate limits migration](supabase/migrations/20261111000000_rate_limits.sql) to enable this.

Without Supabase (local development), the limiter falls back to an in-memory `Map` and logs a warning. That fallback is per server instance and resets on redeploy, so it is **not** suitable for production.

Responses include `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers. Blocked requests return `429` with a `Retry-After` header and a JSON error body.

---

## 📁 Project Structure

```text
src/
  app/
    api/generate/route.ts       Multimodal vision generation (Gemini & Ollama)
    api/projects/route.ts       Authenticated project history and saves
    auth/callback/route.ts      Supabase OAuth code exchange
    projects/[id]/page.tsx      Private saved project preview
    projects/page.tsx           Private project history
    share/[id]/page.tsx         Explicitly shared, sandboxed preview
    globals.css                 Responsive dark/light design system
    layout.tsx                  App metadata, OG tags, and root layout
    page.tsx                    Landing page and generation workspace
  components/
    auth-modal.tsx              Email/password and GitHub sign-in
    brand.tsx                   Shared brand mark
    napkin-app.tsx              Landing, responsive workspace, tour
    project-actions.tsx         Safe HTML blob download and copy buttons
    share-toggle.tsx            Public/private sharing with copyable links
    theme-provider.tsx          Persisted, accessible light/dark themes
  lib/
    rate-limit.ts              Supabase-backed / in-memory rate limiter
    sandbox.ts                  CSP-injected preview document helper
    supabase/                   SSR browser/server clients and config
proxy.ts                        Next.js 16 Supabase session refresh
supabase/migrations/            PostgreSQL schema and RLS policies
```

## 🤝 Contributing

This project is open-source and Hacktoberfest-friendly! PRs and issues are welcome.

## 🏆 Credits

Developed with ❤️ by **Felix & Nonydev**.
Created for **Hacktoberfest Hack Day Kumasi x Wikitech Student Community 2026**.

## 📄 License

MIT. See [`LICENSE`](LICENSE).
