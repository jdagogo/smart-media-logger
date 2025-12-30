import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d'
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'a053b065'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    // Extract video ID
    const videoId = extractYouTubeId(url)
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
    }

    // Fetch the YouTube page to extract metadata
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch YouTube page')
    }

    const html = await response.text()

    // Extract metadata from the page
    const metadata = extractMetadata(html, videoId)

    // Check if this looks like a movie/TV trailer and try to fetch TMDB data
    const trailerInfo = detectTrailer(metadata.title || '')
    if (trailerInfo.isTrailer && trailerInfo.mediaTitle) {
      const tmdbData = await fetchTMDBData(trailerInfo.mediaTitle, trailerInfo.year)
      if (tmdbData) {
        // Enhance metadata with TMDB data
        metadata.isTrailer = true
        metadata.detectedMediaType = tmdbData.mediaType
        metadata.tmdbId = tmdbData.id
        metadata.mediaTitle = tmdbData.title
        metadata.mediaYear = tmdbData.year
        metadata.director = tmdbData.director
        metadata.directors = tmdbData.directors
        metadata.cinematographer = tmdbData.cinematographer
        metadata.composer = tmdbData.composer
        metadata.writers = tmdbData.writers
        metadata.producers = tmdbData.producers
        metadata.editor = tmdbData.editor
        metadata.cast = tmdbData.cast
        metadata.genres = tmdbData.genres
        metadata.overview = tmdbData.overview
        metadata.poster = tmdbData.poster
        metadata.runtime = tmdbData.runtime
        metadata.trailerVideoId = videoId  // Keep the YouTube trailer
        // TMDB rating
        metadata.tmdbRating = tmdbData.tmdbRating
        metadata.tmdbVoteCount = tmdbData.tmdbVoteCount
        // External review site links
        metadata.metacriticUrl = tmdbData.metacriticUrl
        metadata.rottenTomatoesUrl = tmdbData.rottenTomatoesUrl
        metadata.imdbUrl = tmdbData.imdbUrl

        // Fetch critic scores from OMDB (most reliable source)
        const omdbData = await fetchOMDBData(tmdbData.title, tmdbData.year)

        if (omdbData) {
          if (omdbData.metacriticScore) {
            metadata.metacriticScore = omdbData.metacriticScore
            metadata.metacriticData = {
              score: omdbData.metacriticScore,
              url: tmdbData.metacriticUrl || `https://www.metacritic.com/movie/${tmdbData.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`,
            }
          }
          if (omdbData.rottenTomatoesScore) {
            metadata.rottenTomatoesScore = omdbData.rottenTomatoesScore
            metadata.rottenTomatoesData = {
              tomatometer: omdbData.rottenTomatoesScore,
              url: tmdbData.rottenTomatoesUrl || `https://www.rottentomatoes.com/m/${tmdbData.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_')}`,
            }
          }
          // IMDB data
          if (omdbData.imdbRating) metadata.imdbRating = omdbData.imdbRating
          if (omdbData.imdbVotes) metadata.imdbVotes = omdbData.imdbVotes
          // Rich OMDB metadata
          if (omdbData.rated) metadata.rated = omdbData.rated
          if (omdbData.plot) metadata.plot = omdbData.plot
          if (omdbData.awards) metadata.awards = omdbData.awards
          if (omdbData.boxOffice) metadata.boxOffice = omdbData.boxOffice
          if (omdbData.production) metadata.production = omdbData.production
          if (omdbData.country) metadata.country = omdbData.country
          if (omdbData.language) metadata.language = omdbData.language
        }

        // Fallback: Try scraping if OMDB didn't have the data
        if (!metadata.metacriticScore || !metadata.rottenTomatoesScore) {
          const [metacriticData, rottenTomatoesData] = await Promise.all([
            !metadata.metacriticScore ? fetchMetacriticData(tmdbData.title, tmdbData.year, tmdbData.mediaType) : null,
            !metadata.rottenTomatoesScore ? fetchRottenTomatoesData(tmdbData.title, tmdbData.year, tmdbData.mediaType) : null,
          ])

          if (metacriticData && !metadata.metacriticScore) {
            metadata.metacriticScore = metacriticData.score
            metadata.metacriticData = metacriticData
          }

          if (rottenTomatoesData && !metadata.rottenTomatoesScore) {
            metadata.rottenTomatoesScore = rottenTomatoesData.tomatometer
            metadata.rottenTomatoesData = rottenTomatoesData
          }
        }
      }
    }

    return NextResponse.json(metadata)
  } catch (error) {
    console.error('YouTube metadata fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 })
  }
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Detect if this is a movie/TV trailer and extract the title
function detectTrailer(title: string): { isTrailer: boolean; mediaTitle?: string; year?: number; mediaType?: 'movie' | 'tv' } {
  const titleLower = title.toLowerCase()

  // Common trailer patterns
  const trailerPatterns = [
    /official\s+trailer/i,
    /official\s+teaser/i,
    /movie\s+trailer/i,
    /film\s+trailer/i,
    /\|\s*trailer/i,
    /-\s*trailer/i,
    /trailer\s*\d*/i,
    /teaser\s+trailer/i,
    /final\s+trailer/i,
    /new\s+trailer/i,
  ]

  const isTrailer = trailerPatterns.some(pattern => pattern.test(titleLower))

  if (!isTrailer) {
    return { isTrailer: false }
  }

  // Extract the movie/show title by removing common trailer suffixes
  let mediaTitle = title
    .replace(/\s*[\|\-–]\s*(Official\s+)?(Movie\s+)?(Final\s+)?(New\s+)?(Teaser\s+)?Trailer.*$/i, '')
    .replace(/\s*Official\s+Trailer.*$/i, '')
    .replace(/\s*Trailer\s*\d*.*$/i, '')
    .replace(/\s*\(Official\).*$/i, '')
    .replace(/\s*HD\s*$/i, '')
    .replace(/\s*4K\s*$/i, '')
    .trim()

  // Try to extract year from the title
  const yearMatch = mediaTitle.match(/\((\d{4})\)/)
  let year: number | undefined
  if (yearMatch) {
    year = parseInt(yearMatch[1])
    mediaTitle = mediaTitle.replace(/\s*\(\d{4}\)/, '').trim()
  }

  // Check if it might be a TV show
  const tvIndicators = ['season', 'series', 'episode', 's0', 's1', 's2']
  const mediaType = tvIndicators.some(ind => titleLower.includes(ind)) ? 'tv' : 'movie'

  return { isTrailer: true, mediaTitle, year, mediaType }
}

// Fetch movie/TV data from TMDB
async function fetchTMDBData(title: string, year?: number): Promise<{
  id: number
  title: string
  year: number
  mediaType: 'movie' | 'tv'
  director?: string
  directors?: string[]
  cinematographer?: string
  composer?: string
  writers?: string[]
  producers?: Array<{ name: string; job: string }>
  editor?: string
  cast?: Array<{ name: string; character: string; profilePath?: string }>
  genres?: string[]
  overview?: string
  poster?: string
  runtime?: number
  tmdbRating?: number
  tmdbVoteCount?: number
  metacriticUrl?: string
  rottenTomatoesUrl?: string
  imdbUrl?: string
} | null> {
  try {
    // Clean up title - remove brackets, extra info
    const cleanTitle = title
      .replace(/\[.*?\]/g, '')  // Remove [anything]
      .replace(/\(.*?\)/g, '')  // Remove (anything)
      .trim()

    // Search for the movie/TV show - first try with year
    let searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}${year ? `&year=${year}` : ''}`
    let searchResponse = await fetch(searchUrl)

    if (!searchResponse.ok) {
      console.log('TMDB search failed')
      return null
    }

    let searchData = await searchResponse.json()
    let result = searchData.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv')

    // If no result with year, try without year
    if (!result && year) {
      console.log('No result with year, trying without year for:', cleanTitle)
      searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`
      searchResponse = await fetch(searchUrl)
      if (searchResponse.ok) {
        searchData = await searchResponse.json()
        result = searchData.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
      }
    }

    if (!result) {
      console.log('No TMDB result found for:', cleanTitle)
      return null
    }

    const mediaType = result.media_type as 'movie' | 'tv'
    const tmdbId = result.id

    // Fetch detailed info with credits
    const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
    const detailsResponse = await fetch(detailsUrl)

    if (!detailsResponse.ok) {
      return null
    }

    const details = await detailsResponse.json()

    // Extract director (for movies) or creator (for TV)
    let director: string | undefined
    if (mediaType === 'movie') {
      const directorCredit = details.credits?.crew?.find((c: any) => c.job === 'Director')
      director = directorCredit?.name
    } else {
      director = details.created_by?.[0]?.name
    }

    // Extract key crew members
    const crew = details.credits?.crew || []

    // Get all directors (some films have multiple)
    const directors = crew
      .filter((c: any) => c.job === 'Director')
      .map((c: any) => c.name)

    // Cinematographer / Director of Photography
    const cinematographer = crew.find((c: any) =>
      c.job === 'Director of Photography' || c.job === 'Cinematography'
    )?.name

    // Composer / Music
    const composers = crew
      .filter((c: any) =>
        c.job === 'Original Music Composer' ||
        c.job === 'Music' ||
        c.job === 'Composer'
      )
      .map((c: any) => c.name)
    const composer = composers.length > 0 ? composers.join(', ') : undefined

    // Writers / Screenplay
    const writers = crew
      .filter((c: any) =>
        c.job === 'Writer' ||
        c.job === 'Screenplay' ||
        c.job === 'Story'
      )
      .map((c: any) => c.name)
      .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index) // unique

    // Producers
    const producers = crew
      .filter((c: any) => c.job === 'Producer' || c.job === 'Executive Producer')
      .slice(0, 5)
      .map((c: any) => ({ name: c.name, job: c.job }))

    // Editor
    const editor = crew.find((c: any) => c.job === 'Editor')?.name

    // Extract top cast
    const cast = details.credits?.cast?.slice(0, 10).map((c: any) => ({
      name: c.name,
      character: c.character,
      profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
    }))

    // Extract genres
    const genres = details.genres?.map((g: any) => g.name)

    // Construct Metacritic and Rotten Tomatoes URLs from title
    const titleForUrl = (mediaType === 'movie' ? details.title : details.name)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    const rtTitleForUrl = (mediaType === 'movie' ? details.title : details.name)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')

    const releaseYear = new Date(mediaType === 'movie' ? details.release_date : details.first_air_date).getFullYear()

    return {
      id: tmdbId,
      title: mediaType === 'movie' ? details.title : details.name,
      year: releaseYear,
      mediaType,
      director,
      directors,
      cinematographer,
      composer,
      writers,
      producers,
      editor,
      cast,
      genres,
      overview: details.overview,
      poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
      runtime: details.runtime,
      // TMDB ratings
      tmdbRating: details.vote_average ? Math.round(details.vote_average * 10) : undefined, // Convert to 0-100
      tmdbVoteCount: details.vote_count,
      // External review sites - URLs for linking out
      metacriticUrl: `https://www.metacritic.com/${mediaType}/${titleForUrl}`,
      rottenTomatoesUrl: `https://www.rottentomatoes.com/${mediaType === 'movie' ? 'm' : 'tv'}/${rtTitleForUrl}`,
      imdbUrl: details.imdb_id ? `https://www.imdb.com/title/${details.imdb_id}` : undefined,
    }
  } catch (error) {
    console.error('TMDB fetch error:', error)
    return null
  }
}

