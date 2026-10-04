/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0F1B2E',
          light: '#16283F',
          lighter: '#1E3350'
        },
        paper: {
          DEFAULT: '#F6F3EA',
          dim: '#EDE8D8'
        },
        brass: {
          DEFAULT: '#C08829',
          light: '#DFA94A',
          dark: '#96691C'
        },
        slate: {
          DEFAULT: '#46586B'
        },
        seal: {
          green: '#2F7A4D',
          red: '#B23A34'
        }
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,27,46,0.06), 0 4px 16px rgba(15,27,46,0.06)',
        panel: '0 8px 30px rgba(15,27,46,0.35)'
      },
      backgroundImage: {
        ledger: "repeating-linear-gradient(180deg, rgba(15,27,46,0.035) 0px, rgba(15,27,46,0.035) 1px, transparent 1px, transparent 32px)"
      }
    }
  },
  plugins: []
}
