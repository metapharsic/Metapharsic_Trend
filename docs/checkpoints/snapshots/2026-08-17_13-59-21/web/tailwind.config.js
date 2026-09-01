/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eefbf3",
          100: "#d6f5e2",
          200: "#aeebc9",
          300: "#7bdaac",
          400: "#46c08c",
          500: "#22a571",
          600: "#15845a",
          700: "#136a4a",
          800: "#12543c",
          900: "#0f4533",
          950: "#08281d",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
