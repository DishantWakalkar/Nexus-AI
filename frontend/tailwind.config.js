/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper:   '#F1F4F1',
        sidebar: '#E7EDE8',
        step:    '#E9EFE9',
        surface: '#FBFCFB',
        border:  '#E0E7E1',
        'border-soft':  '#DBE3DC',
        'border-input': '#D6DFD7',
        ink:     '#182420',
        sage:    '#57655D',
        muted:   '#9DACA3',
        dim:     '#93A39A',
        divider: '#CDD8CF',
        forest:  '#1C8C5B',
        'forest-dark': '#166F49',
      },
      fontFamily: {
        sans:  ['Hanken Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono:  ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
