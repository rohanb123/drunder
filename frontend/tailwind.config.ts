import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0f172a", muted: "#475569" },
        surface: { DEFAULT: "#f8fafc", card: "#ffffff" },
        accent: { DEFAULT: "#0d9488", hover: "#0f766e" },
      },
    },
  },
  plugins: [],
};
export default config;
