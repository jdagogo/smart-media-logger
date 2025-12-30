# Smart Media Logger

A personal media consumption tracker. Part of the UnitedTribes ecosystem.

**Current Version:** v1.6.0-alpha (Development)
**Date:** December 30, 2024

---

## Quick Links for Next Session

If you're continuing development after a session break, read these files to understand the current state:

1. **This README** - Overview of features, issues, and architecture
2. **`/src/app/page.tsx`** - Main application logic (~2700 lines). Contains all state management, logging flow, and the `handleResumeDraft` function
3. **`/src/components/right-pane/RightPaneTabs.tsx`** - Right pane with My Stuff, Queue, Logging tabs. Contains `LoggedItem` interface and draft banner logic
4. **`/src/components/right-pane/MediaCard.tsx`** - Media display component with Soundtrack button
5. **`/src/components/CharacterGallery.tsx`** - Cast/scene image gallery with note-taking
6. **`/src/components/left-pane/QuestionCard.tsx`** - Question wrapper with Save & Exit button

---

## Session Summary (v1.6.0) - December 30, 2024

This session focused on **metadata preservation** and **draft functionality**. The core problem was that metadata kept getting lost at various points in the app flow.

### What Was Built

1. **Full metadata preview in Log mode** - Right pane now shows complete metadata (cast, awards, video) just like Queue mode
2. **CharacterGallery component** - Displays cast photos and scene images from TMDB, allows users to add notes about specific actors/scenes
3. **Save & Exit functionality** - Users can save incomplete logs as drafts and resume later
4. **Draft management in My Stuff** - Drafts show a prominent amber banner, have Resume and Delete buttons
5. **Soundtrack button on MediaCard** - Added next to title with hover tooltip "Rate the music!"
6. **YouTube iframe pause on soundtrack open** - Trailers stop when opening soundtrack modal

### Key Problems Encountered and Solutions

#### Problem 1: Metadata lost when clicking "Confirm & Log This"
- **Symptom:** User would complete logging flow, but the final logged item was missing cast, video, awards, and other metadata
- **Root cause:** The `updateLogData()` call in the "Confirm & Log This" handler wasn't passing all the metadata fields
- **Fix:** Added ALL metadata fields to the updateLogData call (~30 fields including cast, directors, writers, producers, genres, tmdbRating, awards, boxOffice, videoId, poster, etc.)
- **Location:** `page.tsx` around line 2490

#### Problem 2: Metadata lost when using Save & Exit
- **Symptom:** User saves draft, finds it in My Stuff, but all metadata is gone
- **Root cause:** The `saveAndExit()` function was only saving basic fields (title, year, mediaType)
- **Fix:** Completely rewrote `saveAndExit()` to save ALL metadata fields
- **Location:** `page.tsx` around line 785

#### Problem 3: LogData interface missing fields
- **Symptom:** TypeScript errors when trying to save metadata
- **Root cause:** The `LogData` interface didn't have fields for cast, video, awards, etc.
- **Fix:** Expanded LogData interface to include ~30+ fields
- **Location:** `page.tsx` around line 150

#### Problem 4: Trailer kept playing when opening Soundtrack
- **Symptom:** User clicks Soundtrack button, modal opens, but trailer audio continues
- **Attempts that failed:**
  1. `setShowTrailer(false)` - Didn't work because iframe kept playing
  2. `setTimeout` delay - Didn't help
- **Fix:** Used YouTube iframe API postMessage to pause video: `iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*')` AND added `enablejsapi=1` to YouTube iframe URLs
- **Location:** `MediaCard.tsx` Soundtrack button onClick handler

#### Problem 5: No feedback when saving draft
- **Symptom:** User clicks Save & Exit, nothing happens visually
- **Fix:** Added `alert()` message telling user where the item was saved ("Saved to My Stuff as draft")
- **Location:** `page.tsx` saveAndExit function

#### Problem 6: Drafts not distinguishable in My Stuff
- **Symptom:** Saved drafts look the same as completed logs
- **Fix:**
  1. Added `isDraft` boolean to LoggedItem interface
  2. Added prominent amber/orange gradient banner with "Draft - Incomplete" label
  3. Added "Resume Logging" and "Delete" buttons for drafts
- **Location:** `RightPaneTabs.tsx` around line 2150

#### Problem 7: No way to resume drafts
- **Symptom:** User finds draft but can't continue logging
- **Fix:**
  1. Created `handleResumeDraft()` function that loads all draft data back into state
  2. Removes draft from loggedItems (to avoid duplicates)
  3. Sets step to 'date' to restart logging flow
  4. Switches to 'logging' tab
