import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const imdbId = request.nextUrl.searchParams.get('imdbId')

  if (!imdbId) {
    return NextResponse.json({ error: 'IMDB ID is required' }, { status: 400 })
  }

  try {
    const imdbUrl = `https://www.imdb.com/title/${imdbId}/`
    console.log('Scraping IMDB for fresh data:', imdbUrl)

    const response = await fetch(imdbUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch IMDB page' }, { status: response.status })
    }

    const html = await response.text()

    // Extract __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/__NEXT_DATA__[^{]*({.*?})\s*<\/script>/s)
    if (!nextDataMatch) {
      return NextResponse.json({ error: 'Could not parse IMDB page' }, { status: 500 })
    }

    let nextData
    try {
      nextData = JSON.parse(nextDataMatch[1])
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse IMDB JSON data' }, { status: 500 })
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
      imdbId,
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

    console.log('IMDB fresh data:', result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('IMDB refresh error:', error)
    return NextResponse.json({ error: 'Failed to scrape IMDB' }, { status: 500 })
  }
}
