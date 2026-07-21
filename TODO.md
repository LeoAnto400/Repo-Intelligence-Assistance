# Known Gaps / Fixes

Punch list from a frontend + backend audit on 2026-07-21. Nothing here has been implemented yet.

## Backend

- [x] Add `requirements.txt` / `pyproject.toml` (+ lockfile) — no dependency manifest exists at the repo root, so the backend isn't reproducibly installable.
- [ ] Add a DELETE endpoint for repositories (e.g. `DELETE /repositories/{repository}`) — no way to remove an ingested repo/collection from Chroma once added.
- [ ] Add auth/authz — currently any client can trigger ingestion or query any repository, no access control.
- [ ] Stream `/query` responses (SSE or websocket) instead of a single blocking JSON response — frontend already has a `TypingIndicator` component implying streaming was intended but backend doesn't support it.
- [ ] Add rate-limiting on ingestion/query endpoints — `MAX_TOKENS_PER_BATCH` config exists for Gemini calls but there's no request-level throttling.
- [ ] Clean up `.temp_clones/` stale directories left over from prior ingestion runs (repo hygiene, not code, but worth automating cleanup on failure/completion).

## Frontend

- [ ] Add a test setup (Vitest/Jest + React Testing Library, or Playwright for e2e) — there are currently zero frontend test files, while the backend has a full `tests/` suite.
- [ ] Add `app/error.tsx` and `app/not-found.tsx` — no custom error boundary or 404 page, falls back to Next.js defaults.
- [ ] Add `app/loading.tsx` / suspense fallbacks for route transitions (currently only the home page has a custom ingestion-progress UI).
- [ ] Extract ingestion UI out of `app/page.tsx` into `features/ingestion/components/` — the feature has `services/` and `store/` but no `components/`, unlike every other feature module (chat, commits, repo-metadata).
- [ ] Add a repo management view (delete / re-ingest) to pair with the backend DELETE endpoint above.
- [x] Add `.env.example` for both `frontend/` and `backend/` — no template for required env vars, makes onboarding guesswork.
- [ ] Confirm whether CI (`.github/workflows`) exists; if not, add lint/test/build checks on PRs.

## Cross-cutting

- [ ] Reconcile chat UI (built for streaming) with backend `/query` (blocking) — decide whether to implement SSE/websocket streaming end-to-end or drop the `TypingIndicator` streaming affordance.
