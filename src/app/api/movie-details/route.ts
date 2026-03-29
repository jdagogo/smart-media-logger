import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d'
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'a053b065'

// Hardcoded movie data for films not in TMDB
const HARDCODED_MOVIE_DETAILS: Record<number, any> = {
  99990001: {
    id: 99990001,
    title: 'The Moment',
    year: 2026,
    overview: 'A flashy, tongue-in-cheek hyper-pop mockumentary following a rising pop star as she navigates the complexities of fame and industry pressure while preparing for her arena tour debut.',
    poster: 'https://m.media-amazon.com/images/M/MV5BZjUzMzU3NzgtMWVkYi00NzM2LTk0OTctMDFmMGY2YWRiNmE3XkEyXkFqcGc@._V1_.jpg',
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
    type: 'movie',
    mediaType: 'movie',
    videos: [
      { key: 'Pxqhi7Sgvu8', name: 'Official Trailer', type: 'Trailer' }
    ],
    images: [
      'https://m.media-amazon.com/images/M/MV5BZjUzMzU3NzgtMWVkYi00NzM2LTk0OTctMDFmMGY2YWRiNmE3XkEyXkFqcGc@._V1_.jpg'
    ]
  },
  99990002: {
    id: 99990002,
    title: 'Undertone',
    year: 2026,
    overview: "The host of an 'all-things-creepy' podcast moves into her dying mother's house to be her primary caregiver. When her podcast is sent 10 audio recordings of a young pregnant couple experiencing paranormal noises, she realizes the woman's story is a mirror of her own and each new recording scratches at her sanity, drawing her into a fate she cannot escape.",
    poster: 'https://m.media-amazon.com/images/M/MV5BYWU3YWE3ZWQtODZjNS00ZTdmLWFjNzUtOTUxNjY0MTNhNjhlXkEyXkFqcGc@._V1_.jpg',
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
}

export async function GET(request: NextRequest) {
  const tmdbId = request.nextUrl.searchParams.get('tmdbId')
  const title = request.nextUrl.searchParams.get('title')
  const year = request.nextUrl.searchParams.get('year')
  const mediaType = request.nextUrl.searchParams.get('type') || 'movie'

  if (!tmdbId && !title) {
    return NextResponse.json({ error: 'tmdbId or title is required' }, { status: 400 })
  }

  try {
    // Check for hardcoded movies first (IDs starting with 9999)
    if (tmdbId && parseInt(tmdbId) >= 99990000) {
      const hardcodedMovie = HARDCODED_MOVIE_DETAILS[parseInt(tmdbId)]
      if (hardcodedMovie) {
        return NextResponse.json(hardcodedMovie)
      }
    }

    let tmdbData: any = null

    // If we have a TMDB ID, fetch directly
    if (tmdbId) {
      tmdbData = await fetchTMDBDetails(parseInt(tmdbId), mediaType)
    }
    // Otherwise search by title
    else if (title) {
      const searchResult = await searchTMDB(title, year ? parseInt(year) : undefined, mediaType)
      if (searchResult) {
        tmdbData = await fetchTMDBDetails(searchResult.id, mediaType)
      }
    }

    if (!tmdbData) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 })
    }

    // Now fetch OMDB data for Metacritic, RT, IMDB scores
    const omdbData = await fetchOMDBData(tmdbData.title, tmdbData.year, tmdbData.imdbId)

    // Fetch full IMDB data (rating, box office with domestic/worldwide, awards)
    let imdbData: any = null
    if (tmdbData.imdbId) {
      imdbData = await fetchFullIMDBData(tmdbData.imdbId)
    }

    // Use IMDB data if available, fallback to OMDB
    const imdbRating = imdbData?.imdbRating || omdbData?.imdbRating
    const imdbVotes = imdbData?.voteCount?.toLocaleString() || omdbData?.imdbVotes
    const boxOffice = imdbData?.boxOffice || omdbData?.boxOffice
    const awards = imdbData?.awards || omdbData?.awards

    // Merge all the data
    const fullMetadata = {
      ...tmdbData,
      // OMDB critic scores
      metacriticScore: omdbData?.metacriticScore,
      rottenTomatoesScore: omdbData?.rottenTomatoesScore,
      imdbRating,
      imdbVotes,
      // Use IMDB data for box office and awards (has domestic + worldwide)
      boxOffice,
      boxOfficeDetails: imdbData?.boxOfficeDetails,
      budget: imdbData?.budget,
      awards,
      awardsDetails: imdbData?.awardsDetails,
      // OMDB rich metadata
      rated: omdbData?.rated,
      production: omdbData?.production,
      country: omdbData?.country,
      language: omdbData?.language,
      plot: omdbData?.plot,
    }

    console.log('Full metadata fetched:', fullMetadata.title, {
      metacritic: fullMetadata.metacriticScore,
      rt: fullMetadata.rottenTomatoesScore,
      imdb: fullMetadata.imdbRating,
      cast: fullMetadata.cast?.length,
    })

    return NextResponse.json(fullMetadata)
  } catch (error) {
    console.error('Movie details fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch movie details' }, { status: 500 })
  }
}

