# Napkin AI

**From napkin to real.** Napkin AI turns a hand-drawn UI sketch into a responsive HTML starting point you can edit, preview, save, and share. Built by Felix & Nonydev; open source under the MIT License.

## Run it locally

Use Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Add the API keys below to `.env.local`; without them, the landing page and workspace remain available, while generation and cloud accounts explain which service needs configuration.

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`GEMINI_API_KEY` is used only by the server-side generation route. `GEMINI_MODEL` is optional and defaults to `gemini-2.5-flash`, a hosted, image-capable Gemini API model. Google documents Gemma 4 as open-weight models deployed on local devices or your own servers; it is not the same as selecting a hosted Gemini API model. To run Gemma 4, host a compatible inference endpoint and add that provider as a backend instead of setting `GEMINI_MODEL` to a model the Gemini API does not serve. The Supabase anon/publishable key is intended for browser use; never put a service-role key in a `NEXT_PUBLIC_` variable.

## Supabase setup (free tier)

1. Create a Supabase project on the Free plan and copy its Project URL and anon/publishable key into `.env.local`.
2. In **SQL Editor**, run [`supabase/migrations/20261024000000_projects.sql`](supabase/migrations/20261024000000_projects.sql). It creates the projects table and owner-scoped Row Level Security policies; public reads are allowed only for projects the owner explicitly shares.
3. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URL allow list.
4. For GitHub login, enable the GitHub provider in **Authentication → Providers** and configure its OAuth app with the callback URL shown by Supabase. Add your production callback URL when deploying.
5. Email/password signup uses Supabase Auth’s configured confirmation behavior. Set its email templates and SMTP provider in Supabase if you need custom delivery; the app does not require a paid Supabase feature.

The app uses Supabase SSR browser/server clients, cookie-based sessions, a Next.js 16 `proxy.ts` session refresh, and a server-side OAuth callback. Database reads and writes use the signed-in user's session and RLS; no service-role key or Supabase Storage is used. Generated sketches are sent to the generation endpoint but are not uploaded to Supabase Storage.

## Gemini setup

Create an API key in [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY`. The server validates image type, size, canvas dimensions, and prompt length before sending a sketch to Gemini. The default model is configurable with `GEMINI_MODEL`.

Generation returns a standalone HTML document. The live preview runs in a sandboxed iframe with an opaque origin and a restrictive Content Security Policy; the editor never evaluates generated code in the main app.

## What’s here

```text
src/
  app/
    api/generate/route.ts       Gemini image-to-HTML endpoint
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

Generated projects are saved to the signed-in user's project history. Sharing creates a public read-only URL; toggling it off is not currently exposed in the UI, so treat shared links as public. Code and asset exports require sign-in. The one-time onboarding tour can be replayed from **Take the quick tour** in the workspace. The theme switch in the header is keyboard accessible and persists across the landing page, workspace, projects, and shared previews.

## License

MIT. See [`LICENSE`](LICENSE).
