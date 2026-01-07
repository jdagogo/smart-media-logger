'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import VoiceInput from '@/components/shared/VoiceInput'
import RatingSlider from '@/components/shared/RatingSlider'
import RightPaneTabs, { LoggedItem } from '@/components/right-pane/RightPaneTabs'
import QuestionCard from '@/components/left-pane/QuestionCard'
import CharacterGallery, { CharacterSceneNote } from '@/components/CharacterGallery'
import SoundtrackModal from '@/components/right-pane/SoundtrackModal'
import DatePicker from '@/components/DatePicker'

// Types
interface StreamingOption {
  service: string
  url: string
  type: 'stream' | 'rent' | 'buy' | 'theater'
}

interface MetacriticReview {
  critic: string
  outlet: string
  quote: string
  score: number
}

interface MetacriticData {
  score: number
  criticReviews: number
  positiveCount: number
  mixedCount: number
  negativeCount: number
  consensus: string
  topReviews: MetacriticReview[]
}

interface RTReview {
  critic: string
  outlet: string
  quote: string
  fresh: boolean
}

interface RottenTomatoesData {
  tomatometer: number
  audienceScore: number
  criticReviews: number
  freshCount: number
  rottenCount: number
  consensus: string
  topReviews: RTReview[]
}

interface MediaResult {
  id: number
  title: string
  year: number
  mediaType: string
  posterPath?: string
  posterUrl?: string
  director?: string
  cinematographer?: string
  composer?: string
  starring?: string[]
  distributor?: string
  runtime?: number
  overview?: string
  trailerUrl?: string
  metacriticScore?: number
  rottenTomatoesScore?: number
  metacriticUrl?: string
  rottenTomatoesUrl?: string
  metacriticData?: MetacriticData
  rottenTomatoesData?: RottenTomatoesData
  streamingOptions?: StreamingOption[]
  // OMDB data
  imdbId?: string
  imdbRating?: string
  imdbVotes?: string
  rated?: string
  awards?: string
  boxOffice?: string
  plot?: string
  country?: string
  language?: string
}

interface LogData {
  mediaType: string
  title: string
  year?: number
  tmdbId?: number
  // Crew
  director?: string
  directors?: string[]
  cinematographer?: string
  composer?: string
  writers?: string[]
  producers?: Array<{ name: string; job: string }>
  editor?: string
  // Cast
  starring?: string[]
  cast?: Array<{ name: string; character: string; profilePath?: string }>
  genres?: string[]
  distributor?: string
  runtime?: number
  // Ratings & Scores
  tmdbRating?: number
  tmdbVoteCount?: number
  metacriticScore?: number
  rottenTomatoesScore?: number
  metacriticUrl?: string
  rottenTomatoesUrl?: string
  metacriticData?: MetacriticData
  rottenTomatoesData?: RottenTomatoesData
  imdbUrl?: string
  imdbRating?: string
  imdbVotes?: string
  rated?: string
  // Content
  plot?: string
  overview?: string
  awards?: string
  boxOffice?: string
  production?: string
  country?: string
  language?: string
  // Media
  trailerUrl?: string
  trailerVideoId?: string
  videoId?: string
  poster?: string
  thumbnail?: string
  description?: string
  duration?: string
  sourceUrl?: string
  streamingOptions?: StreamingOption[]
  // Logging
  consumptionDate?: string
  location?: string
  locationDetail?: string
  firstTime?: boolean
  socialContext?: string
  companionNames?: string // Raw input for display
  companions?: string[] // Parsed array for analytics (e.g., ["J.D.", "Keith"])
  overallRating?: number
  notes?: string
}

// Talent preference tracking
type TalentPreference = 'loved' | 'not-for-me' | null
type TalentRole = 'director' | 'actor' | 'cinematographer' | 'composer' | 'writer' | 'producer' | 'musician' | 'band'

interface TalentPreferenceEntry {
  preference: TalentPreference
  role: TalentRole
}

// Legacy format for backwards compatibility: just the preference
// New format: { preference, role }
interface TalentPreferenceData {
  [name: string]: TalentPreference | TalentPreferenceEntry
}

// Comprehensive user interaction tracking for AI-enhanced questions
interface UserInteractions {
  talentPreferences: TalentPreferenceData
  questionFeedback: Array<{
    questionId: string
    suggestion: string
    timestamp: string
  }>
  editHistory: Array<{
    field: string
    oldValue: unknown
    newValue: unknown
    timestamp: string
  }>
  sessionStart: string
  mediaSearches: string[]
}

// Queue item for Up Next
interface QueueItem {
  id: number
  title: string
  year: number
  mediaType: string
  director?: string
  addedAt: string
  sourceUrl?: string      // URL where this was found (trailer, article, etc.)
  videoId?: string        // YouTube/Vimeo video ID for embedding
  author?: string         // Channel/creator name
  authorUrl?: string      // Link to channel/creator
  thumbnail?: string      // Thumbnail image URL
  description?: string    // Full description
  duration?: string       // Duration string (e.g., "12:34")
  viewCount?: string      // View count
  publishDate?: string    // Publish date
  // Enhanced trailer metadata
  isTrailer?: boolean
  detectedMediaType?: 'movie' | 'tv'
  tmdbId?: number
  cast?: Array<{ name: string; character: string; profilePath?: string }>
  genres?: string[]
  poster?: string
  overview?: string
  runtime?: number
  mediaTitle?: string
  mediaYear?: number
  trailerVideoId?: string
  trailerUrl?: string      // Full YouTube embed URL for trailer
  tmdbRating?: number
  tmdbVoteCount?: number
  // Full crew data
  directors?: string[]
  cinematographer?: string
  composer?: string
  writers?: string[]
  producers?: Array<{ name: string; job: string }>
  editor?: string
  // OMDB rich metadata
  imdbRating?: string
  imdbVotes?: string
  rated?: string
  plot?: string
  awards?: string
  boxOffice?: string
  production?: string
  country?: string
  language?: string
  // External review site links
  metacriticUrl?: string
  rottenTomatoesUrl?: string
  imdbUrl?: string
  // Real critic scores
  metacriticScore?: number
  metacriticData?: {
    score: number
    criticReviews?: number
    userScore?: number
    url: string
  }
  rottenTomatoesScore?: number
  rottenTomatoesData?: {
    tomatometer?: number
    audienceScore?: number
    criticReviews?: number
    consensus?: string
    url: string
  }
}

// URL detection helper
function isUrl(str: string): boolean {
  try {
    const url = new URL(str.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// Extract domain from URL for display
function getDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch {
    return ''
  }
}

// Guess media type from URL
function guessMediaTypeFromUrl(url: string): string {
  const domain = getDomain(url).toLowerCase()
  if (domain.includes('youtube') || domain.includes('vimeo')) return 'video'
  if (domain.includes('spotify') || domain.includes('soundcloud')) return 'music'
  if (domain.includes('netflix') || domain.includes('hulu') || domain.includes('max') || domain.includes('primevideo')) return 'movie'
  if (domain.includes('goodreads') || domain.includes('amazon')) return 'book'
  if (domain.includes('podcasts.apple') || domain.includes('spotify')) return 'podcast'
  return 'video' // default for URLs
}

type FlowStep =
  | 'search'
  | 'searching'
  | 'disambiguate'
  | 'analyzing'
  | 'date'
  | 'location'
  | 'location_detail'
  | 'first_time'
  | 'social'
  | 'companion_names'
  | 'rating'
  | 'notes'
  | 'complete'

// CompleteStep component - AI-powered follow-up questions based on user feedback
function CompleteStep({
  logData,
  updateLogData,
  setStep,
  setSearchQuery,
  setSelectedMedia,
  setQuestionIndex,
  setCharacterSceneNotes,
  setRightPaneTab,
}: {
  logData: LogData
  updateLogData: (updates: Partial<LogData>) => void
  setStep: (step: FlowStep) => void
  setSearchQuery: (query: string) => void
  setSelectedMedia: (media: MediaResult | null) => void
  setQuestionIndex: (index: number) => void
  setCharacterSceneNotes: (notes: CharacterSceneNote[]) => void
  setRightPaneTab: (tab: 'logging' | 'upnext' | 'drafts' | 'library' | 'recs' | 'profile') => void
}) {
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [additionalInput, setAdditionalInput] = useState('')

  // Fetch smart follow-up questions based on user's notes
  useEffect(() => {
    const fetchFollowUps = async () => {
      try {
        const response = await fetch('/api/followup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: logData.notes,
            title: logData.title,
            director: logData.director,
            rating: logData.overallRating,
            mediaType: logData.mediaType,
          }),
        })
        const data = await response.json()
        setFollowUpQuestions(data.questions || [])
      } catch (error) {
        console.error('Failed to fetch follow-ups:', error)
        setFollowUpQuestions([
          "What will you remember most about this?",
          "Who would you recommend this to?",
        ])
      } finally {
        setIsLoadingQuestions(false)
      }
    }

    fetchFollowUps()
  }, [logData.notes, logData.title, logData.director, logData.overallRating, logData.mediaType])

  const handleAddMore = (text: string) => {
    updateLogData({ notes: (logData.notes ? logData.notes + '\n\n' : '') + text })
    // Refetch questions based on new input
    setIsLoadingQuestions(true)
  }

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-semibold text-ink-800 mb-2">
          Entry saved!
        </h2>
        <p className="text-ink-600">
          {logData.title} ({logData.year})
          {logData.overallRating && <span className="ml-2">• {logData.overallRating}%</span>}
        </p>
      </div>

      {/* AI Follow-up - Smart questions based on what they said */}
      <div className="bg-accent-blue/10 border-2 border-accent-blue rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="font-bold text-accent-blue mb-1">
              {logData.notes ? "Based on what you shared..." : "Want to tell me more?"}
            </h3>
            <p className="text-ink-600 text-sm">
              {logData.notes
                ? "I have some follow-up questions to understand your experience better:"
                : "The more I know, the better my recommendations get."}
            </p>
          </div>
        </div>

        {/* Smart follow-up questions */}
        <div className="space-y-2 mb-4">
          {isLoadingQuestions ? (
            <div className="text-center py-4 text-ink-500">
              <span className="animate-pulse">Analyzing your feedback...</span>
            </div>
          ) : (
            followUpQuestions.map((question, idx) => (
              <button
                key={idx}
                onClick={() => {
                  updateLogData({ notes: (logData.notes ? logData.notes + '\n\n' : '') + question + ' ' })
                  setStep('notes')
                }}
                className="w-full text-left px-4 py-3 bg-white border-2 border-accent-blue rounded-lg text-ink-700 hover:bg-accent-blue hover:text-white transition-colors text-sm"
              >
                {question}
              </button>
            ))
          )}
        </div>

        {/* Free-form follow-up with voice */}
        <div className="space-y-2">
          <VoiceInput
            value={additionalInput}
            onChange={setAdditionalInput}
            placeholder="Or share anything else on your mind..."
            className="text-sm"
          />
          {additionalInput.trim() && (
            <button
              onClick={() => {
                handleAddMore(additionalInput)
                setAdditionalInput('')
              }}
              className="w-full px-4 py-2 bg-accent-blue text-white rounded-lg font-bold hover:bg-blue-700"
            >
              Add to my notes
            </button>
          )}
        </div>
      </div>

      {/* What you've shared so far */}
      {logData.notes && (
        <div className="bg-paper-100 border border-paper-400 rounded-xl p-4 mb-6">
          <div className="text-sm font-bold text-ink-600 mb-2">Your thoughts so far:</div>
          <p className="text-ink-700 text-sm whitespace-pre-wrap">{logData.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => {
            setStep('search')
            setSearchQuery('')
            setSelectedMedia(null)
            // Reset ALL fields including experience data
            updateLogData({
              mediaType: 'movie',
              title: '',
              // Clear experience fields
              consumptionDate: undefined,
              location: undefined,
              locationDetail: undefined,
              firstTime: undefined,
              socialContext: undefined,
              companionNames: undefined,
              overallRating: undefined,
              notes: undefined,
            })
            setQuestionIndex(0)
            setCharacterSceneNotes([])
            // Auto-switch to the Now tab for the new log
            setRightPaneTab('logging')
          }}
          className="px-6 py-3 bg-accent-blue text-white rounded-lg hover:bg-blue-600 transition-colors font-bold"
        >
          Log Another
        </button>
      </div>
    </div>
  )
}

