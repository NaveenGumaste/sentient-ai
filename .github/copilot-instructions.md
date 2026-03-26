# Project Guidelines

## Code Style
- Use modern JavaScript with ESM syntax (`import`/`export`) across `src/**`.
- Follow the existing file pattern: lightweight `src/index.js` orchestration, logic in `src/services/*`, config in `src/config/*`, and formatting helpers in `src/utils/*`.
- Keep logs concise and operational (status, skips, failures), matching the current bot logging style.

## Architecture
- `src/index.js` is the runtime orchestrator: Discord client setup, polling loop, per-category posting flow, and error handlers.
- `src/services/news.js` is responsible for RSS fetching, normalization, image extraction, filtering, and per-category article limits.
- `src/services/redis.js` handles deduplication state via Upstash Redis keys and expiry.
- `src/utils/embeds.js` builds Discord embeds only; keep presentation logic there.
- `src/config/feeds.js` is the single source for feed categories, URLs, fetch limits, and Redis constants.

## Build and Test
- Install dependencies: `npm install`
- Start bot: `npm start`
- Dev watch mode: `npm run dev`
- There is currently no test script in `package.json`; prefer focused module-level validation when adding behavior.

## Conventions
- Required environment variables come from `.env` (see `README.md` and `.env.example`): Discord token, Upstash credentials, and channel IDs.
- Channel routing convention: category-specific channel vars (`CHANNEL_AI`, `CHANNEL_LLM`, etc.) fall back to `CHANNEL_ALL`.
- Posting convention: only new articles with valid image URLs are posted.
- Deduplication convention: article IDs are derived from link/guid/title and persisted in Redis with expiry.
- Polling is an always-on interval loop (`POLL_INTERVAL_MS`), not cron-based scheduling.

## Documentation
- For setup, deployment, and environment configuration details, use `README.md` as the source of truth.