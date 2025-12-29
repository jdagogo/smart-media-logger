import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Smart Media Logger',
  description: 'AI-powered media consumption tracking - Part of UnitedTribes Ecosystem',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper-200">
        <nav className="bg-paper-100 border-b border-paper-400 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📓</span>
              <span className="font-typewriter text-ink-800 text-lg tracking-wide">
                SMART MEDIA LOGGER
              </span>
              <a
                href="/smart-media-logger-versions.html"
                target="_blank"
                className="ml-2 text-xs font-mono px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300 hover:bg-amber-200 transition-colors"
                title="View version info and known issues"
              >
                v0.1.0-alpha
              </a>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="/"
                className="font-typewriter text-sm text-ink-600 hover:text-ink-800 transition-colors"
              >
                LOG
              </a>
              <a
                href="/library"
                className="font-typewriter text-sm text-ink-600 hover:text-ink-800 transition-colors"
              >
                LIBRARY
              </a>
              <a
                href="/queue"
                className="font-typewriter text-sm text-ink-600 hover:text-ink-800 transition-colors flex items-center gap-1"
              >
                QUEUE
                <span className="bg-accent-sky text-white text-xs px-2 py-0.5 rounded-full">0</span>
              </a>
            </div>
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
