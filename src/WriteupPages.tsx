import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { SITE_CONFIG } from './config';
import {
  estimateWriteupReadingTime,
  getActiveWriteupEntries,
  getAdjacentWriteups,
  getConfirmedPortfolioContent,
  getPublishedWriteups,
  getRenderableWriteupSections,
  getWriteupBySlug,
  isRenderableText,
  type WriteupCodeBlock,
} from './contentFilter';
import { buildWriteupHref } from './router';

export interface WriteupPageProps {
  plainView: boolean;
  onScrollToTarget?: (selector: string) => void;
}

/**
 * Deterministic faint static particle layer for write-up reading pages.
 * No scroll-driven camera, no idle animation, very low opacity, hidden in Plain view
 * and hidden when printing. Follows the active theme via CSS variables.
 */
function StaticReadingBackdrop({ plainView }: { plainView: boolean }) {
  const dots = useMemo(() => {
    const count = SITE_CONFIG.particles.writeupStaticCount;
    const items: Array<{ x: number; y: number; size: number; isAccent: boolean }> = [];
    let seed = 0x5f3759df;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < count; i++) {
      items.push({
        x: Math.round(nextRand() * 96 + 2),
        y: Math.round(nextRand() * 94 + 3),
        size: nextRand() > 0.78 ? 2 : 1.5,
        isAccent: i % 6 === 0,
      });
    }
    return items;
  }, []);

  if (plainView) return null;

  return (
    <div
      aria-hidden="true"
      data-static-backdrop="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <svg
        className="h-full w-full"
        style={{ opacity: SITE_CONFIG.particles.writeupStaticOpacity }}
      >
        {dots.map((dot, idx) => (
          <circle
            key={idx}
            cx={`${dot.x}%`}
            cy={`${dot.y}%`}
            r={dot.size}
            fill={dot.isAccent ? 'var(--accent)' : 'var(--text-primary)'}
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * Horizontally scrolling code block in JetBrains Mono with a Copy button and no wrapping.
 * Guaranteed not to widen the page beyond the viewport on 360px/375px mobile screens.
 * Stays dark in both themes when `SITE_CONFIG.theme.CODE_BLOCKS_ALWAYS_DARK` is true.
 */
function CodeBlockView({ block }: { block: WriteupCodeBlock }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(block.code).catch(() => {
          // Ignore clipboard permission errors safely
        });
      }
    } catch {
      // Ignore safely
    }
  };

  return (
    <div
      data-testid="writeup-code-block"
      data-code-always-dark={SITE_CONFIG.theme.CODE_BLOCKS_ALWAYS_DARK ? 'true' : 'false'}
      className="my-4 w-full max-w-full overflow-hidden border border-[var(--code-border)] bg-[var(--code-bg)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--code-border)] bg-[var(--code-bg)] px-3 py-1 font-data-mono text-[11px] text-[var(--code-muted)]">
        <span className="truncate text-[var(--code-muted)]">
          {isRenderableText(block.label)
            ? block.label
            : isRenderableText(block.language)
              ? block.language
              : 'shell'}
        </span>
        <button
          type="button"
          data-copy-code="true"
          onClick={handleCopy}
          className="cursor-pointer shrink-0 min-h-[44px] min-w-[44px] rounded border border-[var(--code-border)] bg-[var(--code-bg)] px-2.5 py-1 text-[11px] text-[var(--code-text)] transition-colors hover:border-[var(--code-accent)] hover:text-[var(--code-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--code-accent)]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        tabIndex={0}
        data-lenis-prevent
        data-code-scroll="true"
        className="w-full max-w-full overflow-x-auto bg-[var(--code-bg)] p-3.5 font-data-mono text-xs leading-relaxed text-[var(--code-text)] whitespace-pre"
      >
        <code className="text-[var(--code-text)]">{block.code}</code>
      </pre>
    </div>
  );
}

/**
 * Helper to update document.title and meta description on route change.
 * Scroll-to-top on route change is handled centrally by Lenis in AppShell.
 */
function useDocumentMetadata(titlePrefix: string, description?: string) {
  useEffect(() => {
    document.title = `${titlePrefix} | ${SITE_CONFIG.identity.siteTitleSuffix}`;

    if (description && isRenderableText(description)) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', description);
      }
    }
  }, [titlePrefix, description]);
}

/**
 * /writeups — Index page listing all published write-ups (or the config empty state
 * when none are published yet). Never renders links to unpublished write-ups.
 */