export default function Home() {
  // Flow state
  const [step, setStep] = useState<FlowStep>('search')
  const [questionIndex, setQuestionIndex] = useState(0)
  const totalQuestions = 6

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MediaResult[]>([])
  const [selectedMedia, setSelectedMedia] = useState<MediaResult | null>(null)

  // Mode: 'log' for logging consumed media, 'queue' for adding to wishlist
  const [searchMode, setSearchMode] = useState<'log' | 'queue'>('log')
  const [rightPaneTab, setRightPaneTab] = useState<'logging' | 'upnext' | 'drafts' | 'library' | 'recs' | 'profile'>('logging')
  const [tabSwitchTrigger, setTabSwitchTrigger] = useState(0)

  // Force switch to a tab (works even if already that tab value)
  const forceTabSwitch = (tab: 'logging' | 'upnext' | 'drafts' | 'library' | 'recs' | 'profile') => {
    setRightPaneTab(tab)
    setTabSwitchTrigger(prev => prev + 1)
  }

  // Toast for queue additions
  const [queueToast, setQueueToast] = useState<{ title: string; show: boolean }>({ title: '', show: false })

  // URL metadata fetching state
  const [urlLoading, setUrlLoading] = useState(false)

  // Media type confirmation dialog (when YouTube video might be a movie/documentary)
  const [mediaTypeConfirmation, setMediaTypeConfirmation] = useState<{
    show: boolean
    pendingData: any
    clues: string[]
    suggestedTitle?: string
    suggestedType?: 'movie' | 'tv' | 'video'
    // Pre-filled movie data when we find a match
    foundMatch?: {
      title: string
      year?: number
      director?: string
      poster?: string
      overview?: string
      tmdbRating?: number
      genres?: string[]
      runtime?: number
      tmdbId?: number
    }
  } | null>(null)

  // Persisted queue preview - stays visible after adding to queue
  const [persistedQueuePreview, setPersistedQueuePreview] = useState<{
    title?: string
    author?: string
    authorUrl?: string
    thumbnail?: string
    videoId?: string
    description?: string
    duration?: string
    viewCount?: string
    publishDate?: string
    sourceUrl?: string
    mediaType?: string
    isTrailer?: boolean
    detectedMediaType?: 'movie' | 'tv'
    tmdbId?: number
    director?: string
    cast?: Array<{ name: string; character: string; profilePath?: string }>
    genres?: string[]
    poster?: string
    trailerVideoId?: string
    tmdbRating?: number
    tmdbVoteCount?: number
    overview?: string
    runtime?: number
    mediaTitle?: string
    mediaYear?: number
    // External review site links
    metacriticUrl?: string
    rottenTomatoesUrl?: string
    imdbUrl?: string
    // Real critic scores
    metacriticScore?: number
    metacriticData?: {
      score: number
      criticReviews?: number
      userScore?: number
      url: string
    }
    rottenTomatoesScore?: number
    rottenTomatoesData?: {
      tomatometer?: number
      audienceScore?: number
      criticReviews?: number
      consensus?: string
      url: string
    }
  } | null>(null)

  // URL metadata state - using 'any' type due to complex and evolving data structure
  const [urlMetadata, setUrlMetadata] = useState<any | null>(null)

  // Log data state
  const [logData, setLogData] = useState<LogData>({
    mediaType: 'movie',
    title: '',
  })

  // Structured character/scene notes for preference learning
  const [characterSceneNotes, setCharacterSceneNotes] = useState<CharacterSceneNote[]>([])

  // Soundtrack modal state (for URL preview)
  const [soundtrackMovie, setSoundtrackMovie] = useState<{ title: string; year: number; composer?: string } | null>(null)

  // Auto-save log data to localStorage as user progresses
  useEffect(() => {
    if (logData.title) {
      const draftData = {
        logData,
        characterSceneNotes,
        step,
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem('smartMediaLogger_draft', JSON.stringify(draftData))
      console.log('Auto-saved draft:', logData.title)
    }
  }, [logData, characterSceneNotes, step])

  // Track if we've already initialized (to prevent overwrites)
  const hasInitialized = useRef(false)

  // Restore draft on mount - ONLY if we have no current data
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Only restore if we're starting completely fresh
    if (logData.title) {
      console.log('Already have data, skipping draft restore')
      return
    }

    try {
      const saved = localStorage.getItem('smartMediaLogger_draft')
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.logData?.title) {
          // Ask user if they want to restore
          const shouldRestore = window.confirm(`Restore your draft for "${draft.logData.title}"?`)
          if (shouldRestore) {
            setLogData(draft.logData)
            setCharacterSceneNotes(draft.characterSceneNotes || [])
            setStep(draft.step || 'date')
            console.log('Restored draft:', draft.logData.title)
          } else {
            // User declined, clear the draft
            localStorage.removeItem('smartMediaLogger_draft')
          }
        }
      }
    } catch (e) {
      console.error('Failed to restore draft:', e)
    }
  }, [])

  // Up Next queue - shared between search and RightPaneTabs
  // Initialize from localStorage or empty array
  const [upNextQueue, setUpNextQueue] = useState<QueueItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smartMediaLogger_queue')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse queue from localStorage:', e)
        }
      }
    }
    return []
  })

  // Logged items - My Stuff (shared with RightPaneTabs)
  // Initialize from localStorage or empty array
  const [loggedItems, setLoggedItems] = useState<LoggedItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smartMediaLogger_logged')
      if (saved) {
        try {
          const items = JSON.parse(saved)
          // One-time deduplication: keep first occurrence of each title+year
          const seen = new Set<string>()
          const deduplicated = items.filter((item: LoggedItem) => {
            const key = `${item.title}-${item.year}`
            if (seen.has(key)) {
              return false
            }
            seen.add(key)
            return true
          })
          // If we removed duplicates, save the cleaned version
          if (deduplicated.length < items.length) {
            console.log(`Deduplicated logged items: removed ${items.length - deduplicated.length} duplicates`)
            localStorage.setItem('smartMediaLogger_logged', JSON.stringify(deduplicated))
          }
          return deduplicated
        } catch (e) {
          console.error('Failed to parse logged items from localStorage:', e)
        }
      }
    }
    return []
  })

  // Entry number - count ALL items of the same media type (including drafts) + 1
  const entryNumber = useMemo(() => {
    const countOfType = loggedItems.filter(
      item => item.mediaType === logData.mediaType
    ).length
    return countOfType + 1
  }, [loggedItems, logData.mediaType])

  // Theater history for autofill - load from localStorage
  const [theaterHistory, setTheaterHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smartMediaLogger_theaters')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse theater history:', e)
        }
      }
    }
    return []
  })

  // Save theater history to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartMediaLogger_theaters', JSON.stringify(theaterHistory))
    }
  }, [theaterHistory])

  // Auto-fill theater when location is set to "theater"
  useEffect(() => {
    if (logData.location === 'theater' && !logData.locationDetail && theaterHistory.length > 0) {
      // Auto-fill with the most recently used theater
      updateLogData({ locationDetail: theaterHistory[0] })
    }
  }, [logData.location])

  // Add logged item callback - memoized to prevent useEffect re-runs
  const addLoggedItem = useCallback((item: LoggedItem) => {
    setLoggedItems(prev => {
      // Check for duplicates by id
      if (prev.some(existing => existing.id === item.id)) {
        return prev
      }
      return [item, ...prev]
    })
  }, [])

  // Update logged item callback
  const updateLoggedItem = useCallback((id: number, changes: Partial<LoggedItem>) => {
    setLoggedItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...changes } : item
    ))
  }, [])

  // Remove logged item callback
  const removeLoggedItem = useCallback((id: number) => {
    setLoggedItems(prev => prev.filter(item => item.id !== id))
  }, [])

  // Resume draft - load draft data back into logging flow
  const handleResumeDraft = (item: LoggedItem) => {
    // Clear stale state from previous searches/URLs
    setUrlMetadata(null)
    setSearchResults([])
    setSelectedMedia(null)
    setSearchQuery('')

    // Auto-switch to the Now tab when resuming a draft
    setRightPaneTab('logging')

    // Load all the data back into logData
    updateLogData({
      mediaType: item.mediaType,
      title: item.title,
      year: item.year,
      tmdbId: item.tmdbId,
      // Crew
      director: item.director,
      directors: item.directors,
      cinematographer: item.cinematographer,
      composer: item.composer,
      writers: item.writers,
      producers: item.producers,
      editor: item.editor,
      // Cast
      cast: item.cast,
      starring: item.cast?.map(c => c.name), // Convert cast to starring
      genres: item.genres,
      runtime: item.runtime,
      // Ratings
      tmdbRating: item.tmdbRating,
      tmdbVoteCount: item.tmdbVoteCount,
      metacriticScore: item.metacriticScore,
      rottenTomatoesScore: item.rottenTomatoesScore,
      metacriticUrl: item.metacriticUrl,
      rottenTomatoesUrl: item.rottenTomatoesUrl,
      metacriticData: item.metacriticData as MetacriticData | undefined,
      rottenTomatoesData: item.rottenTomatoesData as RottenTomatoesData | undefined,
      imdbUrl: item.imdbUrl,
      imdbRating: item.imdbRating,
      imdbVotes: item.imdbVotes,
      rated: item.rated,
      // Content
      plot: item.plot,
      overview: item.overview,
      awards: item.awards,
      boxOffice: item.boxOffice,
      production: item.production,
      country: item.country,
      language: item.language,
      // Media
      trailerUrl: item.trailerUrl,
      trailerVideoId: item.trailerVideoId,
      videoId: item.videoId,
      poster: item.poster,
      thumbnail: item.thumbnail,
      description: item.description,
      duration: item.duration,
      sourceUrl: item.sourceUrl,
      // Logging data already captured
      consumptionDate: item.dateConsumed,
      location: item.location,
      locationDetail: item.locationDetail,
      firstTime: item.firstTime,
      socialContext: item.socialContext,
      companionNames: item.companionNames,
      overallRating: item.rating,
      notes: item.notes,
    })

    // Store the draft ID - we'll only remove it when logging is COMPLETED (not abandoned)
    // This prevents data loss if user refreshes or cancels
    resumingDraftIdRef.current = item.id

    // Determine the correct step to resume from based on what's already filled
    // Work backwards from the end to find the first incomplete step
    let resumeStep: FlowStep = 'date'

    if (item.notes) {
      // If notes are filled, go to complete
      resumeStep = 'complete'
    } else if (item.rating !== undefined) {
      // Rating is filled, go to notes
      resumeStep = 'notes'
    } else if (item.socialContext) {
      // Social context is filled, go to rating
      resumeStep = 'rating'
    } else if (item.firstTime !== undefined) {
      // First time is filled, go to social context
      resumeStep = 'social'
    } else if (item.location) {
      // Location is filled, go to first time
      resumeStep = 'first_time'
    } else if (item.dateConsumed) {
      // Date is filled, go to location
      resumeStep = 'location'
    }
    // Otherwise start at 'date'

    setStep(resumeStep)

    // Switch to logging tab
    setRightPaneTab('logging')
  }

  // Save & Exit - save current progress and return to search
  const saveAndExit = () => {
    if (!logData.title) return

    // Create logged item with ALL metadata
    const newLoggedItem: LoggedItem = {
      id: Date.now(),
      title: logData.title,
      year: logData.year || new Date().getFullYear(),
      mediaType: logData.mediaType,
      // Crew
      director: logData.director,
      directors: logData.directors,
      cinematographer: logData.cinematographer,
      composer: logData.composer,
      writers: logData.writers,
      producers: logData.producers,
      editor: logData.editor,
      // Cast
      cast: logData.cast,
      genres: logData.genres,
      runtime: logData.runtime,
      // Ratings & Scores
      tmdbRating: logData.tmdbRating,
      tmdbVoteCount: logData.tmdbVoteCount,
      metacriticScore: logData.metacriticScore,
      rottenTomatoesScore: logData.rottenTomatoesScore,
      metacriticUrl: logData.metacriticUrl,
      rottenTomatoesUrl: logData.rottenTomatoesUrl,
      metacriticData: logData.metacriticData as any,
      rottenTomatoesData: logData.rottenTomatoesData as any,
      imdbUrl: logData.imdbUrl,
      imdbRating: logData.imdbRating,
      imdbVotes: logData.imdbVotes,
      rated: logData.rated,
      // Content
      plot: logData.plot,
      overview: logData.overview,
      awards: logData.awards,
      boxOffice: logData.boxOffice,
      production: logData.production,
      country: logData.country,
      language: logData.language,
      // Media
      trailerUrl: logData.trailerUrl,
      trailerVideoId: logData.trailerVideoId,
      videoId: logData.videoId || urlMetadata?.videoId,
      poster: logData.poster,
      thumbnail: logData.thumbnail,
      description: logData.description,
      duration: logData.duration,
      sourceUrl: logData.sourceUrl || (isUrl(searchQuery) ? searchQuery : undefined),
      // Logging data
      rating: logData.overallRating,
      dateConsumed: logData.consumptionDate || new Date().toISOString().split('T')[0],
      addedAt: new Date().toISOString().split('T')[0],
      notes: logData.notes,
      companionNames: logData.companionNames,
      socialContext: logData.socialContext,
      location: logData.location,
      locationDetail: logData.locationDetail,
      firstTime: logData.firstTime,
      // Mark as draft/incomplete
      isDraft: true,
    }

    // If we're resuming a draft, update the existing one instead of creating a duplicate
    if (resumingDraftIdRef.current !== null) {
      // Update the existing draft with new data
      const updatedItem = { ...newLoggedItem, id: resumingDraftIdRef.current }
      removeLoggedItem(resumingDraftIdRef.current)
      addLoggedItem(updatedItem)
      console.log('Updated existing draft:', updatedItem)
      resumingDraftIdRef.current = null
    } else {
      addLoggedItem(newLoggedItem)
      console.log('Saved & Exited:', newLoggedItem)
    }

    // Clear draft since we've saved
    localStorage.removeItem('smartMediaLogger_draft')

    // Switch to Drafts tab to show the saved draft
    forceTabSwitch('drafts')

    // Reset and return to search
    setStep('search')
    setSearchQuery('')
    setSelectedMedia(null)
    // Reset ALL fields including experience data
    updateLogData({
      mediaType: 'movie',
      title: '',
      // Clear experience fields
      consumptionDate: undefined,
      location: undefined,
      locationDetail: undefined,
      firstTime: undefined,
      socialContext: undefined,
      companionNames: undefined,
      overallRating: undefined,
      notes: undefined,
    })
    setQuestionIndex(0)
    setCharacterSceneNotes([])
    savedEntryIdRef.current = newLoggedItem.id.toString() // Prevent double-save
  }

  // Smart add to queue - fetches FULL metadata from movie-details API first
  const addToQueueSmart = async (media: MediaResult) => {
    // Check for duplicates first
    const isDuplicate = upNextQueue.some(item =>
      item.title === media.title && item.mediaType === media.mediaType
    )

    if (isDuplicate) {
      setQueueToast({ title: `"${media.title}" is already in your queue`, show: true })
      setTimeout(() => setQueueToast({ title: '', show: false }), 3000)
      return
    }

    // Show loading toast
    setQueueToast({ title: `Fetching full details for "${media.title}"...`, show: true })

    try {
      // Fetch FULL metadata including cast with photos, all crew, OMDB scores, awards
      const response = await fetch(
        `/api/movie-details?tmdbId=${media.id}&title=${encodeURIComponent(media.title)}&year=${media.year}&type=${media.mediaType}`
      )

      let fullData: any = media
      if (response.ok) {
        fullData = await response.json()
        console.log('Full metadata for queue:', fullData)
      }

      const newItem: QueueItem = {
        id: Date.now(),
        title: fullData.title || media.title,
        year: fullData.year || media.year,
        mediaType: fullData.mediaType || media.mediaType,
        director: fullData.director,
        addedAt: new Date().toISOString().split('T')[0],
        // Full crew
        directors: fullData.directors,
        cinematographer: fullData.cinematographer,
        composer: fullData.composer,
        writers: fullData.writers,
        producers: fullData.producers,
        editor: fullData.editor,
        // Full cast with photos
        cast: fullData.cast,
        genres: fullData.genres,
        runtime: fullData.runtime,
        // Media
        poster: fullData.poster || media.posterPath,
        thumbnail: fullData.poster || media.posterPath,
        trailerUrl: fullData.trailerUrl,
        trailerVideoId: fullData.trailerVideoId,
        overview: fullData.overview || media.overview,
        tmdbId: fullData.tmdbId || media.id,
        tmdbRating: fullData.tmdbRating,
        // Critic scores from OMDB
        metacriticScore: fullData.metacriticScore,
        rottenTomatoesScore: fullData.rottenTomatoesScore,
        imdbRating: fullData.imdbRating,
        imdbVotes: fullData.imdbVotes,
        // URLs
        metacriticUrl: fullData.metacriticUrl,
        rottenTomatoesUrl: fullData.rottenTomatoesUrl,
        imdbUrl: fullData.imdbUrl,
        // Rich metadata from OMDB
        rated: fullData.rated,
        awards: fullData.awards,
        boxOffice: fullData.boxOffice,
        plot: fullData.plot,
        country: fullData.country,
        language: fullData.language,
      }

      console.log('Adding to queue with FULL data:', newItem)
      setUpNextQueue(prev => [newItem, ...prev])

      // Show success toast
      setQueueToast({ title: media.title, show: true })
      setTimeout(() => setQueueToast({ title: '', show: false }), 3000)

      // Clear search and left pane, switch to queue tab
      setSearchQuery('')
      setSearchResults([])
      setSelectedMedia(null)
      setUrlMetadata(null)
      setStep('search')
      forceTabSwitch('upnext')

    } catch (error) {
      console.error('Error fetching full metadata for queue:', error)
      // Fallback to basic data
      addToQueue({
        title: media.title,
        year: media.year,
        mediaType: media.mediaType,
        director: media.director,
        thumbnail: media.posterPath,
      })
    }
  }

  // Add to queue function with toast feedback, duplicate prevention, and form reset
  const addToQueue = (metadata: {
    title: string
    year: number
    mediaType: string
    director?: string
    sourceUrl?: string
    videoId?: string
    author?: string
    authorUrl?: string
    thumbnail?: string
    description?: string
    duration?: string
    viewCount?: string
    publishDate?: string
    skipTabSwitch?: boolean
    // Additional fields for recommendations
    cinematographer?: string
    composer?: string
    starring?: string[]
    runtime?: number
    metacriticScore?: number
    rottenTomatoesScore?: number
    metacriticUrl?: string
    rottenTomatoesUrl?: string
    trailerUrl?: string
    // OMDB data
    rated?: string
    awards?: string
    boxOffice?: string
    plot?: string
    language?: string
    country?: string
    imdbRating?: string
  }) => {
    // Check for duplicates - by URL or title
    const isDuplicate = upNextQueue.some(item =>
      (metadata.sourceUrl && item.sourceUrl === metadata.sourceUrl) ||
      (!metadata.sourceUrl && item.title === metadata.title && item.mediaType === metadata.mediaType)
    )

    if (isDuplicate) {
      // Show "already in queue" toast instead of adding
      setQueueToast({ title: `"${metadata.title}" is already in your queue`, show: true })
      setTimeout(() => setQueueToast({ title: '', show: false }), 3000)
      return
    }

    // Convert starring array to cast format if provided from recommendations
    const castFromStarring = metadata.starring?.map(name => ({ name, character: '' }))

    // For recommendations (no sourceUrl), use metadata directly - don't use stale urlMetadata!
    // urlMetadata could have leftover data from a previous search
    const isFromRecommendation = !metadata.sourceUrl && metadata.skipTabSwitch
    const source = isFromRecommendation ? null : urlMetadata

    const newItem: QueueItem = {
      id: Date.now(),
      title: metadata.title,
      year: metadata.year,
      mediaType: metadata.mediaType,
      director: source?.director || metadata.director,
      addedAt: new Date().toISOString().split('T')[0],
      sourceUrl: metadata.sourceUrl,
      videoId: metadata.videoId,
      author: metadata.author,
      authorUrl: metadata.authorUrl,
      thumbnail: source?.poster || metadata.thumbnail,
      description: source?.overview || metadata.description,
      duration: metadata.duration,
      viewCount: metadata.viewCount,
      publishDate: metadata.publishDate,
      // Enhanced trailer metadata
      isTrailer: source?.isTrailer,
      detectedMediaType: source?.detectedMediaType,
      tmdbId: source?.tmdbId,
      cast: source?.cast || castFromStarring,
      genres: source?.genres,
      poster: source?.poster,
      overview: source?.overview || metadata.plot,
      runtime: source?.runtime || metadata.runtime,
      mediaTitle: source?.mediaTitle,
      mediaYear: source?.mediaYear,
      trailerVideoId: source?.trailerVideoId || metadata.videoId,
      trailerUrl: metadata.trailerUrl,  // YouTube embed URL from recommendations
      tmdbRating: source?.tmdbRating,
      tmdbVoteCount: source?.tmdbVoteCount,
      // Crew data - use metadata directly for recommendations
      directors: source?.directors,
      cinematographer: source?.cinematographer || metadata.cinematographer,
      composer: source?.composer || metadata.composer,
      writers: source?.writers,
      producers: source?.producers,
      editor: source?.editor,
      // OMDB rich metadata - use metadata directly for recommendations
      imdbRating: source?.imdbRating || metadata.imdbRating,
      imdbVotes: source?.imdbVotes,
      rated: source?.rated || metadata.rated,
      plot: source?.plot || metadata.plot,
      awards: source?.awards || metadata.awards,
      boxOffice: source?.boxOffice || metadata.boxOffice,
      production: source?.production,
      country: source?.country || metadata.country,
      language: source?.language || metadata.language,
      // External review site links
      metacriticUrl: source?.metacriticUrl || metadata.metacriticUrl,
      rottenTomatoesUrl: source?.rottenTomatoesUrl || metadata.rottenTomatoesUrl,
      imdbUrl: source?.imdbUrl,
      // Real critic scores
      metacriticScore: source?.metacriticScore || metadata.metacriticScore,
      metacriticData: source?.metacriticData as any,
      rottenTomatoesScore: source?.rottenTomatoesScore || metadata.rottenTomatoesScore,
      rottenTomatoesData: source?.rottenTomatoesData as any,
    }
    console.log('Adding to queue with data:', newItem)
    setUpNextQueue(prev => [newItem, ...prev])

    // Show success toast
    setQueueToast({ title: metadata.title, show: true })
    setTimeout(() => setQueueToast({ title: '', show: false }), 3000)

    // Save the preview data BEFORE clearing the search
    // This way the right pane can still show what was just added
    const previewData = {
      title: metadata.title,
      author: metadata.author,
      authorUrl: metadata.authorUrl,
      thumbnail: urlMetadata?.poster || metadata.thumbnail,
      videoId: metadata.videoId,
      description: urlMetadata?.overview || urlMetadata?.description || metadata.description,
      duration: metadata.duration,
      viewCount: metadata.viewCount,
      publishDate: metadata.publishDate,
      sourceUrl: metadata.sourceUrl,
      mediaType: metadata.mediaType,
      // Include enhanced metadata from urlMetadata if available
      isTrailer: urlMetadata?.isTrailer,
      detectedMediaType: urlMetadata?.detectedMediaType,
      tmdbId: urlMetadata?.tmdbId,
      director: urlMetadata?.director,
      cast: urlMetadata?.cast,
      genres: urlMetadata?.genres,
      poster: urlMetadata?.poster,
      trailerVideoId: urlMetadata?.trailerVideoId || urlMetadata?.videoId,
      // Additional TMDB data
      tmdbRating: urlMetadata?.tmdbRating,
      tmdbVoteCount: urlMetadata?.tmdbVoteCount,
      runtime: urlMetadata?.runtime,
      overview: urlMetadata?.overview,
      mediaTitle: urlMetadata?.mediaTitle,
      mediaYear: urlMetadata?.mediaYear,
      // External review site links
      metacriticUrl: urlMetadata?.metacriticUrl,
      rottenTomatoesUrl: urlMetadata?.rottenTomatoesUrl,
      imdbUrl: urlMetadata?.imdbUrl,
      // Real critic scores
      metacriticScore: urlMetadata?.metacriticScore,
      metacriticData: urlMetadata?.metacriticData as any,
      rottenTomatoesScore: urlMetadata?.rottenTomatoesScore,
      rottenTomatoesData: urlMetadata?.rottenTomatoesData as any,
    }
    setPersistedQueuePreview(previewData)

    // Switch to Now tab to show what was added (unless skipped, e.g., from Recommendations)
    if (!metadata.skipTabSwitch) {
      forceTabSwitch('logging')

      // Clear the left side form after a brief delay so user knows action is complete
      // and they're ready to add something else
      setTimeout(() => {
        setSearchQuery('')
        setUrlMetadata(null)
      }, 1000)
    }
  }

  // Log from queue - pre-populate the logging form with queue item data
  const handleLogFromQueue = async (item: QueueItem) => {
    // Pre-populate log data with all metadata including crew and scores
    setLogData(prev => ({
      ...prev,
      mediaType: item.mediaType,
      title: item.title,
      year: item.year,
      director: item.director || item.author || '',
      cinematographer: item.cinematographer,
      composer: item.composer,
      starring: item.cast?.map(c => c.name),
      runtime: item.runtime,
      // Critic scores
      metacriticScore: item.metacriticScore,
      rottenTomatoesScore: item.rottenTomatoesScore,
      metacriticUrl: item.metacriticUrl,
      rottenTomatoesUrl: item.rottenTomatoesUrl,
      metacriticData: item.metacriticData as MetacriticData | undefined,
      rottenTomatoesData: item.rottenTomatoesData as RottenTomatoesData | undefined,
    }))

    // Create a selected media result to show the card
    const mediaResult: MediaResult = {
      id: item.id,
      title: item.title,
      year: item.year,
      mediaType: item.mediaType,
      director: item.director,
      posterPath: item.videoId ? `https://img.youtube.com/vi/${item.videoId}/maxresdefault.jpg` : undefined,
    }
    setSelectedMedia(mediaResult)

    // Switch to log mode first
    setSearchMode('log')

    // Switch right pane to "Now" tab
    forceTabSwitch('logging')

    // Start from rating step - they already selected what to log
    setStep('rating')

    // Remove from queue since they're logging it now
    setUpNextQueue(prev => prev.filter(q => q.id !== item.id))

    // Set ALL metadata from queue item immediately - don't lose the data!
    // This works for both items with sourceUrl AND items from recommendations
    setSearchQuery(item.sourceUrl || item.title)
    setUrlMetadata({
      title: item.title,
      author: item.author,
      videoId: item.videoId,
      thumbnail: item.videoId ? `https://img.youtube.com/vi/${item.videoId}/maxresdefault.jpg` : item.thumbnail,
      description: item.overview || item.description,
      duration: item.duration,
      viewCount: item.viewCount,
      publishDate: item.publishDate,
      // Enhanced trailer metadata
      isTrailer: item.isTrailer,
      detectedMediaType: item.detectedMediaType,
      tmdbId: item.tmdbId,
      director: item.director,
      cast: item.cast,
      genres: item.genres,
      poster: item.poster,
      overview: item.overview,
      runtime: item.runtime,
      mediaTitle: item.mediaTitle,
      mediaYear: item.mediaYear,
      trailerVideoId: item.trailerVideoId || item.videoId,
      trailerUrl: item.trailerUrl,  // Include trailer URL!
      tmdbRating: item.tmdbRating,
      tmdbVoteCount: item.tmdbVoteCount,
      // Crew data
      directors: item.directors,
      cinematographer: item.cinematographer,
      composer: item.composer,
      writers: item.writers,
      producers: item.producers,
      editor: item.editor,
      // OMDB rich metadata
      imdbRating: item.imdbRating,
      imdbVotes: item.imdbVotes,
      rated: item.rated,
      plot: item.plot,
      awards: item.awards,
      boxOffice: item.boxOffice,
      production: item.production,
      country: item.country,
      language: item.language,
      // External review site links
      metacriticUrl: item.metacriticUrl,
      rottenTomatoesUrl: item.rottenTomatoesUrl,
      imdbUrl: item.imdbUrl,
      // Real critic scores
      metacriticScore: item.metacriticScore,
      metacriticData: item.metacriticData,
      rottenTomatoesScore: item.rottenTomatoesScore,
      rottenTomatoesData: item.rottenTomatoesData,
    } as any)
    // Don't re-fetch - we already have all the data from the queue item

    console.log('Logging from queue:', item)
  }

  // Fetch metadata from URL (especially YouTube)
  const fetchUrlMetadata = async (url: string) => {
    setUrlLoading(true)
    // Don't clear metadata here - let new data replace it when ready

    try {
      // YouTube - use our custom API for full metadata
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const response = await fetch(`/api/youtube-metadata?url=${encodeURIComponent(url)}`)
        if (response.ok) {
          const data = await response.json()

          // If this is a detected trailer, use the movie/TV metadata
          if (data.isTrailer && data.mediaTitle) {
            console.log('Detected trailer for:', data.mediaTitle, data)
            setUrlMetadata({
              title: data.mediaTitle,  // Use the movie/TV title, not the YouTube title
              author: data.author,     // Keep the YouTube channel name
              authorUrl: data.authorUrl,
              thumbnail: data.poster || data.thumbnail,  // Prefer movie poster
              videoId: data.videoId,
              description: data.overview || data.description,  // Use movie overview
              duration: data.runtime ? `${data.runtime} min` : data.duration,
              viewCount: data.viewCount,
              publishDate: data.mediaYear?.toString(),
              category: data.category,
              // Enhanced trailer metadata
              isTrailer: true,
              detectedMediaType: data.detectedMediaType,
              tmdbId: data.tmdbId,
              director: data.director,
              directors: data.directors,
              cinematographer: data.cinematographer,
              composer: data.composer,
              writers: data.writers,
              producers: data.producers,
              editor: data.editor,
              cast: data.cast,
              genres: data.genres,
              poster: data.poster,
              backdrop: data.backdrop,
              trailerVideoId: data.trailerVideoId || data.videoId,
              mediaYear: data.mediaYear,
              overview: data.overview,
              runtime: data.runtime,
              // Videos and images from TMDB
              videos: data.videos,
              images: data.images,
              tmdbRating: data.tmdbRating,
              tmdbVoteCount: data.tmdbVoteCount,
              // External review site links
              metacriticUrl: data.metacriticUrl,
              rottenTomatoesUrl: data.rottenTomatoesUrl,
              imdbUrl: data.imdbUrl,
              // Real critic scores
              metacriticScore: data.metacriticScore,
              metacriticData: data.metacriticData,
              rottenTomatoesScore: data.rottenTomatoesScore,
              rottenTomatoesData: data.rottenTomatoesData,
              // OMDB rich metadata
              imdbRating: data.imdbRating,
              imdbVotes: data.imdbVotes,
              rated: data.rated,
              plot: data.plot,
              awards: data.awards,
              boxOffice: data.boxOffice,
              production: data.production,
              country: data.country,
              language: data.language,
            })
            // Auto-fill title with movie name
            const titleInput = document.getElementById('url-title-input') as HTMLInputElement
            if (titleInput) {
              titleInput.value = data.mediaTitle
            }
            // Auto-set logData with all detected metadata so MediaCard can display it immediately
            updateLogData({
              mediaType: data.detectedMediaType || 'movie',
              title: data.mediaTitle,
              year: data.mediaYear,
              tmdbId: data.tmdbId,
              // Crew
              director: data.director,
              directors: data.directors,
              cinematographer: data.cinematographer,
              composer: data.composer,
              writers: data.writers,
              producers: data.producers,
              editor: data.editor,
              // Cast
              cast: data.cast,
              starring: data.cast?.map((c: any) => c.name),
              genres: data.genres,
              runtime: data.runtime,
              // Media
              poster: data.poster,
              backdrop: data.backdrop,
              trailerUrl: data.trailerVideoId ? `https://www.youtube.com/embed/${data.trailerVideoId}` : undefined,
              trailerVideoId: data.trailerVideoId || data.videoId,
              videoId: data.videoId,
              overview: data.overview,
              videos: data.videos,
              images: data.images,
              // Ratings
              tmdbRating: data.tmdbRating,
              tmdbVoteCount: data.tmdbVoteCount,
              metacriticScore: data.metacriticScore,
              metacriticData: data.metacriticData,
              rottenTomatoesScore: data.rottenTomatoesScore,
              rottenTomatoesData: data.rottenTomatoesData,
              metacriticUrl: data.metacriticUrl,
              rottenTomatoesUrl: data.rottenTomatoesUrl,
              imdbUrl: data.imdbUrl,
              imdbRating: data.imdbRating,
              imdbVotes: data.imdbVotes,
              // OMDB rich metadata
              rated: data.rated,
              plot: data.plot,
              awards: data.awards,
              boxOffice: data.boxOffice,
              production: data.production,
              country: data.country,
              language: data.language,
              // Source
              sourceUrl: url,
            })
          } else {
            // Check if there are clues this might be a movie/documentary
            const detectionInfo = data.detectionInfo
            if (detectionInfo && (detectionInfo.isDocumentary || detectionInfo.isFilm || detectionInfo.clues?.length > 0)) {
              // BE SMART: Proactively search for the movie/documentary
              console.log('Detected clues for possible movie/documentary:', detectionInfo)
              const searchTitle = detectionInfo.suggestedTitle || data.title
              try {
                // Search TMDB to pre-fill the card (use multi-search to find both movies and TV)
                const searchResponse = await fetch(`/api/search?q=${encodeURIComponent(searchTitle)}`)
                if (searchResponse.ok) {
                  const searchResults = await searchResponse.json()
                  if (searchResults.results && searchResults.results.length > 0) {
                    const match = searchResults.results[0]
                    console.log('Smart search found:', match)

                    // Show confirmation with PRE-FILLED data
                    setMediaTypeConfirmation({
                      show: true,
                      pendingData: data,
                      clues: detectionInfo.clues || [],
                      suggestedTitle: match.title,
                      suggestedType: searchType,
                      // Pre-filled movie data from search
                      foundMatch: {
                        title: match.title,
                        year: match.year,
                        director: match.director,
                        poster: match.posterPath,
                        overview: match.overview,
                        tmdbRating: match.tmdbRating,
                        genres: match.genres,
                        runtime: match.runtime,
                        tmdbId: match.id,
                      }
                    })

                    // Also show the basic video metadata while dialog is open
                    setUrlMetadata({
                      title: data.title,
                      author: data.author,
                      authorUrl: data.authorUrl,
                      thumbnail: data.thumbnail,
                      videoId: data.videoId,
                      description: data.description,
                      duration: data.duration,
                      viewCount: data.viewCount,
                      publishDate: data.publishDate,
                      category: data.category,
                    })
                    return // Don't continue to the else block
                  }
                }
              } catch (error) {
                console.log('Smart search failed:', error)
              }

              // Fallback: No match found, just show basic confirmation
              setUrlMetadata({
                title: data.title,
                author: data.author,
                authorUrl: data.authorUrl,
                thumbnail: data.thumbnail,
                videoId: data.videoId,
                description: data.description,
                duration: data.duration,
                viewCount: data.viewCount,
                publishDate: data.publishDate,
                category: data.category,
              })
              setMediaTypeConfirmation({
                show: true,
                pendingData: data,
                clues: detectionInfo.clues || [],
                suggestedTitle: detectionInfo.suggestedTitle,
                suggestedType: detectionInfo.suggestedType || 'movie',
              })
            } else {
              // Regular YouTube video (no movie clues detected)
              setUrlMetadata({
                title: data.title,
                author: data.author,
                authorUrl: data.authorUrl,
                thumbnail: data.thumbnail,
                videoId: data.videoId,
                description: data.description,
                duration: data.duration,
                viewCount: data.viewCount,
                publishDate: data.publishDate,
                category: data.category,
              })
            }
            // Auto-fill the title input
            const titleInput = document.getElementById('url-title-input') as HTMLInputElement
            if (titleInput && data.title) {
              titleInput.value = data.title
            }
          }
        }
      }
      // Vimeo - use oEmbed
      else if (url.includes('vimeo.com')) {
        const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
        const response = await fetch(oembedUrl)
        if (response.ok) {
          const data = await response.json()
          setUrlMetadata({
            title: data.title,
            author: data.author_name,
            authorUrl: data.author_url,
            thumbnail: data.thumbnail_url,
            description: data.description,
            duration: data.duration ? `${Math.floor(data.duration / 60)}:${(data.duration % 60).toString().padStart(2, '0')}` : undefined,
          })
          const titleInput = document.getElementById('url-title-input') as HTMLInputElement
          if (titleInput && data.title) {
            titleInput.value = data.title
          }
        }
      }
    } catch (error) {
      console.log('Could not fetch URL metadata:', error)
    } finally {
      setUrlLoading(false)
    }
  }

  // Handle media type confirmation (when user confirms it's a movie/documentary)
  const handleMediaTypeConfirm = async (confirmedType: 'movie' | 'tv' | 'video') => {
    if (!mediaTypeConfirmation?.pendingData) return

    // Auto-switch to the Now tab when user confirms they want to log this
    setRightPaneTab('logging')

    const data = mediaTypeConfirmation.pendingData
    const title = mediaTypeConfirmation.suggestedTitle || data.title

    if (confirmedType === 'video') {
      // User says it's just a video, keep current metadata
      setMediaTypeConfirmation(null)
      return
    }

    // ALWAYS update mediaType immediately when user confirms - even if TMDB search fails
    updateLogData({ mediaType: confirmedType })
    setUrlMetadata(prev => prev ? { ...prev, detectedMediaType: confirmedType } : null)

    // User confirmed it's a movie/tv - try to fetch TMDB metadata
    setUrlLoading(true)
    try {
      // Helper to normalize accented characters for search
      const normalizeForSearch = (str: string) =>
        str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      // Try original title first, then normalized version
      let match = null
      const searchResponse = await fetch(`/api/search?q=${encodeURIComponent(title)}`)
      if (searchResponse.ok) {
        const searchResults = await searchResponse.json()
        if (searchResults.results && searchResults.results.length > 0) {
          match = searchResults.results[0]
        }
      }

      // If no results, try with normalized title (remove accents like â → a)
      if (!match) {
        const normalizedTitle = normalizeForSearch(title)
        if (normalizedTitle !== title) {
          console.log('Trying normalized search:', normalizedTitle)
          const normalizedResponse = await fetch(`/api/search?q=${encodeURIComponent(normalizedTitle)}`)
          if (normalizedResponse.ok) {
            const normalizedResults = await normalizedResponse.json()
            if (normalizedResults.results && normalizedResults.results.length > 0) {
              match = normalizedResults.results[0]
            }
          }
        }
      }

      if (match) {
        console.log('Found TMDB match after confirmation:', match)

        // Fetch full metadata including critic scores
        try {
          const detailsResponse = await fetch(
            `/api/movie-details?tmdbId=${match.id || match.tmdbId}&title=${encodeURIComponent(match.title)}&year=${match.year}&type=${confirmedType}`
          )
          if (detailsResponse.ok) {
            const fullData = await detailsResponse.json()
            console.log('Full metadata for confirmed movie:', fullData)

            // Update metadata with COMPLETE data including critic scores
            setUrlMetadata({
              title: fullData.title,
              author: data.author,
              authorUrl: data.authorUrl,
              thumbnail: fullData.poster || data.thumbnail,
              videoId: data.videoId,
              description: fullData.overview || data.description,
              duration: fullData.runtime ? `${fullData.runtime} min` : data.duration,
              viewCount: data.viewCount,
              publishDate: fullData.year?.toString(),
              category: data.category,
              isTrailer: true,
              detectedMediaType: confirmedType,
              tmdbId: fullData.tmdbId,
              director: fullData.director,
              directors: fullData.directors,
              cinematographer: fullData.cinematographer,
              composer: fullData.composer,
              writers: fullData.writers,
              cast: fullData.cast,
              genres: fullData.genres,
              poster: fullData.poster,
              trailerVideoId: fullData.trailerVideoId || data.videoId,
              trailerUrl: fullData.trailerUrl,
              tmdbRating: fullData.tmdbRating,
              overview: fullData.overview,
              runtime: fullData.runtime,
              // OMDB critic scores
              metacriticScore: fullData.metacriticScore,
              rottenTomatoesScore: fullData.rottenTomatoesScore,
              imdbRating: fullData.imdbRating,
              imdbVotes: fullData.imdbVotes,
              metacriticUrl: fullData.metacriticUrl,
              rottenTomatoesUrl: fullData.rottenTomatoesUrl,
              imdbUrl: fullData.imdbUrl,
              // Rich metadata
              rated: fullData.rated,
              awards: fullData.awards,
              boxOffice: fullData.boxOffice,
              plot: fullData.plot,
            })

            // Auto-fill title input
            const titleInput = document.getElementById('url-title-input') as HTMLInputElement
            if (titleInput) {
              titleInput.value = fullData.title
            }
          }
        } catch (detailsError) {
          console.error('Error fetching full movie details:', detailsError)
          // Still use basic match data
          setUrlMetadata({
            title: match.title,
            author: data.author,
            authorUrl: data.authorUrl,
            thumbnail: match.posterPath || data.thumbnail,
            videoId: data.videoId,
            description: match.overview || data.description,
            duration: match.runtime ? `${match.runtime} min` : data.duration,
            viewCount: data.viewCount,
            publishDate: match.year?.toString(),
            category: data.category,
            isTrailer: true,
            detectedMediaType: confirmedType,
            tmdbId: match.id,
            director: match.director,
            cast: match.cast,
            genres: match.genres,
            poster: match.posterPath,
            trailerVideoId: data.videoId,
            tmdbRating: match.tmdbRating,
            overview: match.overview,
            runtime: match.runtime,
          })

          const titleInput = document.getElementById('url-title-input') as HTMLInputElement
          if (titleInput) {
            titleInput.value = match.title
          }
        }
      } else {
        console.log('No TMDB match found for:', title, '- keeping user-confirmed type:', confirmedType)
        // Even without a match, update urlMetadata to reflect the confirmed type
        setUrlMetadata(prev => prev ? {
          ...prev,
          detectedMediaType: confirmedType,
        } : null)
      }
    } catch (error) {
      console.error('Error fetching TMDB data after confirmation:', error)
    } finally {
      setUrlLoading(false)
      setMediaTypeConfirmation(null)
    }
  }

  // Handle confirmation when we already have a pre-filled match - fetch FULL metadata
  const handleMediaTypeConfirmWithMatch = async () => {
    if (!mediaTypeConfirmation?.pendingData || !mediaTypeConfirmation?.foundMatch) return

    // Auto-switch to the Now tab when user confirms they want to log this
    setRightPaneTab('logging')

    const data = mediaTypeConfirmation.pendingData
    const match = mediaTypeConfirmation.foundMatch
    const confirmedType = mediaTypeConfirmation.suggestedType || 'movie'

    console.log('Fetching full metadata for:', match.title)
    setUrlLoading(true)

    try {
      // Fetch FULL metadata including OMDB (Metacritic, RT, IMDB, awards, full cast)
      const detailsResponse = await fetch(
        `/api/movie-details?tmdbId=${match.tmdbId}&title=${encodeURIComponent(match.title)}&year=${match.year}&type=${confirmedType}`
      )

      if (detailsResponse.ok) {
        const fullData = await detailsResponse.json()
        console.log('Full metadata received:', fullData)

        // Update metadata with the COMPLETE data
        setUrlMetadata({
          title: fullData.title,
          author: data.author,
          authorUrl: data.authorUrl,
          thumbnail: fullData.poster || data.thumbnail,
          videoId: data.videoId,
          description: fullData.overview || data.description,
          duration: fullData.runtime ? `${fullData.runtime} min` : data.duration,
          viewCount: data.viewCount,
          publishDate: fullData.year?.toString(),
          category: data.category,
          isTrailer: true,
          detectedMediaType: confirmedType as 'movie' | 'tv',
          tmdbId: fullData.tmdbId,
          director: fullData.director,
          directors: fullData.directors,
          cinematographer: fullData.cinematographer,
          composer: fullData.composer,
          writers: fullData.writers,
          producers: fullData.producers,
          editor: fullData.editor,
          cast: fullData.cast,
          genres: fullData.genres,
          poster: fullData.poster,
          trailerVideoId: fullData.trailerVideoId || data.videoId,
          trailerUrl: fullData.trailerUrl,
          tmdbRating: fullData.tmdbRating,
          tmdbVoteCount: fullData.tmdbVoteCount,
          overview: fullData.overview,
          runtime: fullData.runtime,
          // OMDB critic scores
          metacriticScore: fullData.metacriticScore,
          rottenTomatoesScore: fullData.rottenTomatoesScore,
          imdbRating: fullData.imdbRating,
          imdbVotes: fullData.imdbVotes,
          // Rich metadata
          rated: fullData.rated,
          awards: fullData.awards,
          boxOffice: fullData.boxOffice,
          country: fullData.country,
          language: fullData.language,
          plot: fullData.plot,
          // URLs
          metacriticUrl: fullData.metacriticUrl,
          rottenTomatoesUrl: fullData.rottenTomatoesUrl,
          imdbUrl: fullData.imdbUrl,
        } as any)

        // Update logData with the correct media type
        updateLogData({ mediaType: confirmedType as 'movie' | 'tv' })

        // Auto-fill title input
        const titleInput = document.getElementById('url-title-input') as HTMLInputElement
        if (titleInput) {
          titleInput.value = fullData.title
        }
      } else {
        // Fallback to basic match data if full fetch fails
        console.log('Full metadata fetch failed, using basic match')
        setUrlMetadata({
          title: match.title,
          author: data.author,
          thumbnail: match.poster || data.thumbnail,
          videoId: data.videoId,
          description: match.overview,
          isTrailer: true,
          detectedMediaType: confirmedType as 'movie' | 'tv',
          tmdbId: match.tmdbId,
          director: match.director,
          genres: match.genres,
          poster: match.poster,
          tmdbRating: match.tmdbRating,
          runtime: match.runtime,
        } as any)
        updateLogData({ mediaType: confirmedType as 'movie' | 'tv' })
      }
    } catch (error) {
      console.error('Error fetching full metadata:', error)
    } finally {
      setUrlLoading(false)
      setMediaTypeConfirmation(null)
    }
  }

  // Extract YouTube video ID from URL
  const extractYouTubeId = (url: string): string => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return ''
  }

  // User interactions tracking for AI-enhanced questions
  const [userInteractions, setUserInteractions] = useState<UserInteractions>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smartMediaLogger_preferences')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return {
            ...parsed,
            sessionStart: new Date().toISOString(), // Always fresh session
          }
        } catch (e) {
          console.error('Failed to parse preferences from localStorage:', e)
        }
      }
    }
    return {
      talentPreferences: {},
      questionFeedback: [],
      editHistory: [],
      sessionStart: new Date().toISOString(),
      mediaSearches: [],
    }
  })

  // Persist queue to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartMediaLogger_queue', JSON.stringify(upNextQueue))
    }
  }, [upNextQueue])

  // Persist logged items to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartMediaLogger_logged', JSON.stringify(loggedItems))
    }
  }, [loggedItems])

  // Persist user preferences (talent preferences, etc.) to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartMediaLogger_preferences', JSON.stringify(userInteractions))
    }
  }, [userInteractions])

  // Greeting based on context (simplified for now)
  const greeting = "What did you watch, read, or listen to?"

  // Track if we've saved the current entry (to prevent duplicates)
  const savedEntryIdRef = useRef<string | null>(null)
  // Track if we're resuming a draft (so we can remove it when logging completes)
  const resumingDraftIdRef = useRef<number | null>(null)

  // Log complete interaction data when entry is saved
  useEffect(() => {
    if (step === 'complete' && logData.title) {
      // Generate a unique ID for this entry (works with or without tmdbId)
      const entryUniqueId = logData.tmdbId
        ? `tmdb-${logData.tmdbId}`
        : `${logData.title}-${logData.consumptionDate || Date.now()}`

      // Only save once per entry
      if (savedEntryIdRef.current === entryUniqueId) {
        return // Already saved this entry
      }

      const fullEntryData = {
        entryNumber,
        logData,
        userInteractions,
        completedAt: new Date().toISOString(),
      }
      console.log('=== COMPLETE ENTRY DATA ===')
      console.log(JSON.stringify(fullEntryData, null, 2))
      console.log('===========================')

      // Save to My Stuff (loggedItems) - include ALL metadata
      const newLoggedItem: LoggedItem = {
        id: Date.now(),
        title: logData.title,
        year: logData.year || new Date().getFullYear(),
        mediaType: logData.mediaType,
        tmdbId: logData.tmdbId,
        // Crew
        director: logData.director,
        directors: logData.directors,
        cinematographer: logData.cinematographer,
        composer: logData.composer,
        writers: logData.writers,
        producers: logData.producers,
        editor: logData.editor,
        // Cast
        cast: logData.cast,
        genres: logData.genres,
        runtime: logData.runtime,
        // Ratings & Scores
        tmdbRating: logData.tmdbRating,
        tmdbVoteCount: logData.tmdbVoteCount,
        metacriticScore: logData.metacriticScore,
        rottenTomatoesScore: logData.rottenTomatoesScore,
        metacriticUrl: logData.metacriticUrl,
        rottenTomatoesUrl: logData.rottenTomatoesUrl,
        metacriticData: logData.metacriticData as any,
        rottenTomatoesData: logData.rottenTomatoesData as any,
        imdbUrl: logData.imdbUrl,
        imdbRating: logData.imdbRating,
        imdbVotes: logData.imdbVotes,
        rated: logData.rated,
        // Content
        plot: logData.plot,
        overview: logData.overview,
        awards: logData.awards,
        boxOffice: logData.boxOffice,
        production: logData.production,
        country: logData.country,
        language: logData.language,
        // Media
        trailerUrl: logData.trailerUrl,
        trailerVideoId: logData.trailerVideoId,
        videoId: logData.videoId || urlMetadata?.videoId,
        poster: logData.poster,
        thumbnail: logData.thumbnail,
        description: logData.description,
        duration: logData.duration,
        sourceUrl: logData.sourceUrl || (isUrl(searchQuery) ? searchQuery : undefined),
        // Logging data
        rating: logData.overallRating,
        dateConsumed: logData.consumptionDate || new Date().toISOString().split('T')[0],
        addedAt: new Date().toISOString().split('T')[0],
        notes: logData.notes,
        companionNames: logData.companionNames,
        socialContext: logData.socialContext,
        location: logData.location,
        locationDetail: logData.locationDetail,
        firstTime: logData.firstTime,
      }

      savedEntryIdRef.current = entryUniqueId
      addLoggedItem(newLoggedItem)
      console.log('Saved to My Stuff:', newLoggedItem)

      // Extract entities from notes using AI (async, updates item after)
      if (logData.notes && logData.notes.trim().length >= 10) {
        const extractEntities = async () => {
          try {
            const castNames = logData.cast?.map((c: any) => c.name || c) || []
            const crewList = [
              logData.director && { name: logData.director, job: 'Director' },
              logData.cinematographer && { name: logData.cinematographer, job: 'Cinematographer' },
              logData.composer && { name: logData.composer, job: 'Composer' },
              ...(logData.writers?.map((w: string) => ({ name: w, job: 'Writer' })) || []),
            ].filter(Boolean)

            const response = await fetch('/api/extract-entities', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                comment: logData.notes,
                title: logData.title,
                year: logData.year,
                mediaType: logData.mediaType,
                cast: castNames,
                crew: crewList,
                score: logData.overallRating,
              }),
            })

            if (response.ok) {
              const extracted = await response.json()
              if (extracted.entities?.length > 0 || extracted.themes?.length > 0) {
                console.log('Extracted entities:', extracted)
                // Update the item with extracted data
                updateLoggedItem(newLoggedItem.id, {
                  extractedEntities: extracted.entities,
                  extractedThemes: extracted.themes,
                  overallSentiment: extracted.overall_sentiment,
                })
              }
            }
          } catch (err) {
            console.error('Entity extraction failed:', err)
          }
        }
        extractEntities()
      }

      // Save theater to history for future autofill
      if (logData.location === 'theater' && logData.locationDetail) {
        setTheaterHistory(prev => {
          // Remove duplicates and add to front
          const filtered = prev.filter(t => t.toLowerCase() !== logData.locationDetail!.toLowerCase())
          return [logData.locationDetail!, ...filtered].slice(0, 10) // Keep max 10 theaters
        })
      }

      // If we were resuming a draft, remove the old draft entry now that we've completed
      if (resumingDraftIdRef.current !== null) {
        removeLoggedItem(resumingDraftIdRef.current)
        resumingDraftIdRef.current = null
      }

      // Clear draft since we've completed
      localStorage.removeItem('smartMediaLogger_draft')
    }
  }, [step, logData.title, logData.tmdbId, logData.consumptionDate, logData.overallRating, logData.notes, logData.companionNames, logData.socialContext, logData.location, logData.locationDetail, logData.year, logData.mediaType, logData.director, logData.cast, logData.cinematographer, logData.composer, logData.writers, entryNumber, userInteractions, addLoggedItem, removeLoggedItem, updateLoggedItem, urlMetadata?.videoId, searchQuery])

  // Reset refs when starting a new log
  useEffect(() => {
    if (step === 'search') {
      savedEntryIdRef.current = null
      resumingDraftIdRef.current = null
    }
  }, [step])

  // Auto-fetch metadata when URL is pasted
  useEffect(() => {
    if (isUrl(searchQuery)) {
      // Clear persisted preview when starting a new search
      setPersistedQueuePreview(null)
      fetchUrlMetadata(searchQuery)
      // Auto-switch to the Now tab when user pastes a URL
      setRightPaneTab('logging')
      // Auto-set media type based on URL and clear experience fields
      updateLogData({
        mediaType: guessMediaTypeFromUrl(searchQuery),
        // Clear experience fields so they don't bleed from previous movie
        consumptionDate: undefined,
        location: undefined,
        locationDetail: undefined,
        firstTime: undefined,
        socialContext: undefined,
        companionNames: undefined,
        overallRating: undefined,
        notes: undefined,
      })
    } else {
      setUrlMetadata(null)
    }
  }, [searchQuery])

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    // Clear stale data from previous searches
    setSearchResults([])
    setSelectedMedia(null)
    // Clear experience fields so they don't bleed into the new movie
    updateLogData({
      consumptionDate: undefined,
      location: undefined,
      locationDetail: undefined,
      firstTime: undefined,
      socialContext: undefined,
      companionNames: undefined,
      overallRating: undefined,
      notes: undefined,
    })

    // Auto-switch to the Now tab when user starts a new search
    setRightPaneTab('logging')

    // Track search query
    setUserInteractions(prev => ({
      ...prev,
      mediaSearches: [...prev.mediaSearches, searchQuery.trim()]
    }))

    setStep('searching')

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      )
      const data = await response.json()

      const results: MediaResult[] = data.results.map((item: {
        id: number
        title: string
        year: number
        type: string
        posterUrl: string | null
        director: string | null
        cinematographer: string | null
        composer: string | null
        starring: string[]
        distributor: string | null
        runtime: number | null
        overview: string
        trailerUrl: string | null
        metacriticScore: number | null
        rottenTomatoesScore: number | null
        metacriticUrl: string | null
        rottenTomatoesUrl: string | null
        metacriticData?: MetacriticData
        rottenTomatoesData?: RottenTomatoesData
        streamingOptions?: { service: string; url: string; type: string }[]
      }) => ({
        id: item.id,
        title: item.title,
        year: item.year,
        mediaType: item.type,
        posterPath: item.posterUrl,
        director: item.director,
        cinematographer: item.cinematographer,
        composer: item.composer,
        starring: item.starring,
        distributor: item.distributor,
        runtime: item.runtime,
        overview: item.overview,
        streamingOptions: item.streamingOptions as StreamingOption[] | undefined,
        trailerUrl: item.trailerUrl,
        metacriticScore: item.metacriticScore,
        rottenTomatoesScore: item.rottenTomatoesScore,
        metacriticUrl: item.metacriticUrl,
        rottenTomatoesUrl: item.rottenTomatoesUrl,
        metacriticData: item.metacriticData as MetacriticData | undefined,
        rottenTomatoesData: item.rottenTomatoesData as RottenTomatoesData | undefined,
      }))

      if (results.length === 1) {
        // Auto-select if only one result - clear old results first
        setSearchResults([])
        handleSelectMedia(results[0])
      } else if (results.length > 1) {
        setSearchResults(results)
        setStep('disambiguate')
      } else {
        // No results - show message
        setSearchResults([])
        setStep('disambiguate')
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
      setStep('disambiguate')
    }
  }

  // Handle question feedback
  const handleQuestionFeedback = (feedback: { questionId: string; suggestion: string }) => {
    setUserInteractions(prev => ({
      ...prev,
      questionFeedback: [
        ...prev.questionFeedback,
        { ...feedback, timestamp: new Date().toISOString() }
      ]
    }))
    console.log('Question Feedback Received:', feedback)
  }

  // Handle talent preference changes
  const handleTalentPreferenceChange = (preferences: TalentPreferenceData) => {
    setUserInteractions(prev => ({
      ...prev,
      talentPreferences: preferences
    }))
    console.log('All Talent Preferences:', preferences)
  }

  // Handle media selection - fetch FULL metadata from movie-details API
  const handleSelectMedia = async (media: MediaResult) => {
    // Clear stale URL metadata from previous searches
    setUrlMetadata(null)
    setSelectedMedia(media)
    setStep('analyzing')
    // Auto-switch to the Now tab so user sees the active logging
    setRightPaneTab('logging')

    try {
      // Fetch FULL metadata including cast with photos, all crew, OMDB scores, awards
      const response = await fetch(
        `/api/movie-details?tmdbId=${media.id}&title=${encodeURIComponent(media.title)}&year=${media.year}&type=${media.mediaType}`
      )

      if (response.ok) {
        const fullData = await response.json()

        setLogData({
          // Start fresh - don't spread old logData which may have stale experience fields
          mediaType: fullData.mediaType || media.mediaType,
          title: fullData.title || media.title,
          year: fullData.year || media.year,
          tmdbId: fullData.tmdbId || media.id,
          // Reset experience fields (user will fill these in)
          consumptionDate: undefined,
          location: undefined,
          locationDetail: undefined,
          firstTime: undefined,
          socialContext: undefined,
          companionNames: undefined,
          overallRating: undefined,
          notes: undefined,
          // Full crew
          director: fullData.director,
          directors: fullData.directors,
          cinematographer: fullData.cinematographer,
          composer: fullData.composer,
          writers: fullData.writers,
          producers: fullData.producers,
          editor: fullData.editor,
          // Full cast with photos
          cast: fullData.cast,
          starring: fullData.starring,
          genres: fullData.genres,
          runtime: fullData.runtime,
          // Media
          poster: fullData.poster,
          backdrop: fullData.backdrop,
          trailerUrl: fullData.trailerUrl,
          trailerVideoId: fullData.trailerVideoId,
          overview: fullData.overview,
          // Videos and images from TMDB
          videos: fullData.videos,
          images: fullData.images,
          // Critic scores from OMDB
          metacriticScore: fullData.metacriticScore,
          rottenTomatoesScore: fullData.rottenTomatoesScore,
          imdbRating: fullData.imdbRating,
          imdbVotes: fullData.imdbVotes,
          // URLs
          metacriticUrl: fullData.metacriticUrl,
          rottenTomatoesUrl: fullData.rottenTomatoesUrl,
          imdbUrl: fullData.imdbUrl,
          // Rich metadata from OMDB
          rated: fullData.rated,
          awards: fullData.awards,
          boxOffice: fullData.boxOffice,
          plot: fullData.plot,
          country: fullData.country,
          language: fullData.language,
        })
      } else {
        // Fallback to basic data if full fetch fails
        console.log('Full metadata fetch failed, using basic data')
        setLogData({
          // Start fresh
          mediaType: media.mediaType,
          title: media.title,
          year: media.year,
          tmdbId: media.id,
          director: media.director,
          poster: media.posterPath || media.posterUrl,
          // Reset experience fields
          consumptionDate: undefined,
          location: undefined,
          locationDetail: undefined,
          firstTime: undefined,
          socialContext: undefined,
          companionNames: undefined,
          overallRating: undefined,
          notes: undefined,
        })
      }
    } catch (error) {
      console.error('Error fetching full metadata:', error)
      // Fallback to basic data
      setLogData({
        // Start fresh
        mediaType: media.mediaType,
        title: media.title,
        year: media.year,
        tmdbId: media.id,
        director: media.director,
        // Reset experience fields
        consumptionDate: undefined,
        location: undefined,
        locationDetail: undefined,
        firstTime: undefined,
        socialContext: undefined,
        companionNames: undefined,
        overallRating: undefined,
        notes: undefined,
      })
    }

    setStep('date')
    setQuestionIndex(1)
  }

  // Update log data helper
  const updateLogData = (updates: Partial<LogData>) => {
    setLogData(prev => ({ ...prev, ...updates }))
  }

  // Navigation helpers
  const goToNextStep = () => {
    const steps: FlowStep[] = ['date', 'location', 'first_time', 'social', 'rating', 'notes', 'complete']
    const currentIndex = steps.indexOf(step as FlowStep)
    if (currentIndex < steps.length - 1) {
      // Handle conditional steps
      if (step === 'location' && logData.location === 'theater') {
        setStep('location_detail')
      } else if (step === 'location_detail') {
        setStep('first_time')
        setQuestionIndex(3)
      } else if (step === 'social' && logData.socialContext !== 'alone') {
        setStep('companion_names')
      } else if (step === 'companion_names') {
        setStep('rating')
        setQuestionIndex(5)
      } else {
        setStep(steps[currentIndex + 1])
        setQuestionIndex(prev => Math.min(prev + 1, totalQuestions))
      }
    }
  }

  const goToPrevStep = () => {
    const steps: FlowStep[] = ['search', 'date', 'location', 'first_time', 'social', 'rating', 'notes']
    const currentIndex = steps.indexOf(step as FlowStep)
    if (currentIndex > 0) {
      // Handle going back from conditional steps
      if (step === 'location_detail') {
        setStep('location')
      } else if (step === 'companion_names') {
        setStep('social')
      } else {
        setStep(steps[currentIndex - 1])
        setQuestionIndex(prev => Math.max(prev - 1, 1))
      }
    }
  }

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return undefined
    // Parse as local date (not UTC) by splitting the date string
    // This prevents timezone shifts when displaying dates
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Calculate progress percentage
  const getProgressPercent = () => {
    const steps: FlowStep[] = ['search', 'date', 'location', 'first_time', 'social', 'rating', 'notes', 'complete']
    const currentIndex = steps.indexOf(step as FlowStep)
    if (currentIndex === -1) return 10 // searching/analyzing/disambiguate
    return Math.round((currentIndex / (steps.length - 1)) * 100)
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col">
      {/* Success Toast for Queue Additions */}
      {queueToast.show && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <span className="text-xl">✓</span>
            <span className="font-medium">Added "{queueToast.title}" to your queue!</span>
          </div>
        </div>
      )}

      {/* Smart Media Type Confirmation Dialog */}
      {mediaTypeConfirmation?.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl animate-fade-in max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-accent-blue to-accent-navy p-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                {mediaTypeConfirmation.foundMatch ? '🎬 Found a match!' : '🔍 Is this a movie?'}
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {mediaTypeConfirmation.foundMatch
                  ? 'We found this in our database. Is this correct?'
                  : 'We detected clues this might be a movie or documentary.'}
              </p>
            </div>

            <div className="p-5">
              {/* Pre-filled Movie Card (when we found a match) */}
              {mediaTypeConfirmation.foundMatch && (
                <div className="bg-paper-50 rounded-xl p-4 mb-4 border-2 border-accent-blue">
                  <div className="flex gap-4">
                    {mediaTypeConfirmation.foundMatch.poster && (
                      <img
                        src={mediaTypeConfirmation.foundMatch.poster}
                        alt={mediaTypeConfirmation.foundMatch.title}
                        className="w-24 h-36 object-cover rounded-lg shadow-md"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-ink-800">
                        {mediaTypeConfirmation.foundMatch.title}
                        {mediaTypeConfirmation.foundMatch.year && (
                          <span className="text-ink-500 font-normal ml-2">({mediaTypeConfirmation.foundMatch.year})</span>
                        )}
                      </h4>
                      {mediaTypeConfirmation.foundMatch.director && (
                        <p className="text-sm text-ink-600 mt-1">
                          Directed by <span className="font-medium">{mediaTypeConfirmation.foundMatch.director}</span>
                        </p>
                      )}
                      {mediaTypeConfirmation.foundMatch.tmdbRating && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                            mediaTypeConfirmation.foundMatch.tmdbRating >= 70 ? 'bg-green-100 text-green-700' :
                            mediaTypeConfirmation.foundMatch.tmdbRating >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {mediaTypeConfirmation.foundMatch.tmdbRating}%
                          </span>
                          <span className="text-xs text-ink-400">TMDB</span>
                        </div>
                      )}
                      {mediaTypeConfirmation.foundMatch.genres && mediaTypeConfirmation.foundMatch.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {mediaTypeConfirmation.foundMatch.genres.slice(0, 3).map((genre: string) => (
                            <span key={genre} className="text-xs px-2 py-0.5 bg-paper-200 text-ink-600 rounded-full">
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {mediaTypeConfirmation.foundMatch.overview && (
                    <p className="text-sm text-ink-600 mt-3 line-clamp-3">
                      {mediaTypeConfirmation.foundMatch.overview}
                    </p>
                  )}
                </div>
              )}

              {/* Clues (when no match found) */}
              {!mediaTypeConfirmation.foundMatch && mediaTypeConfirmation.clues.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-amber-800 mb-2">Clues we found:</p>
                  <ul className="text-sm text-amber-700 list-disc list-inside">
                    {mediaTypeConfirmation.clues.slice(0, 3).map((clue, i) => (
                      <li key={i}>{clue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {mediaTypeConfirmation.foundMatch ? (
                  <>
                    <button
                      onClick={() => handleMediaTypeConfirmWithMatch()}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                    >
                      ✓ Yes, this is correct!
                    </button>
                    <button
                      onClick={() => handleMediaTypeConfirm('movie')}
                      className="w-full px-4 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      🔍 Search for a different movie
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleMediaTypeConfirm('movie')}
                      className="w-full px-4 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      🎬 Yes, it&apos;s a Movie/Documentary
                    </button>
                    <button
                      onClick={() => handleMediaTypeConfirm('tv')}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors"
                    >
                      📺 It&apos;s a TV Show
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleMediaTypeConfirm('video')}
                  className="w-full px-4 py-3 bg-paper-200 text-ink-600 rounded-xl font-bold hover:bg-paper-300 transition-colors"
                >
                  📹 No, just a YouTube video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-white border-b border-paper-400 px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-500">Progress</span>
            <span className="text-sm font-medium text-ink-500">{getProgressPercent()}%</span>
          </div>
          <div className="h-2 bg-paper-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
      {/* LEFT PANE - Questions */}
      <div className="w-1/2 px-10 pb-10 pt-4 flex items-start justify-center overflow-y-auto bg-white">
        <div className="w-full max-w-2xl">
          {/* SEARCH STEP */}
          {step === 'search' && (
            <div className="animate-fade-in">
              {/* Mode Toggle - Log vs Add to Queue */}
              <div className="mb-8">
                <div className="flex rounded-xl overflow-hidden border-2 border-accent-blue">
                  <button
                    onClick={() => {
                      setSearchMode('log')
                      setRightPaneTab('logging')
                    }}
                    className={`flex-1 py-4 px-6 font-bold text-center transition-all ${
                      searchMode === 'log'
                        ? 'bg-accent-blue text-white'
                        : 'bg-white text-accent-blue hover:bg-accent-blue/10'
                    }`}
                  >
                    <div className="text-lg">✍️ Log It</div>
                    <div className={`text-xs mt-1 ${searchMode === 'log' ? 'text-white/80' : 'text-ink-500'}`}>
                      Something I watched, read, or listened to
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setSearchMode('queue')
                      setRightPaneTab('logging')
                    }}
                    className={`flex-1 py-4 px-6 font-bold text-center transition-all ${
                      searchMode === 'queue'
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-orange-500 hover:bg-orange-50'
                    }`}
                  >
                    <div className="text-lg">📋 Add to Queue</div>
                    <div className={`text-xs mt-1 ${searchMode === 'queue' ? 'text-white/80' : 'text-ink-500'}`}>
                      Something I want to watch, read, or listen to
                    </div>
                  </button>
                </div>
              </div>

              <h2 className="text-lg italic font-bold text-blue-900 mb-6">
                {searchMode === 'log'
                  ? "What did you watch, read, or listen to?"
                  : "What do you want to add to your queue?"}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!isUrl(searchQuery)) {
                    handleSearch()
                  }
                }}
                className="mb-4"
              >
                <VoiceInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={searchMode === 'log'
                    ? "Search for a movie, book, album..."
                    : "Search or paste a URL (trailer, article, etc.)..."}
                  className="text-lg"
                />
              </form>

              {/* URL Detected - Special UI */}
              {isUrl(searchQuery) ? (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5 mb-4">
                  {/* Loading State */}
                  {urlLoading ? (
                    <div className="text-center py-6">
                      <div className="text-4xl mb-3 animate-pulse">🔍</div>
                      <p className="text-orange-700 font-medium">Fetching metadata...</p>
                    </div>
                  ) : (
                    <>
                      {/* Metadata Preview */}
                      {urlMetadata?.thumbnail && (
                        <div className="mb-4 rounded-lg overflow-hidden shadow-md bg-black">
                          <img
                            src={urlMetadata.thumbnail}
                            alt={urlMetadata.title || 'Preview'}
                            className="w-full aspect-video object-contain"
                          />
                        </div>
                      )}

                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-2xl">🔗</span>
                        <div className="flex-1">
                          <p className="font-bold text-orange-700">
                            {urlMetadata?.title ? 'Found it!' : 'Link detected!'}
                          </p>
                          <p className="text-sm text-ink-600 mt-1">{getDomain(searchQuery)}</p>
                          {urlMetadata?.author && (
                            <p className="text-sm text-ink-500 mt-1">
                              <span className="font-medium">Channel:</span> {urlMetadata.author}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-ink-700 mb-1">
                            {urlMetadata?.title ? 'Title (edit if needed):' : 'What is this?'}
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Dune Part 2 trailer, Interview with Coppola..."
                            defaultValue={urlMetadata?.title || ''}
                            className="w-full px-4 py-3 rounded-lg border-2 border-orange-300 focus:border-orange-500 focus:outline-none"
                            id="url-title-input"
                          />
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <span className="text-sm text-ink-500">Type:</span>
                          {[
                            { type: 'video', icon: '▶️', label: 'Video' },
                            { type: 'movie', icon: '🎬', label: 'Movie' },
                            { type: 'tv', icon: '📺', label: 'TV' },
                            { type: 'book', icon: '📖', label: 'Book' },
                            { type: 'audiobook', icon: '🎧', label: 'Audiobook' },
                            { type: 'music', icon: '🎵', label: 'Music' },
                            { type: 'podcast', icon: '🎙️', label: 'Podcast' },
                          ].map(({ type, icon, label }) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => updateLogData({ mediaType: type })}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                logData.mediaType === type
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-white text-ink-600 border border-orange-300 hover:bg-orange-100'
                              }`}
                            >
                              {icon} {label}
                            </button>
                          ))}
                        </div>

                        {searchMode === 'log' ? (
                          <button
                            onClick={() => {
                              const titleInput = document.getElementById('url-title-input') as HTMLInputElement
                              const title = titleInput?.value || urlMetadata?.title || 'Untitled'
                              // Set up log data with ALL metadata - same as queue mode
                              updateLogData({
                                title,
                                year: urlMetadata?.mediaYear || new Date().getFullYear(),
                                mediaType: urlMetadata?.detectedMediaType || logData.mediaType,
                                tmdbId: urlMetadata?.tmdbId,
                                // Crew
                                director: urlMetadata?.director || urlMetadata?.author,
                                directors: urlMetadata?.directors,
                                cinematographer: urlMetadata?.cinematographer,
                                composer: urlMetadata?.composer,
                                writers: urlMetadata?.writers,
                                producers: urlMetadata?.producers,
                                editor: urlMetadata?.editor,
                                // Cast
                                cast: urlMetadata?.cast,
                                starring: urlMetadata?.cast?.map((c: any) => c.name),
                                genres: urlMetadata?.genres,
                                runtime: urlMetadata?.runtime,
                                // Ratings & scores
                                tmdbRating: urlMetadata?.tmdbRating,
                                tmdbVoteCount: urlMetadata?.tmdbVoteCount,
                                metacriticScore: urlMetadata?.metacriticScore,
                                metacriticData: urlMetadata?.metacriticData,
                                rottenTomatoesScore: urlMetadata?.rottenTomatoesScore,
                                rottenTomatoesData: urlMetadata?.rottenTomatoesData,
                                metacriticUrl: urlMetadata?.metacriticUrl,
                                rottenTomatoesUrl: urlMetadata?.rottenTomatoesUrl,
                                imdbUrl: urlMetadata?.imdbUrl,
                                imdbRating: urlMetadata?.imdbRating,
                                imdbVotes: urlMetadata?.imdbVotes,
                                rated: urlMetadata?.rated,
                                // Content
                                plot: urlMetadata?.plot,
                                overview: urlMetadata?.overview,
                                awards: urlMetadata?.awards,
                                boxOffice: urlMetadata?.boxOffice,
                                production: urlMetadata?.production,
                                country: urlMetadata?.country,
                                language: urlMetadata?.language,
                                // Media
                                trailerUrl: urlMetadata?.trailerUrl,
                                trailerVideoId: urlMetadata?.trailerVideoId || urlMetadata?.videoId,
                                poster: urlMetadata?.poster || urlMetadata?.thumbnail,
                                thumbnail: urlMetadata?.thumbnail,
                                description: urlMetadata?.description,
                                duration: urlMetadata?.duration,
                                videoId: urlMetadata?.videoId,
                                sourceUrl: searchQuery.trim(),
                              })
                              setStep('date')
                            }}
                            className="w-full py-3 bg-accent-blue text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
                          >
                            ✓ Confirm & Log This
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const titleInput = document.getElementById('url-title-input') as HTMLInputElement
                              const title = titleInput?.value || urlMetadata?.title || 'Untitled'
                              addToQueue({
                                title,
                                year: urlMetadata?.mediaYear || new Date().getFullYear(),
                                mediaType: urlMetadata?.detectedMediaType || logData.mediaType,
                                director: urlMetadata?.director || urlMetadata?.author,
                                sourceUrl: searchQuery.trim(),
                                videoId: urlMetadata?.videoId,
                                author: urlMetadata?.author,
                                authorUrl: urlMetadata?.authorUrl,
                                thumbnail: urlMetadata?.thumbnail,
                                description: urlMetadata?.description,
                                duration: urlMetadata?.duration,
                                viewCount: urlMetadata?.viewCount,
                                publishDate: urlMetadata?.publishDate,
                              })
                            }}
                            className="w-full py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
                          >
                            📋 Add to Queue
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim()}
                  className={`
                    w-full py-3 rounded-lg font-medium transition-all
                    ${searchQuery.trim()
                      ? searchMode === 'log'
                        ? 'bg-accent-blue text-white hover:bg-blue-600'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-paper-300 text-ink-400 cursor-not-allowed'
                    }
                  `}
                >
                  Search
                </button>
              )}

              {/* Media type shortcuts */}
              <div className="mt-6">
                <p className="text-ink-500 text-sm mb-3">Filter by type:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { type: 'movie', icon: '🎬', label: 'Movie' },
                    { type: 'tv', icon: '📺', label: 'TV' },
                    { type: 'video', icon: '▶️', label: 'Video' },
                    { type: 'book', icon: '📖', label: 'Book' },
                    { type: 'audiobook', icon: '🎧', label: 'Audiobook' },
                    { type: 'music', icon: '🎵', label: 'Music' },
                    { type: 'podcast', icon: '🎙️', label: 'Podcast' },
                  ].map(({ type, icon, label }) => (
                    <button
                      key={type}
                      onClick={() => updateLogData({ mediaType: type })}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-bold transition-all border-2
                        ${logData.mediaType === type
                          ? searchMode === 'log'
                            ? 'bg-accent-blue text-white border-accent-blue'
                            : 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-ink-800 border-paper-400 hover:border-accent-blue'
                        }
                      `}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SEARCHING STEP */}
          {step === 'searching' && (
            <div className="animate-fade-in text-center py-12">
              <div className="text-4xl mb-4 animate-pulse-subtle">🔍</div>
              <p className="text-ink-600">Searching...</p>
            </div>
          )}

          {/* DISAMBIGUATE STEP - AI-powered smart disambiguation */}
          {step === 'disambiguate' && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep('search')}
                className="flex items-center gap-1 text-ink-500 hover:text-ink-800 mb-4 text-sm"
              >
                ← Back
              </button>

              {searchResults.length === 0 ? (
                <>
                  <h2 className="text-xl font-semibold text-ink-800 mb-4">
                    No results found
                  </h2>
                  <p className="text-ink-500">Try a different search term, or check the spelling.</p>
                </>
              ) : searchResults.length === 1 ? (
                <>
                  <h2 className="text-xl font-semibold text-ink-800 mb-4">
                    {searchMode === 'queue' ? 'Add this to your queue?' : 'Is this what you watched?'}
                  </h2>
                  <div className="w-full p-5 bg-paper-100 rounded-lg text-left border-2 border-accent-blue">
                    <div className={`font-bold text-lg ${searchMode === 'queue' ? 'text-orange-500' : 'text-accent-blue'}`}>
                      {searchResults[0].title} ({searchResults[0].year})
                    </div>
                    {searchResults[0].director && (
                      <div className="text-ink-600 mt-1">
                        Directed by {searchResults[0].director}
                      </div>
                    )}
                    <div className="text-sm text-ink-500 mt-2 uppercase tracking-wide">
                      {searchResults[0].mediaType === 'tv' ? 'TV Series' : 'Film'}
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t border-paper-200">
                      {searchMode === 'queue' ? (
                        <>
                          <button
                            onClick={() => addToQueueSmart(searchResults[0])}
                            className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
                          >
                            📋 Add to Queue
                          </button>
                          <button
                            onClick={() => handleSelectMedia(searchResults[0])}
                            className="px-4 py-3 bg-paper-300 text-ink-700 rounded-lg font-bold hover:bg-paper-400 transition-colors"
                          >
                            Log It Instead
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSelectMedia(searchResults[0])}
                            className="flex-1 px-4 py-3 bg-accent-blue text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
                          >
                            ✍️ Log It Now
                          </button>
                          <button
                            onClick={() => addToQueueSmart(searchResults[0])}
                            className="px-4 py-3 bg-paper-300 text-ink-700 rounded-lg font-bold hover:bg-paper-400 transition-colors"
                          >
                            + Queue
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-ink-500 mt-4 text-sm">
                    Not what you meant? <button onClick={() => setStep('search')} className="text-accent-blue hover:underline">Search again</button>
                  </p>
                </>
              ) : (
                <>
                  {/* Smart question based on what we found */}
                  <div className={`${searchMode === 'queue' ? 'bg-orange-100 border-orange-400' : 'bg-accent-blue/10 border-accent-blue'} border-2 rounded-xl p-4 mb-6`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{searchMode === 'queue' ? '📋' : '🤖'}</span>
                      <div>
                        <p className="text-ink-800 font-medium">
                          I found {searchResults.length} options for "{searchQuery}"
                        </p>
                        <p className="text-ink-600 text-sm mt-1">
                          {searchMode === 'queue'
                            ? 'Which one do you want to add to your queue?'
                            : `Which one did you ${logData.mediaType === 'movie' ? 'watch' : logData.mediaType === 'book' ? 'read' : 'experience'}?`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {searchResults.map((result) => {
                      const typeLabel = result.mediaType === 'tv' ? 'TV Series'
                        : result.mediaType === 'book' ? 'Book'
                        : result.mediaType === 'audiobook' ? 'Audiobook'
                        : result.mediaType === 'music' ? 'Album'
                        : result.mediaType === 'podcast' ? 'Podcast'
                        : 'Film'

                      const creatorLabel = result.mediaType === 'book' || result.mediaType === 'audiobook'
                        ? 'By'
                        : result.mediaType === 'tv'
                        ? 'Created by'
                        : result.mediaType === 'music'
                        ? 'Artist'
                        : 'Directed by'

                      return (
                        <div
                          key={result.id}
                          className={`w-full p-4 bg-paper-100 rounded-lg text-left transition-colors border ${searchMode === 'queue' ? 'border-orange-200 hover:border-orange-400' : 'border-paper-300 hover:border-accent-blue'}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-ink-800">
                                {result.title} ({result.year})
                              </div>
                              {result.director && (
                                <div className="text-sm text-ink-500 mt-1">
                                  {creatorLabel} {result.director}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <span className={`text-xs px-2 py-1 rounded uppercase font-medium ${
                                result.mediaType === 'book' ? 'bg-amber-100 text-amber-700' :
                                result.mediaType === 'tv' ? 'bg-purple-100 text-purple-700' :
                                'bg-paper-300 text-ink-600'
                              }`}>
                                {typeLabel}
                              </span>
                            </div>
                          </div>
                          {/* Action buttons - order changes based on mode */}
                          <div className="flex gap-2 mt-3 pt-3 border-t border-paper-200">
                            {searchMode === 'queue' ? (
                              <>
                                <button
                                  onClick={() => addToQueueSmart(result)}
                                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm hover:bg-orange-600 transition-colors"
                                >
                                  📋 Add to Queue
                                </button>
                                <button
                                  onClick={() => handleSelectMedia(result)}
                                  className="px-4 py-2 bg-paper-300 text-ink-700 rounded-lg font-bold text-sm hover:bg-paper-400 transition-colors"
                                >
                                  Log It
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleSelectMedia(result)}
                                  className="flex-1 px-4 py-2 bg-accent-blue text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
                                >
                                  ✍️ Log It Now
                                </button>
                                <button
                                  onClick={() => addToQueueSmart(result)}
                                  className="px-4 py-2 bg-paper-300 text-ink-700 rounded-lg font-bold text-sm hover:bg-paper-400 transition-colors"
                                >
                                  + Queue
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ANALYZING STEP */}
          {step === 'analyzing' && (
            <div className="animate-fade-in text-center py-12">
              <div className="text-4xl mb-4 animate-pulse-subtle">🔍</div>
              <p className="text-ink-800 font-medium mb-2">
                Gathering information on {selectedMedia?.title}...
              </p>
              <div className="text-sm text-ink-500 space-y-1">
                <p className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  ✓ Found director, cast, crew
                </p>
                <p className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
                  ✓ Analyzing critical reception
                </p>
                <p className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
                  ✓ Identifying notable elements
                </p>
              </div>
            </div>
          )}

          {/* DATE QUESTION */}
          {step === 'date' && (
            <QuestionCard
              questionNumber={1}
              totalQuestions={totalQuestions}
              questionId="date"
              showBack={false}
              onSkip={goToNextStep}
              onContinue={goToNextStep}
              onFeedback={handleQuestionFeedback}
              onSaveExit={saveAndExit}
            >
              <h3 className="text-xl font-semibold text-ink-800 mb-4">
                When did you watch this?
              </h3>

              {/* Quick date buttons */}
              <div className="flex flex-wrap gap-3 mb-6">
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Yesterday', days: 1 },
                  { label: 'Last Week', days: 7 },
                  { label: '2 Weeks Ago', days: 14 },
                ].map(({ label, days }) => {
                  const date = new Date()
                  date.setDate(date.getDate() - days)
                  // Format as local date (YYYY-MM-DD) without timezone conversion
                  const year = date.getFullYear()
                  const month = String(date.getMonth() + 1).padStart(2, '0')
                  const day = String(date.getDate()).padStart(2, '0')
                  const dateStr = `${year}-${month}-${day}`
                  const isSelected = logData.consumptionDate === dateStr
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => updateLogData({ consumptionDate: dateStr })}
                      className={`
                        px-5 py-3 rounded-xl font-bold text-lg transition-all border-2
                        ${isSelected
                          ? 'bg-accent-blue text-white border-accent-blue'
                          : 'bg-white text-ink-800 border-accent-blue hover:bg-accent-blue hover:text-white'
                        }
                      `}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Or pick a specific date */}
              <div className="text-accent-blue font-bold mb-2">Or pick a date:</div>
              <DatePicker
                value={logData.consumptionDate || ''}
                onChange={(date) => updateLogData({ consumptionDate: date })}
              />
            </QuestionCard>
          )}

          {/* LOCATION QUESTION */}
          {step === 'location' && (
            <QuestionCard
              questionNumber={2}
              totalQuestions={totalQuestions}
              questionId="location"
              onBack={goToPrevStep}
              onSkip={goToNextStep}
              onContinue={goToNextStep}
              onSaveExit={saveAndExit}
              canContinue={!!logData.location}
              onFeedback={handleQuestionFeedback}
            >
              <h3 className="text-xl font-semibold text-ink-800 mb-4">
                Where did you watch it?
              </h3>
              <div className="space-y-2">
                {[
                  { value: 'theater', label: 'Theater' },
                  { value: 'home', label: 'Home' },
                  { value: 'other', label: 'Other' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => updateLogData({ location: value })}
                    className={`
                      w-full p-4 rounded-lg text-left transition-all border
                      ${logData.location === value
                        ? 'bg-accent-blue/10 border-accent-blue text-ink-800'
                        : 'bg-paper-100 border-paper-300 text-ink-600 hover:border-paper-400'
                      }
                    `}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${logData.location === value ? 'border-accent-blue' : 'border-ink-300'}
                      `}>
                        {logData.location === value && (
                          <span className="w-3 h-3 rounded-full bg-accent-blue" />
                        )}
                      </span>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </QuestionCard>
          )}

          {/* LOCATION DETAIL (Theater name) */}
          {step === 'location_detail' && (
            <QuestionCard
              questionNumber={2}
              totalQuestions={totalQuestions}
              questionId="location_detail"
              onBack={goToPrevStep}
              onSkip={goToNextStep}
              onContinue={goToNextStep}
              onFeedback={handleQuestionFeedback}
              onSaveExit={saveAndExit}
            >
              <h3 className="text-xl font-semibold text-ink-800 mb-4">
                Which theater? (optional)
              </h3>

              {/* Quick select from recent theaters */}
              {theaterHistory.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm text-ink-500 mb-2">Recent theaters:</div>
                  <div className="flex flex-wrap gap-2">
                    {theaterHistory.slice(0, 5).map((theater) => (
                      <button
                        key={theater}
                        type="button"
                        onClick={() => updateLogData({ locationDetail: theater })}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-all border-2
                          ${logData.locationDetail === theater
                            ? 'bg-accent-blue text-white border-accent-blue'
                            : 'bg-white text-ink-700 border-accent-blue hover:bg-accent-blue hover:text-white'
                          }
                        `}
                      >
                        {theater}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); goToNextStep() }}>
                <div className="text-sm text-ink-500 mb-2">
                  {theaterHistory.length > 0 ? 'Or enter a new theater:' : ''}
                </div>
                <VoiceInput
                  value={logData.locationDetail || ''}
                  onChange={(value) => updateLogData({ locationDetail: value })}
                  placeholder="e.g., Paris Theater, NYC"
                />
              </form>
            </QuestionCard>
          )}

          {/* FIRST TIME QUESTION */}
          {step === 'first_time' && (
            <QuestionCard
              questionNumber={3}
              totalQuestions={totalQuestions}
              questionId="first_time"
              onBack={goToPrevStep}
              onSkip={goToNextStep}
              onContinue={goToNextStep}
              canContinue={logData.firstTime !== undefined}
              onFeedback={handleQuestionFeedback}
              onSaveExit={saveAndExit}
            >
              <h3 className="text-xl font-semibold text-ink-800 mb-4">
                Was this your first time watching it?
              </h3>
              <div className="space-y-2">
                {[
                  { value: true, label: 'Yes, first time' },
                  { value: false, label: "No, I've seen it before" },
                ].map(({ value, label }) => (
                  <button
                    key={String(value)}
                    onClick={() => updateLogData({ firstTime: value })}
                    className={`
                      w-full p-4 rounded-lg text-left transition-all border
                      ${logData.firstTime === value
                        ? 'bg-accent-blue/10 border-accent-blue text-ink-800'
                        : 'bg-paper-100 border-paper-300 text-ink-600 hover:border-paper-400'
                      }
                    `}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${logData.firstTime === value ? 'border-accent-blue' : 'border-ink-300'}
                      `}>
                        {logData.firstTime === value && (
                          <span className="w-3 h-3 rounded-full bg-accent-blue" />
                        )}
                      </span>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </QuestionCard>
          )}

          {/* SOCIAL CONTEXT QUESTION */}
          {step === 'social' && (
            <QuestionCard
              questionNumber={4}
              totalQuestions={totalQuestions}
              questionId="social"
              onBack={goToPrevStep}
              onSkip={goToNextStep}
              onContinue={goToNextStep}
              canContinue={!!logData.socialContext}
              onFeedback={handleQuestionFeedback}
              onSaveExit={saveAndExit}
            >
              <h3 className="text-xl font-semibold text-ink-800 mb-4">
                Who were you with?
              </h3>
              <div className="space-y-2">
                {[
                  { value: 'alone', label: 'Alone' },
                  { value: 'friends', label: 'Friends' },
                  { value: 'partner', label: 'Partner/Date' },
                  { value: 'family', label: 'Family' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => updateLogData({ socialContext: value })}
                    className={`
                      w-full p-4 rounded-lg text-left transition-all border
                      ${logData.socialContext === value
                        ? 'bg-accent-blue/10 border-accent-blue text-ink-800'
                        : 'bg-paper-100 border-paper-300 text-ink-600 hover:border-paper-400'
                      }
                    `}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${logData.socialContext === value ? 'border-accent-blue' : 'border-ink-300'}
                      `}>
                        {logData.socialContext === value && (
                          <span className="w-3 h-3 rounded-full bg-accent-blue" />
                        )}
                      </span>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </QuestionCard>
          )}

          {/* COMPANION NAMES */}
          {step === 'companion_names' && (
            <QuestionCard
              questionNumber={4}
              totalQuestions={totalQuestions}
              questionId="companion_names"
              onBack={goToPrevStep}
              onSkip={goToNextStep}
              onContinue={goToNextStep}
              onFeedback={handleQuestionFeedback}
              onSaveExit={saveAndExit}
            >
              <h3 className="text-xl font-semibold text-ink-800 mb-4">
                Who did you see it with?
              </h3>
              <form onSubmit={(e) => { e.preventDefault(); goToNextStep() }}>
                <VoiceInput
                  value={logData.companionNames || ''}
                  onChange={(value) => {
                    // Parse names into array for analytics
                    const companions = value
                      .split(/[,&]/) // Split on comma or ampersand
                      .map(name => name.trim())
                      .filter(name => name.length > 0)
                    updateLogData({ companionNames: value, companions })
                  }}
                  placeholder="e.g., Sarah, Mike"
                />
              </form>
            </QuestionCard>
          )}

          {/* RATING QUESTION */}
          {step === 'rating' && (
            <QuestionCard
              questionNumber={5}
              totalQuestions={totalQuestions}
              questionId="rating"
              onBack={goToPrevStep}
              onSkip={goToNextStep}
              onContinue={goToNextStep}
              onFeedback={handleQuestionFeedback}
              onSaveExit={saveAndExit}
            >
              <h3 className="text-xl font-semibold text-ink-800 mb-6">
                How would you rate it overall?
              </h3>
              <RatingSlider
                value={logData.overallRating || 50}
                onChange={(value) => updateLogData({ overallRating: value })}
              />
            </QuestionCard>
          )}

          {/* NOTES QUESTION - THE POWER OF AI: Get rich, detailed feedback */}
          {step === 'notes' && (
            <QuestionCard
              questionNumber={6}
              totalQuestions={totalQuestions}
              questionId="notes"
              onBack={goToPrevStep}
              onSkip={() => setStep('complete')}
              onContinue={() => setStep('complete')}
              onFeedback={handleQuestionFeedback}
              onSaveExit={saveAndExit}
            >
              <div className="bg-accent-blue/10 border-2 border-accent-blue rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <h3 className="text-xl font-bold text-accent-blue mb-2">
                      Tell me everything.
                    </h3>
                    <p className="text-ink-700 leading-relaxed">
                      The more you share, the smarter I get at recommending what you'll love.
                      Don't hold back—speak freely or type at length.
                    </p>
                  </div>
                </div>
              </div>

              {/* Character Gallery - Click to add thoughts about specific characters/scenes */}
              {logData.mediaType === 'movie' && logData.title && (
                <div className="mb-6">
                  <CharacterGallery
                    movieTitle={logData.title}
                    movieYear={logData.year}
                    onNoteAdded={(note) => {
                      // Store structured note for preference learning
                      setCharacterSceneNotes(prev => [...prev, note])

                      // Also append to free-form notes for display
                      const prefix = note.type === 'character'
                        ? `About ${note.characterName} (${note.actorName}): `
                        : `About Scene ${note.sceneIndex}: `
                      const newNote = prefix + note.note
                      updateLogData({
                        notes: logData.notes
                          ? logData.notes + '\n\n' + newNote
                          : newNote
                      })

                      // Log structured data for debugging/analysis
                      console.log('=== CHARACTER/SCENE NOTE (Structured) ===')
                      console.log(JSON.stringify(note, null, 2))
                      console.log('=========================================')
                    }}
                  />

                  {/* Display structured notes with visual context */}
                  {characterSceneNotes.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-paper-600">Your notes on characters & scenes:</p>
                      {characterSceneNotes.map((note) => (
                        <div key={note.id} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-paper-300">
                          {/* Thumbnail */}
                          {(note.actorThumbnail || note.sceneThumbnail) && (
                            <img
                              src={note.actorThumbnail || note.sceneThumbnail}
                              alt=""
                              className="w-12 h-12 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            {/* Entity label */}
                            <p className="text-sm font-bold text-accent-blue">
                              {note.type === 'character'
                                ? `${note.characterName} (${note.actorName})`
                                : `Scene ${note.sceneIndex}`
                              }
                            </p>
                            {/* Note text */}
                            <p className="text-sm text-paper-700 mt-1">{note.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 mb-6">
                <p className="text-ink-800 font-medium">Consider:</p>
                <ul className="text-ink-600 space-y-2 ml-4">
                  <li>• What moments or scenes left an impression on you?</li>
                  <li>• Which performances stood out—for better or worse?</li>
                  <li>• How did it make you feel? What emotions came up?</li>
                  <li>• Would you recommend this? To whom?</li>
                  <li>• How does it compare to similar things you've seen?</li>
                  <li>• Anything that surprised, disappointed, or delighted you?</li>
                </ul>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); setStep('complete') }}>
                <VoiceInput
                  value={logData.notes || ''}
                  onChange={(value) => updateLogData({ notes: value })}
                  placeholder="I loved how... / The thing that really got me was... / I couldn't stop thinking about..."
                  multiline
                  className="min-h-[150px]"
                />
              </form>

              <p className="text-xs text-ink-500 mt-4 text-center">
                Your detailed feedback powers personalized recommendations and helps you remember why you loved (or didn't love) this.
              </p>
            </QuestionCard>
          )}

          {/* COMPLETE - AI analyzes your feedback and asks smart follow-ups */}
          {step === 'complete' && (
            <CompleteStep
              logData={logData}
              updateLogData={updateLogData}
              setStep={setStep}
              setSearchQuery={setSearchQuery}
              setSelectedMedia={setSelectedMedia}
              setQuestionIndex={setQuestionIndex}
              setCharacterSceneNotes={setCharacterSceneNotes}
              setRightPaneTab={setRightPaneTab}
            />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-paper-400" />

      {/* RIGHT PANE - Tabbed Dashboard */}
      <div className="w-1/2 bg-[#F0F4FF] overflow-hidden rounded-2xl mr-4 my-4">
        <RightPaneTabs
          currentEntry={{
            entryNumber,
            mediaType: logData.mediaType,
            title: logData.title,
            year: logData.year,
            dateWatched: formatDate(logData.consumptionDate),
            director: logData.director,
            cinematographer: logData.cinematographer,
            composer: logData.composer,
            starring: logData.starring,
            cast: logData.cast,
            distributor: logData.distributor,
            runtime: logData.runtime,
            rating: logData.overallRating,
            location: logData.location,
            locationDetail: logData.locationDetail,
            firstTime: logData.firstTime,
            socialContext: logData.socialContext,
            companionNames: logData.companionNames,
            notes: logData.notes,
            metacriticScore: logData.metacriticScore,
            rottenTomatoesScore: logData.rottenTomatoesScore,
            trailerUrl: logData.trailerUrl,
            metacriticUrl: logData.metacriticUrl,
            rottenTomatoesUrl: logData.rottenTomatoesUrl,
            metacriticData: logData.metacriticData,
            rottenTomatoesData: logData.rottenTomatoesData,
            streamingOptions: logData.streamingOptions,
            videoId: logData.videoId || urlMetadata?.videoId,
            sourceUrl: logData.sourceUrl || (isUrl(searchQuery) ? searchQuery : undefined),
            // Rich metadata
            poster: logData.poster,
            imdbRating: logData.imdbRating,
            imdbVotes: logData.imdbVotes,
            imdbUrl: logData.imdbUrl,
            rated: logData.rated,
            awards: logData.awards,
            boxOffice: logData.boxOffice,
            plot: logData.plot,
            overview: logData.overview,
            country: logData.country,
            language: logData.language,
            genres: logData.genres,
            tmdbRating: logData.tmdbRating,
          }}
          isLogging={step !== 'complete'}
          onEdit={(changes) => {
            // Track edit history
            const changedFields = Object.entries(changes).filter(([key, value]) => {
              const logKey = key === 'dateWatched' ? 'consumptionDate' : key === 'rating' ? 'overallRating' : key
              return value !== logData[logKey as keyof LogData]
            })

            if (changedFields.length > 0) {
              setUserInteractions(prev => ({
                ...prev,
                editHistory: [
                  ...prev.editHistory,
                  ...changedFields.map(([field, newValue]) => ({
                    field,
                    oldValue: logData[field as keyof LogData],
                    newValue,
                    timestamp: new Date().toISOString()
                  }))
                ]
              }))
            }

            // Apply the changes to logData
            setLogData({
              ...logData,
              title: changes.title ?? logData.title,
              year: changes.year ?? logData.year,
              director: changes.director ?? logData.director,
              cinematographer: changes.cinematographer ?? logData.cinematographer,
              composer: changes.composer ?? logData.composer,
              starring: changes.starring ?? logData.starring,
              distributor: changes.distributor ?? logData.distributor,
              runtime: changes.runtime ?? logData.runtime,
              consumptionDate: changes.dateWatched ?? logData.consumptionDate,
              location: changes.location ?? logData.location,
              locationDetail: changes.locationDetail ?? logData.locationDetail,
              firstTime: changes.firstTime ?? logData.firstTime,
              socialContext: changes.socialContext ?? logData.socialContext,
              companionNames: changes.companionNames ?? logData.companionNames,
              overallRating: changes.rating ?? logData.overallRating,
              notes: changes.notes ?? logData.notes,
            })
            console.log('Media card edited:', changes)
          }}
          onTalentPreferenceChange={handleTalentPreferenceChange}
          talentPreferences={userInteractions.talentPreferences}
          upNextQueue={upNextQueue}
          onAddToQueue={addToQueue}
          onRemoveFromQueue={(id) => setUpNextQueue(prev => prev.filter(item => item.id !== id))}
          onLogFromQueue={handleLogFromQueue}
          loggedItems={loggedItems}
          onAddLoggedItem={addLoggedItem}
          onUpdateLoggedItem={updateLoggedItem}
          onRemoveLoggedItem={removeLoggedItem}
          onResumeDraft={handleResumeDraft}
          activeTabOverride={rightPaneTab}
          tabSwitchTrigger={tabSwitchTrigger}
          onTabChange={setRightPaneTab}
          searchMode={searchMode}
          queuePreview={
            // Use persisted preview if available (after adding to queue)
            // Otherwise use live preview from URL metadata
            persistedQueuePreview ? {
              ...persistedQueuePreview,
              isLoading: false,
            } : isUrl(searchQuery) ? {
              title: urlMetadata?.title,
              author: urlMetadata?.author,
              authorUrl: urlMetadata?.authorUrl,
              thumbnail: urlMetadata?.thumbnail,
              videoId: urlMetadata?.videoId || urlMetadata?.trailerVideoId,
              description: urlMetadata?.description,
              duration: urlMetadata?.duration,
              viewCount: urlMetadata?.viewCount,
              publishDate: urlMetadata?.publishDate,
              sourceUrl: searchQuery,
              mediaType: logData.mediaType,
              isLoading: urlLoading,
              // Enhanced trailer metadata from TMDB
              isTrailer: urlMetadata?.isTrailer,
              detectedMediaType: urlMetadata?.detectedMediaType,
              tmdbId: urlMetadata?.tmdbId,
              director: urlMetadata?.director,
              directors: urlMetadata?.directors,
              cinematographer: urlMetadata?.cinematographer,
              composer: urlMetadata?.composer,
              writers: urlMetadata?.writers,
              producers: urlMetadata?.producers,
              editor: urlMetadata?.editor,
              cast: urlMetadata?.cast,
              genres: urlMetadata?.genres,
              poster: urlMetadata?.poster,
              trailerVideoId: urlMetadata?.trailerVideoId,
              // Additional TMDB data
              tmdbRating: urlMetadata?.tmdbRating,
              tmdbVoteCount: urlMetadata?.tmdbVoteCount,
              runtime: urlMetadata?.runtime,
              overview: urlMetadata?.overview,
              mediaTitle: urlMetadata?.mediaTitle,
              mediaYear: urlMetadata?.mediaYear,
              // External review site links
              metacriticUrl: urlMetadata?.metacriticUrl,
              rottenTomatoesUrl: urlMetadata?.rottenTomatoesUrl,
              imdbUrl: urlMetadata?.imdbUrl,
              // Real critic scores
              metacriticScore: urlMetadata?.metacriticScore,
              metacriticData: urlMetadata?.metacriticData,
              rottenTomatoesScore: urlMetadata?.rottenTomatoesScore,
              rottenTomatoesData: urlMetadata?.rottenTomatoesData,
              // OMDB rich metadata
              imdbRating: urlMetadata?.imdbRating,
              imdbVotes: urlMetadata?.imdbVotes,
              rated: urlMetadata?.rated,
              plot: urlMetadata?.plot,
              awards: urlMetadata?.awards,
              boxOffice: urlMetadata?.boxOffice,
              production: urlMetadata?.production,
              country: urlMetadata?.country,
              language: urlMetadata?.language,
            } : undefined
          }
          onQueueTalentPreferenceChange={(name, pref) => {
            handleTalentPreferenceChange({
              ...userInteractions.talentPreferences,
              [name]: pref
            })
          }}
          queueTalentPreferences={userInteractions.talentPreferences}
        />
      </div>
      </div>
    </div>
  )
}
