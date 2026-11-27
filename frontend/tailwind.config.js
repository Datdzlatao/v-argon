/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      colors: {
        fb: {
          bg: '#F0F2F5',
          card: '#FFFFFF',
          hover: '#E4E6E9',
          blue: '#1877F2',
          blueDark: '#166FE5',
          text: '#050505',
          muted: '#65676B',
          border: '#CED0D4',
          divider: '#E4E6EB',
          badge: '#E7F3FF',
        },
        farm: {
          emerald: '#10B981',
          green: '#22C55E',
          dark: '#064E3B',
          light: '#ECFDF5',
          950: '#073b21',
          900: '#0b4f2a',
          800: '#0f6b35',
          700: '#168344',
          600: '#21a45a',
          100: '#e8f6ed',
          50: '#f3faf5',
          ink: '#14211a',
          muted: '#627067',
          line: '#dce8df',
          gold: '#d7a72f',
        }
      },
      boxShadow: {
        'fb-card': '0 1px 2px rgba(0, 0, 0, 0.1)',
        'fb-popover': '0 12px 28px 0 rgba(0, 0, 0, 0.2), 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}
