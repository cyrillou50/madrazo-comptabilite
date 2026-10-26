import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#08090a', 900: '#0d0f11', 850: '#121518', 800: '#171a1e' },
        blood: { 700: '#8d151b', 600: '#ab1e25', 500: '#c52a32', 400: '#e14a51' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        panel: '0 18px 50px rgba(0,0,0,.28)',
        glow: '0 0 0 1px rgba(197,42,50,.2), 0 12px 40px rgba(141,21,27,.16)',
      },
    },
  },
  plugins: [],
} satisfies Config;
