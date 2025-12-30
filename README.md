# Smart Media Logger

A personal media consumption tracker. Part of the UnitedTribes ecosystem.

**Current Version:** v1.5.0-alpha (Development)

## Current State

This is an early development build with significant limitations. The app aims to be an AI-powered media logger but currently lacks most AI features. v1.5.0 adds a soundtrack player but introduces new issues while not fixing existing ones.

---

## What Works

### Core Features
- Two-pane layout (logging on left, library/recs/queue on right)
- Basic movie search (using mock TMDB data)
- Question-by-question logging flow
- Voice input via Web Speech API
- Rating slider (1-100 scale)
- Lo-fi MediaCard display with poster, critic scores, trailers

### New in v1.5.0-alpha
- **Soundtrack modal** - 70/30 split layout with video player and track list
- **YouTube playlist integration** - Fetches movie soundtracks from YouTube
- **Heart/save songs** - Save individual tracks to My Stuff
- **Toggleable hearts** - Can unsave songs (was broken initially)
- **Embedded YouTube players** - Music items play directly in My Stuff
- **Collapsible info sections** - Two-level expansion for music items
- **Remove items** - Can delete logged items from My Stuff

---

## Known Issues - CRITICAL

### Metadata Flow Problems
- **Metadata disappears between states** - Data entered in one step doesn't carry through to the final logged item
- **Props don't flow correctly** - Complex prop drilling between page.tsx and RightPaneTabs causes data loss
- **State resets unexpectedly** - Completing a log sometimes loses user-entered data

### Entity Recognition Failure
- **Fails to recognize most names** - Actors, directors, musicians are rarely highlighted correctly
- **Fuzzy matching is weak** - Even with fuzzy matching, recognition rate is very low
- **No real NER** - Uses keyword matching, not proper named entity recognition

### Date Handling Bugs
- **Wrong year displays** - Dates sometimes show incorrect year
- **Day parsing issues** - Specific days can be wrong
- **Inconsistent formats** - Different parts of app expect different date formats

### Data Persistence
- **All data lost on refresh** - Nothing persists to database
- **Prisma schema exists but unused** - Database is set up but not connected
- **localStorage partially implemented** - Some data saves, most doesn't

### AI Integration Missing
- **No Claude API** - Despite being "Smart Media Logger", there's no AI
- **Hardcoded questions** - Questions are static, not generated intelligently
- **No discovery moments** - Feature promised but not implemented
- **No personalized recommendations** - Recs tab is placeholder

---

## Known Issues - v1.5.0-alpha Specific

### Music/Soundtrack Problems
- **Wrong year on saved songs** - Music saves with current year, not release year
- **MediaCard shows "Album #0"** - Incorrect display for music items
- **No proper music data model** - Uses "director" field for artist (hack)
- **Artist parsing unreliable** - YouTube title parsing is hit or miss
- **Wrong playlist sometimes** - Search can return incorrect soundtrack

### Structural Issues
- **savedMusicTracks separate from loggedItems** - Two separate state systems
- **No unified media type handling** - Music bolted on as afterthought
- **Soundtrack button hard to find** - Small, easy to miss on cards

---

## Known Issues - Moderate

### Voice Input
- **Words get dropped** - Web Speech API loses words silently
- **Fails without warning** - Sometimes just stops working
- **No fallback** - If speech fails, user must type

### UI/UX
- **Duplicate entries** - Completing logs sometimes creates duplicates
- **Hover states were too subtle** - Fixed but may need more work
- **Tab state not preserved** - Switching tabs can lose context

---

## Tech Stack

- **Framework:** Next.js 14 + TypeScript
- **Styling:** Tailwind CSS with custom lo-fi design tokens
- **Database:** SQLite + Prisma (schema exists, not actively used)
- **Voice:** Web Speech API (browser-native, buggy)
- **AI:** Claude API (planned, not integrated)
- **Movies:** TMDB API (mock data only), OMDB API (real, for critic scores)
- **Music:** YouTube Data API v3 (real, for soundtracks)

---

## Setup

```bash
# Navigate to project
cd /Users/j.d.heilprin/smart-media-logger

# Install dependencies
npm install

# Initialize database (optional - not actively used yet)
npx prisma generate && npx prisma db push

# Start development server
npm run dev
```

Open [http://localhost:3006](http://localhost:3006)

---

## Version History

See [Version Control Page](http://localhost:3006/smart-media-logger-versions.html) for detailed changelog and roadmap.

### v1.5.0-alpha (December 29, 2024 - Evening)
- Soundtrack modal with 70/30 split layout
- YouTube playlist API integration
- Heart/save/unsave songs to My Stuff
- Embedded YouTube players for music
- Collapsible info sections
- Remove logged items functionality
- Improved hover effects
- **Does NOT fix:** metadata flow, entity recognition, dates, persistence, AI

### v0.1.0-alpha (December 28-29, 2024)
- Initial build with basic logging flow
- Voice input with pause/resume
- Entity recognition attempt (poor results)
- My Stuff library with data flow issues

---

## Roadmap

### v2.0.0 (Planned) - "Actually Smart"
- Integrate Claude API for real
- Fix metadata flow problems
- Add database persistence
- Improve entity extraction
- Fix date handling

### v2.5.0 (Planned) - Multi-Media
- Books (Google Books API)
- Music (Spotify API)
- TV Shows
- Podcasts

### v3.0.0 (Planned) - Discovery
- Full library browser
- Queue system
- UnitedTribes ecosystem export
- Cross-media recommendations

---

## Honest Assessment

This app is currently **"dumb"** when it should be **"smart."**

The v1.5.0 update adds a nice soundtrack feature but papers over fundamental problems:
- Metadata doesn't flow correctly through the app
- Entity recognition barely works
- Nothing persists to database
- There's no actual AI despite the name

The core architecture needs work before adding more features.

---

## Part of UnitedTribes Ecosystem

- **UnitedTribes Fresh** (Port 3004) - Books POC with HarperCollins catalog
- **YouTube Analysis** (Port 3002) - 194+ analyzed videos with entity graphs
- **Smart Media Logger** (Port 3006) - This app

---

## License

Private project.
