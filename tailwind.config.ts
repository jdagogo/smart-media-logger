import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Clean, modern aesthetic (inspired by Willow)
        paper: {
          50: '#FFFFFF',      // Pure white
          100: '#FAFAFA',     // Near white
          200: '#F5F5F7',     // Very light gray (main content)
          300: '#EFEFEF',     // Light gray (sidebar/secondary)
          400: '#E5E5E5',     // Border gray
          500: '#D1D1D1',     // Darker border
        },
        // Clean gray ink colors
        ink: {
          100: '#E5E5E5',
          200: '#C7C7C7',
          300: '#A3A3A3',     // Light text
          400: '#737373',     // Secondary text
          500: '#525252',     // Medium text
          600: '#404040',
          700: '#2D2D2D',
          800: '#1A1A1A',     // Primary text
          900: '#0A0A0A',
        },
        accent: {
          blue: '#6366F1',    // Indigo/purple (like Willow)
          navy: '#4F46E5',    // Darker indigo
          sky: '#818CF8',     // Lighter indigo
          green: '#10B981',   // Modern green
          forest: '#059669',
          wine: '#EC4899',    // Pink accent
        }
      },
      fontFamily: {
        typewriter: ['Courier New', 'Courier', 'monospace'],
        body: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'soft': '0 1px 3px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
export default config