export function WriteupsIndexPage({ plainView }: WriteupPageProps) {
  const location = useLocation();
  const content = getConfirmedPortfolioContent(location.search);
  const allEntries = getActiveWriteupEntries(location.search);
  const publishedEntries = getPublishedWriteups(allEntries);

  useDocumentMetadata(
    'Writeups',
    SITE_CONFIG.writeupsConfig.emptyStateLine,
  );

  return (
    <div className="relative min-h-[100svh] w-full overflow-x-hidden bg-[var(--bg)] pt-24 pb-20 text-[var(--text-primary)]">
      <StaticReadingBackdrop plainView={plainView} />

      <main id="main-content" className="relative z-10 mx-auto w-full max-w-4xl px-4 sm:px-10">
        <div className="bg-[var(--bg)] p-5 sm:p-10 border-l border-[var(--border-subtle)]">
          <div className="mb-4">
            <Link
              to={`/${location.search}#writeups`}
              className="inline-flex min-h-[44px] items-center font-data-mono text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              ← Back to portfolio
            </Link>
          </div>

          <p className="mb-3 font-data-mono text-xs tracking-widest text-[var(--accent)]">
            05 // REPORT
          </p>
          <h1 className="mb-8 font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[var(--text-primary)]">
            Writeups
          </h1>

          {publishedEntries.length > 0 ? (
            <ul
              data-writeups-index-state="published-list"
              className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] font-data-mono"
            >
              {publishedEntries.map((entry) => {
                const entryHref = `${buildWriteupHref(entry.slug)}${location.search}`;
                return (
                  <li key={entry.slug} className="py-6">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <h2 className="text-base sm:text-lg font-medium text-[var(--text-primary)]">
                          <Link
                            to={entryHref}
                            className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                          >
                            {entry.title}
                          </Link>
                        </h2>
                        {isRenderableText(entry.platform) && (
                          <span className="text-xs text-[var(--accent)]">
                            [{entry.platform}]
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-baseline gap-2 text-xs text-[var(--text-muted)]">
                        {isRenderableText(entry.date) && (
                          <>
                            <span>{entry.date}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        {isRenderableText(entry.status) && (
                          <span>{entry.status}</span>
                        )}
                      </div>
                    </div>

                    {isRenderableText(entry.summary) && (
                      <p className="mb-3 text-xs sm:text-sm leading-relaxed text-[var(--text-primary)]">
                        {entry.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--text-muted)]">
                          {entry.tags.map((tag, idx) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-2"
                            >
                              {idx > 0 && <span aria-hidden="true">·</span>}
                              <span>{tag}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4">
                        <Link
                          to={entryHref}
                          className="inline-flex min-h-[44px] items-center py-1 text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        >
                          Read write-up →
                        </Link>
                        {isRenderableText(entry.githubUrl) && (
                          <a
                            href={entry.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center py-1 text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                          >
                            GitHub write-up ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div
              data-writeups-index-state="empty"
              className="border-t border-[var(--border-subtle)] pt-6 space-y-6 font-data-mono text-xs sm:text-sm"
            >
              {isRenderableText(SITE_CONFIG.writeupsConfig.emptyStateLine) && (
                <p className="leading-relaxed text-[var(--text-primary)]">
                  {SITE_CONFIG.writeupsConfig.emptyStateLine}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <a
                  href={content.links.tryhackme}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center py-1 text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {SITE_CONFIG.writeupsConfig.emptyStateProfileLabel} ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * /writeups/:slug — Individual write-up reading page (~70ch width).
 */
export function WriteupDetailPage({
  plainView,
  onScrollToTarget,
}: WriteupPageProps) {
  const { slug = '' } = useParams<{ slug: string }>();
  const location = useLocation();
  const entries = getActiveWriteupEntries(location.search);
  const entry = getWriteupBySlug(slug, entries);

  const pageTitle = entry ? entry.title : 'Write-up Not Found';
  useDocumentMetadata(pageTitle, entry?.summary);

  if (!entry) {
    return (
      <div className="relative min-h-[100svh] w-full overflow-x-hidden bg-[var(--bg)] pt-24 pb-20 text-[var(--text-primary)]">
        <StaticReadingBackdrop plainView={plainView} />
        <main id="main-content" className="relative z-10 mx-auto w-full max-w-[70ch] px-4 sm:px-8">
          <div className="bg-[var(--bg)] p-5 sm:p-8 border-l border-[var(--border-subtle)] font-data-mono">
            <div className="mb-4">
              <Link
                to={`${SITE_CONFIG.routing.writeupsBasePath}${location.search}`}
                className="inline-flex min-h-[44px] items-center text-xs text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
              >
                ← {SITE_CONFIG.writeupsConfig.backToAllLabel}
              </Link>
            </div>
            <h1 className="mb-3 font-display-serif text-4xl text-[var(--text-primary)]">
              Write-up not found
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              No write-up entry matches slug “{slug}”.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const renderableSections = getRenderableWriteupSections(entry);
  const readingTime = estimateWriteupReadingTime(entry);
  const { previous, next } = getAdjacentWriteups(entry.slug, entries);

  const bannerText =
    entry.type === 'guided-lab'
      ? SITE_CONFIG.writeupsConfig.guidedLabBanner
      : SITE_CONFIG.writeupsConfig.originalResearchBanner;

  return (
    <div className="relative min-h-[100svh] w-full overflow-x-hidden bg-[var(--bg)] pt-24 pb-24 text-[var(--text-primary)]">
      <StaticReadingBackdrop plainView={plainView} />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-8 lg:px-12">
        <div className="mb-4 font-data-mono text-xs">
          <Link
            to={`${SITE_CONFIG.routing.writeupsBasePath}${location.search}`}
            className="inline-flex min-h-[44px] items-center text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            ← {SITE_CONFIG.writeupsConfig.backToAllLabel}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
          {/* Main ~70ch reading column */}
          <article id="main-content" className="lg:col-span-8 w-full max-w-[70ch] bg-[var(--bg)]">
            {/* Top visible status banner controlled by "type": "guided-lab" | "original" */}
            {isRenderableText(bannerText) && (
              <div
                data-writeup-banner={entry.type}
                className="mb-8 border-l-2 border-[var(--accent)] bg-[var(--bg)] px-4 py-3 font-data-mono text-xs leading-relaxed text-[var(--text-primary)]"
              >
                {bannerText}
              </div>
            )}

            {/* Header: Kicker (platform), Title in Instrument Serif, Meta line, Room link, Tags */}
            <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
              {isRenderableText(entry.platform) && (
                <p className="mb-2 font-data-mono text-xs tracking-widest text-[var(--accent)]">
                  {entry.platform}
                </p>
              )}

              <h1 className="mb-4 font-display-serif text-[clamp(2.35rem,5.5vw,4.25rem)] font-normal leading-[1.02] tracking-tight text-[var(--text-primary)]">
                {entry.title}
              </h1>

              {/* Meta line: platform, status, date, estimated reading time, room link */}
              <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-data-mono text-xs text-[var(--text-muted)]">
                {isRenderableText(entry.platform) && (
                  <span className="text-[var(--text-primary)]">{entry.platform}</span>
                )}

                {isRenderableText(entry.status) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{entry.status}</span>
                  </>
                )}

                {isRenderableText(entry.date) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{entry.date}</span>
                  </>
                )}

                {readingTime && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{readingTime}</span>
                  </>
                )}

                {isRenderableText(entry.roomUrl) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={entry.roomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center py-1 text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      Room link ↗
                    </a>
                  </>
                )}

                {isRenderableText(entry.githubUrl) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={entry.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center py-1 text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      GitHub write-up ↗
                    </a>
                  </>
                )}
              </div>

              {isRenderableText(entry.summary) && (
                <p className="mb-4 font-data-mono text-xs sm:text-sm leading-relaxed text-[var(--text-primary)]">
                  {entry.summary}
                </p>
              )}

              {entry.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-data-mono text-xs text-[var(--text-muted)]">
                  {entry.tags.map((tag, idx) => (
                    <span key={tag} className="inline-flex items-center gap-2">
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              )}
            </header>

            {/* Mobile inline Table of Contents (only shown when non-empty sections exist) */}
            {renderableSections.length > 0 && (
              <nav
                aria-label="Table of contents (mobile)"
                className="mb-8 border border-[var(--border-subtle)] bg-[var(--bg)] p-4 font-data-mono text-xs lg:hidden"
              >
                <div className="mb-2 text-[11px] tracking-wider text-[var(--text-muted)]">
                  contents
                </div>
                <ol className="space-y-1">
                  {renderableSections.map((sec, idx) => (
                    <li key={sec.key}>
                      <a
                        href={`#${sec.id}`}
                        onClick={(e) => {
                          if (onScrollToTarget) {
                            e.preventDefault();
                            onScrollToTarget(`#${sec.id}`);
                          }
                        }}
                        className="inline-flex min-h-[44px] items-center text-[var(--text-primary)] transition-colors hover:text-[var(--accent)]"
                      >
                        {String(idx + 1).padStart(2, '0')}. {sec.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            {/* Structured content sections (any empty field does NOT render) */}
            {renderableSections.length > 0 ? (
              <div
                data-writeup-sections-state="populated"
                className="space-y-10 font-data-mono text-xs sm:text-sm"
              >
                {renderableSections.map((sec) => (
                  <section
                    key={sec.key}
                    id={sec.id}
                    data-writeup-section={sec.key}
                    className="scroll-mt-24 border-b border-[var(--border-subtle)] pb-8 last:border-b-0"
                  >
                    <h2 className="mb-4 font-display-serif text-2xl sm:text-3xl font-normal text-[var(--text-primary)]">
                      {sec.heading}
                    </h2>

                    {sec.paragraphs.map((paragraph, pIdx) => (
                      <p
                        key={pIdx}
                        className="mb-3 leading-relaxed text-[var(--text-primary)]"
                      >
                        {paragraph}
                      </p>
                    ))}

                    {sec.steps.length > 0 && (
                      <ol className="my-4 list-decimal space-y-2 pl-5 leading-relaxed text-[var(--text-primary)]">
                        {sec.steps.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ol>
                    )}

                    {sec.codeBlocks.map((block, cIdx) => (
                      <CodeBlockView key={cIdx} block={block} />
                    ))}

                    {sec.screenshots.map((shot, imgIdx) => (
                      <figure
                        key={imgIdx}
                        className="my-5 border border-[var(--border-subtle)] bg-[var(--bg)] p-2"
                      >
                        <img
                          src={shot.src}
                          alt={shot.alt}
                          loading="lazy"
                          className="w-full h-auto"
                        />
                        {isRenderableText(shot.caption) && (
                          <figcaption className="mt-2 px-1 text-xs text-[var(--text-muted)]">
                            {shot.caption}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </section>
                ))}
              </div>
            ) : (
              <div
                data-writeup-sections-state="empty-draft"
                className="space-y-4 border border-[var(--border-subtle)] bg-[var(--bg)] p-5 font-data-mono text-xs sm:text-sm"
              >
                {isRenderableText(SITE_CONFIG.writeupsConfig.emptyStateLine) && (
                  <p className="leading-relaxed text-[var(--text-primary)]">
                    {SITE_CONFIG.writeupsConfig.emptyStateLine}
                  </p>
                )}
                <p className="leading-relaxed text-[var(--text-muted)]">
                  Status in data file: <span className="text-[var(--text-primary)]">published: false</span>.
                  Detailed walkthrough sections remain hidden until populated in{' '}
                  <span className="text-[var(--text-primary)]">src/content.js</span>.
                </p>

                <CodeBlockView
                  block={{
                    label: 'Redaction & notes policy (src/content.js)',
                    language: 'text',
                    code: '# Never include flag values, passwords, or credentials; redact sensitive output as [redacted].',
                  }}
                />
              </div>
            )}

            {/* Previous / Next write-up links at the bottom */}
            <footer className="mt-12 border-t border-[var(--border-subtle)] pt-6 font-data-mono text-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  {previous ? (
                    <Link
                      to={`${buildWriteupHref(previous.slug)}${location.search}`}
                      className="inline-flex min-h-[44px] items-center text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
                    >
                      ← Previous: {previous.title}
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-[44px] items-center text-[var(--text-muted)]">
                      ← Previous: none
                    </span>
                  )}
                </div>

                <Link
                  to={`${SITE_CONFIG.routing.writeupsBasePath}${location.search}`}
                  className="inline-flex min-h-[44px] items-center text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 transition-colors hover:text-[var(--accent)]"
                >
                  {SITE_CONFIG.writeupsConfig.backToAllLabel}
                </Link>

                <div>
                  {next ? (
                    <Link
                      to={`${buildWriteupHref(next.slug)}${location.search}`}
                      className="inline-flex min-h-[44px] items-center text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
                    >
                      Next: {next.title} →
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-[44px] items-center text-[var(--text-muted)]">
                      Next: none →
                    </span>
                  )}
                </div>
              </div>
            </footer>
          </article>

          {/* Sticky Table of Contents on desktop */}
          {renderableSections.length > 0 && (
            <aside
              aria-label="Table of contents"
              className="hidden lg:block lg:col-span-4 sticky top-24 border-l border-[var(--border-subtle)] bg-[var(--bg)] pl-6 font-data-mono text-xs"
            >
              <div className="mb-3 text-[11px] tracking-wider text-[var(--text-muted)]">
                on this page
              </div>
              <ol className="space-y-2">
                {renderableSections.map((sec, idx) => (
                  <li key={sec.key}>
                    <a
                      href={`#${sec.id}`}
                      onClick={(e) => {
                        if (onScrollToTarget) {
                          e.preventDefault();
                          onScrollToTarget(`#${sec.id}`);
                        }
                      }}
                      className="inline-flex min-h-[36px] items-center text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                    >
                      {String(idx + 1).padStart(2, '0')}. {sec.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

export default WriteupsIndexPage;
