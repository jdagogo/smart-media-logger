# Smart Media Logger — Quick Start Guide

## What You're Getting

Three things:

1. **This guide** — step-by-step setup instructions
2. **FILM_DATA_BIBLE.md** — comprehensive documentation of every data source, API, pipeline, and field the app uses to populate a film page
3. **A sample data JSON file** — exported from a live instance with real logged films, queue items, saved music, and preferences. Import this to see the app fully populated instead of starting from scratch.

---

## The Repo

```
https://github.com/jdagogo/smart-media-logger
```

Current branch: `v1.9.5-unified-preview`

---

## Setup (5 minutes)

### 1. Clone the repo

```bash
git clone https://github.com/jdagogo/smart-media-logger.git
cd smart-media-logger
```

### 2. Install dependencies

Requires Node.js 18+ (tested on v22.18.0).

```bash
npm install
```

### 3. Set up API keys

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your keys. The app has hardcoded fallback keys for TMDB, OMDB, and YouTube, so **it will run without any configuration** — but you should eventually get your own keys to avoid hitting rate limits.

| Key | Service | Required? | Sign Up |
|-----|---------|-----------|---------|
| `TMDB_API_KEY` | The Movie Database (primary metadata) | Has fallback | https://www.themoviedb.org/settings/api |
| `OMDB_API_KEY` | Open Movie Database (scores, plot) | Has fallback | https://www.omdbapi.com/apikey.aspx |
| `YOUTUBE_API_KEY` | YouTube Data API v3 (trailers, playlists) | Has fallback | https://console.cloud.google.com/apis/credentials |
| `ANTHROPIC_API_KEY` | Claude API (entity extraction) | **Yes — no fallback** | https://console.anthropic.com/ |

Without the Anthropic key, everything works except the AI entity extraction feature. That's fine for exploring the app.

### 4. Start the dev server

```bash
npm run dev
```

Open **http://localhost:3006**

---

## Import the Sample Data

The app stores all user data (logged films, queue, preferences) in your browser's localStorage. Without importing data, you'll see an empty app.

To load the sample data:

1. Open the app at http://localhost:3006
2. In the top-right corner of the orange navbar, click **⚙ Data Manager**
3. Click **Import Data**
4. Select the sample JSON file you received
5. The page will reload with all the sample films, queue items, and saved music populated

---

## How to Use It

**Log a film:**
- Paste a YouTube trailer URL or IMDB/TMDB link into the search bar
- The app pulls metadata from 7+ sources (TMDB, OMDB, IMDB, Metacritic, Rotten Tomatoes, YouTube, Google Images)
- Walk through the logging flow: rate it, add notes, tag characters/scenes
- Save to your logged collection

**Browse logged films:**
- Click any film in "My Stuff" (right pane) to open the full detail modal
- Films with TMDB video clips get a hero carousel at the top
- Scores, cast, images, and videos are all pulled automatically

**Queue:**
- Add films to your "Up Next" queue for later

**Music:**
- Films have soundtrack integration via YouTube playlists
- Save individual tracks to your music library

---

## Key Files (For Integration)

| File | What It Does |
|------|-------------|
| `FILM_DATA_BIBLE.md` | Complete documentation of every data source and API |
| `src/app/page.tsx` | Main app logic, all state management (~3000 lines) |
| `src/app/api/` | All API route handlers (TMDB, OMDB, YouTube, scraping) |
| `src/components/right-pane/RightPaneTabs.tsx` | Right pane: My Stuff, Queue, Logging tabs |
| `src/components/right-pane/LoggedItemModal.tsx` | Film detail modal with hero carousel |
| `src/components/right-pane/MediaCard.tsx` | Film card display component |
| `src/components/DataManager.tsx` | Export/Import data feature |

---

## Notes

- **No database** — all data lives in browser localStorage. The export/import feature is how you move data between machines.
- **Build warnings** — `npm run build` has TypeScript errors. The dev server (`npm run dev`) works fine. This is a known issue tracked for cleanup.
- **Port 3006** — the app runs on port 3006 by default. If that's in use, change it in `package.json` scripts.
- **Scraping endpoints** — Metacritic, Rotten Tomatoes, and IMDB scores are fetched by scraping. These can be flaky if the sites change their HTML structure.
