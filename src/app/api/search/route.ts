import { NextRequest, NextResponse } from 'next/server'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_API_KEY = process.env.TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d'
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'a053b065'

interface TMDBMovieResult {
  id: number
  title: string
  release_date: string
  overview: string
  poster_path: string | null
}

interface TMDBTVResult {
  id: number
  name: string
  first_air_date: string
  overview: string
  poster_path: string | null
}

interface TMDBCredits {
  crew: Array<{ job: string; name: string; department: string }>
  cast: Array<{ name: string; order: number; character: string }>
}

// Clean search query - remove punctuation, extra spaces, normalize
function cleanSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[.,!?;:''""'"()[\]{}]+$/g, '') // Remove trailing punctuation (including smart quotes)
    .replace(/^[.,!?;:''""'"()[\]{}]+/g, '') // Remove leading punctuation (including smart quotes)
    .replace(/\s+/g, ' ')                     // Normalize multiple spaces
    .trim()
}

// Hardcoded movies for films not yet in TMDB (upcoming releases, etc.)
// These are checked FIRST before TMDB search to ensure we have correct metadata
const HARDCODED_MOVIES = [
  {
    id: 99990001,
    title: 'The Moment',
    year: 2026,
    overview: 'A flashy, tongue-in-cheek hyper-pop mockumentary following a rising pop star as she navigates the complexities of fame and industry pressure while preparing for her arena tour debut.',
    posterUrl: 'https://m.media-amazon.com/images/M/MV5BZjUzMzU3NzgtMWVkYi00NzM2LTk0OTctMDFmMGY2YWRiNmE3XkEyXkFqcGc@._V1_.jpg',
    director: 'Aidan Zamiri',
    writers: ['Aidan Zamiri', 'Bertie Brandes'],
    composer: 'A.G. Cook',
    starring: ['Charli xcx', 'Alexander Skarsgård', 'Rachel Sennott', 'Rosanna Arquette', 'Kate Berlant', 'Jamie Demetriou', 'Arielle Dombasle', 'Hailey Benton Gates', 'Kylie Jenner', 'Trew Mullen', 'Mel Ottenberg', 'Isaac Powell', 'Rish Shah', 'Michael Workéyè', 'Shygirl', 'A. G. Cook'],
    genres: ['Documentary', 'Drama', 'Thriller'],
    distributor: 'A24',
    runtime: 103,
    rated: 'R',
    trailerUrl: 'https://www.youtube.com/watch?v=Pxqhi7Sgvu8',
    trailerVideoId: 'Pxqhi7Sgvu8',
    releaseDate: '2026-01-30',
    imdbId: 'tt35524793',
    imdbUrl: 'https://www.imdb.com/title/tt35524793/',
    officialWebsite: 'https://a24films.com/films/the-moment',
    metacriticScore: null,
    rottenTomatoesScore: null,
    type: 'movie',
    mediaType: 'movie',
    // Additional videos from YouTube
    videos: [
      { key: 'Pxqhi7Sgvu8', name: 'Official Trailer', type: 'Trailer' },
      { key: 'dread-video-id', name: 'Dread - A.G. Cook (From The Moment Soundtrack)', type: 'Soundtrack' }
    ],
    // Scene images from IMDB
    images: [
      'https://m.media-amazon.com/images/M/MV5BZjUzMzU3NzgtMWVkYi00NzM2LTk0OTctMDFmMGY2YWRiNmE3XkEyXkFqcGc@._V1_.jpg'
    ]
  },
  {
    id: 99990002,
    title: 'Undertone',
    year: 2026,
    overview: "The host of an 'all-things-creepy' podcast moves into her dying mother's house to be her primary caregiver. When her podcast is sent 10 audio recordings of a young pregnant couple experiencing paranormal noises, she realizes the woman's story is a mirror of her own and each new recording scratches at her sanity, drawing her into a fate she cannot escape.",
    posterUrl: 'https://m.media-amazon.com/images/M/MV5BYWU3YWE3ZWQtODZjNS00ZTdmLWFjNzUtOTUxNjY0MTNhNjhlXkEyXkFqcGc@._V1_.jpg',
    director: 'Ian Tuason',
    writers: ['Ian Tuason'],
    starring: ['Nina Kiri', 'Kris Holden-Ried', 'Michèle Duquet', 'Keana Lyn Bastidas'],
    genres: ['Horror', 'Sci-Fi', 'Thriller'],
    distributor: 'A24',
    runtime: null,
    rated: null,
    trailerUrl: 'https://www.youtube.com/watch?v=j6uDeBYDHu4',
    trailerVideoId: 'j6uDeBYDHu4',
    releaseDate: '2026-03-13',
    imdbId: 'tt35892608',
    imdbUrl: 'https://www.imdb.com/title/tt35892608/',
    officialWebsite: 'https://a24films.com/films/undertone',
    metacriticScore: null,
    rottenTomatoesScore: null,
    type: 'movie',
    mediaType: 'movie',
    videos: [
      { key: 'j6uDeBYDHu4', name: 'Official Trailer', type: 'Trailer' },
      { key: 'iJ2tUNSGL7Y', name: 'Teaser', type: 'Teaser' }
    ],
    images: [
      'https://m.media-amazon.com/images/M/MV5BYWU3YWE3ZWQtODZjNS00ZTdmLWFjNzUtOTUxNjY0MTNhNjhlXkEyXkFqcGc@._V1_.jpg'
    ]
  }
]

// Check hardcoded movies first for exact/close matches
function getHardcodedMatches(query: string): any[] {
  const q = query.toLowerCase()
  return HARDCODED_MOVIES.filter(movie => {
    const titleLower = movie.title.toLowerCase()
    // Exact match or query is substantial part of title
    return titleLower === q ||
           titleLower.includes(q) ||
           q.includes(titleLower) ||
           // Check if all significant words match
           q.split(/\s+/).filter(w => w.length > 2).every(word => titleLower.includes(word))
  })
}

// Normalize accented characters (â → a, é → e, etc.) for fallback search
function normalizeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawQuery = searchParams.get('q')
  const requestedType = searchParams.get('type') || 'all' // Default to 'all' to search both movies and TV

  if (!rawQuery) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  // Clean the query for better matching
  const query = cleanSearchQuery(rawQuery)

  try {
    // Use multi-search to find both movies and TV shows, unless a specific type is requested
    let searchUrl: string
    let filterMediaType: string | null = null

    if (requestedType === 'movie') {
      searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
    } else if (requestedType === 'tv') {
      searchUrl = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
    } else {
      // Default: Use multi-search to find both movies and TV shows
      searchUrl = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
      filterMediaType = null // Accept both movie and tv
    }

    console.log('TMDB Search URL:', searchUrl.replace(TMDB_API_KEY, '***'))

    const response = await fetch(
      searchUrl,
      { next: { revalidate: 3600 } }
    )

    if (!response.ok) {
      console.error('TMDB API error:', response.status, response.statusText)
      throw new Error('TMDB API error')
    }

    let data = await response.json()

    // For multi-search, filter to only movie and tv results (exclude person results)
    let filteredResults = data.results || []
    if (requestedType === 'all') {
      filteredResults = filteredResults.filter((item: any) =>
        item.media_type === 'movie' || item.media_type === 'tv'
      )
    }

    console.log('TMDB search results count:', filteredResults.length, 'for query:', query)

    // If no results found, try with normalized accents (Sirât → Sirat)
    if (filteredResults.length === 0) {
      const normalizedQuery = normalizeAccents(query)
      if (normalizedQuery !== query) {
        console.log('Trying normalized search:', normalizedQuery)
        const normalizedUrl = searchUrl.replace(encodeURIComponent(query), encodeURIComponent(normalizedQuery))
        const normalizedResponse = await fetch(normalizedUrl, { next: { revalidate: 3600 } })
        if (normalizedResponse.ok) {
          const normalizedData = await normalizedResponse.json()
          filteredResults = normalizedData.results || []
          if (requestedType === 'all') {
            filteredResults = filteredResults.filter((item: any) =>
              item.media_type === 'movie' || item.media_type === 'tv'
            )
          }
          console.log('Normalized search results count:', filteredResults.length)
        }
      }
    }

    const results = await Promise.all(
      filteredResults.slice(0, 10).map(async (item: any) => {
        // Determine media type: for multi-search, use item.media_type; otherwise use requestedType
        const itemType = item.media_type || requestedType

        if (itemType === 'tv') {
          const credits = await fetchCredits(TMDB_API_KEY, item.id, 'tv')
          return {
            id: item.id,
            title: item.name || item.title,
            year: item.first_air_date ? parseInt(item.first_air_date.substring(0, 4)) : null,
            overview: item.overview,
            posterUrl: item.poster_path
              ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
              : null,
            director: credits.creator,
            starring: credits.cast.slice(0, 5),
            type: 'tv'
          }
        } else {
          const year = item.release_date ? parseInt(item.release_date.substring(0, 4)) : null
          const [credits, details, omdb] = await Promise.all([
            fetchCredits(TMDB_API_KEY, item.id, 'movie'),
            fetchMovieDetails(TMDB_API_KEY, item.id),
            fetchOMDBData(item.title, year)
          ])
          return {
            id: item.id,
            title: item.title,
            year,
            overview: item.overview,
            posterUrl: item.poster_path
              ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
              : null,
            posterPath: item.poster_path
              ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
              : null,
            director: credits.director,
            cinematographer: credits.cinematographer,
            composer: credits.composer,
            starring: credits.cast.slice(0, 5),
            distributor: details.distributor,
            runtime: details.runtime,
            trailerUrl: details.trailerUrl,
            imdbId: details.imdbId || omdb?.imdbId,
            // OMDB critic scores
            metacriticScore: omdb?.metacriticScore,
            rottenTomatoesScore: omdb?.rottenTomatoesScore,
            imdbRating: omdb?.imdbRating,
            imdbVotes: omdb?.imdbVotes,
            // OMDB rich metadata
            rated: omdb?.rated,
            awards: omdb?.awards,
            boxOffice: omdb?.boxOffice,
            plot: omdb?.plot,
            country: omdb?.country,
            language: omdb?.language,
            type: 'movie'
          }
        }
      })
    )

    // Check for hardcoded matches (for films not in TMDB like upcoming releases)
    const hardcodedMatches = getHardcodedMatches(query)

    // Filter out TMDB results that might conflict with hardcoded data
    // (e.g., wrong movie with similar name)
    const hardcodedTitles = new Set(hardcodedMatches.map(m => m.title.toLowerCase()))
    const filteredTmdbResults = results.filter(r =>
      !hardcodedTitles.has(r.title.toLowerCase())
    )

    // Prepend hardcoded matches to TMDB results
    const combinedResults = [...hardcodedMatches, ...filteredTmdbResults]

    return NextResponse.json({ results: combinedResults, mock: false })
  } catch (error) {
    console.error('TMDB search error:', error)
    return NextResponse.json({
      results: getMockResults(query, requestedType),
      mock: true,
      error: 'Failed to fetch from TMDB, using mock data'
    })
  }
}

async function fetchCredits(apiKey: string, id: number, type: string) {
  try {
    const endpoint = type === 'tv' ? `tv/${id}/credits` : `movie/${id}/credits`
    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}?api_key=${apiKey}`,
      { next: { revalidate: 86400 } }
    )

    if (!response.ok) {
      return { director: null, creator: null, cinematographer: null, composer: null, cast: [] }
    }

    const data: TMDBCredits = await response.json()

    const director = data.crew.find(c => c.job === 'Director')?.name || null
    const creator = data.crew.find(c => c.job === 'Creator')?.name ||
                   data.crew.find(c => c.job === 'Executive Producer')?.name || null
    const cinematographer = data.crew.find(c => c.job === 'Director of Photography')?.name || null
    const composer = data.crew.find(c => c.department === 'Sound' && c.job === 'Original Music Composer')?.name ||
                    data.crew.find(c => c.job === 'Music')?.name || null
    const cast = data.cast
      .sort((a, b) => a.order - b.order)
      .slice(0, 10)
      .map(c => c.name)

    return { director, creator, cinematographer, composer, cast }
  } catch {
    return { director: null, creator: null, cinematographer: null, composer: null, cast: [] }
  }
}

async function fetchMovieDetails(apiKey: string, id: number) {
  try {
    const [detailsRes, videosRes] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${apiKey}`, { next: { revalidate: 86400 } }),
      fetch(`${TMDB_BASE_URL}/movie/${id}/videos?api_key=${apiKey}`, { next: { revalidate: 86400 } })
    ])

    const details = await detailsRes.json()
    const videos = await videosRes.json()

    const trailer = videos.results?.find(
      (v: { type: string; site: string }) => v.type === 'Trailer' && v.site === 'YouTube'
    )

    return {
      runtime: details.runtime,
      imdbId: details.imdb_id,
      distributor: details.production_companies?.[0]?.name || null,
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null
    }
  } catch {
    return { runtime: null, imdbId: null, distributor: null, trailerUrl: null }
  }
}

