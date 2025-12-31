'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface CastMember {
  id: string
  type: 'character'
  actorName: string
  characterName: string
  url: string | null
  urlLarge: string | null
  order: number
}

interface SceneImage {
  id: string
  type: 'scene'
  url: string
  urlLarge: string
  aspectRatio: number
}

interface VideoClip {
  id: string
  type: 'video'
  videoType: string // Trailer, Teaser, Clip, Featurette, Behind the Scenes
  name: string
  key: string // YouTube video ID
  site: string
  official: boolean
  publishedAt: string
  thumbnailUrl: string
  embedUrl: string
  watchUrl: string
}

// Structured note with rich metadata for preference learning
export interface CharacterSceneNote {
  id: string
  type: 'character' | 'scene' | 'video'
  note: string
  timestamp: string
  // Movie context
  movieTitle: string
  movieYear?: number
  movieId?: string
  // Character-specific (for actor preference tracking)
  actorName?: string
  characterName?: string
  actorThumbnail?: string
  // Scene-specific
  sceneIndex?: number
  sceneThumbnail?: string
  // Video-specific
  videoName?: string
  videoType?: string
  videoKey?: string
  videoThumbnail?: string
}

interface CharacterGalleryProps {
  movieTitle: string
  movieYear?: number
  movieId?: string
  onNoteAdded?: (note: CharacterSceneNote) => void
}

