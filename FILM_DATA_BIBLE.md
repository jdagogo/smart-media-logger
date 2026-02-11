# Smart Media Logger — Film Data Bible

> **Version:** v1.9.4-alpha | **Last Updated:** February 11, 2026
>
> This document is the definitive reference for how Smart Media Logger pulls in, transforms, and displays film data. Every piece of information shown on a fully populated film page is documented here — what it is, where it comes from, and how it gets to the screen.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [External Data Sources](#external-data-sources)
3. [The Data Flow: URL Paste to Display](#the-data-flow-url-paste-to-display)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Component Data Map](#component-data-map)
6. [Complete Field Reference](#complete-field-reference)
7. [Data Interfaces](#data-interfaces)
8. [API Keys & Configuration](#api-keys--configuration)
9. [Client-Side Storage](#client-side-storage)
10. [Design Patterns & Fallback Chains](#design-patterns--fallback-chains)
11. [Portability & Deployment](#portability--deployment)

---

## Architecture Overview

The app uses a **multi-source data aggregation** strategy with layered fallbacks. No single API provides everything — film data is assembled from 7+ sources, merged server-side, and delivered to React components as unified objects.

```
User pastes YouTube URL
  ↓
/api/youtube-metadata
  ├── YouTube oEmbed → video title, channel, thumbnail
  ├── TMDB Search + Details → cast, crew, genres, images, videos, trailer
  ├── OMDB → critic scores, MPAA rating, plot, awards, box office
  ├── IMDB scrape → detailed box office (domestic/worldwide), awards breakdown
  ├── Metacritic scrape → Metascore (fallback if OMDB missing)
  └── Rotten Tomatoes scrape → Tomatometer (fallback if OMDB missing)
  ↓
React state (selectedMedia / logData / queueItems)
  ↓
Components render: LoggedItemModal → MediaCard → CharacterGallery → SoundtrackModal
```

---

## External Data Sources

### 1. TMDB (The Movie Database)
- **Role:** Primary source for film metadata, cast, crew, images, videos
- **API Base:** `https://api.themoviedb.org/3/`
- **Auth:** API key via query parameter
- **Rate Limit:** ~40 requests/10 seconds
- **Image CDN:** `https://image.tmdb.org/t/p/{size}{path}`
  - Poster sizes: `w200`, `w500`
  - Backdrop sizes: `w780`, `w1280`
  - Profile sizes: `w185`, `w500`

### 2. OMDB (Open Movie Database)
- **Role:** Critic scores, MPAA rating, plot synopsis, awards text, box office
- **API Base:** `https://www.omdbapi.com/`
- **Auth:** API key via query parameter
- **Rate Limit:** 1,000 requests/day (free tier)

### 3. IMDB (Web Scraping)
- **Role:** Detailed box office (domestic + worldwide + opening weekend), budget, award counts
- **Method:** Fetches IMDB title page, parses `__NEXT_DATA__` JSON from HTML
- **URLs:** `https://www.imdb.com/title/{imdbId}/` and `/awards/`
- **No API key required** (web scraping)

### 4. Metacritic (Web Scraping)
- **Role:** Metascore when OMDB doesn't have it
- **Method:** Fetches page HTML, tries multiple extraction patterns (JSON-LD, data attributes, regex)
- **URLs:** `https://www.metacritic.com/movie/{slug}` or `/search/{query}`
- **No API key required**

### 5. Rotten Tomatoes (Web Scraping)
- **Role:** Tomatometer and audience score when OMDB doesn't have it
- **Method:** Fetches page HTML, extracts scores via JSON-LD and regex patterns
- **URLs:** `https://www.rottentomatoes.com/m/{slug}`
- **No API key required**

### 6. YouTube Data API v3
- **Role:** Trailer search, playlist/soundtrack discovery, video metadata
- **API Base:** `https://www.googleapis.com/youtube/v3/`
- **Auth:** API key via query parameter
- **Rate Limit:** 10,000 units/day per key (app rotates 3 keys)
- **Key operations:**
  - `search` (100 units) — find trailers and soundtrack playlists
  - `playlists` (1 unit) — get playlist metadata
  - `playlistItems` (1 unit) — get tracks in a playlist

### 7. Soundtracki.com (Web Scraping)
- **Role:** Episode-level TV soundtrack data (songs, timestamps, scene descriptions)
- **Method:** Fetches page HTML, parses song listings
- **Used by:** `/api/tv-soundtrack` endpoint
- **No API key required**

### 8. Hardcoded Data
- **Role:** Unreleased films not yet in TMDB
- **Currently includes:** "The Moment" (ID: 99990001), "Undertone" (ID: 99990002)
- **Location:** `/src/app/api/youtube-metadata/route.ts` lines 27-80

---

## The Data Flow: URL Paste to Display

### Phase 1: URL Detection & YouTube Metadata

**Trigger:** User pastes a YouTube URL into the input field

**File:** `src/app/page.tsx`

**Process:**
1. `extractYouTubeId()` pulls the video ID from the URL
2. Calls `/api/youtube-metadata?url={youtubeUrl}`

**File:** `src/app/api/youtube-metadata/route.ts`

3. Fetches YouTube page to extract: title, description, channel name, thumbnail, view count, duration
4. `detectMediaContent()` analyzes the title/description to determine if it's a film trailer
   - Scans for keywords: "official trailer", "movie trailer", "documentary"
   - Extracts clean film title by removing suffixes ("| Official Trailer", "HD", year)
   - Detects year from title or description
   - Determines media type (movie vs TV)
   - Returns confidence level and detection clues

### Phase 2: TMDB Data Assembly

5. If high confidence detection → `fetchTMDBData(title, year)`
6. **TMDB Search:** `GET /search/multi?query={title}&year={year}`
   - Tries exact title first
   - Falls back to normalized accents (e.g., "Sirât" → "Sirat")
   - Falls back to shorter keyword search if no results
7. **TMDB Details:** `GET /movie/{id}?append_to_response=credits,videos,images`
   - `credits` → full cast (top 10) and crew (director, DP, composer, writers, producers, editor)
   - `videos` → all YouTube videos (trailers, clips, featurettes, behind-the-scenes)
   - `images` → backdrops, posters, stills with dimensions

### Phase 3: Scores & Rich Metadata

8. **OMDB Fetch:** `fetchOMDBData(title, year, imdbId)`
   - Prefers IMDB ID lookup: `GET /?i={imdbId}&plot=full`
   - Fallback: `GET /?t={title}&y={year}&type=movie&plot=full`
   - Returns: Metascore, RT score, IMDB rating, MPAA rating, plot, awards text, box office

9. **IMDB Scrape:** `fetchFullIMDBData(imdbId)` (if IMDB ID available)
   - Fetches `https://www.imdb.com/title/{imdbId}/`
   - Parses `__NEXT_DATA__` JSON embedded in page
   - Extracts: budget, domestic box office, worldwide box office, opening weekend, award wins/nominations

10. **Metacritic Scrape** (fallback if OMDB score missing): `fetchMetacriticData(title, year, mediaType)`
    - Tries direct URL first, then search
    - Extraction patterns: JSON-LD → data attributes → class-based → page state JSON

11. **Rotten Tomatoes Scrape** (fallback if OMDB score missing): `fetchRottenTomatoesData(title, year, mediaType)`
    - Constructs URL from title slug
    - Extraction patterns: JSON-LD → scoreboard attributes → regex

### Phase 4: State & Display

12. All data merged into a single response object
13. `page.tsx` stores in React state (`selectedMedia`, `logData`)
14. Components render from state: `LoggedItemModal` → `MediaCard` → `CharacterGallery`

### Phase 5: Additional Data (On-Demand)

When the modal opens, additional data is fetched:

15. **CharacterGallery** calls `/api/movie-images` → cast photos, scene stills, video clips
16. **SoundtrackModal** calls `/api/youtube-playlist` → original score + music playlists
17. **Awards tooltip** calls `/api/imdb-awards` → detailed award event names
18. **Refresh button** calls `/api/metacritic-refresh`, `/api/rt-refresh`, `/api/imdb-refresh` → fresh scores

---

## API Endpoints Reference

### `/api/youtube-metadata`

**Purpose:** Main entry point. Extracts film info from a YouTube URL.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | YouTube video URL |

**External calls:** YouTube page fetch → TMDB search + details → OMDB → IMDB scrape → Metacritic scrape → RT scrape

**Returns:** Complete film object with all metadata, scores, media URLs, cast, crew.

**File:** `src/app/api/youtube-metadata/route.ts` (~1600 lines)

---

### `/api/movie-details`

**Purpose:** Fetch full details for a known film (used when logging from search, not URL paste).

| Parameter | Type | Description |
|-----------|------|-------------|
| `tmdbId` | number | TMDB movie ID (preferred) |
| `title` | string | Film title (fallback) |
| `year` | number | Release year |
| `type` | string | `movie` or `tv` |

**External calls:** TMDB details → OMDB → IMDB scrape

**Returns:** Same structure as youtube-metadata but without YouTube-specific fields.

**File:** `src/app/api/movie-details/route.ts`

---

### `/api/movie-images`

**Purpose:** Fetch cast photos, scene stills, and video clips for the CharacterGallery.

| Parameter | Type | Description |
|-----------|------|-------------|
| `movieId` | string | TMDB movie ID (preferred) |
| `title` | string | Film title (fallback for search) |
| `year` | number | Release year |

**External calls:** TMDB `/movie/{id}/images`, `/movie/{id}/credits`, `/movie/{id}/videos`

**Returns:**
```json
{
  "images": {
    "scenes": [{ "url": "...", "urlLarge": "...", "width": 1280, "height": 720 }],
    "cast": [{ "actorName": "...", "characterName": "...", "url": "...", "urlLarge": "..." }],
    "videos": [{ "name": "...", "key": "ytVideoId", "videoType": "Clip|Featurette|Trailer", "thumbnailUrl": "...", "embedUrl": "..." }]
  }
}
```

**Video type priority:** Clip (1) > Featurette (2) > Behind the Scenes (3) > Trailer (4) > Teaser (5)

**Limits:** 20 scenes, 10 cast, 15 videos

**File:** `src/app/api/movie-images/route.ts`

---

### `/api/search`

**Purpose:** Search for films by title (powers the search bar).

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `type` | string | `all`, `movie`, or `tv` |

**External calls:** Check hardcoded films → TMDB `/search/multi` → TMDB details for each result → OMDB for scores

**Returns:** Array of search results with poster, director, cast, scores.

**File:** `src/app/api/search/route.ts`

---

### `/api/youtube-trailer`

**Purpose:** Find the official trailer for a film on YouTube.

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Film title |
| `year` | number | Release year |

**External calls:** YouTube Data API v3 search

**Scoring:** +10 "official" in title, +5 "trailer" in title, +8 "official" in channel, -20 "reaction"/"parody", -15 "review"/"breakdown"

**Returns:** `{ videoId, embedUrl, title, channelTitle, thumbnail }`

**File:** `src/app/api/youtube-trailer/route.ts`

---

### `/api/youtube-playlist`

**Purpose:** Find soundtrack playlists on YouTube (score and/or songs).

| Parameter | Type | Description |
|-----------|------|-------------|
| `movieTitle` | string | Film title |
| `searchType` | string | `score` or `music` |
| `composer` | string | Composer name (for score search) |

**Process:**
1. Check `PLAYLIST_OVERRIDES` dictionary for manual corrections
2. Search YouTube: `"{composer} {title} original score"` or `"{title} music from songs playlist"`
3. Score matches by keyword relevance
4. Fetch playlist items (up to 50 tracks)

**Returns:** `{ playlistId, playlistTitle, tracks: [{ videoId, title, artist, thumbnail }] }`

**File:** `src/app/api/youtube-playlist/route.ts`

---

### `/api/tv-soundtrack`

**Purpose:** Get episode-level TV soundtrack data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `show` | string | TV show name |
| `season` | number | Season number |
| `episode` | number | Episode number |

**Sources (priority):** Soundtracki.com → NME → DuckDuckGo web search

**Returns:** `{ songs: [{ title, artist, timestamp, scene, youtubeSearchUrl }] }`

**File:** `src/app/api/tv-soundtrack/route.ts`

---

### `/api/imdb-awards`

**Purpose:** Get detailed award event names for the awards tooltip.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | IMDB URL for the film |

**Process:** Fetches IMDB `/awards/` page, parses `__NEXT_DATA__` for award categories.

**Returns:** `{ summary: "Oscar\nBAFTA\nGolden Globe\n...", count: 6 }`

**File:** `src/app/api/imdb-awards/route.ts`

---

### `/api/metacritic-refresh`

**Purpose:** User-triggered fresh Metacritic score scrape.

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Film title |
| `year` | number | Release year |

**File:** `src/app/api/metacritic-refresh/route.ts`

---

### `/api/rt-refresh`

**Purpose:** User-triggered fresh Rotten Tomatoes score scrape.

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Film title |
| `year` | number | Release year |

**File:** `src/app/api/rt-refresh/route.ts`

---

### `/api/imdb-refresh`

**Purpose:** User-triggered fresh IMDB data scrape (rating, box office, awards).

| Parameter | Type | Description |
|-----------|------|-------------|
| `imdbId` | string | IMDB title ID (e.g., `tt1234567`) |

**File:** `src/app/api/imdb-refresh/route.ts`

---

## Component Data Map

### What Each Component Renders

#### LoggedItemModal (`src/components/right-pane/LoggedItemModal.tsx`)

The main film detail view in My Stuff.

| Section | Data | Source |
|---------|------|--------|
| Header | Title, year, director, user rating | LoggedItem state |
| Hero carousel | TMDB video clips, featurettes | `/api/movie-images` (fetched on mount) |
| Poster | Film poster image | TMDB `poster_path` via image CDN |
| Metadata row | Genres, runtime, MPAA rating | TMDB + OMDB |
| Metacritic score | Score + link | OMDB or Metacritic scrape |
| RT score | Tomatometer + link | OMDB or RT scrape |
| IMDB rating | Rating + link | OMDB or IMDB scrape |
| Awards | Summary text + tooltip with details | OMDB text + `/api/imdb-awards` on hover |

#### MediaCard (`src/components/right-pane/MediaCard.tsx`)

The large card below the hero section showing the official trailer and detailed info.

| Section | Data | Source |
|---------|------|--------|
| Video embed | Official trailer | TMDB `trailerUrl` or `trailerVideoId` |
| Title + year + runtime | Basic info | TMDB |
| Soundtrack button | Opens SoundtrackModal | YouTube playlist search |
| Director pill | Director name + preference | TMDB credits |
| Cinematographer pill | DP name + preference | TMDB credits |
| Composer pill | Composer name + preference | TMDB credits |
| Cast grid | Top 8 actors with character names | TMDB credits |
| Metacritic panel | Score, breakdown, top reviews, consensus | OMDB score + Metacritic scrape |
| RT panel | Tomatometer, audience score, top reviews | OMDB score + RT scrape |
| Awards & Box Office | Award text, box office figure | OMDB + IMDB scrape |
| Your Experience | Date, location, first-time, companions, rating, notes | User input |

#### CharacterGallery (`src/components/CharacterGallery.tsx`)

The tabbed gallery below MediaCard.

| Tab | Data | Source |
|-----|------|--------|
| Cast | Actor photos, names, character names | `/api/movie-images` → TMDB credits |
| Scenes | Film stills/backdrops | `/api/movie-images` → TMDB images |
| Videos | Clips, featurettes, trailers with thumbnails | `/api/movie-images` → TMDB videos |

Each video thumbnail has a **pin/star button** that saves to localStorage. Pinned video appears first in the hero carousel.

#### SoundtrackModal (`src/components/right-pane/SoundtrackModal.tsx`)

| Tab | Data | Source |
|-----|------|--------|
| Original Score | Composer's score playlist | `/api/youtube-playlist?searchType=score` |
| Music From | Songs from the film | `/api/youtube-playlist?searchType=music` |
| Edit button | Manual playlist URL override | localStorage |

Each track shows: position, title, artist, thumbnail, embedded YouTube player. Users can save/unsave individual tracks to My Stuff.

---

## Complete Field Reference

Every data field, where it comes from, and which API provides it.

### Film Identity

| Field | Source | API | Notes |
|-------|--------|-----|-------|
| `title` | TMDB | `/movie/{id}` | `title` (movie) or `name` (TV) |
| `year` | TMDB | `/movie/{id}` | Extracted from `release_date` |
| `tmdbId` | TMDB | `/search/multi` | Internal TMDB identifier |
| `imdbId` | TMDB | `/movie/{id}` | `imdb_id` field |
| `mediaType` | TMDB | `/search/multi` | `movie` or `tv` |
| `overview` | TMDB | `/movie/{id}` | Short synopsis |
| `plot` | OMDB | `/?t={title}` | Full plot (often longer than TMDB overview) |

### Crew

| Field | Source | API | Notes |
|-------|--------|-----|-------|
| `director` | TMDB | `/movie/{id}/credits` | `crew` where `job === 'Director'` (first) |
| `directors` | TMDB | `/movie/{id}/credits` | All directors |
| `cinematographer` | TMDB | `/movie/{id}/credits` | `crew` where `job === 'Director of Photography'` |
| `composer` | TMDB | `/movie/{id}/credits` | `crew` where `job === 'Original Music Composer'` |
| `writers` | TMDB | `/movie/{id}/credits` | `crew` where job is Writer, Screenplay, or Story (deduplicated) |
| `producers` | TMDB | `/movie/{id}/credits` | `crew` where job contains 'Producer' (up to 5) |
| `editor` | TMDB | `/movie/{id}/credits` | `crew` where `job === 'Editor'` |

### Cast

| Field | Source | API | Notes |
|-------|--------|-----|-------|
| `cast` | TMDB | `/movie/{id}/credits` | Top 10: `{ name, character, profilePath }` |
| `starring` | TMDB | `/movie/{id}/credits` | Top 5 actor names (string array) |
| Cast photos | TMDB | `/movie/{id}/credits` | `profile_path` → `w185` or `w500` via image CDN |

### Scores & Ratings

| Field | Primary Source | Fallback | Notes |
|-------|---------------|----------|-------|
| `metacriticScore` | OMDB `Metascore` | Metacritic scrape | 0-100 scale |
| `rottenTomatoesScore` | OMDB `Ratings` array | RT scrape | 0-100 percentage |
| `imdbRating` | OMDB `imdbRating` | IMDB scrape | String like "7.4" |
| `tmdbRating` | TMDB `vote_average` | — | Converted from 0-10 to 0-100 |
| `rated` | OMDB `Rated` | — | MPAA rating (PG, R, PG-13, etc.) |

### Box Office & Awards

| Field | Source | Method | Notes |
|-------|--------|--------|-------|
| `boxOffice` | IMDB scrape | `__NEXT_DATA__` parse | Formatted: "$X (US & Canada) / $Y (Worldwide)" |
| Domestic gross | IMDB | `lifetimeGross.total.amount` | US & Canada |
| Worldwide gross | IMDB | `worldwideGross.total.amount` | Global total |
| Opening weekend | IMDB | `openingWeekendGross.gross.total.amount` | First weekend |
| Budget | IMDB | `productionBudget.budget.amount` | Production budget |
| `awards` | OMDB | `Awards` field | Text like "Won 3 Oscars. 124 wins & 228 nominations" |
| Award event names | IMDB | `/awards/` page scrape | Used in tooltip on hover |

### Media & Images

| Field | Source | API | Notes |
|-------|--------|-----|-------|
| `poster` | TMDB | `/movie/{id}` | `poster_path` → `w500` |
| `backdrop` | TMDB | `/movie/{id}` | `backdrop_path` → `w1280` |
| Scene stills | TMDB | `/movie/{id}/images` | `backdrops` sorted by votes, up to 20 |
| `trailerUrl` | TMDB | `/movie/{id}/videos` | First video where `type === 'Trailer'` |
| `trailerVideoId` | TMDB | `/movie/{id}/videos` | YouTube video ID |
| All videos | TMDB | `/movie/{id}/videos` | Up to 15, sorted: Clip > Featurette > BTS > Trailer > Teaser |

### URLs

| Field | Source | Method |
|-------|--------|--------|
| `imdbUrl` | TMDB | Constructed from `imdb_id`: `https://www.imdb.com/title/{id}/` |
| `metacriticUrl` | Constructed | Title slug: `https://www.metacritic.com/movie/{slug}` |
| `rottenTomatoesUrl` | Constructed | Title slug: `https://www.rottentomatoes.com/m/{slug}` |
| `officialWebsite` | Hardcoded/OMDB | For A24 films: `https://a24films.com/films/{slug}` |

### Classification & Details

| Field | Source | API |
|-------|--------|-----|
| `genres` | TMDB | `/movie/{id}` → `genres[].name` |
| `runtime` | TMDB | `/movie/{id}` → `runtime` (minutes) |
| `distributor` | TMDB | `/movie/{id}` → detected from `production_companies` |
| `country` | OMDB | `Country` field |
| `language` | OMDB | `Language` field |
| `releaseDate` | TMDB/Hardcoded | For upcoming films |

### Soundtrack

| Field | Source | API |
|-------|--------|-----|
| Score playlist | YouTube | `/api/youtube-playlist?searchType=score` |
| Music playlist | YouTube | `/api/youtube-playlist?searchType=music` |
| Track title | YouTube | Parsed from `playlistItems` snippet title |
| Track artist | YouTube | Parsed from title ("Artist - Song") or channel name |
| TV episode songs | Soundtracki.com | `/api/tv-soundtrack` scrape |

### User-Generated Data

| Field | Source | Storage |
|-------|--------|---------|
| `rating` | User input | React state → localStorage |
| `notes` | User input | React state → localStorage |
| `dateConsumed` | User input | React state → localStorage |
| `location` / `locationDetail` | User input | React state → localStorage |
| `firstTime` | User input | Boolean |
| `socialContext` / `companionNames` | User input | React state → localStorage |
| Talent preferences (love/don't love) | User clicks on pills | localStorage |
| Pinned hero video | Star button in CharacterGallery | localStorage key: `hero_pinned_{title}` |
| Soundtrack playlist override | Edit button in SoundtrackModal | localStorage |

---

## Data Interfaces

### LoggedItem (Core Film Object)

**File:** `src/components/right-pane/RightPaneTabs.tsx`

```typescript
interface LoggedItem {
  id: number
  entryNumber: number
  mediaType: 'movie' | 'tv' | 'music'
  title: string
  year?: number
  releaseDate?: string
  tmdbId?: number

  // Crew
  director?: string
  directors?: string[]
  cinematographer?: string
  composer?: string
  writers?: string[]
  producers?: Array<{ name: string; job: string }>
  editor?: string

  // Cast
  starring?: string[]
  cast?: Array<{ name: string; character: string; profilePath?: string }>

  // Content
  genres?: string[]
  distributor?: string
  runtime?: number
  overview?: string
  plot?: string

  // Scores
  tmdbRating?: number
  metacriticScore?: number
  rottenTomatoesScore?: number
  imdbRating?: string
  rated?: string
  awards?: string
  boxOffice?: string

  // Media
  trailerUrl?: string
  trailerVideoId?: string
  videoId?: string
  poster?: string
  backdrop?: string

  // URLs
  metacriticUrl?: string
  rottenTomatoesUrl?: string
  imdbUrl?: string
  officialWebsite?: string

  // User Data
  rating?: number
  notes?: string
  dateConsumed?: string
  location?: string
  locationDetail?: string
  firstTime?: boolean
  socialContext?: string
  companionNames?: string

  // AI Analysis (future)
  extractedEntities?: Array<{ resolved: string; type: string; sentiment: string; context?: string }>
  extractedThemes?: string[]
  overallSentiment?: string
}
```

### QueueItem (Up Next Queue)

Same fields as LoggedItem plus:
```typescript
interface QueueItem extends LoggedItem {
  isDraft?: boolean
  sourceUrl?: string
}
```

---

## API Keys & Configuration

### Required Environment Variables

Create `.env.local` in the project root:

```bash
# TMDB - The Movie Database (primary metadata source)
# Get yours at: https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_tmdb_api_key

# OMDB - Open Movie Database (critic scores, plot, awards)
# Get yours at: https://www.omdbapi.com/apikey.aspx
OMDB_API_KEY=your_omdb_api_key

# YouTube Data API v3 (trailer search, playlists, soundtracks)
# Get yours at: https://console.cloud.google.com/apis/credentials
# The app supports up to 3 keys for rotation (quota: 10,000 units/day each)
YOUTUBE_API_KEY=your_youtube_api_key
# Optional additional keys:
YOUTUBE_API_KEY_2=your_second_key
YOUTUBE_API_KEY_3=your_third_key
```

**Note:** The current codebase has API keys hardcoded in route files. For a production fork, these should be moved to environment variables.

### No API Key Required

These data sources use web scraping and need no credentials:
- IMDB (page scraping)
- Metacritic (page scraping)
- Rotten Tomatoes (page scraping)
- Soundtracki.com (page scraping)

---

## Client-Side Storage

All user data is stored in the browser's **localStorage**. There is no server-side database in use (Prisma/SQLite is scaffolded but unused).

### What's in localStorage

| Key Pattern | Data | Used By |
|-------------|------|---------|
| Logged items list | All films the user has logged with full metadata | My Stuff tab |
| Queue items list | Films in the Up Next queue | Queue tab |
| `hero_pinned_{title}` | YouTube video key for pinned carousel video | LoggedItemModal hero carousel |
| Talent preferences | `{ "Actor Name": "loved" \| "not-for-me" }` | MediaCard talent pills |
| Saved music tracks | `Record<string, boolean>` by video ID | SoundtrackModal + My Stuff |
| Playlist overrides | Manual YouTube playlist URLs per film | SoundtrackModal Edit button |

### Implications for Portability

- **No data file to export** — everything lives in the browser
- **Clearing browser data deletes all user data**
- **Different browsers = different data**
- A future export/import feature or migration to SQLite would be needed for data portability

---

## Design Patterns & Fallback Chains

### 1. Layered Score Fetching
```
Metacritic score:  OMDB Metascore → Metacritic page scrape → null
RT score:          OMDB Ratings array → RT page scrape → null
IMDB rating:       OMDB imdbRating → IMDB page scrape → null
Box office:        IMDB page scrape → OMDB BoxOffice → null
Awards:            IMDB page scrape (detailed) → OMDB Awards (text) → null
```

### 2. Film Identification
```
URL paste:    YouTube metadata → detectMediaContent() → TMDB search
Search bar:   Direct TMDB search → hardcoded films check
Hardcoded:    Title match → return pre-built data object (skip all APIs)
```

### 3. YouTube API Key Rotation
The app cycles through up to 3 YouTube API keys to handle daily quota limits (10,000 units/key/day).

### 4. Title Slug Construction
For Metacritic and RT URLs, titles are slugified:
- Lowercase
- Replace spaces with hyphens
- Remove special characters
- Example: "Lady Bird" → `lady-bird`

### 5. TMDB Image CDN Sizes
| Use Case | Size | Example |
|----------|------|---------|
| Search result thumbnails | `w200` | 200px wide poster |
| Film poster (modal) | `w500` | 500px wide poster |
| Scene stills | `w780` | 780px wide backdrop |
| Large backdrop | `w1280` | Full-width backdrop |
| Actor headshot (small) | `w185` | 185px profile |
| Actor headshot (large) | `w500` | 500px profile |

---

## Portability & Deployment

### To Fork & Run This App

```bash
# 1. Clone the repository
git clone https://github.com/jdagogo/smart-media-logger.git
cd smart-media-logger

# 2. Install dependencies
npm install

# 3. Set up API keys
cp .env.example .env.local
# Edit .env.local with your TMDB, OMDB, and YouTube API keys

# 4. Initialize database (scaffolded but unused)
npx prisma generate && npx prisma db push

# 5. Start development server
npm run dev
# Opens on http://localhost:3006
```

### What You Get on a Fresh Fork

- Full application with all UI components
- All API endpoints for data fetching
- Empty user data (no logged films, no queue)
- Web scraping for Metacritic, RT, IMDB works immediately
- TMDB, OMDB, YouTube require your own API keys

### What's Needed for Full Portability

1. **API keys** — You need your own TMDB, OMDB, and YouTube API keys
2. **Data export/import** — Currently no way to transfer user data between machines
3. **Environment variables** — Move hardcoded API keys to `.env.local`
4. **Note:** `npm run build` fails due to TypeScript errors; the dev server works fine

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Prisma + SQLite (scaffolded, unused) |
| Data Storage | localStorage (browser) |
| Port | 3006 |

---

*This document should be updated whenever new data sources are added or existing pipelines change.*
