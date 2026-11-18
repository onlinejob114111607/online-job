/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      screens: { xs: "400px" },
      colors: {
        ivory: { DEFAULT: "#F7F4FF", 2: "#EFEAFD", 3: "#E3DBFA" },
        wine: { DEFAULT: "#3B2496", 2: "#2a1b63", 3: "#1A1240", soft: "#5B3CC4" },
        gold: { DEFAULT: "#EDB23A", light: "#FFD677", pale: "#FFEBB8", deep: "#C48A12" },
        coal: { DEFAULT: "#0F0B1F", 2: "#1A1533", 3: "#09071A" },
        ink: "#2A1B63",
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
