import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#f4f0e6",
          50: "#f9f6ee",
          100: "#f4f0e6",
          200: "#ebe5d5",
        },
        ink: {
          DEFAULT: "#0a0a0a",
          soft: "#1a1a1a",
          mute: "#6b6b6b",
        },
        pink: {
          DEFAULT: "#ff1f6e",
          soft: "#ffd6e4",
        },
        blue: {
          DEFAULT: "#2e5bff",
          soft: "#d4dcff",
        },
        yellow: {
          DEFAULT: "#f4d951",
        },
      },
      fontFamily: {
        display: ["var(--font-body)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        hard: "4px 4px 0 #0a0a0a",
        "hard-sm": "2px 2px 0 #0a0a0a",
        "hard-pink": "4px 4px 0 #ff1f6e",
        "hard-blue": "4px 4px 0 #2e5bff",
      },
    },
  },
  plugins: [],
};

export default config;
