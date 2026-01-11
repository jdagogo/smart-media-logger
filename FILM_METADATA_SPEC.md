# Film Metadata Specification

## Film Formats
- Feature Film
- Documentary
- Documentary Short
- Short Film
- Concert Film
- Stand-up Special

---

## Basic Identification
- Title
- Year
- TMDB ID
- IMDB ID
- Format (feature, documentary, short, etc.)

---

## Cast & Crew

### Crew
- Director(s)
- Writers (screenplay, story)
- Cinematographer / DP
- Composer
- Editor
- Producers (producer, executive producer)

### Cast
- Name
- Character
- Photo

---

## Content
- Synopsis / Overview / Plot
- Genres
- Runtime
- MPAA Rating (R, PG-13, G, etc.)
- Country of origin
- Original language
- Available languages (dubs)
- Available subtitles

---

## Film Festivals & Premieres

### Premiere Info
- World premiere (festival, date)
- North American premiere
- International premieres

### Festival Circuit
- Sundance
- Cannes
- Venice
- Toronto (TIFF)
- Berlin
- Tribeca
- SXSW
- Telluride
- New York Film Festival
- Other festivals

### Festival Awards
- Awards won at each festival
- Nominations at festivals
- Audience awards
- Jury awards

---

## Awards & Nominations
- Awards summary text
- Total wins count
- Total nominations count
- Major awards detail (Oscars, Golden Globes, BAFTA, SAG, etc.)

---

## Ratings & Scores

| Source | Score | URL |
|--------|-------|-----|
| IMDB | Rating + Vote Count | Link |
| Metacritic | Score (even if unavailable, still show link) | Link |
| Rotten Tomatoes | Tomatometer (even if unavailable, still show link) | Link |
| TMDB | Rating + Vote Count | - |
| Letterboxd | Rating | Link |

**Note:** For unreleased films, show links to critic sites even without scores.

---

## Financial
- Box Office - Domestic (from IMDB, NOT OMDB)
- Box Office - Worldwide (from IMDB, NOT OMDB)
- Budget
- Opening Weekend

---

## Distribution & Release

### Distributor
- Name (A24, NEON, Searchlight, Focus Features, etc.)
- Display as non-clickable badge

### Detection Sources (how we identify distributor)
- YouTube video title ending with "| A24" etc.
- YouTube channel name (e.g., channel = "A24" means distributor is A24)
- TMDB production_companies

### Official Website
- Constructed from distributor's film page pattern
- **NEVER link to YouTube channel**

| Distributor | URL Pattern |
|-------------|-------------|
| A24 | `https://a24films.com/films/{title-slug}` |
| NEON | `https://neonrated.com/films/{title-slug}` |
| Searchlight | `https://searchlightpictures.com/film/{title-slug}` |
| Focus Features | `https://focusfeatures.com/films/{title-slug}` |

### Release Date
- Movie theatrical release date
- **NOT YouTube video publish date**
- Hide YouTube stats (view count, publish date) for movie trailers

---

## Music & Soundtrack

### Composer
- Name (from TMDB crew)

### Soundtrack Playlists
- **Score** - Original score playlist (Tab 1)
- **Music From** - Licensed songs/soundtrack (Tab 2)

Both tabs in SoundtrackModal.

---

## Media Assets
- Poster
- Backdrop
- Trailer (video ID)
- Additional clips / featurettes
- Behind-the-scenes videos
- Stills / images

---

## Interviews & Press

### Principal Cast & Creators Interviews
- Director interviews
- Lead actor interviews
- Writer interviews
- Cinematographer interviews
- Composer interviews
- Producer interviews

### Sources
- YouTube (official channels, talk shows, press junkets)
- Podcasts
- Magazine/publication interviews (written)
- Film festival Q&As
- Press tour footage

---

## Podcasts About the Film
- Film review podcasts (Blank Check, The Big Picture, Filmspotting, etc.)
- Director/cast guest appearances on podcasts
- Industry podcasts covering the film
- Episode title
- Episode link
- Timestamp if specific segment

---

## Reviews & Critics

### Video Reviews
- YouTube reviewers (Every Frame a Painting, Nerdwriter, etc.)
- Video essays about the film

### Written Reviews
- Major publications (NYT, New Yorker, Variety, Hollywood Reporter, etc.)
- Notable critic reviews

### Podcast Reviews
- Critics discussing the film
- Review roundtable episodes
- Year-end list discussions featuring the film

---