// Fetch OMDB data for Metacritic, Rotten Tomatoes, IMDB scores and rich metadata
async function fetchOMDBData(title: string, year: number | null) {
  try {
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}${year ? `&y=${year}` : ''}&type=movie&plot=full`
    const response = await fetch(url, { next: { revalidate: 86400 } })

    if (!response.ok) return null

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
          rottenTomatoesScore = parseInt(rating.Value)
        }
      }
    }

    console.log(`OMDB found for "${title}": metacritic=${metacriticScore}, RT=${rottenTomatoesScore}, imdb=${data.imdbRating}`)

    return {
      metacriticScore,
      rottenTomatoesScore,
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
      imdbVotes: data.imdbVotes !== 'N/A' ? data.imdbVotes : undefined,
      imdbId: data.imdbID !== 'N/A' ? data.imdbID : undefined,
      rated: data.Rated !== 'N/A' ? data.Rated : undefined,
      plot: data.Plot !== 'N/A' ? data.Plot : undefined,
      awards: data.Awards !== 'N/A' ? data.Awards : undefined,
      boxOffice: data.BoxOffice !== 'N/A' ? data.BoxOffice : undefined,
      country: data.Country !== 'N/A' ? data.Country : undefined,
      language: data.Language !== 'N/A' ? data.Language : undefined,
    }
  } catch (error) {
    console.error('OMDB fetch error:', error)
    return null
  }
}

// Simple fuzzy match - checks if all words from query appear in target
function fuzzyMatch(target: string, query: string): boolean {
  const targetLower = target.toLowerCase()
  const queryLower = query.toLowerCase()

  // Direct substring match
  if (targetLower.includes(queryLower)) return true

  // Check if all query words appear in target (in any order)
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1)
  const allWordsMatch = queryWords.every(word => targetLower.includes(word))
  if (allWordsMatch && queryWords.length > 0) return true

  // Check if target words appear in query (for reverse matching)
  const targetWords = targetLower.split(/\s+/).filter(w => w.length > 2)
  const significantMatch = targetWords.filter(word => queryLower.includes(word)).length >= Math.ceil(targetWords.length * 0.6)
  if (significantMatch && targetWords.length > 0) return true

  return false
}

function getMockResults(query: string, type: string) {
  // Clean and normalize query
  const q = cleanSearchQuery(query).toLowerCase()

  if (type === 'tv') {
    const tvShows = [
      {
        id: 1,
        title: 'The Sopranos',
        year: 1999,
        overview: 'New Jersey mob boss Tony Soprano deals with personal and professional issues.',
        posterUrl: null,
        director: 'David Chase',
        starring: ['James Gandolfini', 'Edie Falco', 'Lorraine Bracco'],
        type: 'tv'
      },
      {
        id: 2,
        title: 'Breaking Bad',
        year: 2008,
        overview: 'A high school chemistry teacher turns to manufacturing methamphetamine.',
        posterUrl: null,
        director: 'Vince Gilligan',
        starring: ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn'],
        type: 'tv'
      },
      {
        id: 3,
        title: 'The Wire',
        year: 2002,
        overview: 'Baltimore drug scene, as seen through the eyes of drug dealers and law enforcement.',
        posterUrl: null,
        director: 'David Simon',
        starring: ['Dominic West', 'Idris Elba', 'Michael K. Williams'],
        type: 'tv'
      }
    ]
    return tvShows.filter(show => fuzzyMatch(show.title, q))
  }

  // Movies with rich metadata - include hardcoded movies at the top
  const movies = [
    ...HARDCODED_MOVIES,  // Include upcoming films not yet in TMDB
    {
      id: 30144839,
      title: 'One Battle After Another',
      year: 2025,
      overview: 'An ex-revolutionary is forced back into his former combative lifestyle when he and his daughter are pursued by a corrupt military officer.',
      posterUrl: null,
      director: 'Paul Thomas Anderson',
      cinematographer: 'Michael Bauman',
      composer: 'Jonny Greenwood',
      starring: ['Leonardo DiCaprio', 'Sean Penn', 'Benicio del Toro', 'Regina Hall', 'Teyana Taylor', 'Chase Infiniti', 'Alana Haim', 'Wood Harris', 'Denis Ménochet'],
      distributor: 'Warner Bros. Pictures',
      runtime: 148,
      trailerUrl: 'https://www.youtube.com/watch?v=Ap-j8e9J5U0',
      imdbId: 'tt30144839',
      metacriticUrl: 'https://www.metacritic.com/movie/one-battle-after-another',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/one_battle_after_another',
      metacriticScore: 96,
      rottenTomatoesScore: 98,
      metacriticData: {
        score: 96,
        criticReviews: 58,
        positiveCount: 56,
        mixedCount: 2,
        negativeCount: 0,
        consensus: 'Paul Thomas Anderson delivers another masterwork, blending visceral action with profound character study in ways that feel both timeless and urgently contemporary.',
        topReviews: [
          { critic: 'A.O. Scott', outlet: 'The New York Times', quote: 'A staggering achievement that redefines what action cinema can be.', score: 100 },
          { critic: 'Peter Bradshaw', outlet: 'The Guardian', quote: 'Anderson has crafted something genuinely new from familiar ingredients.', score: 100 },
          { critic: 'David Ehrlich', outlet: 'IndieWire', quote: 'The most vital American film in years.', score: 91 }
        ]
      },
      rottenTomatoesData: {
        tomatometer: 98,
        audienceScore: 94,
        criticReviews: 312,
        freshCount: 306,
        rottenCount: 6,
        consensus: 'One Battle After Another finds Paul Thomas Anderson in peak form, delivering a gripping action drama elevated by stunning performances and masterful craftsmanship.',
        topReviews: [
          { critic: 'David Sims', outlet: 'The Atlantic', quote: 'A film that earns every second of its runtime.', fresh: true },
          { critic: 'Stephanie Zacharek', outlet: 'Time', quote: 'DiCaprio gives the performance of his career.', fresh: true },
          { critic: 'Richard Brody', outlet: 'The New Yorker', quote: 'Ambitious and utterly absorbing.', fresh: true }
        ]
      },
      streamingOptions: [
        { service: 'HBO Max', url: 'https://play.max.com/movie/one-battle-after-another', type: 'stream' },
        { service: 'Fandango', url: 'https://www.fandango.com/one-battle-after-another', type: 'theater' }
      ],
      type: 'movie'
    },
    {
      id: 693134,
      title: 'Dune: Part Two',
      year: 2024,
      overview: 'Paul Atreides unites with Chani and the Fremen to seek revenge against the conspirators who destroyed his family.',
      posterUrl: null,
      director: 'Denis Villeneuve',
      cinematographer: 'Greig Fraser',
      composer: 'Hans Zimmer',
      starring: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson', 'Josh Brolin', 'Austin Butler'],
      distributor: 'Warner Bros. Pictures',
      runtime: 166,
      trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
      imdbId: 'tt15239678',
      metacriticUrl: 'https://www.metacritic.com/movie/dune-part-two',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/dune_part_two',
      metacriticScore: 79,
      rottenTomatoesScore: 92,
      type: 'movie'
    },
    {
      id: 1064028,
      title: 'Anora',
      year: 2024,
      overview: 'A young sex worker from Brooklyn gets her chance at a Cinderella story when she marries the son of a Russian oligarch.',
      posterUrl: null,
      director: 'Sean Baker',
      cinematographer: 'Drew Daniels',
      composer: null,
      starring: ['Mikey Madison', 'Mark Eydelshteyn', 'Yura Borisov', 'Karren Karagulian'],
      distributor: 'Neon',
      runtime: 139,
      trailerUrl: 'https://www.youtube.com/watch?v=8m6UrWMl18M',
      imdbId: 'tt28607951',
      metacriticUrl: 'https://www.metacritic.com/movie/anora',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/anora',
      metacriticScore: 90,
      rottenTomatoesScore: 93,
      type: 'movie'
    },
    {
      id: 933260,
      title: 'The Substance',
      year: 2024,
      overview: 'A fading celebrity decides to use a black market drug that temporarily creates a younger version of herself.',
      posterUrl: null,
      director: 'Coralie Fargeat',
      cinematographer: 'Benjamin Kracun',
      composer: 'Raffertie',
      starring: ['Demi Moore', 'Margaret Qualley', 'Dennis Quaid'],
      distributor: 'Mubi',
      runtime: 141,
      trailerUrl: 'https://www.youtube.com/watch?v=LJD7dYZloN8',
      imdbId: 'tt17526714',
      metacriticUrl: 'https://www.metacritic.com/movie/the-substance',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_substance',
      metacriticScore: 76,
      rottenTomatoesScore: 89,
      type: 'movie'
    },
    {
      id: 823219,
      title: 'Wicked',
      year: 2024,
      overview: 'The story of how a green-skinned woman framed by the Wizard of Oz becomes the Wicked Witch of the West.',
      posterUrl: null,
      director: 'Jon M. Chu',
      cinematographer: 'Alice Brooks',
      composer: 'Stephen Schwartz',
      starring: ['Cynthia Erivo', 'Ariana Grande', 'Jonathan Bailey', 'Jeff Goldblum', 'Michelle Yeoh'],
      distributor: 'Universal Pictures',
      runtime: 160,
      trailerUrl: 'https://www.youtube.com/watch?v=6COmYeLsz4c',
      imdbId: 'tt1262426',
      metacriticUrl: 'https://www.metacritic.com/movie/wicked-2024',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/wicked_2024',
      metacriticScore: 72,
      rottenTomatoesScore: 88,
      type: 'movie'
    },
    {
      id: 558449,
      title: 'Gladiator II',
      year: 2024,
      overview: 'After his home is conquered by the tyrannical emperors, Lucius must enter the Colosseum to restore honor to Rome.',
      posterUrl: null,
      director: 'Ridley Scott',
      cinematographer: 'John Mathieson',
      composer: 'Harry Gregson-Williams',
      starring: ['Paul Mescal', 'Denzel Washington', 'Pedro Pascal', 'Connie Nielsen'],
      distributor: 'Paramount Pictures',
      runtime: 148,
      trailerUrl: 'https://www.youtube.com/watch?v=4rgYUipGJNo',
      imdbId: 'tt9218128',
      metacriticUrl: 'https://www.metacritic.com/movie/gladiator-ii',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/gladiator_ii',
      metacriticScore: 60,
      rottenTomatoesScore: 71,
      type: 'movie'
    },
    {
      id: 1184918,
      title: 'The Wild Robot',
      year: 2024,
      overview: 'A robot shipwrecked on an island must learn to adapt to its new surroundings and becomes the adoptive parent of an orphaned gosling.',
      posterUrl: null,
      director: 'Chris Sanders',
      cinematographer: null,
      composer: 'Kris Bowers',
      starring: ['Lupita Nyong\'o', 'Pedro Pascal', 'Kit Connor', 'Catherine O\'Hara'],
      distributor: 'Universal Pictures',
      runtime: 102,
      trailerUrl: 'https://www.youtube.com/watch?v=67vbA5ZJyKQ',
      imdbId: 'tt29623480',
      metacriticUrl: 'https://www.metacritic.com/movie/the-wild-robot',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_wild_robot',
      metacriticScore: 83,
      rottenTomatoesScore: 98,
      type: 'movie'
    },
    {
      id: 696506,
      title: 'Mickey 17',
      year: 2025,
      overview: 'A disposable employee on a human expedition to colonize an ice world who is repeatedly cloned after dying.',
      posterUrl: null,
      director: 'Bong Joon-ho',
      cinematographer: 'Darius Khondji',
      composer: 'Jung Jae-il',
      starring: ['Robert Pattinson', 'Naomi Ackie', 'Steven Yeun', 'Toni Collette', 'Mark Ruffalo'],
      distributor: 'Warner Bros. Pictures',
      runtime: 137,
      trailerUrl: 'https://www.youtube.com/watch?v=dE2EwGvPXMQ',
      imdbId: 'tt12842648',
      metacriticUrl: 'https://www.metacritic.com/movie/mickey-17',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/mickey_17',
      metacriticScore: null,
      rottenTomatoesScore: null,
      type: 'movie'
    },
    {
      id: 238,
      title: 'The Godfather',
      year: 1972,
      overview: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant youngest son.',
      posterUrl: null,
      director: 'Francis Ford Coppola',
      cinematographer: 'Gordon Willis',
      composer: 'Nino Rota',
      starring: ['Marlon Brando', 'Al Pacino', 'James Caan', 'Robert Duvall', 'Diane Keaton'],
      distributor: 'Paramount Pictures',
      runtime: 175,
      trailerUrl: 'https://www.youtube.com/watch?v=sY1S34973zA',
      imdbId: 'tt0068646',
      metacriticUrl: 'https://www.metacritic.com/movie/the-godfather',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_godfather',
      metacriticScore: 100,
      rottenTomatoesScore: 97,
      type: 'movie'
    },
    {
      id: 240,
      title: 'The Godfather Part II',
      year: 1974,
      overview: 'The early life and career of Vito Corleone in 1920s New York City is portrayed, while his son, Michael, expands and tightens his grip on the family crime syndicate.',
      posterUrl: null,
      director: 'Francis Ford Coppola',
      cinematographer: 'Gordon Willis',
      composer: 'Nino Rota',
      starring: ['Al Pacino', 'Robert De Niro', 'Robert Duvall', 'Diane Keaton', 'John Cazale'],
      distributor: 'Paramount Pictures',
      runtime: 202,
      trailerUrl: 'https://www.youtube.com/watch?v=9O1Iy9od7-A',
      imdbId: 'tt0071562',
      metacriticUrl: 'https://www.metacritic.com/movie/the-godfather-part-ii',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_godfather_part_ii',
      metacriticScore: 90,
      rottenTomatoesScore: 96,
      type: 'movie'
    },
    {
      id: 242,
      title: 'The Godfather Part III',
      year: 1990,
      overview: 'In the midst of trying to legitimize his business dealings in New York City and Italy in 1979, aging Mafia Don Michael Corleone seeks to avow for his sins.',
      posterUrl: null,
      director: 'Francis Ford Coppola',
      cinematographer: 'Gordon Willis',
      composer: 'Carmine Coppola',
      starring: ['Al Pacino', 'Diane Keaton', 'Andy Garcia', 'Talia Shire', 'Sofia Coppola'],
      distributor: 'Paramount Pictures',
      runtime: 162,
      trailerUrl: 'https://www.youtube.com/watch?v=qJr92K_hKl0',
      imdbId: 'tt0099674',
      metacriticUrl: 'https://www.metacritic.com/movie/the-godfather-part-iii',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_godfather_part_iii',
      metacriticScore: 60,
      rottenTomatoesScore: 66,
      type: 'movie'
    },
    {
      id: 99238,
      title: 'The Godfather',
      year: 1969,
      overview: 'The classic novel by Mario Puzo that inspired the legendary film trilogy. A tale of family, power, and the American Dream corrupted.',
      posterUrl: null,
      director: 'Mario Puzo',
      cinematographer: null,
      composer: null,
      starring: [],
      distributor: 'G.P. Putnam\'s Sons',
      runtime: null,
      trailerUrl: null,
      imdbId: null,
      metacriticUrl: null,
      rottenTomatoesUrl: null,
      metacriticScore: null,
      rottenTomatoesScore: null,
      type: 'book'
    },
    {
      id: 550,
      title: 'Fight Club',
      year: 1999,
      overview: 'An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.',
      posterUrl: null,
      director: 'David Fincher',
      cinematographer: 'Jeff Cronenweth',
      composer: 'The Dust Brothers',
      starring: ['Brad Pitt', 'Edward Norton', 'Helena Bonham Carter', 'Meat Loaf'],
      distributor: '20th Century Fox',
      runtime: 139,
      trailerUrl: 'https://www.youtube.com/watch?v=SUXWAEX2jlg',
      imdbId: 'tt0137523',
      metacriticUrl: 'https://www.metacritic.com/movie/fight-club',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/fight_club',
      metacriticScore: 66,
      rottenTomatoesScore: 79,
      type: 'movie'
    },
    {
      id: 680,
      title: 'Pulp Fiction',
      year: 1994,
      overview: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence.',
      posterUrl: null,
      director: 'Quentin Tarantino',
      cinematographer: 'Andrzej Sekula',
      composer: null,
      starring: ['John Travolta', 'Uma Thurman', 'Samuel L. Jackson', 'Bruce Willis', 'Harvey Keitel'],
      distributor: 'Miramax',
      runtime: 154,
      trailerUrl: 'https://www.youtube.com/watch?v=s7EdQ4FqbhY',
      imdbId: 'tt0110912',
      metacriticUrl: 'https://www.metacritic.com/movie/pulp-fiction',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/pulp_fiction',
      metacriticScore: 95,
      rottenTomatoesScore: 92,
      type: 'movie'
    }
  ]

  // Filter by query - fuzzy search title, director, and cast
  return movies.filter(movie =>
    fuzzyMatch(movie.title, q) ||
    (movie.director && fuzzyMatch(movie.director, q)) ||
    movie.starring.some(actor => fuzzyMatch(actor, q))
  )
}
