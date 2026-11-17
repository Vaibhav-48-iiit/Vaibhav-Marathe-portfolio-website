import { SITE_CONFIG, type ThemeMode } from './config';

type ThemeListener = (theme: ThemeMode) => void;

/**
 * In-memory theme state.
 * - Always starts in 'dark' on every page load and reload.
 * - Ignores prefers-color-scheme.
 * - Never reads or writes localStorage, sessionStorage, or cookies.
 * - Persists across client-side navigation between `/` and `/writeups*`.
 */
let currentTheme: ThemeMode = SITE_CONFIG.theme.defaultTheme;
const listeners = new Set<ThemeListener>();

export function getTheme(): ThemeMode {
  return currentTheme;
}

export function getThemeTokens(theme: ThemeMode = currentTheme) {
  return SITE_CONFIG.theme.themes[theme];
}

/**
 * Applies `data-theme`, `color-scheme`, CSS custom properties from `SITE_CONFIG.theme`,
 * and `<meta name="theme-color">` directly to the DOM without re-rendering the React root.
 */
export function syncThemeDomAttributes(theme: ThemeMode = currentTheme): void {
  if (typeof document === 'undefined') return;

  const tokens = SITE_CONFIG.theme.themes[theme];
  const root = document.documentElement;

  root.setAttribute('data-theme', theme);
  root.style.colorScheme = tokens.colorScheme;
  root.style.setProperty('--bg', tokens.background);
  root.style.setProperty('--bg-primary', tokens.background);
  root.style.setProperty('--text-primary', tokens.text);
  root.style.setProperty('--text-muted', tokens.textMuted);
  root.style.setProperty('--border-subtle', tokens.lineSubtle);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--amber', tokens.amber);
  root.style.setProperty('--scrollbar-track', tokens.scrollbarTrack);
  root.style.setProperty('--scrollbar-thumb', tokens.scrollbarThumb);
  root.style.setProperty(
    '--theme-transition-ms',
    `${SITE_CONFIG.theme.cssTransitionDurationMs}ms`,
  );

  // Code block variables: stay dark in both themes when CODE_BLOCKS_ALWAYS_DARK is true
  const codeTokens = SITE_CONFIG.theme.CODE_BLOCKS_ALWAYS_DARK
    ? SITE_CONFIG.theme.themes.dark
    : tokens;
  root.style.setProperty('--code-bg', codeTokens.background);
  root.style.setProperty('--code-text', codeTokens.text);
  root.style.setProperty('--code-muted', codeTokens.textMuted);
  root.style.setProperty('--code-border', codeTokens.lineSubtle);
  root.style.setProperty('--code-accent', codeTokens.accent);

  // Sync <meta name="theme-color">
  let metaTheme = document.querySelector(
    'meta[name="theme-color"]',
  ) as HTMLMetaElement | null;
  if (!metaTheme && document.head) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  if (metaTheme) {
    metaTheme.setAttribute('content', tokens.metaThemeColor);
  }

  // Mirror data-theme on the app root element if mounted
  const appRoot = document.querySelector('[data-app-root="true"]');
  if (appRoot) {
    appRoot.setAttribute('data-theme', theme);
  }
}

export function setTheme(next: ThemeMode): ThemeMode {
  if (next !== 'dark' && next !== 'light') return currentTheme;
  if (currentTheme === next) {
    syncThemeDomAttributes(currentTheme);
    return currentTheme;
  }
  currentTheme = next;
  syncThemeDomAttributes(currentTheme);
  listeners.forEach((listener) => listener(currentTheme));
  return currentTheme;
}

export function toggleTheme(): ThemeMode {
  return setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetThemeForTests(): void {
  currentTheme = SITE_CONFIG.theme.defaultTheme;
  syncThemeDomAttributes(currentTheme);
  listeners.clear();
}

/**
 * Computes WCAG 2.1 relative luminance for a 6-digit hex colour (`#RRGGBB`).
 */
export function computeRelativeLuminance(hex: string): number {
  const cleaned = hex.replace(/^#/, '').trim();
  const num = parseInt(cleaned, 16);
  const r8 = ((num >> 16) & 255) / 255;
  const g8 = ((num >> 8) & 255) / 255;
  const b8 = (num & 255) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r8) + 0.7152 * toLinear(g8) + 0.0722 * toLinear(b8);
}

/**
 * Computes WCAG 2.1 contrast ratio between two hex colours (`>= 1.0`, up to `21.0`).
 */
export function computeContrastRatio(hexA: string, hexB: string): number {
  const lumA = computeRelativeLuminance(hexA);
  const lumB = computeRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

// Immediately initialize root DOM attributes on module load so first paint is always dark
if (typeof document !== 'undefined') {
  syncThemeDomAttributes(currentTheme);
}
