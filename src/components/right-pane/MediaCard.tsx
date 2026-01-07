'use client'

import { useState, useEffect } from 'react'
import SoundtrackModal from './SoundtrackModal'
import NotesModal from './NotesModal'
import DatePicker from '../DatePicker'
import { getRatingColorClass } from '@/lib/ratingColors'

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

interface EditableFields {
  title?: string
  year?: number
  director?: string
  cinematographer?: string
  composer?: string
  starring?: string[]
  distributor?: string
  runtime?: number
  dateWatched?: string
  location?: string
  locationDetail?: string
  firstTime?: boolean
  socialContext?: string
  companionNames?: string
  rating?: number
  notes?: string
}

// Export the preference type so parent can use it
export type { TalentPreference }

interface TalentPreferenceData {
  [name: string]: TalentPreference
}

interface MediaCardProps {
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
  metacriticData?: MetacriticData
  rottenTomatoesData?: RottenTomatoesData
  streamingOptions?: StreamingOption[]
  isBuilding?: boolean
  onEdit?: (changes: EditableFields) => void
  onTalentPreferenceChange?: (preferences: TalentPreferenceData) => void
  initialTalentPreferences?: TalentPreferenceData
  // Video/URL content
  videoId?: string
  poster?: string
  sourceUrl?: string
  // Rich metadata
  imdbRating?: string
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
  // Soundtrack
  onSaveTrack?: (track: { title: string; artist: string; videoId: string; thumbnail: string; fromMovie: string }) => void
  onUnsaveTrack?: (videoId: string) => void
  savedTracks?: Record<string, boolean>
  // Refresh metadata
  onRefreshMetadata?: () => void
  refreshingMetadata?: boolean
  // Awards tooltip
  awardsTooltip?: string | null
  loadingAwards?: boolean
  onAwardsHover?: () => void
}

// Talent preference types
type TalentPreference = 'loved' | 'not-for-me' | null
type TalentRole = 'director' | 'actor' | 'cinematographer' | 'composer' | 'writer' | 'producer' | 'musician' | 'band'

interface TalentPillProps {
  name: string
  role: TalentRole
  onPreferenceChange?: (name: string, preference: TalentPreference, role: TalentRole) => void
  preference?: TalentPreference
}

// Interactive pill component for people/entities with preference tracking
function TalentPill({ name, role, onPreferenceChange, preference }: TalentPillProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleSelect = (pref: TalentPreference) => {
    if (onPreferenceChange) {
      onPreferenceChange(name, pref, role)
    }
    setShowMenu(false)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowMenu(!showMenu)}
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
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border-2 border-accent-blue overflow-hidden min-w-[140px]">
            <button
              onClick={() => handleSelect(preference === 'loved' ? null : 'loved')}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-paper-100 flex items-center gap-2 ${preference === 'loved' ? 'bg-pink-50 text-pink-700' : ''}`}
            >
              <span>♥</span> Love
            </button>
            <button
              onClick={() => handleSelect(preference === 'not-for-me' ? null : 'not-for-me')}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-paper-100 flex items-center gap-2 ${preference === 'not-for-me' ? 'bg-paper-200' : ''}`}
            >
              <span>○</span> Don't love
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

// Simple pill for non-interactive items (companions, etc.)
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 bg-accent-blue/10 text-accent-blue border border-accent-blue rounded-full text-sm font-medium">
      {children}
    </span>
  )
}

