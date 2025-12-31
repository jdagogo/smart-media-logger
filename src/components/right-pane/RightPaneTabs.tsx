'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// Declare YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: {
        events?: {
          onStateChange?: (event: { data: number }) => void
          onReady?: () => void
        }
      }) => {
        destroy: () => void
      }
      PlayerState: {
        ENDED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}
import MediaCard from './MediaCard'
import SoundtrackModal from './SoundtrackModal'
import CharacterGallery from '@/components/CharacterGallery'
import { highlightEntities } from '@/components/shared/VoiceInput'

// YouTube Player component for music with auto-advance
function MusicYouTubePlayer({
  videoId,
  title,
  ytApiReady,
  onVideoEnd
}: {
  videoId: string
  title: string
  ytApiReady: boolean
  onVideoEnd: () => void
}) {
  const playerRef = useRef<{ destroy: () => void } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerId = `music-player-${videoId}`

  useEffect(() => {
    if (!ytApiReady || !containerRef.current) return

    // Clean up previous player
    if (playerRef.current) {
      try {
        playerRef.current.destroy()
      } catch (e) {
        // Ignore destroy errors
      }
      playerRef.current = null
    }

    // Create the iframe element
    const iframe = document.createElement('iframe')
    iframe.id = playerId
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1&origin=${window.location.origin}`
    iframe.className = 'w-full aspect-video'
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    iframe.allowFullscreen = true

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(iframe)

    // Wait for iframe to load, then create YT.Player
    const timeout = setTimeout(() => {
      try {
        if (window.YT && window.YT.Player) {
          playerRef.current = new window.YT.Player(playerId, {
            events: {
              onStateChange: (event: { data: number }) => {
                // 0 = ended
                if (event.data === 0) {
                  onVideoEnd()
                }
              }
            }
          })
        }
      } catch (e) {
        console.error('Failed to create YT player:', e)
      }
    }, 1000) // Give iframe time to load

    return () => {
      clearTimeout(timeout)
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch (e) {
          // Ignore destroy errors
        }
        playerRef.current = null
      }
    }
  }, [videoId, ytApiReady, onVideoEnd, playerId])

  return <div ref={containerRef} className="w-full aspect-video bg-black" />
}

// Talent preference types - same as MediaCard
type TalentPreference = 'loved' | 'not-for-me' | null

// TalentPill component - matches MediaCard's TalentPill exactly
interface TalentPillProps {
  name: string
  onPreferenceChange?: (name: string, preference: TalentPreference) => void
  preference?: TalentPreference
}

function TalentPill({ name, onPreferenceChange, preference }: TalentPillProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleSelect = (pref: TalentPreference) => {
    if (onPreferenceChange) {
      onPreferenceChange(name, pref)
    }
    setShowMenu(false)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all cursor-pointer
          ${preference === 'not-for-me'
            ? 'bg-paper-200 text-ink-500 border border-paper-400'
            : 'bg-accent-blue/10 text-accent-blue border border-accent-blue hover:bg-accent-blue hover:text-white'
          }`}
      >
        {preference === 'loved' && <span className="text-red-500">♥</span>}
        {preference === 'not-for-me' && <span className="text-ink-400">—</span>}
        {name}
      </button>

      {showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(false)
            }}
          />

          {/* Menu */}
          <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border-2 border-accent-blue overflow-hidden min-w-[140px]">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(preference === 'loved' ? null : 'loved')
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-paper-100 flex items-center gap-2 ${preference === 'loved' ? 'bg-pink-50 text-pink-700' : ''}`}
            >
              <span>♥</span> Love
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(preference === 'not-for-me' ? null : 'not-for-me')
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-paper-100 flex items-center gap-2 ${preference === 'not-for-me' ? 'bg-paper-200' : ''}`}
            >
              <span>○</span> Don&apos;t love
            </button>
            <button
              disabled
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 border-t border-paper-200 text-ink-400 cursor-not-allowed"
            >
              <span>+</span> Give me more
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Types
type RightPaneTab = 'logging' | 'upnext' | 'drafts' | 'library' | 'recs' | 'profile'
type MediaFilter = 'all' | 'movie' | 'tv' | 'books' | 'music' | 'podcasts' | 'video'
type SortMode = 'date' | 'score'

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
  // Crew data
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

// Data structure for "Already seen it" modal - matches MediaCard props
interface AlreadySeenData {
  title: string
  year: number
  director: string
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
}

// Export LoggedItem type for use in parent
export interface LoggedItem extends QueueItem {
  rating?: number
  dateConsumed?: string
  notes?: string
  companionNames?: string
  socialContext?: string
  location?: string
  locationDetail?: string
  firstTime?: boolean
  isDraft?: boolean  // True if saved via Save & Exit before completing flow
}

