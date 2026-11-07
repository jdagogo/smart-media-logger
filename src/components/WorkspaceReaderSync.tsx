'use client'
import { useEffect } from 'react'

// Copies only SML's application data to a local read mirror. No remote credential,
// application write, UI change, or cloud upload occurs in this component.
const keys = new Set(['smartMediaLogger_draft', 'smartMediaLogger_queue', 'smartMediaLogger_logged',
  'smartMediaLogger_theaters', 'smartMediaLogger_preferences', 'smartMediaLogger_savedMusic',
  'smartMediaLogger_dismissedRecs', 'smartMediaLogger_interactions'])
const allowed = (key: string) => keys.has(key) || /^(hero_pinned_|soundtrack_overrides_)[a-z0-9_ -]{1,180}$/.test(key)
export default function WorkspaceReaderSync() {
  useEffect(() => {
    if (!['http://localhost:3006', 'http://127.0.0.1:3006'].includes(location.origin)) return
    let stopped = false, pending = false, previous = '', sentAt = 0
    const sync = async () => {
      if (stopped || pending) return
      pending = true
      try {
        const data: Record<string, unknown> = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key || !allowed(key)) continue
          const raw = localStorage.getItem(key)
          if (raw === null) continue
          try { data[key] = JSON.parse(raw) } catch { data[key] = raw }
        }
        const body = JSON.stringify({ data })
        if (body === previous && Date.now() - sentAt < 30000) return
        const response = await fetch('/api/workspace-reader-snapshot', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Workspace-Reader': 'local-sml-v1' }, body,
        })
        if (response.ok) { previous = body; sentAt = Date.now() }
      } catch { /* The application stays usable when the optional reader is unavailable. */ }
      finally { pending = false }
    }
    void sync()
    const timer = setInterval(() => { void sync() }, 5000)
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener('focus', sync) }
  }, [])
  return null
}