- **Location:** `page.tsx` around line 714

#### Problem 8: Soundtrack button tooltip hidden
- **Symptom:** Tooltip appeared below button where it was cut off
- **Fix:** Changed positioning from `-bottom-8` to `-top-9` so tooltip appears above
- **Location:** `MediaCard.tsx`

#### Problem 9: Duplicate "Starring" and "Cast" sections
- **Symptom:** MediaCard showed both sections redundantly
- **Fix:** Removed "Starring" section, kept only "Cast"
- **Location:** `MediaCard.tsx`

---

## Current Architecture

### State Management

All state is managed in `page.tsx` using React useState hooks:

```typescript
// Core logging state
const [logData, setLogData] = useState<LogData>({...})  // Current item being logged
const [step, setStep] = useState('search')  // Current step in logging flow

// Library state
const [loggedItems, setLoggedItems] = useState<LoggedItem[]>([])  // My Stuff
const [upNextQueue, setUpNextQueue] = useState<QueueItem[]>([])   // Queue

// UI state
const [rightPaneTab, setRightPaneTab] = useState<'logging' | 'upnext' | 'library' | 'recs' | 'profile'>('logging')
const [searchMode, setSearchMode] = useState<'log' | 'queue'>('log')
```

### Key Interfaces

**LogData** (page.tsx ~line 150) - The current item being logged:
```typescript
interface LogData {
  mediaType: string
  title: string
  year?: number
  tmdbId?: number
  director?: string
  directors?: string[]
  cinematographer?: string
  composer?: string
  writers?: string[]
  producers?: Array<{ name: string; job: string }>
  editor?: string
  starring?: string[]
  cast?: Array<{ name: string; character: string; profilePath?: string }>
  genres?: string[]
  plot?: string
  tmdbRating?: number
  mpaRating?: string
  runtime?: number
  awards?: string
  boxOffice?: string
  videoId?: string
  poster?: string
  // ... logging-specific fields
  consumptionDate?: Date
  location?: string
  companions?: string[]
  overallRating?: number
  notes?: string
  // ... etc
}
```

**LoggedItem** (RightPaneTabs.tsx ~line 240) - Saved items in My Stuff:
```typescript
export interface LoggedItem extends QueueItem {
  rating?: number
  dateConsumed?: string
  notes?: string
  companionNames?: string
  socialContext?: string
  location?: string
  locationDetail?: string
  firstTime?: boolean
  isDraft?: boolean  // True if saved via Save & Exit before completing flow
}
```

### Component Hierarchy

```
page.tsx (main application)
├── Left Pane
│   ├── Search/URL input
│   ├── QuestionCard (wrapper for all questions)
│   │   ├── Date question
│   │   ├── Location question
│   │   ├── Companions question
│   │   ├── First time question
│   │   ├── Rating question
│   │   └── Notes/review question
│   └── CharacterGallery (cast/scene images)
│
└── Right Pane (RightPaneTabs)
    ├── Logging tab (shows current item preview)
    ├── Up Next tab (queue)
    ├── My Stuff tab (logged items + drafts)
    ├── Recs tab (recommendations - placeholder)
    └── Profile tab
```

### Data Flow

1. User searches for movie → TMDB API returns metadata
2. Metadata stored in `logData` state
3. User goes through question flow, answers stored in `logData`
4. User clicks "Confirm & Log This" → `logData` converted to `LoggedItem` and added to `loggedItems`
5. `loggedItems` persisted to localStorage

**Critical:** At step 4, ALL fields must be explicitly copied. This was the source of most metadata loss bugs.

---

## File Reference

| File | Purpose | Lines | Key Functions |
|------|---------|-------|---------------|
| `src/app/page.tsx` | Main app, all state | ~2700 | `handleResumeDraft`, `saveAndExit`, `updateLogData` |
| `src/components/right-pane/RightPaneTabs.tsx` | Right pane tabs | ~2400 | Draft banner, Resume button |
| `src/components/right-pane/MediaCard.tsx` | Media display | ~800 | Soundtrack button, trailer |
| `src/components/CharacterGallery.tsx` | Cast gallery | ~450 | Image grid, note modal |
| `src/components/left-pane/QuestionCard.tsx` | Question wrapper | ~180 | Save & Exit button |
| `src/components/right-pane/SoundtrackModal.tsx` | Soundtrack player | ~400 | YouTube playlist integration |
| `src/app/api/movie-images/route.ts` | Cast/scene API | ~100 | TMDB images |
| `src/app/api/youtube-playlist/route.ts` | Soundtrack API | ~150 | YouTube playlist search |