## External Links
- IMDB URL
- Metacritic URL
- Rotten Tomatoes URL
- Letterboxd URL
- Official Website (distributor's film page)

---

## Social Media

### Official Film Accounts (manual search required)
Handles vary in format - not predictable.

| Platform | Example Handles |
|----------|-----------------|
| Instagram | @ladybirdmovie, @onebattleafteranothermovie |
| X/Twitter | @onebattlemovie |
| TikTok | @onebattleafteranother |
| Facebook | /LadyBirdMovie |

### Engagement Data
- Follower count
- Likes count
- Post/video count

### Content to Capture
- Behind-the-scenes videos
- Cast/director interviews
- Promotional clips
- Making-of content
- Premiere/red carpet footage
- Q&As
- Fan reactions/reviews

### Sources of Content
- Official film accounts
- Distributor accounts (A24, NEON, etc.)
- Cast/director personal accounts
- Film festival accounts
- Entertainment news accounts
- Notable fan content

---

## Where to Watch

### 1. In Theaters Now
- Is it currently in theaters?
- Which theaters nearby?
- Showtimes
- Buy tickets (Fandango, AMC, Alamo Drafthouse, etc.)

### 2. Streaming
- Which platforms?
  - Netflix, Max, Hulu, Prime Video, Apple TV+
  - Peacock, Paramount+, Disney+
  - Criterion Channel, MUBI
- Included with subscription vs. premium add-on
- Leaving soon warnings

### 3. Rent/Buy
- Apple TV / iTunes
- Amazon Prime Video
- Google Play / YouTube
- Vudu
- Price for rent vs. buy
- **One-click action right from the card**

### Display
- Quick badge: 🎬 In Theaters | 📺 Streaming on Max | 💰 Rent $4.99
- Expandable section with all options
- Direct rent/buy buttons

### Data Sources
- JustWatch API
- TMDB watch providers
- Direct platform APIs

---

## Source Material / Based On

### Types of Source Material
- Book (novel, non-fiction)
- Short story
- Magazine/newspaper article
- Play
- Musical
- Graphic novel / comic book
- True story / real events
- Video game
- Previous film (remake)
- Podcast
- Blog post / online article

### What to Capture
- Source type
- Title of original work
- Author / Creator
- Publication date
- Publisher
- Link to purchase/read (Amazon, bookshop.org, etc.)
- Cover image
- Synopsis of source material
- How faithful is the adaptation?

### Examples
- "Lady Bird" - Original screenplay
- "Dune" - Novel by Frank Herbert (1965)
- "The Zone of Interest" - Novel by Martin Amis (2014)
- "Spotlight" - Based on Boston Globe investigation
- "12 Years a Slave" - Memoir by Solomon Northup (1853)

---

## Documentary-Specific Fields
- Subject(s) / Who it's about
- Interview subjects
- Archival footage sources

---

## Short Film-Specific Fields
- Festival screenings
- Awards circuit history
- Where to watch (Vimeo, festival platforms)

---

## Data Sources Summary

| Data | Primary Source | Fallback |
|------|---------------|----------|
| Title, Year, Crew, Cast | TMDB | YouTube title parsing |
| Ratings (IMDB) | IMDB scraping | OMDB |
| Ratings (MC, RT) | OMDB | Direct scraping |
| Box Office (domestic + worldwide) | IMDB scraping | OMDB (domestic only) |
| Awards | IMDB scraping | OMDB |
| Distributor | TMDB production_companies | YouTube title/channel |
| Official Website | Constructed from distributor | Manual |
| Soundtrack | YouTube playlist search | Manual override |
| Social Media | Manual search | - |
| Where to Watch | JustWatch / TMDB | Manual |

---

## Data Persistence Checklist

When saving to queue or logging, ALL of these must persist:

- [ ] officialWebsite
- [ ] metacriticUrl
- [ ] rottenTomatoesUrl
- [ ] releaseDate (movie release, not YouTube publish)
- [ ] distributor
- [ ] imdbId
- [ ] boxOffice (domestic)
- [ ] boxOfficeWorldwide
- [ ] budget
- [ ] awards
- [ ] composer
- [ ] soundtrack playlist IDs

### Data Flow Points to Verify
1. API response → urlMetadata state
2. urlMetadata → setUrlMetadata call
3. urlMetadata → addToQueue (newItem object)
4. urlMetadata → addToQueue (previewData object)
5. urlMetadata → newLoggedItem (Log It flow)
6. logData → currentEntry
7. currentEntry → MediaCard props
8. QueueItem interface includes all fields
9. LoggedItem interface includes all fields

---

## Display Rules

### For Trailers
- Hide YouTube view count
- Hide YouTube publish date
- Show movie release date instead

### Distributor + Official Site
- Distributor: Black non-clickable badge
- Official Site: Orange clickable button (separate element)
- Two distinct UI elements

### Critic Links for Unreleased Films
- Show Metacritic URL even without score
- Show Rotten Tomatoes URL even without score
- Allow click-through to sites

---

## Hardcoded Data (Unreleased Films)

For films not yet in TMDB (e.g., Undertone, The Moment):

```
{
  id: 99990001,
  title: 'The Moment',
  year: 2026,
  overview: '...',
  poster: '...',
  director: '...',
  writers: [...],
  composer: '...',
  cast: [...],
  genres: [...],
  distributor: 'A24',
  runtime: 103,
  rated: 'R',
  releaseDate: '2026-01-30',
  imdbId: 'tt35524793',
  imdbUrl: 'https://www.imdb.com/title/tt35524793/',
  officialWebsite: 'https://a24films.com/films/the-moment',
}
```

---

## Personal Notes & Discovery

### Discovery
- Where did I discover this? (friend recommendation, podcast, social media, article, trailer, etc.)
- Who recommended it?
- Date discovered

### Personal Notes
- Why I want to watch it
- What I've heard about it
- Pre-watch expectations
- Post-watch thoughts (after logging)

---

## TODO / Future Additions

- [ ] More distributor URL patterns
- [ ] Social media search automation
- [ ] Where to Watch integration
- [ ] Festival circuit tracking
- [ ] Related films / recommendations
- [ ] Interview clips aggregation
