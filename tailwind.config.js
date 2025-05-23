/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.css',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        outline: 'var(--outline)',
        danger: 'var(--danger)',
        accent: 'var(--accent)',
      },
    },
  },
  plugins: [],
} 