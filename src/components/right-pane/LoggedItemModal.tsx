'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LoggedItem } from './RightPaneTabs'
import MediaCard from './MediaCard'
import CharacterGallery from '@/components/CharacterGallery'
import VoiceInput from '@/components/shared/VoiceInput'
import { getRatingColorClass } from '@/lib/ratingColors'

interface LoggedItemModalProps {
  isOpen: boolean
  onClose: () => void
  item: LoggedItem | null
  onDelete?: (id: number) => void
  onResumeDraft?: (item: LoggedItem) => void
  onUpdateItem?: (id: number, changes: Partial<LoggedItem>) => void
  // Talent preferences
  talentPreferences?: Record<string, 'loved' | 'not-for-me' | null>
  onTalentPreferenceChange?: (preferences: Record<string, 'loved' | 'not-for-me' | null>) => void
  // Soundtrack
  onSaveTrack?: (track: { title: string; artist: string; videoId: string; thumbnail: string; fromMovie: string; fromMovieYear?: number }) => void
  onUnsaveTrack?: (videoId: string) => void
  savedTracks?: Record<string, boolean>
  // Open soundtrack for a movie (used when clicking on movie name from music items)
  onOpenSoundtrack?: (movie: { title: string; year?: number }) => void
}

// Helper to sanitize context text
function sanitizeContext(text: string): string {
  if (!text) return ''
  return text
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, ' ')
    .trim()
    .slice(0, 150)
}

