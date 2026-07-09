/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ff5c35',
          hover: '#ff481f'
        },
        background: '#0B1120',
        surface: '#1E293B',
        border: '#334155'
      }
    },
  },
  plugins: [],
}
