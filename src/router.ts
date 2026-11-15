import { SITE_CONFIG } from './config';

/**
 * NOTE FOR DEPLOY PHASE:
 * The hosting provider (e.g. Cloud Run / static host / Nginx / Vercel / Netlify)
 * must be configured to serve `index.html` for unknown paths (SPA fallback) so
 * direct loads and refreshes on `/writeups` and `/writeups/:slug` resolve cleanly.
 */
export type AppRoute =
  | { kind: 'portfolio' }
  | { kind: 'writeups-index' }
  | { kind: 'writeup-detail'; slug: string };

/**
 * Parses a URL pathname into an AppRoute.
 * - `/` renders the 6-section portfolio home page.
 * - `/writeups` renders the write-ups index page.
 * - `/writeups/:slug` renders the individual write-up reading page.
 */
export function resolveRoute(pathname: string): AppRoute {
  const base = SITE_CONFIG.routing.writeupsBasePath;
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === base) {
    return { kind: 'writeups-index' };
  }

  if (normalized.startsWith(`${base}/`)) {
    const slug = normalized.slice(base.length + 1).trim();
    if (slug.length > 0 && !slug.includes('/')) {
      return { kind: 'writeup-detail', slug };
    }
  }

  return { kind: 'portfolio' };
}

/**
 * Builds the canonical href for a write-up page (e.g. `/writeups/mr-robot`).
 */
export function buildWriteupHref(slug: string): string {
  const cleanSlug = slug.replace(/^\/+|\/+$/g, '');
  return `${SITE_CONFIG.routing.writeupsBasePath}/${cleanSlug}`;
}
