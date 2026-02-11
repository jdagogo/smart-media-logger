import type { Metadata } from 'next'
import './globals.css'
import DataManager from '@/components/DataManager'

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
        <nav className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 px-6 py-4 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📓</span>
              <span className="font-bold text-blue-900 text-lg tracking-wide">
                SMART MEDIA LOGGER
              </span>
              <a
                href="https://github.com/jdagogo/smart-media-logger/tree/v1.9.5-unified-preview"
                target="_blank"
                className="ml-2 text-xs font-mono px-2 py-0.5 bg-blue-900/20 text-blue-900 rounded hover:bg-blue-900/30 transition-colors"
                title="View on GitHub"
              >
                v1.9.5-alpha
              </a>
            </div>
            <DataManager />
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
