'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface VoiceInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}

// Entity types
type EntityType = 'actor' | 'director' | 'musician' | 'band' | 'composer'

// Known entities for recognition - extensive list with variations
const KNOWN_ENTITIES: Array<{ names: string[], type: EntityType }> = [
  // Directors - with common variations/misspellings
  { names: ['paul thomas anderson', 'p.t. anderson', 'pt anderson', 'pta'], type: 'director' },
  { names: ['sean baker'], type: 'director' },
  { names: ['greta gerwig', 'gerwig'], type: 'director' },
  { names: ['christopher nolan', 'chris nolan', 'nolan'], type: 'director' },
  { names: ['denis villeneuve', 'villeneuve', 'vileneuve', 'villnueve'], type: 'director' },
  { names: ['martin scorsese', 'scorsese', 'scorcese', 'marty scorsese'], type: 'director' },
  { names: ['steven spielberg', 'spielberg', 'speilberg'], type: 'director' },
  { names: ['quentin tarantino', 'tarantino', 'tarentino'], type: 'director' },
  { names: ['wes anderson'], type: 'director' },
  { names: ['david fincher', 'fincher'], type: 'director' },
  { names: ['ridley scott'], type: 'director' },
  { names: ['james cameron', 'cameron'], type: 'director' },
  { names: ['guillermo del toro', 'del toro'], type: 'director' },
  { names: ['alfonso cuaron', 'cuaron', 'cuarón'], type: 'director' },
  { names: ['spike lee'], type: 'director' },
  { names: ['sofia coppola', 'coppola'], type: 'director' },
  { names: ['yorgos lanthimos', 'lanthimos'], type: 'director' },
  { names: ['brady corbet', 'corbet'], type: 'director' },
  { names: ['coen brothers', 'the coens', 'coens'], type: 'director' },
  { names: ['michael mann', 'mann'], type: 'director' },
  { names: ['david lynch', 'lynch'], type: 'director' },
  { names: ['terrence malick', 'malick'], type: 'director' },
  { names: ['paul schrader', 'schrader'], type: 'director' },
  { names: ['darren aronofsky', 'aronofsky'], type: 'director' },

  // Actors - with common variations
  { names: ['joaquin phoenix', 'joaquin', 'phoenix', 'waukeen phoenix'], type: 'actor' },
  { names: ['mikey madison', 'madison'], type: 'actor' },
  { names: ['timothee chalamet', 'timothée chalamet', 'chalamet', 'timothy chalamet', 'timmy chalamet'], type: 'actor' },
  { names: ['florence pugh', 'pugh'], type: 'actor' },
  { names: ['margot robbie', 'robbie'], type: 'actor' },
  { names: ['ryan gosling', 'gosling'], type: 'actor' },
  { names: ['emma stone'], type: 'actor' },
  { names: ['daniel day-lewis', 'day lewis', 'day-lewis', 'daniel day lewis'], type: 'actor' },
  { names: ['robert de niro', 'deniro', 'de niro', 'robert deniro'], type: 'actor' },
  { names: ['al pacino', 'pacino'], type: 'actor' },
  { names: ['meryl streep', 'streep'], type: 'actor' },
  { names: ['cate blanchett', 'blanchett', 'blanchet'], type: 'actor' },
  { names: ['leonardo dicaprio', 'dicaprio', 'leo dicaprio', 'leonardo di caprio', 'leo decaprio', 'leo', 'leo di caprio', 'leonardo de caprio'], type: 'actor' },
  { names: ['brad pitt', 'pitt'], type: 'actor' },
  { names: ['tom hanks', 'hanks'], type: 'actor' },
  { names: ['denzel washington', 'denzel'], type: 'actor' },
  { names: ['samuel l jackson', 'samuel jackson', 'sam jackson'], type: 'actor' },
  { names: ['scarlett johansson', 'johansson', 'scarlet johansson'], type: 'actor' },
  { names: ['jennifer lawrence', 'j law'], type: 'actor' },
  { names: ['viola davis'], type: 'actor' },
  { names: ['austin butler', 'butler'], type: 'actor' },
  { names: ['zendaya'], type: 'actor' },
  { names: ['pedro pascal', 'pascal'], type: 'actor' },
  { names: ['oscar isaac'], type: 'actor' },
  { names: ['adam driver', 'driver'], type: 'actor' },
  { names: ['colin farrell', 'farrell', 'farell'], type: 'actor' },
  { names: ['barry keoghan', 'keoghan'], type: 'actor' },
  { names: ['paul mescal', 'mescal'], type: 'actor' },
  { names: ['andrew garfield', 'garfield'], type: 'actor' },
  { names: ['adrien brody', 'brody'], type: 'actor' },
  { names: ['saoirse ronan', 'saoirse', 'sersha ronan'], type: 'actor' },
  { names: ['robert pattinson', 'pattinson', 'r patz'], type: 'actor' },
  { names: ['christian bale', 'bale'], type: 'actor' },
  { names: ['matt damon', 'damon'], type: 'actor' },
  { names: ['natalie portman', 'portman'], type: 'actor' },
  { names: ['jake gyllenhaal', 'gyllenhaal', 'jake gyllenhall'], type: 'actor' },
  { names: ['anne hathaway', 'hathaway'], type: 'actor' },
  { names: ['michael fassbender', 'fassbender'], type: 'actor' },
  { names: ['jessica chastain', 'chastain'], type: 'actor' },
  { names: ['amy adams'], type: 'actor' },
  { names: ['sean penn', 'penn', 'shawn penn', 'shaun penn'], type: 'actor' },
  { names: ['benicio del toro', 'benicio', 'del toro', 'benicio deltoro', 'benecio del toro'], type: 'actor' },
  { names: ['javier bardem', 'bardem'], type: 'actor' },
  { names: ['penelope cruz', 'penélope cruz', 'cruz'], type: 'actor' },
  { names: ['michael keaton', 'keaton'], type: 'actor' },
  { names: ['nicolas cage', 'nic cage', 'cage'], type: 'actor' },
  { names: ['jeff bridges', 'bridges'], type: 'actor' },
  { names: ['john malkovich', 'malkovich'], type: 'actor' },
  { names: ['gary oldman', 'oldman'], type: 'actor' },
  { names: ['willem dafoe', 'dafoe'], type: 'actor' },
  { names: ['ethan hawke', 'hawke'], type: 'actor' },
  { names: ['mark ruffalo', 'ruffalo'], type: 'actor' },
  { names: ['michael b jordan', 'michael b. jordan'], type: 'actor' },
  { names: ['idris elba', 'elba'], type: 'actor' },
  { names: ['mahershala ali', 'mahershala'], type: 'actor' },
  { names: ['rami malek', 'malek'], type: 'actor' },
  { names: ['casey affleck', 'affleck'], type: 'actor' },
  { names: ['ben affleck'], type: 'actor' },
  { names: ['joaquin phoenix', 'phoenix'], type: 'actor' },
  { names: ['michael shannon', 'shannon'], type: 'actor' },
  { names: ['michael bauman', 'bauman'], type: 'actor' },
  { names: ['chazz palminteri', 'palminteri'], type: 'actor' },

  // Musicians / Solo Artists
  { names: ['tom petty', 'petty'], type: 'musician' },
  { names: ['bob dylan', 'dylan'], type: 'musician' },
  { names: ['bruce springsteen', 'springsteen', 'the boss'], type: 'musician' },
  { names: ['prince', 'prince rogers nelson'], type: 'musician' },
  { names: ['david bowie', 'bowie'], type: 'musician' },
  { names: ['elton john', 'elton'], type: 'musician' },
  { names: ['billy joel', 'joel'], type: 'musician' },
  { names: ['stevie wonder', 'stevie'], type: 'musician' },
  { names: ['paul mccartney', 'mccartney'], type: 'musician' },
  { names: ['john lennon', 'lennon'], type: 'musician' },
  { names: ['mick jagger', 'jagger'], type: 'musician' },
  { names: ['keith richards', 'richards'], type: 'musician' },
  { names: ['eric clapton', 'clapton'], type: 'musician' },
  { names: ['jimi hendrix', 'hendrix'], type: 'musician' },
  { names: ['neil young', 'young'], type: 'musician' },
  { names: ['joni mitchell', 'mitchell'], type: 'musician' },
  { names: ['taylor swift', 'swift'], type: 'musician' },
  { names: ['beyonce', 'beyoncé'], type: 'musician' },
  { names: ['kendrick lamar', 'kendrick'], type: 'musician' },
  { names: ['kanye west', 'kanye', 'ye'], type: 'musician' },
  { names: ['frank ocean', 'frank'], type: 'musician' },
  { names: ['donald fagen', 'fagen'], type: 'musician' },
  { names: ['walter becker', 'becker'], type: 'musician' },
  { names: ['chase infiniti', 'chase infinity'], type: 'musician' },

  // Bands
  { names: ['steely dan', 'stealy dan', 'steeley dan', 'steely dan'], type: 'band' },
  { names: ['the beatles', 'beatles'], type: 'band' },
  { names: ['the rolling stones', 'rolling stones', 'stones'], type: 'band' },
  { names: ['led zeppelin', 'zeppelin'], type: 'band' },
  { names: ['pink floyd', 'floyd'], type: 'band' },
  { names: ['the who', 'who'], type: 'band' },
  { names: ['fleetwood mac', 'fleetwood'], type: 'band' },
  { names: ['eagles', 'the eagles'], type: 'band' },
  { names: ['radiohead'], type: 'band' },
  { names: ['nirvana'], type: 'band' },
  { names: ['pearl jam'], type: 'band' },
  { names: ['u2'], type: 'band' },
  { names: ['coldplay'], type: 'band' },
  { names: ['foo fighters', 'foos'], type: 'band' },
  { names: ['the strokes', 'strokes'], type: 'band' },
  { names: ['arcade fire'], type: 'band' },
  { names: ['vampire weekend'], type: 'band' },
  { names: ['tame impala'], type: 'band' },
  { names: ['tom petty and the heartbreakers', 'the heartbreakers', 'heartbreakers'], type: 'band' },

  // Composers
  { names: ['hans zimmer', 'zimmer'], type: 'composer' },
  { names: ['john williams', 'williams'], type: 'composer' },
  { names: ['ennio morricone', 'morricone'], type: 'composer' },
  { names: ['jonny greenwood', 'greenwood'], type: 'composer' },
  { names: ['trent reznor', 'reznor'], type: 'composer' },
  { names: ['atticus ross', 'ross'], type: 'composer' },
  { names: ['thomas newman', 'newman'], type: 'composer' },
  { names: ['daniel blumberg', 'blumberg'], type: 'composer' },
]

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

