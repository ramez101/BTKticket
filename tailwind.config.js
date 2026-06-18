/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        btk: {
          blue:      '#1565C0',
          light:     '#1976D2',
          dark:      '#0D47A1',
          bg:        '#E3F2FD',
          accent:    '#0288D1',
          silver:    '#B0BEC5',
          gray:      '#607D8B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