export default function MediaCard({
  entryNumber,
  mediaType,
  title,
  year,
  dateWatched,
  director,
  cinematographer,
  composer,
  starring,
  cast,
  distributor,
  runtime,
  rating,
  location,
  locationDetail,
  firstTime,
  socialContext,
  companionNames,
  notes,
  metacriticScore,
  rottenTomatoesScore,
  trailerUrl,
  metacriticUrl,
  rottenTomatoesUrl,
  metacriticData,
  rottenTomatoesData,
  streamingOptions,
  isBuilding = true,
  onEdit,
  onTalentPreferenceChange,
  initialTalentPreferences = {},
  videoId,
  poster,
  sourceUrl,
  imdbRating,
  imdbUrl,
  rated,
  awards,
  boxOffice,
  plot,
  overview,
  country,
  language,
  genres,
  tmdbRating,
  onSaveTrack,
  onUnsaveTrack,
  savedTracks = {},
  onRefreshMetadata,
  refreshingMetadata,
  awardsTooltip,
  loadingAwards,
  onAwardsHover,
}: MediaCardProps) {
  const [showTrailer, setShowTrailer] = useState(false)
  const [showSoundtrack, setShowSoundtrack] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState<'metacritic' | 'rt' | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<EditableFields>({})
  const [talentPreferences, setTalentPreferences] = useState<Record<string, TalentPreference | { preference: TalentPreference; role: TalentRole }>>(initialTalentPreferences)

  // Sync talentPreferences when initialTalentPreferences prop changes
  useEffect(() => {
    setTalentPreferences(initialTalentPreferences)
  }, [initialTalentPreferences])

  // Helper to get just the preference value (handles both old and new format)
  const getPreference = (name: string): TalentPreference => {
    const entry = talentPreferences[name]
    if (!entry) return null
    if (typeof entry === 'object' && 'preference' in entry) return entry.preference
    return entry as TalentPreference
  }

  const handleTalentPreference = (name: string, preference: TalentPreference, role: TalentRole) => {
    const newPreferences = {
      ...talentPreferences,
      [name]: preference ? { preference, role } : null
    }
    setTalentPreferences(newPreferences)

    // Notify parent of preference change
    if (onTalentPreferenceChange) {
      onTalentPreferenceChange(newPreferences as any)
    }

    console.log('Talent preference updated:', { name, preference, role, allPreferences: newPreferences })
  }

  // Initialize edit data when entering edit mode
  const startEditing = () => {
    setEditData({
      title,
      year,
      director,
      cinematographer,
      composer,
      starring,
      distributor,
      runtime,
      dateWatched,
      location,
      locationDetail,
      firstTime,
      socialContext,
      companionNames,
      rating,
      notes,
    })
    setIsEditing(true)
  }

  const saveEdits = () => {
    if (onEdit) {
      onEdit(editData)
    }
    setIsEditing(false)
  }

  const cancelEdits = () => {
    setEditData({})
    setIsEditing(false)
  }

  // Convert rating to stars (0-5)
  const getStars = (rating: number) => {
    const stars = rating / 20
    const fullStars = Math.floor(stars)
    const hasPartial = stars - fullStars > 0

    let result = ''
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        result += '★'
      } else if (i === fullStars && hasPartial) {
        result += '★'
      } else {
        result += '☆'
      }
    }
    return result
  }

  const formatRuntime = (mins: number) => {
    const hours = Math.floor(mins / 60)
    const minutes = mins % 60
    return `${hours}h ${minutes}m`
  }

  const mediaTypeLabels: Record<string, string> = {
    movie: 'MOVIE',
    tv: 'TV SHOW',
    book: 'BOOK',
    audiobook: 'AUDIOBOOK',
    music: 'ALBUM',
    podcast: 'PODCAST',
    article: 'ARTICLE',
  }

  const isMovie = mediaType === 'movie'
  const isTV = mediaType === 'tv'

  // Extract YouTube video ID from URL
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)
    return match ? match[1] : null
  }

  const youtubeId = trailerUrl ? getYouTubeId(trailerUrl) : null

  return (
    <div className="paper-card rounded-2xl w-full overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIDEO EMBED (for YouTube/video content) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {videoId && (
        <div className="bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
            title={title}
            className="w-full aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Source URL link - removed as redundant when video is embedded */}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FILM INFO SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-paper-50 p-8 border-b-4 border-accent-blue">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <span className="bg-accent-blue text-white px-3 py-1 rounded-full text-sm font-bold tracking-wide">
              {mediaTypeLabels[mediaType] || 'MEDIA'}
            </span>
            <span className="text-accent-blue font-mono font-bold">#{entryNumber}</span>
          </div>
          {isBuilding && !isEditing && (
            <button
              onClick={startEditing}
              className="text-accent-blue hover:underline font-bold text-sm"
            >
              Edit
            </button>
          )}
          {isEditing && (
            <div className="flex gap-3">
              <button
                onClick={cancelEdits}
                className="text-ink-800 hover:text-accent-blue font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEdits}
                className="bg-accent-blue text-white px-4 py-1 rounded-lg font-bold text-sm hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* Title - Big and bold, blue when filled */}
        <div className="flex items-start gap-3 mb-1">
          <h1 className="text-3xl font-bold flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editData.title || ''}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="w-full text-accent-blue bg-white border-2 border-accent-blue rounded-lg px-3 py-1"
              />
            ) : title ? (
              <span className="text-accent-blue">{title}</span>
            ) : (
              <span className="text-ink-800 italic font-normal">Waiting for title...</span>
            )}
          </h1>

          {/* Soundtrack Button - next to title with callout */}
          {(mediaType === 'movie' || mediaType === 'tv') && title && (
            <div className="relative group">
              <button
                onClick={() => {
                  // Pause all YouTube iframes on the page
                  document.querySelectorAll('iframe').forEach((iframe) => {
                    if (iframe.src.includes('youtube.com')) {
                      iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*')
                    }
                  })
                  setShowTrailer(false)
                  setShowSoundtrack(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-bold text-sm hover:scale-105"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Soundtrack
              </button>
              {/* Fun callout pointer - above the button */}
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap shadow-lg">
                  Rate the music!
                </div>
                <div className="w-2 h-2 bg-pink-500 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
              </div>
            </div>
          )}
        </div>

        {/* Year & Runtime */}
        <div className="flex gap-3 text-ink-800 mb-6 text-lg">
          {isEditing ? (
            <>
              <input
                type="number"
                value={editData.year || ''}
                onChange={(e) => setEditData({ ...editData, year: parseInt(e.target.value) || undefined })}
                placeholder="Year"
                className="w-20 bg-white border-2 border-accent-blue rounded-lg px-2 py-1 text-sm"
              />
              <input
                type="number"
                value={editData.runtime || ''}
                onChange={(e) => setEditData({ ...editData, runtime: parseInt(e.target.value) || undefined })}
                placeholder="Runtime (min)"
                className="w-28 bg-white border-2 border-accent-blue rounded-lg px-2 py-1 text-sm"
              />
              <input
                type="text"
                value={editData.distributor || ''}
                onChange={(e) => setEditData({ ...editData, distributor: e.target.value })}
                placeholder="Distributor"
                className="w-36 bg-white border-2 border-accent-blue rounded-lg px-2 py-1 text-sm"
              />
            </>
          ) : (
            <>
              {year && <span className="font-medium">{year}</span>}
              {runtime && <span>• {formatRuntime(runtime)}</span>}
              {distributor && <span>• {distributor}</span>}
            </>
          )}
        </div>

        {/* Key Contributors with Pills */}
        {(isMovie || isTV) && (
          <div className="space-y-4 mb-6">
            {/* Director */}
            <div>
              <span className="text-accent-blue font-bold mr-2">Director:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.director || ''}
                  onChange={(e) => setEditData({ ...editData, director: e.target.value })}
                  className="bg-white border-2 border-accent-blue rounded-lg px-3 py-1 text-sm"
                />
              ) : director ? (
                <TalentPill
                  name={director}
                  role="director"
                  preference={getPreference(director)}
                  onPreferenceChange={handleTalentPreference}
                />
              ) : (
                <span className="text-ink-800">—</span>
              )}
            </div>

            {/* Cinematographer */}
            <div>
              <span className="text-accent-blue font-bold mr-2">Cinematographer:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.cinematographer || ''}
                  onChange={(e) => setEditData({ ...editData, cinematographer: e.target.value })}
                  className="bg-white border-2 border-accent-blue rounded-lg px-3 py-1 text-sm"
                />
              ) : cinematographer ? (
                <TalentPill
                  name={cinematographer}
                  role="cinematographer"
                  preference={getPreference(cinematographer)}
                  onPreferenceChange={handleTalentPreference}
                />
              ) : (
                <span className="text-ink-800">—</span>
              )}
            </div>

            {/* Music */}
            <div>
              <span className="text-accent-blue font-bold mr-2">Music:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.composer || ''}
                  onChange={(e) => setEditData({ ...editData, composer: e.target.value })}
                  className="bg-white border-2 border-accent-blue rounded-lg px-3 py-1 text-sm"
                />
              ) : composer ? (
                <TalentPill
                  name={composer}
                  role="composer"
                  preference={getPreference(composer)}
                  onPreferenceChange={handleTalentPreference}
                />
              ) : (
                <span className="text-ink-800">—</span>
              )}
            </div>

            {/* Cast - Full cast with character names */}
            {cast && cast.length > 0 && (
              <div className="mt-4 pt-4 border-t border-paper-300">
                <span className="text-accent-blue font-bold block mb-2">Cast:</span>
                <div className="grid grid-cols-2 gap-2">
                  {cast.slice(0, 8).map((member, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-paper-100 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <TalentPill
                          name={member.name}
                          role="actor"
                          preference={getPreference(member.name)}
                          onPreferenceChange={handleTalentPreference}
                        />
                        <p className="text-xs text-ink-500 mt-0.5 truncate">as {member.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Critics Scores - Expandable Panels */}
        {(metacriticScore || rottenTomatoesScore) && (
          <div className="space-y-3 mb-6">
            {/* Metacritic */}
            {metacriticScore && (
              <div className="border-2 border-accent-blue rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white">
                  <button
                    onClick={() => setExpandedPanel(expandedPanel === 'metacritic' ? null : 'metacritic')}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-accent-blue font-bold">Metacritic</span>
                    <span className="bg-accent-blue text-white font-bold px-3 py-1 rounded text-lg">
                      {metacriticScore}
                    </span>
                    <span className="text-accent-blue text-xl">
                      {expandedPanel === 'metacritic' ? '−' : '+'}
                    </span>
                  </button>
                  {metacriticUrl && (
                    <a
                      href={metacriticUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                    >
                      Open in New Tab <span>↗</span>
                    </a>
                  )}
                </div>
                {expandedPanel === 'metacritic' && metacriticData && (
                  <div className="p-4 bg-paper-100 border-t-2 border-accent-blue">
                    {/* Consensus */}
                    <p className="text-ink-800 italic mb-4">{metacriticData.consensus}</p>

                    {/* Score Breakdown */}
                    <div className="flex gap-4 mb-4 text-sm">
                      <span className="text-green-600 font-medium">
                        {metacriticData.positiveCount} Positive
                      </span>
                      <span className="text-orange-500 font-medium">
                        {metacriticData.mixedCount} Mixed
                      </span>
                      <span className="text-ink-800 font-medium">
                        {metacriticData.negativeCount} Negative
                      </span>
                    </div>

                    {/* Top Reviews */}
                    <div className="space-y-3 mb-4">
                      {metacriticData.topReviews.map((review, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-accent-blue/30">
                          <p className="text-ink-800 mb-2">"{review.quote}"</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-accent-blue font-medium">
                              {review.critic}, {review.outlet}
                            </span>
                            <span className="font-bold text-ink-800">{review.score}/100</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Open in New Tab button */}
                    {metacriticUrl && (
                      <a
                        href={metacriticUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Open in New Tab
                        <span className="text-sm">↗</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rotten Tomatoes */}
            {rottenTomatoesScore && (
              <div className="border-2 border-accent-blue rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white">
                  <button
                    onClick={() => setExpandedPanel(expandedPanel === 'rt' ? null : 'rt')}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-accent-blue font-bold">Rotten Tomatoes</span>
                    <span className="bg-accent-blue text-white font-bold px-3 py-1 rounded text-lg">
                      {rottenTomatoesScore}% Critics
                    </span>
                    {rottenTomatoesData && (
                      <span className="bg-orange-500 text-white font-bold px-3 py-1 rounded text-lg">
                        {rottenTomatoesData.audienceScore}% Audience
                      </span>
                    )}
                    <span className="text-accent-blue text-xl">
                      {expandedPanel === 'rt' ? '−' : '+'}
                    </span>
                  </button>
                  {rottenTomatoesUrl && (
                    <a
                      href={rottenTomatoesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-accent-blue hover:underline font-medium text-sm"
                    >
                      Open in New Tab <span>↗</span>
                    </a>
                  )}
                </div>
                {expandedPanel === 'rt' && rottenTomatoesData && (
                  <div className="p-4 bg-paper-100 border-t-2 border-accent-blue">
                    {/* Consensus */}
                    <p className="text-ink-800 italic mb-4">{rottenTomatoesData.consensus}</p>

                    {/* Score Breakdown */}
                    <div className="flex gap-4 mb-4 text-sm">
                      <span className="text-green-600 font-medium">
                        {rottenTomatoesData.freshCount} Fresh
                      </span>
                      <span className="text-ink-800 font-medium">
                        {rottenTomatoesData.rottenCount} Rotten
                      </span>
                      <span className="text-ink-600 font-medium">
                        {rottenTomatoesData.criticReviews} Reviews
                      </span>
                    </div>

                    {/* Top Reviews */}
                    <div className="space-y-3 mb-4">
                      {rottenTomatoesData.topReviews.map((review, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-accent-blue/30">
                          <p className="text-ink-800 mb-2">"{review.quote}"</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-accent-blue font-medium">
                              {review.critic}, {review.outlet}
                            </span>
                            <span className={review.fresh ? 'text-green-600' : 'text-ink-800'}>
                              {review.fresh ? 'Fresh' : 'Rotten'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Open in New Tab button */}
                    {rottenTomatoesUrl && (
                      <a
                        href={rottenTomatoesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Open in New Tab
                        <span className="text-sm">↗</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Awards & Box Office */}
        {(awards || boxOffice) && (
          <div className="mb-2">
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
              {awards && awards !== 'N/A' && (
                <div className="mb-2 relative group inline-block">
                  <a
                    href={imdbUrl ? `${imdbUrl}/awards` : '#'}
                    target={imdbUrl ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="hover:bg-amber-100 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors cursor-pointer inline-block"
                    onMouseEnter={onAwardsHover}
                    onClick={(e) => !imdbUrl && e.preventDefault()}
                  >
                    <span className="text-amber-600 font-bold">🏆 Awards: </span>
                    <span className="text-ink-800">{awards}</span>
                  </a>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-0 mb-2 px-5 py-4 bg-ink-800 text-white text-sm rounded-xl shadow-2xl whitespace-pre-wrap min-w-[320px] max-w-md z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {loadingAwards
                      ? 'Loading awards...'
                      : awardsTooltip
                        ? awardsTooltip
                        : imdbUrl
                          ? 'Hover to load award details...'
                          : 'No IMDB link available'}
                    <div className="absolute top-full left-8 border-8 border-transparent border-t-ink-800" />
                  </div>
                </div>
              )}
              {boxOffice && boxOffice !== 'N/A' && (
                <div>
                  <span className="text-green-600 font-bold">💰 Box Office: </span>
                  <span className="text-ink-800 font-bold text-lg">{boxOffice}</span>
                </div>
              )}
            </div>
            {/* Refresh Data Button - right justified below */}
            {onRefreshMetadata && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={onRefreshMetadata}
                  disabled={refreshingMetadata}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-accent-blue/15 hover:text-ink-800 rounded-lg transition-all disabled:opacity-50"
                  title="Refresh ratings, awards, and box office data"
                >
                  <span className={refreshingMetadata ? 'animate-spin' : ''}>🔄</span>
                  {refreshingMetadata ? 'Refreshing...' : 'Refresh Data'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Trailer Button */}
        {youtubeId && (
          <div className="mb-6">
            <button
              onClick={() => setShowTrailer(!showTrailer)}
              className="flex items-center gap-2 px-5 py-3 bg-accent-blue text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
            >
              <span>{showTrailer ? '✕ Close' : '▶ Watch Trailer'}</span>
            </button>
          </div>
        )}

        {/* Trailer Embed */}
        {showTrailer && youtubeId && (
          <div className="mb-6 rounded-xl overflow-hidden border-2 border-accent-blue aspect-video">
            <iframe
              key={`trailer-${showTrailer}`}
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&enablejsapi=1`}
              title="Official Trailer"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Where to Watch */}
        {streamingOptions && streamingOptions.length > 0 && (
          <div>
            <span className="text-accent-blue font-bold">Where to Watch: </span>
            <div className="flex flex-wrap gap-2 mt-2">
              {streamingOptions.map((option, idx) => (
                <a
                  key={idx}
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-4 py-2 rounded-full font-bold transition-colors ${
                    option.type === 'stream'
                      ? 'bg-accent-blue text-white hover:bg-blue-700'
                      : option.type === 'theater'
                      ? 'bg-ink-800 text-white hover:bg-ink-700'
                      : 'bg-paper-400 text-ink-800 hover:bg-paper-500'
                  }`}
                >
                  {option.service}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* YOUR EXPERIENCE SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-paper-200 p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-ink-800 tracking-wide">YOUR EXPERIENCE</h2>
          {isBuilding && !isEditing && (
            <button
              onClick={startEditing}
              className="text-accent-blue hover:underline font-bold text-sm"
            >
              Edit
            </button>
          )}
          {isEditing && (
            <div className="flex gap-3">
              <button
                onClick={cancelEdits}
                className="text-ink-800 hover:text-accent-blue font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEdits}
                className="bg-accent-blue text-white px-4 py-1 rounded-lg font-bold text-sm hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* Your Rating */}
        <div className="bg-white rounded-xl p-5 mb-5 border-2 border-accent-blue">
          <div className="text-accent-blue font-bold mb-2">Your Rating</div>
          {isEditing ? (
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="100"
                value={editData.rating || 50}
                onChange={(e) => setEditData({ ...editData, rating: parseInt(e.target.value) })}
                className="flex-1"
              />
              <span className={`text-2xl font-bold min-w-[60px] ${getRatingColorClass(editData.rating || 50)}`}>
                {editData.rating || 50}%
              </span>
            </div>
          ) : rating !== undefined ? (
            <div className="flex items-center gap-4">
              <span className={`text-4xl font-bold ${getRatingColorClass(rating)}`}>{rating}%</span>
              <span className={`text-3xl tracking-wider ${getRatingColorClass(rating)}`}>{getStars(rating)}</span>
            </div>
          ) : (
            <span className="text-ink-800 italic text-lg">Not rated yet</span>
          )}
        </div>

        {/* When & Where - Plain text, not pills */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-xl p-4 border-2 border-accent-blue">
            <div className="text-accent-blue font-bold mb-2">When</div>
            {isEditing ? (
              <DatePicker
                value={editData.dateWatched || ''}
                onChange={(date) => setEditData({ ...editData, dateWatched: date })}
              />
            ) : dateWatched ? (
              <span className="text-ink-800 font-medium">{dateWatched}</span>
            ) : (
              <span className="text-ink-800 italic">Date not set</span>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-accent-blue">
            <div className="text-accent-blue font-bold mb-2">Where</div>
            {isEditing ? (
              <div className="space-y-2">
                <select
                  value={editData.location || ''}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className="w-full bg-white border-2 border-accent-blue rounded-lg px-3 py-1"
                >
                  <option value="">Select...</option>
                  <option value="home">Home</option>
                  <option value="theater">Theater</option>
                  <option value="other">Other</option>
                </select>
                {editData.location === 'theater' && (
                  <input
                    type="text"
                    value={editData.locationDetail || ''}
                    onChange={(e) => setEditData({ ...editData, locationDetail: e.target.value })}
                    placeholder="Theater name"
                    className="w-full bg-white border-2 border-accent-blue rounded-lg px-3 py-1 text-sm"
                  />
                )}
              </div>
            ) : location === 'theater' ? (
              <span className="text-ink-800 font-medium">
                Theater{locationDetail && ` — ${locationDetail}`}
              </span>
            ) : location === 'home' ? (
              <span className="text-ink-800 font-medium">Home</span>
            ) : location ? (
              <span className="text-ink-800 font-medium">{location}</span>
            ) : (
              <span className="text-ink-800 italic">Not specified</span>
            )}
          </div>
        </div>

        {/* Context - Pills */}
        <div className="flex flex-wrap gap-3 mb-5">
          {isEditing ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-accent-blue font-bold">First time?</span>
                <select
                  value={editData.firstTime === true ? 'yes' : editData.firstTime === false ? 'no' : ''}
                  onChange={(e) => setEditData({
                    ...editData,
                    firstTime: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : undefined
                  })}
                  className="bg-white border-2 border-accent-blue rounded-lg px-3 py-1"
                >
                  <option value="">Not set</option>
                  <option value="yes">First Time</option>
                  <option value="no">Rewatch</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent-blue font-bold">Watched with:</span>
                <select
                  value={editData.socialContext || ''}
                  onChange={(e) => setEditData({ ...editData, socialContext: e.target.value })}
                  className="bg-white border-2 border-accent-blue rounded-lg px-3 py-1"
                >
                  <option value="">Not set</option>
                  <option value="alone">Solo</option>
                  <option value="partner">Partner</option>
                  <option value="friends">Friends</option>
                  <option value="family">Family</option>
                </select>
              </div>
              {editData.socialContext && editData.socialContext !== 'alone' && (
                <input
                  type="text"
                  value={editData.companionNames || ''}
                  onChange={(e) => setEditData({ ...editData, companionNames: e.target.value })}
                  placeholder="Names (comma-separated)"
                  className="bg-white border-2 border-accent-blue rounded-lg px-3 py-1 text-sm"
                />
              )}
            </>
          ) : (
            <>
              {firstTime === true && (
                <span className="bg-accent-blue text-white px-4 py-2 rounded-full font-bold">
                  First Time
                </span>
              )}
              {firstTime === false && (
                <span className="bg-ink-800 text-white px-4 py-2 rounded-full font-bold">
                  Rewatch
                </span>
              )}
              {socialContext === 'alone' && (
                <span className="bg-paper-400 text-ink-800 px-4 py-2 rounded-full font-bold border-2 border-ink-800">
                  Solo
                </span>
              )}
              {socialContext && socialContext !== 'alone' && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-accent-blue font-bold">With:</span>
                  {companionNames ? (
                    companionNames.split(',').map((name, idx) => (
                      <Pill key={idx}>{name.trim()}</Pill>
                    ))
                  ) : (
                    <Pill>{socialContext}</Pill>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-5 border-2 border-accent-blue">
          <div className="flex items-center justify-between mb-2">
            <div className="text-accent-blue font-bold">Your Notes</div>
            <button
              onClick={() => setShowNotesModal(true)}
              className="text-sm px-3 py-1 bg-accent-blue/10 text-accent-blue rounded-lg hover:bg-accent-blue hover:text-white transition-colors font-medium"
            >
              {notes ? 'Edit' : 'Add Notes'}
            </button>
          </div>
          <div
            className="text-ink-800 leading-relaxed text-lg min-h-[60px] cursor-pointer hover:bg-paper-50 rounded-lg p-2 -m-2 transition-colors"
            onClick={() => setShowNotesModal(true)}
          >
            {notes ? (
              <div className="whitespace-pre-wrap">{notes}</div>
            ) : (
              <span className="italic text-ink-400">Click to add your thoughts...</span>
            )}
          </div>
        </div>
      </div>

      {/* Soundtrack Modal */}
      <SoundtrackModal
        isOpen={showSoundtrack}
        onClose={() => setShowSoundtrack(false)}
        movieTitle={title}
        movieYear={year}
        composer={composer}
        onSaveTrack={onSaveTrack}
        onUnsaveTrack={onUnsaveTrack}
        savedTracks={savedTracks}
      />

      {/* Notes Modal */}
      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        onSave={(newNotes) => {
          if (onEdit) {
            onEdit({ notes: newNotes })
          }
        }}
        movieTitle={title}
        initialNotes={notes}
      />
    </div>
  )
}