export default function LoggedItemModal({
  isOpen,
  onClose,
  item,
  onDelete,
  onResumeDraft,
  onUpdateItem,
  talentPreferences = {},
  onTalentPreferenceChange,
  onSaveTrack,
  onUnsaveTrack,
  savedTracks = {},
  onOpenSoundtrack,
}: LoggedItemModalProps) {
  const [analyzingItem, setAnalyzingItem] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savedNotesLocal, setSavedNotesLocal] = useState<string | null>(null)
  const [videoExpanded, setVideoExpanded] = useState(false)
  const [refreshingMetadata, setRefreshingMetadata] = useState(false)
  const [awardsTooltip, setAwardsTooltip] = useState<string | null>(null)
  const [loadingAwards, setLoadingAwards] = useState(false)

  // Hero carousel state
  const [heroVideos, setHeroVideos] = useState<Array<{ key: string; name: string; videoType: string; thumbnailUrl: string }>>([])
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroLoading, setHeroLoading] = useState(false)

  // Tracks which player is active (overlay hidden) so only one plays at a time
  const [activePlayer, setActivePlayer] = useState<'hero' | 'trailer' | 'gallery' | null>(null)

  // Pause all YouTube iframes on the page
  const pauseAllYouTubeIframes = () => {
    document.querySelectorAll('iframe[src*="youtube.com"]').forEach(iframe => {
      try {
        (iframe as HTMLIFrameElement).contentWindow?.postMessage(
          '{"event":"command","func":"pauseVideo","args":""}', '*'
        )
      } catch (e) { /* cross-origin errors are ok */ }
    })
  }

  // Activate a player: pause all iframes, then play the target one
  const activatePlayer = (player: 'hero' | 'trailer' | 'gallery', iframeId?: string) => {
    pauseAllYouTubeIframes()
    setActivePlayer(player)
    if (iframeId) {
      setTimeout(() => {
        const iframe = document.getElementById(iframeId) as HTMLIFrameElement
        iframe?.contentWindow?.postMessage(
          '{"event":"command","func":"playVideo","args":""}', '*'
        )
      }, 150)
    }
  }

  // Fetch TMDB videos for hero carousel
  useEffect(() => {
    if (!isOpen || !item || item.mediaType === 'music') return
    const fetchHeroVideos = async () => {
      setHeroLoading(true)
      try {
        const params = new URLSearchParams()
        if (item.tmdbId) {
          params.set('movieId', item.tmdbId.toString())
        } else {
          params.set('title', item.title)
          if (item.year) params.set('year', item.year.toString())
        }
        const response = await fetch(`/api/movie-images?${params}`)
        if (response.ok) {
          const data = await response.json()
          const allVideos = (data.images?.videos || []) as Array<{ key: string; name: string; videoType: string; thumbnailUrl: string }>
          // Default order: non-trailers first, then trailers/teasers
          const clips = allVideos.filter((v: any) => v.videoType !== 'Trailer' && v.videoType !== 'Teaser')
          const trailers = allVideos.filter((v: any) => v.videoType === 'Trailer' || v.videoType === 'Teaser')
          let orderedVideos = [...clips, ...trailers]

          // Check localStorage for pinned video — move it to front
          const storageKey = `hero_pinned_${item.title.toLowerCase().replace(/\s+/g, '_')}`
          const pinnedKey = localStorage.getItem(storageKey)
          if (pinnedKey) {
            const pinnedIdx = orderedVideos.findIndex((v: any) => v.key === pinnedKey)
            if (pinnedIdx > 0) {
              const [pinned] = orderedVideos.splice(pinnedIdx, 1)
              orderedVideos.unshift(pinned)
            }
          }

          setHeroVideos(orderedVideos)
          setHeroIndex(0)
        }
      } catch (err) {
        console.error('Failed to fetch hero videos:', err)
      }
      setHeroLoading(false)
    }
    fetchHeroVideos()
  }, [isOpen, item?.id, item?.title, item?.year, item?.tmdbId])

  // Reset state when item changes
  useEffect(() => {
    setAwardsTooltip(null)
    setLoadingAwards(false)
    setSavedNotesLocal(null)
    setVideoExpanded(false)
    setHeroIndex(0)
    setHeroVideos([])
    setActivePlayer(null)
  }, [item?.id])

  if (!isOpen || !item) return null
  if (typeof document === 'undefined') return null

  const isMusic = item.mediaType === 'music'

  // Handle AI analysis
  const handleAnalyze = async () => {
    if (!item.notes || item.notes.trim().length < 10) return

    setAnalyzingItem(true)
    try {
      const castNames = item.cast?.map((c: any) => c.name || c) || []
      const crewList = [
        item.director && { name: item.director, job: 'Director' },
        item.cinematographer && { name: item.cinematographer, job: 'Cinematographer' },
        item.composer && { name: item.composer, job: 'Composer' },
      ].filter(Boolean)

      const response = await fetch('/api/extract-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: item.notes,
          title: item.title,
          year: item.year,
          mediaType: item.mediaType,
          cast: castNames,
          crew: crewList,
          score: item.rating,
        }),
      })

      if (response.ok) {
        const extracted = await response.json()
        onUpdateItem?.(item.id, {
          extractedEntities: extracted.entities || [],
          extractedThemes: extracted.themes || [],
          overallSentiment: extracted.overall_sentiment,
        })
      }
    } catch (err) {
      console.error('Analysis failed:', err)
    }
    setAnalyzingItem(false)
  }

  // Start editing notes
  const startEditingNotes = () => {
    setNotesValue(savedNotesLocal ?? item.notes ?? '')
    setEditingNotes(true)
  }

  // Save notes
  const saveNotes = () => {
    onUpdateItem?.(item.id, { notes: notesValue })
    setSavedNotesLocal(notesValue)
    setEditingNotes(false)
  }

  // Cancel editing
  const cancelEditingNotes = () => {
    setEditingNotes(false)
    setNotesValue('')
  }

  // Refresh metadata - scrapes IMDB directly for fresh ratings/box office/awards
  // Does NOT touch: your rating, notes, cast, crew, poster, video, entities, themes
  const handleRefreshMetadata = async () => {
    if (!item.title || refreshingMetadata) return

    setRefreshingMetadata(true)
    const updates: Partial<LoggedItem> = {}

    try {
      // First, try to get fresh data from IMDB directly (most accurate)
      // Try multiple sources for IMDB ID
      const imdbId = item.imdbUrl?.match(/tt\d+/)?.[0] || (item as any).imdbId || (item as any).imdb_id
      console.log('Looking for IMDB ID:', { imdbUrl: item.imdbUrl, imdbId, itemKeys: Object.keys(item) })

      if (imdbId) {
        console.log('Fetching fresh data from IMDB:', imdbId)
        const imdbResponse = await fetch(`/api/imdb-refresh?imdbId=${imdbId}`)
        console.log('IMDB response status:', imdbResponse.status)
        if (imdbResponse.ok) {
          const imdbData = await imdbResponse.json()
          console.log('IMDB fresh data received:', imdbData)

          // Update with fresh IMDB data
          if (imdbData.imdbRating) {
            updates.imdbRating = imdbData.imdbRating
            console.log('Setting imdbRating to:', imdbData.imdbRating)
          }
          if (imdbData.boxOffice) {
            updates.boxOffice = imdbData.boxOffice
            console.log('Setting boxOffice to:', imdbData.boxOffice)
          }
          if (imdbData.awards) {
            updates.awards = imdbData.awards
            console.log('Setting awards to:', imdbData.awards)
          }
        }
      } else {
        console.log('No IMDB ID found on item - will try to get one from movie-details')
      }

      // Scrape Metacritic directly for fresh score
      console.log('Fetching fresh Metacritic score...')
      const mcParams = new URLSearchParams({
        title: item.title,
        ...(item.year && { year: item.year.toString() }),
      })
      const mcResponse = await fetch(`/api/metacritic-refresh?${mcParams}`)
      if (mcResponse.ok) {
        const mcData = await mcResponse.json()
        console.log('Metacritic fresh data:', mcData)
        if (mcData.metacriticScore) {
          updates.metacriticScore = mcData.metacriticScore
          if (mcData.url) updates.metacriticUrl = mcData.url
        }
      }

      // Scrape Rotten Tomatoes directly for fresh score
      console.log('Fetching fresh Rotten Tomatoes score...')
      const rtParams = new URLSearchParams({
        title: item.title,
        ...(item.year && { year: item.year.toString() }),
      })
      const rtResponse = await fetch(`/api/rt-refresh?${rtParams}`)
      if (rtResponse.ok) {
        const rtData = await rtResponse.json()
        console.log('Rotten Tomatoes fresh data:', rtData)
        if (rtData.rottenTomatoesScore) {
          updates.rottenTomatoesScore = rtData.rottenTomatoesScore
          if (rtData.url) updates.rottenTomatoesUrl = rtData.url
        }
      }

      // Also fetch from movie-details API for other metadata (plot, rated, URLs if we don't have them)
      const params = new URLSearchParams({
        title: item.title,
        ...(item.year && { year: item.year.toString() }),
        mediaType: item.mediaType || 'movie',
      })

      const response = await fetch(`/api/movie-details?${params}`)
      if (response.ok) {
        const freshData = await response.json()
        console.log('movie-details response:', freshData)

        // Only use movie-details for things we don't scrape directly
        if (freshData.rated) updates.rated = freshData.rated

        // Only update plot if we don't have one OR the new one is longer
        if (freshData.plot && (!item.plot || freshData.plot.length > item.plot.length)) {
          updates.plot = freshData.plot
        }

        // URLs for the score links (only if we don't have them from scrapers)
        if (freshData.imdbUrl && !updates.imdbUrl) updates.imdbUrl = freshData.imdbUrl
        if (freshData.metacriticUrl && !updates.metacriticUrl) updates.metacriticUrl = freshData.metacriticUrl
        if (freshData.rottenTomatoesUrl && !updates.rottenTomatoesUrl) updates.rottenTomatoesUrl = freshData.rottenTomatoesUrl

        // If we didn't have an IMDB ID but movie-details gave us an IMDB URL,
        // try to fetch fresh IMDB data now
        if (!imdbId && freshData.imdbUrl) {
          const newImdbId = freshData.imdbUrl.match(/tt\d+/)?.[0]
          if (newImdbId) {
            console.log('Got IMDB ID from movie-details, fetching fresh data:', newImdbId)
            const imdbResponse = await fetch(`/api/imdb-refresh?imdbId=${newImdbId}`)
            if (imdbResponse.ok) {
              const imdbData = await imdbResponse.json()
              console.log('IMDB fresh data (from movie-details IMDB URL):', imdbData)
              if (imdbData.imdbRating) updates.imdbRating = imdbData.imdbRating
              if (imdbData.boxOffice) updates.boxOffice = imdbData.boxOffice
              if (imdbData.awards) updates.awards = imdbData.awards
            }
          }
        }
      }

      console.log('Final updates to apply:', updates)
      console.log('onUpdateItem available:', !!onUpdateItem)

      if (Object.keys(updates).length > 0) {
        console.log('Calling onUpdateItem with id:', item.id, 'updates:', updates)
        onUpdateItem?.(item.id, updates)
        console.log('onUpdateItem called successfully')
      } else {
        console.log('No updates to apply')
      }
    } catch (err) {
      console.error('Failed to refresh metadata:', err)
    }
    setRefreshingMetadata(false)
  }

  // Fetch detailed awards from IMDB
  const fetchAwardsDetails = async () => {
    console.log('fetchAwardsDetails called', { imdbUrl: item.imdbUrl, loadingAwards, awardsTooltip })
    if (!item.imdbUrl || loadingAwards || awardsTooltip) return

    setLoadingAwards(true)
    try {
      const url = `/api/imdb-awards?url=${encodeURIComponent(item.imdbUrl)}`
      console.log('Fetching awards from:', url)
      const response = await fetch(url)
      console.log('Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('Awards data:', data)
        setAwardsTooltip(data.summary || item.awards || 'No details available')
      } else {
        console.log('Response not ok:', response.status)
        setAwardsTooltip(item.awards || 'Unable to load details')
      }
    } catch (err) {
      console.error('Awards fetch error:', err)
      setAwardsTooltip(item.awards || 'Unable to load details')
    }
    setLoadingAwards(false)
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85"
        onClick={onClose}
      />

      {/* Modal - Large */}
      <div
        className="relative flex flex-col overflow-hidden bg-white rounded-2xl shadow-2xl"
        style={{
          width: '76vw',
          height: '95vh',
          maxWidth: '1280px',
          maxHeight: '1200px',
        }}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-paper-200 bg-gradient-to-r from-accent-blue/10 to-accent-navy/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {isMusic ? '🎵' : item.mediaType === 'tv' ? '📺' : '🎬'}
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink-800">{item.title}</h2>
              <p className="text-sm text-ink-500">
                {isMusic
                  ? item.director
                  : <>{item.year} {item.director && `• Directed by ${item.director}`}</>
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {item.rating && (
              <div className="flex flex-col items-center">
                <span className="text-xs text-accent-blue uppercase tracking-wide font-bold">My Score</span>
                <span className={`text-3xl font-bold ${getRatingColorClass(item.rating)}`}>
                  {item.rating}%
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-paper-200 rounded-full transition-colors"
            >
              <span className="text-2xl">✕</span>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* MUSIC ITEMS */}
          {isMusic ? (
            <div className="p-6 space-y-6">
              {/* Video Player - same size and style as film modal */}
              {item.videoId && (
                <div className="flex gap-4 items-start justify-center mx-auto">
                  <div className={`${videoExpanded ? 'w-full' : 'w-[65%]'} flex-shrink-0 relative transition-all duration-300`}>
                    <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                      <iframe
                        src={`https://www.youtube.com/embed/${item.videoId}?autoplay=0&rel=0&enablejsapi=1`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    {/* Expand/Collapse button */}
                    <button
                      onClick={() => setVideoExpanded(!videoExpanded)}
                      className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-all"
                      title={videoExpanded ? "Collapse video" : "Expand video"}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {videoExpanded ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        )}
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Song Details - below video */}
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="bg-white rounded-xl p-6 border-2 border-accent-blue">
                  <h3 className="font-bold text-accent-blue text-lg mb-5 uppercase tracking-wide">Song Details</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-accent-blue font-bold uppercase tracking-wide text-sm">Title</span>
                      <span className="font-bold text-ink-900 text-lg">{item.title}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-accent-blue font-bold uppercase tracking-wide text-sm">Artist</span>
                      <span className="font-bold text-ink-900 text-lg">{item.director}</span>
                    </div>
                    {(item.fromMovies?.length || item.fromMovie || item.description) && (() => {
                      // Get all sources (fromMovies array, or fallback to legacy single source)
                      const sources = item.fromMovies?.length
                        ? item.fromMovies
                        : item.fromMovie
                          ? [{ title: item.fromMovie, year: item.fromMovieYear }]
                          : item.description
                            ? [{ title: item.description.replace(/^From the\s+/, '').replace(/\s+soundtrack$/, ''), year: undefined }]
                            : []

                      if (sources.length === 0) return null

                      return (
                        <div className="flex justify-between items-start">
                          <span className="text-accent-blue font-bold uppercase tracking-wide text-sm">
                            {sources.length > 1 ? 'Sources' : 'Source'}
                          </span>
                          <div className={sources.length > 1 ? 'text-right space-y-1' : 'text-right'}>
                            {sources.map((source) => (
                              <div key={source.title}>
                                <span className="text-ink-500">From the </span>
                                <button
                                  onClick={() => {
                                    if (onOpenSoundtrack) {
                                      onClose()
                                      onOpenSoundtrack({ title: source.title, year: source.year })
                                    }
                                  }}
                                  className="text-accent-blue font-bold italic hover:underline"
                                >
                                  {source.title}
                                </button>
                                <span className="text-ink-500"> soundtrack</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                    {item.dateConsumed && (
                      <div className="flex justify-between items-center">
                        <span className="text-accent-blue font-bold uppercase tracking-wide text-sm">Added</span>
                        <span className="font-bold text-ink-900">{item.dateConsumed}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes with Voice */}
                <div className="bg-white rounded-xl p-6 border-2 border-accent-blue">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-accent-blue text-lg uppercase tracking-wide">Your Notes</h3>
                    {!editingNotes && (
                      <button
                        onClick={startEditingNotes}
                        className="text-sm px-3 py-1.5 bg-accent-blue text-white rounded-lg hover:bg-accent-navy transition-colors font-bold"
                      >
                        {(savedNotesLocal ?? item.notes) ? '✏️ Add/Edit Notes' : '+ Add Notes'}
                      </button>
                    )}
                  </div>

                  {editingNotes ? (
                    <div className="space-y-3">
                      <VoiceInput
                        value={notesValue}
                        onChange={setNotesValue}
                        placeholder="Share your thoughts... (click 🎤 for voice)"
                        multiline
                        className="min-h-[120px]"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEditingNotes}
                          className="px-3 py-1.5 text-sm text-ink-800 hover:bg-paper-200 rounded-lg transition-colors font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveNotes}
                          className="px-3 py-1.5 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-navy transition-colors font-bold"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (savedNotesLocal ?? item.notes) ? (
                    <p className="text-ink-900 whitespace-pre-wrap">{savedNotesLocal ?? item.notes}</p>
                  ) : (
                    <p className="text-ink-800 italic">No notes yet</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* MOVIE/TV ITEMS */
            <div className="p-6 space-y-6">
              {/* Hero Section: Video Carousel | Poster (top row) */}
              <div className="flex gap-4 items-start justify-center mx-auto">
                {/* Video - carousel of clips when available, fallback to trailer */}
                {(() => {
                  const hasClips = heroVideos.length > 0
                  const currentClip = hasClips ? heroVideos[heroIndex] : null
                  const fallbackVideoId = item.videoId || item.trailerVideoId
                  const showVideo = hasClips || fallbackVideoId

                  if (!showVideo) return null

                  return (
                    <div className={`${videoExpanded ? 'w-full' : 'w-[65%]'} flex-shrink-0 relative transition-all duration-300 group/carousel`}>
                      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative">
                        <iframe
                          id="hero-player"
                          key={hasClips ? currentClip!.key : fallbackVideoId}
                          src={`https://www.youtube.com/embed/${hasClips ? currentClip!.key : fallbackVideoId}?autoplay=0&rel=0&enablejsapi=1`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                        {/* Click-capture overlay: intercepts first click to pause other players */}
                        {activePlayer !== 'hero' && (
                          <div
                            className="absolute inset-0 z-[1] cursor-pointer"
                            onClick={() => activatePlayer('hero', 'hero-player')}
                          />
                        )}
                      </div>

                      {/* Carousel controls - only when clips available */}
                      {hasClips && (
                        <>
                          {/* Left arrow */}
                          <button
                            onClick={() => { pauseAllYouTubeIframes(); setActivePlayer(null); setHeroIndex(Math.max(0, heroIndex - 1)); }}
                            disabled={heroIndex === 0}
                            className={`absolute -left-2 top-1/2 -translate-y-1/2 w-10 h-16 rounded-lg flex items-center justify-center text-3xl font-bold transition-all opacity-0 group-hover/carousel:opacity-100 ${
                              heroIndex === 0
                                ? 'bg-black/20 text-white/30 cursor-not-allowed'
                                : 'bg-black/50 text-white hover:bg-black/70'
                            }`}
                          >
                            ‹
                          </button>

                          {/* Right arrow */}
                          <button
                            onClick={() => { pauseAllYouTubeIframes(); setActivePlayer(null); setHeroIndex(Math.min(heroVideos.length - 1, heroIndex + 1)); }}
                            disabled={heroIndex === heroVideos.length - 1}
                            className={`absolute -right-2 top-1/2 -translate-y-1/2 w-10 h-16 rounded-lg flex items-center justify-center text-3xl font-bold transition-all opacity-0 group-hover/carousel:opacity-100 ${
                              heroIndex === heroVideos.length - 1
                                ? 'bg-black/20 text-white/30 cursor-not-allowed'
                                : 'bg-black/50 text-white hover:bg-black/70'
                            }`}
                          >
                            ›
                          </button>

                          {/* Counter + video name */}
                          <div className="absolute bottom-2 left-2 flex items-center gap-2 opacity-0 group-hover/carousel:opacity-100 transition-all">
                            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full font-medium">
                              {heroIndex + 1} / {heroVideos.length}
                            </span>
                            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded max-w-[250px] truncate">
                              {currentClip!.name}
                            </span>
                          </div>
                        </>
                      )}

                      {/* Expand/Collapse button */}
                      <button
                        onClick={() => setVideoExpanded(!videoExpanded)}
                        className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-all"
                        title={videoExpanded ? "Collapse video" : "Expand video"}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {videoExpanded ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          )}
                        </svg>
                      </button>
                    </div>
                  )
                })()}

                {/* Poster - hidden when video is expanded */}
                {item.poster && !videoExpanded && (
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full max-w-[300px] aspect-[2/3] object-cover rounded-xl shadow-2xl flex-shrink-0"
                  />
                )}
              </div>

              {/* Metadata Row - below video and poster */}
              <div className="flex items-center justify-center gap-8 flex-wrap">
                {/* Genres */}
                {item.genres && item.genres.length > 0 && (
                  <span className="text-base font-medium text-ink-700">{item.genres.slice(0, 3).join(' • ')}</span>
                )}

                {/* Runtime & Rating */}
                {item.runtime && (
                  <span className="text-base text-ink-600">{item.runtime} min • {item.rated || 'NR'}</span>
                )}

                {/* Metacritic */}
                {item.metacriticScore && (
                  <a href={item.metacriticUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent-blue/15 hover:scale-105 transition-all">
                    <span className={`text-lg font-bold ${getRatingColorClass(item.metacriticScore)}`}>{item.metacriticScore}</span>
                    <span className="text-base font-medium text-ink-800">Metacritic</span>
                  </a>
                )}

                {/* Rotten Tomatoes */}
                {item.rottenTomatoesScore && (
                  <a href={item.rottenTomatoesUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent-blue/15 hover:scale-105 transition-all">
                    <span className="text-xl">{item.rottenTomatoesScore >= 60 ? '🍅' : '🤢'}</span>
                    <span className={`text-base font-bold ${getRatingColorClass(item.rottenTomatoesScore)}`}>{item.rottenTomatoesScore}%</span>
                  </a>
                )}

                {/* IMDB */}
                {item.imdbRating && (
                  <a href={item.imdbUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent-blue/15 hover:scale-105 transition-all">
                    <span className="text-xl">⭐</span>
                    <span className={`text-base font-bold ${getRatingColorClass(parseFloat(item.imdbRating) * 10)}`}>{item.imdbRating}</span>
                    <span className="text-base font-medium text-ink-800">IMDB</span>
                  </a>
                )}

                {/* Awards with tooltip */}
                {item.awards && (
                  <div className="relative group">
                    <a
                      href={item.imdbUrl ? `${item.imdbUrl}/awards` : '#'}
                      target={item.imdbUrl ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent-blue/15 hover:scale-105 transition-all cursor-pointer"
                      onMouseEnter={fetchAwardsDetails}
                      onClick={(e) => !item.imdbUrl && e.preventDefault()}
                    >
                      <span className="text-xl">🏆</span>
                      <span className="text-base font-medium text-amber-600">{item.awards}</span>
                    </a>
                    {/* Tooltip - always show on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-5 py-4 bg-ink-800 text-white text-sm rounded-xl shadow-2xl whitespace-pre-wrap min-w-[320px] max-w-md z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {loadingAwards
                        ? 'Loading awards...'
                        : awardsTooltip
                          ? awardsTooltip
                          : item.imdbUrl
                            ? 'Hover to load award details...'
                            : 'No IMDB link available'}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-ink-800" />
                    </div>
                  </div>
                )}
              </div>


              {/* MediaCard - Full featured with crew, cast, soundtracks */}
              <MediaCard
                entryNumber={1}
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
                // Show trailer in MediaCard only when hero has clips (avoids duplication)
                poster={item.poster}
                videoId={heroVideos.length > 0
                  ? (item.trailerVideoId || heroVideos.find(v => v.videoType === 'Trailer')?.key || heroVideos.find(v => v.videoType === 'Teaser')?.key)
                  : undefined}
                trailerUrl={heroVideos.length > 0 ? item.trailerUrl : undefined}
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
                onSaveTrack={onSaveTrack}
                onUnsaveTrack={onUnsaveTrack}
                savedTracks={savedTracks}
                // Refresh metadata
                onRefreshMetadata={!isMusic ? handleRefreshMetadata : undefined}
                refreshingMetadata={refreshingMetadata}
                // Awards tooltip
                awardsTooltip={awardsTooltip}
                loadingAwards={loadingAwards}
                onAwardsHover={fetchAwardsDetails}
                // Video pause coordination
                showTrailerOverlay={activePlayer !== 'trailer'}
                onTrailerClick={() => activatePlayer('trailer', 'trailer-player')}
                // Edit handler
                onEdit={(changes) => {
                  const translatedChanges = { ...changes }
                  if ('dateWatched' in translatedChanges) {
                    (translatedChanges as any).dateConsumed = translatedChanges.dateWatched
                    delete translatedChanges.dateWatched
                  }
                  onUpdateItem?.(item.id, translatedChanges)
                }}
              />

              {/* Character Gallery - Scenes, Cast Photos, Videos */}
              {(item.mediaType === 'movie' || item.mediaType === 'tv') && (item.tmdbId || item.title) && (
                <CharacterGallery
                  movieTitle={item.title}
                  movieYear={item.year}
                  movieId={item.tmdbId?.toString()}
                  onVideoPlay={() => setActivePlayer('gallery')}
                />
              )}

              {/* Your Notes Section with Voice Input */}
              <div className="bg-gradient-to-br from-accent-blue/5 to-accent-navy/5 rounded-xl p-6 border border-accent-blue/20">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-ink-800 flex items-center gap-2 text-lg">
                    <span>📝</span> Your Notes
                  </h4>
                  {!editingNotes && (
                    <button
                      onClick={startEditingNotes}
                      className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-navy transition-colors font-medium"
                    >
                      {item.notes ? '✏️ Edit Notes' : '+ Add Notes'}
                    </button>
                  )}
                </div>

                {editingNotes ? (
                  <div className="space-y-4">
                    <VoiceInput
                      value={notesValue}
                      onChange={setNotesValue}
                      placeholder="Share your thoughts... (click 🎤 for voice input)"
                      multiline
                      className="min-h-[150px]"
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={cancelEditingNotes}
                        className="px-4 py-2 text-ink-600 hover:bg-paper-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveNotes}
                        className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-navy transition-colors font-medium"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                ) : (savedNotesLocal ?? item.notes) ? (
                  <p className="text-ink-700 whitespace-pre-wrap leading-relaxed">{savedNotesLocal ?? item.notes}</p>
                ) : (
                  <p className="text-ink-400 italic">No notes yet. Click "Add Notes" to share your thoughts about this film.</p>
                )}
              </div>

              {/* AI Analysis Section */}
              {(savedNotesLocal ?? item.notes) && (savedNotesLocal ?? item.notes)!.trim().length >= 10 && (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-5 border border-purple-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-purple-800 flex items-center gap-2">
                      <span>🧠</span> AI Analysis
                    </h4>
                    <button
                      disabled={analyzingItem}
                      onClick={handleAnalyze}
                      className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                        analyzingItem
                          ? 'bg-purple-400 text-white cursor-wait'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {analyzingItem ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Analyzing...
                        </span>
                      ) : item.extractedEntities ? '🔄 Reanalyze' : '🔍 Analyze Notes'}
                    </button>
                  </div>

                  {/* Show analysis results */}
                  {item.extractedEntities && item.extractedEntities.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">People Mentioned</div>
                      <div className="space-y-2">
                        {item.extractedEntities.map((entity, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              entity.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                              entity.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                              entity.sentiment === 'mixed' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {entity.sentiment === 'positive' ? '👍' : entity.sentiment === 'negative' ? '👎' : '➖'}
                            </span>
                            <div className="flex-1">
                              <span className="font-medium text-purple-900">{entity.resolved}</span>
                              <span className="text-purple-500 text-xs ml-1">({entity.type})</span>
                              {entity.context && (
                                <p className="text-purple-600 text-xs italic mt-1">"{sanitizeContext(entity.context)}"</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Themes */}
                  {item.extractedThemes && item.extractedThemes.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">Themes</div>
                      <div className="flex flex-wrap gap-2">
                        {item.extractedThemes.map((theme, idx) => (
                          <span key={idx} className="px-3 py-1.5 bg-white rounded-full text-sm text-purple-700 border border-purple-200 capitalize">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Overall Sentiment */}
                  {item.overallSentiment && (
                    <div className="pt-3 border-t border-purple-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-purple-600">Overall:</span>
                        <span className={`text-sm font-bold px-3 py-1 rounded ${
                          item.overallSentiment === 'positive' ? 'bg-green-100 text-green-700' :
                          item.overallSentiment === 'negative' ? 'bg-red-100 text-red-700' :
                          item.overallSentiment === 'mixed' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.overallSentiment === 'positive' ? '😊 Positive' :
                           item.overallSentiment === 'negative' ? '😕 Negative' :
                           item.overallSentiment === 'mixed' ? '🤔 Mixed' : '😐 Neutral'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Prompt to analyze if not yet done */}
                  {!item.extractedEntities && (
                    <p className="text-sm text-purple-600 italic">
                      Click "Analyze Notes" to extract people mentioned and themes from your notes.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-paper-200 bg-paper-50">
          <div className="flex gap-3">
            {item.isDraft && onResumeDraft && (
              <button
                onClick={() => {
                  onResumeDraft(item)
                  onClose()
                }}
                className="px-5 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-navy transition-colors font-medium"
              >
                Resume Draft
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm(`Remove "${item.title}" from My Stuff?`)) {
                    onDelete(item.id)
                    onClose()
                  }
                }}
                className="px-5 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 bg-paper-200 hover:bg-paper-300 rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
