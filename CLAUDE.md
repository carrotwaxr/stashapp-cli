# stashapp-cli

Interactive CLI for Stash library analytics and file management. Menu-driven TypeScript app built on `stashapp-api`.

## Build & Run

```bash
npm run build          # tsc compile
npm run start          # node dist/index.js
npm run dev            # build + start
```

Config lives in `config/secrets.json` (Stash URL + API key). Created on first run via interactive prompts.

## Architecture

- **Entry**: `src/index.ts` → loads config, inits `StashApp`, builds menu
- **Singleton**: `src/stash.ts` → `getStashInstance()` used by all controllers
- **Menu system**: `src/commands/menus/` → `buildMenu()` with nested Inquirer prompts
- **Controllers**: `src/controllers/` → each feature is a controller function
- **Utils**: `src/utils/` → shared helpers (rating formulas, formatting, filesystem, NFO generation)

## Key Files

| File | Purpose |
|---|---|
| `src/controllers/rateStashController.ts` | Auto-rating engine (1-100 scale) with mutation support |
| `src/controllers/analyzePerformers.ts` | Performer engagement stats by gender |
| `src/controllers/analyzeStudios.ts` | Studio ranking by engagement + cleanup candidates |
| `src/controllers/copyFiles.ts` | Copy scenes to destination with smart space-fill |
| `src/controllers/organizeLibrary.ts` | Rename/reorganize files by studio/performer/template |
| `src/controllers/cleanEmptyFolders.ts` | Recursive empty folder cleanup |
| `src/utils/rating.ts` | Rating formulas for performers/studios/tags/scenes |
| `src/utils/nfo.ts` | Emby/Jellyfin NFO XML generation |
| `src/utils/scenes.ts` | Scene filtering, deduplication, scoring |

## Dependencies

- `stashapp-api` — typed GraphQL client for Stash
- `@inquirer/prompts` — interactive CLI prompts
- `chalk` — colored terminal output
- `terminal-kit` — progress bars, advanced terminal rendering
- `fast-xml-parser` — NFO XML generation

## Conventions

- All stashapp-api calls go through `getStashInstance()` singleton
- `per_page: -1` fetches all results (no pagination)
- Rating scale is 0-100 (`rating100` field)
- O-counter (orgasm tracking) is the primary engagement metric
- Controllers handle both UI interaction and business logic
