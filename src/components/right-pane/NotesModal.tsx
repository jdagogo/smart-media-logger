'use client'

import { useState, useEffect, useRef } from 'react'

interface NotesModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (notes: string) => void
  movieTitle: string
  initialNotes?: string
}

export default function NotesModal({
  isOpen,
  onClose,
  onSave,
  movieTitle,
  initialNotes = '',
}: NotesModalProps) {
  const [notes, setNotes] = useState(initialNotes)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset notes when modal opens with new initial value
  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes)
      // Focus the textarea when modal opens
      setTimeout(() => {
        textareaRef.current?.focus()
        // Move cursor to end
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.value.length
          textareaRef.current.selectionEnd = textareaRef.current.value.length
        }
      }, 100)
    }
  }, [isOpen, initialNotes])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleSave = () => {
    onSave(notes)
    onClose()
  }

  // Count words
  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-accent-blue text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">Edit Notes</h2>
            <p className="text-white/80 text-sm">{movieTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you think? How did it make you feel? What stood out to you? What will you remember most?"
            className="flex-1 w-full bg-paper-50 border-2 border-paper-300 rounded-xl px-5 py-4 text-lg text-ink-800 leading-relaxed resize-none focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 min-h-[300px]"
          />

          {/* Word count */}
          <div className="text-right text-ink-400 text-sm mt-2">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-paper-100 px-6 py-4 flex items-center justify-between border-t border-paper-300 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 text-ink-600 hover:text-ink-800 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  )
}
