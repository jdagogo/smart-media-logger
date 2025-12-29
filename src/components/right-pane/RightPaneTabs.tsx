'use client'

import { useState } from 'react'
import MediaCard from './MediaCard'
import { highlightEntities } from '@/components/shared/VoiceInput'

// Types
type RightPaneTab = 'logging' | 'upnext' | 'library' | 'recs' | 'profile'
type MediaFilter = 'all' | 'movie' | 'tv' | 'books' | 'music' | 'podcasts' | 'video'
type SortMode = 'date' | 'score'

interface QueueItem {
  id: number
  title: string
  year: number
  mediaType: string
  director?: string
  addedAt: string
}

// Data structure for "Already seen it" modal - matches MediaCard props
interface AlreadySeenData {
  title: string
  year: number
  director: string
  cinematographer?: string
  composer?: string
  starring?: string[]
  runtime?: number
  metacriticScore?: number
  rottenTomatoesScore?: number
  metacriticUrl?: string
  rottenTomatoesUrl?: string
  trailerUrl?: string
}

// Export LoggedItem type for use in parent
export interface LoggedItem extends QueueItem {
  rating?: number
  dateConsumed?: string
  notes?: string
  companionNames?: string
  socialContext?: string
  location?: string
}

interface RightPaneTabsProps {
  // Current logging session
  currentEntry?: {
    entryNumber: number
    mediaType: string
    title: string
    year?: number
    dateWatched?: string
    director?: string
    cinematographer?: string
    composer?: string
    starring?: string[]
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
    metacriticData?: any
    rottenTomatoesData?: any
    streamingOptions?: any[]
  }
  isLogging: boolean
  onEdit?: (changes: any) => void
  onTalentPreferenceChange?: (preferences: any) => void
  talentPreferences?: Record<string, 'loved' | 'not-for-me' | null>
  // Queue management - shared with parent
  upNextQueue: QueueItem[]
  onAddToQueue: (title: string, year: number, mediaType: string, director?: string) => void
  onRemoveFromQueue?: (id: number) => void
  // Logged items - shared with parent
  loggedItems: LoggedItem[]
  onAddLoggedItem?: (item: LoggedItem) => void
  onUpdateLoggedItem?: (id: number, changes: Partial<LoggedItem>) => void
}

