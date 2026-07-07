# stashapp-cli

> ⚠️ **Deprecated and archived (2026-07).** I'm not developing this anymore. Everything it did now lives in a purpose-built tool - see the map below. This repo is read-only and kept for history.

An interactive, menu-driven CLI I built for analytics and file housekeeping on my [Stash](https://github.com/stashapp/stash) library, on top of [`stashapp-api`](https://github.com/carrotwaxr/stashapp-api). It grew out of [`stash-phoenix-utils`](https://github.com/carrotwaxr/stash-phoenix-utils) (also retired).

I've since split its jobs across a few tools I actually maintain, so keeping a second half-overlapping CLI around wasn't worth it.

## Where each feature went

| Old feature | Now handled by |
|---|---|
| `rateStashController` - auto-rating scenes / performers / studios | **[stash-curator](https://github.com/carrotwaxr/stash-curator)** `rate` - a faithful, contract-pinned mirror of Peek's Recommended scoring, fill-empty so it never overwrites a rating you set |
| `organizeLibrary` - rename / reorganize files | **mcMetadata** plugin in [stash-plugins](https://github.com/carrotwaxr/stash-plugins) - configurable renaming via the `moveFiles` mutation, triggered on `Scene.Update.Post` |
| `nfo` - Emby / Jellyfin NFO generation | **mcMetadata** plugin |
| `analyzePerformers` / `analyzeStudios` - engagement analytics | **[Peek](https://github.com/carrotwaxr/peek-stash-browser)** - Stats page |
| `copyFiles` - space-fill copy to a destination | **Peek** - Download page |
| `cleanEmptyFolders` - recursive empty-folder cleanup | not carried over yet - tracked in [stash-curator#10](https://github.com/carrotwaxr/stash-curator/issues/10) |

## Curating a Stash library now

Use **[stash-curator](https://github.com/carrotwaxr/stash-curator)**. It's the conversational curation CLI I maintain, with the same write ops behind a preview -> confirm -> apply gate.
