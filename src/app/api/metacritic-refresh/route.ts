import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')
  const year = request.nextUrl.searchParams.get('year')

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  try {
    // Build the Metacritic URL slug
    const slug = title
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Try without year first since MC often doesn't include it
    const urlsToTry = [
      `https://www.metacritic.com/movie/${slug}/`,
      `https://www.metacritic.com/movie/${slug}`,
      ...(year ? [
        `https://www.metacritic.com/movie/${slug}-${year}/`,
        `https://www.metacritic.com/movie/${slug}-${year}`,
      ] : []),
    ]

    console.log('Scraping Metacritic for:', title, 'URLs to try:', urlsToTry)

    for (const metacriticUrl of urlsToTry) {
      console.log('Trying Metacritic URL:', metacriticUrl)

      const response = await fetch(metacriticUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
      })

      console.log('Metacritic response:', response.status, response.url, 'headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        // Try to read response body to see what error page looks like
        const errorBody = await response.text()
        console.log('Metacritic response not ok:', response.status, 'body preview:', errorBody.substring(0, 500))
        continue
      }

      // Check if we got redirected to a different page
      if (response.url !== metacriticUrl) {
        console.log('Metacritic redirected to:', response.url)
      }

      const html = await response.text()
      console.log('Metacritic HTML length:', html.length)

      // Method 0: Look for score in __NUXT__ data (Metacritic uses Nuxt.js)
      const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i)
      if (nuxtMatch) {
        try {
          // This is a JS object, not JSON, so we need to be careful
          // Look for metaScore or criticScore patterns
          const nuxtStr = nuxtMatch[1]
          const scoreMatch = nuxtStr.match(/"score"\s*:\s*(\d+)/) ||
                            nuxtStr.match(/"metaScore"\s*:\s*(\d+)/) ||
                            nuxtStr.match(/"criticScore"\s*:\s*(\d+)/) ||
                            nuxtStr.match(/metascore['"]\s*:\s*(\d+)/i)
          if (scoreMatch) {
            const score = parseInt(scoreMatch[1])
            if (score >= 0 && score <= 100) {
              console.log('Metacritic from __NUXT__:', score)
              return NextResponse.json({
                metacriticScore: score,
                url: metacriticUrl,
                source: 'nuxt-data',
              })
            }
          }
        } catch (e) {
          console.log('Failed to parse Metacritic __NUXT__')
        }
      }

      // Method 0b: Look for score directly in HTML class patterns
      const directScoreMatch = html.match(/c-siteReviewScore[^>]*>\s*<span[^>]*>(\d+)<\/span>/i) ||
                              html.match(/metascore_w[^>]*>(\d+)</i) ||
                              html.match(/data-v-[^>]*class="[^"]*score[^"]*"[^>]*>(\d+)</i)
      if (directScoreMatch) {
        const score = parseInt(directScoreMatch[1])
        if (score >= 0 && score <= 100) {
          console.log('Metacritic from direct HTML pattern:', score)
          return NextResponse.json({
            metacriticScore: score,
            url: metacriticUrl,
            source: 'html-direct',
          })
        }
      }

      // Log potential score patterns for debugging
      const scorePatterns = html.match(/(\d{1,2})<\/span>.*?(metascore|score|rating)/gi)?.slice(0, 5) ||
                           html.match(/(metascore|critic.*?score).*?(\d{1,2})/gi)?.slice(0, 5)
      if (scorePatterns) {
        console.log('Found potential score patterns:', scorePatterns)
      }

      // Method 1: Look for metascore in the JSON-LD data - there may be multiple blocks
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
      for (const jsonLdMatch of jsonLdMatches) {
        console.log('Found JSON-LD block:', jsonLdMatch[1].substring(0, 300))
        try {
          const jsonData = JSON.parse(jsonLdMatch[1])
          console.log('JSON-LD parsed, type:', jsonData['@type'], 'aggregateRating:', jsonData.aggregateRating)
          if (jsonData.aggregateRating?.ratingValue) {
            const score = Math.round(parseFloat(jsonData.aggregateRating.ratingValue))
            const reviewCount = jsonData.aggregateRating.ratingCount || jsonData.aggregateRating.reviewCount
            console.log('Metacritic from JSON-LD:', score)
            return NextResponse.json({
              metacriticScore: score,
              reviewCount,
              url: metacriticUrl,
              source: 'json-ld',
            })
          }
        } catch (e) {
          console.log('Failed to parse Metacritic JSON-LD')
        }
      }

      // Method 2: Look for the metascore in meta tags
      const metaScoreMatch = html.match(/data-metascore="(\d+)"/) ||
                            html.match(/class="[^"]*metascore[^"]*"[^>]*>(\d+)</) ||
                            html.match(/<span[^>]*class="[^"]*metascore_w[^"]*"[^>]*>(\d+)<\/span>/i)
      if (metaScoreMatch) {
        const score = parseInt(metaScoreMatch[1])
        console.log('Metacritic from HTML pattern:', score)
        return NextResponse.json({
          metacriticScore: score,
          url: metacriticUrl,
          source: 'html-pattern',
        })
      }

      // Method 3: Look in __NEXT_DATA__ for score
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/i)
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1])
          // Navigate the complex structure
          const score = nextData?.props?.pageProps?.product?.criticScoreSummary?.score ||
                       nextData?.props?.pageProps?.pageData?.criticScoreSummary?.score
          if (score) {
            console.log('Metacritic from __NEXT_DATA__:', score)
            return NextResponse.json({
              metacriticScore: Math.round(score),
              url: metacriticUrl,
              source: 'next-data',
            })
          }
        } catch (e) {
          console.log('Failed to parse Metacritic __NEXT_DATA__')
        }
      }

      // Method 4: Generic score extraction
      const genericScoreMatch = html.match(/metascore[^>]*>\s*(\d{1,3})\s*</) ||
                               html.match(/"score":\s*(\d{1,3})/) ||
                               html.match(/criticScore[^}]*"score":\s*(\d{1,3})/)
      if (genericScoreMatch) {
        const score = parseInt(genericScoreMatch[1])
        if (score >= 0 && score <= 100) {
          console.log('Metacritic from generic pattern:', score)
          return NextResponse.json({
            metacriticScore: score,
            url: metacriticUrl,
            source: 'generic-pattern',
          })
        }
      }
    }

    return NextResponse.json({ error: 'Could not find Metacritic score' }, { status: 404 })
  } catch (error) {
    console.error('Metacritic refresh error:', error)
    return NextResponse.json({ error: 'Failed to scrape Metacritic' }, { status: 500 })
  }
}
