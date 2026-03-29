/**
 * Metacritic-style rating color scheme with gradient blending
 *
 * Bands:
 * - 0-39: Red (unfavorable) - brighter red at lower scores
 * - 40-64: Yellow (mixed/average)
 * - 65-100: Green (favorable) - starts light, gets brighter at higher scores
 */

/**
 * Get the color for a rating score (0-100)
 * Returns a hex color string
 */
export function getRatingColor(score: number): string {
  // Red range: 0-39 (brighter red at lower scores)
  if (score <= 19) return '#DC2626'  // red-600 - worst
  if (score <= 29) return '#EF4444'  // red-500
  if (score <= 39) return '#F87171'  // red-400 - transitioning out of red

  // Yellow range: 40-64
  if (score <= 49) return '#D97706'  // amber-600 - darker yellow
  if (score <= 57) return '#F59E0B'  // amber-500 - mid yellow
  if (score <= 64) return '#FBBF24'  // amber-400 - lighter yellow, transitioning

  // Green range: 65-100 (brighter green at higher scores)
  if (score <= 70) return '#4ADE80'  // green-400 - light green, just entering
  if (score <= 79) return '#22C55E'  // green-500 - solid green
  if (score <= 89) return '#16A34A'  // green-600 - bright green
  return '#15803D'                    // green-700 - brightest/deepest green for 90+
}

/**
 * Get Tailwind CSS class for a rating score
 * For use in className strings
 */
export function getRatingColorClass(score: number): string {
  // Red range: 0-39
  if (score <= 19) return 'text-red-600'
  if (score <= 29) return 'text-red-500'
  if (score <= 39) return 'text-red-400'

  // Yellow range: 40-64
  if (score <= 49) return 'text-amber-600'
  if (score <= 57) return 'text-amber-500'
  if (score <= 64) return 'text-amber-400'

  // Green range: 65-100
  if (score <= 70) return 'text-green-400'
  if (score <= 79) return 'text-green-500'
  if (score <= 89) return 'text-green-600'
  return 'text-green-700'
}

/**
 * Get the sentiment label for a rating score
 */
export function getRatingSentiment(score: number): 'unfavorable' | 'mixed' | 'favorable' {
  if (score <= 39) return 'unfavorable'
  if (score <= 64) return 'mixed'
  return 'favorable'
}

/**
 * Get background color class for rating badges
 */
export function getRatingBgClass(score: number): string {
  if (score <= 19) return 'bg-red-600'
  if (score <= 29) return 'bg-red-500'
  if (score <= 39) return 'bg-red-400'
  if (score <= 49) return 'bg-amber-600'
  if (score <= 57) return 'bg-amber-500'
  if (score <= 64) return 'bg-amber-400'
  if (score <= 70) return 'bg-green-400'
  if (score <= 79) return 'bg-green-500'
  if (score <= 89) return 'bg-green-600'
  return 'bg-green-700'
}
