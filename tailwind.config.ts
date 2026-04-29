import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Apple Design System
        primary: {
          DEFAULT: '#0066cc',
          focus: '#0071e3',
          'on-dark': '#2997ff',
        },
        ink: {
          DEFAULT: '#1d1d1f',
          'muted-80': '#333333',
          'muted-48': '#7a7a7a',
        },
        canvas: {
          DEFAULT: '#ffffff',
          parchment: '#f5f5f7',
        },
        surface: {
          pearl: '#fafafc',
          'tile-1': '#272729',
          'tile-2': '#2a2a2c',
          'tile-3': '#252527',
          black: '#000000',
          chip: '#d2d2d7',
        },
        hairline: '#e0e0e0',
        divider: {
          soft: '#f0f0f0',
        },
        'on-primary': '#ffffff',
        'on-dark': '#ffffff',
        'body-muted': '#cccccc',
        // Post-it note colors (preserved)
        sticky: {
          pain: '#fecaca',
          needs: '#bfdbfe',
          idea: '#bbf7d0',
          general: '#fef08a',
        },
      },
      fontFamily: {
        'sf-display': ['SF Pro Display', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'sf-text': ['SF Pro Text', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'hero': ['56px', { lineHeight: '1.07', letterSpacing: '-0.28px', fontWeight: '600' }],
        'display-lg': ['40px', { lineHeight: '1.1', letterSpacing: '0', fontWeight: '600' }],
        'display-md': ['34px', { lineHeight: '1.47', letterSpacing: '-0.374px', fontWeight: '600' }],
        'lead': ['28px', { lineHeight: '1.14', letterSpacing: '0.196px', fontWeight: '400' }],
        'lead-airy': ['24px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '300' }],
        'tagline': ['21px', { lineHeight: '1.19', letterSpacing: '0.231px', fontWeight: '600' }],
        'body-apple': ['17px', { lineHeight: '1.47', letterSpacing: '-0.374px', fontWeight: '400' }],
        'body-strong': ['17px', { lineHeight: '1.24', letterSpacing: '-0.374px', fontWeight: '600' }],
        'caption-apple': ['14px', { lineHeight: '1.43', letterSpacing: '-0.224px', fontWeight: '400' }],
        'caption-strong': ['14px', { lineHeight: '1.29', letterSpacing: '-0.224px', fontWeight: '600' }],
        'fine-print': ['12px', { lineHeight: '1.0', letterSpacing: '-0.12px', fontWeight: '400' }],
      },
      borderRadius: {
        'xs': '5px',
        'apple-sm': '8px',
        'apple-md': '11px',
        'apple-lg': '18px',
        'pill': '9999px',
      },
      spacing: {
        'section': '80px',
      },
      boxShadow: {
        'product': '3px 5px 30px rgba(0, 0, 0, 0.22)',
      },
    },
  },
  plugins: [typography],
}

export default config
