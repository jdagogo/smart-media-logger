# Smart Media Logger

A personal media consumption tracker. Part of the UnitedTribes ecosystem.

**Current Version:** [v1.9.4-alpha](https://github.com/jdagogo/smart-media-logger/commit/938eb6d) (Development)
**Date:** February 10, 2026

---

## Quick Links for Next Session

If you're continuing development after a session break, read these files to understand the current state:

1. **This README** - Overview of features, issues, and architecture
2. **`/src/app/page.tsx`** - Main application logic (~3000 lines). Contains all state management, logging flow
3. **`/src/components/right-pane/RightPaneTabs.tsx`** - Right pane with My Stuff, Queue, Logging tabs. Contains music player with auto-advance
4. **`/src/components/right-pane/MediaCard.tsx`** - Media display component with Soundtrack button
5. **`/src/components/right-pane/SoundtrackModal.tsx`** - Soundtrack modal for movie soundtracks

---

## Session Summary (v1.7.0) - December 30, 2024

This session focused on **music player improvements** and **type error cleanup**. The music auto-advance feature now works, but there are unresolved TypeScript build errors.

### What Was Built

1. **Music auto-advance** - When a song ends, the next track plays automatically (YouTube IFrame API)
2. **Inline music player** - Click a song in My Stuff, it expands with embedded player + prev/next controls
3. **Duplicate track prevention** - Music tracks can't be saved twice
4. **Blue accent buttons** - Changed from pink to accent-blue for navigation

### What Works

- App runs fine on dev server (localhost:3006)
- Music player auto-advances correctly
- All v1.6.0 features still work (drafts, metadata preservation, etc.)

### Known Issues - CRITICAL

#### TypeScript Build Errors (Not Blocking Runtime)

The production build (`npm run build`) fails with type errors. These do NOT affect the dev server or runtime behavior, but they need to be fixed before deploying to production.

**Root cause:** Type mismatches between:
- `MetacriticData` interface (has many required fields)
- Inline type definitions (simpler, missing fields)
- `QueueItem` and `LoggedItem` interfaces don't align with `LogData`

**Workarounds applied:**
- Several `as any` casts added to bypass type checking
- `urlMetadata` state changed to `any` type
- These are band-aids, not proper fixes

#### Other Ongoing Issues

1. **Entity recognition weak** - Fuzzy matching doesn't reliably identify actors/directors
2. **No Claude API integration** - Despite "Smart" in name, no AI yet
3. **page.tsx is massive** - ~3000 lines, needs refactoring
4. **Prisma unused** - Database schema exists but data only in localStorage
5. **Mobile not optimized** - Layout assumes desktop width

---

## Architecture Notes

### Music Player (v1.7.0)

The music player in `RightPaneTabs.tsx` uses:

```typescript
// MusicYouTubePlayer component uses YouTube IFrame API
// Detects video end (state 0) and calls onVideoEnd callback
function MusicYouTubePlayer({ videoId, title, ytApiReady, onVideoEnd }) {
  // Creates YT.Player, listens for onStateChange
  // When event.data === 0 (ended), calls onVideoEnd()
}
```

**Key state:**
- `expandedLibraryId` - Which song is currently expanded/playing
- `ytApiReady` - Whether YouTube IFrame API has loaded
- `savedMusicTracks` - Record<string, boolean> for tracking saved songs

### Type System Issues

The codebase has evolved with multiple type definitions that don't align:

1. **`MetacriticData`** (page.tsx) - Full interface with required fields
2. **Inline types** (QueueItem, urlMetadata state) - Simpler versions
3. **`LoggedItem`** (RightPaneTabs.tsx) - Extends QueueItem

When passing data between components, TypeScript complains about missing fields. Current fix is `as any` casts, but proper fix would be to:
- Define shared types in a separate file
- Make fields optional where appropriate
- Use type guards instead of casts

---

## File Reference

| File | Purpose | Lines | Key Functions |
|------|---------|-------|---------------|
| `src/app/page.tsx` | Main app, all state | ~3000 | `handleResumeDraft`, `saveAndExit`, `updateLogData` |
| `src/components/right-pane/RightPaneTabs.tsx` | Right pane tabs | ~2500 | `MusicYouTubePlayer`, music auto-advance |
| `src/components/right-pane/MediaCard.tsx` | Media display | ~800 | Soundtrack button, trailer |
| `src/components/right-pane/SoundtrackModal.tsx` | Soundtrack player | ~500 | YouTube playlist integration |

---

## Development Setup

```bash
cd /Users/j.d.heilprin/smart-media-logger

# Install dependencies
npm install

# Start development server (works despite type errors)
npm run dev
```

Open [http://localhost:3006](http://localhost:3006)

**Note:** `npm run build` will fail due to type errors. The dev server works fine.

---

## Version History

### v1.7.0-alpha (December 30, 2024)
- Music player auto-advance (YouTube IFrame API)
- Inline music player with prev/next controls
- Duplicate music track prevention
- Blue accent buttons (replaced pink)
- **ISSUE:** TypeScript build errors (runtime works fine)
- **ISSUE:** Many `as any` casts added as workarounds

### v1.6.0-alpha (December 30, 2024)
- Full metadata preservation through logging flow
- Save & Exit functionality for drafts
- Draft management (resume/delete) in My Stuff
- CharacterGallery component for cast/scene notes
- Soundtrack button on MediaCard with tooltip
- YouTube trailer pause when opening soundtrack

### v1.5.0-alpha (December 29, 2024)
- Soundtrack modal with 70/30 split layout
- YouTube playlist API integration
- Heart/save/unsave songs to My Stuff

### v0.1.0-alpha (December 28-29, 2024)
- Initial build with basic logging flow

---

## Branches

- `main` - Last stable release
- `v1.6` - Previous version
- `music-player-working` - v1.7.0 checkpoint (this release)

To restore this version:
```bash
git checkout music-player-working
```

---

## API Keys Required

Create `.env.local` with:
```
TMDB_API_KEY=your_tmdb_key
OMDB_API_KEY=your_omdb_key
YOUTUBE_API_KEY=your_youtube_key
```

---

## Part of UnitedTribes Ecosystem

- **UnitedTribes Fresh** (Port 3004) - Books POC with HarperCollins catalog
- **YouTube Analysis** (Port 3002) - 194+ analyzed videos with entity graphs
- **Smart Media Logger** (Port 3006) - This app

---

## License

Private project.
