'use client'

import { useState, useCallback } from 'react'
import { getRatingColor } from '@/lib/ratingColors'

interface RatingSliderProps {
  value: number
  onChange: (value: number) => void
}

export default function RatingSlider({ value, onChange }: RatingSliderProps) {
  const [isDragging, setIsDragging] = useState(false)

  // Convert 1-100 rating to stars (0-5 scale for fill calculation)
  const starFillPercent = value / 100 * 5

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10))
  }, [onChange])

  // Get gradient for slider track
  const getSliderGradient = (rating: number) => {
    const color = getRatingColor(rating)
    return `linear-gradient(to right, ${color} 0%, ${color} ${rating}%, #D4C9B5 ${rating}%, #D4C9B5 100%)`
  }

  const ratingColor = getRatingColor(value)

  // Render a single star with partial fill
  const renderStar = (index: number) => {
    const fillAmount = Math.max(0, Math.min(1, starFillPercent - index))

    return (
      <div key={index} className="relative text-4xl">
        {/* Empty star background */}
        <span className="text-ink-300">☆</span>
        {/* Filled star overlay with clip - color changes with rating */}
        <span
          className="absolute inset-0 overflow-hidden transition-colors duration-300"
          style={{ width: `${fillAmount * 100}%`, color: ratingColor }}
        >
          ★
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stars Row with Percentage */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map(renderStar)}
        </div>
        <span
          className={`
            text-3xl font-bold ml-4 min-w-[80px] text-right transition-all duration-300
            ${isDragging ? 'scale-110' : ''}
          `}
          style={{ color: ratingColor }}
        >
          {value}%
        </span>
      </div>

      {/* Slider */}
      <div className="relative py-2">
        <input
          type="range"
          min="1"
          max="100"
          value={value}
          onChange={handleSliderChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="w-full h-4 rounded-full appearance-none cursor-pointer transition-all duration-300"
          style={{
            background: getSliderGradient(value)
          }}
        />
      </div>

      {/* Quick Select Buttons */}
      <div className="flex gap-3 justify-center flex-wrap">
        {[20, 40, 60, 80, 100].map((quickValue) => (
          <button
            key={quickValue}
            type="button"
            onClick={() => onChange(quickValue)}
            className={`
              px-5 py-3 rounded-xl font-medium transition-all
              ${value === quickValue
                ? 'bg-accent-blue text-white'
                : 'bg-paper-300 text-ink-600 hover:bg-paper-400'
              }
            `}
          >
            {quickValue}%
          </button>
        ))}
      </div>
    </div>
  )
}