export default function CharacterGallery({
  movieTitle,
  movieYear,
  movieId,
  onNoteAdded,
}: CharacterGalleryProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cast, setCast] = useState<CastMember[]>([])
  const [scenes, setScenes] = useState<SceneImage[]>([])
  const [videos, setVideos] = useState<VideoClip[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [noteText, setNoteText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'cast' | 'scenes' | 'videos'>('cast')
  const [savedToast, setSavedToast] = useState<string | null>(null)

  // Get current list and selected item based on mode
  const currentList = activeTab === 'cast' ? cast : activeTab === 'scenes' ? scenes : videos
  const selectedItem = selectedIndex >= 0 ? currentList[selectedIndex] : null

  useEffect(() => {
    fetchImages()
  }, [movieTitle, movieYear, movieId])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = true
        recognitionInstance.interimResults = true

        recognitionInstance.onresult = (event: any) => {
          let transcript = ''
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript
          }
          setNoteText(transcript)
        }

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsRecording(false)
        }

        recognitionInstance.onend = () => {
          setIsRecording(false)
        }

        setRecognition(recognitionInstance)
      }
    }
  }, [])

  const fetchImages = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (movieId) {
        params.set('movieId', movieId)
      } else {
        params.set('title', movieTitle)
        if (movieYear) params.set('year', movieYear.toString())
      }

      const response = await fetch(`/api/movie-images?${params}`)

      if (!response.ok) {
        setError('Could not load images')
        return
      }

      const data = await response.json()
      setCast(data.images.cast || [])
      setScenes(data.images.scenes || [])
      setVideos(data.images.videos || [])
    } catch (err) {
      setError('Failed to load images')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const startRecording = () => {
    if (recognition) {
      recognition.start()
      setIsRecording(true)
    }
  }

  const stopRecording = () => {
    if (recognition) {
      recognition.stop()
      setIsRecording(false)
    }
  }

  const handleImageClick = (index: number) => {
    setSelectedIndex(index)
    setNoteText('')
  }

  const goToPrevImage = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
      setNoteText('')
    }
  }

  const goToNextImage = () => {
    if (selectedIndex < currentList.length - 1) {
      setSelectedIndex(selectedIndex + 1)
      setNoteText('')
    }
  }

  const handleSaveNote = () => {
    if (!selectedItem || !noteText.trim()) return

    if (onNoteAdded) {
      const baseNote = {
        id: `${Date.now()}-${selectedItem.id}`,
        note: noteText.trim(),
        timestamp: new Date().toISOString(),
        movieTitle,
        movieYear,
        movieId,
      }

      if (selectedItem.type === 'character') {
        const castMember = selectedItem as CastMember
        onNoteAdded({
          ...baseNote,
          type: 'character',
          actorName: castMember.actorName,
          characterName: castMember.characterName,
          actorThumbnail: castMember.urlLarge || castMember.url || undefined,
        })
      } else if (selectedItem.type === 'scene') {
        const scene = selectedItem as SceneImage
        onNoteAdded({
          ...baseNote,
          type: 'scene',
          sceneIndex: selectedIndex + 1,
          sceneThumbnail: scene.urlLarge || scene.url,
        })
      } else if (selectedItem.type === 'video') {
        const video = selectedItem as VideoClip
        onNoteAdded({
          ...baseNote,
          type: 'video',
          videoName: video.name,
          videoType: video.videoType,
          videoKey: video.key,
          videoThumbnail: video.thumbnailUrl,
        })
      }
    }

    // Show saved toast
    const itemName = selectedItem.type === 'character'
      ? (selectedItem as CastMember).actorName
      : selectedItem.type === 'video'
        ? (selectedItem as VideoClip).name
        : `Scene ${selectedIndex + 1}`
    setSavedToast(`Note saved for ${itemName}`)
    setTimeout(() => setSavedToast(null), 3000)

    setSelectedIndex(-1)
    setNoteText('')
  }

  const handleClose = () => {
    if (isRecording) stopRecording()
    setSelectedIndex(-1)
    setNoteText('')
  }

  if (loading) {
    return (
      <div className="bg-paper-100 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-paper-400 border-t-accent-blue" />
          <span className="ml-3 text-paper-600">Loading images...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-paper-100 rounded-lg p-6 text-center">
        <p className="text-paper-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-paper-100 rounded-lg p-4 relative">
      {/* Saved Toast */}
      {savedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] animate-fade-in">
          <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <span className="text-xl">✓</span>
            <span className="font-medium">{savedToast}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-paper-800 text-lg">
          What did you think about these scenes or characters?
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('cast'); setSelectedIndex(-1); }}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'cast'
                ? 'bg-accent-blue text-white'
                : 'bg-paper-200 text-paper-600 hover:bg-paper-300'
            }`}
          >
            Cast ({cast.length})
          </button>
          <button
            onClick={() => { setActiveTab('scenes'); setSelectedIndex(-1); }}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'scenes'
                ? 'bg-accent-blue text-white'
                : 'bg-paper-200 text-paper-600 hover:bg-paper-300'
            }`}
          >
            Scenes ({scenes.length})
          </button>
          {videos.length > 0 && (
            <button
              onClick={() => { setActiveTab('videos'); setSelectedIndex(-1); }}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'videos'
                  ? 'bg-accent-blue text-white'
                  : 'bg-paper-200 text-paper-600 hover:bg-paper-300'
              }`}
            >
              Videos ({videos.length})
            </button>
          )}
        </div>
      </div>

      {/* Cast Grid */}
      {activeTab === 'cast' && (
        <div className="grid grid-cols-5 gap-3">
          {cast.map((member, idx) => (
            <button
              key={member.id}
              onClick={() => handleImageClick(idx)}
              className="group relative overflow-hidden rounded-lg aspect-[2/3] bg-paper-200 hover:ring-2 hover:ring-accent-blue transition-all hover:scale-105"
            >
              {member.url && (
                <img
                  src={member.url}
                  alt={member.characterName}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-white text-xs font-bold truncate">
                  {member.characterName}
                </p>
                <p className="text-white/70 text-xs truncate">
                  {member.actorName}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Scenes Grid */}
      {activeTab === 'scenes' && (
        <div className="grid grid-cols-3 gap-3">
          {scenes.map((scene, idx) => (
            <button
              key={scene.id}
              onClick={() => handleImageClick(idx)}
              className="group relative overflow-hidden rounded-lg aspect-video bg-paper-200 hover:ring-2 hover:ring-accent-blue transition-all hover:scale-105"
            >
              <img
                src={scene.url}
                alt="Scene"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-white text-2xl transition-opacity">
                  +
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Videos Grid - 2 columns for larger thumbnails */}
      {activeTab === 'videos' && (
        <div className="grid grid-cols-2 gap-4">
          {videos.map((video, idx) => (
            <button
              key={video.id}
              onClick={() => handleImageClick(idx)}
              className="group relative overflow-hidden rounded-lg aspect-video bg-paper-200 hover:ring-2 hover:ring-accent-blue transition-all hover:scale-[1.02]"
            >
              <img
                src={video.thumbnailUrl}
                alt={video.name}
                className="w-full h-full object-cover"
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-red-600 transition-colors">
                  <span className="text-white text-2xl ml-1">▶</span>
                </div>
              </div>
              {/* Video type badge */}
              <div className="absolute top-3 left-3 bg-black/70 text-white text-sm px-2 py-1 rounded font-medium">
                {video.videoType}
              </div>
              {/* Video name */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                <p className="text-white text-sm font-medium line-clamp-2">
                  {video.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Note Input Modal with Carousel - rendered via portal to escape parent constraints */}
      {selectedItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20">
          <div
            className="absolute inset-0 bg-black/85"
            onClick={handleClose}
          />

          {/* Modal with arrows positioned next to it */}
          <div className={`relative flex items-center gap-4 ${
            selectedItem.type === 'video' ? 'w-[68vw]' : ''
          }`}>
            {/* Left Arrow */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevImage(); }}
              disabled={selectedIndex === 0}
              className={`z-50 w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-all flex-shrink-0 ${
                selectedIndex === 0
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-white/20 text-white hover:bg-white/40 hover:scale-110'
              }`}
            >
              ‹
            </button>

            {/* Modal Content - videos span most of viewport */}
            <div className={`relative bg-paper-100 rounded-xl overflow-hidden shadow-2xl ${
              selectedItem.type === 'video' ? 'w-full' : 'w-full max-w-4xl'
            }`}>
              {/* Counter */}
              <div className="absolute top-4 left-4 z-10 bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium">
                {selectedIndex + 1} / {currentList.length}
              </div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl"
              >
                ✕
              </button>

              {/* Video Player (for videos) */}
              {selectedItem.type === 'video' && (
                <div className="relative bg-black">
                  <iframe
                    src={`${(selectedItem as VideoClip).embedUrl}?autoplay=1`}
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pointer-events-none">
                    <div className="flex items-center gap-2">
                      <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">
                        {(selectedItem as VideoClip).videoType}
                      </span>
                      <h4 className="text-white text-lg font-bold truncate">
                        {(selectedItem as VideoClip).name}
                      </h4>
                    </div>
                  </div>
                </div>
              )}

              {/* Large Image (for cast/scenes) */}
              {selectedItem.type !== 'video' && (
                <div className="relative bg-black">
                  <img
                    src={selectedItem.type === 'character'
                      ? (selectedItem as CastMember).urlLarge || (selectedItem as CastMember).url || ''
                      : (selectedItem as SceneImage).urlLarge
                    }
                    alt=""
                    className={`w-full ${selectedItem.type === 'character' ? 'h-[450px] object-contain' : 'h-[400px] object-cover'}`}
                  />
                  {selectedItem.type === 'character' && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
                      <h4 className="text-white text-2xl font-bold">
                        {(selectedItem as CastMember).characterName}
                      </h4>
                      <p className="text-white/80 text-lg">
                        played by {(selectedItem as CastMember).actorName}
                      </p>
                    </div>
                  )}
                  {selectedItem.type === 'scene' && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <p className="text-white/80 text-sm">Scene {selectedIndex + 1}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Note Input */}
              <div className="p-5">
                <label className="block text-paper-700 font-medium mb-2 text-lg">
                  How'd you like this scene or character(s)?
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Type or use voice..."
                  className="w-full h-28 p-4 border-2 border-paper-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent-blue text-lg"
                />

                <div className="flex items-center gap-3 mt-4">
                  {/* Voice Button */}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-colors text-lg ${
                      isRecording
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-paper-200 text-paper-700 hover:bg-paper-300'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <span className="w-3 h-3 bg-white rounded-full" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <span>🎤</span>
                        Voice
                      </>
                    )}
                  </button>

                  <div className="flex-1" />

                  {/* Save Button */}
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteText.trim()}
                    className={`px-8 py-3 rounded-lg font-bold transition-colors text-lg ${
                      noteText.trim()
                        ? 'bg-accent-blue text-white hover:bg-blue-600'
                        : 'bg-paper-200 text-paper-400 cursor-not-allowed'
                    }`}
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
              disabled={selectedIndex === currentList.length - 1}
              className={`z-50 w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-all flex-shrink-0 ${
                selectedIndex === currentList.length - 1
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-white/20 text-white hover:bg-white/40 hover:scale-110'
              }`}
            >
              ›
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
