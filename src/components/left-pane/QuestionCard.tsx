'use client'

import { ReactNode, useState } from 'react'

interface QuestionCardProps {
  questionNumber: number
  totalQuestions: number
  questionId?: string // e.g. 'date', 'location', 'rating' - identifies which question this is
  onBack?: () => void
  onSkip?: () => void
  onContinue?: () => void
  onFeedback?: (feedback: { questionId: string; suggestion: string }) => void
  canContinue?: boolean
  showBack?: boolean
  children: ReactNode
}

export default function QuestionCard({
  questionNumber,
  totalQuestions,
  questionId = 'unknown',
  onBack,
  onSkip,
  onContinue,
  onFeedback,
  canContinue = true,
  showBack = true,
  children,
}: QuestionCardProps) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  const handleSubmitFeedback = () => {
    if (feedbackText.trim()) {
      // Log to console for now - could send to API later
      console.log('Question Feedback:', {
        questionId,
        questionNumber,
        suggestion: feedbackText,
        timestamp: new Date().toISOString(),
      })

      // Call parent callback if provided
      if (onFeedback) {
        onFeedback({ questionId, suggestion: feedbackText })
      }

      setFeedbackSubmitted(true)
      setTimeout(() => {
        setShowFeedbackForm(false)
        setFeedbackText('')
        setFeedbackSubmitted(false)
      }, 2000)
    }
  }

  return (
    <div className="bg-paper-50 rounded-2xl p-10 shadow-card animate-fade-in w-full border-2 border-accent-blue">
      {/* Header with back button and progress */}
      <div className="flex items-center justify-between mb-8">
        {showBack && onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-ink-800 hover:text-accent-blue transition-colors"
          >
            <span className="text-xl">←</span>
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        <span className="text-ink-800 font-typewriter">
          {questionNumber} of {totalQuestions}
        </span>
      </div>

      {/* Question Content */}
      <div className="mb-8">
        {children}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {onSkip && (
          <button
            onClick={onSkip}
            className="px-6 py-4 text-ink-800 hover:text-accent-blue transition-colors"
          >
            Skip
          </button>
        )}
        {onContinue && (
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className={`
              flex-1 px-8 py-4 rounded-xl font-medium transition-all text-lg
              ${canContinue
                ? 'bg-accent-blue text-white hover:bg-blue-600 shadow-soft'
                : 'bg-paper-300 text-ink-800 cursor-not-allowed'
              }
            `}
          >
            Continue
          </button>
        )}
      </div>

      {/* Feedback Section */}
      <div className="mt-6 pt-6 border-t border-paper-300">
        {!showFeedbackForm ? (
          <button
            onClick={() => setShowFeedbackForm(true)}
            className="text-ink-800 hover:text-accent-blue transition-colors"
          >
            Improve This Question
          </button>
        ) : feedbackSubmitted ? (
          <div className="text-accent-blue font-medium">
            Thanks for your feedback!
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-accent-blue font-bold">
              How can we improve this question?
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g., 'Add more location options' or 'The wording is confusing'"
              className="w-full p-4 rounded-xl border-2 border-accent-blue bg-white text-ink-800 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFeedbackForm(false)
                  setFeedbackText('')
                }}
                className="px-4 py-2 text-ink-800 hover:text-accent-blue transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedbackText.trim()}
                className={`
                  px-6 py-2 rounded-lg font-medium transition-all
                  ${feedbackText.trim()
                    ? 'bg-accent-blue text-white hover:bg-blue-600'
                    : 'bg-paper-300 text-ink-800 cursor-not-allowed'
                  }
                `}
              >
                Submit Feedback
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
