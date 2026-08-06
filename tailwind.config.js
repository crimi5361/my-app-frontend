/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{html,js,ts,tsx,jsx}"], // Suppression de l'espace en trop
  theme: {
    extend: {
      // Pont vers les jetons de src/theme/tokens.css : ces couleurs suivent
      // automatiquement le thème clair/sombre puisqu'elles pointent vers les
      // mêmes variables CSS (pas de valeurs dupliquées en dur ici).
      colors: {
        ink: "var(--ink)",
        "ink-deep": "var(--ink-deep)",
        gold: "var(--gold)",
        paper: "var(--paper)",
        mist: "var(--mist)",
        "ink-soft": "var(--ink-soft)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "text-soft": "var(--text-soft)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        "mod-scolarite": "var(--mod-scolarite)",
        "mod-caisse": "var(--mod-caisse)",
        "mod-comptabilite": "var(--mod-comptabilite)",
        "mod-fondateur": "var(--mod-fondateur)",
        "mod-administration": "var(--mod-administration)",
      },
      fontFamily: {
        tinos: ["Tinos", "serif"], // Correction de la syntaxe
        sora: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        manrope: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        token: "var(--shadow)",
        "token-lift": "var(--shadow-lift)",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};
