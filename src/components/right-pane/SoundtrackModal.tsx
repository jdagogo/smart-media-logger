'use client'

import { useState, useEffect } from 'react'

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

interface SoundtrackModalProps {
  isOpen: boolean
  onClose: () => void
  movieTitle: string
  movieYear?: number
  composer?: string
  playlistId?: string
  onSaveTrack?: (track: {
    title: string
    artist: string
    videoId: string
    thumbnail: string
    fromMovie: string
  }) => void
  onUnsaveTrack?: (videoId: string) => void
  savedTracks?: Set<string>
}

export default function SoundtrackModal({
  isOpen,
  onClose,
  movieTitle,
  movieYear,
  composer,
  playlistId,
  onSaveTrack,
  onUnsaveTrack,
  savedTracks = new Set(),
}: SoundtrackModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soundtrack, setSoundtrack] = useState<SoundtrackData | null>(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0)
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set())

  const currentTrack = soundtrack?.tracks[currentTrackIndex] || null

  useEffect(() => {
    if (isOpen && movieTitle) {
      fetchSoundtrack()
    }
  }, [isOpen, movieTitle, playlistId])

  // Reset player when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentTrackIndex(0)
    }
  }, [isOpen])

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

  const fetchSoundtrack = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (playlistId) {
        params.set('playlistId', playlistId)
      } else {
        params.set('movieTitle', movieTitle)
      }

      const response = await fetch(`/api/youtube-playlist?${params}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('No soundtrack playlist found for this movie')
        } else {
          setError('Failed to load soundtrack')
        }
        return
      }

      const data = await response.json()
      setSoundtrack(data)
    } catch (err) {
      setError('Failed to load soundtrack')
      console.error('Soundtrack fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSaveTrack = (track: Track) => {
    const alreadySaved = savedTracks.has(track.videoId)

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

  const isTrackSaved = (videoId: string) => savedTracks.has(videoId) || justSaved.has(videoId)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
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
          className="flex items-center justify-between px-6 py-4"
          style={{ background: '#222', borderBottom: '1px solid #333' }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '20px' }}>🎵</span>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
              {movieTitle} Soundtrack
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {soundtrack && (
              <span
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
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
              <span style={{ fontSize: '14px' }}>✕</span> Close
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
                  className="flex justify-center gap-4 mt-4"
                  style={{ padding: '1rem' }}
                >
                  <button
                    onClick={playPrevious}
                    disabled={currentTrackIndex === 0}
                    style={{
                      background: currentTrackIndex === 0 ? '#444' : '#555',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '12px 24px',
                      cursor: currentTrackIndex === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
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
                      borderRadius: '6px',
                      padding: '12px 24px',
                      cursor: (!soundtrack || currentTrackIndex === soundtrack.tracks.length - 1) ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
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
    </div>
  )
}
