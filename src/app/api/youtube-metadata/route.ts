import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d'
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'a053b065'

// Hardcoded movies for films not yet in TMDB - use this data instead of TMDB lookup
// These are upcoming/unreleased films that would get wrong data from TMDB/OMDB
const HARDCODED_MOVIES: Record<string, {
  id: number
  title: string
  year: number
  overview: string
  poster: string
  director: string
  writers: string[]
  composer?: string
  cast: Array<{ name: string; character: string }>
  genres: string[]
  distributor: string
  runtime: number | null
  rated: string | null
  releaseDate: string
  imdbId: string
  imdbUrl: string
  officialWebsite: string
  mediaType: 'movie' | 'tv'
}> = {
  'the moment': {
    id: 99990001,
    title: 'The Moment',
    year: 2026,
    overview: 'A flashy, tongue-in-cheek hyper-pop mockumentary following a rising pop star as she navigates the complexities of fame and industry pressure while preparing for her arena tour debut.',
    poster: 'https://m.media-amazon.com/images/M/MV5BZjUzMzU3NzgtMWVkYi00NzM2LTk0OTctMDFmMGY2YWRiNmE3XkEyXkFqcGc@._V1_.jpg',
    director: 'Aidan Zamiri',
    writers: ['Aidan Zamiri', 'Bertie Brandes'],
    composer: 'A.G. Cook',
    cast: [
      { name: 'Charli xcx', character: 'Herself' },
      { name: 'Alexander Skarsgård', character: '' },
      { name: 'Rachel Sennott', character: '' },
      { name: 'Rosanna Arquette', character: '' },
      { name: 'Kate Berlant', character: '' },
      { name: 'Jamie Demetriou', character: '' },
      { name: 'Kylie Jenner', character: '' },
    ],
    genres: ['Documentary', 'Drama', 'Thriller'],
    distributor: 'A24',
    runtime: 103,
    rated: 'R',
    releaseDate: '2026-01-30',
    imdbId: 'tt35524793',
    imdbUrl: 'https://www.imdb.com/title/tt35524793/',
    officialWebsite: 'https://a24films.com/films/the-moment',
    mediaType: 'movie',
  },
  'undertone': {
    id: 99990002,
    title: 'Undertone',
    year: 2026,
    overview: "The host of an 'all-things-creepy' podcast moves into her dying mother's house to be her primary caregiver. When her podcast is sent 10 audio recordings of a young pregnant couple experiencing paranormal noises, she realizes the woman's story is a mirror of her own and each new recording scratches at her sanity, drawing her into a fate she cannot escape.",
    poster: 'https://m.media-amazon.com/images/M/MV5BYWU3YWE3ZWQtODZjNS00ZTdmLWFjNzUtOTUxNjY0MTNhNjhlXkEyXkFqcGc@._V1_.jpg',
    director: 'Ian Tuason',
    writers: ['Ian Tuason'],
    cast: [
      { name: 'Nina Kiri', character: 'Evy' },
      { name: 'Kris Holden-Ried', character: '' },
      { name: 'Michèle Duquet', character: '' },
      { name: 'Keana Lyn Bastidas', character: '' },
    ],
    genres: ['Horror', 'Sci-Fi', 'Thriller'],
    distributor: 'A24',
    runtime: null,
    rated: null,
    releaseDate: '2026-03-13',
    imdbId: 'tt35892608',
    imdbUrl: 'https://www.imdb.com/title/tt35892608/',
    officialWebsite: 'https://a24films.com/films/undertone',
    mediaType: 'movie',
  },
}

