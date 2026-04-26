import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sticky: {
          pain: '#fecaca',
          needs: '#bfdbfe',
          idea: '#bbf7d0',
          general: '#fef08a',
        },
      },
    },
  },
  plugins: [],
}

export default config
