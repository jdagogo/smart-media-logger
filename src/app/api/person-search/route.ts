import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d'

interface TMDBPerson {
  id: number
  name: string
  known_for_department: string
  profile_path: string | null
  popularity: number
  known_for: Array<{
    title?: string
    name?: string
    media_type: string
  }>
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const url = new URL('https://api.themoviedb.org/3/search/person')
    url.searchParams.set('api_key', TMDB_API_KEY)
    url.searchParams.set('query', query)
    url.searchParams.set('include_adult', 'false')

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.error('TMDB person search error:', response.status)
      return NextResponse.json({ results: [] })
    }

    const data = await response.json()

    // Map to simpler format with role detection
    const results = (data.results as TMDBPerson[])
      .slice(0, 8)
      .map((person) => {
        // Determine role from known_for_department
        let role: string = 'actor'
        const dept = person.known_for_department?.toLowerCase()

        if (dept === 'directing') role = 'director'
        else if (dept === 'writing') role = 'writer'
        else if (dept === 'production') role = 'producer'
        else if (dept === 'camera') role = 'cinematographer'
        else if (dept === 'sound' || dept === 'music') role = 'composer'
        else if (dept === 'acting') role = 'actor'

        // Get known for credits
        const knownFor = person.known_for
          ?.slice(0, 2)
          .map(k => k.title || k.name)
          .filter(Boolean)
          .join(', ')

        return {
          id: person.id,
          name: person.name,
          role,
          department: person.known_for_department,
          profilePath: person.profile_path
            ? `https://image.tmdb.org/t/p/w92${person.profile_path}`
            : null,
          knownFor,
          popularity: person.popularity,
        }
      })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Person search error:', error)
    return NextResponse.json({ results: [] })
  }
}
