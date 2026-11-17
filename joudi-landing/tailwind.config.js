/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      screens: { xs: "400px" },
      colors: {
        ivory: { DEFAULT: "#FAF6F0", 2: "#F3ECE1", 3: "#E9DFD0" },
        wine: { DEFAULT: "#5A1E2B", 2: "#471621", 3: "#2E0D15", soft: "#7A3140" },
        gold: { DEFAULT: "#C9A36A", light: "#E6CC9A", pale: "#F2E3C4", deep: "#9C7A45" },
        coal: { DEFAULT: "#1E1816", 2: "#2A2220", 3: "#140F0E" },
        ink: "#3A2A27",
      },
      fontFamily: {
        display: ['"El Messiri"', "serif"],
        body: ["Tajawal", "system-ui", "sans-serif"],
        latin: ['"Cormorant Garamond"', "serif"],
      },
      transitionTimingFunction: {
        lux: "cubic-bezier(0.19, 1, 0.22, 1)",
        silk: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
    },
  },
  plugins: [],
};
