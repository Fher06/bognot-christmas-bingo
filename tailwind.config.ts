import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pine: "#0B3D2E",
        holly: "#146C43",
        cranberry: "#B3122E",
        gold: "#D4AF37",
        cream: "#FBF4E6",
        midnight: "#0A1F2B",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
