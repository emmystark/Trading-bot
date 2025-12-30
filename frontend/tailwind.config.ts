import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',  // For App Router
    './pages/**/*.{js,ts,jsx,tsx,mdx}',  // For Pages Router (if applicable)
    './components/**/*.{js,ts,jsx,tsx,mdx}',  // Your components
    './src/**/*.{js,ts,jsx,tsx,mdx}',  // If using src directory
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;