// Fetch rich metadata from OMDB API
async function fetchOMDBData(title: string, year: number): Promise<{
  metacriticScore?: number
  rottenTomatoesScore?: number
  imdbRating?: string
  imdbVotes?: string
  rated?: string
  plot?: string
  awards?: string
  boxOffice?: string
  production?: string
  country?: string
  language?: string
} | null> {
  try {
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&type=movie&plot=full`
    console.log('Fetching OMDB:', url)

    const response = await fetch(url)
    if (!response.ok) {
      console.log('OMDB fetch failed:', response.status)
      return null
    }

    const data = await response.json()

    if (data.Response === 'False') {
      console.log('OMDB no result for:', title)
      return null
    }

    let metacriticScore: number | undefined
    let rottenTomatoesScore: number | undefined

    // Get Metascore directly
    if (data.Metascore && data.Metascore !== 'N/A') {
      metacriticScore = parseInt(data.Metascore)
    }

    // Get RT score from Ratings array
    if (data.Ratings && Array.isArray(data.Ratings)) {
      for (const rating of data.Ratings) {
        if (rating.Source === 'Rotten Tomatoes' && rating.Value) {
          rottenTomatoesScore = parseInt(rating.Value) // "92%" -> 92
        }
      }
    }

    console.log(`OMDB found: metacritic=${metacriticScore}, RT=${rottenTomatoesScore}, imdb=${data.imdbRating}, awards=${data.Awards}`)

    return {
      metacriticScore,
      rottenTomatoesScore,
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
      imdbVotes: data.imdbVotes !== 'N/A' ? data.imdbVotes : undefined,
      rated: data.Rated !== 'N/A' ? data.Rated : undefined,
      plot: data.Plot !== 'N/A' ? data.Plot : undefined,
      awards: data.Awards !== 'N/A' ? data.Awards : undefined,
      boxOffice: data.BoxOffice !== 'N/A' ? data.BoxOffice : undefined,
      production: data.Production !== 'N/A' ? data.Production : undefined,
      country: data.Country !== 'N/A' ? data.Country : undefined,
      language: data.Language !== 'N/A' ? data.Language : undefined,
    }
  } catch (error) {
    console.error('OMDB fetch error:', error)
    return null
  }
}

function extractMetadata(html: string, videoId: string) {
  const metadata: {
    title?: string
    description?: string
    author?: string
    authorUrl?: string
    thumbnail?: string
    videoId: string
    duration?: string
    viewCount?: string
    publishDate?: string
    category?: string
    tags?: string[]
    // Trailer detection fields
    isTrailer?: boolean
    detectedMediaType?: 'movie' | 'tv'
    tmdbId?: number
    mediaTitle?: string
    mediaYear?: number
    director?: string
    directors?: string[]
    cinematographer?: string
    composer?: string
    writers?: string[]
    producers?: Array<{ name: string; job: string }>
    editor?: string
    cast?: Array<{ name: string; character: string; profilePath?: string }>
    genres?: string[]
    overview?: string
    poster?: string
    runtime?: number
    trailerVideoId?: string
    // TMDB rating
    tmdbRating?: number
    tmdbVoteCount?: number
    // IMDB rating (from OMDB)
    imdbRating?: string
    imdbVotes?: string
    // OMDB rich metadata
    rated?: string
    plot?: string
    awards?: string
    boxOffice?: string
    production?: string
    country?: string
    language?: string
    // External review site links
    metacriticUrl?: string
    rottenTomatoesUrl?: string
    imdbUrl?: string
    // Real critic scores from scraping
    metacriticScore?: number
    metacriticData?: {
      score: number
      criticReviews?: number
      userScore?: number
      url: string
    }
    rottenTomatoesScore?: number
    rottenTomatoesData?: {
      tomatometer?: number
      audienceScore?: number
      criticReviews?: number
      consensus?: string
      url: string
    }
  } = { videoId }

  // Try to extract from ytInitialPlayerResponse (most complete data)
  const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/)
  if (playerResponseMatch) {
    try {
      const playerData = JSON.parse(playerResponseMatch[1])
      const videoDetails = playerData?.videoDetails
      const microformat = playerData?.microformat?.playerMicroformatRenderer

      if (videoDetails) {
        metadata.title = videoDetails.title
        metadata.description = videoDetails.shortDescription
        metadata.author = videoDetails.author
        metadata.viewCount = videoDetails.viewCount
        metadata.duration = formatDuration(parseInt(videoDetails.lengthSeconds || '0'))
      }

      if (microformat) {
        metadata.authorUrl = microformat.ownerProfileUrl
        metadata.publishDate = microformat.publishDate
        metadata.category = microformat.category
      }
    } catch (e) {
      console.log('Failed to parse ytInitialPlayerResponse')
    }
  }

  // Fallback: Extract from meta tags
  if (!metadata.title) {
    const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]+)"/)
    if (titleMatch) metadata.title = decodeHtmlEntities(titleMatch[1])
  }

  if (!metadata.description) {
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/)
    if (descMatch) metadata.description = decodeHtmlEntities(descMatch[1])
  }

  if (!metadata.author) {
    const authorMatch = html.match(/<link\s+itemprop="name"\s+content="([^"]+)"/)
    if (authorMatch) metadata.author = decodeHtmlEntities(authorMatch[1])
  }

  // Get high-quality thumbnail
  metadata.thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  return metadata
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
}

// Fetch Metacritic data by scraping their movie page
async function fetchMetacriticData(title: string, year: number, mediaType: string): Promise<{
  score: number
  criticReviews?: number
  userScore?: number
  summary?: string
  url: string
  topReviews?: Array<{ critic: string; outlet: string; quote: string; score?: number }>
} | null> {
  try {
    // Construct search URL - Metacritic uses kebab-case
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    const url = `https://www.metacritic.com/${mediaType}/${slug}`
    console.log('Fetching Metacritic:', url)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`Metacritic fetch failed for ${slug}: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Extract metascore - try multiple patterns
    let score: number | null = null

    // Pattern 1: JSON-LD data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '')
          const data = JSON.parse(jsonContent)
          if (data.aggregateRating?.ratingValue) {
            score = Math.round(data.aggregateRating.ratingValue)
            break
          }
        } catch (e) {
          // Continue
        }
      }
    }

    // Pattern 2: Data attribute
    if (!score) {
      const dataMatch = html.match(/data-metascore="(\d+)"/) ||
                        html.match(/data-score="(\d+)"/) ||
                        html.match(/data-v-[^>]*>(\d+)<\/span>/)
      if (dataMatch) score = parseInt(dataMatch[1])
    }

    // Pattern 3: Class-based score (various patterns)
    if (!score) {
      const classMatch = html.match(/class="[^"]*metascore[^"]*"[^>]*>\s*(\d+)\s*</) ||
                         html.match(/metascore_w[^>]*>(\d+)</) ||
                         html.match(/c-siteReviewScore[^>]*>\s*(\d+)\s*</) ||
                         html.match(/c-productScoreInfo[^>]*>\s*(\d+)\s*</) ||
                         html.match(/c-productHero_score[^>]*>(\d+)</) ||
                         html.match(/hero_score[^>]*>(\d+)</) ||
                         html.match(/metaScore["\s>:]+(\d+)/i) ||
                         html.match(/"score":\s*(\d+)/) ||
                         html.match(/>\s*(\d{2})\s*<\/span>\s*<span[^>]*>Metascore/i)
      if (classMatch) score = parseInt(classMatch[1])
    }

    // Pattern 4: Try finding in page data/state
    if (!score) {
      const stateMatch = html.match(/__NEXT_DATA__[^>]*>([^<]+)</)
      if (stateMatch) {
        try {
          const nextData = JSON.parse(stateMatch[1])
          const metascore = nextData?.props?.pageProps?.product?.criticScoreSummary?.score
          if (metascore) score = metascore
        } catch (e) {
          // Continue
        }
      }
    }

    if (!score) {
      console.log('No Metacritic score found for:', title)
      // Log a sample of HTML to debug
      console.log('Sample HTML:', html.substring(0, 500))
      return null
    }

    // Extract critic reviews count
    let criticReviews: number | undefined
    const criticCountMatch = html.match(/based on (\d+) Critic/i) ||
                             html.match(/(\d+) Critic Reviews/i) ||
                             html.match(/"reviewCount":\s*(\d+)/)
    if (criticCountMatch) {
      criticReviews = parseInt(criticCountMatch[1])
    }

    // Extract user score
    let userScore: number | undefined
    const userScoreMatch = html.match(/data-userscore="([\d.]+)"/) ||
                           html.match(/user-score[^>]*>([\d.]+)</)
    if (userScoreMatch) {
      userScore = parseFloat(userScoreMatch[1])
    }

    console.log(`Metacritic found: score=${score}, critics=${criticReviews}`)

    return {
      score,
      criticReviews,
      userScore,
      url,
    }
  } catch (error) {
    console.error('Metacritic scraping error:', error)
    return null
  }
}

// Fetch Rotten Tomatoes data
async function fetchRottenTomatoesData(title: string, year: number, mediaType: string): Promise<{
  tomatometer?: number
  audienceScore?: number
  criticReviews?: number
  consensus?: string
  url: string
  topReviews?: Array<{ critic: string; outlet: string; quote: string; fresh: boolean }>
} | null> {
  try {
    // Construct URL - RT uses underscores
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')

    const prefix = mediaType === 'movie' ? 'm' : 'tv'
    const url = `https://www.rottentomatoes.com/${prefix}/${slug}`
    console.log('Fetching Rotten Tomatoes:', url)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`RT fetch failed for ${slug}: ${response.status}`)
      return null
    }

    const html = await response.text()

    let tomatometer: number | undefined
    let audienceScore: number | undefined
    let criticReviews: number | undefined
    let consensus: string | undefined

    // Try to find scores in JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '')
          const data = JSON.parse(jsonContent)
          if (data.aggregateRating?.ratingValue) {
            const rating = data.aggregateRating.ratingValue
            // RT might return 0-10 scale or 0-100 scale
            tomatometer = rating > 10 ? Math.round(rating) : Math.round(rating * 10)
          }
          if (data.aggregateRating?.reviewCount) {
            criticReviews = data.aggregateRating.reviewCount
          }
        } catch (e) {
          // Continue
        }
      }
    }

    // Pattern: scoreboard data attributes (both orders)
    const scoreboardMatch = html.match(/score-board[^>]*tomatometerscore="(\d+)"[^>]*audiencescore="(\d+)"/) ||
                            html.match(/score-board[^>]*audiencescore="(\d+)"[^>]*tomatometerscore="(\d+)"/)
    if (scoreboardMatch) {
      tomatometer = parseInt(scoreboardMatch[1])
      audienceScore = parseInt(scoreboardMatch[2])
    }

    // Alternative tomatometer patterns
    if (!tomatometer) {
      const tomatometerMatch = html.match(/tomatometer[^>]*>(\d+)%/) ||
                               html.match(/"tomatometerScore":\s*(\d+)/) ||
                               html.match(/data-qa="tomatometer"[^>]*>(\d+)/) ||
                               html.match(/criticsScore["\s>:]+(\d+)/i) ||
                               html.match(/"ratingValue":\s*"?(\d+)"?/)
      if (tomatometerMatch) tomatometer = parseInt(tomatometerMatch[1])
    }

    // Alternative audience patterns - try multiple
    if (!audienceScore) {
      const audienceMatch = html.match(/audiencescore="(\d+)"/) ||
                            html.match(/audience-score[^>]*>(\d+)%/) ||
                            html.match(/"audienceScore":\s*(\d+)/) ||
                            html.match(/data-qa="audience-score"[^>]*>(\d+)/) ||
                            html.match(/popcornscore["\s>:]+(\d+)/i) ||
                            html.match(/audienceAll[^>]*>(\d+)%/)
      if (audienceMatch) audienceScore = parseInt(audienceMatch[1])
    }

    // Extract consensus
    const consensusMatch = html.match(/data-qa="critics-consensus"[^>]*>([^<]+)</) ||
                           html.match(/"criticsConsensus":\s*"([^"]+)"/) ||
                           html.match(/class="[^"]*consensus[^"]*"[^>]*>([^<]+)</)
    if (consensusMatch) {
      consensus = consensusMatch[1].trim()
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
    }

    // Extract critic count
    if (!criticReviews) {
      const countMatch = html.match(/(\d+)\s*Reviews/i) ||
                         html.match(/"ratingCount":\s*(\d+)/)
      if (countMatch) criticReviews = parseInt(countMatch[1])
    }

    if (!tomatometer && !audienceScore) {
      console.log('No RT scores found for:', title)
      return null
    }

    console.log(`RT found: tomatometer=${tomatometer}, audience=${audienceScore}, reviews=${criticReviews}`)

    return {
      tomatometer,
      audienceScore,
      criticReviews,
      consensus,
      url,
    }
  } catch (error) {
    console.error('RT scraping error:', error)
    return null
  }
}
