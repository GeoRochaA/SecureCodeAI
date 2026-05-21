/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-dark': '#0f172a',
        'cyber-darker': '#0b1120',
        'cyber-blue': '#2563eb',
        'cyber-purple': '#7c3aed',
        'cyber-green': '#22c55e',
        'cyber-red': '#ef4444',
        'cyber-yellow': '#f59e0b',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
