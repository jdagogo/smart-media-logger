import { NextRequest, NextResponse } from 'next/server'

// Fetch real critic scores from Metacritic and Rotten Tomatoes
export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')
  const year = request.nextUrl.searchParams.get('year')
  const mediaType = request.nextUrl.searchParams.get('type') || 'movie'

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  try {
    // Fetch both in parallel
    const [metacriticData, rottenTomatoesData] = await Promise.all([
      fetchMetacriticData(title, year, mediaType),
      fetchRottenTomatoesData(title, year, mediaType),
    ])

    return NextResponse.json({
      metacritic: metacriticData,
      rottenTomatoes: rottenTomatoesData,
    })
  } catch (error) {
    console.error('Critic scores fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch critic scores' }, { status: 500 })
  }
}

// Fetch Metacritic data by scraping their search/movie page
async function fetchMetacriticData(title: string, year: string | null, mediaType: string) {
  try {
    // Construct search URL - Metacritic uses kebab-case
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    const url = `https://www.metacritic.com/${mediaType}/${slug}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`Metacritic fetch failed for ${slug}: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Extract metascore from the page
    const scoreMatch = html.match(/data-metascore="(\d+)"/) ||
                       html.match(/<span[^>]*class="[^"]*metascore[^"]*"[^>]*>(\d+)<\/span>/) ||
                       html.match(/metascore_w[^>]*>(\d+)</)

    // Extract critic reviews count
    const criticCountMatch = html.match(/based on (\d+) Critic/i) ||
                             html.match(/(\d+) Critic Reviews/i)

    // Extract user score
    const userScoreMatch = html.match(/data-userscore="([\d.]+)"/) ||
                           html.match(/<span[^>]*class="[^"]*user[^"]*"[^>]*>([\d.]+)<\/span>/)

    // Try to extract summary/description
    const summaryMatch = html.match(/<span[^>]*class="[^"]*blurb[^"]*"[^>]*>([^<]+)<\/span>/) ||
                         html.match(/<div[^>]*class="[^"]*summary[^"]*"[^>]*>([^<]+)</)

    if (!scoreMatch) {
      console.log('No Metacritic score found for:', title)
      return null
    }

    return {
      score: parseInt(scoreMatch[1]),
      criticReviews: criticCountMatch ? parseInt(criticCountMatch[1]) : undefined,
      userScore: userScoreMatch ? parseFloat(userScoreMatch[1]) : undefined,
      summary: summaryMatch ? summaryMatch[1].trim() : undefined,
      url,
    }
  } catch (error) {
    console.error('Metacritic scraping error:', error)
    return null
  }
}

// Fetch Rotten Tomatoes data
async function fetchRottenTomatoesData(title: string, year: string | null, mediaType: string) {
  try {
    // Construct URL - RT uses underscores
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')

    const prefix = mediaType === 'movie' ? 'm' : 'tv'
    const url = `https://www.rottentomatoes.com/${prefix}/${slug}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`RT fetch failed for ${slug}: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Extract tomatometer score
    const tomatometerMatch = html.match(/data-audiencescore="(\d+)"/) ||
                             html.match(/tomatometer[^>]*>(\d+)%/) ||
                             html.match(/"tomatometerScore":(\d+)/) ||
                             html.match(/criticsscore[^>]*>(\d+)/i)

    // Extract audience score
    const audienceMatch = html.match(/data-audiencescore="(\d+)"/) ||
                          html.match(/audience-score[^>]*>(\d+)%/) ||
                          html.match(/"audienceScore":(\d+)/)

    // Extract critic count
    const criticCountMatch = html.match(/(\d+) Reviews/) ||
                             html.match(/"criticsReviewsTotal":(\d+)/)

    // Extract consensus
    const consensusMatch = html.match(/data-consensus="([^"]+)"/) ||
                           html.match(/<span[^>]*id="movieSynopsis"[^>]*>([^<]+)</) ||
                           html.match(/"criticsConsensus":"([^"]+)"/)

    // Try to find the score in JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/g)
    let aggregateRating = null
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '')
          const data = JSON.parse(jsonContent)
          if (data.aggregateRating) {
            aggregateRating = data.aggregateRating
            break
          }
        } catch (e) {
          // Continue to next match
        }
      }
    }

    // Use JSON-LD data if available
    let tomatometer = tomatometerMatch ? parseInt(tomatometerMatch[1]) : undefined
    let audienceScore = audienceMatch ? parseInt(audienceMatch[1]) : undefined

    if (aggregateRating && !tomatometer) {
      tomatometer = Math.round(aggregateRating.ratingValue * 10)
    }

    if (!tomatometer && !audienceScore) {
      console.log('No RT scores found for:', title)
      return null
    }

    return {
      tomatometer,
      audienceScore,
      criticReviews: criticCountMatch ? parseInt(criticCountMatch[1]) : undefined,
      consensus: consensusMatch ? consensusMatch[1].trim().replace(/&quot;/g, '"').replace(/&#x27;/g, "'") : undefined,
      url,
    }
  } catch (error) {
    console.error('RT scraping error:', error)
    return null
  }
}