export default function RightPaneTabs({
  currentEntry,
  isLogging,
  onEdit,
  onTalentPreferenceChange,
  talentPreferences = {},
  upNextQueue,
  onAddToQueue,
  onRemoveFromQueue,
  loggedItems,
  onAddLoggedItem,
  onUpdateLoggedItem,
}: RightPaneTabsProps) {
  const [activeTab, setActiveTab] = useState<RightPaneTab>('logging')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [recsQuery, setRecsQuery] = useState('')
  const [prefsInput, setPrefsInput] = useState('')
  const [selectedItem, setSelectedItem] = useState<LoggedItem | null>(null)
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set())

  // Track which items were just added to queue (for visual feedback)
  const [justAddedToQueue, setJustAddedToQueue] = useState<Set<string>>(new Set())

  // Track successful saves for confirmation messages
  const [justSavedToMyStuff, setJustSavedToMyStuff] = useState<string | null>(null)

  // "Already seen it" - stores full media data for MediaCard display
  const [alreadySeenItem, setAlreadySeenItem] = useState<AlreadySeenData | null>(null)
  const [alreadySeenRating, setAlreadySeenRating] = useState(70)
  const [alreadySeenTalentPrefs, setAlreadySeenTalentPrefs] = useState<Record<string, 'loved' | 'not-for-me' | null>>({})

  // Add to queue with visual feedback
  const handleAddToQueue = (title: string, year: number, mediaType: string, director?: string) => {
    onAddToQueue(title, year, mediaType, director)
    setJustAddedToQueue(prev => {
      const newSet = new Set(prev)
      newSet.add(title)
      return newSet
    })
    // Clear "Added!" after 3 seconds
    setTimeout(() => {
      setJustAddedToQueue(prev => {
        const newSet = new Set(prev)
        newSet.delete(title)
        return newSet
      })
    }, 3000)
  }

  // Handle "Already seen it" - opens MediaCard modal with full data
  const handleAlreadySeen = (data: AlreadySeenData) => {
    setAlreadySeenItem(data)
    setAlreadySeenRating(70)
    setAlreadySeenTalentPrefs({})
  }

  // Save "Already seen it" entry - ADDS TO MY STUFF
  const saveAlreadySeenEntry = () => {
    if (!alreadySeenItem) return

    // Add to My Stuff - this is a logged entry!
    const newLoggedItem: LoggedItem = {
      id: Date.now(),
      title: alreadySeenItem.title,
      year: alreadySeenItem.year,
      mediaType: 'movie',
      director: alreadySeenItem.director,
      rating: alreadySeenRating,
      dateConsumed: new Date().toISOString().split('T')[0],
      addedAt: new Date().toISOString().split('T')[0],
    }
    onAddLoggedItem?.(newLoggedItem)

    console.log('Added to My Stuff from recommendation:', {
      ...newLoggedItem,
      talentPreferences: alreadySeenTalentPrefs,
      source: 'recommendation_already_seen',
    })

    // Dismiss the recommendation
    setDismissedRecs(prev => {
      const newSet = new Set(prev)
      newSet.add(alreadySeenItem.title)
      return newSet
    })

    // Show save confirmation
    setJustSavedToMyStuff(alreadySeenItem.title)
    setTimeout(() => setJustSavedToMyStuff(null), 4000)

    setAlreadySeenItem(null)
  }

  // Dismiss recommendation with reason
  const dismissRec = (title: string, reason: 'not_interested' | 'dont_like') => {
    setDismissedRecs(prev => {
      const newSet = new Set(prev)
      newSet.add(title)
      return newSet
    })
    console.log('Recommendation dismissed:', { title, reason })
    // This would be sent to AI to improve future recommendations
  }

  // loggedItems is now passed as a prop from parent

  // COMPUTED STATS - Real data from logged items and preferences
  const computedStats = (() => {
    // Total logged
    const totalLogged = loggedItems.length

    // Average rating
    const itemsWithRatings = loggedItems.filter(item => item.rating !== undefined)
    const averageRating = itemsWithRatings.length > 0
      ? Math.round(itemsWithRatings.reduce((sum, item) => sum + (item.rating || 0), 0) / itemsWithRatings.length)
      : 0

    // By media type
    const byMediaType: Record<string, number> = {}
    loggedItems.forEach(item => {
      byMediaType[item.mediaType] = (byMediaType[item.mediaType] || 0) + 1
    })

    // Top companions - extract from companionNames
    const companionCounts: Record<string, number> = {}
    loggedItems.forEach(item => {
      if (item.companionNames) {
        item.companionNames.split(',').forEach(name => {
          const trimmed = name.trim()
          if (trimmed) {
            companionCounts[trimmed] = (companionCounts[trimmed] || 0) + 1
          }
        })
      }
    })
    const topCompanions = Object.entries(companionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Top rated items
    const topRated = [...loggedItems]
      .filter(item => item.rating !== undefined)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)

    // Directors you've watched most
    const directorCounts: Record<string, { count: number; avgRating: number; ratings: number[] }> = {}
    loggedItems.forEach(item => {
      if (item.director) {
        if (!directorCounts[item.director]) {
          directorCounts[item.director] = { count: 0, avgRating: 0, ratings: [] }
        }
        directorCounts[item.director].count++
        if (item.rating) {
          directorCounts[item.director].ratings.push(item.rating)
        }
      }
    })
    // Calculate average ratings for directors
    Object.values(directorCounts).forEach(dir => {
      if (dir.ratings.length > 0) {
        dir.avgRating = Math.round(dir.ratings.reduce((a, b) => a + b, 0) / dir.ratings.length)
      }
    })
    const topDirectors = Object.entries(directorCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, count: data.count, avgRating: data.avgRating }))

    // Viewing habits
    const soloCount = loggedItems.filter(item => item.socialContext === 'alone').length
    const socialCount = loggedItems.filter(item => item.socialContext && item.socialContext !== 'alone').length
    const theaterCount = loggedItems.filter(item => item.location === 'theater').length
    const homeCount = loggedItems.filter(item => item.location === 'home' || !item.location).length

    return {
      totalLogged,
      averageRating,
      byMediaType,
      topCompanions,
      topRated,
      topDirectors,
      soloCount,
      socialCount,
      theaterCount,
      homeCount,
    }
  })()

  const filterItems = <T extends QueueItem>(items: T[], filter: MediaFilter): T[] => {
    let filtered = items
    if (filter === 'books') {
      filtered = items.filter(i => i.mediaType === 'book' || i.mediaType === 'audiobook')
    } else if (filter === 'movie') {
      filtered = items.filter(i => i.mediaType === 'movie')
    } else if (filter === 'video') {
      filtered = items.filter(i => i.mediaType === 'video')
    } else if (filter !== 'all') {
      filtered = items.filter(i => i.mediaType === filter)
    }
    return filtered
  }

  const sortItems = <T extends QueueItem>(items: T[], sort: SortMode): T[] => {
    return [...items].sort((a, b) => {
      if (sort === 'score') {
        const aRating = (a as LoggedItem).rating ?? 0
        const bRating = (b as LoggedItem).rating ?? 0
        return bRating - aRating
      }
      // Default: sort by date (most recent first)
      const aDate = (a as LoggedItem).dateConsumed || a.addedAt || ''
      const bDate = (b as LoggedItem).dateConsumed || b.addedAt || ''
      return bDate.localeCompare(aDate)
    })
  }

  const tabs: { id: RightPaneTab; label: string }[] = [
    { id: 'logging', label: 'Now' },
    { id: 'upnext', label: 'Up Next' },
    { id: 'library', label: 'My Stuff' },
    { id: 'recs', label: 'Recommendations' },
    { id: 'profile', label: 'My Preferences & Data' },
  ]

  const mediaFilters: { id: MediaFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV' },
    { id: 'video', label: 'Video' },
    { id: 'books', label: 'Books' },
    { id: 'music', label: 'Music' },
    { id: 'podcasts', label: 'Podcasts' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Main Tabs - Styled like real tabs, 30% bigger */}
      <div className="flex bg-paper-400/50 px-3 pt-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative px-5 py-4 font-bold text-base transition-all rounded-t-xl
              ${activeTab === tab.id
                ? 'bg-paper-50 text-accent-blue shadow-md z-10'
                : 'bg-paper-300 text-ink-500 hover:text-ink-700 hover:bg-paper-200'
              }
              ${activeTab === tab.id ? '' : 'mr-1'}
            `}
          >
            {tab.label}
            {/* Active tab bottom cover */}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-paper-50 -mb-[1px]" />
            )}
          </button>
        ))}
        <div className="flex-1 bg-paper-300 rounded-tl-xl" />
      </div>
      <div className="border-t border-paper-300" />

      {/* Save Confirmation Toast */}
      {justSavedToMyStuff && (
        <div className="mx-6 mt-4 bg-green-600 text-white px-4 py-3 rounded-xl flex items-center gap-3 animate-pulse">
          <span className="text-xl">✓</span>
          <div>
            <div className="font-bold">Saved to My Stuff!</div>
            <div className="text-sm text-green-100">"{justSavedToMyStuff}" - all your data has been captured</div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* NOW LOGGING TAB */}
        {activeTab === 'logging' && (
          <div>
            {currentEntry && currentEntry.title ? (
              <MediaCard
                entryNumber={currentEntry.entryNumber}
                mediaType={currentEntry.mediaType}
                title={currentEntry.title}
                year={currentEntry.year}
                dateWatched={currentEntry.dateWatched}
                director={currentEntry.director}
                cinematographer={currentEntry.cinematographer}
                composer={currentEntry.composer}
                starring={currentEntry.starring}
                distributor={currentEntry.distributor}
                runtime={currentEntry.runtime}
                rating={currentEntry.rating}
                location={currentEntry.location}
                locationDetail={currentEntry.locationDetail}
                firstTime={currentEntry.firstTime}
                socialContext={currentEntry.socialContext}
                companionNames={currentEntry.companionNames}
                notes={currentEntry.notes}
                metacriticScore={currentEntry.metacriticScore}
                rottenTomatoesScore={currentEntry.rottenTomatoesScore}
                trailerUrl={currentEntry.trailerUrl}
                metacriticUrl={currentEntry.metacriticUrl}
                rottenTomatoesUrl={currentEntry.rottenTomatoesUrl}
                metacriticData={currentEntry.metacriticData}
                rottenTomatoesData={currentEntry.rottenTomatoesData}
                streamingOptions={currentEntry.streamingOptions}
                isBuilding={isLogging}
                onEdit={onEdit}
                onTalentPreferenceChange={onTalentPreferenceChange}
                initialTalentPreferences={talentPreferences}
              />
            ) : (
              <div className="text-center py-16 text-ink-500">
                <div className="text-4xl mb-4">🎬</div>
                <p className="text-lg">Search for something to log</p>
                <p className="text-sm mt-2">Your entry will appear here</p>
              </div>
            )}
          </div>
        )}

        {/* UP NEXT TAB */}
        {activeTab === 'upnext' && (
          <div>
            {/* Media Type Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {mediaFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setMediaFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mediaFilter === filter.id
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200 border border-paper-400'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-ink-500">Sort:</span>
              <div className="flex rounded-lg overflow-hidden border border-paper-400">
                <button
                  onClick={() => setSortMode('date')}
                  className={`px-3 py-1 text-sm font-medium transition-all ${
                    sortMode === 'date'
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
                  }`}
                >
                  Date
                </button>
                <button
                  onClick={() => setSortMode('score')}
                  className={`px-3 py-1 text-sm font-medium transition-all ${
                    sortMode === 'score'
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
                  }`}
                >
                  Score
                </button>
              </div>
            </div>

            {/* Queue Items */}
            <div className="space-y-3">
              {sortItems(filterItems(upNextQueue, mediaFilter), sortMode).length > 0 ? (
                sortItems(filterItems(upNextQueue, mediaFilter), sortMode).map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-4 border-2 border-paper-300 hover:border-accent-blue transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-ink-800">{item.title}</h3>
                        <p className="text-sm text-ink-500">
                          {item.year} {item.director && `• ${item.director}`}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded uppercase font-medium ${
                        item.mediaType === 'book' || item.mediaType === 'audiobook' ? 'bg-amber-100 text-amber-700' :
                        item.mediaType === 'tv' ? 'bg-purple-100 text-purple-700' :
                        item.mediaType === 'podcast' ? 'bg-green-100 text-green-700' :
                        item.mediaType === 'music' ? 'bg-pink-100 text-pink-700' :
                        item.mediaType === 'video' ? 'bg-red-100 text-red-700' :
                        'bg-paper-300 text-ink-600'
                      }`}>
                        {item.mediaType === 'movie' ? 'Movie' :
                         item.mediaType === 'audiobook' ? 'Audiobook' :
                         item.mediaType}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="text-sm text-accent-blue hover:underline font-medium">
                        Log It
                      </button>
                      <span className="text-paper-400">|</span>
                      <button
                        onClick={() => onRemoveFromQueue?.(item.id)}
                        className="text-sm text-ink-500 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-ink-500">
                  <div className="text-4xl mb-4">📋</div>
                  <p>No items in your queue</p>
                  <p className="text-sm mt-2">Search to add something to Up Next</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LIBRARY TAB */}
        {activeTab === 'library' && (
          <div>
            {/* Media Type Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {mediaFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setMediaFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mediaFilter === filter.id
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200 border border-paper-400'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-ink-500">Sort:</span>
              <div className="flex rounded-lg overflow-hidden border border-paper-400">
                <button
                  onClick={() => setSortMode('date')}
                  className={`px-3 py-1 text-sm font-medium transition-all ${
                    sortMode === 'date'
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
                  }`}
                >
                  Date
                </button>
                <button
                  onClick={() => setSortMode('score')}
                  className={`px-3 py-1 text-sm font-medium transition-all ${
                    sortMode === 'score'
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200'
                  }`}
                >
                  Score
                </button>
              </div>
            </div>

            {/* Logged Items - Clickable to view/edit */}
            <div className="space-y-3">
              {sortItems(filterItems(loggedItems, mediaFilter), sortMode).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="w-full text-left bg-white rounded-xl p-4 border-2 border-paper-300 hover:border-accent-blue hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-ink-800">{item.title}</h3>
                      <p className="text-sm text-ink-500">
                        {item.year} {item.director && `• ${item.director}`}
                      </p>
                      {item.dateConsumed && (
                        <p className="text-xs text-ink-400 mt-1">
                          Watched {item.dateConsumed}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {item.rating && (
                        <span className={`text-lg font-bold ${
                          item.rating >= 90 ? 'text-red-600' :
                          item.rating >= 80 ? 'text-green-600' :
                          item.rating >= 60 ? 'text-orange-600' :
                          'text-accent-blue'
                        }`}>
                          {item.rating}%
                        </span>
                      )}
                      <span className="text-accent-blue text-xl">→</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Selected Item - Shows full MediaCard in the pane */}
            {selectedItem && (
              <div className="mt-6 pt-6 border-t-2 border-paper-400">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-ink-800">Viewing Entry</h3>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-accent-blue hover:underline text-sm font-medium"
                  >
                    ← Back to My Stuff
                  </button>
                </div>

                {/* Full MediaCard for this item - EDITABLE */}
                <MediaCard
                  entryNumber={0}
                  mediaType={selectedItem.mediaType}
                  title={selectedItem.title}
                  year={selectedItem.year}
                  director={selectedItem.director}
                  rating={selectedItem.rating}
                  dateWatched={selectedItem.dateConsumed}
                  isBuilding={true}
                  onEdit={(changes) => {
                    // Update the item in loggedItems via parent callback
                    if (changes.rating !== undefined) {
                      onUpdateLoggedItem?.(selectedItem.id, { rating: changes.rating })
                      // Update selectedItem to reflect change
                      setSelectedItem({ ...selectedItem, rating: changes.rating })
                    }
                    console.log('Updated entry:', { id: selectedItem.id, changes })
                  }}
                />

                {/* YOUR EXPERIENCE - All captured data */}
                <div className="mt-6 bg-paper-200 rounded-xl p-5 space-y-4">
                  <h4 className="font-bold text-ink-800 flex items-center gap-2">
                    <span className="text-xl">📝</span> Your Experience
                  </h4>

                  {/* Social Context - Who you watched with */}
                  {(selectedItem.companionNames || selectedItem.socialContext) && (
                    <div className="flex items-start gap-3">
                      <span className="text-lg">👥</span>
                      <div>
                        <span className="text-ink-600 text-sm">Watched </span>
                        <span className="text-ink-800 font-medium">
                          {selectedItem.socialContext === 'alone' ? 'solo' :
                           selectedItem.companionNames ? `with ${selectedItem.companionNames}` :
                           selectedItem.socialContext ? `with ${selectedItem.socialContext}` : ''}
                        </span>
                        {selectedItem.location && (
                          <span className="text-ink-600 text-sm"> at {selectedItem.location === 'theater' ? 'the theater' : 'home'}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes - The full feedback with entity highlighting */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-ink-600 text-sm">
                        <span>💭</span> Your Notes
                      </div>
                      <button
                        onClick={() => {
                          const newNotes = prompt('Edit your notes:', selectedItem.notes || '')
                          if (newNotes !== null) {
                            onUpdateLoggedItem?.(selectedItem.id, { notes: newNotes })
                            setSelectedItem({ ...selectedItem, notes: newNotes })
                          }
                        }}
                        className="text-xs px-2 py-1 bg-accent-blue/10 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors"
                      >
                        {selectedItem.notes ? '✏️ Edit' : '+ Add Notes'}
                      </button>
                    </div>
                    {selectedItem.notes ? (
                      <>
                        <div className="bg-white rounded-lg p-4 text-ink-700 leading-relaxed border border-paper-300">
                          {highlightEntities(selectedItem.notes)}
                        </div>

                        {/* Entity legend */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500 pt-2">
                          <span>Entities:</span>
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 border border-blue-300 rounded">Actor</span>
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-300 rounded">Director</span>
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 border border-green-300 rounded">Musician</span>
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 border border-orange-300 rounded">Band</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-ink-500 text-sm italic">
                        No notes recorded yet. Click "Add Notes" above to share your thoughts.
                      </div>
                    )}
                  </div>

                  {/* Date consumed */}
                  {selectedItem.dateConsumed && (
                    <div className="flex items-center gap-2 text-ink-600 text-sm pt-2 border-t border-paper-300">
                      <span>📅</span>
                      <span>Logged on {(() => {
                        // Parse date without timezone shift
                        const dateStr = selectedItem.dateConsumed
                        // Handle YYYY-MM-DD format
                        if (dateStr.includes('-')) {
                          const parts = dateStr.split('-')
                          if (parts.length === 3) {
                            const [year, month, day] = parts.map(Number)
                            // Sanity check the year
                            const safeYear = year > 2030 || year < 1900 ? new Date().getFullYear() : year
                            const date = new Date(safeYear, month - 1, day)
                            return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                          }
                        }
                        // Fallback: try direct parse
                        try {
                          const date = new Date(dateStr + 'T12:00:00') // Add noon to avoid timezone issues
                          return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        } catch {
                          return dateStr
                        }
                      })()}</span>
                    </div>
                  )}
                </div>

                {/* Add to Queue for rewatch */}
                <button
                  onClick={() => {
                    handleAddToQueue(selectedItem.title, selectedItem.year, selectedItem.mediaType, selectedItem.director)
                  }}
                  disabled={justAddedToQueue.has(selectedItem.title)}
                  className={`w-full mt-4 px-4 py-3 rounded-xl font-bold transition-colors ${
                    justAddedToQueue.has(selectedItem.title)
                      ? 'bg-green-600 text-white'
                      : 'bg-paper-300 text-ink-700 hover:bg-paper-400'
                  }`}
                >
                  {justAddedToQueue.has(selectedItem.title)
                    ? '✓ Added to Up Next!'
                    : '+ Add to Up Next (Rewatch)'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* RECOMMENDATIONS TAB */}
        {activeTab === 'recs' && (
          <div className="space-y-6">
            {/* If rating an "already seen" item, show full MediaCard inline (not a modal) */}
            {alreadySeenItem ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-accent-blue text-xl">You've seen this!</h3>
                  <button
                    onClick={() => setAlreadySeenItem(null)}
                    className="text-accent-blue hover:underline text-sm font-medium"
                  >
                    ← Back to Recommendations
                  </button>
                </div>

                {/* Full MediaCard - EDITABLE */}
                <MediaCard
                  entryNumber={0}
                  mediaType="movie"
                  title={alreadySeenItem.title}
                  year={alreadySeenItem.year}
                  director={alreadySeenItem.director}
                  cinematographer={alreadySeenItem.cinematographer}
                  composer={alreadySeenItem.composer}
                  starring={alreadySeenItem.starring}
                  runtime={alreadySeenItem.runtime}
                  rating={alreadySeenRating}
                  metacriticScore={alreadySeenItem.metacriticScore}
                  rottenTomatoesScore={alreadySeenItem.rottenTomatoesScore}
                  metacriticUrl={alreadySeenItem.metacriticUrl}
                  rottenTomatoesUrl={alreadySeenItem.rottenTomatoesUrl}
                  trailerUrl={alreadySeenItem.trailerUrl}
                  isBuilding={true}
                  onEdit={(changes) => {
                    if (changes.rating !== undefined) {
                      setAlreadySeenRating(changes.rating)
                    }
                  }}
                  onTalentPreferenceChange={(prefs) => {
                    setAlreadySeenTalentPrefs(prefs)
                  }}
                  initialTalentPreferences={alreadySeenTalentPrefs}
                />

                {/* Action Buttons */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => {
                      handleAddToQueue(alreadySeenItem.title, alreadySeenItem.year, 'movie', alreadySeenItem.director)
                    }}
                    disabled={justAddedToQueue.has(alreadySeenItem.title)}
                    className={`w-full px-4 py-3 rounded-xl font-bold transition-colors ${
                      justAddedToQueue.has(alreadySeenItem.title)
                        ? 'bg-green-600 text-white'
                        : 'bg-paper-300 text-ink-700 hover:bg-paper-400'
                    }`}
                  >
                    {justAddedToQueue.has(alreadySeenItem.title)
                      ? '✓ Added to Up Next!'
                      : '+ Add to Up Next (Rewatch)'}
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setAlreadySeenItem(null)}
                      className="flex-1 px-4 py-3 bg-paper-300 text-ink-700 rounded-xl font-bold hover:bg-paper-400 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveAlreadySeenEntry}
                      className="flex-1 px-4 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      Save to My Stuff
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            <>
            {/* AI Chat Input - THE POWER OF AI */}
            <div className="bg-accent-blue/10 border-2 border-accent-blue rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-bold text-accent-blue mb-1">Ask Me Anything</h3>
                  <p className="text-ink-600 text-sm">
                    Tell me what you're in the mood for and I'll find the perfect match.
                  </p>
                </div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); console.log('AI Query:', recsQuery); }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={recsQuery}
                    onChange={(e) => setRecsQuery(e.target.value)}
                    placeholder="I'm at home tonight, want something intense..."
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-accent-blue bg-white text-ink-800 placeholder-ink-400"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-accent-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                  >
                    Ask
                  </button>
                </div>
              </form>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  "What should I watch tonight?",
                  "Something like Anora",
                  "Best new releases",
                  "Hidden gems I'd love",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setRecsQuery(suggestion)}
                    className="text-xs px-3 py-1.5 bg-white border border-accent-blue text-accent-blue rounded-full hover:bg-accent-blue hover:text-white transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Type Filters */}
            <div className="flex gap-2 flex-wrap">
              {mediaFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setMediaFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mediaFilter === filter.id
                      ? 'bg-accent-blue text-white'
                      : 'bg-paper-100 text-ink-600 hover:bg-paper-200 border border-paper-400'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Recommendation Categories - Full data for MediaCard consistency */}
            {(() => {
              // Full recommendation data with all MediaCard fields
              const ptaRecs: AlreadySeenData[] = [
                {
                  title: 'The Master',
                  year: 2012,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Mihai Mălaimare Jr.',
                  composer: 'Jonny Greenwood',
                  starring: ['Joaquin Phoenix', 'Philip Seymour Hoffman', 'Amy Adams'],
                  runtime: 138,
                  metacriticScore: 86,
                  rottenTomatoesScore: 85,
                  metacriticUrl: 'https://www.metacritic.com/movie/the-master',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_master_2012',
                  trailerUrl: 'https://www.youtube.com/embed/fJ1O1vb9AUU',
                },
                {
                  title: 'Punch-Drunk Love',
                  year: 2002,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Robert Elswit',
                  composer: 'Jon Brion',
                  starring: ['Adam Sandler', 'Emily Watson', 'Philip Seymour Hoffman'],
                  runtime: 95,
                  metacriticScore: 78,
                  rottenTomatoesScore: 79,
                  metacriticUrl: 'https://www.metacritic.com/movie/punch-drunk-love',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/punchdrunk_love',
                  trailerUrl: 'https://www.youtube.com/embed/bSN9v1SeDEY',
                },
                {
                  title: 'The Power of the Dog',
                  year: 2021,
                  director: 'Jane Campion',
                  cinematographer: 'Ari Wegner',
                  composer: 'Jonny Greenwood',
                  starring: ['Benedict Cumberbatch', 'Kirsten Dunst', 'Jesse Plemons', 'Kodi Smit-McPhee'],
                  runtime: 126,
                  metacriticScore: 89,
                  rottenTomatoesScore: 94,
                  metacriticUrl: 'https://www.metacritic.com/movie/the-power-of-the-dog',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_power_of_the_dog',
                  trailerUrl: 'https://www.youtube.com/embed/ELvKuuXdfCU',
                },
              ]

              const trendingRecs: (AlreadySeenData & { match: string })[] = [
                {
                  title: 'The Brutalist',
                  year: 2024,
                  director: 'Brady Corbet',
                  cinematographer: 'Lol Crawley',
                  composer: 'Daniel Blumberg',
                  starring: ['Adrien Brody', 'Felicity Jones', 'Guy Pearce'],
                  runtime: 215,
                  metacriticScore: 91,
                  rottenTomatoesScore: 93,
                  metacriticUrl: 'https://www.metacritic.com/movie/the-brutalist',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/the_brutalist',
                  trailerUrl: 'https://www.youtube.com/embed/example1',
                  match: '94% match',
                },
                {
                  title: 'A Real Pain',
                  year: 2024,
                  director: 'Jesse Eisenberg',
                  starring: ['Jesse Eisenberg', 'Kieran Culkin'],
                  runtime: 90,
                  metacriticScore: 80,
                  rottenTomatoesScore: 91,
                  metacriticUrl: 'https://www.metacritic.com/movie/a-real-pain',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/a_real_pain',
                  trailerUrl: 'https://www.youtube.com/embed/example2',
                  match: '91% match',
                },
                {
                  title: 'Nickel Boys',
                  year: 2024,
                  director: 'RaMell Ross',
                  starring: ['Ethan Herisse', 'Brandon Wilson'],
                  runtime: 140,
                  metacriticScore: 86,
                  rottenTomatoesScore: 97,
                  metacriticUrl: 'https://www.metacritic.com/movie/nickel-boys',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/nickel_boys',
                  trailerUrl: 'https://www.youtube.com/embed/example3',
                  match: '89% match',
                },
              ]

              const ptaFilmography: AlreadySeenData[] = [
                {
                  title: 'Boogie Nights',
                  year: 1997,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Robert Elswit',
                  composer: 'Michael Penn',
                  starring: ['Mark Wahlberg', 'Julianne Moore', 'Burt Reynolds', 'John C. Reilly'],
                  runtime: 155,
                  metacriticScore: 85,
                  rottenTomatoesScore: 93,
                  metacriticUrl: 'https://www.metacritic.com/movie/boogie-nights',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/boogie_nights',
                  trailerUrl: 'https://www.youtube.com/embed/example4',
                },
                {
                  title: 'Magnolia',
                  year: 1999,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Robert Elswit',
                  composer: 'Jon Brion',
                  starring: ['Tom Cruise', 'Julianne Moore', 'Philip Seymour Hoffman', 'John C. Reilly'],
                  runtime: 188,
                  metacriticScore: 77,
                  rottenTomatoesScore: 83,
                  metacriticUrl: 'https://www.metacritic.com/movie/magnolia',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/magnolia',
                  trailerUrl: 'https://www.youtube.com/embed/example5',
                },
                {
                  title: 'Hard Eight',
                  year: 1996,
                  director: 'Paul Thomas Anderson',
                  cinematographer: 'Robert Elswit',
                  starring: ['Philip Baker Hall', 'John C. Reilly', 'Gwyneth Paltrow', 'Samuel L. Jackson'],
                  runtime: 102,
                  metacriticScore: 70,
                  rottenTomatoesScore: 82,
                  metacriticUrl: 'https://www.metacritic.com/movie/hard-eight',
                  rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/hard_eight',
                  trailerUrl: 'https://www.youtube.com/embed/example6',
                },
              ]

              // Render helper for recommendation cards
              const renderRecCard = (rec: AlreadySeenData, match?: string) => (
                <div key={rec.title} className="p-4 bg-paper-50 rounded-lg border border-paper-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-ink-800">{rec.title} ({rec.year})</div>
                      <div className="text-sm text-ink-500">{rec.director}</div>
                      {match && <div className="text-sm text-green-600 font-medium mt-1">{match}</div>}
                    </div>
                    <button
                      onClick={() => handleAddToQueue(rec.title, rec.year, 'movie', rec.director)}
                      disabled={justAddedToQueue.has(rec.title)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                        justAddedToQueue.has(rec.title)
                          ? 'bg-green-600 text-white'
                          : 'bg-accent-blue text-white hover:bg-blue-700'
                      }`}
                    >
                      {justAddedToQueue.has(rec.title) ? '✓ Added!' : '+ Add to Queue'}
                    </button>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-paper-200">
                    <button
                      onClick={() => handleAlreadySeen(rec)}
                      className="text-xs px-3 py-1.5 bg-accent-blue/10 text-accent-blue rounded-full hover:bg-accent-blue/20 transition-colors font-medium"
                    >
                      Already seen it
                    </button>
                    <button
                      onClick={() => dismissRec(rec.title, 'not_interested')}
                      className="text-xs px-3 py-1.5 bg-paper-200 text-ink-600 rounded-full hover:bg-paper-300 transition-colors"
                    >
                      Not interested
                    </button>
                    <button
                      onClick={() => dismissRec(rec.title, 'dont_like')}
                      className="text-xs px-3 py-1.5 bg-paper-200 text-ink-600 rounded-full hover:bg-paper-300 transition-colors"
                    >
                      Don't like this type
                    </button>
                  </div>
                </div>
              )

              return (
                <div className="space-y-4">
                  {/* Because you loved... */}
                  <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                    <h4 className="font-bold text-ink-800 mb-1">Because you loved Paul Thomas Anderson</h4>
                    <p className="text-sm text-ink-500 mb-4">Directors with similar style and vision</p>
                    <div className="space-y-3">
                      {ptaRecs.filter(rec => !dismissedRecs.has(rec.title)).map(rec => renderRecCard(rec))}
                    </div>
                  </div>

                  {/* Trending with similar tastes */}
                  <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                    <h4 className="font-bold text-ink-800 mb-1">Trending with Similar Tastes</h4>
                    <p className="text-sm text-ink-500 mb-4">Popular with people who rated like you</p>
                    <div className="space-y-3">
                      {trendingRecs.filter(rec => !dismissedRecs.has(rec.title)).map(rec => renderRecCard(rec, rec.match))}
                    </div>
                  </div>

                  {/* Complete the collection */}
                  <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                    <h4 className="font-bold text-ink-800 mb-1">Complete the Collection</h4>
                    <p className="text-sm text-ink-500 mb-4">You've seen 3 of 9 PTA films</p>
                    <div className="space-y-3">
                      {ptaFilmography.filter(rec => !dismissedRecs.has(rec.title)).map(rec => renderRecCard(rec))}
                    </div>
                  </div>
                </div>
              )
            })()}
            </>
            )}
          </div>
        )}

        {/* MY PREFERENCES & DATA TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* AI Input for adding preferences - THE POWER OF AI */}
            <div className="bg-accent-blue/10 border-2 border-accent-blue rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-bold text-accent-blue mb-1">Tell Me About Yourself</h3>
                  <p className="text-ink-600 text-sm">
                    Share your preferences, moods, or anything that helps me understand your taste better.
                  </p>
                </div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); console.log('Preference Input:', prefsInput); setPrefsInput(''); }}>
                <textarea
                  value={prefsInput}
                  onChange={(e) => setPrefsInput(e.target.value)}
                  placeholder="I love slow-burn dramas, hate jump scares, prefer practical effects over CGI, always watch foreign films with subtitles..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-accent-blue bg-white text-ink-800 placeholder-ink-400 resize-none"
                  rows={3}
                />
                <div className="flex justify-between items-center mt-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "I love...",
                      "I hate...",
                      "My favorite genre is...",
                      "I usually watch with...",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setPrefsInput(prompt + ' ')}
                        className="text-xs px-3 py-1.5 bg-white border border-accent-blue text-accent-blue rounded-full hover:bg-accent-blue hover:text-white transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={!prefsInput.trim()}
                    className={`px-6 py-2 rounded-xl font-bold transition-colors ${
                      prefsInput.trim()
                        ? 'bg-accent-blue text-white hover:bg-blue-700'
                        : 'bg-paper-300 text-ink-400 cursor-not-allowed'
                    }`}
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>

            {/* Overview Stats - REAL DATA */}
            <div className="bg-white rounded-xl p-5 border-2 border-accent-blue">
              <h3 className="font-bold text-accent-blue mb-4">Your Stats</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-ink-800">{computedStats.totalLogged}</div>
                  <div className="text-sm text-ink-500">Logged</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    computedStats.averageRating >= 90 ? 'text-red-600' :
                    computedStats.averageRating >= 80 ? 'text-green-600' :
                    computedStats.averageRating >= 60 ? 'text-orange-600' :
                    'text-accent-blue'
                  }`}>{computedStats.averageRating}%</div>
                  <div className="text-sm text-ink-500">Avg Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-ink-800">{Object.keys(computedStats.byMediaType).length}</div>
                  <div className="text-sm text-ink-500">Categories</div>
                </div>
              </div>
            </div>

            {/* Your Top Rated - REAL DATA */}
            {computedStats.topRated.length > 0 && (
              <div className="bg-white rounded-xl p-5 border-2 border-accent-blue">
                <h3 className="font-bold text-accent-blue mb-4">Your Favorites</h3>
                <div className="space-y-3">
                  {computedStats.topRated.map((item, idx) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-accent-blue">#{idx + 1}</span>
                        <div>
                          <span className="text-ink-800 font-medium">{item.title}</span>
                          <span className="text-ink-500 text-sm ml-2">({item.year})</span>
                        </div>
                      </div>
                      <span className={`font-bold text-lg ${
                        (item.rating || 0) >= 90 ? 'text-red-600' :
                        (item.rating || 0) >= 80 ? 'text-green-600' :
                        (item.rating || 0) >= 60 ? 'text-orange-600' :
                        'text-accent-blue'
                      }`}>{item.rating}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Directors You Love - REAL DATA */}
            {computedStats.topDirectors.length > 0 && (
              <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                <h3 className="font-bold text-ink-800 mb-4">Directors You Watch</h3>
                <div className="space-y-3">
                  {computedStats.topDirectors.map((director) => (
                    <div key={director.name} className="flex justify-between items-center">
                      <span className="text-ink-800">{director.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-ink-500 text-sm">{director.count} {director.count === 1 ? 'film' : 'films'}</span>
                        {director.avgRating > 0 && (
                          <span className={`font-bold ${
                            director.avgRating >= 90 ? 'text-red-600' :
                            director.avgRating >= 80 ? 'text-green-600' :
                            director.avgRating >= 60 ? 'text-orange-600' :
                            'text-accent-blue'
                          }`}>{director.avgRating}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Media Type - REAL DATA */}
            <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
              <h3 className="font-bold text-ink-800 mb-4">By Media Type</h3>
              <div className="space-y-2">
                {Object.entries(computedStats.byMediaType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-ink-600 capitalize">
                      {type === 'movie' ? 'Movies' : type === 'tv' ? 'TV Shows' : type}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-paper-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-blue rounded-full"
                          style={{ width: `${(count / computedStats.totalLogged) * 100}%` }}
                        />
                      </div>
                      <span className="font-bold text-ink-800 w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Viewing Habits - REAL DATA */}
            <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
              <h3 className="font-bold text-ink-800 mb-4">Viewing Habits</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-paper-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-ink-800">{computedStats.soloCount}</div>
                  <div className="text-sm text-ink-500">Solo Watches</div>
                </div>
                <div className="bg-paper-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-ink-800">{computedStats.socialCount}</div>
                  <div className="text-sm text-ink-500">With Others</div>
                </div>
                <div className="bg-paper-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-ink-800">{computedStats.theaterCount}</div>
                  <div className="text-sm text-ink-500">In Theaters</div>
                </div>
                <div className="bg-paper-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-ink-800">{computedStats.homeCount}</div>
                  <div className="text-sm text-ink-500">At Home</div>
                </div>
              </div>
            </div>

            {/* Top Companions - REAL DATA */}
            {computedStats.topCompanions.length > 0 && (
              <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                <h3 className="font-bold text-ink-800 mb-4">Most Frequent Companions</h3>
                <div className="space-y-3">
                  {computedStats.topCompanions.map((companion, idx) => (
                    <div key={companion.name} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•'}</span>
                        <span className="text-ink-800">{companion.name}</span>
                      </div>
                      <span className="text-ink-500">{companion.count} {companion.count === 1 ? 'time' : 'times'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Talent Preferences - Combined from props and local state */}
            {(() => {
              // Merge talent preferences from props and alreadySeenTalentPrefs
              const allTalentPrefs = { ...talentPreferences, ...alreadySeenTalentPrefs }
              const lovedTalent = Object.entries(allTalentPrefs).filter(([_, pref]) => pref === 'loved')
              const notForMeTalent = Object.entries(allTalentPrefs).filter(([_, pref]) => pref === 'not-for-me')

              if (lovedTalent.length === 0 && notForMeTalent.length === 0) return null

              return (
                <div className="bg-white rounded-xl p-5 border-2 border-paper-300">
                  <h3 className="font-bold text-ink-800 mb-4">Your Talent Preferences</h3>

                  {lovedTalent.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-bold text-red-600 mb-2 flex items-center gap-1">
                        <span>♥</span> People You Love
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lovedTalent.map(([name]) => (
                          <span key={name} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium border border-red-200">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {notForMeTalent.length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-ink-500 mb-2">Not For You</div>
                      <div className="flex flex-wrap gap-2">
                        {notForMeTalent.map(([name]) => (
                          <span key={name} className="px-3 py-1 bg-paper-200 text-ink-500 rounded-full text-sm border border-paper-400">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>

    </div>
  )
}
