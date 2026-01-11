import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const imdbUrl = request.nextUrl.searchParams.get('url')

  if (!imdbUrl) {
    return NextResponse.json({ error: 'IMDB URL is required' }, { status: 400 })
  }

  try {
    // Extract IMDB ID from URL
    const imdbIdMatch = imdbUrl.match(/tt\d+/)
    if (!imdbIdMatch) {
      return NextResponse.json({ error: 'Invalid IMDB URL' }, { status: 400 })
    }

    const imdbId = imdbIdMatch[0]
    const awardsUrl = `https://www.imdb.com/title/${imdbId}/awards/`

    console.log('Fetching IMDB awards:', awardsUrl)

    // Fetch the awards page
    const response = await fetch(awardsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch awards page' }, { status: response.status })
    }

    const html = await response.text()
    const awardEvents: string[] = []

    // Pattern 1: Look in __NEXT_DATA__ JSON for categories array (most reliable)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/i)
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1])
        const categories = nextData?.props?.pageProps?.categories || []
        for (const cat of categories) {
          if (cat.name && !awardEvents.includes(cat.name)) {
            awardEvents.push(cat.name)
          }
        }
      } catch (e) {
        console.log('Failed to parse __NEXT_DATA__:', e)
      }
    }

    // Pattern 2: Look for award names in h3 > span structure (only if Pattern 1 didn't find any)
    // Format: <h3 class="ipc-title__text"><span id="ev...">Award Name</span>
    if (awardEvents.length === 0) {
      const h3SpanMatches = Array.from(html.matchAll(/<h3[^>]*class="[^"]*ipc-title__text[^"]*"[^>]*><span[^>]*id="ev[^"]*"[^>]*>([^<]+)<\/span>/gi))
      for (const match of h3SpanMatches) {
        const name = match[1].trim()
        if (name && name.length > 3 && !awardEvents.includes(name)) {
          awardEvents.push(name)
        }
      }
    }

    // Pattern 3: Look for award event names in links to /event/ pages
    const eventLinkMatches = Array.from(html.matchAll(/<a[^>]*href="\/event\/ev\d+\/[^"]*"[^>]*>([^<]+)<\/a>/gi))
    for (const match of eventLinkMatches) {
      const name = match[1].trim()
      if (name &&
          name.length > 5 &&
          !awardEvents.includes(name) &&
          !name.toLowerCase().includes('see more') &&
          !name.toLowerCase().includes('nominee') &&
          !name.match(/^\d+$/)) {
        awardEvents.push(name)
      }
    }

    console.log('Found award events:', awardEvents)

    // Create summary
    let summary = ''
    if (awardEvents.length > 0) {
      // Show up to 6 award names
      const displayNames = awardEvents.slice(0, 6)
      summary = displayNames.join('\n')
      if (awardEvents.length > 6) {
        summary += `\n...and ${awardEvents.length - 6} more`
      }
    } else {
      summary = 'Click to see full awards details on IMDB'
    }

    return NextResponse.json({
      summary,
      awards: awardEvents,
      count: awardEvents.length,
    })
  } catch (error) {
    console.error('IMDB awards fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch awards' }, { status: 500 })
  }
}
