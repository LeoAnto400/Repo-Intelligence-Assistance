# Known Gaps / Fixes

Punch list from a frontend + backend audit on 2026-07-21. Nothing here has been implemented yet.

## Backend

- [x] Add `requirements.txt` / `pyproject.toml` (+ lockfile) — no dependency manifest exists at the repo root, so the backend isn't reproducibly installable.
- [x] Add a DELETE endpoint for repositories (e.g. `DELETE /repositories/{repository}`) — no way to remove an ingested repo/collection from Chroma once added.
- [ ] Add auth/authz — currently any client can trigger ingestion or query any repository, no access control.
- [x] Stream `/query` responses (SSE or websocket) instead of a single blocking JSON response — frontend already has a `TypingIndicator` component implying streaming was intended but backend doesn't support it. Backend-only so far: `WS /api/v1/ws/query` streams `retrieval` → `token`(s) → `done`/`error` events. Frontend chat still calls the blocking `POST /query`; wiring the chat UI to the websocket is separate follow-up work.
- [x] Add rate-limiting on ingestion/query endpoints — `MAX_TOKENS_PER_BATCH` config exists for Gemini calls but there's no request-level throttling. Added an in-memory per-client-IP sliding-window limiter (`src/core/rate_limit.py`) applied to `POST /ingest`, `POST /query`, and `WS /ws/query` (5/min and 20/min respectively, configurable via `INGEST_RATE_LIMIT_PER_MINUTE` / `QUERY_RATE_LIMIT_PER_MINUTE`). Single-process only — would need a shared store (e.g. Redis) behind a multi-worker deployment.
- [x] Clean up `.temp_clones/` stale directories left over from prior ingestion runs (repo hygiene, not code, but worth automating cleanup on failure/completion). Removed the ~3.2MB of existing stale clones and added a FastAPI startup hook (`_clear_stale_temp_clones` in `src/api/main.py`) that wipes anything left in `.temp_clones/` on process start, since it can only be debris from a previous process killed mid-clone.

## Frontend

- [x] Add a test setup (Vitest/Jest + React Testing Library, or Playwright for e2e) — there are currently zero frontend test files, while the backend has a full `tests/` suite. Added Vitest + React Testing Library (`vitest.config.ts`, `npm test`), with 22 tests covering `lib/runtime-safety.ts`, `lib/utils.ts`, the `Button` component, and `useChatStore`.
- [x] Add `app/error.tsx` and `app/not-found.tsx` — no custom error boundary or 404 page, falls back to Next.js defaults. Added both, styled to match the existing dark dashboard theme; verified with `next build`.
- [x] Add `app/loading.tsx` / suspense fallbacks for route transitions (currently only the home page has a custom ingestion-progress UI). Added a global `app/loading.tsx` plus route-level ones for `/chat`, `/commits`, `/settings`.
- [x] Extract ingestion UI out of `app/page.tsx` into `features/ingestion/components/` — the feature has `services/` and `store/` but no `components/`, unlike every other feature module (chat, commits, repo-metadata). Added `IngestPanel.tsx`; `app/page.tsx` is now a thin composition of `RepositoryPicker` + `IngestPanel` + feature cards.
- [x] Add a repo management view (delete / re-ingest) to pair with the backend DELETE endpoint above. Added `/settings` (linked from the sidebar's existing "Settings" item) rendering `RepositoryManager`, which lists every ingested repo with Activate / Re-ingest / Delete actions. Re-ingest reuses `POST /ingest` (which already resets the target collection), so no new backend endpoint was needed for it.
- [x] Add `.env.example` for both `frontend/` and `backend/` — no template for required env vars, makes onboarding guesswork.
- [ ] Confirm whether CI (`.github/workflows`) exists; if not, add lint/test/build checks on PRs.

## Cross-cutting

- [ ] Reconcile chat UI (built for streaming) with backend `/query` (blocking) — decide whether to implement SSE/websocket streaming end-to-end or drop the `TypingIndicator` streaming affordance.
