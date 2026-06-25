/**
 * Semantic design tokens for the mobile app.
 *
 * Mirrors the BuildPro web artifact palette (construction-app/src/index.css)
 * so both artifacts share one cohesive visual identity: a slate neutral base
 * with an amber primary accent. HSL values from index.css are converted to hex.
 *
 * useColors() automatically switches between `light` and `dark` based on the
 * device appearance setting.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: "#172030",
    tint: "#f59e0b",

    // Core surfaces
    background: "#f8fafc",
    foreground: "#172030",

    // Cards / elevated surfaces
    card: "#ffffff",
    cardForeground: "#172030",

    // Primary action color (buttons, links, active states)
    primary: "#f59e0b",
    primaryForeground: "#311d0c",

    // Secondary / less-emphasis interactive surfaces
    secondary: "#eef2f6",
    secondaryForeground: "#1e2a3e",

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: "#eef2f6",
    mutedForeground: "#62748d",

    // Accent highlights (badges, selected items, focus rings)
    accent: "#eef2f6",
    accentForeground: "#1e2a3e",

    // Destructive actions (delete, error states)
    destructive: "#ef4444",
    destructiveForeground: "#f8fafc",

    // Borders and input outlines
    border: "#e1e7ef",
    input: "#dae2ec",
  },

  dark: {
    // Legacy aliases (kept for backward compatibility)
    text: "#f8fafc",
    tint: "#f59e0b",

    // Core surfaces
    background: "#020817",
    foreground: "#f8fafc",

    // Cards / elevated surfaces
    card: "#020817",
    cardForeground: "#f8fafc",

    // Primary action color (buttons, links, active states)
    primary: "#f59e0b",
    primaryForeground: "#1a1a1a",

    // Secondary / less-emphasis interactive surfaces
    secondary: "#1e293b",
    secondaryForeground: "#f8fafc",

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: "#1e293b",
    mutedForeground: "#94a3b8",

    // Accent highlights (badges, selected items, focus rings)
    accent: "#1e293b",
    accentForeground: "#f8fafc",

    // Destructive actions (delete, error states)
    destructive: "#7f1d1d",
    destructiveForeground: "#f8fafc",

    // Borders and input outlines
    border: "#1e293b",
    input: "#1e293b",
  },

  // Border radius (in px). Synced from the web artifact's --radius (0.625rem).
  radius: 10,
};

export default colors;
