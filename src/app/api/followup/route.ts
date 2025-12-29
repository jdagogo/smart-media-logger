import { NextRequest, NextResponse } from 'next/server'

// Generate smart follow-up questions based on user's feedback
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { notes, title, director, rating, mediaType } = body

  if (!notes || notes.trim().length < 10) {
    // Not enough input to generate smart follow-ups
    return NextResponse.json({
      questions: [
        "What was the most memorable moment?",
        "How did it make you feel?",
        "Would you watch it again?"
      ]
    })
  }

  // Analyze the user's notes and generate contextual follow-up questions
  const followUpQuestions = generateSmartFollowUps(notes, title, director, rating, mediaType)

  return NextResponse.json({ questions: followUpQuestions })
}

function generateSmartFollowUps(
  notes: string,
  title: string,
  director?: string,
  rating?: number,
  mediaType?: string
): string[] {
  const notesLower = notes.toLowerCase()
  const questions: string[] = []

  // Detect what they talked about and ask deeper questions

  // CINEMATOGRAPHY / VISUALS
  if (notesLower.includes('cinematograph') || notesLower.includes('visual') ||
      notesLower.includes('shot') || notesLower.includes('camera') ||
      notesLower.includes('beautiful') || notesLower.includes('stunning')) {
    questions.push("What specific shots or visual moments stood out? Can you describe one?")
  }

  // ACTING / PERFORMANCES
  if (notesLower.includes('acting') || notesLower.includes('performance') ||
      notesLower.includes('actor') || notesLower.includes('actress') ||
      notesLower.includes('played') || notesLower.includes('portrayed')) {
    questions.push("Which performance surprised you the most, and why?")
  }

  // Specific actor mentions - extract names and ask about them
  const actorPatterns = [
    /(\w+(?:\s\w+)?)\s+(?:was|is)\s+(?:incredible|amazing|great|terrible|awful|good|bad)/gi,
    /loved\s+(\w+(?:\s\w+)?)/gi,
    /(\w+(?:\s\w+)?)\s+(?:stole|steals)\s+(?:the\s+)?(?:show|scene)/gi
  ]
  for (const pattern of actorPatterns) {
    const match = pattern.exec(notes)
    if (match && match[1] && match[1].length > 2) {
      questions.push(`You mentioned ${match[1]} - what specifically did they bring to their role?`)
      break
    }
  }

  // ENDING / CONCLUSION
  if (notesLower.includes('ending') || notesLower.includes('ended') ||
      notesLower.includes('conclusion') || notesLower.includes('finale')) {
    if (notesLower.includes('rushed') || notesLower.includes('abrupt') || notesLower.includes('sudden')) {
      questions.push("How would you have paced or changed the ending?")
    } else if (notesLower.includes('perfect') || notesLower.includes('satisfying') || notesLower.includes('loved')) {
      questions.push("What made the ending work so well for you?")
    } else if (notesLower.includes('confus') || notesLower.includes('didn\'t understand') || notesLower.includes('lost')) {
      questions.push("What questions did the ending leave you with?")
    } else {
      questions.push("How did the ending land for you emotionally?")
    }
  }

  // PACING
  if (notesLower.includes('slow') || notesLower.includes('pacing') ||
      notesLower.includes('dragged') || notesLower.includes('boring') ||
      notesLower.includes('fast') || notesLower.includes('rushed')) {
    questions.push("Were there specific parts that felt too slow or too fast?")
  }

  // EMOTIONAL RESPONSE
  if (notesLower.includes('cried') || notesLower.includes('cry') ||
      notesLower.includes('tears') || notesLower.includes('emotional') ||
      notesLower.includes('moved') || notesLower.includes('felt')) {
    questions.push("What moment hit you the hardest emotionally?")
  }

  // MUSIC / SCORE
  if (notesLower.includes('music') || notesLower.includes('score') ||
      notesLower.includes('soundtrack') || notesLower.includes('song')) {
    questions.push("Were there specific musical moments that elevated a scene?")
  }

  // STORY / PLOT
  if (notesLower.includes('story') || notesLower.includes('plot') ||
      notesLower.includes('twist') || notesLower.includes('predictable') ||
      notesLower.includes('surprised') || notesLower.includes('expected')) {
    questions.push("What did the story do that you didn't expect?")
  }

  // THEMES / DEEPER MEANING
  if (notesLower.includes('theme') || notesLower.includes('meaning') ||
      notesLower.includes('message') || notesLower.includes('about') ||
      notesLower.includes('saying') || notesLower.includes('metaphor')) {
    questions.push("What do you think the film was really trying to say?")
  }

  // COMPARISON mentions
  if (notesLower.includes('like') || notesLower.includes('similar') ||
      notesLower.includes('reminded') || notesLower.includes('compared') ||
      notesLower.includes('better than') || notesLower.includes('worse than')) {
    questions.push("What other films or shows does this remind you of, and how does it compare?")
  }

  // NEGATIVE FEEDBACK
  if (notesLower.includes('didn\'t like') || notesLower.includes('hated') ||
      notesLower.includes('annoyed') || notesLower.includes('frustrat') ||
      notesLower.includes('problem') || notesLower.includes('issue') ||
      notesLower.includes('weak') || notesLower.includes('bad')) {
    questions.push("If you could change one thing about it, what would it be?")
  }

  // POSITIVE FEEDBACK
  if (notesLower.includes('loved') || notesLower.includes('amazing') ||
      notesLower.includes('incredible') || notesLower.includes('masterpiece') ||
      notesLower.includes('perfect') || notesLower.includes('favorite')) {
    questions.push("What makes this stand out from other things you've seen recently?")
  }

  // CHARACTER mentions
  if (notesLower.includes('character') || notesLower.includes('protagonist') ||
      notesLower.includes('villain') || notesLower.includes('arc')) {
    questions.push("Which character's journey resonated with you most?")
  }

  // DIRECTOR style (if director is known)
  if (director && (notesLower.includes('direct') || notesLower.includes('style') ||
      notesLower.includes(director.toLowerCase().split(' ')[0]))) {
    questions.push(`How does this fit into ${director}'s body of work for you?`)
  }

  // REWATCH value
  if (notesLower.includes('watch again') || notesLower.includes('rewatch') ||
      notesLower.includes('see again') || notesLower.includes('second time')) {
    questions.push("What would you be looking for on a rewatch?")
  }

  // If rating is very high or low, ask about it
  if (rating !== undefined) {
    if (rating >= 90 && !questions.some(q => q.includes('stand out'))) {
      questions.push("You rated this very highly - what pushes it into elite territory for you?")
    } else if (rating <= 40 && !questions.some(q => q.includes('change'))) {
      questions.push("What would have needed to be different for this to work better for you?")
    }
  }

  // Limit to 3-4 most relevant questions
  const finalQuestions = questions.slice(0, 4)

  // If we didn't detect anything specific, ask general but still thoughtful questions
  if (finalQuestions.length === 0) {
    return [
      "What will you remember most about this a year from now?",
      "Who would you recommend this to, and who should avoid it?",
      "Did this change how you think about anything?"
    ]
  }

  return finalQuestions
}
