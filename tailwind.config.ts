import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pine: "#0C2340",
        holly: "#2851C4",
        cranberry: "#ED1D24",
        gold: "#FFD100",
        cream: "#F1F3F6",
        midnight: "#05070F",
      },
      fontFamily: {
        display: ["var(--font-hero)", "Impact", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
