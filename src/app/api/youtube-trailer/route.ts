import { NextRequest, NextResponse } from 'next/server'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAcAPLUflo9lDlsexKFzr5FHvvgGvF0xb8'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')
  const year = request.nextUrl.searchParams.get('year')

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  try {
    // Search for "[Movie Title] [Year] official trailer"
    const searchQuery = `${title} ${year || ''} official trailer`.trim()

    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('q', searchQuery)
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('maxResults', '5')
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY)
    // Prioritize relevance and prefer official channels
    searchUrl.searchParams.set('order', 'relevance')
    searchUrl.searchParams.set('videoEmbeddable', 'true')

    console.log('Searching YouTube for:', searchQuery)

    const response = await fetch(searchUrl.toString())

    if (!response.ok) {
      const errorData = await response.json()
      console.error('YouTube API error:', errorData)
      return NextResponse.json({ error: 'YouTube API error', details: errorData }, { status: response.status })
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ error: 'No trailer found' }, { status: 404 })
    }

    // Try to find the most official-looking result
    // Prefer results from known movie channels or with "Official" in title
    const officialPatterns = [
      /official/i,
      /trailer/i,
      /movie/i,
      /films?/i,
      /pictures/i,
      /studios?/i,
      /entertainment/i,
    ]

    let bestMatch = data.items[0]
    let bestScore = 0

    for (const item of data.items) {
      let score = 0
      const titleLower = item.snippet.title.toLowerCase()
      const channelLower = item.snippet.channelTitle.toLowerCase()

      // Score based on title matching
      if (titleLower.includes('official')) score += 10
      if (titleLower.includes('trailer')) score += 5
      if (titleLower.includes(title.toLowerCase())) score += 5

      // Score based on channel name
      if (channelLower.includes('official')) score += 8
      for (const pattern of officialPatterns) {
        if (pattern.test(channelLower)) score += 2
      }

      // Penalize things that are clearly not trailers
      if (titleLower.includes('reaction')) score -= 20
      if (titleLower.includes('review')) score -= 15
      if (titleLower.includes('breakdown')) score -= 10
      if (titleLower.includes('explained')) score -= 10
      if (titleLower.includes('parody')) score -= 20

      if (score > bestScore) {
        bestScore = score
        bestMatch = item
      }
    }

    const videoId = bestMatch.id.videoId
    const embedUrl = `https://www.youtube.com/embed/${videoId}`

    console.log('Found trailer:', bestMatch.snippet.title, 'from', bestMatch.snippet.channelTitle)

    return NextResponse.json({
      videoId,
      embedUrl,
      title: bestMatch.snippet.title,
      channelTitle: bestMatch.snippet.channelTitle,
      thumbnail: bestMatch.snippet.thumbnails?.high?.url || bestMatch.snippet.thumbnails?.default?.url,
      description: bestMatch.snippet.description,
    })
  } catch (error) {
    console.error('YouTube trailer fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch trailer' }, { status: 500 })
  }
}