// Check if a sequence of words matches a known entity
function matchEntitySequence(words: string[], startIdx: number): { match: { name: string, type: EntityType }, wordCount: number } | null {
  // Try 4-word, 3-word, 2-word, then 1-word matches
  for (let len = 4; len >= 1; len--) {
    if (startIdx + len > words.length) continue

    const phrase = words.slice(startIdx, startIdx + len).join(' ').toLowerCase().replace(/[.,!?;:'"()]/g, '').trim()
    if (phrase.length < 2) continue

    for (const entity of KNOWN_ENTITIES) {
      for (const name of entity.names) {
        const normalizedName = name.toLowerCase().trim()

        // Exact match
        if (normalizedName === phrase) {
          return { match: { name: entity.names[0], type: entity.type }, wordCount: len }
        }

        // Contains match for multi-word entities (e.g., "steely dan" in "i love steely dan's music")
        if (normalizedName.length >= 6 && phrase.includes(normalizedName)) {
          return { match: { name: entity.names[0], type: entity.type }, wordCount: len }
        }

        // Fuzzy match - VERY lenient for voice recognition errors
        if (phrase.length >= 3 && normalizedName.length >= 3) {
          const distance = levenshteinDistance(normalizedName, phrase)
          // Super lenient: allow 1 error per 2.5 characters (was 3)
          // This helps with speech recognition errors like "stealy dan" or "shawn penn"
          const threshold = Math.max(2, Math.floor(normalizedName.length / 2.5))
          if (distance <= threshold) {
            return { match: { name: entity.names[0], type: entity.type }, wordCount: len }
          }
        }

        // Also try matching if phrase starts with the entity name
        if (phrase.startsWith(normalizedName + ' ') || phrase.startsWith(normalizedName + "'")) {
          return { match: { name: entity.names[0], type: entity.type }, wordCount: len }
        }
      }
    }
  }
  return null
}

// Get color classes for entity type
function getEntityColors(type: EntityType): string {
  switch (type) {
    case 'director':
      return 'bg-purple-100 text-purple-700 border-purple-300'
    case 'actor':
      return 'bg-blue-100 text-blue-700 border-blue-300'
    case 'musician':
      return 'bg-green-100 text-green-700 border-green-300'
    case 'band':
      return 'bg-orange-100 text-orange-700 border-orange-300'
    case 'composer':
      return 'bg-pink-100 text-pink-700 border-pink-300'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300'
  }
}

// Get label for entity type
function getEntityLabel(type: EntityType): string {
  switch (type) {
    case 'director': return 'Director'
    case 'actor': return 'Actor'
    case 'musician': return 'Musician'
    case 'band': return 'Band'
    case 'composer': return 'Composer'
    default: return 'Entity'
  }
}

// Highlight entities in text - returns JSX with highlighted names
// EXPORTED so it can be used in notes display elsewhere
export function highlightEntities(text: string): React.ReactNode {
  if (!text) return null

  const words = text.split(/(\s+)/)
  const parts: React.ReactNode[] = []
  let i = 0
  let keyIndex = 0

  while (i < words.length) {
    const word = words[i]

    // Skip whitespace
    if (/^\s+$/.test(word)) {
      parts.push(<span key={keyIndex++}>{word}</span>)
      i++
      continue
    }

    // Get non-whitespace words for matching (look ahead up to 5 words)
    const remainingWords: string[] = []
    for (let j = i; j < words.length && remainingWords.length < 5; j++) {
      if (!/^\s+$/.test(words[j])) {
        remainingWords.push(words[j])
      }
    }

    const match = matchEntitySequence(remainingWords, 0)

    if (match) {
      // Collect the matched words including whitespace between them
      const matchedParts: string[] = []
      let wordsCollected = 0
      let j = i
      while (wordsCollected < match.wordCount && j < words.length) {
        matchedParts.push(words[j])
        if (!/^\s+$/.test(words[j])) {
          wordsCollected++
        }
        j++
      }

      parts.push(
        <span
          key={keyIndex++}
          className={`inline-block px-1.5 py-0.5 mx-0.5 rounded border font-semibold text-sm ${getEntityColors(match.match.type)}`}
          title={`${getEntityLabel(match.match.type)}: ${match.match.name}`}
        >
          {matchedParts.join('')}
        </span>
      )
      i = j
    } else {
      parts.push(<span key={keyIndex++}>{word}</span>)
      i++
    }
  }

  return <>{parts}</>
}

export default function VoiceInput({
  value,
  onChange,
  placeholder = '',
  className = '',
  multiline = false,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [showRecordingUI, setShowRecordingUI] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Track the accumulated transcript within this recording session
  const sessionTranscriptRef = useRef<string>('')
  // Track which result indices we've already processed as final
  const processedResultsRef = useRef<Set<number>>(new Set())

  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    )
  }, [])

  // Auto-scroll transcript to bottom when new content arrives
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [value, interimTranscript])

  const startRecognition = useCallback(() => {
    if (!isSupported) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let newFinalText = ''

      // Process each result
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          // Only process this result if we haven't already
          if (!processedResultsRef.current.has(i)) {
            processedResultsRef.current.add(i)
            newFinalText += transcript + ' '
          }
        } else {
          // This is interim (not yet final)
          interim += transcript
        }
      }

      setInterimTranscript(interim)

      // If we have NEW final text, append it to the session transcript
      if (newFinalText.trim()) {
        sessionTranscriptRef.current = sessionTranscriptRef.current
          ? `${sessionTranscriptRef.current} ${newFinalText.trim()}`
          : newFinalText.trim()

        // Update the parent with the full session transcript
        onChangeRef.current(sessionTranscriptRef.current)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'no-speech') {
        // Just a timeout, not a real error - keep going
        return
      }
      setIsListening(false)
    }

    recognition.start()
  }, [isSupported])

  const startListening = useCallback(() => {
    // Initialize session with any existing value
    sessionTranscriptRef.current = value
    processedResultsRef.current = new Set()

    setShowRecordingUI(true)
    setRecordingSeconds(0)
    setInterimTranscript('')
    timerRef.current = setInterval(() => {
      setRecordingSeconds(s => s + 1)
    }, 1000)
    startRecognition()
  }, [startRecognition, value])

  const pauseListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setInterimTranscript('')
  }, [])

  const resumeListening = useCallback(() => {
    // Reset processed results since new recognition session has fresh results array
    processedResultsRef.current = new Set()
    startRecognition()
  }, [startRecognition])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setShowRecordingUI(false)
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Count words captured
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0

  const inputClasses = `
    w-full px-6 py-5 pr-16
    bg-paper-100 border-2
    rounded-xl text-ink-800 text-lg
    placeholder:text-ink-400
    focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue
    transition-colors
    ${showRecordingUI ? 'border-red-500 ring-2 ring-red-200' : 'border-paper-400'}
    ${className}
  `

  return (
    <div className="relative">
      {/* RECORDING UI - Shows everything captured */}
      {showRecordingUI && (
        <div
          className="absolute inset-x-0 top-0 z-10 bg-white border-4 border-red-500 rounded-xl overflow-hidden flex flex-col shadow-2xl"
          style={{ minHeight: multiline ? '350px' : '280px' }}
        >
          {/* Header bar */}
          <div className={`${isListening ? 'bg-red-600' : 'bg-amber-500'} text-white px-4 py-3 flex items-center justify-between flex-shrink-0`}>
            <div className="flex items-center gap-3">
              {isListening ? (
                <>
                  <span className="w-4 h-4 bg-white rounded-full animate-pulse"></span>
                  <span className="font-bold text-lg">RECORDING</span>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 bg-white rounded-full opacity-60"></span>
                  <span className="font-bold text-lg">PAUSED</span>
                </>
              )}
              <span className="text-white/60">|</span>
              <span className="font-mono text-lg">{formatTime(recordingSeconds)}</span>
              <span className="text-white/60">|</span>
              <span className="font-semibold">{wordCount} words captured</span>
            </div>

            {/* Control buttons - MUST have type="button" to prevent form submission */}
            <div className="flex items-center gap-2">
              {isListening ? (
                <button
                  type="button"
                  onClick={pauseListening}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  ⏸ PAUSE
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeListening}
                  className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  ▶ RESUME
                </button>
              )}
              <button
                type="button"
                onClick={stopListening}
                className="bg-white text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                ✓ DONE
              </button>
            </div>
          </div>

          {/* Transcript area - SCROLLABLE - THIS SHOWS EVERYTHING */}
          <div
            ref={transcriptRef}
            className="flex-1 p-5 overflow-y-auto bg-gray-50"
            style={{ maxHeight: '200px', minHeight: '120px' }}
          >
            {value || interimTranscript ? (
              <div className="text-ink-800 leading-relaxed text-lg space-y-1">
                {/* All captured text with entity highlighting */}
                {value && (
                  <span>{highlightEntities(value)}</span>
                )}
                {/* Current interim in red italic */}
                {interimTranscript && (
                  <span className="text-red-500 italic"> {interimTranscript}...</span>
                )}
              </div>
            ) : (
              <div className="text-gray-400 italic text-lg flex items-center justify-center h-full">
                {isListening
                  ? '🎤 Listening... speak now and your words will appear here'
                  : 'Click RESUME to continue recording'
                }
              </div>
            )}
          </div>

          {/* Legend for entity colors */}
          <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex items-center gap-4 text-xs flex-shrink-0">
            <span className="text-gray-500">Entity recognition:</span>
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 border border-blue-300 rounded">Actor</span>
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-300 rounded">Director</span>
          </div>

          {/* Footer with status */}
          <div className={`px-4 py-3 text-sm text-center border-t flex-shrink-0 ${
            isListening
              ? 'bg-red-100 text-red-800 border-red-200'
              : 'bg-amber-100 text-amber-800 border-amber-200'
          }`}>
            {isListening ? (
              <strong>🔴 Everything you say is being saved. All {wordCount} words are captured.</strong>
            ) : (
              <strong>⏸ Paused. Your {wordCount} words are safely saved. Click RESUME to add more.</strong>
            )}
          </div>
        </div>
      )}

      {/* The actual input/textarea */}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClasses} min-h-[120px] resize-none`}
          rows={5}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClasses}
        />
      )}

      {/* Mic button - only show when not recording */}
      {isSupported && !showRecordingUI && (
        <button
          type="button"
          onClick={startListening}
          className="absolute right-3 top-3 z-20 p-3 rounded-full hover:bg-accent-blue/10 text-ink-500 hover:text-accent-blue transition-all duration-200"
          title="Click to speak"
        >
          <span className="text-2xl opacity-60 hover:opacity-100">🎤</span>
        </button>
      )}
    </div>
  )
}
