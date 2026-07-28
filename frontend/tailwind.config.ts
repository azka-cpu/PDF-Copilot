import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1E1B4B",       // deep indigo - sidebar, headings
        paper: "#FAF9F6",     // warm off-white - main workspace
        teal: {
          DEFAULT: "#0D9488",
          dark: "#0F766E",
          light: "#CCFBF1",
        },
        amber: {
          DEFAULT: "#F59E0B",
          light: "#FEF3C7",
          border: "#FDE68A",
        },
        rose: {
          DEFAULT: "#E11D48",
          light: "#FFE4E6",
        },
        slate: {
          text: "#334155",
          muted: "#94A3B8",
        },
      },
      fontFamily: {
        display: ["var(--font-manrope)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