async function searchTMDB(title: string, year?: number, mediaType: string = 'movie') {
  const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`
  const response = await fetch(searchUrl)

  if (!response.ok) return null

  const data = await response.json()
  return data.results?.[0] || null
}

async function fetchTMDBDetails(tmdbId: number, mediaType: string = 'movie') {
  const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,images`
  const response = await fetch(detailsUrl)

  if (!response.ok) return null

  const details = await response.json()
  const crew = details.credits?.crew || []
  const cast = details.credits?.cast || []

  // Get all directors
  const directors = crew
    .filter((c: any) => c.job === 'Director')
    .map((c: any) => c.name)

  // Cinematographer
  const cinematographer = crew.find((c: any) =>
    c.job === 'Director of Photography' || c.job === 'Cinematography'
  )?.name

  // Composer
  const composers = crew
    .filter((c: any) =>
      c.job === 'Original Music Composer' ||
      c.job === 'Music' ||
      c.job === 'Composer'
    )
    .map((c: any) => c.name)

  // Writers
  const writers = crew
    .filter((c: any) =>
      c.job === 'Writer' ||
      c.job === 'Screenplay' ||
      c.job === 'Story'
    )
    .map((c: any) => c.name)
    .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index)

  // Producers
  const producers = crew
    .filter((c: any) => c.job === 'Producer' || c.job === 'Executive Producer')
    .slice(0, 5)
    .map((c: any) => ({ name: c.name, job: c.job }))

  // Editor
  const editor = crew.find((c: any) => c.job === 'Editor')?.name

  // Get trailer
  const trailer = details.videos?.results?.find(
    (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
  )

  // Get all videos (trailers, clips, featurettes, etc.)
  const videos = details.videos?.results?.map((v: any) => ({
    id: v.id,
    key: v.key,
    name: v.name,
    site: v.site,
    type: v.type,
    official: v.official,
  })) || []

  // Get images (backdrops, posters, stills)
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

  return {
    tmdbId,
    title: mediaType === 'movie' ? details.title : details.name,
    year: new Date(mediaType === 'movie' ? details.release_date : details.first_air_date).getFullYear(),
    overview: details.overview,
    poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
    backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : undefined,
    runtime: details.runtime,
    genres: details.genres?.map((g: any) => g.name),
    tmdbRating: details.vote_average ? Math.round(details.vote_average * 10) : undefined,
    tmdbVoteCount: details.vote_count,
    imdbId: details.imdb_id,
    // Crew
    director: directors[0],
    directors,
    cinematographer,
    composer: composers.length > 0 ? composers.join(', ') : undefined,
    writers,
    producers,
    editor,
    // Cast with photos
    cast: cast.slice(0, 15).map((c: any) => ({
      name: c.name,
      character: c.character,
      profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
    })),
    // Starring (just names for display)
    starring: cast.slice(0, 5).map((c: any) => c.name),
    // Trailer
    trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : undefined,
    trailerVideoId: trailer?.key,
    // All videos and images
    videos,
    images,
    // URLs for linking
    metacriticUrl: `https://www.metacritic.com/${mediaType}/${(mediaType === 'movie' ? details.title : details.name).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`,
    rottenTomatoesUrl: `https://www.rottentomatoes.com/${mediaType === 'movie' ? 'm' : 'tv'}/${(mediaType === 'movie' ? details.title : details.name).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_')}`,
    imdbUrl: details.imdb_id ? `https://www.imdb.com/title/${details.imdb_id}` : undefined,
    mediaType,
  }
}

async function fetchOMDBData(title: string, year: number, imdbId?: string) {
  try {
    // Prefer IMDB ID if available (more accurate)
    const url = imdbId
      ? `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}&plot=full`
      : `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&type=movie&plot=full`

    console.log('Fetching OMDB:', url)
    const response = await fetch(url)

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
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1])
        if (data.aggregateRating) {
          const rating = data.aggregateRating.ratingValue
          const votes = data.aggregateRating.ratingCount
          console.log(`IMDB direct found: rating=${rating}, votes=${votes}`)
          return {
            imdbRating: rating ? String(rating) : undefined,
            imdbVotes: votes ? String(votes) : undefined,
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
