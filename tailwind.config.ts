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
        // Lo-fi cream/paper aesthetic
        paper: {
          50: '#FDFCF9',
          100: '#F9F6F0',
          200: '#F5F1E8',  // Primary cream background
          300: '#EDE8DB',
          400: '#D4C9B5',
          500: '#C4B89E',
        },
        // Warm ink colors - NO GRAY
        ink: {
          100: '#D4C4A8',
          200: '#B8A888',
          300: '#8B7355',  // Warm medium
          400: '#7A6548',
          500: '#5C4B32',  // Secondary text
          600: '#4A3D2A',
          700: '#3D3022',
          800: '#2C2416',  // Primary text
          900: '#1A150D',
        },
        accent: {
          blue: '#2B5A8A',
          navy: '#1E3A5F',
          sky: '#4A90D9',
          green: '#4A7C59',
          forest: '#4A7C59',
          wine: '#8B3A4C',
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
