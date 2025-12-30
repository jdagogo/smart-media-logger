'use client'

import { useState, useEffect } from 'react'

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

// Structured note with rich metadata for preference learning
export interface CharacterSceneNote {
  id: string
  type: 'character' | 'scene'
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
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [noteText, setNoteText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [showScenes, setShowScenes] = useState(false)

  // Get current list and selected image based on mode
  const currentList = showScenes ? scenes : cast
  const selectedImage = selectedIndex >= 0 ? currentList[selectedIndex] : null

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
    if (!selectedImage || !noteText.trim()) return

    if (onNoteAdded) {
      const baseNote = {
        id: `${Date.now()}-${selectedImage.id}`,
        note: noteText.trim(),
        timestamp: new Date().toISOString(),
        movieTitle,
        movieYear,
        movieId,
      }

      if (selectedImage.type === 'character') {
        const castMember = selectedImage as CastMember
        onNoteAdded({
          ...baseNote,
          type: 'character',
          actorName: castMember.actorName,
          characterName: castMember.characterName,
          actorThumbnail: castMember.urlLarge || castMember.url || undefined,
        })
      } else {
        const scene = selectedImage as SceneImage
        onNoteAdded({
          ...baseNote,
          type: 'scene',
          sceneIndex: selectedIndex + 1,
          sceneThumbnail: scene.urlLarge || scene.url,
        })
      }
    }

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
    <div className="bg-paper-100 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-paper-800 text-lg">
          What did you think about these scenes or characters?
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScenes(false)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              !showScenes
                ? 'bg-accent-blue text-white'
                : 'bg-paper-200 text-paper-600 hover:bg-paper-300'
            }`}
          >
            Cast ({cast.length})
          </button>
          <button
            onClick={() => setShowScenes(true)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              showScenes
                ? 'bg-accent-blue text-white'
                : 'bg-paper-200 text-paper-600 hover:bg-paper-300'
            }`}
          >
            Scenes ({scenes.length})
          </button>
        </div>
      </div>

      {/* Cast Grid */}
      {!showScenes && (
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
      {showScenes && (
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

      {/* Note Input Modal with Carousel */}
      {selectedImage && (
        <div className={`fixed inset-0 z-50 flex items-start justify-center ${selectedImage.type === 'scene' ? 'pt-32' : 'pt-24'}`}>
          <div
            className="absolute inset-0 bg-black/85"
            onClick={handleClose}
          />

          {/* Modal with arrows positioned next to it */}
          <div className="relative flex items-center gap-4">
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

            {/* Modal Content */}
            <div className="relative bg-paper-100 rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl">
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

              {/* Large Image */}
              <div className="relative bg-black">
                <img
                  src={selectedImage.type === 'character'
                    ? (selectedImage as CastMember).urlLarge || (selectedImage as CastMember).url || ''
                    : (selectedImage as SceneImage).urlLarge
                  }
                  alt=""
                  className={`w-full ${selectedImage.type === 'character' ? 'h-[450px] object-contain' : 'h-[400px] object-cover'}`}
                />
                {selectedImage.type === 'character' && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
                    <h4 className="text-white text-2xl font-bold">
                      {(selectedImage as CastMember).characterName}
                    </h4>
                    <p className="text-white/80 text-lg">
                      played by {(selectedImage as CastMember).actorName}
                    </p>
                  </div>
                )}
                {selectedImage.type === 'scene' && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p className="text-white/80 text-sm">Scene {selectedIndex + 1}</p>
                  </div>
                )}
              </div>

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
        </div>
      )}
    </div>
  )
}
