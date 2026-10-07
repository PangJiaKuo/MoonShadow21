/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 深色塔罗/蒸汽朋克基调
        abyss: '#0b0a12',
        felt: '#141226',
        brass: '#c9a45c',
        'brass-dim': '#8a6f3c',
        gold: '#e8c876',
        parchment: '#efe3c0',
        crimson: '#a03a3a',
        ember: '#ff9d3c',
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['"Noto Serif SC"', '"Songti SC"', 'serif'],
      },
      boxShadow: {
        gold: '0 0 18px rgba(232, 200, 118, 0.35)',
        'gold-lg': '0 0 40px rgba(232, 200, 118, 0.5)',
      },
      backgroundImage: {
        'radial-gold':
          'radial-gradient(circle at 50% 30%, rgba(201,164,92,0.18), transparent 60%)',
      },
    },
  },
  plugins: [],
};