// Check if a title matches a hardcoded unreleased film
function getHardcodedMovie(title: string): typeof HARDCODED_MOVIES[string] | null {
  const titleLower = title.toLowerCase().trim()

  // Direct match
  if (HARDCODED_MOVIES[titleLower]) {
    return HARDCODED_MOVIES[titleLower]
  }

  // Partial match - check if title contains or is contained by hardcoded title
  for (const [key, movie] of Object.entries(HARDCODED_MOVIES)) {
    if (titleLower.includes(key) || key.includes(titleLower)) {
      return movie
    }
  }

  return null
}

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

    // Check if this looks like a movie/TV/documentary and try to fetch TMDB data
    const trailerInfo = detectMediaContent(metadata.title || '', metadata.description || '')

    // Always include detection info so frontend can show confirmation if needed
    metadata.detectionInfo = {
      isTrailer: trailerInfo.isTrailer,
      isDocumentary: trailerInfo.isDocumentary,
      isFilm: trailerInfo.isFilm,
      needsConfirmation: trailerInfo.needsConfirmation,
      confidence: trailerInfo.confidence,
      clues: trailerInfo.clues,
      suggestedTitle: trailerInfo.mediaTitle,
      suggestedYear: trailerInfo.year,
      suggestedType: trailerInfo.isDocumentary ? 'movie' : trailerInfo.mediaType,
    }

    if ((trailerInfo.isTrailer || trailerInfo.isDocumentary || trailerInfo.isFilm) && trailerInfo.mediaTitle) {
      // CHECK FOR HARDCODED UNRELEASED FILMS FIRST
      // These films aren't in TMDB yet, so TMDB/OMDB would return wrong data
      const hardcodedMovie = getHardcodedMovie(trailerInfo.mediaTitle)

      if (hardcodedMovie) {
        // Use hardcoded data for unreleased films - no TMDB/OMDB lookup
        console.log('Using hardcoded data for unreleased film:', hardcodedMovie.title)
        metadata.isTrailer = true
        metadata.detectedMediaType = hardcodedMovie.mediaType
        metadata.tmdbId = hardcodedMovie.id
        metadata.mediaTitle = hardcodedMovie.title
        metadata.mediaYear = hardcodedMovie.year
        metadata.director = hardcodedMovie.director
        metadata.directors = [hardcodedMovie.director]
        metadata.composer = hardcodedMovie.composer
        metadata.writers = hardcodedMovie.writers
        metadata.cast = hardcodedMovie.cast
        metadata.genres = hardcodedMovie.genres
        metadata.overview = hardcodedMovie.overview
        metadata.poster = hardcodedMovie.poster
        metadata.runtime = hardcodedMovie.runtime || undefined
        metadata.rated = hardcodedMovie.rated || undefined
        metadata.trailerVideoId = videoId
        metadata.imdbUrl = hardcodedMovie.imdbUrl
        // Release info for upcoming films
        ;(metadata as any).releaseDate = hardcodedMovie.releaseDate
        ;(metadata as any).distributor = hardcodedMovie.distributor
        ;(metadata as any).officialWebsite = hardcodedMovie.officialWebsite
        ;(metadata as any).imdbId = hardcodedMovie.imdbId
        // Critic site URLs - keep these so users can click through even without scores
        const titleSlug = hardcodedMovie.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
        const rtSlug = hardcodedMovie.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_')
        metadata.metacriticUrl = `https://www.metacritic.com/movie/${titleSlug}`
        metadata.rottenTomatoesUrl = `https://www.rottentomatoes.com/m/${rtSlug}`
        // No scores yet for unreleased films
        metadata.metacriticScore = undefined
        metadata.rottenTomatoesScore = undefined
        metadata.imdbRating = undefined
        // Update detection info to show no confirmation needed
        metadata.detectionInfo = {
          ...metadata.detectionInfo!,
          needsConfirmation: false,
          confidence: 'high',
        }
      } else {
        // Normal flow - fetch from TMDB
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
          metadata.backdrop = tmdbData.backdrop
          metadata.runtime = tmdbData.runtime
          metadata.trailerVideoId = videoId  // Keep the YouTube trailer from user input
          // TMDB videos and images
          metadata.videos = tmdbData.videos
          metadata.images = tmdbData.images
          // If TMDB has a trailer and user didn't provide one, use TMDB's trailer
          if (tmdbData.trailerKey && !videoId) {
            metadata.trailerVideoId = tmdbData.trailerKey
          }
          // TMDB rating
          metadata.tmdbRating = tmdbData.tmdbRating
          metadata.tmdbVoteCount = tmdbData.tmdbVoteCount
          // External review site links
          metadata.metacriticUrl = tmdbData.metacriticUrl
          metadata.rottenTomatoesUrl = tmdbData.rottenTomatoesUrl
          metadata.imdbUrl = tmdbData.imdbUrl

          // Fetch critic scores from OMDB (most reliable source) - use IMDB ID when available
          const omdbData = await fetchOMDBData(tmdbData.title, tmdbData.year, tmdbData.imdbId)

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
            // Use the scraped URL since it's the one that actually worked
            metadata.metacriticUrl = metacriticData.url
          }

          if (rottenTomatoesData && !metadata.rottenTomatoesScore) {
            metadata.rottenTomatoesScore = rottenTomatoesData.tomatometer
            metadata.rottenTomatoesData = rottenTomatoesData
            // Use the scraped URL since it's the one that actually worked
            metadata.rottenTomatoesUrl = rottenTomatoesData.url
          }
        }

        // Fetch full IMDB data for box office (domestic + worldwide) and awards
        if (tmdbData.imdbId) {
          const fullImdbData = await fetchFullIMDBData(tmdbData.imdbId)
          if (fullImdbData) {
            if (fullImdbData.imdbRating) metadata.imdbRating = fullImdbData.imdbRating
            if (fullImdbData.voteCount) metadata.imdbVotes = fullImdbData.voteCount.toLocaleString()
            if (fullImdbData.boxOffice) metadata.boxOffice = fullImdbData.boxOffice
            if (fullImdbData.boxOfficeDetails) metadata.boxOfficeDetails = fullImdbData.boxOfficeDetails
            if (fullImdbData.budget) metadata.budget = fullImdbData.budget
            if (fullImdbData.awards) metadata.awards = fullImdbData.awards
            if (fullImdbData.awardsDetails) metadata.awardsDetails = fullImdbData.awardsDetails
          }
        }

        // Set distributor from TMDB if detected
        if (tmdbData.distributor) {
          metadata.distributor = tmdbData.distributor
        }

        // Detect A24 from multiple sources:
        // 1. TMDB production companies
        // 2. OMDB production field
        // 3. YouTube video title (e.g., "Lady Bird | Official Trailer HD | A24")
        // 4. YouTube channel name
        const isA24 =
          tmdbData.distributor === 'A24' ||
          metadata.production === 'A24' ||
          (metadata.title && /\|\s*A24\s*$/i.test(metadata.title)) ||
          (metadata.author && metadata.author === 'A24')

        console.log('A24 Detection:', {
          tmdbDistributor: tmdbData.distributor,
          omdbProduction: metadata.production,
          youtubeTitle: metadata.title,
          youtubeChannel: metadata.author,
          isA24
        })

        if (isA24) {
          const titleSlug = tmdbData.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
          const a24Url = `https://a24films.com/films/${titleSlug}`
          console.log('Setting A24 official website:', a24Url)
          metadata.officialWebsite = a24Url
          metadata.distributor = 'A24'
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

// Detect if this is a movie/TV/documentary and extract the title
// Now checks both title AND description for clues
function detectMediaContent(title: string, description: string): {
  isTrailer: boolean
  isDocumentary: boolean
  isFilm: boolean
  needsConfirmation: boolean
  mediaTitle?: string
  year?: number
  mediaType?: 'movie' | 'tv'
  confidence: 'high' | 'medium' | 'low'
  clues: string[]
} {
  const titleLower = title.toLowerCase()
  const descLower = description.toLowerCase()
  const combined = titleLower + ' ' + descLower
  const clues: string[] = []

  // Common trailer patterns (high confidence)
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

  // Documentary indicators
  const documentaryPatterns = [
    /documentary/i,
    /docuseries/i,
    /docu-series/i,
    /true story/i,
    /real story/i,
  ]

  // Film/movie indicators (medium confidence)
  const filmPatterns = [
    /world\s+premiere/i,
    /film\s+premiere/i,
    /movie\s+premiere/i,
    /coming\s+to\s+theaters/i,
    /in\s+theaters/i,
    /in\s+cinemas/i,
    /feature\s+film/i,
    /motion\s+picture/i,
    /directed\s+by/i,
    /starring/i,
    /a\s+film\s+by/i,
    /produced\s+by/i,
    /from\s+the\s+director/i,
    /academy\s+award/i,
    /oscar/i,
    /sundance/i,
    /cannes/i,
    /tribeca/i,
    /film\s+festival/i,
    /netflix\s+film/i,
    /amazon\s+original/i,
    /hbo\s+original/i,
    /apple\s+original/i,
    /hulu\s+original/i,
  ]

  const isTrailer = trailerPatterns.some(pattern => pattern.test(titleLower))
  const isDocumentary = documentaryPatterns.some(pattern => {
    if (pattern.test(combined)) {
      clues.push(`Found "${pattern.source}" in content`)
      return true
    }
    return false
  })
  const isFilm = filmPatterns.some(pattern => {
    if (pattern.test(combined)) {
      clues.push(`Found "${pattern.source}" in content`)
      return true
    }
    return false
  })

  // If nothing detected, return early
  if (!isTrailer && !isDocumentary && !isFilm) {
    return {
      isTrailer: false,
      isDocumentary: false,
      isFilm: false,
      needsConfirmation: false,
      confidence: 'low',
      clues: []
    }
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (isTrailer) {
    confidence = 'high'
    clues.push('Contains trailer keywords')
  } else if (isDocumentary) {
    confidence = 'high'
    clues.push('Identified as documentary')
  } else if (isFilm && clues.length >= 2) {
    confidence = 'medium'
  } else if (isFilm) {
    confidence = 'low'
  }

  // Extract the movie/show title by removing common suffixes
  let mediaTitle = title

  console.log('Title extraction - Original title:', title)

  // First, check if title is in quotes - extract just the quoted part
  // Handle both straight quotes ('") and smart/curly quotes (''""）
  const quotedMatch = title.match(/['''""]([^''""\u2018\u2019\u201C\u201D]+)['''""]/)
  if (quotedMatch) {
    mediaTitle = quotedMatch[1]
    console.log('Title extraction - Found quoted title:', mediaTitle)
  } else {
    // Remove common suffixes and trailer text
    mediaTitle = title
      .replace(/\s*[\|\-–:]\s*(exclusive\s+)?(first\s+)?(look|preview|clip|sneak\s+peek).*$/i, '')
      .replace(/\s*[\|\-–:]\s*(world\s+)?(film\s+)?(premiere).*$/i, '')
      // Handle "| Official US Trailer", "| Official Trailer", "| Trailer", etc.
      .replace(/\s*[\|\-–][^|\-–]*Trailer.*$/i, '')
      .replace(/\s*Official\s+.*Trailer.*$/i, '')
      .replace(/\s*Trailer\s*\d*.*$/i, '')
      .replace(/\s*\(Official\).*$/i, '')
      .replace(/\s*[\|\-–]\s*Documentary.*$/i, '')
      .replace(/\s*HD\s*$/i, '')
      .replace(/\s*4K\s*$/i, '')
      .replace(/\s*\(\d{4}\)\s*$/i, '') // Remove trailing year like (2018)
      .replace(/\s*[\|\-–:]\s*$/, '') // Remove trailing separators
      .trim()
  }

  // Clean up any remaining quotes and punctuation (voice-to-text often adds periods)
  mediaTitle = mediaTitle
    .replace(/^['''""\s]+|['''""\s]+$/g, '')  // Remove quotes from start/end
    .replace(/^[.,!?;:\s]+|[.,!?;:\s]+$/g, '') // Remove punctuation from start/end
    .trim()

  console.log('Title extraction - Final cleaned title:', mediaTitle)

  // Try to extract year from the title or description
  const yearMatch = mediaTitle.match(/\((\d{4})\)/) || description.match(/\((\d{4})\)/) || description.match(/(\d{4})\s*(film|movie|documentary)/i)
  let year: number | undefined
  if (yearMatch) {
    year = parseInt(yearMatch[1])
    mediaTitle = mediaTitle.replace(/\s*\(\d{4}\)/, '').trim()
  }

  // Check if it might be a TV show
  const tvIndicators = ['season', 'series', 'episode', 's0', 's1', 's2', 'miniseries', 'mini-series']
  const mediaType = tvIndicators.some(ind => combined.includes(ind)) ? 'tv' : 'movie'

  // Need confirmation if confidence is not high
  const needsConfirmation = confidence !== 'high'

  return {
    isTrailer,
    isDocumentary,
    isFilm,
    needsConfirmation,
    mediaTitle,
    year,
    mediaType,
    confidence,
    clues
  }
}

// Legacy function name for compatibility
function detectTrailer(title: string): { isTrailer: boolean; mediaTitle?: string; year?: number; mediaType?: 'movie' | 'tv' } {
  const result = detectMediaContent(title, '')
  return {
    isTrailer: result.isTrailer,
    mediaTitle: result.mediaTitle,
    year: result.year,
    mediaType: result.mediaType
  }
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
  imdbId?: string
  distributor?: string
  productionCompanies?: string[]
} | null> {
  try {
    // Clean up title - remove brackets, extra info, quotes, punctuation
    const cleanTitle = title
      .replace(/\[.*?\]/g, '')  // Remove [anything]
      .replace(/\(.*?\)/g, '')  // Remove (anything)
      .replace(/[''""'"]/g, '') // Remove all quotes
      .replace(/:\s*exclusive.*$/i, '') // Remove ": exclusive..." suffix
      .replace(/:\s*official.*$/i, '')  // Remove ": official..." suffix
      .replace(/:\s*first\s+look.*$/i, '') // Remove ": first look..." suffix
      .replace(/[.,!?;:]+$/g, '') // Remove trailing punctuation
      .trim()

    console.log('TMDB search - Clean title:', cleanTitle)

    // SMART SEARCH: Try multiple strategies
    let result = null

    // Strategy 1: Exact search with year
    if (!result) {
      const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}${year ? `&year=${year}` : ''}`
      const searchResponse = await fetch(searchUrl)
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        result = searchData.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
        if (result) console.log('TMDB found with exact search:', result.title || result.name)
      }
    }

    // Strategy 2: Search without year
    if (!result && year) {
      console.log('Trying without year...')
      const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`
      const searchResponse = await fetch(searchUrl)
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        result = searchData.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
        if (result) console.log('TMDB found without year:', result.title || result.name)
      }
    }

    // Strategy 3: Try removing common words and searching key terms
    if (!result) {
      const keyWords = cleanTitle
        .replace(/\b(the|a|an|of|and|in|on|at|to|for|with|by)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (keyWords !== cleanTitle && keyWords.length > 3) {
        console.log('Trying key words:', keyWords)
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(keyWords)}`
        const searchResponse = await fetch(searchUrl)
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          result = searchData.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
          if (result) console.log('TMDB found with key words:', result.title || result.name)
        }
      }
    }

    // Strategy 4: Try first few significant words only
    if (!result) {
      const words = cleanTitle.split(/\s+/).filter(w => w.length > 2)
      if (words.length > 2) {
        const shortTitle = words.slice(0, 3).join(' ')
        console.log('Trying short title:', shortTitle)
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(shortTitle)}`
        const searchResponse = await fetch(searchUrl)
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          // For partial matches, check if original title contains result title or vice versa
          result = searchData.results?.find((r: any) => {
            if (r.media_type !== 'movie' && r.media_type !== 'tv') return false
            const resultTitle = (r.title || r.name || '').toLowerCase()
            const originalLower = cleanTitle.toLowerCase()
            return resultTitle.includes(originalLower) || originalLower.includes(resultTitle)
          })
          if (result) console.log('TMDB found with short title:', result.title || result.name)
        }
      }
    }

    // Strategy 5: Try with normalized accents (Sirât → Sirat)
    if (!result) {
      const normalizedTitle = cleanTitle.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (normalizedTitle !== cleanTitle) {
        console.log('Trying normalized accents:', normalizedTitle)
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(normalizedTitle)}`
        const searchResponse = await fetch(searchUrl)
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          result = searchData.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
          if (result) console.log('TMDB found with normalized accents:', result.title || result.name)
        }
      }
    }

    if (!result) {
      console.log('No TMDB result found for:', cleanTitle)
      return null
    }

    const mediaType = result.media_type as 'movie' | 'tv'
    const tmdbId = result.id

    // Fetch detailed info with credits, videos, and images
    const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,images`
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

    // Extract videos (trailers, clips, featurettes, etc.)
    const videos = details.videos?.results?.map((v: any) => ({
      id: v.id,
      key: v.key,
      name: v.name,
      site: v.site,
      type: v.type, // Trailer, Teaser, Clip, Featurette, etc.
      official: v.official,
    })) || []

    // Extract images (backdrops, posters, stills)
    const images = {
      backdrops: details.images?.backdrops?.slice(0, 10).map((img: any) => ({
        path: `https://image.tmdb.org/t/p/w1280${img.file_path}`,
        width: img.width,
        height: img.height,
      })) || [],
      posters: details.images?.posters?.slice(0, 5).map((img: any) => ({
        path: `https://image.tmdb.org/t/p/w500${img.file_path}`,
        width: img.width,
        height: img.height,
      })) || [],
      stills: details.images?.stills?.slice(0, 10).map((img: any) => ({
        path: `https://image.tmdb.org/t/p/w780${img.file_path}`,
        width: img.width,
        height: img.height,
      })) || [],
    }

    // Get official trailer URL
    const officialTrailer = details.videos?.results?.find(
      (v: any) => v.type === 'Trailer' && v.site === 'YouTube' && v.official
    ) || details.videos?.results?.find(
      (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
    )

    // Extract production companies and detect distributor
    const productionCompanies = details.production_companies?.map((c: any) => c.name) || []
    console.log('TMDB production companies:', productionCompanies)
    // Check for major distributors/studios
    let distributor: string | undefined
    if (productionCompanies.some((c: string) => c === 'A24')) {
      distributor = 'A24'
    } else if (productionCompanies.some((c: string) => c.includes('Searchlight'))) {
      distributor = 'Searchlight Pictures'
    } else if (productionCompanies.some((c: string) => c.includes('Focus Features'))) {
      distributor = 'Focus Features'
    } else if (productionCompanies.some((c: string) => c.includes('NEON'))) {
      distributor = 'NEON'
    }

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
      backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : undefined,
      runtime: details.runtime,
      // Videos from TMDB
      videos,
      trailerKey: officialTrailer?.key,
      trailerUrl: officialTrailer ? `https://www.youtube.com/embed/${officialTrailer.key}` : undefined,
      // Images from TMDB
      images,
      // TMDB ratings
      tmdbRating: details.vote_average ? Math.round(details.vote_average * 10) : undefined, // Convert to 0-100
      tmdbVoteCount: details.vote_count,
      // External review sites - URLs for linking out
      metacriticUrl: `https://www.metacritic.com/${mediaType}/${titleForUrl}`,
      rottenTomatoesUrl: `https://www.rottentomatoes.com/${mediaType === 'movie' ? 'm' : 'tv'}/${rtTitleForUrl}`,
      imdbUrl: details.imdb_id ? `https://www.imdb.com/title/${details.imdb_id}` : undefined,
      // IMDB ID for reliable OMDB lookups
      imdbId: details.imdb_id,
      // Production companies and distributor
      distributor,
      productionCompanies,
    }
  } catch (error) {
    console.error('TMDB fetch error:', error)
    return null
  }
}

// Fetch rich metadata from OMDB API
async function fetchOMDBData(title: string, year: number, imdbId?: string): Promise<{
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
    // Prefer IMDB ID lookup (most reliable) over title search
    const url = imdbId
      ? `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}&plot=full`
      : `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&type=movie&plot=full`
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

// Fetch IMDB data directly when OMDB fails - scrapes the JSON-LD structured data
async function fetchIMDBData(imdbId: string): Promise<{
  imdbRating?: string
  imdbVotes?: string
  genres?: string[]
  runtime?: string
  description?: string
} | null> {
  if (!imdbId) return null

  try {
    const url = `https://www.imdb.com/title/${imdbId}/`
    console.log('Fetching IMDB directly:', url)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!response.ok) {
      console.log('IMDB fetch failed:', response.status)
      return null
    }

    const html = await response.text()

    // Extract JSON-LD structured data - most reliable source
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(\{[\s\S]*?"@type"\s*:\s*"Movie"[\s\S]*?\})<\/script>/)
    if (!jsonLdMatch) {
      // Try alternative pattern
      const altMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
      if (altMatch) {
        try {
          const data = JSON.parse(altMatch[1])
          if (data.aggregateRating) {
            const rating = data.aggregateRating.ratingValue
            const votes = data.aggregateRating.ratingCount
            console.log(`IMDB direct found: rating=${rating}, votes=${votes}`)
            return {
              imdbRating: rating ? String(rating) : undefined,
              imdbVotes: votes ? String(votes) : undefined,
              genres: data.genre,
              description: data.description,
            }
          }
        } catch (e) {
          // Continue to other methods
        }
      }
    } else {
      try {
        const data = JSON.parse(jsonLdMatch[1])
        if (data.aggregateRating) {
          const rating = data.aggregateRating.ratingValue
          const votes = data.aggregateRating.ratingCount
          console.log(`IMDB direct found: rating=${rating}, votes=${votes}`)
          return {
            imdbRating: rating ? String(rating) : undefined,
            imdbVotes: votes ? String(votes) : undefined,
            genres: data.genre,
            runtime: data.duration,
            description: data.description,
          }
        }
      } catch (e) {
        console.error('Failed to parse IMDB JSON-LD:', e)
      }
    }

    // Fallback: try to extract from og:title which often has rating
    const ogTitleMatch = html.match(/og:title[^>]*content="[^"]*⭐\s*([\d.]+)/)
    if (ogTitleMatch) {
      console.log(`IMDB from og:title: rating=${ogTitleMatch[1]}`)
      return {
        imdbRating: ogTitleMatch[1],
      }
    }

    console.log('No IMDB rating found in page')
    return null
  } catch (error) {
    console.error('IMDB fetch error:', error)
    return null
  }
}

