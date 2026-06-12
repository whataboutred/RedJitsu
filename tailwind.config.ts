import type { Config } from "tailwindcss"

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        // Brand colors
        brand: {
          red: "#DC2626",
          "red-soft": "#FF3B3B",
          dark: "#0D0B0C",
          gray: "#1A1517",
        },
        // Activity colors
        strength: {
          DEFAULT: "#DC2626",
          light: "#FCA5A5",
          dark: "#991B1B",
        },
        bjj: {
          DEFAULT: "#7C3AED",
          light: "#C4B5FD",
          dark: "#5B21B6",
        },
        cardio: {
          DEFAULT: "#10B981",
          light: "#6EE7B7",
          dark: "#047857",
        },
        // Semantic colors
        success: "#059669",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
        // Surface colors (warm-tinted)
        surface: {
          DEFAULT: "#1A1517",
          elevated: "#241F22",
          pressed: "#3A3335",
          border: "rgba(255, 255, 255, 0.08)",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        "18": "4.5rem",
        "22": "5.5rem",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        "glow-red": "0 0 24px rgba(220, 38, 38, 0.35)",
        "glow-red-soft": "0 0 12px rgba(220, 38, 38, 0.15)",
        "glow-purple": "0 0 20px rgba(124, 58, 237, 0.3)",
        "glow-green": "0 0 20px rgba(16, 185, 129, 0.3)",
        "card": "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
        "card-hover": "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-strength": "linear-gradient(135deg, #DC2626 0%, #F97316 100%)",
        "gradient-bjj": "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
        "gradient-cardio": "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
        "gradient-hero": "linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)",
        "gradient-surface": "linear-gradient(180deg, rgba(220, 38, 38, 0.06) 0%, transparent 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config
