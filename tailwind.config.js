/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#22d3ee',
        secondary: '#a78bfa',
        accent: '#34d399',
        'bg-dark': '#09090b',
        'bg-card': 'rgba(24, 24, 27, 0.8)',
        'text-main': '#f4f4f5',
        'text-muted': '#a1a1aa',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