// Fetch full IMDB data including box office (domestic + worldwide) and awards
async function fetchFullIMDBData(imdbId: string): Promise<{
  imdbRating?: string
  voteCount?: number
  budget?: string
  boxOffice?: string
  boxOfficeDetails?: {
    domestic?: number
    worldwide?: number
    openingWeekend?: number
  }
  awards?: string
  awardsDetails?: {
    wins: number
    nominations: number
  }
} | null> {
  if (!imdbId) return null

  try {
    const imdbUrl = `https://www.imdb.com/title/${imdbId}/`
    console.log('Fetching full IMDB data:', imdbUrl)

    const response = await fetch(imdbUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log('IMDB fetch failed:', response.status)
      return null
    }

    const html = await response.text()

    // Extract __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/__NEXT_DATA__[^{]*({[\s\S]*?})\s*<\/script>/)
    if (!nextDataMatch) {
      console.log('Could not find IMDB __NEXT_DATA__')
      return null
    }

    let nextData
    try {
      nextData = JSON.parse(nextDataMatch[1])
    } catch (e) {
      console.log('Failed to parse IMDB JSON data')
      return null
    }

    const props = nextData?.props?.pageProps || {}
    const mainData = props.mainColumnData || {}
    const aboveData = props.aboveTheFoldData || {}

    // Extract rating
    const ratingData = mainData.ratingsSummary || aboveData.ratingsSummary || {}
    const imdbRating = ratingData.aggregateRating
    const voteCount = ratingData.voteCount

    // Extract box office
    const budget = mainData.productionBudget?.budget?.amount
    const lifetimeGross = mainData.lifetimeGross?.total?.amount // US & Canada
    const worldwideGross = mainData.worldwideGross?.total?.amount
    const openingWeekend = mainData.openingWeekendGross?.gross?.total?.amount

    // Extract awards count
    const wins = mainData.wins?.total || 0
    const nominations = mainData.nominationsExcludeWins?.total || 0

    // Format box office as string with both domestic and worldwide
    let boxOfficeStr = ''
    if (lifetimeGross && worldwideGross) {
      boxOfficeStr = `$${lifetimeGross.toLocaleString()} (US & Canada) / $${worldwideGross.toLocaleString()} (Worldwide)`
    } else if (worldwideGross) {
      boxOfficeStr = `$${worldwideGross.toLocaleString()} (Worldwide)`
    } else if (lifetimeGross) {
      boxOfficeStr = `$${lifetimeGross.toLocaleString()} (US & Canada)`
    }

    // Format awards string
    let awardsStr = ''
    if (wins > 0 && nominations > 0) {
      awardsStr = `${wins} wins & ${nominations} nominations`
    } else if (wins > 0) {
      awardsStr = `${wins} wins`
    } else if (nominations > 0) {
      awardsStr = `${nominations} nominations`
    }

    const result = {
      imdbRating: imdbRating ? Number(imdbRating).toFixed(1) : undefined,
      voteCount,
      budget: budget ? `$${budget.toLocaleString()}` : undefined,
      boxOffice: boxOfficeStr || undefined,
      boxOfficeDetails: {
        domestic: lifetimeGross,
        worldwide: worldwideGross,
        openingWeekend,
      },
      awards: awardsStr || undefined,
      awardsDetails: {
        wins,
        nominations,
      },
    }

    console.log('Full IMDB data fetched:', result)
    return result
  } catch (error) {
    console.error('Full IMDB fetch error:', error)
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
    backdrop?: string
    runtime?: number
    trailerVideoId?: string
    // TMDB videos and images
    videos?: Array<{
      id: string
      key: string
      name: string
      site: string
      type: string
      official: boolean
    }>
    images?: {
      backdrops: Array<{ path: string; width: number; height: number }>
      posters: Array<{ path: string; width: number; height: number }>
      stills: Array<{ path: string; width: number; height: number }>
    }
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
    // Detection info for confirmation prompts
    detectionInfo?: {
      isTrailer: boolean
      isDocumentary: boolean
      isFilm: boolean
      needsConfirmation: boolean
      confidence: 'high' | 'medium' | 'low'
      clues: string[]
      suggestedTitle?: string
      suggestedYear?: number
      suggestedType?: 'movie' | 'tv'
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

// Fetch Metacritic data - try direct URL first, then search
async function fetchMetacriticData(title: string, year: number, mediaType: string): Promise<{
  score: number
  criticReviews?: number
  userScore?: number
  summary?: string
  url: string
  topReviews?: Array<{ critic: string; outlet: string; quote: string; score?: number }>
} | null> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  }

  try {
    // Build URL slug - handle em-dashes (—) which become --- in Metacritic URLs
    const slug = title
      .toLowerCase()
      .replace(/\s*[—–]\s*/g, '---')  // Em-dash/en-dash with surrounding spaces → triple dash
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-|-$/g, '')

    // Try direct URL first
    const directUrl = `https://www.metacritic.com/${mediaType}/${slug}`
    console.log('Trying Metacritic direct URL:', directUrl)

    let response = await fetch(directUrl, { headers })
    let successUrl = directUrl

    // If direct URL fails, try search
    if (!response.ok) {
      console.log('Direct URL failed, trying search...')
      const searchUrl = `https://www.metacritic.com/search/${encodeURIComponent(title)}/?page=1&category=${mediaType}`
      const searchResponse = await fetch(searchUrl, { headers })

      if (!searchResponse.ok) {
        console.log('Metacritic search failed:', searchResponse.status)
        return null
      }

      const searchHtml = await searchResponse.text()

      // Extract search results with titles to find best match
      const resultPattern = /<a[^>]*href="(\/movie\/[^"]+)"[^>]*>([^<]*)</g
      const searchTitleLower = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
      const searchWords = searchTitleLower.split(/\s+/).filter(w => w.length > 2)

      let bestMatch: { path: string; title: string; score: number } | null = null
      let match

      while ((match = resultPattern.exec(searchHtml)) !== null) {
        const [, path, resultTitle] = match
        const resultTitleLower = resultTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
        const resultWords = resultTitleLower.split(/\s+/).filter(w => w.length > 2)
        const matchingWords = searchWords.filter(w => resultWords.includes(w))
        const matchScore = matchingWords.length / Math.max(searchWords.length, 1)

        console.log(`Metacritic result: "${resultTitle}" score: ${matchScore.toFixed(2)}`)

        if (matchScore > 0.5 && (!bestMatch || matchScore > bestMatch.score)) {
          bestMatch = { path, title: resultTitle, score: matchScore }
        }
      }

      if (!bestMatch) {
        console.log('No matching Metacritic result for:', title)
        return null
      }

      successUrl = `https://www.metacritic.com${bestMatch.path}`
      console.log('Best Metacritic match:', bestMatch.title, 'at', successUrl)
      response = await fetch(successUrl, { headers })

      if (!response.ok) {
        console.log('Metacritic movie page fetch failed:', response.status)
        return null
      }
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
      url: successUrl,
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
