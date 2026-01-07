import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')
  const year = request.nextUrl.searchParams.get('year')

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  try {
    // Build the Rotten Tomatoes URL slug
    const slug = title
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim()

    // Try multiple URL patterns - prioritize without year since RT often doesn't include it
    const urlsToTry = [
      `https://www.rottentomatoes.com/m/${slug}`,
      `https://www.rottentomatoes.com/m/${slug.replace(/_/g, '')}`,
      ...(year ? [
        `https://www.rottentomatoes.com/m/${slug}_${year}`,
        `https://www.rottentomatoes.com/m/${slug}${year}`,
      ] : []),
    ]

    console.log('Scraping Rotten Tomatoes for:', title, 'URLs to try:', urlsToTry)

    for (const rtUrl of urlsToTry) {
      console.log('Trying RT URL:', rtUrl)

      const response = await fetch(rtUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      })

      if (!response.ok) {
        console.log('RT response not ok:', response.status)
        continue
      }

      const html = await response.text()

      // Method 1: Look in JSON-LD structured data
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
      for (const match of jsonLdMatches) {
        try {
          const jsonData = JSON.parse(match[1])
          if (jsonData.aggregateRating?.ratingValue) {
            // RT uses a 1-10 scale in JSON-LD, convert to percentage
            const rawScore = parseFloat(jsonData.aggregateRating.ratingValue)
            const score = rawScore <= 10 ? Math.round(rawScore * 10) : Math.round(rawScore)
            console.log('RT from JSON-LD:', score)
            return NextResponse.json({
              rottenTomatoesScore: score,
              reviewCount: jsonData.aggregateRating.reviewCount,
              url: rtUrl,
              source: 'json-ld',
            })
          }
        } catch (e) {
          // Continue to next match
        }
      }

      // Method 2: Look for tomatometer score in data attributes
      const tomatometerMatch = html.match(/data-audiencescore="(\d+)"/) ||
                              html.match(/data-tomatometerscore="(\d+)"/) ||
                              html.match(/tomatometer[^}]*"score"\s*:\s*"?(\d+)"?/)
      if (tomatometerMatch) {
        const score = parseInt(tomatometerMatch[1])
        console.log('RT from data attribute:', score)
        return NextResponse.json({
          rottenTomatoesScore: score,
          url: rtUrl,
          source: 'data-attribute',
        })
      }

      // Method 3: Look in script tags for score data
      const scoreDataMatch = html.match(/scoreboard[^>]*tomatometerscore="(\d+)"/) ||
                            html.match(/"tomatometerScore"\s*:\s*(\d+)/) ||
                            html.match(/"tomatoScore"\s*:\s*(\d+)/)
      if (scoreDataMatch) {
        const score = parseInt(scoreDataMatch[1])
        console.log('RT from scoreboard:', score)
        return NextResponse.json({
          rottenTomatoesScore: score,
          url: rtUrl,
          source: 'scoreboard',
        })
      }

      // Method 4: Look for score in meta tags
      const metaMatch = html.match(/<meta[^>]*name="twitter:data1"[^>]*content="(\d+)%"/) ||
                       html.match(/Tomatometer[^>]*>(\d+)%/)
      if (metaMatch) {
        const score = parseInt(metaMatch[1])
        console.log('RT from meta:', score)
        return NextResponse.json({
          rottenTomatoesScore: score,
          url: rtUrl,
          source: 'meta',
        })
      }

      // Method 5: Look in the page content for percentage displays
      const percentMatch = html.match(/critics-score[^>]*>\s*(\d+)%/) ||
                          html.match(/score-icon-critics[^>]*>\s*(\d+)/) ||
                          html.match(/"criticScore"\s*:\s*"?(\d+)"?/)
      if (percentMatch) {
        const score = parseInt(percentMatch[1])
        if (score >= 0 && score <= 100) {
          console.log('RT from percentage pattern:', score)
          return NextResponse.json({
            rottenTomatoesScore: score,
            url: rtUrl,
            source: 'percentage-pattern',
          })
        }
      }
    }

    return NextResponse.json({ error: 'Could not find Rotten Tomatoes score' }, { status: 404 })
  } catch (error) {
    console.error('RT refresh error:', error)
    return NextResponse.json({ error: 'Failed to scrape Rotten Tomatoes' }, { status: 500 })
  }
}
