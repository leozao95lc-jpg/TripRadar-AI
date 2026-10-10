/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef3f9', 100: '#d6e1ef', 200: '#adc3df', 300: '#7f9fc9', 400: '#5579ad',
          500: '#3a5d92', 600: '#2c4876', 700: '#21385d', 800: '#182a47', 900: '#101d33', 950: '#0a1322',
        },
        verde: {
          50: '#ecfaf3', 100: '#d0f2e2', 200: '#a3e4c6', 300: '#6dcfa4', 400: '#3db480',
          500: '#1f9a67', 600: '#157c53', 700: '#136345', 800: '#124f38', 900: '#0f412f',
        },
        terra: { 50: '#fdf4ee', 100: '#fae4d4', 400: '#e0814a', 500: '#c8662e', 600: '#a84f22', 700: '#863f1e' },
        areia: { 50: '#fbfaf7', 100: '#f5f2ec', 200: '#ebe6dc', 300: '#d9d2c4' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
