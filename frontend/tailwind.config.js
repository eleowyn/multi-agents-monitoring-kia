/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        /* ── Theme-aware semantic tokens ── */
        page: "var(--c-page)",
        card: "var(--c-card)",
        subtle: "var(--c-subtle)",
        muted: "var(--c-muted)",
        heading: "var(--c-heading)",
        body: "var(--c-body)",
        label: "var(--c-label)",
        caption: "var(--c-caption)",
        dim: "var(--c-dim)",
        line: {
          DEFAULT: "var(--c-line)",
          light: "var(--c-line-light)",
        },

        /* ── Accent tokens (for dark mode tinted surfaces) ── */
        "accent-sky": "var(--c-accent-sky)",
        "accent-pink": "var(--c-accent-pink)",
        "accent-amber": "var(--c-accent-amber)",
        "accent-emerald": "var(--c-accent-emerald)",
        "accent-red": "var(--c-accent-red)",
        "accent-rose": "var(--c-accent-rose)",
        "accent-blue": "var(--c-accent-blue)",

        /* ── Static primary & health colors ── */
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        health: {
          green: "#059669",
          yellow: "#d97706",
          red: "#dc2626",
          blue: "#0ea5e9",
        },
      },
      borderRadius: {
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
        prominent: "var(--shadow-prominent)",
      },
      animation: {
        "skeleton-pulse":
          "skeleton-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 250ms ease-out",
        "scale-in": "scaleIn 250ms ease-out",
        "slide-up": "slideInUp 250ms ease-out",
      },
      keyframes: {
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        slideInUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
