import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Github, Linkedin, Mail, Terminal } from 'lucide-react';
import {
  SITE_CONFIG,
  type QualityTierName,
  type SectionId,
} from './config';
import {
  getConfirmedPortfolioContent,
  isRenderableText,
  isWriteupUrlPublished,
  type SkillItem,
} from './contentFilter';
import {
  computeRevealStaggerDelayMs,
  createInitialSectionVisibilityMap,
  isSaveDataEnabled,
  MORPH_ARRIVAL_INTERSECTION_THRESHOLD,
  MORPH_SETTLE_DURATION_MS,
  MORPH_VELOCITY_THRESHOLD,
  resolveDominantArrivedSection,
  resolveInitialHashSectionId,
  shouldDisableSectionReveal,
  shouldTriggerSectionArrival,
  type SectionVisibilityMap,
} from './particleMath';
import { buildWriteupHref } from './router';

export const REVEAL_SECTION_IDS = [
  'background',
  'skills',
  'projects',
  'writeups',
  'connect',
] as const;

export const ALL_PORTFOLIO_SECTION_IDS = [
  'home',
  'background',
  'skills',
  'projects',
  'writeups',
  'connect',
] as const;

export type RevealSectionId = (typeof REVEAL_SECTION_IDS)[number];

export function isRevealSectionId(id: string): id is RevealSectionId {
  return (REVEAL_SECTION_IDS as readonly string[]).includes(id);
}

export function isPortfolioSectionId(id: string): id is SectionId {
  return (ALL_PORTFOLIO_SECTION_IDS as readonly string[]).includes(id);
}

export interface ScrollArrivalController {
  /** Current absolute scroll velocity from Lenis (used by particle morph arrival) */
  velocity: number;
  /** Timestamp (performance.now()) when velocity last dropped to <= morph velocity threshold */
  settledSinceMs: number;
  /** True while a programmatic jump (nav link, Menu link, Back to top, lenis.scrollTo, hash load) is active */
  isProgrammaticScroll: boolean;
  /** True on initial top load or right after a programmatic jump lands until normal user scroll moves */
  awaitingUserScroll: boolean;
  /** Scroll Y recorded when the last programmatic jump ended */
  lastProgrammaticEndScrollY: number;
  /** Destination section ID while a Lenis scrollTo (nav/Menu click) is in flight, or null */
  inTransitTargetId: SectionId | null;
  /** Listeners invoked when velocity settles or transit state changes (morph arrival) */
  settleListeners: Set<() => void>;
  /** Listeners invoked when normal user scrolling begins or resumes (section reveal) */
  normalScrollListeners: Set<() => void>;
  /** Immediate section reveal callback invoked when a programmatic jump finishes */
  onLandSection?: (sectionId: SectionId) => void;
  /** Currently arrived section ID for the repeatable particle morph state machine */
  arrivedSectionId: SectionId | null;
  /** Live IntersectionObserver visibility map across all 6 portfolio sections (morph logic) */
  inViewMap: SectionVisibilityMap;
}

interface PortfolioSectionsProps {
  reducedMotion: boolean;
  plainView: boolean;
  qualityTier?: QualityTierName;
  scrollArrivalRef?: MutableRefObject<ScrollArrivalController>;
  onScrollToTop: () => void;
}

