import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d'
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Hardcoded images/videos for films not in TMDB
const HARDCODED_MOVIE_IMAGES: Record<string, any> = {
  '99990001': {
    movieId: 99990001,
    images: {
      scenes: [
        { url: 'https://m.media-amazon.com/images/M/MV5BZjUzMzU3NzgtMWVkYi00NzM2LTk0OTctMDFmMGY2YWRiNmE3XkEyXkFqcGc@._V1_.jpg', aspectRatio: 0.675 }
      ],
      cast: [
        { name: 'Charli xcx', character: 'Herself', profileUrl: null },
        { name: 'Alexander Skarsgård', character: '', profileUrl: null },
        { name: 'Rachel Sennott', character: '', profileUrl: null },
        { name: 'Rosanna Arquette', character: '', profileUrl: null },
        { name: 'Kate Berlant', character: '', profileUrl: null },
        { name: 'Jamie Demetriou', character: '', profileUrl: null },
        { name: 'Kylie Jenner', character: '', profileUrl: null }
      ],
      videos: [
        { key: 'Pxqhi7Sgvu8', name: 'Official Trailer', type: 'Trailer', thumbnailUrl: 'https://img.youtube.com/vi/Pxqhi7Sgvu8/mqdefault.jpg' }
      ]
    },
    totalScenes: 1,
    totalCast: 16,
    totalVideos: 1
  },
  '99990002': {
    movieId: 99990002,
    images: {
      scenes: [
        { url: 'https://m.media-amazon.com/images/M/MV5BYWU3YWE3ZWQtODZjNS00ZTdmLWFjNzUtOTUxNjY0MTNhNjhlXkEyXkFqcGc@._V1_.jpg', aspectRatio: 0.675 }
      ],
      cast: [
        { name: 'Nina Kiri', character: 'Evy', profileUrl: null },
        { name: 'Kris Holden-Ried', character: '', profileUrl: null },
        { name: 'Michèle Duquet', character: '', profileUrl: null },
        { name: 'Keana Lyn Bastidas', character: '', profileUrl: null }
      ],
      videos: [
        { key: 'j6uDeBYDHu4', name: 'Official Trailer', type: 'Trailer', thumbnailUrl: 'https://img.youtube.com/vi/j6uDeBYDHu4/mqdefault.jpg' },
        { key: 'iJ2tUNSGL7Y', name: 'Teaser', type: 'Teaser', thumbnailUrl: 'https://img.youtube.com/vi/iJ2tUNSGL7Y/mqdefault.jpg' }
      ]
    },
    totalScenes: 1,
    totalCast: 4,
    totalVideos: 2
  }
}

export async function GET(request: NextRequest) {
  const movieId = request.nextUrl.searchParams.get('movieId')
  const movieTitle = request.nextUrl.searchParams.get('title')
  const year = request.nextUrl.searchParams.get('year')

  try {
    // Check for hardcoded movies first (IDs starting with 9999)
    if (movieId && parseInt(movieId) >= 99990000) {
      const hardcodedImages = HARDCODED_MOVIE_IMAGES[movieId]
      if (hardcodedImages) {
        return NextResponse.json(hardcodedImages)
      }
    }

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

    // Fetch videos (trailers, clips, featurettes, behind the scenes)
    const videosUrl = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}/videos`)
    videosUrl.searchParams.set('api_key', TMDB_API_KEY)

    const [imagesResponse, creditsResponse, videosResponse] = await Promise.all([
      fetch(imagesUrl.toString()),
      fetch(creditsUrl.toString()),
      fetch(videosUrl.toString())
    ])

    const imagesData = await imagesResponse.json()
    const creditsData = await creditsResponse.json()
    const videosData = await videosResponse.json()

    // Get backdrops (scene images)
    // Prioritize actual scene stills over promotional images:
    // - Images without language code (iso_639_1 is null) are usually scene stills
    // - Images with language codes often have promotional text overlays
    // - Sort by vote_count to get more popular/memorable shots
    const sortedBackdrops = (imagesData.backdrops || [])
      .sort((a: any, b: any) => {
        // Prioritize images without language (actual scene stills)
        const aHasLang = a.iso_639_1 ? 1 : 0
        const bHasLang = b.iso_639_1 ? 1 : 0
        if (aHasLang !== bHasLang) return aHasLang - bHasLang
        // Then sort by vote count (more votes = more memorable/popular scenes)
        return (b.vote_count || 0) - (a.vote_count || 0)
      })
      .slice(0, 20)

    const backdrops = sortedBackdrops.map((img: any, index: number) => ({
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

    // Get videos (trailers, clips, featurettes, behind the scenes, etc.)
    // Prioritize: Clips > Featurettes > Behind the Scenes > Trailers > Teasers
    const videoTypeOrder: Record<string, number> = {
      'Clip': 1,
      'Featurette': 2,
      'Behind the Scenes': 3,
      'Trailer': 4,
      'Teaser': 5,
    }

    const videos = (videosData.results || [])
      .filter((v: any) => v.site === 'YouTube') // Only YouTube videos (can embed)
      .sort((a: any, b: any) => {
        const orderA = videoTypeOrder[a.type] || 99
        const orderB = videoTypeOrder[b.type] || 99
        return orderA - orderB
      })
      .slice(0, 15) // Limit to 15 videos
      .map((video: any, index: number) => ({
        id: `video-${video.id}`,
        type: 'video',
        videoType: video.type, // Trailer, Teaser, Clip, Featurette, Behind the Scenes
        name: video.name,
        key: video.key, // YouTube video ID
        site: video.site,
        official: video.official,
        publishedAt: video.published_at,
        thumbnailUrl: `https://img.youtube.com/vi/${video.key}/mqdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${video.key}`,
        watchUrl: `https://www.youtube.com/watch?v=${video.key}`,
      }))

    console.log(`Found ${backdrops.length} scenes, ${cast.length} cast, ${videos.length} videos for movie ${tmdbId}`)

    return NextResponse.json({
      movieId: tmdbId,
      images: {
        scenes: backdrops,
        cast: cast,
        videos: videos,
      },
      totalScenes: imagesData.backdrops?.length || 0,
      totalCast: creditsData.cast?.length || 0,
      totalVideos: videosData.results?.length || 0,
    })
  } catch (error) {
    console.error('Movie images fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch movie images' }, { status: 500 })
  }
}
