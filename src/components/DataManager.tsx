'use client'

import { useState, useRef } from 'react'

const STORAGE_KEYS = [
  'smartMediaLogger_draft',
  'smartMediaLogger_queue',
  'smartMediaLogger_logged',
  'smartMediaLogger_theaters',
  'smartMediaLogger_preferences',
  'smartMediaLogger_savedMusic',
  'smartMediaLogger_dismissedRecs',
  'smartMediaLogger_interactions',
]

export default function DataManager() {
  const [showMenu, setShowMenu] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const data: Record<string, unknown> = {}
    let itemCount = 0

    for (const key of STORAGE_KEYS) {
      const value = localStorage.getItem(key)
      if (value) {
        try {
          data[key] = JSON.parse(value)
          if (Array.isArray(data[key])) {
            itemCount += (data[key] as unknown[]).length
          }
        } catch {
          data[key] = value
        }
      }
    }

    data._exportMeta = {
      exportedAt: new Date().toISOString(),
      version: 'v1.9.5-alpha',
      keyCount: Object.keys(data).length - 1,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smart-media-logger-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)

    setStatus(`Exported ${itemCount} items`)
    setTimeout(() => setStatus(null), 3000)
    setShowMenu(false)
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const processImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)

        // Validate it looks like our export
        const validKeys = Object.keys(data).filter(k => STORAGE_KEYS.includes(k))
        if (validKeys.length === 0) {
          setStatus('Invalid file — no Smart Media Logger data found')
          setTimeout(() => setStatus(null), 4000)
          return
        }

        const existing = STORAGE_KEYS.filter(k => localStorage.getItem(k))
        const willOverwrite = existing.length > 0

        const confirmed = willOverwrite
          ? window.confirm(
              `This will replace your existing data (${existing.length} categories). ` +
              `Importing ${validKeys.length} categories from file. Continue?`
            )
          : true

        if (!confirmed) return

        let itemCount = 0
        for (const key of validKeys) {
          const value = data[key]
          localStorage.setItem(key, JSON.stringify(value))
          if (Array.isArray(value)) itemCount += value.length
        }

        setStatus(`Imported ${itemCount} items — reload to see changes`)
        setTimeout(() => setStatus(null), 5000)
        setShowMenu(false)
      } catch {
        setStatus('Failed to parse file')
        setTimeout(() => setStatus(null), 4000)
      }
    }
    reader.readAsText(file)

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="text-blue-900 font-semibold bg-blue-900/15 hover:bg-blue-900/25 rounded-lg px-4 py-2 text-base transition-colors tracking-wide"
        title="Data Management"
      >
        ⚙ Data Manager
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-64 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="font-semibold text-gray-800 text-sm">Data Management</div>
              <div className="text-xs text-gray-500 mt-0.5">Export or import your logged media</div>
            </div>

            <div className="p-2">
              <button
                onClick={handleExport}
                className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition-colors group"
              >
                <div className="font-medium text-gray-800 text-sm group-hover:text-blue-700">
                  Export Data
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Download all logged films, queue, and preferences as JSON
                </div>
              </button>

              <button
                onClick={handleImport}
                className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition-colors group"
              >
                <div className="font-medium text-gray-800 text-sm group-hover:text-blue-700">
                  Import Data
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Load data from a previously exported JSON file
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {status && (
        <div className="absolute right-0 top-full mt-2 bg-blue-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-50">
          {status}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={processImport}
        className="hidden"
      />
    </div>
  )
}