type SectionRevealState = 'hidden' | 'animating' | 'settled';

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
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--border-subtle)] py-2 min-h-[44px] text-xs sm:text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span
          className={
            variant === 'used'
              ? 'font-medium text-[var(--text-primary)]'
              : 'text-[var(--text-primary)]'
          }
        >
          {item.name}
        </span>

        {isRenderableText(item.detail) && (
          <span className="font-data-mono text-xs text-[var(--text-muted)]">
            · {item.detail}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 font-data-mono text-xs">
        <span
          className={
            variant === 'used'
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }
        >
          {item.status}
        </span>

        {isRenderableText(item.evidenceLabel) && (
          <>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ·
            </span>
            {isRenderableText(item.evidenceUrl) ? (
              <a
                href={item.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center py-1 text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {item.evidenceLabel} ↗
              </a>
            ) : (
              <span className="text-[var(--text-muted)]">
                {item.evidenceLabel}
              </span>
            )}
          </>
        )}

        {!isRenderableText(item.evidenceLabel) &&
          isRenderableText(item.evidenceUrl) && (
            <>
              <span aria-hidden="true" className="text-[var(--text-muted)]">
                ·
              </span>
              <a
                href={item.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center py-1 text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
 * strictly from `src/content.js` (filtered via `getConfirmedPortfolioContent`),
 * with one-time section-arrival reveal animations driven by IntersectionObserver
 * and Lenis settled velocity.
 */
export function PortfolioSections({
  reducedMotion,
  plainView,
  qualityTier = 'high',
  scrollArrivalRef,
  onScrollToTop,
}: PortfolioSectionsProps) {
  const location = useLocation();
  const content = getConfirmedPortfolioContent(location.search);
  const [emailCopied, setEmailCopied] = useState(false);

  const animationsDisabled = shouldDisableSectionReveal({
    plainView,
    prefersReducedMotion: reducedMotion,
    qualityTier,
    saveData: isSaveDataEnabled(),
  });

  // Content is visible by default if JS or IntersectionObserver is unavailable
  const [observerArmed, setObserverArmed] = useState<boolean>(false);

  const [sectionStates, setSectionStates] = useState<
    Record<RevealSectionId, SectionRevealState>
  >(() => {
    const initialHashSec =
      typeof window !== 'undefined'
        ? resolveInitialHashSectionId(window.location.hash)
        : null;
    return {
      background:
        animationsDisabled || initialHashSec === 'background'
          ? 'settled'
          : 'hidden',
      skills:
        animationsDisabled || initialHashSec === 'skills'
          ? 'settled'
          : 'hidden',
      projects:
        animationsDisabled || initialHashSec === 'projects'
          ? 'settled'
          : 'hidden',
      writeups:
        animationsDisabled || initialHashSec === 'writeups'
          ? 'settled'
          : 'hidden',
      connect:
        animationsDisabled || initialHashSec === 'connect'
          ? 'settled'
          : 'hidden',
    };
  });

  const revealedSetRef = useRef<Set<RevealSectionId>>(new Set());
  // Visibility map for repeatable particle morph arrival (0.25 threshold, no rootMargin — unchanged)
  const inViewRef = useRef<
    Record<SectionId, { isIntersecting: boolean; ratio: number }>
  >(createInitialSectionVisibilityMap());
  // Visibility map for fast section text reveals (0.05 threshold, 0px 0px 12% 0px rootMargin)
  const revealInViewRef = useRef<
    Record<
      RevealSectionId,
      { isIntersecting: boolean; ratio: number; realViewportRatio: number }
    >
  >({
    background: { isIntersecting: false, ratio: 0, realViewportRatio: 0 },
    skills: { isIntersecting: false, ratio: 0, realViewportRatio: 0 },
    projects: { isIntersecting: false, ratio: 0, realViewportRatio: 0 },
    writeups: { isIntersecting: false, ratio: 0, realViewportRatio: 0 },
    connect: { isIntersecting: false, ratio: 0, realViewportRatio: 0 },
  });
  const failsafeTimersRef = useRef<Partial<Record<RevealSectionId, number>>>({});
  const willChangeTimersRef = useRef<Partial<Record<RevealSectionId, number>>>(
    {},
  );
  const animationsDisabledRef = useRef<boolean>(animationsDisabled);
  animationsDisabledRef.current = animationsDisabled;

  const clearFailsafeTimer = useCallback((secId: RevealSectionId) => {
    const t = failsafeTimersRef.current[secId];
    if (t !== undefined) {
      window.clearTimeout(t);
      delete failsafeTimersRef.current[secId];
    }
  }, []);

  /**
   * Triggers a section's arrival reveal at most ONCE (`revealedSetRef` guard).
   * After `durationMs + maxStaggerDelayMs`, transitions to `'settled'` and removes `will-change`.
   */
  const revealSection = useCallback(
    (secId: RevealSectionId, mode: 'animate' | 'instant') => {
      if (revealedSetRef.current.has(secId)) return;
      revealedSetRef.current.add(secId);
      clearFailsafeTimer(secId);

      if (mode === 'instant' || animationsDisabledRef.current) {
        setSectionStates((prev) =>
          prev[secId] === 'settled' ? prev : { ...prev, [secId]: 'settled' },
        );
        return;
      }

      setSectionStates((prev) => ({ ...prev, [secId]: 'animating' }));

      const maxDelayMs = computeRevealStaggerDelayMs(
        SITE_CONFIG.sectionReveal.staggerCap - 1,
      );
      const totalDurationMs =
        SITE_CONFIG.sectionReveal.durationMs + maxDelayMs + 50;

      const existingTimer = willChangeTimersRef.current[secId];
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      willChangeTimersRef.current[secId] = window.setTimeout(() => {
        delete willChangeTimersRef.current[secId];
        setSectionStates((prev) =>
          prev[secId] === 'settled' ? prev : { ...prev, [secId]: 'settled' },
        );
      }, totalDurationMs);
    },
    [clearFailsafeTimer],
  );

  const revealAllInstantly = useCallback(() => {
    for (const secId of REVEAL_SECTION_IDS) {
      clearFailsafeTimer(secId);
      const wt = willChangeTimersRef.current[secId];
      if (wt !== undefined) {
        window.clearTimeout(wt);
        delete willChangeTimersRef.current[secId];
      }
      revealedSetRef.current.add(secId);
    }
    setSectionStates({
      background: 'settled',
      skills: 'settled',
      projects: 'settled',
      writeups: 'settled',
      connect: 'settled',
    });
  }, [clearFailsafeTimer]);

  // Whenever Plain view, prefers-reduced-motion, low quality tier, or Save-Data becomes active,
  // immediately settle all sections with opacity: 1 and transform: none.
  useEffect(() => {
    if (animationsDisabled) {
      revealAllInstantly();
    }
  }, [animationsDisabled, revealAllInstantly]);

  // Preserved velocity settle check strictly for the particle morph state machine (unchanged)
  const isVelocitySettledForMorph = useCallback((): boolean => {
    const ctrl = scrollArrivalRef?.current;
    if (!ctrl) return true;
    if (ctrl.velocity > MORPH_VELOCITY_THRESHOLD) return false;
    if (ctrl.settledSinceMs <= 0) return true;
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    return now - ctrl.settledSinceMs >= MORPH_SETTLE_DURATION_MS;
  }, [scrollArrivalRef]);

  const evaluateMorphArrival = useCallback(() => {
    const ctrl = scrollArrivalRef?.current;
    if (!ctrl) return;
    const inTransitTargetId = ctrl.inTransitTargetId ?? null;
    const settled = isVelocitySettledForMorph();

    ctrl.inViewMap = inViewRef.current;
    const scrollY =
      typeof window !== 'undefined'
        ? window.scrollY ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0
        : 0;
    const vh =
      typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : 800;
    const docH =
      typeof document !== 'undefined'
        ? Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            vh * 2,
          )
        : 4800;
    const heroProgress = Math.min(
      1,
      Math.max(0, scrollY / (vh * SITE_CONFIG.scroll.dispersionScrollVh)),
    );
    const pageProgress = Math.min(
      1,
      Math.max(0, scrollY / Math.max(1, docH - vh)),
    );

    ctrl.arrivedSectionId = resolveDominantArrivedSection({
      inViewMap: inViewRef.current,
      heroProgress,
      pageProgress,
      inTransitTargetId,
      isVelocitySettled: settled,
      currentArrivedSection: ctrl.arrivedSectionId,
    });
  }, [isVelocitySettledForMorph, scrollArrivalRef]);

  const getLiveUnobstructedViewportRatio = useCallback(
    (secId: RevealSectionId): number => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return 0;
      }
      const el = document.getElementById(secId);
      if (!el) return 0;
      const vh = Math.max(1, window.innerHeight || 800);
      const headerPx = Math.abs(SITE_CONFIG.lenis.headerOffsetPx);
      const rect = el.getBoundingClientRect();
      const clampedTop = Math.max(headerPx, rect.top);
      const clampedBottom = Math.min(vh, rect.bottom);
      const realVisiblePx = Math.max(0, clampedBottom - clampedTop);
      if (realVisiblePx <= 0) return 0;
      return Math.max(
        rect.height > 0 ? realVisiblePx / rect.height : 0,
        realVisiblePx / vh,
      );
    },
    [],
  );

  const scheduleFailsafeIfVisible = useCallback(
    (secId: RevealSectionId) => {
      if (animationsDisabledRef.current || revealedSetRef.current.has(secId)) {
        clearFailsafeTimer(secId);
        return;
      }
      const ctrl = scrollArrivalRef?.current;
      if (ctrl?.isProgrammaticScroll) {
        clearFailsafeTimer(secId);
        return;
      }
      const threshold = SITE_CONFIG.sectionReveal.intersectionThreshold;
      const liveRatio = getLiveUnobstructedViewportRatio(secId);
      if (liveRatio >= threshold) {
        if (failsafeTimersRef.current[secId] === undefined) {
          failsafeTimersRef.current[secId] = window.setTimeout(() => {
            delete failsafeTimersRef.current[secId];
            const latestCtrl = scrollArrivalRef?.current;
            const currentRatio = getLiveUnobstructedViewportRatio(secId);
            if (
              !latestCtrl?.isProgrammaticScroll &&
              !revealedSetRef.current.has(secId) &&
              currentRatio >= threshold
            ) {
              revealSection(secId, 'animate');
            }
          }, SITE_CONFIG.sectionReveal.failsafeTimeoutMs);
        }
      } else {
        clearFailsafeTimer(secId);
      }
    },
    [
      clearFailsafeTimer,
      getLiveUnobstructedViewportRatio,
      revealSection,
      scrollArrivalRef,
    ],
  );

  /**
   * Evaluates one-time section text reveals in Normal Scrolling mode.
   * No velocity check or settle wait: reveals immediately as soon as >= 5% enters
   * the IntersectionObserver root (0px 0px 12% 0px).
   * Suppressed while a programmatic jump is active (`isProgrammaticScroll === true`)
   * or before normal user scrolling begins after initial load / programmatic landing.
   */
  const evaluateRevealArrivals = useCallback(() => {
    if (animationsDisabledRef.current) return;
    const ctrl = scrollArrivalRef?.current;
    const isProgrammaticScroll = ctrl?.isProgrammaticScroll ?? false;
    const awaitingUserScroll = ctrl?.awaitingUserScroll ?? false;
    const inTransitTargetId = ctrl?.inTransitTargetId ?? null;

    if (isProgrammaticScroll) {
      for (const secId of REVEAL_SECTION_IDS) {
        clearFailsafeTimer(secId);
      }
      return;
    }

    for (const secId of REVEAL_SECTION_IDS) {
      if (revealedSetRef.current.has(secId)) continue;
      const entry = revealInViewRef.current[secId];

      if (!awaitingUserScroll) {
        if (
          shouldTriggerSectionArrival({
            sectionId: secId,
            alreadyRevealed: false,
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.ratio,
            isProgrammaticScroll: false,
            inTransitTargetId,
          })
        ) {
          revealSection(secId, 'animate');
          continue;
        }
      }

      scheduleFailsafeIfVisible(secId);
    }
  }, [
    clearFailsafeTimer,
    revealSection,
    scheduleFailsafeIfVisible,
    scrollArrivalRef,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If the page loaded with a URL hash (e.g. #Connect), mark that section as settled immediately
    const initialHashSec = resolveInitialHashSectionId(window.location.hash);
    if (initialHashSec && isRevealSectionId(initialHashSec)) {
      revealedSetRef.current.add(initialHashSec);
      if (scrollArrivalRef?.current) {
        scrollArrivalRef.current.arrivedSectionId = initialHashSec;
      }
    }

    // Register morph velocity-settle, normal-scroll, and programmatic landing callbacks
    const ctrl = scrollArrivalRef?.current;
    const onSettle = () => {
      evaluateMorphArrival();
    };
    const onNormalScroll = () => {
      evaluateRevealArrivals();
    };
    const onLandSection = (landedId: SectionId) => {
      if (ctrl) {
        ctrl.arrivedSectionId = landedId;
      }
      for (const secId of REVEAL_SECTION_IDS) {
        clearFailsafeTimer(secId);
      }
      if (isRevealSectionId(landedId)) {
        revealSection(landedId, 'animate');
      }
      // After programmatic landing, only schedule 200ms failsafe for any other section
      // that is genuinely >= 5% visible inside the unobstructed viewport (below header)
      for (const secId of REVEAL_SECTION_IDS) {
        if (secId !== landedId) {
          scheduleFailsafeIfVisible(secId);
        }
      }
    };

    if (ctrl) {
      ctrl.settleListeners.add(onSettle);
      ctrl.normalScrollListeners.add(onNormalScroll);
      ctrl.onLandSection = onLandSection;
    }

    if (typeof IntersectionObserver === 'undefined') {
      revealAllInstantly();
      return;
    }

    let morphObserver: IntersectionObserver | null = null;
    let revealObserver: IntersectionObserver | null = null;
    try {
      // 1. Morph observer: unchanged 0.25 viewport threshold with no rootMargin
      const morphThreshold = MORPH_ARRIVAL_INTERSECTION_THRESHOLD;
      morphObserver = new IntersectionObserver(
        (entries) => {
          try {
            const vh = Math.max(1, window.innerHeight || 800);
            for (const entry of entries) {
              const secId = entry.target.id;
              if (!isPortfolioSectionId(secId)) continue;

              const visibleHeight = entry.intersectionRect
                ? entry.intersectionRect.height
                : 0;
              const viewportRatio = visibleHeight / vh;
              const effectiveRatio = Math.max(
                entry.intersectionRatio,
                viewportRatio,
              );

              inViewRef.current[secId] = {
                isIntersecting: entry.isIntersecting,
                ratio: effectiveRatio,
              };
            }

            evaluateMorphArrival();
          } catch {
            // Ignore morph observer errors safely
          }
        },
        {
          threshold: [0, 0.1, 0.2, morphThreshold, 0.4, 0.6, 0.8, 1],
        },
      );

      for (const secId of ALL_PORTFOLIO_SECTION_IDS) {
        const el = document.getElementById(secId);
        if (el) {
          morphObserver.observe(el);
        }
      }

      // 2. Reveal observer: 0.05 threshold + 0px 0px 12% 0px rootMargin for immediate fade on normal scroll
      const revealThreshold = SITE_CONFIG.sectionReveal.intersectionThreshold;
      const headerPx = Math.abs(SITE_CONFIG.lenis.headerOffsetPx);
      revealObserver = new IntersectionObserver(
        (entries) => {
          try {
            const vh = Math.max(1, window.innerHeight || 800);
            for (const entry of entries) {
              const secId = entry.target.id;
              if (!isRevealSectionId(secId)) continue;

              const visibleHeight = entry.intersectionRect
                ? entry.intersectionRect.height
                : 0;
              const viewportRatio = visibleHeight / vh;
              const effectiveRatio = Math.max(
                entry.intersectionRatio,
                viewportRatio,
              );

              // Fraction visible inside the unobstructed viewport [headerPx, vh]
              // (excludes pixels tucked behind the fixed header or below the fold in the +12% margin)
              const rect = entry.boundingClientRect;
              const clampedTop = Math.max(headerPx, rect.top);
              const clampedBottom = Math.min(vh, rect.bottom);
              const realVisiblePx = Math.max(0, clampedBottom - clampedTop);
              const realViewportRatio = Math.max(
                rect.height > 0 ? realVisiblePx / rect.height : 0,
                realVisiblePx / vh,
              );

              revealInViewRef.current[secId] = {
                isIntersecting: entry.isIntersecting,
                ratio: effectiveRatio,
                realViewportRatio,
              };
            }

            evaluateRevealArrivals();
          } catch {
            revealAllInstantly();
          }
        },
        {
          threshold: [0, revealThreshold, 0.1, 0.25, 0.5, 1],
          rootMargin: SITE_CONFIG.sectionReveal.rootMargin,
        },
      );

      for (const secId of REVEAL_SECTION_IDS) {
        const el = document.getElementById(secId);
        if (el) {
          revealObserver.observe(el);
        }
      }

      setObserverArmed(true);
    } catch {
      revealAllInstantly();
    }

    const failsafeTimers = failsafeTimersRef.current;
    const willChangeTimers = willChangeTimersRef.current;

    return () => {
      if (morphObserver) {
        morphObserver.disconnect();
      }
      if (revealObserver) {
        revealObserver.disconnect();
      }
      if (ctrl) {
        ctrl.settleListeners.delete(onSettle);
        ctrl.normalScrollListeners.delete(onNormalScroll);
        if (ctrl.onLandSection === onLandSection) {
          ctrl.onLandSection = undefined;
        }
      }
      for (const secId of REVEAL_SECTION_IDS) {
        const ft = failsafeTimers[secId];
        if (ft !== undefined) {
          window.clearTimeout(ft);
          delete failsafeTimers[secId];
        }
        const wt = willChangeTimers[secId];
        if (wt !== undefined) {
          window.clearTimeout(wt);
          delete willChangeTimers[secId];
        }
      }
    };
  }, [
    clearFailsafeTimer,
    evaluateMorphArrival,
    evaluateRevealArrivals,
    revealAllInstantly,
    revealSection,
    scheduleFailsafeIfVisible,
    scrollArrivalRef,
  ]);

  /**
   * Builds inline style and data attributes for an ordered reveal item inside a section.
   * Uses ONLY opacity and transform (translateY 8px -> 0) with 300ms ease-out and
   * 20ms stagger capped at 5 items (~380ms total). Removes will-change after the animation ends.
   */
  const getRevealItemProps = (
    secId: RevealSectionId,
    staggerIndex: number,
  ): {
    'data-reveal-item': string;
    'data-reveal-index': number;
    'data-reveal-state': SectionRevealState;
    style: CSSProperties;
  } => {
    const cappedIndex = Math.max(
      0,
      Math.min(
        Math.floor(staggerIndex),
        SITE_CONFIG.sectionReveal.staggerCap - 1,
      ),
    );
    const delayMs = computeRevealStaggerDelayMs(cappedIndex);

    // Content is visible by default before mount, without IntersectionObserver, or when disabled
    const effectiveState: SectionRevealState =
      !observerArmed || animationsDisabled ? 'settled' : sectionStates[secId];

    let style: CSSProperties;
    if (effectiveState === 'hidden') {
      style = {
        opacity: 0,
        transform: `translateY(${SITE_CONFIG.sectionReveal.translateYDistancePx}px)`,
        transition: 'none',
        willChange: 'opacity, transform',
      };
    } else if (effectiveState === 'animating') {
      style = {
        opacity: 1,
        transform: 'translateY(0px)',
        transitionProperty: 'opacity, transform',
        transitionDuration: `${SITE_CONFIG.sectionReveal.durationMs}ms`,
        transitionTimingFunction: SITE_CONFIG.sectionReveal.easing,
        transitionDelay: `${delayMs}ms`,
        willChange: 'opacity, transform',
      };
    } else {
      style = {
        opacity: 1,
        transform: 'none',
        transition: 'none',
        willChange: 'auto',
      };
    }

    return {
      'data-reveal-item': `${secId}-${cappedIndex}`,
      'data-reveal-index': cappedIndex,
      'data-reveal-state': effectiveState,
      style,
    };
  };

  const getSectionRevealStateAttr = (
    secId: RevealSectionId,
  ): SectionRevealState =>
    !observerArmed || animationsDisabled ? 'settled' : sectionStates[secId];

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
        data-section-reveal={getSectionRevealStateAttr('background')}
        className="flex min-h-[100svh] w-full flex-col justify-center border-t border-[var(--border-subtle)] px-4 py-20 sm:px-10 md:px-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-7xl">
          <div className="bg-[var(--bg)] p-5 sm:p-10">
            <p
              {...getRevealItemProps('background', 0)}
              className="mb-3 font-data-mono text-xs tracking-widest text-[var(--accent)]"
            >
              {sectionMeta.background.kicker}
            </p>
            <h2
              {...getRevealItemProps('background', 0)}
              className="mb-8 sm:mb-10 font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[var(--text-primary)]"
            >
              {sectionMeta.background.title}
            </h2>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16 items-start">
              {/* Left Column: Intro text + Pull-quote tagline */}
              <div className="lg:col-span-5 space-y-8">
                {isRenderableText(content.background.introDraft) && (
                  <p
                    {...getRevealItemProps('background', 0)}
                    className="font-data-mono text-xs sm:text-sm leading-relaxed text-[var(--text-primary)]"
                  >
                    {content.background.introDraft}
                  </p>
                )}

                {isRenderableText(content.background.taglinePullQuote) && (
                  <blockquote
                    {...getRevealItemProps('background', 1)}
                    className="border-t border-b border-[var(--border-subtle)] py-5 font-display-serif text-2xl sm:text-3xl italic leading-snug text-[var(--text-primary)]"
                  >
                    “{content.background.taglinePullQuote}”
                  </blockquote>
                )}
              </div>

              {/* Right Column: Vertical mono changelog + status line */}
              <div className="lg:col-span-7 font-data-mono">
                <div
                  {...getRevealItemProps('background', 1)}
                  className="mb-3 text-xs tracking-wider text-[var(--text-muted)]"
                >
                  changelog
                </div>

                {/* Reserved date column ensures dated and undated entries align identically */}
                <ol className="relative border-l border-[var(--border-subtle)] pl-4 sm:pl-5 space-y-6">
                  {content.background.changelog.map((entry, idx) => {
                    const hasDate = isRenderableText(entry.date);
                    return (
                      <li
                        key={entry.id}
                        {...getRevealItemProps('background', 2 + idx)}
                        className="relative grid grid-cols-[3rem_1fr] sm:grid-cols-[4rem_1fr] gap-2.5 sm:gap-4 items-baseline text-xs sm:text-sm"
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute -left-[19px] sm:-left-[23px] top-1.5 h-1.5 w-1.5 rounded-full ${
                            entry.date === 'Now'
                              ? 'bg-[var(--accent)]'
                              : 'bg-[var(--text-muted)]'
                          }`}
                        />
                        <div
                          data-changelog-date={hasDate ? entry.date : 'empty'}
                          className={`text-xs tracking-wider select-none ${
                            hasDate
                              ? 'font-medium text-[var(--accent)]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {hasDate ? entry.date : '—'}
                        </div>
                        <p
                          data-changelog-text={entry.id}
                          className="leading-relaxed text-[var(--text-primary)]"
                        >
                          {entry.text}
                        </p>
                      </li>
                    );
                  })}
                </ol>

                {isRenderableText(content.background.statusLine) && (
                  <p
                    {...getRevealItemProps('background', 4)}
                    className="mt-8 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-muted)]"
                  >
                    {content.background.statusLine}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 3: SKILLS (03 // SCANNING)
         ==================================================================== */}
      <section
        id="skills"
        aria-label={sectionMeta.skills.navLabel}
        data-section-reveal={getSectionRevealStateAttr('skills')}
        className="flex min-h-[100svh] w-full flex-col justify-center border-t border-[var(--border-subtle)] px-4 py-20 sm:px-10 md:px-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-7xl">
          <div className="p-5 sm:p-10">
            <div className="mb-8 sm:mb-10 flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg)] pb-6 md:flex-row md:items-end">
              <div>
                <p
                  {...getRevealItemProps('skills', 0)}
                  className="mb-3 font-data-mono text-xs tracking-widest text-[var(--accent)]"
                >
                  {sectionMeta.skills.kicker}
                </p>
                <h2
                  {...getRevealItemProps('skills', 0)}
                  className="font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[var(--text-primary)]"
                >
                  {sectionMeta.skills.title}
                </h2>
              </div>

              <div
                {...getRevealItemProps('skills', 0)}
                className="flex items-center gap-4 font-data-mono text-xs text-[var(--text-muted)]"
              >
                <span className="text-[var(--accent)]">
                  {content.skills.statusLabels.usedInLab}
                </span>
                <span aria-hidden="true">·</span>
                <span>{content.skills.statusLabels.learning}</span>
              </div>
            </div>

            {/* Grouped lists, no percentage bars, no logo walls; "used in lab" visually separated from "learning" */}
            <div className="space-y-10 font-data-mono">
              {content.skills.groups.map((group, groupIdx) => (
                <div
                  key={group.id}
                  {...getRevealItemProps('skills', groupIdx)}
                  className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-10 items-start"
                >
                  <h3 className="lg:col-span-3 bg-[var(--bg)] pt-2 text-xs tracking-wider text-[var(--text-muted)]">
                    {group.title}
                  </h3>

                  <div className="lg:col-span-9 grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Sub-list 1: Used in lab */}
                    <div className="bg-[var(--bg)]">
                      <div className="mb-2 text-[11px] tracking-wider text-[var(--accent)]">
                        {content.skills.statusLabels.usedInLab}
                      </div>
                      {group.usedInLab.length > 0 ? (
                        <ul className="border-t border-[var(--border-subtle)]">
                          {group.usedInLab.map((item) => (
                            <SkillEntryRow
                              key={item.name}
                              item={item}
                              variant="used"
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="border-t border-[var(--border-subtle)] py-2 text-xs text-[var(--text-muted)]">
                          —
                        </p>
                      )}
                    </div>

                    {/* Sub-list 2: Learning */}
                    <div className="bg-[var(--bg)]">
                      <div className="mb-2 text-[11px] tracking-wider text-[var(--text-muted)]">
                        {content.skills.statusLabels.learning}
                      </div>
                      {group.learning.length > 0 ? (
                        <ul className="border-t border-[var(--border-subtle)]">
                          {group.learning.map((item) => (
                            <SkillEntryRow
                              key={item.name}
                              item={item}
                              variant="learning"
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="border-t border-[var(--border-subtle)] py-2 text-xs text-[var(--text-muted)]">
                          —
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 4: PROJECTS / CTFs (04 // EXPLOITATION)
         ==================================================================== */}
      <section
        id="projects"
        aria-label={sectionMeta.projects.navLabel}
        data-section-reveal={getSectionRevealStateAttr('projects')}
        className="flex min-h-[100svh] w-full flex-col justify-center border-t border-[var(--border-subtle)] px-4 py-20 sm:px-10 md:px-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-7xl">
          <div className="bg-[var(--bg)] p-5 sm:p-10">
            <p
              {...getRevealItemProps('projects', 0)}
              className="mb-3 font-data-mono text-xs tracking-widest text-[var(--accent)]"
            >
              {sectionMeta.projects.kicker}
            </p>
            <h2
              {...getRevealItemProps('projects', 0)}
              className="mb-10 sm:mb-12 font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[var(--text-primary)]"
            >
              {sectionMeta.projects.title}
            </h2>

            {/* Two lanes side-by-side on desktop, stacked on mobile, with distinct visual treatment */}
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-12 items-start">
              {/* Lane 1: BUILT (Software & Systems Engineering) */}
              <div className="lg:col-span-5">
                <div
                  {...getRevealItemProps('projects', 0)}
                  className="mb-6 flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-3"
                >
                  <h3 className="font-display-serif text-3xl text-[var(--text-primary)]">
                    {content.projectsAndCtfs.builtHeading}
                  </h3>
                  <span className="font-data-mono text-xs text-[var(--text-muted)]">
                    software & systems
                  </span>
                </div>

                <ul className="divide-y divide-[var(--border-subtle)]">
                  {content.projectsAndCtfs.built.map((proj, projIdx) => (
                    <li
                      key={proj.id}
                      {...getRevealItemProps('projects', projIdx)}
                      className="py-6 first:pt-2"
                    >
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="font-data-mono text-sm sm:text-base font-medium text-[var(--text-primary)]">
                          {proj.title}
                        </h4>
                        {isRenderableText(proj.status) && (
                          <span className="font-data-mono text-xs text-[var(--text-muted)]">
                            {proj.status}
                          </span>
                        )}
                      </div>

                      {isRenderableText(proj.description) && (
                        <p className="mb-3 font-data-mono text-xs sm:text-sm leading-relaxed text-[var(--text-primary)]">
                          {proj.description}
                        </p>
                      )}

                      {proj.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-data-mono text-xs text-[var(--text-muted)]">
                          {proj.tags.map((tag, idx) => (
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

                      <div className="font-data-mono text-xs">
                        {isRenderableText(proj.repoUrl) ? (
                          <a
                            href={proj.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center py-1 text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                          >
                            {isRenderableText(proj.repoLabel)
                              ? proj.repoLabel
                              : 'Repository'}{' '}
                            ↗
                          </a>
                        ) : (
                          isRenderableText(proj.repoNote) && (
                            <span className="inline-flex min-h-[32px] items-center text-[var(--text-muted)]">
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
              <div className="lg:col-span-7 lg:border-l lg:border-[var(--border-subtle)] lg:pl-10">
                <div
                  {...getRevealItemProps('projects', 0)}
                  className="mb-6 flex items-baseline justify-between border-b border-[var(--accent)]/40 pb-3"
                >
                  <h3 className="font-display-serif text-3xl text-[var(--text-primary)]">
                    {content.projectsAndCtfs.brokenHeading}
                  </h3>
                  <span className="font-data-mono text-xs text-[var(--accent)]">
                    labs & CTFs
                  </span>
                </div>

                <ul className="divide-y divide-[var(--border-subtle)] font-data-mono">
                  {content.projectsAndCtfs.broken.map((lab, labIdx) => {
                    // Fix 2: Links to a write-up page render ONLY when that write-up has published:true
                    const showWriteupLink =
                      isRenderableText(lab.writeupUrl) &&
                      isWriteupUrlPublished(lab.writeupUrl, content.writeups.all);

                    return (
                      <li
                        key={lab.id}
                        {...getRevealItemProps('projects', labIdx)}
                        className="py-5 first:pt-2"
                      >
                        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <h4 className="text-sm sm:text-base font-medium text-[var(--text-primary)]">
                              {lab.title}
                            </h4>
                            {isRenderableText(lab.platform) && (
                              <span className="text-xs text-[var(--accent)]">
                                [{lab.platform}]
                              </span>
                            )}
                          </div>

                          {isRenderableText(lab.status) && (
                            <span className="text-xs text-[var(--text-muted)]">
                              {lab.status}
                            </span>
                          )}
                        </div>

                        {isRenderableText(lab.description) && (
                          <p className="mb-3 text-xs sm:text-sm leading-relaxed text-[var(--text-primary)]">
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
                                className="inline-flex min-h-[44px] items-center py-1 text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
                                className="inline-flex min-h-[44px] items-center py-1 text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
                  <p
                    {...getRevealItemProps('projects', 4)}
                    className="mt-4 border-t border-[var(--border-subtle)] pt-4 font-data-mono text-xs text-[var(--text-muted)]"
                  >
                    {content.projectsAndCtfs.brokenCompactLine}
                  </p>
                )}
              </div>
            </div>
          </div>
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
        data-section-reveal={getSectionRevealStateAttr('writeups')}
        className="flex w-full flex-col justify-center border-t border-[var(--border-subtle)] px-4 py-20 sm:px-10 md:px-20 md:py-24"
      >
        <div
          className={`mx-auto w-full max-w-7xl ${
            sectionMeta.writeups.offsetClass ?? ''
          }`}
        >
          <div className="max-w-4xl bg-[var(--bg)] p-5 sm:p-10 border-l border-[var(--border-subtle)]">
            <div
              data-writeups-route-template={buildWriteupHref(
                SITE_CONFIG.routing.plannedWriteupSlugs[0],
              )}
            >
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
                <div>
                  <p
                    {...getRevealItemProps('writeups', 0)}
                    className="mb-3 font-data-mono text-xs tracking-widest text-[var(--accent)]"
                  >
                    {sectionMeta.writeups.kicker}
                  </p>
                  <h2
                    {...getRevealItemProps('writeups', 0)}
                    className="font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[var(--text-primary)]"
                  >
                    {sectionMeta.writeups.title}
                  </h2>
                </div>

                {isRenderableText(SITE_CONFIG.writeupsConfig.viewAllLabel) && (
                  <div {...getRevealItemProps('writeups', 0)}>
                    <Link
                      to={`${SITE_CONFIG.routing.writeupsBasePath}${location.search}`}
                      className="inline-flex min-h-[44px] items-center py-1 font-data-mono text-xs text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      {SITE_CONFIG.writeupsConfig.viewAllLabel} →
                    </Link>
                  </div>
                )}
              </div>

              {content.writeups.published.length > 0 ? (
                <ul
                  data-writeups-state="published-list"
                  className="divide-y divide-[var(--border-subtle)] font-data-mono"
                >
                  {content.writeups.published.map((entry, idx) => {
                    const entryHref = `${buildWriteupHref(entry.slug)}${location.search}`;
                    return (
                      <li
                        key={entry.slug}
                        {...getRevealItemProps('writeups', idx)}
                        className="py-6 first:pt-2"
                      >
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex flex-wrap items-baseline gap-2.5">
                            <h3 className="text-base sm:text-lg font-medium text-[var(--text-primary)]">
                              <Link
                                to={entryHref}
                                className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                              >
                                {entry.title}
                              </Link>
                            </h3>
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
                              {entry.tags.map((tag, tagIdx) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-2"
                                >
                                  {tagIdx > 0 && <span aria-hidden="true">·</span>}
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
                  data-writeups-state="empty"
                  className="space-y-4 font-data-mono text-xs sm:text-sm"
                >
                  {isRenderableText(SITE_CONFIG.writeupsConfig.emptyStateLine) && (
                    <p
                      {...getRevealItemProps('writeups', 0)}
                      className="leading-relaxed text-[var(--text-primary)]"
                    >
                      {SITE_CONFIG.writeupsConfig.emptyStateLine}
                    </p>
                  )}
                  <div
                    {...getRevealItemProps('writeups', 1)}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"
                  >
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
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 6: CONNECT (06 // ACCESS GRANTED) + FOOTER
         ==================================================================== */}
      <section
        id="connect"
        aria-label={sectionMeta.connect.navLabel}
        data-section-reveal={getSectionRevealStateAttr('connect')}
        className="flex min-h-[100svh] w-full flex-col justify-between border-t border-[var(--border-subtle)] px-4 pt-20 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-10 md:px-20 md:pt-24"
      >
        <div
          className={`mx-auto mb-auto w-full max-w-7xl ${
            sectionMeta.connect.offsetClass ?? ''
          }`}
        >
          <div className="max-w-3xl bg-[var(--bg)] p-5 sm:p-10 border-l border-[var(--border-subtle)]">
            {/* Kicker + the ONLY place on the page where rare amber is used */}
            <div
              {...getRevealItemProps('connect', 0)}
              className="mb-3 flex flex-wrap items-center gap-3 font-data-mono text-xs tracking-widest"
            >
              <span className="text-[var(--text-muted)]">06 //</span>
              <span
                data-amber-status="access-granted"
                className="font-medium text-[var(--amber)]"
              >
                {content.connect.amberStatusLabel}
              </span>
            </div>

            <h2
              {...getRevealItemProps('connect', 0)}
              className="mb-4 font-display-serif text-[clamp(2.35rem,5.5vw,4.5rem)] font-normal leading-[1.02] tracking-tight text-[var(--text-primary)]"
            >
              {content.connect.heading}
            </h2>

            {/* Fix 1: Any config or content string starting with "TODO" renders nothing on the page */}
            {isRenderableText(content.connect.introLine) && (
              <p
                {...getRevealItemProps('connect', 0)}
                className="mb-2 font-data-mono text-xs sm:text-sm leading-relaxed text-[var(--text-primary)]"
              >
                {content.connect.introLine}
              </p>
            )}

            {/* Status line under it */}
            {isRenderableText(content.connect.statusLine) && (
              <p
                {...getRevealItemProps('connect', 0)}
                className="mb-8 font-data-mono text-xs text-[var(--text-muted)]"
              >
                {content.connect.statusLine}
              </p>
            )}

            {/* Plain list of links, no form and no backend; >= 44px tap targets on mobile */}
            <ul
              data-testid="connect-channels-list"
              className="divide-y divide-[var(--border-subtle)] border-t border-b border-[var(--border-subtle)] font-data-mono text-xs sm:text-sm"
            >
              {content.connect.channels.map((channel, idx) => {
                const colorTransitionClass = reducedMotion
                  ? 'transition-none'
                  : 'transition-colors duration-150 motion-reduce:transition-none';

                return (
                  <li
                    key={channel.id}
                    {...getRevealItemProps('connect', 1 + idx)}
                    className="flex items-end sm:items-center justify-between gap-x-2 sm:gap-x-4 py-2 min-h-[48px]"
                  >
                    <a
                      href={channel.href}
                      target={channel.external ? '_blank' : undefined}
                      rel={channel.external ? 'noopener noreferrer' : undefined}
                      className="group flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-start gap-x-4 gap-y-1 py-1 min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      <span className="inline-flex sm:w-40 shrink-0 items-center text-xs whitespace-nowrap">
                        <span
                          data-connect-icon={channel.id}
                          className={`inline-flex w-7 shrink-0 items-center justify-start text-[var(--text-muted)] group-hover:text-[var(--accent)] group-focus-visible:text-[var(--accent)] group-focus:text-[var(--accent)] ${colorTransitionClass}`}
                        >
                          <ConnectChannelIcon channelId={channel.id} />
                        </span>
                        <span
                          data-connect-label={channel.id}
                          className="text-[var(--text-muted)]"
                        >
                          {channel.label}
                        </span>
                      </span>

                      <span
                        data-connect-value={channel.id}
                        className={`inline-flex items-center py-0.5 whitespace-nowrap text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 group-hover:text-[var(--accent)] group-hover:decoration-[var(--accent)] group-focus-visible:text-[var(--accent)] group-focus-visible:decoration-[var(--accent)] group-focus:text-[var(--accent)] group-focus:decoration-[var(--accent)] ${colorTransitionClass}`}
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
                        className={`shrink-0 cursor-pointer min-h-[44px] min-w-[44px] rounded border border-[var(--border-subtle)] bg-[var(--bg)] px-3.5 py-1.5 text-xs text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${colorTransitionClass}`}
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
          </div>
        </div>

        {/* Thin footer: "Δ vaibhav.marathe", the computed year, and a link back to top */}
        <footer
          {...getRevealItemProps('connect', 4)}
          className="mx-auto mt-14 w-full max-w-7xl border-t border-[var(--border-subtle)] bg-[var(--bg)] pt-4 font-data-mono text-xs text-[var(--text-muted)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-h-[44px]">
              <span className="text-[var(--accent)]" aria-hidden="true">
                {SITE_CONFIG.identity.mark}
              </span>
              <span className="text-[var(--text-primary)]">
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
              className="inline-flex min-h-[44px] items-center px-1 text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {content.connect.backToTopLabel}
            </a>
          </div>
        </footer>
      </section>
    </>
  );
}
