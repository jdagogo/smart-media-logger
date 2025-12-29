'use client'

import { useState, useEffect, useRef } from 'react'
import VoiceInput from '@/components/shared/VoiceInput'
import RatingSlider from '@/components/shared/RatingSlider'
import RightPaneTabs, { LoggedItem } from '@/components/right-pane/RightPaneTabs'
import QuestionCard from '@/components/left-pane/QuestionCard'

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
}

interface LogData {
  mediaType: string
  title: string
  year?: number
  tmdbId?: number
  director?: string
  cinematographer?: string
  composer?: string
  starring?: string[]
  distributor?: string
  runtime?: number
  trailerUrl?: string
  metacriticScore?: number
  rottenTomatoesScore?: number
  metacriticUrl?: string
  rottenTomatoesUrl?: string
  metacriticData?: MetacriticData
  rottenTomatoesData?: RottenTomatoesData
  streamingOptions?: StreamingOption[]
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

interface TalentPreferenceData {
  [name: string]: TalentPreference
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
}: {
  logData: LogData
  updateLogData: (updates: Partial<LogData>) => void
  setStep: (step: FlowStep) => void
  setSearchQuery: (query: string) => void
  setSelectedMedia: (media: MediaResult | null) => void
  setQuestionIndex: (index: number) => void
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
            updateLogData({ mediaType: 'movie', title: '' })
            setQuestionIndex(0)
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

  // Log data state
  const [logData, setLogData] = useState<LogData>({
    mediaType: 'movie',
    title: '',
  })

  // Entry number (would come from database in real app)
  const [entryNumber] = useState(1)

  // Up Next queue - shared between search and RightPaneTabs
  const [upNextQueue, setUpNextQueue] = useState<QueueItem[]>([
    { id: 1, title: 'Nosferatu', year: 2024, mediaType: 'movie', director: 'Robert Eggers', addedAt: '2024-12-20' },
    { id: 2, title: 'Severance', year: 2022, mediaType: 'tv', director: 'Ben Stiller', addedAt: '2024-12-18' },
    { id: 3, title: 'The Three-Body Problem', year: 2008, mediaType: 'book', director: 'Liu Cixin', addedAt: '2024-12-15' },
  ])

  // Logged items - My Stuff (shared with RightPaneTabs)
  const [loggedItems, setLoggedItems] = useState<LoggedItem[]>([
    { id: 101, title: 'One Battle After Another', year: 2024, mediaType: 'movie', director: 'Paul Thomas Anderson', rating: 92, dateConsumed: '2024-12-27', addedAt: '2024-12-27', companionNames: 'Sarah, Keith', socialContext: 'friends', notes: 'Anderson at his most ambitious. The long takes were mesmerizing. Joaquin Phoenix was incredible as always - his transformation in the third act was breathtaking. The score was haunting and stayed with me for days.' },
    { id: 102, title: 'Anora', year: 2024, mediaType: 'movie', director: 'Sean Baker', rating: 88, dateConsumed: '2024-12-20', addedAt: '2024-12-20', companionNames: 'J.D.', socialContext: 'partner', notes: 'Mikey Madison is a revelation. Sean Baker captures the energy of New York like nobody else. Funny and heartbreaking in equal measure. The ending destroyed me.' },
    { id: 103, title: 'The Brutalist', year: 2024, mediaType: 'movie', director: 'Brady Corbet', rating: 95, dateConsumed: '2024-12-15', addedAt: '2024-12-15', socialContext: 'alone', notes: 'An absolute epic. 3.5 hours flew by. The cinematography was stunning - every frame a painting. The score by Daniel Blumberg elevated everything. Adrien Brody should win every award.' },
  ])

  // Add logged item callback
  const addLoggedItem = (item: LoggedItem) => {
    setLoggedItems(prev => [item, ...prev])
  }

  // Update logged item callback
  const updateLoggedItem = (id: number, changes: Partial<LoggedItem>) => {
    setLoggedItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...changes } : item
    ))
  }

  // Add to queue function
  const addToQueue = (title: string, year: number, mediaType: string, director?: string) => {
    const newItem: QueueItem = {
      id: Date.now(),
      title,
      year,
      mediaType,
      director,
      addedAt: new Date().toISOString().split('T')[0],
    }
    setUpNextQueue(prev => [newItem, ...prev])
    console.log('Added to Up Next:', newItem)
  }

  // User interactions tracking for AI-enhanced questions
  const [userInteractions, setUserInteractions] = useState<UserInteractions>({
    talentPreferences: {},
    questionFeedback: [],
    editHistory: [],
    sessionStart: new Date().toISOString(),
    mediaSearches: [],
  })

  // Greeting based on context (simplified for now)
  const greeting = "What did you watch, read, or listen to?"

  // Track if we've saved the current entry (to prevent duplicates)
  const savedEntryIdRef = useRef<number | null>(null)

  // Log complete interaction data when entry is saved
  useEffect(() => {
    if (step === 'complete' && logData.title && logData.tmdbId) {
      // Only save once per entry (use tmdbId to track)
      if (savedEntryIdRef.current === logData.tmdbId) {
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

      // Save to My Stuff (loggedItems)
      const newLoggedItem: LoggedItem = {
        id: Date.now(),
        title: logData.title,
        year: logData.year || new Date().getFullYear(),
        mediaType: logData.mediaType,
        director: logData.director,
        rating: logData.overallRating,
        dateConsumed: logData.consumptionDate || new Date().toISOString().split('T')[0],
        addedAt: new Date().toISOString().split('T')[0],
        notes: logData.notes,
        companionNames: logData.companionNames,
        socialContext: logData.socialContext,
        location: logData.location,
      }

      savedEntryIdRef.current = logData.tmdbId
      addLoggedItem(newLoggedItem)
      console.log('Saved to My Stuff:', newLoggedItem)
    }
  }, [step, logData.title, logData.tmdbId, logData.consumptionDate, logData.overallRating, logData.notes, logData.companionNames, logData.socialContext, logData.location, logData.year, logData.mediaType, logData.director, entryNumber, userInteractions, addLoggedItem])

  // Reset saved entry ref when starting a new log
  useEffect(() => {
    if (step === 'search') {
      savedEntryIdRef.current = null
    }
  }, [step])

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    // Track search query
    setUserInteractions(prev => ({
      ...prev,
      mediaSearches: [...prev.mediaSearches, searchQuery.trim()]
    }))

    setStep('searching')

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=${logData.mediaType}`
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
        metacriticData: item.metacriticData,
        rottenTomatoesData: item.rottenTomatoesData,
      }))

      if (results.length === 1) {
        // Auto-select if only one result
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

  // Handle media selection
  const handleSelectMedia = (media: MediaResult) => {
    setSelectedMedia(media)
    setLogData({
      ...logData,
      title: media.title,
      year: media.year,
      mediaType: media.mediaType,
      tmdbId: media.id,
      director: media.director,
      cinematographer: media.cinematographer,
      composer: media.composer,
      starring: media.starring,
      distributor: media.distributor,
      runtime: media.runtime,
      trailerUrl: media.trailerUrl,
      metacriticScore: media.metacriticScore,
      rottenTomatoesScore: media.rottenTomatoesScore,
      metacriticUrl: media.metacriticUrl,
      rottenTomatoesUrl: media.rottenTomatoesUrl,
      metacriticData: media.metacriticData,
      rottenTomatoesData: media.rottenTomatoesData,
      streamingOptions: media.streamingOptions,
    })
    setStep('analyzing')

    // Simulate AI analysis
    setTimeout(() => {
      setStep('date')
      setQuestionIndex(1)
    }, 1500)
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
    const date = new Date(dateString)
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
      {/* Progress Bar */}
      <div className="bg-paper-100 border-b border-paper-400 px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="label-typewriter">Progress</span>
            <span className="label-typewriter">{getProgressPercent()}%</span>
          </div>
          <div className="h-3 bg-paper-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-sky rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
      {/* LEFT PANE - Questions */}
      <div className="w-1/2 p-10 flex items-start justify-center overflow-y-auto bg-paper-200">
        <div className="w-full max-w-2xl">
          {/* SEARCH STEP */}
          {step === 'search' && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-semibold text-ink-800 mb-6">
                {greeting}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSearch()
                }}
                className="mb-4"
              >
                <VoiceInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Get my movie, book, album... we'll do all the work!"
                  className="text-lg"
                />
              </form>
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
                className={`
                  w-full py-3 rounded-lg font-medium transition-all
                  ${searchQuery.trim()
                    ? 'bg-accent-blue text-white hover:bg-blue-600'
                    : 'bg-paper-300 text-ink-400 cursor-not-allowed'
                  }
                `}
              >
                Search
              </button>

              {/* Media type shortcuts */}
              <div className="mt-6">
                <p className="text-ink-500 text-sm mb-3">Or choose:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { type: 'movie', icon: '🎬', label: 'Movie' },
                    { type: 'tv', icon: '📺', label: 'TV' },
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
                          ? 'bg-accent-blue text-white border-accent-blue'
                          : 'bg-white text-ink-800 border-accent-blue hover:bg-accent-blue hover:text-white'
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
                    Is this what you're looking for?
                  </h2>
                  <button
                    onClick={() => handleSelectMedia(searchResults[0])}
                    className="w-full p-5 bg-paper-100 rounded-lg text-left hover:bg-paper-50 transition-colors border-2 border-accent-blue"
                  >
                    <div className="font-bold text-accent-blue text-lg">
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
                  </button>
                  <p className="text-ink-500 mt-4 text-sm">
                    Not what you meant? <button onClick={() => setStep('search')} className="text-accent-blue hover:underline">Search again</button>
                  </p>
                </>
              ) : (
                <>
                  {/* Smart question based on what we found */}
                  <div className="bg-accent-blue/10 border-2 border-accent-blue rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🤖</span>
                      <div>
                        <p className="text-ink-800 font-medium">
                          I found {searchResults.length} options for "{searchQuery}"
                        </p>
                        <p className="text-ink-600 text-sm mt-1">
                          Which one did you {logData.mediaType === 'movie' ? 'watch' : logData.mediaType === 'book' ? 'read' : 'experience'}?
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
                          className="w-full p-4 bg-paper-100 rounded-lg text-left transition-colors border border-paper-300 hover:border-accent-blue"
                        >
                          <div className="flex justify-between items-start">
                            <button
                              onClick={() => handleSelectMedia(result)}
                              className="flex-1 text-left hover:bg-paper-50 -m-2 p-2 rounded-lg transition-colors"
                            >
                              <div className="font-medium text-ink-800">
                                {result.title} ({result.year})
                              </div>
                              {result.director && (
                                <div className="text-sm text-ink-500 mt-1">
                                  {creatorLabel} {result.director}
                                </div>
                              )}
                            </button>
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
                          {/* Add to Queue button */}
                          <div className="flex gap-2 mt-3 pt-3 border-t border-paper-200">
                            <button
                              onClick={() => handleSelectMedia(result)}
                              className="flex-1 px-4 py-2 bg-accent-blue text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
                            >
                              Log It Now
                            </button>
                            <button
                              onClick={() => {
                                addToQueue(result.title, result.year, result.mediaType, result.director)
                              }}
                              className="px-4 py-2 bg-paper-300 text-ink-700 rounded-lg font-bold text-sm hover:bg-paper-400 transition-colors"
                            >
                              + Add to Queue
                            </button>
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
                  const dateStr = date.toISOString().split('T')[0]
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
              <input
                type="date"
                value={logData.consumptionDate || ''}
                onChange={(e) => updateLogData({ consumptionDate: e.target.value })}
                className="w-full px-6 py-4 bg-white border-2 border-accent-blue rounded-xl text-ink-800 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-accent-blue"
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
            >
              <h3 className="text-xl font-semibold text-ink-800 mb-4">
                Which theater? (optional)
              </h3>
              <form onSubmit={(e) => { e.preventDefault(); goToNextStep() }}>
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
            />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-1 bg-accent-sky/30" />

      {/* RIGHT PANE - Tabbed Dashboard */}
      <div className="w-1/2 bg-paper-300 overflow-hidden border-l-4 border-accent-blue/30">
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
          loggedItems={loggedItems}
          onAddLoggedItem={addLoggedItem}
          onUpdateLoggedItem={updateLoggedItem}
        />
      </div>
      </div>
    </div>
  )
}
