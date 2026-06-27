import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Bai Jamjuree', 'sans-serif'],
        heading: ['Bai Jamjuree', 'sans-serif'],
        body: ['Bai Jamjuree', 'sans-serif'],
        brand: ['Bai Jamjuree', 'sans-serif'],
      },
      colors: {
        bg: '#050A06',
        bg2: '#070D08',
        card: '#0A110B',
        border: '#122016',
        lime: '#A3E635',
        green: {
          DEFAULT: '#16A34A',
          dark: '#166534',
          mid: '#4ADE80',
        },
      },
      backgroundImage: {
        'lime-gradient': 'linear-gradient(135deg, #A3E635, #166534)',
        'card-gradient': 'linear-gradient(145deg, #0A1F0C, #0D2E10)',
      },
    },
  },
  plugins: [],
}

export default config
