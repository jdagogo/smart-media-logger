# Movie Metadata Capture Checklist

## Basic Identification
- [ ] Title
- [ ] Year
- [ ] Media Type (movie/tv)
- [ ] TMDB ID
- [ ] IMDB ID

## Crew
- [ ] Director(s)
- [ ] Cinematographer (DP)
- [ ] Composer
- [ ] Writers
- [ ] Producers
- [ ] Editor

## Cast
- [ ] Cast list (name, character, profile photo)
- [ ] Starring (top-billed names)

## Content Info
- [ ] Overview/Plot
- [ ] Genres
- [ ] Runtime
- [ ] MPAA Rating (R, PG-13, etc.)
- [ ] Country
- [ ] Language

## Media Assets
- [ ] Poster URL
- [ ] Backdrop URL
- [ ] Trailer Video ID
- [ ] Additional Videos (clips, featurettes)
- [ ] Additional Images (stills, backdrops)

## Ratings & Scores
- [ ] IMDB Rating
- [ ] IMDB Vote Count
- [ ] Metacritic Score
- [ ] Metacritic URL
- [ ] Rotten Tomatoes Score
- [ ] Rotten Tomatoes URL
- [ ] TMDB Rating
- [ ] TMDB Vote Count

## Financial & Awards
- [ ] Box Office - Domestic
- [ ] Box Office - Worldwide
- [ ] Budget
- [ ] Awards Summary
- [ ] Awards Details (wins/nominations count)

## Distribution
- [ ] Distributor (A24, NEON, Searchlight, etc.)
- [ ] Official Website
- [ ] Release Date

## Soundtrack
- [ ] Score Playlist ID (or searchable)
- [ ] Music From Playlist ID (or searchable)

---

## Data Sources

| Field | Primary Source | Fallback |
|-------|---------------|----------|
| Title, Year, Crew, Cast | TMDB | YouTube title parsing |
| Ratings (MC, RT, IMDB) | OMDB | Direct scraping |
| Box Office (domestic+worldwide) | IMDB scraping | OMDB (domestic only) |
| Awards | IMDB scraping | OMDB |
| Distributor | TMDB production_companies | YouTube title/channel |
| Official Website | Constructed from distributor | - |
| Soundtrack | YouTube playlist search | Manual override |

---

## Distributor Detection Rules

| Distributor | Detection Method |
|-------------|-----------------|
| A24 | TMDB production_companies, YouTube title ends with "\| A24", YouTube channel = "A24" |
| NEON | TMDB production_companies contains "NEON" |
| Searchlight | TMDB production_companies contains "Searchlight" |
| Focus Features | TMDB production_companies contains "Focus Features" |

## Official Website Construction

| Distributor | URL Pattern |
|-------------|-------------|
| A24 | `https://a24films.com/films/{title-slug}` |
| NEON | `https://neonrated.com/films/{title-slug}` |
| Searchlight | `https://www.searchlightpictures.com/film/{title-slug}` |
