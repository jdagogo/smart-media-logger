import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d'
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

export async function GET(request: NextRequest) {
  const movieId = request.nextUrl.searchParams.get('movieId')
  const movieTitle = request.nextUrl.searchParams.get('title')
  const year = request.nextUrl.searchParams.get('year')

  try {
    let tmdbId = movieId

    // If no movie ID, search by title
    if (!tmdbId && movieTitle) {
      const searchUrl = new URL(`${TMDB_BASE_URL}/search/movie`)
      searchUrl.searchParams.set('api_key', TMDB_API_KEY)
      searchUrl.searchParams.set('query', movieTitle)
      if (year) searchUrl.searchParams.set('year', year)

      const searchResponse = await fetch(searchUrl.toString())
      const searchData = await searchResponse.json()

      if (searchData.results && searchData.results.length > 0) {
        tmdbId = searchData.results[0].id.toString()
      } else {
        return NextResponse.json({ error: 'Movie not found' }, { status: 404 })
      }
    }

    if (!tmdbId) {
      return NextResponse.json({ error: 'Movie ID or title required' }, { status: 400 })
    }

    // Fetch movie images (backdrops and stills)
    const imagesUrl = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}/images`)
    imagesUrl.searchParams.set('api_key', TMDB_API_KEY)

    // Fetch cast
    const creditsUrl = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}/credits`)
    creditsUrl.searchParams.set('api_key', TMDB_API_KEY)

    const [imagesResponse, creditsResponse] = await Promise.all([
      fetch(imagesUrl.toString()),
      fetch(creditsUrl.toString())
    ])

    const imagesData = await imagesResponse.json()
    const creditsData = await creditsResponse.json()

    // Get backdrops (scene images)
    const backdrops = (imagesData.backdrops || []).slice(0, 20).map((img: any, index: number) => ({
      id: `backdrop-${index}`,
      type: 'scene',
      url: `https://image.tmdb.org/t/p/w780${img.file_path}`,
      urlLarge: `https://image.tmdb.org/t/p/w1280${img.file_path}`,
      aspectRatio: img.aspect_ratio,
      width: img.width,
      height: img.height,
    }))

    // Get main cast with their profile images
    const cast = (creditsData.cast || []).slice(0, 10).map((person: any) => ({
      id: `cast-${person.id}`,
      type: 'character',
      actorName: person.name,
      characterName: person.character,
      url: person.profile_path
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
        : null,
      urlLarge: person.profile_path
        ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
        : null,
      order: person.order,
    })).filter((c: any) => c.url)

    console.log(`Found ${backdrops.length} scene images and ${cast.length} cast members for movie ${tmdbId}`)

    return NextResponse.json({
      movieId: tmdbId,
      images: {
        scenes: backdrops,
        cast: cast,
      },
      totalScenes: imagesData.backdrops?.length || 0,
      totalCast: creditsData.cast?.length || 0,
    })
  } catch (error) {
    console.error('Movie images fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch movie images' }, { status: 500 })
  }
}
