/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          PRIMARY: '#FA4029',
          hover: '#DE321D',
        },
        dark: {
          bg: '#050D09',        // Dark green near black
          surface: '#0E1F16',   // Card background
          border: '#1E382A',    // Border color
          text: '#ECF3EE',      // Primary text
          muted: '#8BA393',     // Secondary text
        }
      }
    },
  },
  plugins: [],
}
