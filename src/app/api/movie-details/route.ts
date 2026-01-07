import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d'
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'a053b065'

export async function GET(request: NextRequest) {
  const tmdbId = request.nextUrl.searchParams.get('tmdbId')
  const title = request.nextUrl.searchParams.get('title')
  const year = request.nextUrl.searchParams.get('year')
  const mediaType = request.nextUrl.searchParams.get('type') || 'movie'

  if (!tmdbId && !title) {
    return NextResponse.json({ error: 'tmdbId or title is required' }, { status: 400 })
  }

  try {
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

    // Fallback: Fetch IMDB directly if OMDB didn't have the rating
    let imdbRating = omdbData?.imdbRating
    let imdbVotes = omdbData?.imdbVotes
    if (!imdbRating && tmdbData.imdbId) {
      const imdbData = await fetchIMDBData(tmdbData.imdbId)
      if (imdbData) {
        imdbRating = imdbData.imdbRating
        imdbVotes = imdbData.imdbVotes
      }
    }

    // Merge all the data
    const fullMetadata = {
      ...tmdbData,
      // OMDB critic scores
      metacriticScore: omdbData?.metacriticScore,
      rottenTomatoesScore: omdbData?.rottenTomatoesScore,
      imdbRating,
      imdbVotes,
      // OMDB rich metadata
      rated: omdbData?.rated,
      awards: omdbData?.awards,
      boxOffice: omdbData?.boxOffice,
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