interface RightPaneTabsProps {
  // Current logging session
  currentEntry?: {
    entryNumber: number
    mediaType: string
    title: string
    year?: number
    dateWatched?: string
    director?: string
    cinematographer?: string
    composer?: string
    starring?: string[]
    cast?: Array<{ name: string; character: string; profilePath?: string }>
    distributor?: string
    runtime?: number
    rating?: number
    location?: string
    locationDetail?: string
    firstTime?: boolean
    socialContext?: string
    companionNames?: string
    notes?: string
    metacriticScore?: number
    rottenTomatoesScore?: number
    trailerUrl?: string
    metacriticUrl?: string
    rottenTomatoesUrl?: string
    metacriticData?: any
    rottenTomatoesData?: any
    streamingOptions?: any[]
    videoId?: string      // YouTube/video embed ID
    sourceUrl?: string    // Original URL source
    // Rich metadata
    poster?: string
    imdbRating?: string
    imdbVotes?: string
    imdbUrl?: string
    rated?: string
    awards?: string
    boxOffice?: string
    plot?: string
    overview?: string
    country?: string
    language?: string
    genres?: string[]
    tmdbRating?: number
  }
  isLogging: boolean
  onEdit?: (changes: any) => void
  onTalentPreferenceChange?: (preferences: any) => void
  talentPreferences?: Record<string, 'loved' | 'not-for-me' | null>
  // Queue management - shared with parent
  upNextQueue: QueueItem[]
  onAddToQueue: (metadata: {
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
    // Rich recommendation data
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
  }) => void
  onRemoveFromQueue?: (id: number) => void
  onUpdateQueueItem?: (id: number, changes: Partial<QueueItem>) => void
  onLogFromQueue?: (item: QueueItem) => void
  // Logged items - shared with parent
  loggedItems: LoggedItem[]
  onAddLoggedItem?: (item: LoggedItem) => void
  onUpdateLoggedItem?: (id: number, changes: Partial<LoggedItem>) => void
  onRemoveLoggedItem?: (id: number) => void
  onResumeDraft?: (item: LoggedItem) => void
  // Tab control from parent
  activeTabOverride?: 'logging' | 'upnext' | 'drafts' | 'library' | 'recs' | 'profile'
  tabSwitchTrigger?: number
  onTabChange?: (tab: 'logging' | 'upnext' | 'drafts' | 'library' | 'recs' | 'profile') => void
  // Queue mode preview
  searchMode?: 'log' | 'queue'
  queuePreview?: {
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
    isLoading?: boolean
    // Enhanced trailer metadata
    isTrailer?: boolean
    detectedMediaType?: 'movie' | 'tv'
    tmdbId?: number
    director?: string
    directors?: string[]
    cinematographer?: string
    composer?: string
    writers?: string[]
    producers?: Array<{ name: string; job: string }>
    editor?: string
    cast?: Array<{ name: string; character: string; profilePath?: string }>
    genres?: string[]
    poster?: string
    trailerVideoId?: string
    // TMDB rating
    tmdbRating?: number
    tmdbVoteCount?: number
    overview?: string
    mediaTitle?: string
    mediaYear?: number
    runtime?: number
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
  // Talent preference handling for queue preview
  onQueueTalentPreferenceChange?: (name: string, preference: 'loved' | 'not-for-me' | null) => void
  queueTalentPreferences?: Record<string, 'loved' | 'not-for-me' | null>
}

export default function RightPaneTabs({
  currentEntry,
  isLogging,
  onEdit,
  onTalentPreferenceChange,
  talentPreferences = {},
  upNextQueue,
  onAddToQueue,
  onRemoveFromQueue,
  onLogFromQueue,
  loggedItems,
  onAddLoggedItem,
  onUpdateLoggedItem,
  onRemoveLoggedItem,
  onResumeDraft,
  activeTabOverride,
  tabSwitchTrigger,
  onTabChange,
  searchMode = 'log',
  queuePreview,
  onQueueTalentPreferenceChange,
  queueTalentPreferences = {},
}: RightPaneTabsProps) {
  // Use parent-controlled tab state directly - no local state
  // This ensures the tab always reflects what the parent wants
  const activeTab = activeTabOverride || 'logging'

  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('date')

  // Fix hydration mismatch - only show queue count after client mount
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Clean up duplicate music tracks on mount
  useEffect(() => {
    // Deduplicate localStorage saved music
    try {
      const savedMusic = JSON.parse(localStorage.getItem('smartMediaLogger_savedMusic') || '[]')
      const seen = new Set<string>()
      const dedupedMusic = savedMusic.filter((track: { videoId: string }) => {
        if (seen.has(track.videoId)) return false
        seen.add(track.videoId)
        return true
      })
      if (dedupedMusic.length !== savedMusic.length) {
        console.log(`Cleaned up ${savedMusic.length - dedupedMusic.length} duplicate music tracks from localStorage`)
        localStorage.setItem('smartMediaLogger_savedMusic', JSON.stringify(dedupedMusic))
      }
    } catch (e) {
      console.error('Failed to dedupe saved music:', e)
    }

    // Deduplicate music in loggedItems
    const musicItems = loggedItems.filter(item => item.mediaType === 'music')
    const seenVideoIds = new Set<string>()
    const duplicateIds: number[] = []

    for (const item of musicItems) {
      if (item.videoId) {
        if (seenVideoIds.has(item.videoId)) {
          duplicateIds.push(item.id)
        } else {
          seenVideoIds.add(item.videoId)
        }
      }
    }

    if (duplicateIds.length > 0) {
      console.log(`Found ${duplicateIds.length} duplicate music tracks to remove from loggedItems`)
      duplicateIds.forEach(id => onRemoveLoggedItem?.(id))
    }
  }, []) // Run once on mount

  // Handle tab change - just notify parent, which controls the state
  const handleTabChange = (tab: RightPaneTab) => {
    onTabChange?.(tab)
  }
  const [recsQuery, setRecsQuery] = useState('')
  const [prefsInput, setPrefsInput] = useState('')
  const [selectedItem, setSelectedItem] = useState<LoggedItem | null>(null)

  // Dismissed recommendations - load from localStorage
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smartMediaLogger_dismissedRecs')
        if (saved) {
          return new Set(JSON.parse(saved))
        }
      } catch (e) {
        console.error('Failed to parse dismissed recs from localStorage:', e)
      }
    }
    return new Set()
  })

  // User interactions (for preference tracking) - load from localStorage
  const [userInteractions, setUserInteractions] = useState<Array<{
    type: 'dismissed' | 'added_to_queue' | 'logged' | 'already_seen'
    title: string
    reason?: string
    timestamp: string
    metadata?: Record<string, unknown>
  }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smartMediaLogger_interactions')
        if (saved) {
          return JSON.parse(saved)
        }
      } catch (e) {
        console.error('Failed to parse interactions from localStorage:', e)
      }
    }
    return []
  })

  // Persist dismissed recs to localStorage when they change
  useEffect(() => {
    if (hasMounted && dismissedRecs.size > 0) {
      localStorage.setItem('smartMediaLogger_dismissedRecs', JSON.stringify(Array.from(dismissedRecs)))
    }
  }, [dismissedRecs, hasMounted])

  // Persist interactions to localStorage when they change
  useEffect(() => {
    if (hasMounted && userInteractions.length > 0) {
      localStorage.setItem('smartMediaLogger_interactions', JSON.stringify(userInteractions))
    }
  }, [userInteractions, hasMounted])

  // Track which items were just added to queue (for visual feedback)
  const [justAddedToQueue, setJustAddedToQueue] = useState<Set<string>>(new Set())

  // Track which queue item's video is currently playing
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null)

  // Track which items are expanded (for accordion behavior)
  const [expandedQueueId, setExpandedQueueId] = useState<number | null>(null)
  const [expandedLibraryId, setExpandedLibraryId] = useState<number | null>(null)
  const [expandedMusicInfoId, setExpandedMusicInfoId] = useState<number | null>(null)
  const [expandedCriticPanel, setExpandedCriticPanel] = useState<'metacritic' | 'rt' | null>(null)
  const [expandedRecTitle, setExpandedRecTitle] = useState<string | null>(null)

  // YouTube player for auto-advance
  const [ytApiReady, setYtApiReady] = useState(false)
  const ytPlayerRef = useRef<{ destroy: () => void } | null>(null)
  const pendingNextTrackRef = useRef<number | null>(null)

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.YT) {
      setYtApiReady(true)
      return
    }

    // Load the API script
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    window.onYouTubeIframeAPIReady = () => {
      setYtApiReady(true)
    }
  }, [])

  // Handle auto-advance when video ends
  const handleVideoEnd = useCallback(() => {
    if (pendingNextTrackRef.current !== null) {
      setExpandedLibraryId(pendingNextTrackRef.current)
      pendingNextTrackRef.current = null
    }
  }, [])

  // Track fetched trailer URLs for recommendations
  const [fetchedTrailers, setFetchedTrailers] = useState<Record<string, string>>({})
  const [loadingTrailers, setLoadingTrailers] = useState<Set<string>>(new Set())

  // Fetch trailer when recommendation is expanded
  const fetchTrailerForRec = async (title: string, year: number) => {
    // Skip if already fetched or loading
    if (fetchedTrailers[title] || loadingTrailers.has(title)) return

    setLoadingTrailers(prev => new Set(prev).add(title))

    try {
      const response = await fetch(`/api/youtube-trailer?title=${encodeURIComponent(title)}&year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setFetchedTrailers(prev => ({ ...prev, [title]: data.embedUrl }))
      }
    } catch (error) {
      console.error('Failed to fetch trailer for', title, error)
    } finally {
      setLoadingTrailers(prev => {
        const newSet = new Set(prev)
        newSet.delete(title)
        return newSet
      })
    }
  }

  // Track successful saves for confirmation messages
  const [justSavedToMyStuff, setJustSavedToMyStuff] = useState<string | null>(null)

  // "Already seen it" - stores full media data for MediaCard display
  const [alreadySeenItem, setAlreadySeenItem] = useState<AlreadySeenData | null>(null)
  const [alreadySeenRating, setAlreadySeenRating] = useState(70)
  const [alreadySeenTalentPrefs, setAlreadySeenTalentPrefs] = useState<Record<string, 'loved' | 'not-for-me' | null>>({})

  // Soundtrack modal state
  const [soundtrackMovie, setSoundtrackMovie] = useState<{ title: string; year: number; composer?: string } | null>(null)
  const [savedMusicTracks, setSavedMusicTracks] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smartMediaLogger_savedMusic')
        if (saved) {
          const tracks = JSON.parse(saved) as Array<{ videoId: string }>
          const trackMap: Record<string, boolean> = {}
          tracks.forEach(t => { trackMap[t.videoId] = true })
          return trackMap
        }
      } catch (e) {
        console.error('Failed to parse saved music from localStorage:', e)
      }
    }
    return {}
  })

  // Handle saving a track from soundtrack to My Stuff
  const handleSaveMusicTrack = (track: {
    title: string
    artist: string
    videoId: string
    thumbnail: string
    fromMovie: string
  }) => {
    // Check if already saved - prevent duplicates
    if (savedMusicTracks[track.videoId]) {
      console.log('Track already saved, skipping:', track.videoId)
      return
    }

    // Also check loggedItems to prevent duplicates
    const alreadyLogged = loggedItems.some(
      item => item.mediaType === 'music' && item.videoId === track.videoId
    )
    if (alreadyLogged) {
      console.log('Track already in logged items, skipping:', track.videoId)
      // Still update savedMusicTracks state for UI consistency
      setSavedMusicTracks(prev => ({ ...prev, [track.videoId]: true }))
      return
    }

    // Add to logged items as music
    const musicItem: LoggedItem = {
      id: Date.now(),
      title: track.title,
      year: new Date().getFullYear(),
      mediaType: 'music',
      director: track.artist, // Using director field for artist
      addedAt: new Date().toISOString().split('T')[0],
      videoId: track.videoId,
      thumbnail: track.thumbnail,
      description: `From the ${track.fromMovie} soundtrack`,
      rating: undefined, // User can rate later
      dateConsumed: new Date().toISOString().split('T')[0],
    }

    onAddLoggedItem?.(musicItem)

    // Update saved tracks object
    setSavedMusicTracks(prev => ({ ...prev, [track.videoId]: true }))

    // Persist to localStorage (with duplicate check)
    const savedMusic = JSON.parse(localStorage.getItem('smartMediaLogger_savedMusic') || '[]')
    const alreadyInStorage = savedMusic.some((t: { videoId: string }) => t.videoId === track.videoId)
    if (!alreadyInStorage) {
      savedMusic.push({
        videoId: track.videoId,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        fromMovie: track.fromMovie,
        savedAt: new Date().toISOString(),
      })
      localStorage.setItem('smartMediaLogger_savedMusic', JSON.stringify(savedMusic))
    }

    console.log('Saved music track:', track)
  }

  // Handle unsaving a track from soundtrack
  const handleUnsaveMusicTrack = (videoId: string) => {
    // Remove from saved tracks object
    setSavedMusicTracks(prev => {
      const newObj = { ...prev }
      delete newObj[videoId]
      return newObj
    })

    // Remove from localStorage
    try {
      const savedMusic = JSON.parse(localStorage.getItem('smartMediaLogger_savedMusic') || '[]')
      const filtered = savedMusic.filter((t: { videoId: string }) => t.videoId !== videoId)
      localStorage.setItem('smartMediaLogger_savedMusic', JSON.stringify(filtered))
      console.log('Unsaved music track:', videoId)
    } catch (e) {
      console.error('Failed to unsave music track:', e)
    }
  }

  // Add to queue with visual feedback
  const handleAddToQueue = (metadata: {
    title: string
    year: number
    mediaType: string
    director?: string
    thumbnail?: string
    skipTabSwitch?: boolean
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
    onAddToQueue(metadata)
    setJustAddedToQueue(prev => {
      const newSet = new Set(prev)
      newSet.add(metadata.title)
      return newSet
    })
    // Clear "Added!" after 3 seconds
    setTimeout(() => {
      setJustAddedToQueue(prev => {
        const newSet = new Set(prev)
        newSet.delete(metadata.title)
        return newSet
      })
    }, 3000)
  }

  // Handle "Already seen it" - opens MediaCard modal with full data
  const handleAlreadySeen = (data: AlreadySeenData) => {
    setAlreadySeenItem(data)
    setAlreadySeenRating(70)
    setAlreadySeenTalentPrefs({})
  }

  // Save "Already seen it" entry - ADDS TO MY STUFF
  const saveAlreadySeenEntry = () => {
    if (!alreadySeenItem) return

    // Add to My Stuff - this is a logged entry!
    const newLoggedItem: LoggedItem = {
      id: Date.now(),
      title: alreadySeenItem.title,
      year: alreadySeenItem.year,
      mediaType: 'movie',
      director: alreadySeenItem.director,
      rating: alreadySeenRating,
      dateConsumed: new Date().toISOString().split('T')[0],
      addedAt: new Date().toISOString().split('T')[0],
    }
    onAddLoggedItem?.(newLoggedItem)

    console.log('Added to My Stuff from recommendation:', {
      ...newLoggedItem,
      talentPreferences: alreadySeenTalentPrefs,
      source: 'recommendation_already_seen',
    })

    // Dismiss the recommendation
    setDismissedRecs(prev => {
      const newSet = new Set(prev)
      newSet.add(alreadySeenItem.title)
      return newSet
    })

    // Store the interaction for preference tracking
    setUserInteractions(prev => [...prev, {
      type: 'already_seen',
      title: alreadySeenItem.title,
      timestamp: new Date().toISOString(),
      metadata: {
        rating: alreadySeenRating,
        talentPreferences: alreadySeenTalentPrefs,
      }
    }])

    // Show save confirmation
    setJustSavedToMyStuff(alreadySeenItem.title)
    setTimeout(() => setJustSavedToMyStuff(null), 4000)

    setAlreadySeenItem(null)
  }

  // Dismiss recommendation with reason - stores interaction for preference learning
  const dismissRec = (title: string, reason: 'not_interested' | 'dont_like') => {
    // Add to dismissed set
    setDismissedRecs(prev => {
      const newSet = new Set(prev)
      newSet.add(title)
      return newSet
    })

    // Store the interaction for preference tracking
    setUserInteractions(prev => [...prev, {
      type: 'dismissed',
      title,
      reason,
      timestamp: new Date().toISOString(),
    }])

    console.log('Recommendation dismissed and stored:', { title, reason })
  }

  // loggedItems is now passed as a prop from parent

  // COMPUTED STATS - Real data from logged items and preferences
  const computedStats = (() => {
    // Total logged
    const totalLogged = loggedItems.length

    // Average rating
    const itemsWithRatings = loggedItems.filter(item => item.rating !== undefined)
    const averageRating = itemsWithRatings.length > 0
      ? Math.round(itemsWithRatings.reduce((sum, item) => sum + (item.rating || 0), 0) / itemsWithRatings.length)
      : 0

    // By media type
    const byMediaType: Record<string, number> = {}
    loggedItems.forEach(item => {
      byMediaType[item.mediaType] = (byMediaType[item.mediaType] || 0) + 1
    })

    // Top companions - extract from companionNames
    const companionCounts: Record<string, number> = {}
    loggedItems.forEach(item => {
      if (item.companionNames) {
        item.companionNames.split(',').forEach(name => {
          const trimmed = name.trim()
          if (trimmed) {
            companionCounts[trimmed] = (companionCounts[trimmed] || 0) + 1
          }
        })
      }
    })
    const topCompanions = Object.entries(companionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Top rated items
    const topRated = [...loggedItems]
      .filter(item => item.rating !== undefined)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)

    // Directors you've watched most
    const directorCounts: Record<string, { count: number; avgRating: number; ratings: number[] }> = {}
    loggedItems.forEach(item => {
      if (item.director) {
        if (!directorCounts[item.director]) {
          directorCounts[item.director] = { count: 0, avgRating: 0, ratings: [] }
        }
        directorCounts[item.director].count++
        if (item.rating) {
          directorCounts[item.director].ratings.push(item.rating)
        }
      }
    })
    // Calculate average ratings for directors
    Object.values(directorCounts).forEach(dir => {
      if (dir.ratings.length > 0) {
        dir.avgRating = Math.round(dir.ratings.reduce((a, b) => a + b, 0) / dir.ratings.length)
      }
    })
    const topDirectors = Object.entries(directorCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, count: data.count, avgRating: data.avgRating }))

    // Viewing habits
    const soloCount = loggedItems.filter(item => item.socialContext === 'alone').length
    const socialCount = loggedItems.filter(item => item.socialContext && item.socialContext !== 'alone').length
    const theaterCount = loggedItems.filter(item => item.location === 'theater').length
    const homeCount = loggedItems.filter(item => item.location === 'home' || !item.location).length

    return {
      totalLogged,
      averageRating,
      byMediaType,
      topCompanions,
      topRated,
      topDirectors,
      soloCount,
      socialCount,
      theaterCount,
      homeCount,
    }
  })()

  const filterItems = <T extends QueueItem>(items: T[], filter: MediaFilter): T[] => {
    let filtered = items
    if (filter === 'books') {
      filtered = items.filter(i => i.mediaType === 'book' || i.mediaType === 'audiobook')
    } else if (filter === 'movie') {
      filtered = items.filter(i => i.mediaType === 'movie')
    } else if (filter === 'video') {
      filtered = items.filter(i => i.mediaType === 'video')
    } else if (filter !== 'all') {
      filtered = items.filter(i => i.mediaType === filter)
    }
    return filtered
  }

  const sortItems = <T extends QueueItem>(items: T[], sort: SortMode): T[] => {
    return [...items].sort((a, b) => {
      if (sort === 'score') {
        const aRating = (a as LoggedItem).rating ?? 0
        const bRating = (b as LoggedItem).rating ?? 0
        return bRating - aRating
      }
      // Default: sort by date (most recent first)
      const aDate = (a as LoggedItem).dateConsumed || a.addedAt || ''
      const bDate = (b as LoggedItem).dateConsumed || b.addedAt || ''
      return bDate.localeCompare(aDate)
    })
  }

  // Count drafts for badge
  const draftsCount = loggedItems.filter(item => item.isDraft).length

  const tabs: { id: RightPaneTab; label: string; showCount?: boolean; count?: number }[] = [
    { id: 'logging', label: 'Now' },
    { id: 'upnext', label: 'My Queue', showCount: true, count: upNextQueue.length },
    { id: 'drafts', label: 'Drafts', showCount: true, count: draftsCount },
    { id: 'library', label: 'My Stuff' },
    { id: 'recs', label: 'Recommendations' },
    { id: 'profile', label: 'My Preferences & Data' },
  ]

  const mediaFilters: { id: MediaFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV' },
    { id: 'video', label: 'Video' },
    { id: 'books', label: 'Books' },
    { id: 'music', label: 'Music' },
    { id: 'podcasts', label: 'Podcasts' },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-2xl">
      {/* Main Tabs - Clean pill-style navigation */}
      <div className="bg-gradient-to-r from-accent-blue to-accent-navy px-4 py-4 mx-4 mt-4 rounded-xl">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                px-4 py-2 font-semibold text-sm rounded-full transition-all flex items-center gap-2
                ${activeTab === tab.id
                  ? 'bg-white text-accent-blue shadow-lg'
                  : 'bg-white/20 text-white hover:bg-orange-400 hover:text-white'
                }
              `}
            >
              {tab.label}
              {tab.showCount && hasMounted && tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? 'bg-accent-blue text-white'
                    : tab.id === 'drafts'
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-accent-blue'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Save Confirmation Toast */}
      {justSavedToMyStuff && (
        <div className="mx-6 mt-4 bg-green-600 text-white px-4 py-3 rounded-xl flex items-center gap-3 animate-pulse">
          <span className="text-xl">✓</span>
          <div>
            <div className="font-bold">Saved to My Stuff!</div>
            <div className="text-sm text-green-100">"{justSavedToMyStuff}" - all your data has been captured</div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-white rounded-b-2xl">
        {/* NOW LOGGING TAB */}
        {activeTab === 'logging' && (
          <div>
            {/* Show Queue Preview Card in BOTH modes when there's preview data and not yet logging */}
            {queuePreview && (queuePreview.title || queuePreview.isLoading || queuePreview.sourceUrl) && (searchMode === 'queue' || !(currentEntry && currentEntry.title)) ? (
                <div className={`bg-gradient-to-br ${searchMode === 'queue' ? 'from-orange-50 to-amber-50 border-orange-300' : 'from-blue-50 to-indigo-50 border-accent-blue'} border-2 rounded-2xl overflow-hidden shadow-lg`}>
                  {/* Header */}
                  <div className={`bg-gradient-to-r ${searchMode === 'queue' ? 'from-orange-400 to-amber-500' : 'from-accent-blue to-indigo-500'} px-5 py-3`}>
                    <div className="flex items-center gap-2 text-white">
                      <span className="text-xl">{searchMode === 'queue' ? '📋' : '🎬'}</span>
                      <span className="font-bold uppercase tracking-wide text-sm">{searchMode === 'queue' ? 'Adding to Queue' : 'Media Preview'}</span>
                    </div>
                  </div>

                  <div className="p-5">
                    {queuePreview.isLoading ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3 animate-pulse">🔍</div>
                        <p className="text-orange-700 font-medium">Fetching metadata...</p>
                      </div>
                    ) : (
                      <>
                        {/* Embedded Video Player or Thumbnail */}
                        {queuePreview.videoId ? (
                          <div className="mb-4 rounded-lg overflow-hidden shadow-lg bg-black">
                            <iframe
                              src={`https://www.youtube.com/embed/${queuePreview.videoId}`}
                              title={queuePreview.title || 'Video'}
                              className="w-full aspect-video"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : queuePreview.thumbnail ? (
                          <div className="mb-4 rounded-lg overflow-hidden shadow-md bg-black">
                            <img
                              src={queuePreview.thumbnail}
                              alt={queuePreview.title || 'Preview'}
                              className="w-full aspect-video object-contain"
                            />
                          </div>
                        ) : null}

                        {/* Title */}
                        <h2 className="text-xl font-bold text-ink-800 mb-2">
                          {queuePreview.title || 'Untitled'}
                        </h2>

                        {/* Author/Channel - clickable link */}
                        {queuePreview.author && (
                          <p className="text-ink-600 mb-2">
                            <span className="text-ink-400">by </span>
                            {queuePreview.authorUrl ? (
                              <a
                                href={queuePreview.authorUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-600 hover:text-orange-700 hover:underline font-medium"
                              >
                                {queuePreview.author}
                              </a>
                            ) : (
                              <span className="font-medium">{queuePreview.author}</span>
                            )}
                          </p>
                        )}

                        {/* Video Stats Row */}
                        {(queuePreview.duration || queuePreview.viewCount || queuePreview.publishDate) && (
                          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-500 mb-3">
                            {queuePreview.duration && (
                              <span className="flex items-center gap-1">
                                <span>⏱</span> {queuePreview.duration}
                              </span>
                            )}
                            {queuePreview.viewCount && (
                              <span className="flex items-center gap-1">
                                <span>👁</span> {parseInt(queuePreview.viewCount).toLocaleString()} views
                              </span>
                            )}
                            {queuePreview.publishDate && (
                              <span className="flex items-center gap-1">
                                <span>📅</span> {new Date(queuePreview.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Media Type Badge */}
                        {queuePreview.mediaType && (
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase mb-3 ${
                            queuePreview.mediaType === 'video' ? 'bg-red-100 text-red-700' :
                            queuePreview.mediaType === 'music' ? 'bg-pink-100 text-pink-700' :
                            queuePreview.mediaType === 'book' ? 'bg-amber-100 text-amber-700' :
                            'bg-paper-300 text-ink-600'
                          }`}>
                            {queuePreview.mediaType}
                          </span>
                        )}

                        {/* Genres */}
                        {queuePreview.genres && queuePreview.genres.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {queuePreview.genres.map((genre: string) => (
                              <span
                                key={genre}
                                className="px-2 py-1 bg-paper-200 text-ink-600 rounded-full text-xs"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* TMDB Rating */}
                        {queuePreview.tmdbRating && (
                          <div className="flex items-center gap-3 mb-3 p-3 bg-white rounded-lg border border-orange-200">
                            <div className="flex items-center gap-2">
                              <span className="text-orange-600 font-bold text-sm">TMDB</span>
                              <span className={`font-bold px-2 py-0.5 rounded text-sm ${
                                queuePreview.tmdbRating >= 70 ? 'bg-green-100 text-green-700' :
                                queuePreview.tmdbRating >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {queuePreview.tmdbRating}%
                              </span>
                            </div>
                            {queuePreview.tmdbVoteCount && (
                              <span className="text-xs text-ink-400">
                                ({queuePreview.tmdbVoteCount.toLocaleString()} votes)
                              </span>
                            )}
                            {queuePreview.runtime && (
                              <span className="text-sm text-ink-500 ml-auto">
                                {Math.floor(queuePreview.runtime / 60)}h {queuePreview.runtime % 60}m
                              </span>
                            )}
                          </div>
                        )}

                        {/* Critics Scores - Expandable panels matching MediaCard */}
                        {(queuePreview.metacriticScore || queuePreview.rottenTomatoesScore) && (
                          <div className="space-y-3 mb-6">
                            {/* Metacritic - matching MediaCard exactly */}
                            {queuePreview.metacriticScore && (
                              <div className="border-2 border-accent-blue rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between p-4 bg-white">
                                  <button
                                    onClick={() => setExpandedCriticPanel(expandedCriticPanel === 'metacritic' ? null : 'metacritic')}
                                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                  >
                                    <span className="text-accent-blue font-bold">Metacritic</span>
                                    <span className="bg-accent-blue text-white font-bold px-3 py-1 rounded text-lg">
                                      {queuePreview.metacriticScore}
                                    </span>
                                    <span className="text-accent-blue text-xl">
                                      {expandedCriticPanel === 'metacritic' ? '−' : '+'}
                                    </span>
                                  </button>
                                  {queuePreview.metacriticUrl && (
                                    <a
                                      href={queuePreview.metacriticUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                                    >
                                      Open in New Tab <span>↗</span>
                                    </a>
                                  )}
                                </div>
                                {expandedCriticPanel === 'metacritic' && (
                                  <div className="p-4 bg-paper-100 border-t-2 border-accent-blue">
                                    <p className="text-ink-600 mb-4">
                                      Based on {queuePreview.metacriticData?.criticReviews || 'multiple'} critic reviews.
                                    </p>
                                    {queuePreview.metacriticUrl && (
                                      <a
                                        href={queuePreview.metacriticUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                      >
                                        Open in New Tab <span className="text-sm">↗</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Rotten Tomatoes - matching MediaCard exactly */}
                            {queuePreview.rottenTomatoesScore && (
                              <div className="border-2 border-accent-blue rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between p-4 bg-white">
                                  <button
                                    onClick={() => setExpandedCriticPanel(expandedCriticPanel === 'rt' ? null : 'rt')}
                                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                  >
                                    <span className="text-accent-blue font-bold">Rotten Tomatoes</span>
                                    <span className="bg-accent-blue text-white font-bold px-3 py-1 rounded text-lg">
                                      {queuePreview.rottenTomatoesScore}% Critics
                                    </span>
                                    {queuePreview.rottenTomatoesData?.audienceScore && (
                                      <span className="bg-orange-500 text-white font-bold px-3 py-1 rounded text-lg">
                                        {queuePreview.rottenTomatoesData.audienceScore}% Audience
                                      </span>
                                    )}
                                    <span className="text-accent-blue text-xl">
                                      {expandedCriticPanel === 'rt' ? '−' : '+'}
                                    </span>
                                  </button>
                                  {queuePreview.rottenTomatoesUrl && (
                                    <a
                                      href={queuePreview.rottenTomatoesUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                                    >
                                      Open in New Tab <span>↗</span>
                                    </a>
                                  )}
                                </div>
                                {expandedCriticPanel === 'rt' && (
                                  <div className="p-4 bg-paper-100 border-t-2 border-accent-blue">
                                    {queuePreview.rottenTomatoesData?.consensus && (
                                      <p className="text-ink-800 italic mb-4">"{queuePreview.rottenTomatoesData.consensus}"</p>
                                    )}
                                    <p className="text-ink-600 mb-4">
                                      Based on {queuePreview.rottenTomatoesData?.criticReviews || 'multiple'} critic reviews.
                                    </p>
                                    {queuePreview.rottenTomatoesUrl && (
                                      <a
                                        href={queuePreview.rottenTomatoesUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                      >
                                        Open in New Tab <span className="text-sm">↗</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* IMDB - matching MediaCard style */}
                        {queuePreview.imdbUrl && (
                          <div className="border-2 border-accent-blue rounded-xl overflow-hidden mb-6">
                            <div className="flex items-center justify-between p-4 bg-white">
                              <div className="flex items-center gap-3">
                                <span className="text-accent-blue font-bold">IMDb</span>
                                {queuePreview.tmdbRating && (
                                  <span className="bg-yellow-500 text-black font-bold px-3 py-1 rounded text-lg">
                                    {(queuePreview.tmdbRating / 10).toFixed(1)}/10
                                  </span>
                                )}
                                {queuePreview.tmdbVoteCount && (
                                  <span className="text-ink-500 text-sm">
                                    ({queuePreview.tmdbVoteCount.toLocaleString()} votes)
                                  </span>
                                )}
                              </div>
                              <a
                                href={queuePreview.imdbUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                              >
                                Open in New Tab <span>↗</span>
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Director */}
                        {queuePreview.director && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Director</div>
                            <div className="flex items-center gap-2">
                              <TalentPill
                                name={queuePreview.director}
                                preference={queueTalentPreferences[queuePreview.director]}
                                onPreferenceChange={onQueueTalentPreferenceChange}
                              />
                            </div>
                          </div>
                        )}

                        {/* Cast */}
                        {queuePreview.cast && queuePreview.cast.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Cast</div>
                            <div className="flex flex-wrap gap-2">
                              {queuePreview.cast.slice(0, 8).map((actor: { name: string; character: string }) => (
                                <TalentPill
                                  key={actor.name}
                                  name={actor.name}
                                  preference={queueTalentPreferences[actor.name]}
                                  onPreferenceChange={onQueueTalentPreferenceChange}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cinematographer */}
                        {queuePreview.cinematographer && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Cinematographer</div>
                            <div className="flex items-center gap-2">
                              <TalentPill
                                name={queuePreview.cinematographer}
                                preference={queueTalentPreferences[queuePreview.cinematographer]}
                                onPreferenceChange={onQueueTalentPreferenceChange}
                              />
                            </div>
                          </div>
                        )}

                        {/* Composer / Music */}
                        {queuePreview.composer && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Music</div>
                            <div className="flex items-center gap-2">
                              <TalentPill
                                name={queuePreview.composer}
                                preference={queueTalentPreferences[queuePreview.composer]}
                                onPreferenceChange={onQueueTalentPreferenceChange}
                              />
                            </div>
                          </div>
                        )}

                        {/* Writers */}
                        {queuePreview.writers && queuePreview.writers.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Writers</div>
                            <div className="flex flex-wrap gap-2">
                              {queuePreview.writers.slice(0, 4).map((writer: string) => (
                                <TalentPill
                                  key={writer}
                                  name={writer}
                                  preference={queueTalentPreferences[writer]}
                                  onPreferenceChange={onQueueTalentPreferenceChange}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Editor */}
                        {queuePreview.editor && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Editor</div>
                            <div className="flex items-center gap-2">
                              <TalentPill
                                name={queuePreview.editor}
                                preference={queueTalentPreferences[queuePreview.editor]}
                                onPreferenceChange={onQueueTalentPreferenceChange}
                              />
                            </div>
                          </div>
                        )}

                        {/* Awards & Box Office from OMDB */}
                        {(queuePreview.awards || queuePreview.boxOffice) && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            {queuePreview.awards && (
                              <div className="mb-2">
                                <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Awards</div>
                                <p className="text-sm text-ink-700">{queuePreview.awards}</p>
                              </div>
                            )}
                            {queuePreview.boxOffice && (
                              <div>
                                <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Box Office</div>
                                <p className="text-sm text-ink-700 font-medium">{queuePreview.boxOffice}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Additional Info from OMDB */}
                        {(queuePreview.rated || queuePreview.language || queuePreview.country) && (
                          <div className="mt-3 pt-3 border-t border-orange-200 flex flex-wrap gap-3 text-sm">
                            {queuePreview.rated && (
                              <span className="bg-paper-200 text-ink-700 px-2 py-1 rounded font-medium">
                                {queuePreview.rated}
                              </span>
                            )}
                            {queuePreview.language && (
                              <span className="text-ink-500">{queuePreview.language}</span>
                            )}
                            {queuePreview.country && (
                              <span className="text-ink-500">{queuePreview.country}</span>
                            )}
                          </div>
                        )}

                        {/* Description */}
                        {queuePreview.description && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <p className="text-sm text-ink-600 leading-relaxed line-clamp-6">
                              {queuePreview.description}
                            </p>
                          </div>
                        )}

                      </>
                    )}
                  </div>
                </div>
            ) : currentEntry && currentEntry.title ? (
              /* Log Mode - Show Media Card when logging in progress */
              <MediaCard
                  entryNumber={currentEntry.entryNumber}
                  mediaType={currentEntry.mediaType}
                  title={currentEntry.title}
                  year={currentEntry.year}
                  dateWatched={currentEntry.dateWatched}
                  director={currentEntry.director}
                  cinematographer={currentEntry.cinematographer}
                  composer={currentEntry.composer}
                  starring={currentEntry.starring}
                  cast={currentEntry.cast}
                  distributor={currentEntry.distributor}
                  runtime={currentEntry.runtime}
                  rating={currentEntry.rating}
                  location={currentEntry.location}
                  locationDetail={currentEntry.locationDetail}
                  firstTime={currentEntry.firstTime}
                  socialContext={currentEntry.socialContext}
                  companionNames={currentEntry.companionNames}
                  notes={currentEntry.notes}
                  metacriticScore={currentEntry.metacriticScore}
                  rottenTomatoesScore={currentEntry.rottenTomatoesScore}
                  trailerUrl={currentEntry.trailerUrl}
                  metacriticUrl={currentEntry.metacriticUrl}
                  rottenTomatoesUrl={currentEntry.rottenTomatoesUrl}
                  metacriticData={currentEntry.metacriticData}
                  rottenTomatoesData={currentEntry.rottenTomatoesData}
                  streamingOptions={currentEntry.streamingOptions}
                  videoId={currentEntry.videoId}
                  sourceUrl={currentEntry.sourceUrl}
                  poster={currentEntry.poster}
                  imdbRating={currentEntry.imdbRating}
                  imdbUrl={currentEntry.imdbUrl}
                  rated={currentEntry.rated}
                  awards={currentEntry.awards}
                  boxOffice={currentEntry.boxOffice}
                  plot={currentEntry.plot}
                  overview={currentEntry.overview}
                  country={currentEntry.country}
                  language={currentEntry.language}
                  genres={currentEntry.genres}
                  tmdbRating={currentEntry.tmdbRating}
                  isBuilding={isLogging}
                  onEdit={onEdit}
                  onTalentPreferenceChange={onTalentPreferenceChange}
                  initialTalentPreferences={talentPreferences}
                  onSaveTrack={handleSaveMusicTrack}
                  onUnsaveTrack={handleUnsaveMusicTrack}
                  savedTracks={savedMusicTracks}
                />
            ) : (
              <div className="text-center py-16 text-ink-500">
                <div className="text-4xl mb-4">{searchMode === 'queue' ? '📋' : '🎬'}</div>
                <p className="text-lg">{searchMode === 'queue' ? 'Add to your queue' : 'Search for something to log'}</p>
                <p className="text-sm mt-2">{searchMode === 'queue' ? 'Search or paste a URL to preview' : 'Your entry will appear here'}</p>
              </div>
            )}
          </div>
        )}

        {/* UP NEXT TAB */}
        {activeTab === 'upnext' && (
          <div>
            {/* Media Type Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {mediaFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setMediaFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mediaFilter === filter.id
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200 border border-paper-400'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-ink-500">Sort:</span>
              <div className="flex rounded-lg overflow-hidden border border-paper-400">
                <button
                  onClick={() => setSortMode('date')}
                  className={`px-3 py-1 text-sm font-medium transition-all ${
                    sortMode === 'date'
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
                  }`}
                >
                  Date
                </button>
                <button
                  onClick={() => setSortMode('score')}
                  className={`px-3 py-1 text-sm font-medium transition-all ${
                    sortMode === 'score'
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
                  }`}
                >
                  Score
                </button>
              </div>
            </div>

            {/* Queue Items - Accordion Style */}
            <div className="space-y-2">
              {sortItems(filterItems(upNextQueue, mediaFilter), sortMode).length > 0 ? (
                sortItems(filterItems(upNextQueue, mediaFilter), sortMode).map((item) => {
                  const isExpanded = expandedQueueId === item.id
                  const hasExpandedItem = expandedQueueId !== null
                  // Debug: log queue item data when expanded
                  if (isExpanded) {
                    console.log('Queue item data:', item)
                  }
                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                        isExpanded
                          ? 'border-orange-400 shadow-lg scale-[1.01]'
                          : hasExpandedItem
                            ? 'border-paper-300 opacity-90 hover:opacity-100 hover:border-accent-blue hover:border-2 hover:bg-blue-100 hover:shadow-md hover:scale-[1.01]'
                            : 'border-paper-300 hover:border-orange-300'
                      }`}
                    >
                      {/* Collapsed Header - Click to expand */}
                      <button
                        onClick={() => setExpandedQueueId(isExpanded ? null : item.id)}
                        className="w-full p-4 text-left flex justify-between items-center hover:bg-paper-50 transition-colors"
                      >
                        <div className="flex-1">
                          <h3 className="font-bold text-ink-800">{item.title}</h3>
                          <p className="text-sm text-ink-500">
                            {item.author ? item.author : (
                              <>{item.year} {item.director && `• ${item.director}`}</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded uppercase font-medium ${
                            item.mediaType === 'book' || item.mediaType === 'audiobook' ? 'bg-amber-100 text-amber-700' :
                            item.mediaType === 'tv' ? 'bg-purple-100 text-purple-700' :
                            item.mediaType === 'podcast' ? 'bg-green-100 text-green-700' :
                            item.mediaType === 'music' ? 'bg-pink-100 text-pink-700' :
                            item.mediaType === 'video' ? 'bg-red-100 text-red-700' :
                            'bg-paper-300 text-ink-600'
                          }`}>
                            {item.mediaType === 'movie' ? 'Movie' : item.mediaType === 'audiobook' ? 'Audiobook' : item.mediaType}
                          </span>
                          <span className={`text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-paper-300 animate-fade-in">
                          {/* Video/Trailer Player - supports both videoId and trailerUrl */}
                          {(item.trailerUrl || item.videoId) && (
                            <div className="bg-black">
                              <iframe
                                src={item.trailerUrl || `https://www.youtube.com/embed/${item.videoId}`}
                                title={`${item.title} Trailer`}
                                className="w-full aspect-video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}

                          <div className="p-5 bg-gradient-to-b from-orange-50 to-white space-y-4">
                            {/* Genres */}
                            {item.genres && item.genres.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {item.genres.map((genre: string) => (
                                  <span key={genre} className="px-2 py-1 bg-paper-200 text-ink-600 rounded-full text-xs">
                                    {genre}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* TMDB Rating */}
                            {item.tmdbRating && (
                              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-200">
                                <div className="flex items-center gap-2">
                                  <span className="text-orange-600 font-bold text-sm">TMDB</span>
                                  <span className={`font-bold px-2 py-0.5 rounded text-sm ${
                                    item.tmdbRating >= 70 ? 'bg-green-100 text-green-700' :
                                    item.tmdbRating >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {item.tmdbRating}%
                                  </span>
                                </div>
                                {item.tmdbVoteCount && (
                                  <span className="text-xs text-ink-400">
                                    ({item.tmdbVoteCount.toLocaleString()} votes)
                                  </span>
                                )}
                                {item.runtime && (
                                  <span className="text-sm text-ink-500 ml-auto">
                                    {Math.floor(item.runtime / 60)}h {item.runtime % 60}m
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Critics Scores - Expandable Panels (matching MediaCard exactly) */}
                            {(item.metacriticScore || item.rottenTomatoesScore) && (
                              <div className="space-y-3 mb-6">
                                {/* Metacritic */}
                                {item.metacriticScore && (
                                  <div className="border-2 border-accent-blue rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between p-4 bg-white">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setExpandedCriticPanel(expandedCriticPanel === 'metacritic' ? null : 'metacritic')
                                        }}
                                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                      >
                                        <span className="text-accent-blue font-bold">Metacritic</span>
                                        <span className="bg-accent-blue text-white font-bold px-3 py-1 rounded text-lg">
                                          {item.metacriticScore}
                                        </span>
                                        <span className="text-accent-blue text-xl">
                                          {expandedCriticPanel === 'metacritic' ? '−' : '+'}
                                        </span>
                                      </button>
                                      {item.metacriticUrl && (
                                        <a
                                          href={item.metacriticUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                                        >
                                          Open in New Tab <span>↗</span>
                                        </a>
                                      )}
                                    </div>
                                    {expandedCriticPanel === 'metacritic' && (
                                      <div className="p-4 bg-paper-100 border-t-2 border-accent-blue">
                                        <p className="text-ink-600 mb-4">
                                          Based on {item.metacriticData?.criticReviews || 'multiple'} critic reviews.
                                        </p>
                                        {item.metacriticUrl && (
                                          <a
                                            href={item.metacriticUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                          >
                                            Open in New Tab <span className="text-sm">↗</span>
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Rotten Tomatoes */}
                                {item.rottenTomatoesScore && (
                                  <div className="border-2 border-accent-blue rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between p-4 bg-white">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setExpandedCriticPanel(expandedCriticPanel === 'rt' ? null : 'rt')
                                        }}
                                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                      >
                                        <span className="text-accent-blue font-bold">Rotten Tomatoes</span>
                                        <span className="bg-accent-blue text-white font-bold px-3 py-1 rounded text-lg">
                                          {item.rottenTomatoesScore}% Critics
                                        </span>
                                        {item.rottenTomatoesData?.audienceScore && (
                                          <span className="bg-orange-500 text-white font-bold px-3 py-1 rounded text-lg">
                                            {item.rottenTomatoesData.audienceScore}% Audience
                                          </span>
                                        )}
                                        <span className="text-accent-blue text-xl">
                                          {expandedCriticPanel === 'rt' ? '−' : '+'}
                                        </span>
                                      </button>
                                      {item.rottenTomatoesUrl && (
                                        <a
                                          href={item.rottenTomatoesUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                                        >
                                          Open in New Tab <span>↗</span>
                                        </a>
                                      )}
                                    </div>
                                    {expandedCriticPanel === 'rt' && (
                                      <div className="p-4 bg-paper-100 border-t-2 border-accent-blue">
                                        {item.rottenTomatoesData?.consensus && (
                                          <p className="text-ink-800 italic mb-4">"{item.rottenTomatoesData.consensus}"</p>
                                        )}
                                        <p className="text-ink-600 mb-4">
                                          Based on {item.rottenTomatoesData?.criticReviews || 'multiple'} critic reviews.
                                        </p>
                                        {item.rottenTomatoesUrl && (
                                          <a
                                            href={item.rottenTomatoesUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                          >
                                            Open in New Tab <span className="text-sm">↗</span>
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* IMDB - matching MediaCard style */}
                            {item.imdbUrl && (
                              <div className="border-2 border-accent-blue rounded-xl overflow-hidden mb-4">
                                <div className="flex items-center justify-between p-4 bg-white">
                                  <div className="flex items-center gap-3">
                                    <span className="text-accent-blue font-bold">IMDb</span>
                                    {item.tmdbRating && (
                                      <span className="bg-yellow-500 text-black font-bold px-3 py-1 rounded text-lg">
                                        {(item.tmdbRating / 10).toFixed(1)}/10
                                      </span>
                                    )}
                                    {item.tmdbVoteCount && (
                                      <span className="text-ink-500 text-sm">
                                        ({item.tmdbVoteCount.toLocaleString()} votes)
                                      </span>
                                    )}
                                  </div>
                                  <a
                                    href={item.imdbUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                                  >
                                    Open in New Tab <span>↗</span>
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* OMDB Rich Metadata */}
                            {(item.awards || item.boxOffice || item.rated || item.plot) && (
                              <div className="space-y-3 p-4 bg-paper-50 rounded-xl border border-paper-200">
                                {/* Awards */}
                                {item.awards && item.awards !== 'N/A' && (
                                  <div>
                                    <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Awards</div>
                                    <p className="text-ink-800 font-medium">{item.awards}</p>
                                  </div>
                                )}
                                {/* Box Office */}
                                {item.boxOffice && item.boxOffice !== 'N/A' && (
                                  <div>
                                    <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Box Office</div>
                                    <p className="text-ink-800 font-bold text-lg">{item.boxOffice}</p>
                                  </div>
                                )}
                                {/* Rating & Runtime */}
                                <div className="flex items-center gap-4 flex-wrap">
                                  {item.rated && item.rated !== 'N/A' && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-ink-400 uppercase">Rated</span>
                                      <span className="px-2 py-1 bg-ink-800 text-white rounded font-bold text-sm">{item.rated}</span>
                                    </div>
                                  )}
                                  {item.runtime && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-ink-400 uppercase">Runtime</span>
                                      <span className="text-ink-700 font-medium">{Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span>
                                    </div>
                                  )}
                                  {item.language && item.language !== 'N/A' && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-ink-400 uppercase">Language</span>
                                      <span className="text-ink-700">{item.language}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Plot */}
                                {item.plot && item.plot !== 'N/A' && (
                                  <div>
                                    <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Plot</div>
                                    <p className="text-ink-600 text-sm leading-relaxed">{item.plot}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Director */}
                            {item.director && (
                              <div>
                                <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Director</div>
                                <TalentPill
                                  name={item.director}
                                  preference={queueTalentPreferences[item.director]}
                                  onPreferenceChange={onQueueTalentPreferenceChange}
                                />
                              </div>
                            )}

                            {/* Cast */}
                            {item.cast && item.cast.length > 0 && (
                              <div>
                                <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Cast</div>
                                <div className="flex flex-wrap gap-2">
                                  {item.cast.slice(0, 6).map((actor: { name: string; character: string }) => (
                                    <TalentPill
                                      key={actor.name}
                                      name={actor.name}
                                      preference={queueTalentPreferences[actor.name]}
                                      onPreferenceChange={onQueueTalentPreferenceChange}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Cinematographer */}
                            {item.cinematographer && (
                              <div>
                                <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Cinematographer</div>
                                <TalentPill
                                  name={item.cinematographer}
                                  preference={queueTalentPreferences[item.cinematographer]}
                                  onPreferenceChange={onQueueTalentPreferenceChange}
                                />
                              </div>
                            )}

                            {/* Composer / Music */}
                            {item.composer && (
                              <div>
                                <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Music</div>
                                <TalentPill
                                  name={item.composer}
                                  preference={queueTalentPreferences[item.composer]}
                                  onPreferenceChange={onQueueTalentPreferenceChange}
                                />
                              </div>
                            )}

                            {/* Writers */}
                            {item.writers && item.writers.length > 0 && (
                              <div>
                                <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Writers</div>
                                <div className="flex flex-wrap gap-2">
                                  {item.writers.slice(0, 4).map((writer: string) => (
                                    <TalentPill
                                      key={writer}
                                      name={writer}
                                      preference={queueTalentPreferences[writer]}
                                      onPreferenceChange={onQueueTalentPreferenceChange}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Editor */}
                            {item.editor && (
                              <div>
                                <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Editor</div>
                                <TalentPill
                                  name={item.editor}
                                  preference={queueTalentPreferences[item.editor]}
                                  onPreferenceChange={onQueueTalentPreferenceChange}
                                />
                              </div>
                            )}

                            {/* Awards & Box Office from OMDB */}
                            {(item.awards || item.boxOffice) && (
                              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                {item.awards && (
                                  <div className="mb-2">
                                    <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Awards</div>
                                    <p className="text-sm text-ink-700">{item.awards}</p>
                                  </div>
                                )}
                                {item.boxOffice && (
                                  <div>
                                    <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Box Office</div>
                                    <p className="text-sm text-ink-700 font-medium">{item.boxOffice}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Additional Info from OMDB */}
                            {(item.rated || item.language || item.country) && (
                              <div className="flex flex-wrap gap-3 text-sm">
                                {item.rated && (
                                  <span className="bg-paper-200 text-ink-700 px-2 py-1 rounded font-medium">
                                    {item.rated}
                                  </span>
                                )}
                                {item.language && (
                                  <span className="text-ink-500">{item.language}</span>
                                )}
                                {item.country && (
                                  <span className="text-ink-500">{item.country}</span>
                                )}
                              </div>
                            )}

                            {/* Description */}
                            {(item.description || item.overview) && (
                              <p className="text-sm text-ink-600 leading-relaxed line-clamp-4">
                                {item.overview || item.description}
                              </p>
                            )}


                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-3 border-t border-orange-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedQueueId(null)
                                  onLogFromQueue?.(item)
                                }}
                                className="flex-1 px-4 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                              >
                                ✍️ Log It Now
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSoundtrackMovie({ title: item.title, year: item.year, composer: item.composer })
                                }}
                                className="px-4 py-3 bg-purple-100 text-purple-700 rounded-xl font-bold hover:bg-purple-200 transition-colors flex items-center gap-2"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                                Soundtrack
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedQueueId(null)
                                  onRemoveFromQueue?.(item.id)
                                }}
                                className="px-4 py-3 bg-paper-200 text-ink-600 rounded-xl font-bold hover:bg-red-100 hover:text-red-600 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-12 text-ink-500">
                  <div className="text-4xl mb-4">📋</div>
                  <p>No items in your queue</p>
                  <p className="text-sm mt-2">Search to add something</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DRAFTS TAB */}
        {activeTab === 'drafts' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-ink-800 mb-2">Your Drafts</h2>
              <p className="text-sm text-ink-500">Items you saved to finish logging later. Click to resume.</p>
            </div>

            {/* Draft Items */}
            <div className="space-y-3">
              {loggedItems.filter(item => item.isDraft).length > 0 ? (
                loggedItems.filter(item => item.isDraft).map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl overflow-hidden border-2 border-amber-400 shadow-md hover:shadow-lg transition-all hover:scale-[1.01]"
                  >
                    {/* Draft Banner */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        <span className="text-lg">⚠️</span>
                        <span className="font-bold uppercase tracking-wide text-sm">Draft - Incomplete</span>
                      </div>
                      <span className="text-white/80 text-xs">Saved {item.addedAt}</span>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        {item.poster && (
                          <img
                            src={item.poster}
                            alt={item.title}
                            className="w-20 h-28 object-cover rounded-lg shadow"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-bold text-ink-800 text-lg">{item.title}</h3>
                          <p className="text-sm text-ink-500">
                            {item.year} {item.director && `• ${item.director}`}
                          </p>
                          {item.rating && (
                            <p className="text-sm text-ink-600 mt-1">
                              Rating so far: <span className="font-bold">{item.rating}%</span>
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-sm text-ink-500 mt-1 italic truncate">
                              "{item.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => onResumeDraft?.(item)}
                          className="flex-1 px-4 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                        >
                          Resume Logging
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete draft "${item.title}"? This cannot be undone.`)) {
                              onRemoveLoggedItem?.(item.id)
                            }
                          }}
                          className="px-4 py-3 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-ink-500">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="font-medium">No drafts</p>
                  <p className="text-sm mt-2">When you save a log in progress, it'll appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LIBRARY TAB */}
        {activeTab === 'library' && (
          <div>
            {/* Media Type Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {mediaFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setMediaFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mediaFilter === filter.id
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200 border border-paper-400'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-ink-500">Sort:</span>
              <div className="flex rounded-lg overflow-hidden border border-paper-400">
                <button
                  onClick={() => setSortMode('date')}
                  className={`px-3 py-1 text-sm font-medium transition-all ${
                    sortMode === 'date'
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
                  }`}
                >
                  Date
                </button>
                <button
                  onClick={() => setSortMode('score')}
                  className={`px-3 py-1 text-sm font-medium transition-all ${
                    sortMode === 'score'
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
                  }`}
                >
                  Score
                </button>
              </div>
            </div>

            {/* Logged Items - Accordion Style (excluding drafts - they go in Drafts tab) */}
            <div className="space-y-2">
              {sortItems(filterItems(loggedItems.filter(i => !i.isDraft), mediaFilter), sortMode).map((item) => {
                const isExpanded = expandedLibraryId === item.id
                const hasExpandedItem = expandedLibraryId !== null
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                      isExpanded
                        ? 'border-accent-blue shadow-lg scale-[1.01]'
                        : hasExpandedItem
                          ? 'border-paper-300 opacity-90 hover:opacity-100 hover:border-accent-blue hover:border-2 hover:bg-blue-100 hover:shadow-md hover:scale-[1.01]'
                          : 'border-paper-300 hover:border-accent-blue'
                    }`}
                  >
                    {/* Collapsed Header - Click to expand */}
                    <button
                      onClick={() => setExpandedLibraryId(isExpanded ? null : item.id)}
                      className="w-full p-4 text-left flex justify-between items-center hover:bg-paper-50 transition-colors"
                    >
                      <div className="flex-1">
                        {/* Media type badge for songs */}
                        {item.mediaType === 'music' && (
                          <span className="inline-block px-2 py-0.5 bg-pink-100 text-pink-700 text-xs font-bold rounded uppercase mb-1">
                            Song
                          </span>
                        )}
                        <h3 className="font-bold text-ink-800">{item.title}</h3>
                        <p className="text-sm text-ink-500">
                          {item.mediaType === 'music'
                            ? item.director // artist is stored in director field for music
                            : <>{item.year} {item.director && `• ${item.director}`}</>
                          }
                        </p>
                        {item.mediaType === 'music' && item.description && (
                          <p className="text-xs text-ink-400 mt-1">
                            {item.description}
                          </p>
                        )}
                        {item.mediaType !== 'music' && item.dateConsumed && (
                          <p className="text-xs text-ink-400 mt-1">
                            Watched {item.dateConsumed}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {item.rating && (
                          <span className={`text-lg font-bold ${
                            item.rating >= 90 ? 'text-red-600' :
                            item.rating >= 80 ? 'text-green-600' :
                            item.rating >= 60 ? 'text-orange-600' :
                            'text-accent-blue'
                          }`}>
                            {item.rating}%
                          </span>
                        )}
                        <span className={`text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-paper-300 animate-fade-in">
                        {/* MUSIC ITEMS - Video with collapsible info section */}
                        {item.mediaType === 'music' ? (() => {
                          // Get all music tracks for navigation
                          const allMusicTracks = sortItems(
                            filterItems(loggedItems.filter(i => !i.isDraft), 'music'),
                            sortMode
                          ).filter(i => i.videoId)
                          const currentIndex = allMusicTracks.findIndex(t => t.id === item.id)
                          const hasPrev = currentIndex > 0
                          const hasNext = currentIndex < allMusicTracks.length - 1
                          const prevTrack = hasPrev ? allMusicTracks[currentIndex - 1] : null
                          const nextTrack = hasNext ? allMusicTracks[currentIndex + 1] : null

                          return (
                          <div>
                            {/* YouTube Embed with autoplay and auto-advance */}
                            {item.videoId && (
                              <div className="bg-black">
                                <MusicYouTubePlayer
                                  videoId={item.videoId}
                                  title={item.title}
                                  ytApiReady={ytApiReady}
                                  onVideoEnd={() => {
                                    if (nextTrack) {
                                      setExpandedLibraryId(nextTrack.id)
                                    }
                                  }}
                                />
                              </div>
                            )}

                            {/* Navigation Controls */}
                            {allMusicTracks.length > 1 && (
                              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-accent-blue/10 to-accent-navy/10 border-t border-accent-blue/20">
                                <button
                                  onClick={() => prevTrack && setExpandedLibraryId(prevTrack.id)}
                                  disabled={!hasPrev}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                                    hasPrev
                                      ? 'bg-white text-ink-700 hover:bg-accent-blue/10 border border-accent-blue/30'
                                      : 'bg-paper-100 text-ink-400 cursor-not-allowed'
                                  }`}
                                >
                                  ⏮ Previous
                                </button>
                                <span className="text-sm text-ink-500 font-medium">
                                  {currentIndex + 1} of {allMusicTracks.length}
                                </span>
                                <button
                                  onClick={() => nextTrack && setExpandedLibraryId(nextTrack.id)}
                                  disabled={!hasNext}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                                    hasNext
                                      ? 'bg-accent-blue text-white hover:bg-accent-navy'
                                      : 'bg-paper-100 text-ink-400 cursor-not-allowed'
                                  }`}
                                >
                                  Next ⏭
                                </button>
                              </div>
                            )}

                            {/* Collapsible info toggle */}
                            <button
                              onClick={() => setExpandedMusicInfoId(expandedMusicInfoId === item.id ? null : item.id)}
                              className="w-full p-3 bg-paper-100 hover:bg-paper-200 transition-colors flex justify-between items-center border-t border-paper-300"
                            >
                              <span className="text-sm text-ink-600">
                                {item.description || 'Song info'}
                              </span>
                              <span className={`text-ink-500 transition-transform ${expandedMusicInfoId === item.id ? 'rotate-180' : ''}`}>
                                ▼
                              </span>
                            </button>
                            {/* Expanded info section */}
                            {expandedMusicInfoId === item.id && (
                              <div className="p-4 bg-paper-50 border-t border-paper-200 space-y-4">
                                {/* Song details */}
                                <div className="bg-white rounded-lg p-4 border border-paper-200">
                                  <h4 className="font-bold text-ink-800 mb-3">Song Details</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-ink-500">Title</span>
                                      <span className="font-medium text-ink-800">{item.title}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-ink-500">Artist</span>
                                      <span className="font-medium text-ink-800">{item.director}</span>
                                    </div>
                                    {item.description && (
                                      <div className="flex justify-between">
                                        <span className="text-ink-500">Source</span>
                                        <span className="font-medium text-ink-800">{item.description}</span>
                                      </div>
                                    )}
                                    {item.dateConsumed && (
                                      <div className="flex justify-between">
                                        <span className="text-ink-500">Added</span>
                                        <span className="font-medium text-ink-800">{item.dateConsumed}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Notes section */}
                                <div className="bg-white rounded-lg p-4 border border-paper-200">
                                  <h4 className="font-bold text-ink-800 mb-2">Notes</h4>
                                  {item.notes ? (
                                    <p className="text-sm text-ink-600">{item.notes}</p>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        const newNotes = prompt('Add notes about this song:', '')
                                        if (newNotes) {
                                          onUpdateLoggedItem?.(item.id, { notes: newNotes })
                                        }
                                      }}
                                      className="text-sm text-accent-blue hover:underline"
                                    >
                                      + Add notes
                                    </button>
                                  )}
                                </div>

                                {/* Remove button */}
                                <button
                                  onClick={() => {
                                    if (confirm(`Remove "${item.title}" from your music collection?`)) {
                                      onRemoveLoggedItem?.(item.id)
                                      if (item.videoId) {
                                        handleUnsaveMusicTrack(item.videoId)
                                      }
                                      setExpandedLibraryId(null)
                                      setExpandedMusicInfoId(null)
                                    }
                                  }}
                                  className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
                                >
                                  🗑️ Remove from My Stuff
                                </button>
                              </div>
                            )}
                          </div>
                          )
                        })() : (
                          <div className="p-5 bg-gradient-to-b from-accent-blue/5 to-white space-y-4">
                            <MediaCard
                              entryNumber={0}
                              mediaType={item.mediaType}
                              title={item.title}
                              year={item.year}
                              director={item.director}
                              rating={item.rating}
                              dateWatched={item.dateConsumed}
                              isBuilding={true}
                              // Crew
                              cinematographer={item.cinematographer}
                              composer={item.composer}
                              starring={item.cast?.map(c => c.name)}
                              cast={item.cast}
                              runtime={item.runtime}
                              // Critic scores
                              metacriticScore={item.metacriticScore}
                              rottenTomatoesScore={item.rottenTomatoesScore}
                              metacriticUrl={item.metacriticUrl}
                              rottenTomatoesUrl={item.rottenTomatoesUrl}
                              metacriticData={item.metacriticData}
                              rottenTomatoesData={item.rottenTomatoesData}
                              imdbRating={item.imdbRating}
                              imdbUrl={item.imdbUrl}
                              // Rich metadata
                              poster={item.poster}
                              videoId={item.videoId || item.trailerVideoId}
                              trailerUrl={item.trailerUrl}
                              sourceUrl={item.sourceUrl}
                              rated={item.rated}
                              awards={item.awards}
                              boxOffice={item.boxOffice}
                              plot={item.plot}
                              overview={item.overview}
                              country={item.country}
                              language={item.language}
                              genres={item.genres}
                              tmdbRating={item.tmdbRating}
                              // Experience
                              location={item.location}
                              locationDetail={item.locationDetail}
                              firstTime={item.firstTime}
                              socialContext={item.socialContext}
                              companionNames={item.companionNames}
                              notes={item.notes}
                              // Talent preferences
                              initialTalentPreferences={talentPreferences}
                              onTalentPreferenceChange={onTalentPreferenceChange}
                              // Soundtrack
                              onSaveTrack={handleSaveMusicTrack}
                              onUnsaveTrack={handleUnsaveMusicTrack}
                              savedTracks={savedMusicTracks}
                              onEdit={(changes) => {
                                if (changes.rating !== undefined) {
                                  onUpdateLoggedItem?.(item.id, { rating: changes.rating })
                                }
                                console.log('Updated entry:', { id: item.id, changes })
                              }}
                            />

                            {/* Cast, Scenes & Videos Gallery */}
                            {(item.mediaType === 'movie' || item.mediaType === 'tv') && (item.tmdbId || item.title) && (
                              <CharacterGallery
                                movieTitle={item.title}
                                movieYear={item.year}
                                movieId={item.tmdbId?.toString()}
                              />
                            )}

                            <div className="bg-paper-100 rounded-xl p-4 space-y-3">
                              <h4 className="font-bold text-ink-800 flex items-center gap-2 text-sm">
                                <span>📝</span> Your Experience
                              </h4>
                              {(item.companionNames || item.socialContext) && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span>👥</span>
                                  <span className="text-ink-600">
                                    Watched {item.socialContext === 'alone' ? 'solo' :
                                      item.companionNames ? `with ${item.companionNames}` :
                                      item.socialContext ? `with ${item.socialContext}` : ''}
                                    {item.location && ` at ${item.location === 'theater' ? 'the theater' : 'home'}`}
                                  </span>
                                </div>
                              )}
                              {item.notes ? (
                                <div className="bg-white rounded-lg p-3 text-sm text-ink-700 leading-relaxed border border-paper-300">
                                  {highlightEntities(item.notes)}
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    const newNotes = prompt('Add your notes:', '')
                                    if (newNotes) {
                                      onUpdateLoggedItem?.(item.id, { notes: newNotes })
                                    }
                                  }}
                                  className="text-sm text-accent-blue hover:underline"
                                >
                                  + Add notes
                                </button>
                              )}
                              {item.dateConsumed && (
                                <div className="flex items-center gap-2 text-ink-500 text-xs pt-2 border-t border-paper-300">
                                  <span>📅</span>
                                  <span>Logged {(() => {
                                    const dateStr = item.dateConsumed
                                    if (dateStr.includes('-')) {
                                      const parts = dateStr.split('-')
                                      if (parts.length === 3) {
                                        const [year, month, day] = parts.map(Number)
                                        const safeYear = year > 2030 || year < 1900 ? new Date().getFullYear() : year
                                        const date = new Date(safeYear, month - 1, day)
                                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                      }
                                    }
                                    return dateStr
                                  })()}</span>
                                </div>
                              )}
                            </div>
                            {/* Draft Actions - Resume and Delete */}
                            {item.isDraft && (
                              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-amber-700">
                                  <span className="text-xl">⚠️</span>
                                  <div>
                                    <p className="font-bold">This entry is incomplete</p>
                                    <p className="text-sm">Resume to finish logging your experience</p>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => onResumeDraft?.(item)}
                                    className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors"
                                  >
                                    ▶️ Resume Logging
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete "${item.title}" draft? This cannot be undone.`)) {
                                        onRemoveLoggedItem?.(item.id)
                                        setExpandedLibraryId(null)
                                      }
                                    }}
                                    className="px-4 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-3 pt-3 border-t border-paper-200">
                              <button
                                onClick={() => handleAddToQueue({ title: item.title, year: item.year, mediaType: item.mediaType, director: item.director })}
                                disabled={justAddedToQueue.has(item.title)}
                                className={`flex-1 px-4 py-3 rounded-xl font-bold transition-colors ${
                                  justAddedToQueue.has(item.title)
                                    ? 'bg-green-600 text-white'
                                    : 'bg-paper-200 text-ink-700 hover:bg-paper-300'
                                }`}
                              >
                                {justAddedToQueue.has(item.title) ? '✓ Added!' : '+ Rewatch'}
                              </button>
                              <button
                                onClick={() => {
                                  const newNotes = prompt('Edit notes:', item.notes || '')
                                  if (newNotes !== null) {
                                    onUpdateLoggedItem?.(item.id, { notes: newNotes })
                                  }
                                }}
                                className="px-4 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                              >
                                ✏️ Edit
                              </button>
                              {/* Delete button for all items */}
                              <button
                                onClick={() => {
                                  if (confirm(`Remove "${item.title}" from My Stuff?`)) {
                                    onRemoveLoggedItem?.(item.id)
                                    setExpandedLibraryId(null)
                                  }
                                }}
                                className="px-4 py-3 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200 transition-colors"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* RECOMMENDATIONS TAB */}
        {activeTab === 'recs' && (
          <div className="space-y-6">
            {/* If rating an "already seen" item, show full MediaCard inline (not a modal) */}
            {alreadySeenItem ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-accent-blue text-xl">You've seen this!</h3>
                  <button
                    onClick={() => setAlreadySeenItem(null)}
                    className="text-accent-blue hover:underline text-sm font-medium"
                  >
                    ← Back to Recommendations
                  </button>
                </div>

                {/* Full MediaCard - EDITABLE */}
                <MediaCard
                  entryNumber={0}
                  mediaType="movie"
                  title={alreadySeenItem.title}
                  year={alreadySeenItem.year}
                  director={alreadySeenItem.director}
                  cinematographer={alreadySeenItem.cinematographer}
                  composer={alreadySeenItem.composer}
                  starring={alreadySeenItem.starring}
                  runtime={alreadySeenItem.runtime}
                  rating={alreadySeenRating}
                  metacriticScore={alreadySeenItem.metacriticScore}
                  rottenTomatoesScore={alreadySeenItem.rottenTomatoesScore}
                  metacriticUrl={alreadySeenItem.metacriticUrl}
                  rottenTomatoesUrl={alreadySeenItem.rottenTomatoesUrl}
                  trailerUrl={alreadySeenItem.trailerUrl}
                  isBuilding={true}
                  onEdit={(changes) => {
                    if (changes.rating !== undefined) {
                      setAlreadySeenRating(changes.rating)
                    }
                  }}
                  onTalentPreferenceChange={(prefs) => {
                    setAlreadySeenTalentPrefs(prefs)
                  }}
                  initialTalentPreferences={alreadySeenTalentPrefs}
                />

                {/* Action Buttons */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => {
                      handleAddToQueue({ title: alreadySeenItem.title, year: alreadySeenItem.year, mediaType: 'movie', director: alreadySeenItem.director })
                    }}
                    disabled={justAddedToQueue.has(alreadySeenItem.title)}
                    className={`w-full px-4 py-3 rounded-xl font-bold transition-colors ${
                      justAddedToQueue.has(alreadySeenItem.title)
                        ? 'bg-green-600 text-white'
                        : 'bg-paper-300 text-ink-700 hover:bg-paper-400'
                    }`}
                  >
                    {justAddedToQueue.has(alreadySeenItem.title)
                      ? '✓ Added to Up Next!'
                      : '+ Add to Up Next (Rewatch)'}
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setAlreadySeenItem(null)}
                      className="flex-1 px-4 py-3 bg-paper-300 text-ink-700 rounded-xl font-bold hover:bg-paper-400 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveAlreadySeenEntry}
                      className="flex-1 px-4 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      Save to My Stuff
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            <>
            {/* AI Chat Input - THE POWER OF AI */}
            <div className="bg-accent-blue/10 border-2 border-accent-blue rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-bold text-accent-blue mb-1">Ask Me Anything</h3>
                  <p className="text-ink-600 text-sm">
                    Tell me what you're in the mood for and I'll find the perfect match.
                  </p>
                </div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); console.log('AI Query:', recsQuery); }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={recsQuery}
                    onChange={(e) => setRecsQuery(e.target.value)}
                    placeholder="I'm at home tonight, want something intense..."
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-accent-blue bg-white text-ink-800 placeholder-ink-400"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                  >
                    Ask
                  </button>
                </div>
              </form>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  "What should I watch tonight?",
                  "Something like Anora",
                  "Best new releases",
                  "Hidden gems I'd love",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setRecsQuery(suggestion)}
                    className="text-xs px-3 py-1.5 bg-white border border-accent-blue text-accent-blue rounded-full hover:bg-accent-blue hover:text-white transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Type Filters */}
            <div className="flex gap-2 flex-wrap">
              {mediaFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setMediaFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mediaFilter === filter.id
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200 border border-paper-400'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Recommendation Categories - Full data for MediaCard consistency */}
            {(() => {
              // Full recommendation data with all MediaCard fields
              const ptaRecs: AlreadySeenData[] = [
                {
                  title: 'One Battle After Another',
                  year: 2025,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Michael Bauman',
                  composer: 'Jonny Greenwood',
                  starring: ['Leonardo DiCaprio', 'Sean Penn', 'Chase Infiniti', 'Regina Hall', 'Teyana Taylor', 'Wood Harris'],
                  runtime: 156,
                  metacriticScore: 95,
                  rottenTomatoesScore: 94,
                  metacriticUrl: 'https://www.metacritic.com/movie/one-battle-after-another',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/one_battle_after_another',
                  trailerUrl: 'https://www.youtube.com/embed/_qQLUxZAklQ',
                  rated: 'R',
                  awards: '131 wins & 255 nominations total',
                  boxOffice: '$287,000,000',
                  plot: 'Washed-up revolutionary Bob exists in a state of stoned paranoia, surviving off-grid with his spirited, self-reliant daughter, Willa. When his evil nemesis resurfaces after 16 years and she goes missing, the former radical scrambles to find her.',
                  language: 'English',
                  country: 'USA',
                  imdbRating: '7.9',
                },
                {
                  title: 'The Master',
                  year: 2012,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Mihai Mălaimare Jr.',
                  composer: 'Jonny Greenwood',
                  starring: ['Joaquin Phoenix', 'Philip Seymour Hoffman', 'Amy Adams', 'Laura Dern', 'Jesse Plemons', 'Rami Malek'],
                  runtime: 138,
                  metacriticScore: 86,
                  rottenTomatoesScore: 85,
                  metacriticUrl: 'https://www.metacritic.com/movie/the-master',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_master_2012',
                  trailerUrl: 'https://www.youtube.com/embed/fJ1O1vb9AUU',
                  // OMDB data
                  rated: 'R',
                  awards: 'Nominated for 3 Oscars. 30 wins & 107 nominations total',
                  boxOffice: '$16,377,320',
                  plot: 'A Naval veteran arrives home from war unsettled and uncertain of his future - until he is tantalized by the Cause and its charismatic leader.',
                  language: 'English',
                  country: 'USA',
                  imdbRating: '7.1',
                },
                {
                  title: 'Punch-Drunk Love',
                  year: 2002,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Robert Elswit',
                  composer: 'Jon Brion',
                  starring: ['Adam Sandler', 'Emily Watson', 'Philip Seymour Hoffman', 'Luis Guzmán', 'Mary Lynn Rajskub'],
                  runtime: 95,
                  metacriticScore: 78,
                  rottenTomatoesScore: 79,
                  metacriticUrl: 'https://www.metacritic.com/movie/punch-drunk-love',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/punchdrunk_love',
                  trailerUrl: 'https://www.youtube.com/embed/bSN9v1SeDEY',
                  // OMDB data
                  rated: 'R',
                  awards: 'Won 1 BAFTA Award. 14 wins & 49 nominations total',
                  boxOffice: '$17,844,216',
                  plot: 'A psychologically troubled novelty supplier is nudged towards a romance with an English woman, all while being extorted by a phone-sex line run by a crooked mattress salesman.',
                  language: 'English',
                  country: 'USA',
                  imdbRating: '7.3',
                },
                {
                  title: 'The Power of the Dog',
                  year: 2021,
                  director: 'Jane Campion',
                  cinematographer: 'Ari Wegner',
                  composer: 'Jonny Greenwood',
                  starring: ['Benedict Cumberbatch', 'Kirsten Dunst', 'Jesse Plemons', 'Kodi Smit-McPhee', 'Thomasin McKenzie', 'Frances Conroy'],
                  runtime: 126,
                  metacriticScore: 89,
                  rottenTomatoesScore: 94,
                  metacriticUrl: 'https://www.metacritic.com/movie/the-power-of-the-dog',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_power_of_the_dog',
                  trailerUrl: 'https://www.youtube.com/embed/ELvKuuXdfCU',
                  // OMDB data
                  rated: 'R',
                  awards: 'Won 1 Oscar. 134 wins & 274 nominations total',
                  boxOffice: '$302,088',
                  plot: 'Charismatic rancher Phil Burbank inspires fear and awe in those around him. When his brother brings home a new wife and her son, Phil torments them until he finds himself exposed to the possibility of love.',
                  language: 'English',
                  country: 'UK, New Zealand, Australia, USA, Canada',
                  imdbRating: '6.8',
                },
              ]

              const trendingRecs: (AlreadySeenData & { match: string })[] = [
                {
                  title: 'The Brutalist',
                  year: 2024,
                  director: 'Brady Corbet',
                  cinematographer: 'Lol Crawley',
                  composer: 'Daniel Blumberg',
                  starring: ['Adrien Brody', 'Felicity Jones', 'Guy Pearce', 'Joe Alwyn', 'Raffey Cassidy', 'Stacy Martin'],
                  runtime: 215,
                  metacriticScore: 91,
                  rottenTomatoesScore: 93,
                  metacriticUrl: 'https://www.metacritic.com/movie/the-brutalist',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_brutalist',
                  trailerUrl: 'https://www.youtube.com/embed/example1',
                  match: '94% match',
                  // OMDB data
                  rated: 'R',
                  awards: 'Won 3 Golden Globes. 85 wins & 185 nominations total',
                  plot: 'A visionary architect and Holocaust survivor emigrates to America to rebuild his life, only to find himself trapped in a complex web of obsession with a wealthy industrialist.',
                  language: 'English, Hungarian, Italian',
                  country: 'UK, Hungary, USA',
                  imdbRating: '7.4',
                },
                {
                  title: 'A Real Pain',
                  year: 2024,
                  director: 'Jesse Eisenberg',
                  starring: ['Jesse Eisenberg', 'Kieran Culkin', 'Will Sharpe', 'Jennifer Grey', 'Kurt Egyiawan'],
                  runtime: 90,
                  metacriticScore: 80,
                  rottenTomatoesScore: 91,
                  metacriticUrl: 'https://www.metacritic.com/movie/a-real-pain',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/a_real_pain',
                  trailerUrl: 'https://www.youtube.com/embed/example2',
                  match: '91% match',
                  // OMDB data
                  rated: 'R',
                  awards: 'Nominated for 2 Oscars. 47 wins & 112 nominations total',
                  plot: 'Mismatched cousins reunite for a tour through Poland to honor their beloved grandmother.',
                  language: 'English, Polish, Yiddish',
                  country: 'USA, Poland',
                  imdbRating: '7.5',
                },
                {
                  title: 'Nickel Boys',
                  year: 2024,
                  director: 'RaMell Ross',
                  cinematographer: 'Jomo Fray',
                  starring: ['Ethan Herisse', 'Brandon Wilson', 'Aunjanue Ellis-Taylor', 'Hamish Linklater', 'Fred Hechinger', 'Daveed Diggs'],
                  runtime: 140,
                  metacriticScore: 86,
                  rottenTomatoesScore: 97,
                  metacriticUrl: 'https://www.metacritic.com/movie/nickel-boys',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/nickel_boys',
                  trailerUrl: 'https://www.youtube.com/embed/example3',
                  match: '89% match',
                  // OMDB data
                  rated: 'PG-13',
                  awards: 'Nominated for 2 Oscars. 29 wins & 78 nominations total',
                  plot: 'Based on the Pulitzer Prize-winning novel, two boys forge an unlikely bond at a brutal reform school in Jim Crow-era Florida.',
                  language: 'English',
                  country: 'USA',
                  imdbRating: '7.2',
                },
              ]

              const ptaFilmography: AlreadySeenData[] = [
                {
                  title: 'Boogie Nights',
                  year: 1997,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Robert Elswit',
                  composer: 'Michael Penn',
                  starring: ['Mark Wahlberg', 'Julianne Moore', 'Burt Reynolds', 'John C. Reilly', 'Don Cheadle', 'Heather Graham', 'William H. Macy', 'Philip Seymour Hoffman'],
                  runtime: 155,
                  metacriticScore: 85,
                  rottenTomatoesScore: 93,
                  metacriticUrl: 'https://www.metacritic.com/movie/boogie-nights',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/boogie_nights',
                  trailerUrl: 'https://www.youtube.com/embed/example4',
                  // OMDB data
                  rated: 'R',
                  awards: 'Nominated for 3 Oscars. 32 wins & 60 nominations total',
                  boxOffice: '$26,427,166',
                  plot: 'Back when sex was safe, pleasure was a business and business was booming, an ambitious young man with a special gift rises to the top of his profession, only to fall hard.',
                  language: 'English, Spanish',
                  country: 'USA',
                  imdbRating: '7.9',
                },
                {
                  title: 'Magnolia',
                  year: 1999,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Robert Elswit',
                  composer: 'Jon Brion',
                  starring: ['Tom Cruise', 'Julianne Moore', 'Philip Seymour Hoffman', 'John C. Reilly', 'William H. Macy', 'Jason Robards', 'Melora Walters', 'Jeremy Blackman'],
                  runtime: 188,
                  metacriticScore: 77,
                  rottenTomatoesScore: 83,
                  metacriticUrl: 'https://www.metacritic.com/movie/magnolia',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/magnolia',
                  trailerUrl: 'https://www.youtube.com/embed/example5',
                  // OMDB data
                  rated: 'R',
                  awards: 'Nominated for 3 Oscars. 30 wins & 73 nominations total',
                  boxOffice: '$22,455,976',
                  plot: 'An epic mosaic of interrelated characters in search of love, forgiveness, and meaning in the San Fernando Valley.',
                  language: 'English',
                  country: 'USA',
                  imdbRating: '8.0',
                },
                {
                  title: 'Hard Eight',
                  year: 1996,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Robert Elswit',
                  composer: 'Michael Penn',
                  starring: ['Philip Baker Hall', 'John C. Reilly', 'Gwyneth Paltrow', 'Samuel L. Jackson', 'Philip Seymour Hoffman'],
                  runtime: 102,
                  metacriticScore: 70,
                  rottenTomatoesScore: 82,
                  metacriticUrl: 'https://www.metacritic.com/movie/hard-eight',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/hard_eight',
                  trailerUrl: 'https://www.youtube.com/embed/example6',
                  // OMDB data
                  rated: 'R',
                  awards: '4 wins & 12 nominations total',
                  boxOffice: '$199,276',
                  plot: 'A stranger mentors a young Reno lowlife on the art of gambling. When the drifter gets into trouble, his new mentor must come to his aid.',
                  language: 'English',
                  country: 'USA',
                  imdbRating: '7.1',
                },
              ]

              // Render helper for recommendation cards - expandable with trailer
              const renderRecCard = (rec: AlreadySeenData, match?: string) => {
                const isExpanded = expandedRecTitle === rec.title
                const hasExpandedRec = expandedRecTitle !== null
                const isInQueue = upNextQueue.some(item => item.title === rec.title)

                return (
                  <div
                    key={rec.title}
                    className={`bg-white rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                      isInQueue
                        ? 'border-green-500 bg-green-50/30'
                        : isExpanded
                          ? 'border-accent-blue shadow-lg'
                          : hasExpandedRec
                            ? 'border-paper-300 opacity-60 hover:opacity-80'
                            : 'border-paper-300 hover:border-accent-blue'
                    }`}
                  >
                    {/* Collapsed Header - Click to expand */}
                    <button
                      onClick={() => {
                        if (!isExpanded) {
                          // Fetch trailer when expanding
                          fetchTrailerForRec(rec.title, rec.year)
                        }
                        setExpandedRecTitle(isExpanded ? null : rec.title)
                      }}
                      className="w-full p-4 text-left flex justify-between items-center hover:bg-paper-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-ink-800">{rec.title}</h3>
                          <span className="text-ink-500">({rec.year})</span>
                          {isInQueue && (
                            <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full font-medium">
                              ✓ In Queue
                            </span>
                          )}
                          {match && !isInQueue && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                              {match}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink-500">{rec.director}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Scores preview */}
                        {rec.rottenTomatoesScore && (
                          <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-bold">
                            🍅 {rec.rottenTomatoesScore}%
                          </span>
                        )}
                        <span className={`text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-paper-300 animate-fade-in">
                        {/* Trailer - fetched from YouTube API */}
                        <div className="bg-black">
                          {loadingTrailers.has(rec.title) ? (
                            <div className="w-full aspect-video flex items-center justify-center">
                              <div className="text-white flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                <span className="text-sm">Loading official trailer...</span>
                              </div>
                            </div>
                          ) : fetchedTrailers[rec.title] ? (
                            <iframe
                              src={fetchedTrailers[rec.title]}
                              title={`${rec.title} Official Trailer`}
                              className="w-full aspect-video"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <div className="w-full aspect-video flex items-center justify-center">
                              <span className="text-white/60 text-sm">Trailer not available</span>
                            </div>
                          )}
                        </div>

                        <div className="p-5 bg-gradient-to-b from-paper-100 to-white space-y-4">
                          {/* Critics Scores - Expandable Panels (matching Queue/MediaCard exactly) */}
                          {(rec.metacriticScore || rec.rottenTomatoesScore) && (
                            <div className="space-y-3">
                              {/* Metacritic */}
                              {rec.metacriticScore && (
                                <div className="border-2 border-accent-blue rounded-xl overflow-hidden">
                                  <div className="flex items-center justify-between p-4 bg-white">
                                    <div className="flex items-center gap-3">
                                      <span className="text-accent-blue font-bold">Metacritic</span>
                                      <span className="bg-accent-blue text-white font-bold px-3 py-1 rounded text-lg">
                                        {rec.metacriticScore}
                                      </span>
                                    </div>
                                    {rec.metacriticUrl && (
                                      <a
                                        href={rec.metacriticUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                                      >
                                        Open in New Tab <span>↗</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Rotten Tomatoes */}
                              {rec.rottenTomatoesScore && (
                                <div className="border-2 border-accent-blue rounded-xl overflow-hidden">
                                  <div className="flex items-center justify-between p-4 bg-white">
                                    <div className="flex items-center gap-3">
                                      <span className="text-accent-blue font-bold">Rotten Tomatoes</span>
                                      <span className="bg-accent-blue text-white font-bold px-3 py-1 rounded text-lg">
                                        🍅 {rec.rottenTomatoesScore}%
                                      </span>
                                    </div>
                                    {rec.rottenTomatoesUrl && (
                                      <a
                                        href={rec.rottenTomatoesUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                                      >
                                        Open in New Tab <span>↗</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Runtime & Basic Info */}
                          {rec.runtime && (
                            <div className="flex items-center gap-4 p-3 bg-paper-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-ink-400 uppercase">Runtime</span>
                                <span className="text-ink-700 font-medium">{Math.floor(rec.runtime / 60)}h {rec.runtime % 60}m</span>
                              </div>
                            </div>
                          )}

                          {/* Director */}
                          {rec.director && (
                            <div>
                              <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Director</div>
                              <TalentPill
                                name={rec.director}
                                preference={queueTalentPreferences[rec.director]}
                                onPreferenceChange={onQueueTalentPreferenceChange}
                              />
                            </div>
                          )}

                          {/* Cinematographer */}
                          {rec.cinematographer && (
                            <div>
                              <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Cinematographer</div>
                              <TalentPill
                                name={rec.cinematographer}
                                preference={queueTalentPreferences[rec.cinematographer]}
                                onPreferenceChange={onQueueTalentPreferenceChange}
                              />
                            </div>
                          )}

                          {/* Composer / Music */}
                          {rec.composer && (
                            <div>
                              <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Music</div>
                              <TalentPill
                                name={rec.composer}
                                preference={queueTalentPreferences[rec.composer]}
                                onPreferenceChange={onQueueTalentPreferenceChange}
                              />
                            </div>
                          )}

                          {/* Cast */}
                          {rec.starring && rec.starring.length > 0 && (
                            <div>
                              <div className="text-xs text-ink-400 uppercase tracking-wide mb-2">Cast</div>
                              <div className="flex flex-wrap gap-2">
                                {rec.starring.map((actor) => (
                                  <TalentPill
                                    key={actor}
                                    name={actor}
                                    preference={queueTalentPreferences[actor]}
                                    onPreferenceChange={onQueueTalentPreferenceChange}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* OMDB Rich Metadata - matching queue display exactly */}
                          {(rec.awards || rec.boxOffice || rec.rated || rec.plot) && (
                            <div className="space-y-3 p-4 bg-paper-50 rounded-xl border border-paper-200">
                              {/* Awards */}
                              {rec.awards && rec.awards !== 'N/A' && (
                                <div>
                                  <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Awards</div>
                                  <p className="text-ink-800 font-medium">{rec.awards}</p>
                                </div>
                              )}
                              {/* Box Office */}
                              {rec.boxOffice && rec.boxOffice !== 'N/A' && (
                                <div>
                                  <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Box Office</div>
                                  <p className="text-ink-800 font-bold text-lg">{rec.boxOffice}</p>
                                </div>
                              )}
                              {/* Rating, Runtime & Language */}
                              <div className="flex items-center gap-4 flex-wrap">
                                {rec.rated && rec.rated !== 'N/A' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-ink-400 uppercase">Rated</span>
                                    <span className="px-2 py-1 bg-ink-800 text-white rounded font-bold text-sm">{rec.rated}</span>
                                  </div>
                                )}
                                {rec.imdbRating && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-ink-400 uppercase">IMDb</span>
                                    <span className="px-2 py-1 bg-yellow-500 text-black rounded font-bold text-sm">{rec.imdbRating}/10</span>
                                  </div>
                                )}
                                {rec.language && rec.language !== 'N/A' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-ink-400 uppercase">Language</span>
                                    <span className="text-ink-700">{rec.language}</span>
                                  </div>
                                )}
                              </div>
                              {/* Plot */}
                              {rec.plot && rec.plot !== 'N/A' && (
                                <div>
                                  <div className="text-xs text-ink-400 uppercase tracking-wide mb-1">Plot</div>
                                  <p className="text-ink-600 text-sm leading-relaxed">{rec.plot}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-3 pt-3 border-t border-paper-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!isInQueue) {
                                  handleAddToQueue({
                                    title: rec.title,
                                    year: rec.year,
                                    mediaType: 'movie',
                                    director: rec.director,
                                    thumbnail: undefined,
                                    skipTabSwitch: true, // Stay on Recommendations
                                    // Pass ALL the rich metadata!
                                    cinematographer: rec.cinematographer,
                                    composer: rec.composer,
                                    starring: rec.starring,
                                    runtime: rec.runtime,
                                    metacriticScore: rec.metacriticScore,
                                    rottenTomatoesScore: rec.rottenTomatoesScore,
                                    metacriticUrl: rec.metacriticUrl,
                                    rottenTomatoesUrl: rec.rottenTomatoesUrl,
                                    trailerUrl: fetchedTrailers[rec.title] || rec.trailerUrl,
                                    // OMDB data
                                    rated: rec.rated,
                                    awards: rec.awards,
                                    boxOffice: rec.boxOffice,
                                    plot: rec.plot,
                                    language: rec.language,
                                    country: rec.country,
                                    imdbRating: rec.imdbRating,
                                  })
                                }
                              }}
                              disabled={isInQueue || justAddedToQueue.has(rec.title)}
                              className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all ${
                                isInQueue
                                  ? 'bg-green-600 text-white cursor-default'
                                  : justAddedToQueue.has(rec.title)
                                    ? 'bg-green-600 text-white'
                                    : 'bg-accent-blue text-white hover:bg-blue-700'
                              }`}
                            >
                              {isInQueue ? '✓ In Your Queue' : justAddedToQueue.has(rec.title) ? '✓ Added!' : '+ Add to Queue'}
                            </button>
                          </div>

                          {/* Secondary Actions */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAlreadySeen(rec)
                              }}
                              className="text-sm px-4 py-2 bg-accent-blue/10 text-accent-blue rounded-lg hover:bg-accent-blue/20 transition-colors font-medium"
                            >
                              Already seen it
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                dismissRec(rec.title, 'not_interested')
                                setExpandedRecTitle(null)
                              }}
                              className="text-sm px-4 py-2 bg-paper-200 text-ink-600 rounded-lg hover:bg-paper-300 transition-colors"
                            >
                              Not interested
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                dismissRec(rec.title, 'dont_like')
                                setExpandedRecTitle(null)
                              }}
                              className="text-sm px-4 py-2 bg-paper-200 text-ink-600 rounded-lg hover:bg-paper-300 transition-colors"
                            >
                              Not my type
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSoundtrackMovie({ title: rec.title, year: rec.year, composer: rec.composer })
                              }}
                              className="text-sm px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                              Soundtrack
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div className="space-y-4">
                  {/* Because you loved... */}
                  <div className="bg-white rounded-xl p-5 border-2 border-accent-blue">
                    <h4 className="font-bold text-accent-blue text-lg mb-1">Because you loved Paul Thomas Anderson</h4>
                    <p className="text-sm text-accent-blue mb-4">Directors with similar style and vision</p>
                    <div className="space-y-3">
                      {ptaRecs.filter(rec => !dismissedRecs.has(rec.title)).map(rec => renderRecCard(rec))}
                    </div>
                  </div>

                  {/* Trending with similar tastes */}
                  <div className="bg-white rounded-xl p-5 border-2 border-accent-blue">
                    <h4 className="font-bold text-accent-blue text-lg mb-1">Trending with Similar Tastes</h4>
                    <p className="text-sm text-accent-blue mb-4">Popular with people who rated like you</p>
                    <div className="space-y-3">
                      {trendingRecs.filter(rec => !dismissedRecs.has(rec.title)).map(rec => renderRecCard(rec, rec.match))}
                    </div>
                  </div>

                  {/* Complete the collection */}
                  <div className="bg-white rounded-xl p-5 border-2 border-accent-blue">
                    <h4 className="font-bold text-accent-blue text-lg mb-1">Complete the Collection</h4>
                    <p className="text-sm text-accent-blue mb-4">You've seen 3 of 9 PTA films</p>
                    <div className="space-y-3">
                      {ptaFilmography.filter(rec => !dismissedRecs.has(rec.title)).map(rec => renderRecCard(rec))}
                    </div>
                  </div>
                </div>
              )
            })()}
            </>
            )}
          </div>
        )}

        {/* MY PREFERENCES & DATA TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* AI Input for adding preferences - THE POWER OF AI */}
            <div className="bg-accent-blue/10 border-2 border-accent-blue rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-bold text-accent-blue mb-1">Tell Me About Yourself</h3>
                  <p className="text-ink-600 text-sm">
                    Share your preferences, moods, or anything that helps me understand your taste better.
                  </p>
                </div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); console.log('Preference Input:', prefsInput); setPrefsInput(''); }}>
                <textarea
                  value={prefsInput}
                  onChange={(e) => setPrefsInput(e.target.value)}
                  placeholder="I love slow-burn dramas, hate jump scares, prefer practical effects over CGI, always watch foreign films with subtitles..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-accent-blue bg-white text-ink-800 placeholder-ink-400 resize-none"
                  rows={3}
                />
                <div className="flex justify-between items-center mt-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "I love...",
                      "I hate...",
                      "My favorite genre is...",
                      "I usually watch with...",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setPrefsInput(prompt + ' ')}
                        className="text-xs px-3 py-1.5 bg-white border border-accent-blue text-accent-blue rounded-full hover:bg-accent-blue hover:text-white transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={!prefsInput.trim()}
                    className={`px-6 py-2 rounded-xl font-bold transition-colors ${
                      prefsInput.trim()
                        ? 'bg-accent-blue text-white hover:bg-blue-700'
                        : 'bg-paper-300 text-ink-400 cursor-not-allowed'
                    }`}
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>

            {/* Overview Stats - REAL DATA */}
            <div className="bg-white rounded-xl p-5 border-2 border-accent-blue">
              <h3 className="font-bold text-accent-blue mb-4">Your Stats</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-ink-800">{computedStats.totalLogged}</div>
                  <div className="text-sm text-ink-500">Logged</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    computedStats.averageRating >= 90 ? 'text-red-600' :
                    computedStats.averageRating >= 80 ? 'text-green-600' :
                    computedStats.averageRating >= 60 ? 'text-orange-600' :
                    'text-accent-blue'
                  }`}>{computedStats.averageRating}%</div>
                  <div className="text-sm text-ink-500">Avg Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-ink-800">{Object.keys(computedStats.byMediaType).length}</div>
                  <div className="text-sm text-ink-500">Categories</div>
                </div>
              </div>
            </div>

            {/* Your Top Rated - REAL DATA */}
            {computedStats.topRated.length > 0 && (
              <div className="bg-white rounded-xl p-5 border-2 border-accent-blue">
                <h3 className="font-bold text-accent-blue mb-4">Your Favorites</h3>
                <div className="space-y-3">
                  {computedStats.topRated.map((item, idx) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-accent-blue">#{idx + 1}</span>
                        <div>
                          <span className="text-ink-800 font-medium">{item.title}</span>
                          <span className="text-ink-500 text-sm ml-2">({item.year})</span>
                        </div>
                      </div>
                      <span className={`font-bold text-lg ${
                        (item.rating || 0) >= 90 ? 'text-red-600' :
                        (item.rating || 0) >= 80 ? 'text-green-600' :
                        (item.rating || 0) >= 60 ? 'text-orange-600' :
                        'text-accent-blue'
                      }`}>{item.rating}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Directors You Love - REAL DATA */}
            {computedStats.topDirectors.length > 0 && (
              <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                <h3 className="font-bold text-ink-800 mb-4">Directors You Watch</h3>
                <div className="space-y-3">
                  {computedStats.topDirectors.map((director) => (
                    <div key={director.name} className="flex justify-between items-center">
                      <span className="text-ink-800">{director.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-ink-500 text-sm">{director.count} {director.count === 1 ? 'film' : 'films'}</span>
                        {director.avgRating > 0 && (
                          <span className={`font-bold ${
                            director.avgRating >= 90 ? 'text-red-600' :
                            director.avgRating >= 80 ? 'text-green-600' :
                            director.avgRating >= 60 ? 'text-orange-600' :
                            'text-accent-blue'
                          }`}>{director.avgRating}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Media Type - REAL DATA */}
            <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
              <h3 className="font-bold text-ink-800 mb-4">By Media Type</h3>
              <div className="space-y-2">
                {Object.entries(computedStats.byMediaType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-ink-600 capitalize">
                      {type === 'movie' ? 'Movies' : type === 'tv' ? 'TV Shows' : type}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-paper-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-blue rounded-full"
                          style={{ width: `${(count / computedStats.totalLogged) * 100}%` }}
                        />
                      </div>
                      <span className="font-bold text-ink-800 w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Viewing Habits - REAL DATA */}
            <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
              <h3 className="font-bold text-ink-800 mb-4">Viewing Habits</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-paper-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-ink-800">{computedStats.soloCount}</div>
                  <div className="text-sm text-ink-500">Solo Watches</div>
                </div>
                <div className="bg-paper-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-ink-800">{computedStats.socialCount}</div>
                  <div className="text-sm text-ink-500">With Others</div>
                </div>
                <div className="bg-paper-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-ink-800">{computedStats.theaterCount}</div>
                  <div className="text-sm text-ink-500">In Theaters</div>
                </div>
                <div className="bg-paper-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-ink-800">{computedStats.homeCount}</div>
                  <div className="text-sm text-ink-500">At Home</div>
                </div>
              </div>
            </div>

            {/* Top Companions - REAL DATA */}
            {computedStats.topCompanions.length > 0 && (
              <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                <h3 className="font-bold text-ink-800 mb-4">Most Frequent Companions</h3>
                <div className="space-y-3">
                  {computedStats.topCompanions.map((companion, idx) => (
                    <div key={companion.name} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•'}</span>
                        <span className="text-ink-800">{companion.name}</span>
                      </div>
                      <span className="text-ink-500">{companion.count} {companion.count === 1 ? 'time' : 'times'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Talent Preferences - Combined from props and local state */}
            {(() => {
              // Merge talent preferences from props and alreadySeenTalentPrefs
              const allTalentPrefs = { ...talentPreferences, ...alreadySeenTalentPrefs }
              const lovedTalent = Object.entries(allTalentPrefs).filter(([_, pref]) => pref === 'loved')
              const notForMeTalent = Object.entries(allTalentPrefs).filter(([_, pref]) => pref === 'not-for-me')

              if (lovedTalent.length === 0 && notForMeTalent.length === 0) return null

              return (
                <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                  <h3 className="font-bold text-ink-800 mb-4">Your Talent Preferences</h3>

                  {lovedTalent.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-bold text-red-600 mb-2 flex items-center gap-1">
                        <span>♥</span> People You Love
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lovedTalent.map(([name]) => (
                          <span key={name} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium border border-red-200">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {notForMeTalent.length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-ink-500 mb-2">Not For You</div>
                      <div className="flex flex-wrap gap-2">
                        {notForMeTalent.map(([name]) => (
                          <span key={name} className="px-3 py-1 bg-paper-200 text-ink-500 rounded-full text-sm border border-paper-400">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Soundtrack Modal */}
      <SoundtrackModal
        isOpen={!!soundtrackMovie}
        onClose={() => setSoundtrackMovie(null)}
        movieTitle={soundtrackMovie?.title || ''}
        movieYear={soundtrackMovie?.year}
        composer={soundtrackMovie?.composer}
        onSaveTrack={handleSaveMusicTrack}
        onUnsaveTrack={handleUnsaveMusicTrack}
        savedTracks={savedMusicTracks}
      />
    </div>
  )
}
