# Repository Guidelines

## Project Structure & Module Organization
- Next.js App Router lives in `src/app`; key routes include `ranking`, `partidas`, `registrar-jogo`, `noticias`, `perfil`, `login`, and `admin`.
- Shared UI and layout primitives sit in `src/components` (e.g., `app-shell.tsx`, `providers.tsx`, `ui/` for inputs/buttons).
- Data/state utilities are under `src/lib` (Supabase queries, match/auth stores, query client) and `src/utils/supabase` (client/server helpers, middleware).
- Static assets stay in `public`; global styles in `src/app/globals.css`.

## Build, Test, and Development Commands
- `npm run dev`: start the local Next.js dev server on port 3000.
- `npm run build`: production build (use before deploys or PRs touching build config).
- `npm start`: serve the production build locally.
- `npm run lint`: run ESLint (Next.js config) to catch style and import issues.

## Coding Style & Naming Conventions
- TypeScript first; default to server components and mark client files with `\"use client\"` only when needed.
- Indentation is 2 spaces; favor named exports and small, focused components/hooks.
- Tailwind CSS v4 with utility-first styling; keep class lists ordered by layout → spacing → color/state.
- Respect existing enums/status names from Supabase (`match_status`, `resultado_tipo`, etc.) and keep DTO shapes consistent with `src/lib/queries`.

## Testing Guidelines
- No automated tests are set up yet; when adding them, co-locate feature tests as `*.test.ts(x)` and prefer Vitest + React Testing Library for components and hooks.
- For manual verification: run `npm run dev`, log in, and exercise flows for ranking, partidas (create/confirm/edited states), registrar-jogo wizard, notícias feed, and perfil updates.
- Block merges on failing lint or broken core flows above.

## Commit & Pull Request Guidelines
- Recent history uses emoji prefixes plus short descriptions (e.g., `✨ Implement feature...`). Keep messages imperative and under ~72 chars.
- For PRs: include a concise summary, linked issue/task, screenshots or clips for UI changes, and a checklist of tested flows/commands. Note any schema or env variable changes explicitly.

## Security & Configuration Tips
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) in `.env.local`; never commit secrets.
- Enforce RLS expectations in Supabase when adding tables; mirror enum names/types in TypeScript to avoid drift.
- Before deploys, run `npm run build` and sanity-check Supabase tables used by new queries.