---

## What Works Now

### Core Features
- Two-pane layout (logging on left, library/recs/queue on right)
- Movie search via TMDB API (real API, not mock)
- Complete question-by-question logging flow
- Voice input via Web Speech API
- Rating slider (1-100 scale)
- Full metadata display (cast, crew, awards, ratings, trailer)
- Soundtrack modal with YouTube playlist integration
- Save songs to My Stuff
- CharacterGallery for cast/scene notes

### v1.6.0 Additions
- **Full metadata preservation** - Metadata now carries through entire flow
- **Save & Exit** - Save incomplete logs as drafts
- **Draft management** - Resume or delete drafts from My Stuff
- **Draft visual indicator** - Prominent amber banner on drafts
- **Feedback on save** - Alert tells user where draft was saved
- **Soundtrack on MediaCard** - Button with tooltip next to title
- **Trailer pauses on soundtrack open** - Uses YouTube iframe API

### Data Persistence
- localStorage saves Queue, My Stuff, and drafts
- Survives page refresh
- No database persistence yet (Prisma schema exists but unused)

---

## Known Issues - Still Present

### From Previous Versions
1. **Entity recognition weak** - Fuzzy matching doesn't reliably identify actors/directors in notes
2. **No Claude API integration** - Despite "Smart" in name, no AI yet
3. **Date parsing inconsistent** - Some date edge cases still buggy
4. **Prisma unused** - Database schema exists but data only in localStorage

### New/Remaining in v1.6.0
1. **Large page.tsx file** - At ~2700 lines, needs refactoring into smaller modules
2. **Complex prop drilling** - Data flows through many layers, easy to miss fields
3. **No error boundaries** - API failures can crash the app
4. **Mobile not optimized** - Layout assumes desktop width

---

## API Keys Required

Create `.env.local` with:
```
TMDB_API_KEY=your_tmdb_key
OMDB_API_KEY=your_omdb_key
YOUTUBE_API_KEY=your_youtube_key
```

---

## Development Setup

```bash
cd /Users/j.d.heilprin/smart-media-logger

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3006](http://localhost:3006)

---

## Version History

### v1.6.0-alpha (December 30, 2024)
- Full metadata preservation through logging flow
- Save & Exit functionality for drafts
- Draft management (resume/delete) in My Stuff
- CharacterGallery component for cast/scene notes
- Soundtrack button on MediaCard with tooltip
- YouTube trailer pause when opening soundtrack
- Comprehensive metadata in right pane for Log mode
- **Fixed:** Metadata loss on "Confirm & Log This"
- **Fixed:** Metadata loss on Save & Exit
- **Fixed:** No draft indication in My Stuff
- **Fixed:** No way to resume drafts
- **Fixed:** Trailer playing during soundtrack

### v1.5.0-alpha (December 29, 2024)
- Soundtrack modal with 70/30 split layout
- YouTube playlist API integration
- Heart/save/unsave songs to My Stuff
- Embedded YouTube players for music
- Collapsible info sections
- Remove logged items functionality

### v0.1.0-alpha (December 28-29, 2024)
- Initial build with basic logging flow
- Voice input with pause/resume
- Entity recognition attempt
- My Stuff library

---

## For Next Session

### If continuing this work:

1. **Read this README first** - It documents all the issues we solved and how
2. **Check `page.tsx`** - Most logic is here, especially:
   - `handleResumeDraft()` ~line 714
   - `saveAndExit()` ~line 785
   - "Confirm & Log This" handler ~line 2490
   - `LogData` interface ~line 150
3. **Check `RightPaneTabs.tsx`** for:
   - `LoggedItem` interface ~line 240
   - Draft banner rendering ~line 2150
   - `onResumeDraft` prop usage
4. **Test the draft flow** - Save & Exit, then resume from My Stuff

### Known patterns that cause bugs:

1. **Adding new fields to LogData** - Must also add to:
   - `saveAndExit()` function
   - "Confirm & Log This" handler
   - `handleResumeDraft()` function
   - Possibly `LoggedItem` interface

2. **YouTube iframe control** - Must use postMessage API AND have `enablejsapi=1` on iframe

3. **Props to RightPaneTabs** - Component has many props, easy to forget passing new callbacks

---

## Part of UnitedTribes Ecosystem

- **UnitedTribes Fresh** (Port 3004) - Books POC with HarperCollins catalog
- **YouTube Analysis** (Port 3002) - 194+ analyzed videos with entity graphs
- **Smart Media Logger** (Port 3006) - This app

---

## License

Private project.
