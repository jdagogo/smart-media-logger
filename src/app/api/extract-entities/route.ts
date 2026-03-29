import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

interface ExtractedEntity {
  mentioned: string        // What the user actually said/typed
  resolved: string         // The correct name
  type: 'actor' | 'director' | 'cinematographer' | 'composer' | 'writer' | 'producer' | 'subject' | 'character' | 'other_person'
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  context?: string         // Brief context about why they mentioned this person
}

interface ExtractionResult {
  entities: ExtractedEntity[]
  themes: string[]         // What the user values/mentions (e.g., "cinematography", "pacing", "performances")
  overall_sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      comment,           // The user's raw comment text
      title,             // Film/show title
      year,              // Release year
      mediaType,         // 'movie', 'tv', 'music', etc.
      cast,              // Array of cast names from TMDB
      crew,              // Array of crew with name + job
      score              // User's rating (0-100)
    } = body

    if (!comment || comment.trim().length < 10) {
      return NextResponse.json({
        entities: [],
        themes: [],
        overall_sentiment: 'neutral'
      })
    }

    // Build context about the film for the LLM
    const castList = cast?.slice(0, 15)?.join(', ') || 'Unknown cast'
    const crewList = crew?.slice(0, 10)?.map((c: { name: string, job: string }) => `${c.name} (${c.job})`).join(', ') || 'Unknown crew'

    const prompt = `You are analyzing a user's comment about a piece of media they just watched. Your job is to extract PEOPLE mentioned and understand sentiment about each.

MEDIA CONTEXT:
- Title: ${title} (${year})
- Type: ${mediaType || 'movie'}
- User's Score: ${score !== undefined ? `${score}/100` : 'Not rated'}
- Known Cast: ${castList}
- Known Crew: ${crewList}

USER'S COMMENT:
"${comment}"

CRITICAL RULES - WHAT TO EXTRACT:
1. ONLY extract PEOPLE (actors, directors, writers, composers, real people, characters)
2. DO NOT extract film titles, TV shows, books, songs, or other media - even if mentioned
3. DO NOT extract concepts or metaphors (e.g., "Groundhog Day" as a concept meaning repetition is NOT a person)
4. DO NOT extract places, organizations, or abstract things

INSTRUCTIONS:
1. Extract only PEOPLE actually discussed with opinions or commentary - not casual name-drops
2. Prioritize people with substantive thoughts (praised their performance, criticized their work, etc.)
3. For misspelled/transcribed names, resolve to correct spelling using cast/crew list
4. Determine sentiment about each person's work
5. Extract themes: what aspects of filmmaking matter here?

CONTEXT FIELD FORMAT:
- Use observational/analytical language, never "you" or "the user"
- Examples: "Praised as 'super excellent'" or "Noted for compelling performance" or "Described as creepy in a positive sense"
- Quote key phrases directly when impactful: "Called 'absolutely brilliant'"
- Keep brief and clinical - this is data for an analytics dashboard

VOICE TRANSCRIPTION NOTES:
- "Carole King" might mean "Carole Kane"
- "Peter Hoosier" might mean "Peter Hujar"
- "that kid" or "the child actor" should resolve to actual actor name from cast

SENTIMENT CONTEXT:
- "creepy" in a horror film = POSITIVE (good acting)
- "super excellent", "wonderful", "great" = positive
- "crappy", "boring", "weak" = negative
- Mixed feelings or nuanced critique = mixed

Respond with ONLY valid JSON in this exact format:
{
  "entities": [
    {
      "mentioned": "exact text user said",
      "resolved": "correct full name",
      "type": "actor|director|cinematographer|composer|writer|producer|subject|character|other_person",
      "sentiment": "positive|negative|neutral|mixed",
      "context": "brief note about what they said"
    }
  ],
  "themes": ["performance", "cinematography", "pacing", etc],
  "overall_sentiment": "positive|negative|neutral|mixed"
}`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [
        { role: 'user', content: prompt }
      ]
    })

    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = responseText
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    // Try to parse, with fallback for common issues
    let result: ExtractionResult
    try {
      result = JSON.parse(jsonStr.trim())
    } catch (parseError) {
      // Try to fix common JSON issues
      let fixedJson = jsonStr.trim()
      // Remove trailing commas before } or ]
      fixedJson = fixedJson.replace(/,\s*([}\]])/g, '$1')
      // Try to extract just the JSON object if there's extra text
      const objectMatch = fixedJson.match(/\{[\s\S]*\}/)
      if (objectMatch) {
        fixedJson = objectMatch[0]
      }
      try {
        result = JSON.parse(fixedJson)
      } catch {
        // Last resort: return empty but valid result
        console.error('Could not parse JSON even after fixes:', jsonStr.substring(0, 200))
        result = { entities: [], themes: [], overall_sentiment: 'neutral' }
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Entity extraction error:', error)
    return NextResponse.json({
      entities: [],
      themes: [],
      overall_sentiment: 'neutral',
      error: 'Failed to extract entities'
    }, { status: 500 })
  }
}
