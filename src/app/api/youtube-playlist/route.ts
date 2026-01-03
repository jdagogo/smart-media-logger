import { NextRequest, NextResponse } from 'next/server'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAcAPLUflo9lDlsexKFzr5FHvvgGvF0xb8'

// Manual playlist overrides for movies where auto-search returns wrong results
// Use "movie title:music" key for Music From overrides
const PLAYLIST_OVERRIDES: Record<string, string> = {
  'american hustle': 'PLdDuA6zKmNDNkQOJhYugEL2BfxqL6So-t',
  'marty supreme:music': 'PLcAZ6vjRR64Qkm4YK5jBuoJaDlpPTHBqF', // Music from Marty Supreme
}

export async function GET(request: NextRequest) {
  const playlistId = request.nextUrl.searchParams.get('playlistId')
  const movieTitle = request.nextUrl.searchParams.get('movieTitle')
  const searchType = request.nextUrl.searchParams.get('searchType') || 'score' // 'score' or 'music'
  const composer = request.nextUrl.searchParams.get('composer')

  try {
    let targetPlaylistId = playlistId

    // Check for manual override first
    if (!targetPlaylistId && movieTitle) {
      const normalizedTitle = movieTitle.toLowerCase().trim()
      const overrideKey = searchType === 'music' ? `${normalizedTitle}:music` : normalizedTitle
      if (PLAYLIST_OVERRIDES[overrideKey]) {
        targetPlaylistId = PLAYLIST_OVERRIDES[overrideKey]
        console.log('Using manual override for:', movieTitle, searchType, '-> Playlist ID:', targetPlaylistId)
      } else if (PLAYLIST_OVERRIDES[normalizedTitle]) {
        targetPlaylistId = PLAYLIST_OVERRIDES[normalizedTitle]
        console.log('Using manual override for:', movieTitle, '-> Playlist ID:', targetPlaylistId)
      }
    }

    // If no playlist ID and no override, search based on type
    if (!targetPlaylistId && movieTitle) {
      let searchQuery: string

      if (searchType === 'music') {
        // Search for licensed songs / music from the film
        searchQuery = `${movieTitle} music from songs playlist`
      } else {
        // Search for original score
        if (composer) {
          searchQuery = `${composer} ${movieTitle} original score`
        } else {
          searchQuery = `${movieTitle} original score soundtrack`
        }
      }

      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('q', searchQuery)
      searchUrl.searchParams.set('type', 'playlist')
      searchUrl.searchParams.set('maxResults', '5')
      searchUrl.searchParams.set('key', YOUTUBE_API_KEY)

      console.log('Searching YouTube for playlist:', searchQuery, '(type:', searchType, ')')

      const searchResponse = await fetch(searchUrl.toString())
      if (!searchResponse.ok) {
        const errorData = await searchResponse.json()
        console.error('YouTube search error:', errorData)
        return NextResponse.json({ error: 'YouTube API error', details: errorData }, { status: searchResponse.status })
      }

      const searchData = await searchResponse.json()

      if (!searchData.items || searchData.items.length === 0) {
        const typeLabel = searchType === 'music' ? 'music' : 'original score'
        return NextResponse.json({ error: `No ${typeLabel} playlist found` }, { status: 404 })
      }

      // Score playlists to find the most relevant one
      let bestMatch = searchData.items[0]
      let bestScore = 0

      for (const item of searchData.items) {
        let score = 0
        const titleLower = item.snippet.title.toLowerCase()
        const movieLower = movieTitle.toLowerCase()

        // Base score for containing movie title
        if (titleLower.includes(movieLower)) score += 15

        if (searchType === 'music') {
          // For "Music From" tab - prefer playlists with songs/music from
          if (titleLower.includes('music from')) score += 12
          if (titleLower.includes('songs from')) score += 12
          if (titleLower.includes('songs in')) score += 10
          if (titleLower.includes('featured')) score += 5
          // Penalize score-focused results
          if (titleLower.includes('original score')) score -= 10
          if (titleLower.includes('composed by')) score -= 8
        } else {
          // For "Original Score" tab - prefer score/OST playlists
          if (titleLower.includes('original score')) score += 15
          if (titleLower.includes('ost')) score += 10
          if (titleLower.includes('soundtrack')) score += 8
          if (titleLower.includes('official')) score += 5
          if (composer && titleLower.includes(composer.toLowerCase())) score += 10
          // Penalize song compilations
          if (titleLower.includes('songs from')) score -= 8
          if (titleLower.includes('music from')) score -= 5
        }

        // General penalties
        if (titleLower.includes('cover')) score -= 10
        if (titleLower.includes('remix')) score -= 5
        if (titleLower.includes('karaoke')) score -= 20

        if (score > bestScore) {
          bestScore = score
          bestMatch = item
        }
      }

      targetPlaylistId = bestMatch.id.playlistId
      console.log('Found playlist:', bestMatch.snippet.title, 'ID:', targetPlaylistId, 'Score:', bestScore)
    }

    if (!targetPlaylistId) {
      return NextResponse.json({ error: 'Playlist ID or movie title required' }, { status: 400 })
    }

    // Fetch playlist details
    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlists')
    playlistUrl.searchParams.set('part', 'snippet,contentDetails')
    playlistUrl.searchParams.set('id', targetPlaylistId)
    playlistUrl.searchParams.set('key', YOUTUBE_API_KEY)

    const playlistResponse = await fetch(playlistUrl.toString())
    const playlistData = await playlistResponse.json()

    const playlistInfo = playlistData.items?.[0]

    // Fetch playlist items (tracks)
    const itemsUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    itemsUrl.searchParams.set('part', 'snippet,contentDetails')
    itemsUrl.searchParams.set('playlistId', targetPlaylistId)
    itemsUrl.searchParams.set('maxResults', '50') // Get up to 50 tracks
    itemsUrl.searchParams.set('key', YOUTUBE_API_KEY)

    console.log('Fetching playlist items for:', targetPlaylistId)

    const itemsResponse = await fetch(itemsUrl.toString())
    if (!itemsResponse.ok) {
      const errorData = await itemsResponse.json()
      console.error('YouTube playlist items error:', errorData)
      return NextResponse.json({ error: 'Failed to fetch playlist items', details: errorData }, { status: itemsResponse.status })
    }

    const itemsData = await itemsResponse.json()

    // Parse tracks with song title and artist extraction
    const tracks = itemsData.items?.map((item: any, index: number) => {
      const fullTitle = item.snippet.title
      const channelTitle = item.snippet.videoOwnerChannelTitle || ''

      // Try to parse "Artist - Song Title" format
      let artist = ''
      let songTitle = fullTitle

      if (fullTitle.includes(' - ')) {
        const parts = fullTitle.split(' - ')
        artist = parts[0].trim()
        songTitle = parts.slice(1).join(' - ').trim()
      } else if (fullTitle.includes(' | ')) {
        const parts = fullTitle.split(' | ')
        artist = parts[0].trim()
        songTitle = parts.slice(1).join(' | ').trim()
      }

      // Clean up common suffixes
      songTitle = songTitle
        .replace(/\s*\(Official\s*(Video|Audio|Music Video|Lyric Video)\)/gi, '')
        .replace(/\s*\[Official\s*(Video|Audio|Music Video|Lyric Video)\]/gi, '')
        .replace(/\s*\(Lyrics?\)/gi, '')
        .replace(/\s*\[Lyrics?\]/gi, '')
        .trim()

      return {
        position: index + 1,
        videoId: item.contentDetails.videoId,
        title: songTitle,
        artist: artist || channelTitle.replace(' - Topic', ''),
        fullTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        channelTitle,
        publishedAt: item.snippet.publishedAt,
      }
    }) || []

    console.log(`Found ${tracks.length} tracks in playlist`)

    return NextResponse.json({
      playlistId: targetPlaylistId,
      playlistTitle: playlistInfo?.snippet?.title || 'Soundtrack',
      playlistDescription: playlistInfo?.snippet?.description,
      channelTitle: playlistInfo?.snippet?.channelTitle,
      trackCount: playlistInfo?.contentDetails?.itemCount || tracks.length,
      thumbnail: playlistInfo?.snippet?.thumbnails?.high?.url || playlistInfo?.snippet?.thumbnails?.default?.url,
      tracks,
    })
  } catch (error) {
    console.error('YouTube playlist fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: 500 })
  }
}
