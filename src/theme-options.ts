export const THEME_OPTIONS = [
  { code: "classic", label: "Classic Teal" },
  { code: "sakura", label: "Sakura Rose" },
  { code: "forest", label: "Forest Green" },
  { code: "graphite", label: "Graphite" },
] as const;

export type ThemeCode = (typeof THEME_OPTIONS)[number]["code"];

export function normalizeTheme(value: string | null | undefined): ThemeCode {
  return THEME_OPTIONS.some((theme) => theme.code === value) ? (value as ThemeCode) : "classic";
}
