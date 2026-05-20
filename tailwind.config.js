/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          void: "#0B0F19",
          slate: "#111827",
          panel: "#1F2937",
          border: "#374151"
        },
        brand: {
          violet: "#6366F1",
          purple: "#8B5CF6",
          teal: "#14B8A6"
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse': 'glowPulse 2s infinite alternate'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        glowPulse: {
          '0%': { boxShadow: '0 0 4px rgba(99, 102, 241, 0.2), 0 0 8px rgba(99, 102, 241, 0.2)' },
          '100%': { boxShadow: '0 0 12px rgba(99, 102, 241, 0.6), 0 0 20px rgba(99, 102, 241, 0.4)' }
        }
      }
    },
  },
  plugins: [],
}
