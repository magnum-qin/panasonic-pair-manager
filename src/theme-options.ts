export const THEME_OPTIONS = [
  { code: "pureWhite", label: "Pure White" },
  { code: "classic", label: "Classic Teal" },
  { code: "sakura", label: "Sakura Rose" },
  { code: "forest", label: "Forest Green" },
  { code: "graphite", label: "Graphite" },
  { code: "trueBlack", label: "True Black" },
] as const;

export type ThemeCode = (typeof THEME_OPTIONS)[number]["code"];

export function normalizeTheme(value: string | null | undefined): ThemeCode {
  return THEME_OPTIONS.some((theme) => theme.code === value) ? (value as ThemeCode) : "classic";
}
