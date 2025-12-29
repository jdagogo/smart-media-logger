# Smart Media Logger

A personal media consumption tracker. Part of the UnitedTribes ecosystem.

**Current Version:** v0.1.0-alpha (Unstable)

## Current State

This is an early development build with significant limitations. The app aims to be an AI-powered media logger but currently lacks most AI features.

### What Works (Mostly)
- Two-pane layout (logging on left, library/recs/queue on right)
- Basic movie search (using mock data, not real TMDB)
- Question-by-question logging flow
- Voice input via Web Speech API
- Rating slider (1-100 scale)
- Lo-fi MediaCard display

### What's Broken or Missing
- **Entity recognition is weak** - Attempts to identify actors, directors, musicians in notes but fails often
- **Dates display incorrectly** - Known parsing issues cause wrong dates to appear
- **Duplicate entries** - Logging sometimes creates duplicate items in library
- **No data persistence** - Everything is lost on page refresh
- **No Claude API integration** - Despite the "Smart" name, there's no AI yet
- **Voice input drops words** - Web Speech API is inconsistent

### Honest Assessment

The app is currently "dumb" when it should be "smart." The core logging flow works, but the intelligent features (smart questions, discovery moments, entity extraction, personalized recommendations) are not implemented.

## Tech Stack

- **Framework:** Next.js 14 + TypeScript
- **Styling:** Tailwind CSS with custom lo-fi design tokens
- **Database:** SQLite + Prisma (schema exists, not actively used)
- **Voice:** Web Speech API (browser-native, buggy)
- **AI:** Claude API (planned, not integrated)
- **Movies:** TMDB API (mock data only)

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

## Version History

See [version-control.html](version-control.html) for detailed changelog and roadmap.

### v0.1.0-alpha (December 28-29, 2024)
- Initial build with basic logging flow
- Voice input with pause/resume
- Entity recognition attempt (poor results)
- My Stuff library with data flow issues

## Known Issues

1. Entity recognition fails on most names
2. Dates parse incorrectly (sometimes wrong year)
3. Duplicate entries appear in My Stuff
4. State management is fragile (prop drilling)
5. No data persists across sessions

## Roadmap

### v0.2.0 (Planned)
- Actually integrate Claude API
- Fix all critical bugs
- Add database persistence
- Improve entity extraction

### v0.3.0 (Planned)
- Multi-media support (books, music, TV, podcasts)
- Real TMDB/Spotify/Google Books integration

### v0.4.0 (Planned)
- Full library browser
- Queue system
- UnitedTribes ecosystem export

## Part of UnitedTribes Ecosystem

- **UnitedTribes Fresh** (Port 3004) - Books POC with HarperCollins catalog
- **YouTube Analysis** (Port 3002) - 194+ analyzed videos with entity graphs
- **Smart Media Logger** (Port 3006) - This app

## License

Private project.
