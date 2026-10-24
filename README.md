# Napkin

**From napkin to real.** Napkin turns a hand-drawn UI sketch into a responsive HTML starting point you can edit, preview, save, and share. Built by Felix & Nonydev; open source under the MIT License.

## Run it locally

Use Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Install and start Ollama as described below for free, local AI generation. Supabase is optional and only needed for account-protected export, sharing, and saved project history.

```dotenv
# Option 1: Free local Ollama with Gemma 4 (default)
OLLAMA_BASE_URL=http://127.0.0.1:11434
GEMMA_MODEL=gemma4:e4b

# Option 2: Google Gemini API (hosted multimodal vision)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# Supabase (optional, for accounts, private saving & public shares)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=
```

### Free local AI with Gemma 4

1. Install [Ollama](https://ollama.com/download).
2. In a terminal, download and start Gemma 4 E4B: `ollama run gemma4:e4b`. The first run downloads the model; keep Ollama running while you use Napkin.
3. In a second terminal, start Napkin with `npm run dev`.

The app sends sketches to the local Ollama server at `http://127.0.0.1:11434` by default. No Gemini API key, hosted inference service, or per-request AI bill is required. Model inference uses your computer's memory, processor/GPU, disk space, and electricity. Gemma 4 E4B is the default; choose another Ollama Gemma 4 tag via `GEMMA_MODEL` if your hardware needs a smaller model. Set `OLLAMA_BASE_URL` only when Ollama runs at a different reachable address. Do not expose Ollama's unauthenticated API to the public internet.

For remote deployments, localhost refers to the deployed machine itself. You would need to run Ollama on that server (and provide enough compute); a hosted inference endpoint may have its own costs. Supabase anon/publishable keys are intended for browser use; never put a service-role key in a `NEXT_PUBLIC_` variable. `NEXT_PUBLIC_SITE_URL` is the deployed origin (for example `https://napkin.example.com`) and powers canonical URLs, the sitemap, robots.txt, and Open Graph tags; it is optional in development.

## Supabase setup (free tier)

1. Create a Supabase project on the Free plan and copy its Project URL and publishable key into `.env.local`.
2. In **SQL Editor**, run [`supabase/migrations/20261024000000_projects.sql`](supabase/migrations/20261024000000_projects.sql). It creates the projects table and owner-scoped Row Level Security policies; public reads are allowed only for projects the owner explicitly shares.
3. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URL allow list.
4. For GitHub login, enable the GitHub provider in **Authentication → Providers** and configure its OAuth app with the callback URL shown by Supabase. Add your production callback URL when deploying.
5. Email/password signup uses Supabase Auth’s configured confirmation behavior. Set its email templates and SMTP provider in Supabase if you need custom delivery; the app does not require a paid Supabase feature.

The app uses Supabase SSR browser/server clients, cookie-based sessions, a Next.js 16 `proxy.ts` session refresh, and a server-side OAuth callback. Database reads and writes use the signed-in user's session and RLS; no service-role key or Supabase Storage is used. Generated sketches are sent to the generation endpoint but are not uploaded to Supabase Storage.

If the account buttons are disabled, Supabase credentials are missing. In Supabase Dashboard, open **Project Settings → API** (or **API Keys**) and copy the **Project URL** and **publishable** key—not the `service_role` or secret key—to `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Restart `npm run dev` after saving `.env.local`. To test email signup, use an address you can access and check its inbox if email confirmation is enabled in Supabase Auth. GitHub signup additionally needs the GitHub provider configured in the Supabase steps above.

## Generation

The server validates image type, size, canvas dimensions, and prompt length before sending a sketch to the AI model. Generated sketches are not stored by Napkin.

- **Local Gemma (Default):** Runs through your local Ollama instance (`ollama run gemma4:e4b`). Zero API cost, private, and 100% offline-capable.
- **Google Gemini API:** Set `GEMINI_API_KEY` in `.env.local` to use hosted multimodal models (`gemini-2.5-flash` by default). Ideal for cloud deployments or systems without local inference hardware.

Generation returns a standalone HTML document. The live preview runs in a sandboxed iframe with an opaque origin and a restrictive Content Security Policy; the editor never evaluates generated code in the main app.

## What’s here

```text
src/
  app/
    api/generate/route.ts       Local Ollama/Gemma image-to-HTML endpoint
    api/projects/route.ts       Authenticated project history and saves
    auth/callback/route.ts      Supabase OAuth code exchange
    projects/[id]/page.tsx      Private saved project preview
    projects/page.tsx           Private project history
    share/[id]/page.tsx         Explicitly shared, sandboxed preview
    globals.css                 Dark, responsive design system
    layout.tsx                  App metadata and root layout
    page.tsx                    Landing page and generation workspace
  components/
    auth-modal.tsx              Email/password and GitHub sign-in
    brand.tsx                   Shared brand mark
    napkin-app.tsx              Landing, responsive workspace, tour
    theme-provider.tsx          Persisted, accessible light/dark themes
  lib/
    sandbox.ts                  CSP-injected preview document helper
    supabase/                   SSR browser/server clients and config
proxy.ts                        Refreshes Supabase sessions
supabase/migrations/            PostgreSQL schema and RLS policies
```

## Development

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

Generated projects are saved to the signed-in user's project history. Sharing creates a public read-only URL; you can toggle it back off with **Make private** on the project detail page. Code and asset exports require sign-in. The one-time onboarding tour can be replayed from **Take the quick tour** in the workspace. The theme switch in the header is keyboard accessible and persists across the landing page, workspace, projects, and shared previews.

## License

MIT. See [`LICENSE`](LICENSE).
