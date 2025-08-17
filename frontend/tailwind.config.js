// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  // This tells Tailwind to scan all your component files for class names.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  // This is where we enable the blur effect.
  theme: {
    extend: {
      colors: {
        // You can name your color whatever you want
        'brand-green': '#00875A',
        'darker-green': '#006A48',
      },
      // By adding this, you are telling Tailwind to generate
      // the `backdrop-blur-sm` class that our modal uses.
      backdropBlur: {
        xs: '2px',
        sm: '4px', // We'll add 'sm' just in case
      }
    },
  },

  // No special plugins are needed for this.
  plugins: [],
}