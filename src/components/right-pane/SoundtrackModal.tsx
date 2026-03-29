'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Track {
  position: number
  videoId: string
  title: string
  artist: string
  fullTitle: string
  thumbnail: string
  channelTitle: string
}

interface SoundtrackData {
  playlistId: string
  playlistTitle: string
  playlistDescription?: string
  channelTitle: string
  trackCount: number
  thumbnail: string
  tracks: Track[]
}

type SoundtrackTab = 'score' | 'music'

interface SoundtrackModalProps {
  isOpen: boolean
  onClose: () => void
  movieTitle: string
  movieYear?: number
  composer?: string
  // Original score playlist (composed music for the film)
  scorePlaylistId?: string
  // Music from playlist (licensed songs featured in the film)
  musicFromPlaylistId?: string
  // Legacy support - treat as score if only this is provided
  playlistId?: string
  onSaveTrack?: (track: {
    title: string
    artist: string
    videoId: string
    thumbnail: string
    fromMovie: string
    fromMovieYear?: number
  }) => void
  onUnsaveTrack?: (videoId: string) => void
  savedTracks?: Record<string, boolean>
}

export default function SoundtrackModal({
  isOpen,
  onClose,
  movieTitle,
  movieYear,
  composer,
  scorePlaylistId,
  musicFromPlaylistId,
  playlistId, // Legacy support
  onSaveTrack,
  onUnsaveTrack,
  savedTracks = {},
}: SoundtrackModalProps) {
  const [activeTab, setActiveTab] = useState<SoundtrackTab>('score')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Store soundtrack data for each tab separately
  const [scoreSoundtrack, setScoreSoundtrack] = useState<SoundtrackData | null>(null)
  const [musicSoundtrack, setMusicSoundtrack] = useState<SoundtrackData | null>(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0)
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set())

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editScoreUrl, setEditScoreUrl] = useState('')
  const [editMusicUrl, setEditMusicUrl] = useState('')
  const [editScoreName, setEditScoreName] = useState('')
  const [editMusicName, setEditMusicName] = useState('')

  // Custom playlist overrides from localStorage
  const [customScorePlaylistId, setCustomScorePlaylistId] = useState<string | null>(null)
  const [customMusicPlaylistId, setCustomMusicPlaylistId] = useState<string | null>(null)
  const [customScoreName, setCustomScoreName] = useState<string | null>(null)
  const [customMusicName, setCustomMusicName] = useState<string | null>(null)

  // Get the current soundtrack based on active tab
  const soundtrack = activeTab === 'score' ? scoreSoundtrack : musicSoundtrack
  const currentTrack = soundtrack?.tracks[currentTrackIndex] || null

  // Determine effective playlist IDs (custom overrides take priority)
  const effectiveScorePlaylistId = customScorePlaylistId || scorePlaylistId || playlistId
  const effectiveMusicPlaylistId = customMusicPlaylistId || musicFromPlaylistId

  // Load custom overrides from localStorage on mount (reset first to avoid stale data)
  useEffect(() => {
    // Always reset custom overrides when movie changes
    setCustomScorePlaylistId(null)
    setCustomMusicPlaylistId(null)
    setCustomScoreName(null)
    setCustomMusicName(null)

    if (movieTitle) {
      const storageKey = `soundtrack_overrides_${movieTitle.toLowerCase().replace(/\s+/g, '_')}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const overrides = JSON.parse(stored)
          if (overrides.score) setCustomScorePlaylistId(overrides.score)
          if (overrides.music) setCustomMusicPlaylistId(overrides.music)
          if (overrides.scoreName) setCustomScoreName(overrides.scoreName)
          if (overrides.musicName) setCustomMusicName(overrides.musicName)
        } catch (e) {
          console.error('Failed to parse soundtrack overrides:', e)
        }
      }
    }
  }, [movieTitle])

  // Extract playlist ID from YouTube URL or return as-is if already an ID
  const extractPlaylistId = (input: string): string | null => {
    if (!input.trim()) return null
    // If it's already just an ID (no URL parts)
    if (/^PL[a-zA-Z0-9_-]+$/.test(input.trim())) {
      return input.trim()
    }
    // Extract from URL
    const match = input.match(/[?&]list=([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }

  const handleSaveOverrides = () => {
    const scoreId = extractPlaylistId(editScoreUrl)
    const musicId = extractPlaylistId(editMusicUrl)
    const scoreName = editScoreName.trim() || null
    const musicName = editMusicName.trim() || null

    // Save to localStorage
    const storageKey = `soundtrack_overrides_${movieTitle.toLowerCase().replace(/\s+/g, '_')}`
    const overrides: { score?: string; music?: string; scoreName?: string; musicName?: string } = {}
    if (scoreId) overrides.score = scoreId
    if (musicId) overrides.music = musicId
    if (scoreName) overrides.scoreName = scoreName
    if (musicName) overrides.musicName = musicName

    if (Object.keys(overrides).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(overrides))
    } else {
      localStorage.removeItem(storageKey)
    }

    // Update state
    setCustomScorePlaylistId(scoreId)
    setCustomMusicPlaylistId(musicId)
    setCustomScoreName(scoreName)
    setCustomMusicName(musicName)

    // Clear cached soundtracks to force refetch
    setScoreSoundtrack(null)
    setMusicSoundtrack(null)

    // Exit edit mode
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    // Pre-fill with current playlist IDs and names if available
    setEditScoreUrl(effectiveScorePlaylistId || '')
    setEditMusicUrl(effectiveMusicPlaylistId || '')
    setEditScoreName(customScoreName || '')
    setEditMusicName(customMusicName || '')
    setIsEditing(true)
  }

  useEffect(() => {
    if (isOpen && movieTitle) {
      // Fetch the soundtrack for the active tab
      fetchSoundtrack(activeTab)
    }
  }, [isOpen, movieTitle, activeTab, effectiveScorePlaylistId, effectiveMusicPlaylistId])

  // Reset everything when modal closes or movie changes
  useEffect(() => {
    if (!isOpen) {
      setCurrentTrackIndex(0)
      // Clear cached soundtracks so fresh data is fetched next time
      setScoreSoundtrack(null)
      setMusicSoundtrack(null)
      setActiveTab('score')
      setError(null)
      setIsEditing(false)
    }
  }, [isOpen])

  // Clear cached data when movie changes
  useEffect(() => {
    setScoreSoundtrack(null)
    setMusicSoundtrack(null)
    setCurrentTrackIndex(0)
    setActiveTab('score')
  }, [movieTitle])

  // Reset track index when switching tabs
  useEffect(() => {
    setCurrentTrackIndex(0)
  }, [activeTab])

  const playNext = () => {
    if (soundtrack && currentTrackIndex < soundtrack.tracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1)
    }
  }

  const playPrevious = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1)
    }
  }

  const fetchSoundtrack = async (tab: SoundtrackTab) => {
    // Check if we already have data for this tab
    if (tab === 'score' && scoreSoundtrack) return
    if (tab === 'music' && musicSoundtrack) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      if (tab === 'score') {
        // Original Score tab - use score playlist ID or search for "[Movie] original score"
        if (effectiveScorePlaylistId) {
          params.set('playlistId', effectiveScorePlaylistId)
        } else {
          // Search for original score
          params.set('movieTitle', movieTitle)
          params.set('searchType', 'score')
          if (composer) {
            params.set('composer', composer)
          }
        }
      } else {
        // Music From tab - use music playlist ID or search for "[Movie] music from"
        if (effectiveMusicPlaylistId) {
          params.set('playlistId', effectiveMusicPlaylistId)
        } else {
          // Search for music from / songs from
          params.set('movieTitle', movieTitle)
          params.set('searchType', 'music')
        }
      }

      const response = await fetch(`/api/youtube-playlist?${params}`)

      if (!response.ok) {
        if (response.status === 404) {
          const tabLabel = tab === 'score' ? 'original score' : 'music'
          setError(`No ${tabLabel} playlist found for this movie`)
        } else {
          setError('Failed to load soundtrack')
        }
        return
      }

      const data = await response.json()

      // Store in the appropriate state
      if (tab === 'score') {
        setScoreSoundtrack(data)
      } else {
        setMusicSoundtrack(data)
      }
    } catch (err) {
      setError('Failed to load soundtrack')
      console.error('Soundtrack fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSaveTrack = (track: Track) => {
    const alreadySaved = !!savedTracks[track.videoId]

    if (alreadySaved) {
      // Unsave the track
      if (onUnsaveTrack) {
        onUnsaveTrack(track.videoId)
      }
    } else {
      // Save the track
      if (onSaveTrack) {
        onSaveTrack({
          title: track.title,
          artist: track.artist,
          videoId: track.videoId,
          thumbnail: track.thumbnail,
          fromMovie: movieTitle,
          fromMovieYear: movieYear,
        })
        setJustSaved(prev => new Set(prev).add(track.videoId))
        setTimeout(() => {
          setJustSaved(prev => {
            const newSet = new Set(prev)
            newSet.delete(track.videoId)
            return newSet
          })
        }, 2000)
      }
    }
  }

  const isTrackSaved = (videoId: string) => !!savedTracks[videoId] || justSaved.has(videoId)

  if (!isOpen) return null

  // Use portal to render to document.body, escaping any parent container constraints
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal - Sized down 30% */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          width: '77vw',
          height: '77vh',
          maxWidth: '1400px',
          maxHeight: '800px'
        }}
      >
        {/* Header */}
        <div
          className="flex flex-col"
          style={{ background: '#222', borderBottom: '1px solid #333' }}
        >
          {/* Top row: Title and controls */}
          <div className="flex items-center justify-between px-7 py-4">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '26px' }}>🎵</span>
              <h2 style={{ fontSize: '23px', fontWeight: 'bold', color: '#fff' }}>
                {movieTitle}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleStartEdit}
                style={{
                  background: isEditing ? '#6b7280' : '#8b5cf6',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '14px' }}>✏️</span> Edit
              </button>
              {soundtrack && !isEditing && (
                <span
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    padding: '8px 15px',
                    borderRadius: '7px',
                    fontSize: '18px',
                    fontWeight: '600'
                  }}
                >
                  Track {currentTrackIndex + 1} of {soundtrack.tracks.length}
                </span>
              )}
              <button
                onClick={onClose}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  padding: '8px 15px',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span style={{ fontSize: '18px' }}>✕</span> Close
              </button>
            </div>
          </div>

          {/* Edit Panel */}
          {isEditing && (
            <div
              style={{
                background: '#2d2d2d',
                padding: '16px 28px',
                borderBottom: '1px solid #444'
              }}
            >
              <div className="flex flex-col gap-4">
                {/* Score row */}
                <div className="flex items-center gap-4">
                  <label style={{ color: '#fff', fontSize: '16px', fontWeight: '600', minWidth: '80px' }}>
                    🎼 Tab 1:
                  </label>
                  <input
                    type="text"
                    value={editScoreName}
                    onChange={(e) => setEditScoreName(e.target.value)}
                    placeholder="Tab name (e.g. Original Score)"
                    style={{
                      width: '200px',
                      padding: '10px 14px',
                      fontSize: '16px',
                      borderRadius: '6px',
                      border: '1px solid #555',
                      background: '#1a1a1a',
                      color: '#fff'
                    }}
                  />
                  <input
                    type="text"
                    value={editScoreUrl}
                    onChange={(e) => setEditScoreUrl(e.target.value)}
                    placeholder="YouTube playlist URL or ID"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      fontSize: '16px',
                      borderRadius: '6px',
                      border: '1px solid #555',
                      background: '#1a1a1a',
                      color: '#fff'
                    }}
                  />
                </div>
                {/* Music row */}
                <div className="flex items-center gap-4">
                  <label style={{ color: '#fff', fontSize: '16px', fontWeight: '600', minWidth: '80px' }}>
                    🎧 Tab 2:
                  </label>
                  <input
                    type="text"
                    value={editMusicName}
                    onChange={(e) => setEditMusicName(e.target.value)}
                    placeholder="Tab name (e.g. Music From)"
                    style={{
                      width: '200px',
                      padding: '10px 14px',
                      fontSize: '16px',
                      borderRadius: '6px',
                      border: '1px solid #555',
                      background: '#1a1a1a',
                      color: '#fff'
                    }}
                  />
                  <input
                    type="text"
                    value={editMusicUrl}
                    onChange={(e) => setEditMusicUrl(e.target.value)}
                    placeholder="YouTube playlist URL or ID"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      fontSize: '16px',
                      borderRadius: '6px',
                      border: '1px solid #555',
                      background: '#1a1a1a',
                      color: '#fff'
                    }}
                  />
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    style={{
                      padding: '10px 20px',
                      fontSize: '16px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#555',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOverrides}
                    style={{
                      padding: '10px 20px',
                      fontSize: '16px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#10b981',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Save & Reload
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs row */}
          <div className="flex px-7 gap-2" style={{ paddingBottom: '0' }}>
            <button
              onClick={() => setActiveTab('score')}
              style={{
                padding: '13px 26px',
                fontSize: '19px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '9px 9px 0 0',
                cursor: 'pointer',
                background: activeTab === 'score' ? '#1a1a1a' : 'transparent',
                color: activeTab === 'score' ? '#fff' : '#888',
                borderBottom: activeTab === 'score' ? '3px solid #3b82f6' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              🎼 {customScoreName || 'Original Score'}
            </button>
            <button
              onClick={() => setActiveTab('music')}
              style={{
                padding: '13px 26px',
                fontSize: '19px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '9px 9px 0 0',
                cursor: 'pointer',
                background: activeTab === 'music' ? '#1a1a1a' : 'transparent',
                color: activeTab === 'music' ? '#fff' : '#888',
                borderBottom: activeTab === 'music' ? '3px solid #10b981' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              🎧 {customMusicName || 'Music From'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎵</div>
              <p style={{ color: '#888', fontSize: '18px' }}>{error}</p>
              <button
                onClick={fetchSoundtrack}
                style={{
                  marginTop: '1rem',
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {soundtrack && !loading && (
            <div className="flex h-full" style={{ gap: '0' }}>
              {/* Left Side - Video Player (70%) */}
              <div
                className="flex flex-col"
                style={{
                  flex: '1 1 70%',
                  padding: '1.5rem',
                  borderRight: '1px solid #333'
                }}
              >
                {/* Video Embed */}
                <div style={{ flex: 1, minHeight: 0 }}>
                  {currentTrack?.videoId ? (
                    <iframe
                      key={currentTrack.videoId}
                      src={`https://www.youtube.com/embed/${currentTrack.videoId}?autoplay=1&rel=0`}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#000'
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center h-full"
                      style={{ background: '#2a2a2a', borderRadius: '8px' }}
                    >
                      <div className="text-center">
                        <div style={{ fontSize: '32px', marginBottom: '1rem' }}>❌</div>
                        <div style={{ color: '#888', fontSize: '18px' }}>Video not found</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Player Controls */}
                <div
                  className="flex justify-center gap-5 mt-4"
                  style={{ padding: '1.25rem' }}
                >
                  <button
                    onClick={playPrevious}
                    disabled={currentTrackIndex === 0}
                    style={{
                      background: currentTrackIndex === 0 ? '#444' : '#555',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '15px 31px',
                      cursor: currentTrackIndex === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '20px',
                      fontWeight: '600',
                      opacity: currentTrackIndex === 0 ? 0.5 : 1
                    }}
                  >
                    ⏮ Previous
                  </button>
                  <button
                    onClick={playNext}
                    disabled={!soundtrack || currentTrackIndex === soundtrack.tracks.length - 1}
                    style={{
                      background: (!soundtrack || currentTrackIndex === soundtrack.tracks.length - 1) ? '#444' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '15px 31px',
                      cursor: (!soundtrack || currentTrackIndex === soundtrack.tracks.length - 1) ? 'not-allowed' : 'pointer',
                      fontSize: '20px',
                      fontWeight: '600',
                      opacity: (!soundtrack || currentTrackIndex === soundtrack.tracks.length - 1) ? 0.5 : 1
                    }}
                  >
                    Next ⏭
                  </button>
                </div>
              </div>

              {/* Right Side - Track List (30%) */}
              <div
                className="flex flex-col"
                style={{
                  flex: '0 0 30%',
                  minWidth: '320px',
                  background: '#222'
                }}
              >
                {/* Playlist Header */}
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #444'
                  }}
                >
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#fff'
                  }}>
                    Playlist Tracks
                  </h3>
                </div>

                {/* Track List */}
                <div
                  className="flex-1 overflow-y-auto"
                  style={{ padding: '0.5rem' }}
                >
                  {soundtrack.tracks.map((track, idx) => (
                    <div
                      key={track.videoId || idx}
                      onClick={() => setCurrentTrackIndex(idx)}
                      style={{
                        background: idx === currentTrackIndex ? '#3b82f6' : '#333',
                        padding: '1rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '0.5rem',
                        border: idx === currentTrackIndex ? '2px solid #60a5fa' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Track Number */}
                          <div style={{
                            fontSize: '13px',
                            color: idx === currentTrackIndex ? '#bfdbfe' : '#888',
                            marginBottom: '4px'
                          }}>
                            Track {idx + 1}
                          </div>

                          {/* Song Title */}
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#fff',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {track.title}
                          </div>

                          {/* Artist */}
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#10b981',
                            marginBottom: '6px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {track.artist}
                          </div>

                          {/* Video Status */}
                          {track.videoId ? (
                            <div style={{
                              fontSize: '13px',
                              color: idx === currentTrackIndex ? '#bfdbfe' : '#10b981'
                            }}>
                              ✓ Video found
                            </div>
                          ) : (
                            <div style={{ fontSize: '13px', color: '#f87171' }}>
                              ✗ No video
                            </div>
                          )}
                        </div>

                        {/* Save/Heart Button - Toggleable */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleSaveTrack(track)
                          }}
                          style={{
                            background: isTrackSaved(track.videoId) ? '#dc2626' : 'transparent',
                            border: isTrackSaved(track.videoId) ? 'none' : '2px solid #666',
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.2s'
                          }}
                          title={isTrackSaved(track.videoId) ? 'Remove from My Stuff' : 'Save to My Stuff'}
                        >
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill={isTrackSaved(track.videoId) ? 'white' : 'none'}
                            stroke={isTrackSaved(track.videoId) ? 'white' : '#888'}
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer hint */}
                <div style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid #444',
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: '16px', color: '#999' }}>
                    Click ❤️ to save songs to your collection
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
