'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface DatePickerProps {
  value: string // YYYY-MM-DD format
  onChange: (date: string) => void
  className?: string
}

export default function DatePicker({ value, onChange, className = '' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number)
      return new Date(year, month - 1, 1)
    }
    return new Date()
  })
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle SSR - only render portal after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Position the dropdown when it opens
  useEffect(() => {
    if (isOpen && triggerRef.current && mounted) {
      const rect = triggerRef.current.getBoundingClientRect()
      // For position: fixed, use viewport coordinates directly
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        zIndex: 9999,
      })
    }
  }, [isOpen, mounted])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      // Use a small delay to avoid immediate close
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Update viewDate when value changes
  useEffect(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number)
      setViewDate(new Date(year, month - 1, 1))
    }
  }, [value])

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select date'
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const handleSelectDate = (day: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth() + 1
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(dateStr)
    setIsOpen(false)
  }

  const handleQuickSelect = (daysAgo: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    onChange(dateStr)
    setIsOpen(false)
  }

  const daysInMonth = getDaysInMonth(viewDate)
  const firstDay = getFirstDayOfMonth(viewDate)
  const days: (number | null)[] = []

  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const calendarContent = (
    <div
      ref={dropdownRef}
      className="bg-white rounded-xl shadow-2xl border-2 border-accent-blue p-4 w-80"
      style={dropdownStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick Select Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={(e) => handleQuickSelect(0, e)}
          className="flex-1 py-2 px-3 rounded-lg bg-accent-blue text-white font-bold text-sm hover:bg-blue-700 transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={(e) => handleQuickSelect(1, e)}
          className="flex-1 py-2 px-3 rounded-lg bg-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-300 transition-colors"
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={(e) => handleQuickSelect(7, e)}
          className="flex-1 py-2 px-3 rounded-lg bg-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-300 transition-colors"
        >
          Last Week
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-bold text-gray-800 text-lg">
          {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs font-bold text-gray-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="w-9 h-9" />
          }

          const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = dateStr === value
          const isToday = dateStr === todayStr

          return (
            <button
              key={day}
              type="button"
              onClick={(e) => handleSelectDate(day, e)}
              className={`
                w-9 h-9 rounded-lg font-medium text-sm transition-colors
                ${isSelected
                  ? 'bg-accent-blue text-white'
                  : isToday
                    ? 'bg-blue-100 text-accent-blue font-bold'
                    : 'hover:bg-gray-100 text-gray-700'
                }
              `}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Clear Button */}
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onChange('')
            setIsOpen(false)
          }}
          className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Clear date
        </button>
      )}
    </div>
  )

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left bg-white border-2 border-accent-blue rounded-lg px-4 py-2 font-medium text-gray-800 hover:bg-blue-50 transition-colors flex items-center justify-between"
      >
        <span>{formatDateForDisplay(value)}</span>
        <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar Dropdown - rendered via portal to escape overflow containers */}
      {isOpen && mounted && createPortal(calendarContent, document.body)}
    </div>
  )
}
