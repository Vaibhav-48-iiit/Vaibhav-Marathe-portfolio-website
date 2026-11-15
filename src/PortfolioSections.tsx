import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Github, Linkedin, Mail, Terminal } from 'lucide-react';
import { SITE_CONFIG } from './config';
import {
  getConfirmedPortfolioContent,
  isRenderableText,
  isWriteupUrlPublished,
  type SkillItem,
} from './contentFilter';
import { buildWriteupHref } from './router';

interface PortfolioSectionsProps {
  reducedMotion: boolean;
  plainView: boolean;
  onScrollToTop: () => void;
}

/**
 * RevealBlock
 * Provides a subtle fade + short vertical translate when a section enters the viewport.
 * Immediately visible (no animation) when `prefers-reduced-motion` or `Plain view` is active.
 */
function RevealBlock({
  disabled,
  children,
  className = '',
}: {
  disabled: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState<boolean>(disabled);

  useEffect(() => {
    if (disabled) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [disabled]);

  const motionClasses = disabled
    ? 'opacity-100 translate-y-0'
    : `transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`;

  return (
    <div ref={ref} className={`${motionClasses} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Renders an individual skill entry with honest status label and optional evidence link.
 * Ensures >= 44px tap targets on interactive evidence links for mobile ergonomics.
 */
function SkillEntryRow({
  item,
  variant,
}: {
  item: SkillItem;
  variant: 'used' | 'learning';
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[#262C36]/45 py-2 min-h-[44px] text-xs sm:text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span
          className={
            variant === 'used'
              ? 'font-medium text-[#E8E4DA]'
              : 'text-[#E8E4DA]/85'
          }
        >
          {item.name}
        </span>

        {isRenderableText(item.detail) && (
          <span className="font-data-mono text-xs text-[#9A968E]">
            · {item.detail}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 font-data-mono text-xs">
        <span
          className={
            variant === 'used' ? 'text-[#4FD1D9]' : 'text-[#9A968E]'
          }
        >
          {item.status}
        </span>

        {isRenderableText(item.evidenceLabel) && (
          <>
            <span aria-hidden="true" className="text-[#9A968E]">
              ·
            </span>
            {isRenderableText(item.evidenceUrl) ? (
              <a
                href={item.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center py-1 text-[#E8E4DA] underline decoration-[#262C36] underline-offset-4 transition-colors hover:text-[#4FD1D9] hover:decoration-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
              >
                {item.evidenceLabel} ↗
              </a>
            ) : (
              <span className="text-[#9A968E]">{item.evidenceLabel}</span>
            )}
          </>
        )}

        {!isRenderableText(item.evidenceLabel) &&
          isRenderableText(item.evidenceUrl) && (
            <>
              <span aria-hidden="true" className="text-[#9A968E]">
                ·
              </span>
              <a
                href={item.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center py-1 text-[#E8E4DA] underline decoration-[#262C36] underline-offset-4 transition-colors hover:text-[#4FD1D9] hover:decoration-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
              >
                lab reference ↗
              </a>
            </>
          )}
      </div>
    </li>
  );
}

/**
 * ConnectChannelIcon
 * Renders a monochrome 18px inline SVG icon drawn with `currentColor` for each
 * Connect channel row. Uses tree-shaken Lucide icons for Email, LinkedIn, GitHub,
 * TryHackMe (terminal prompt), and Resume (PDF), and a matching 18px stroke-weight
 * inline SVG mark for X.
 */
function ConnectChannelIcon({ channelId }: { channelId: string }) {
  switch (channelId) {
    case 'channel-email':
      return (
        <Mail
          aria-hidden="true"
          width={18}
          height={18}
          strokeWidth={1.75}
          className="h-[18px] w-[18px] shrink-0"
        />
      );
    case 'channel-linkedin':
      return (
        <Linkedin
          aria-hidden="true"
          width={18}
          height={18}
          strokeWidth={1.75}
          className="h-[18px] w-[18px] shrink-0"
        />
      );
    case 'channel-github':
      return (
        <Github
          aria-hidden="true"
          width={18}
          height={18}
          strokeWidth={1.75}
          className="h-[18px] w-[18px] shrink-0"
        />
      );
    case 'channel-tryhackme':
      return (
        <Terminal
          aria-hidden="true"
          width={18}
          height={18}
          strokeWidth={1.75}
          className="h-[18px] w-[18px] shrink-0"
        />
      );
    case 'channel-x':
      return (
        <svg
          aria-hidden="true"
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px] shrink-0"
        >
          <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
          <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
        </svg>
      );
    case 'channel-resume':
    default:
      return (
        <FileText
          aria-hidden="true"
          width={18}
          height={18}
          strokeWidth={1.75}
          className="h-[18px] w-[18px] shrink-0"
        />
      );
  }
}

/**
 * PortfolioSections
 * Renders Sections 2–6 (Background, Skills, Projects / CTFs, Writeups, Connect)
 * strictly from `src/content.js` (filtered via `getConfirmedPortfolioContent`).
 */
export function PortfolioSections({
  reducedMotion,
  plainView,
  onScrollToTop,
}: PortfolioSectionsProps) {
  const location = useLocation();
  const content = getConfirmedPortfolioContent(location.search);
  const skipReveal = reducedMotion || plainView;
  const [emailCopied, setEmailCopied] = useState(false);

  const handleCopyEmail = (emailText: string) => {
    setEmailCopied(true);
    window.setTimeout(() => setEmailCopied(false), 2000);

    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(emailText).catch(() => {
          // Ignore clipboard permission errors safely
        });
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = emailText;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {
      // Fallback gracefully if clipboard access is denied
    }
  };

  const currentYear = new Date().getFullYear();

  const sectionMeta = Object.fromEntries(
    SITE_CONFIG.sections.map((s) => [s.id, s]),
  );

  return (
    <>
      {/* ====================================================================
          SECTION 2: BACKGROUND (02 // ENUMERATION)
         ==================================================================== */}
      <section
        id="background"
        aria-label={sectionMeta.background.navLabel}
        className="flex min-h-[100svh] w-full flex-col justify-center border-t border-[#262C36]/40 px-4 py-20 sm:px-10 md:px-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-7xl">
          <RevealBlock
            disabled={skipReveal}
            className="bg-[#0B0D10]/95 p-5 sm:p-10"
          >
            <p className="mb-3 font-data-mono text-xs tracking-widest text-[#4FD1D9]">
              {sectionMeta.background.kicker}
            </p>
            <h2 className="mb-8 sm:mb-10 font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[#E8E4DA]">
              {sectionMeta.background.title}
            </h2>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16 items-start">
              {/* Left Column: Intro text + Pull-quote tagline */}
              <div className="lg:col-span-5 space-y-8">
                {isRenderableText(content.background.introDraft) && (
                  <p className="font-data-mono text-xs sm:text-sm leading-relaxed text-[#E8E4DA]">
                    {content.background.introDraft}
                  </p>
                )}

                {isRenderableText(content.background.taglinePullQuote) && (
                  <blockquote className="border-t border-b border-[#262C36] py-5 font-display-serif text-2xl sm:text-3xl italic leading-snug text-[#E8E4DA]">
                    “{content.background.taglinePullQuote}”
                  </blockquote>
                )}
              </div>

              {/* Right Column: Vertical mono changelog + status line */}
              <div className="lg:col-span-7 font-data-mono">
                <div className="mb-3 text-xs tracking-wider text-[#9A968E]">
                  changelog
                </div>

                {/* Reserved date column ensures dated and undated entries align identically */}
                <ol className="relative border-l border-[#262C36] pl-4 sm:pl-5 space-y-6">
                  {content.background.changelog.map((entry) => {
                    const hasDate = isRenderableText(entry.date);
                    return (
                      <li
                        key={entry.id}
                        className="relative grid grid-cols-[3rem_1fr] sm:grid-cols-[4rem_1fr] gap-2.5 sm:gap-4 items-baseline text-xs sm:text-sm"
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute -left-[19px] sm:-left-[23px] top-1.5 h-1.5 w-1.5 rounded-full ${
                            entry.date === 'Now'
                              ? 'bg-[#4FD1D9]'
                              : 'bg-[#9A968E]'
                          }`}
                        />
                        <div
                          data-changelog-date={hasDate ? entry.date : 'empty'}
                          className={`text-xs tracking-wider select-none ${
                            hasDate
                              ? 'font-medium text-[#4FD1D9]'
                              : 'text-[#9A968E]'
                          }`}
                        >
                          {hasDate ? entry.date : '—'}
                        </div>
                        <p
                          data-changelog-text={entry.id}
                          className="leading-relaxed text-[#E8E4DA]"
                        >
                          {entry.text}
                        </p>
                      </li>
                    );
                  })}
                </ol>

                {isRenderableText(content.background.statusLine) && (
                  <p className="mt-8 border-t border-[#262C36]/70 pt-4 text-xs text-[#9A968E]">
                    {content.background.statusLine}
                  </p>
                )}
              </div>
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ====================================================================
          SECTION 3: SKILLS (03 // SCANNING)
         ==================================================================== */}
      <section
        id="skills"
        aria-label={sectionMeta.skills.navLabel}
        className="flex min-h-[100svh] w-full flex-col justify-center border-t border-[#262C36]/40 px-4 py-20 sm:px-10 md:px-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-7xl">
          <RevealBlock
            disabled={skipReveal}
            className="bg-[#0B0D10]/95 p-5 sm:p-10"
          >
            <div className="mb-8 sm:mb-10 flex flex-col justify-between gap-4 border-b border-[#262C36] pb-6 md:flex-row md:items-end">
              <div>
                <p className="mb-3 font-data-mono text-xs tracking-widest text-[#4FD1D9]">
                  {sectionMeta.skills.kicker}
                </p>
                <h2 className="font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[#E8E4DA]">
                  {sectionMeta.skills.title}
                </h2>
              </div>

              <div className="flex items-center gap-4 font-data-mono text-xs text-[#9A968E]">
                <span className="text-[#4FD1D9]">
                  {content.skills.statusLabels.usedInLab}
                </span>
                <span aria-hidden="true">·</span>
                <span>{content.skills.statusLabels.learning}</span>
              </div>
            </div>

            {/* Grouped lists, no percentage bars, no logo walls; "used in lab" visually separated from "learning" */}
            <div className="space-y-10 font-data-mono">
              {content.skills.groups.map((group) => (
                <div
                  key={group.id}
                  className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-10 items-start"
                >
                  <h3 className="lg:col-span-3 pt-2 text-xs tracking-wider text-[#9A968E]">
                    {group.title}
                  </h3>

                  <div className="lg:col-span-9 grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Sub-list 1: Used in lab */}
                    <div>
                      <div className="mb-2 text-[11px] tracking-wider text-[#4FD1D9]">
                        {content.skills.statusLabels.usedInLab}
                      </div>
                      {group.usedInLab.length > 0 ? (
                        <ul className="border-t border-[#262C36]">
                          {group.usedInLab.map((item) => (
                            <SkillEntryRow
                              key={item.name}
                              item={item}
                              variant="used"
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="border-t border-[#262C36]/40 py-2 text-xs text-[#9A968E]">
                          —
                        </p>
                      )}
                    </div>

                    {/* Sub-list 2: Learning */}
                    <div>
                      <div className="mb-2 text-[11px] tracking-wider text-[#9A968E]">
                        {content.skills.statusLabels.learning}
                      </div>
                      {group.learning.length > 0 ? (
                        <ul className="border-t border-[#262C36]/60">
                          {group.learning.map((item) => (
                            <SkillEntryRow
                              key={item.name}
                              item={item}
                              variant="learning"
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="border-t border-[#262C36]/40 py-2 text-xs text-[#9A968E]">
                          —
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ====================================================================
          SECTION 4: PROJECTS / CTFs (04 // EXPLOITATION)
         ==================================================================== */}
      <section
        id="projects"
        aria-label={sectionMeta.projects.navLabel}
        className="flex min-h-[100svh] w-full flex-col justify-center border-t border-[#262C36]/40 px-4 py-20 sm:px-10 md:px-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-7xl">
          <RevealBlock
            disabled={skipReveal}
            className="bg-[#0B0D10]/95 p-5 sm:p-10"
          >
            <p className="mb-3 font-data-mono text-xs tracking-widest text-[#4FD1D9]">
              {sectionMeta.projects.kicker}
            </p>
            <h2 className="mb-10 sm:mb-12 font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[#E8E4DA]">
              {sectionMeta.projects.title}
            </h2>

            {/* Two lanes side-by-side on desktop, stacked on mobile, with distinct visual treatment */}
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-12 items-start">
              {/* Lane 1: BUILT (Software & Systems Engineering) */}
              <div className="lg:col-span-5">
                <div className="mb-6 flex items-baseline justify-between border-b border-[#E8E4DA]/30 pb-3">
                  <h3 className="font-display-serif text-3xl text-[#E8E4DA]">
                    {content.projectsAndCtfs.builtHeading}
                  </h3>
                  <span className="font-data-mono text-xs text-[#9A968E]">
                    software & systems
                  </span>
                </div>

                <ul className="divide-y divide-[#262C36]">
                  {content.projectsAndCtfs.built.map((proj) => (
                    <li key={proj.id} className="py-6 first:pt-2">
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="font-data-mono text-sm sm:text-base font-medium text-[#E8E4DA]">
                          {proj.title}
                        </h4>
                        {isRenderableText(proj.status) && (
                          <span className="font-data-mono text-xs text-[#9A968E]">
                            {proj.status}
                          </span>
                        )}
                      </div>

                      {isRenderableText(proj.description) && (
                        <p className="mb-3 font-data-mono text-xs sm:text-sm leading-relaxed text-[#E8E4DA]/90">
                          {proj.description}
                        </p>
                      )}

                      {proj.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-data-mono text-xs text-[#9A968E]">
                          {proj.tags.map((tag, idx) => (
                            <span key={tag} className="inline-flex items-center gap-2">
                              {idx > 0 && <span aria-hidden="true">·</span>}
                              <span>{tag}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="font-data-mono text-xs">
                        {isRenderableText(proj.repoUrl) ? (
                          <a
                            href={proj.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center py-1 text-[#4FD1D9] underline decoration-[#4FD1D9]/40 underline-offset-4 transition-colors hover:text-[#E8E4DA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                          >
                            {isRenderableText(proj.repoLabel)
                              ? proj.repoLabel
                              : 'Repository'}{' '}
                            ↗
                          </a>
                        ) : (
                          isRenderableText(proj.repoNote) && (
                            <span className="inline-flex min-h-[32px] items-center text-[#9A968E]">
                              {proj.repoNote}
                            </span>
                          )
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Lane 2: BROKEN (CTFs, Guided Labs & Offensive / Defensive Practice) */}
              <div className="lg:col-span-7 lg:border-l lg:border-[#262C36] lg:pl-10">
                <div className="mb-6 flex items-baseline justify-between border-b border-[#4FD1D9]/40 pb-3">
                  <h3 className="font-display-serif text-3xl text-[#E8E4DA]">
                    {content.projectsAndCtfs.brokenHeading}
                  </h3>
                  <span className="font-data-mono text-xs text-[#4FD1D9]">
                    labs & CTFs
                  </span>
                </div>

                <ul className="divide-y divide-[#262C36]/80 font-data-mono">
                  {content.projectsAndCtfs.broken.map((lab) => {
                    // Fix 2: Links to a write-up page render ONLY when that write-up has published:true
                    const showWriteupLink =
                      isRenderableText(lab.writeupUrl) &&
                      isWriteupUrlPublished(lab.writeupUrl, content.writeups.all);

                    return (
                      <li key={lab.id} className="py-5 first:pt-2">
                        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <h4 className="text-sm sm:text-base font-medium text-[#E8E4DA]">
                              {lab.title}
                            </h4>
                            {isRenderableText(lab.platform) && (
                              <span className="text-xs text-[#4FD1D9]">
                                [{lab.platform}]
                              </span>
                            )}
                          </div>

                          {isRenderableText(lab.status) && (
                            <span className="text-xs text-[#9A968E]">
                              {lab.status}
                            </span>
                          )}
                        </div>

                        {isRenderableText(lab.description) && (
                          <p className="mb-3 text-xs sm:text-sm leading-relaxed text-[#E8E4DA]/90">
                            {lab.description}
                          </p>
                        )}

                        {(isRenderableText(lab.externalUrl) || showWriteupLink) && (
                          <div className="flex flex-wrap items-center gap-4 text-xs">
                            {isRenderableText(lab.externalUrl) && (
                              <a
                                href={lab.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[44px] items-center py-1 text-[#4FD1D9] underline decoration-[#4FD1D9]/40 underline-offset-4 transition-colors hover:text-[#E8E4DA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                              >
                                {isRenderableText(lab.externalLabel)
                                  ? lab.externalLabel
                                  : lab.platform}{' '}
                                ↗
                              </a>
                            )}

                            {showWriteupLink && (
                              <Link
                                to={`${lab.writeupUrl}${location.search}`}
                                className="inline-flex min-h-[44px] items-center py-1 text-[#E8E4DA] underline decoration-[#262C36] underline-offset-4 transition-colors hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                              >
                                {isRenderableText(lab.writeupLabel)
                                  ? lab.writeupLabel
                                  : 'Write-up'}{' '}
                                →
                              </Link>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {isRenderableText(content.projectsAndCtfs.brokenCompactLine) && (
                  <p className="mt-4 border-t border-[#262C36] pt-4 font-data-mono text-xs text-[#9A968E]">
                    {content.projectsAndCtfs.brokenCompactLine}
                  </p>
                )}
              </div>
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ====================================================================
          SECTION 5: WRITEUPS (05 // REPORT)
          Fix 4: Vertical gap between Writeups and Connect reduced to match the
          gap between other sections (~160px–192px).
         ==================================================================== */}
      <section
        id="writeups"
        aria-label={sectionMeta.writeups.navLabel}
        className="flex w-full flex-col justify-center border-t border-[#262C36]/40 px-4 py-20 sm:px-10 md:px-20 md:py-24"
      >
        <div
          className={`mx-auto w-full max-w-7xl ${
            sectionMeta.writeups.offsetClass ?? ''
          }`}
        >
          <RevealBlock
            disabled={skipReveal}
            className="max-w-4xl bg-[#0B0D10]/95 p-5 sm:p-10 border-l border-[#262C36]"
          >
            <div
              data-writeups-route-template={buildWriteupHref(
                SITE_CONFIG.routing.plannedWriteupSlugs[0],
              )}
            >
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#262C36] pb-6">
                <div>
                  <p className="mb-3 font-data-mono text-xs tracking-widest text-[#4FD1D9]">
                    {sectionMeta.writeups.kicker}
                  </p>
                  <h2 className="font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[#E8E4DA]">
                    {sectionMeta.writeups.title}
                  </h2>
                </div>

                {isRenderableText(SITE_CONFIG.writeupsConfig.viewAllLabel) && (
                  <Link
                    to={`${SITE_CONFIG.routing.writeupsBasePath}${location.search}`}
                    className="inline-flex min-h-[44px] items-center py-1 font-data-mono text-xs text-[#4FD1D9] underline decoration-[#4FD1D9]/40 underline-offset-4 transition-colors hover:text-[#E8E4DA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                  >
                    {SITE_CONFIG.writeupsConfig.viewAllLabel} →
                  </Link>
                )}
              </div>

              {content.writeups.published.length > 0 ? (
                <ul
                  data-writeups-state="published-list"
                  className="divide-y divide-[#262C36] font-data-mono"
                >
                  {content.writeups.published.map((entry) => {
                    const entryHref = `${buildWriteupHref(entry.slug)}${location.search}`;
                    return (
                      <li key={entry.slug} className="py-6 first:pt-2">
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex flex-wrap items-baseline gap-2.5">
                            <h3 className="text-base sm:text-lg font-medium text-[#E8E4DA]">
                              <Link
                                to={entryHref}
                                className="inline-flex min-h-[44px] items-center transition-colors hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                              >
                                {entry.title}
                              </Link>
                            </h3>
                            {isRenderableText(entry.platform) && (
                              <span className="text-xs text-[#4FD1D9]">
                                [{entry.platform}]
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-baseline gap-2 text-xs text-[#9A968E]">
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
                          <p className="mb-3 text-xs sm:text-sm leading-relaxed text-[#E8E4DA]/90">
                            {entry.summary}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                          {entry.tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#9A968E]">
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

                          <Link
                            to={entryHref}
                            className="inline-flex min-h-[44px] items-center py-1 text-[#4FD1D9] underline decoration-[#4FD1D9]/40 underline-offset-4 transition-colors hover:text-[#E8E4DA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                          >
                            Read write-up →
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div
                  data-writeups-state="empty"
                  className="space-y-4 font-data-mono text-xs sm:text-sm"
                >
                  {isRenderableText(SITE_CONFIG.writeupsConfig.emptyStateLine) && (
                    <p className="leading-relaxed text-[#E8E4DA]">
                      {SITE_CONFIG.writeupsConfig.emptyStateLine}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <a
                      href={content.links.tryhackme}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center py-1 text-[#4FD1D9] underline decoration-[#4FD1D9]/40 underline-offset-4 transition-colors hover:text-[#E8E4DA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                    >
                      {SITE_CONFIG.writeupsConfig.emptyStateProfileLabel} ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ====================================================================
          SECTION 6: CONNECT (06 // ACCESS GRANTED) + FOOTER
         ==================================================================== */}
      <section
        id="connect"
        aria-label={sectionMeta.connect.navLabel}
        className="flex min-h-[100svh] w-full flex-col justify-between border-t border-[#262C36]/40 px-4 pt-20 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-10 md:px-20 md:pt-24"
      >
        <div
          className={`mx-auto mb-auto w-full max-w-7xl ${
            sectionMeta.connect.offsetClass ?? ''
          }`}
        >
          <RevealBlock
            disabled={skipReveal}
            className="max-w-3xl bg-[#0B0D10]/95 p-5 sm:p-10 border-l border-[#262C36]"
          >
            {/* Kicker + the ONLY place on the page where rare amber (#E8A33D) is used */}
            <div className="mb-3 flex flex-wrap items-center gap-3 font-data-mono text-xs tracking-widest">
              <span className="text-[#9A968E]">06 //</span>
              <span
                data-amber-status="access-granted"
                className="font-medium text-[#E8A33D]"
              >
                {content.connect.amberStatusLabel}
              </span>
            </div>

            <h2 className="mb-4 font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[#E8E4DA]">
              {content.connect.heading}
            </h2>

            {/* Fix 1: Any config or content string starting with "TODO" renders nothing on the page */}
            {isRenderableText(content.connect.introLine) && (
              <p className="mb-2 font-data-mono text-xs sm:text-sm leading-relaxed text-[#E8E4DA]">
                {content.connect.introLine}
              </p>
            )}

            {/* Status line under it */}
            {isRenderableText(content.connect.statusLine) && (
              <p className="mb-8 font-data-mono text-xs text-[#9A968E]">
                {content.connect.statusLine}
              </p>
            )}

            {/* Plain list of links, no form and no backend; >= 44px tap targets on mobile */}
            <ul
              data-testid="connect-channels-list"
              className="divide-y divide-[#262C36] border-t border-b border-[#262C36] font-data-mono text-xs sm:text-sm"
            >
              {content.connect.channels.map((channel) => {
                const colorTransitionClass = reducedMotion
                  ? 'transition-none'
                  : 'transition-colors duration-150 motion-reduce:transition-none';

                return (
                  <li
                    key={channel.id}
                    className="flex items-end sm:items-center justify-between gap-x-2 sm:gap-x-4 py-2 min-h-[48px]"
                  >
                    <a
                      href={channel.href}
                      target={channel.external ? '_blank' : undefined}
                      rel={channel.external ? 'noopener noreferrer' : undefined}
                      className="group flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-start gap-x-4 gap-y-1 py-1 min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                    >
                      <span className="inline-flex sm:w-40 shrink-0 items-center text-xs whitespace-nowrap">
                        <span
                          data-connect-icon={channel.id}
                          className={`inline-flex w-7 shrink-0 items-center justify-start text-[#9A968E] group-hover:text-[#4FD1D9] group-focus-visible:text-[#4FD1D9] group-focus:text-[#4FD1D9] ${colorTransitionClass}`}
                        >
                          <ConnectChannelIcon channelId={channel.id} />
                        </span>
                        <span
                          data-connect-label={channel.id}
                          className="text-[#9A968E]"
                        >
                          {channel.label}
                        </span>
                      </span>

                      <span
                        data-connect-value={channel.id}
                        className={`inline-flex items-center py-0.5 whitespace-nowrap text-[#E8E4DA] underline decoration-[#262C36] underline-offset-4 group-hover:text-[#4FD1D9] group-hover:decoration-[#4FD1D9] group-focus-visible:text-[#4FD1D9] group-focus-visible:decoration-[#4FD1D9] group-focus:text-[#4FD1D9] group-focus:decoration-[#4FD1D9] ${colorTransitionClass}`}
                      >
                        {channel.value}
                        {channel.external ? ' ↗' : ''}
                      </span>
                    </a>

                    {channel.copyValue && (
                      <button
                        type="button"
                        data-testid="copy-email-button"
                        onClick={() => handleCopyEmail(channel.copyValue)}
                        className={`shrink-0 cursor-pointer min-h-[44px] min-w-[44px] rounded border border-[#262C36] bg-[#0B0D10] px-3.5 py-1.5 text-xs text-[#E8E4DA] hover:border-[#4FD1D9] hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] ${colorTransitionClass}`}
                      >
                        {emailCopied
                          ? content.connect.copiedConfirmationLabel
                          : content.connect.copyEmailLabel}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </RevealBlock>
        </div>

        {/* Thin footer: "Δ vaibhav.marathe", the computed year, and a link back to top */}
        <footer className="mx-auto mt-14 w-full max-w-7xl border-t border-[#262C36]/70 bg-[#0B0D10]/95 pt-4 font-data-mono text-xs text-[#9A968E]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-h-[44px]">
              <span className="text-[#4FD1D9]" aria-hidden="true">
                {SITE_CONFIG.identity.mark}
              </span>
              <span className="text-[#E8E4DA]">
                {SITE_CONFIG.identity.handle}
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentYear}</span>
            </div>

            <a
              href="#home"
              data-testid="back-to-top-link"
              onClick={(e) => {
                e.preventDefault();
                onScrollToTop();
              }}
              className="inline-flex min-h-[44px] items-center px-1 text-[#E8E4DA] underline decoration-[#262C36] underline-offset-4 transition-colors hover:text-[#4FD1D9] hover:decoration-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
            >
              {content.connect.backToTopLabel}
            </a>
          </div>
        </footer>
      </section>
    </>
  );
}
