import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import Lenis from 'lenis';
import { SITE_CONFIG, type SectionId } from './config';
import {
  computeScrollMetrics,
  getInitialPlainView,
  getIntroMountCount,
  hasVisitedBefore,
  isIntroFinishedInSession,
  isSaveDataEnabled,
  markIntroFinishedInSession,
  resolveQualityTierProfile,
  resolveStartingQualityTier,
  savePlainViewPreference,
  shouldSkipIntroOnLoad,
  type ScrollMetrics,
} from './particleMath';
import { isRenderableText } from './contentFilter';
import { resolveRoute } from './router';
import {
  getInitialSoundMuted,
  saveSoundMutedPreference,
} from './soundEngine';
import { TerminalIntro } from './TerminalIntro';
import { Navbar } from './Navbar';
import { PortfolioSections } from './PortfolioSections';
import type { SceneDebugStats } from './DeltaScene';

// Lazy-load the Three.js scene after first paint so hero HTML (name, tagline, nav) renders immediately
const LazyDeltaScene = lazy(() => import('./DeltaScene'));

// Lazy-load route code for /writeups pages
const LazyWriteupsIndexPage = lazy(() =>
  import('./WriteupPages').then((m) => ({ default: m.WriteupsIndexPage })),
);
const LazyWriteupDetailPage = lazy(() =>
  import('./WriteupPages').then((m) => ({ default: m.WriteupDetailPage })),
);

/**
 * Checks prefers-reduced-motion media query safely.
 */
function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return reducedMotion;
}

/**
 * HomeView (defined at module level so it never remounts on parent render)
 * Renders the 6-section portfolio at `/`.
 * Shows hero text (name, tagline, nav) immediately as HTML with no blank screen,
 * and lazy-loads the Three.js scene after first paint.
 */
function HomeView({
  reducedMotion,
  plainView,
  introComplete,
  isRepeatVisit,
  soundMuted,
  scrollMetricsRef,
  onIntroComplete,
  onIntroMountDiagnostic,
  onScrollToTop,
  onDebugStatsChange,
}: {
  reducedMotion: boolean;
  plainView: boolean;
  introComplete: boolean;
  isRepeatVisit: boolean;
  soundMuted: boolean;
  scrollMetricsRef: MutableRefObject<ScrollMetrics>;
  onIntroComplete: () => void;
  onIntroMountDiagnostic: (mounts: number) => void;
  onScrollToTop: () => void;
  onDebugStatsChange: (stats: SceneDebugStats) => void;
}) {
  const [homeSection] = SITE_CONFIG.sections;
  const [sceneReadyAfterPaint, setSceneReadyAfterPaint] = useState<boolean>(false);

  useEffect(() => {
    document.title = SITE_CONFIG.identity.defaultDocumentTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        SITE_CONFIG.identity.defaultMetaDescription,
      );
    }
  }, []);

  // Defer mounting the lazy-loaded Three.js scene until after the browser's first paint
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setSceneReadyAfterPaint(true);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const rightStatusText = plainView
    ? 'canvas off'
    : isRenderableText(SITE_CONFIG.hero.latticeStatusText)
      ? SITE_CONFIG.hero.latticeStatusText
      : '';

  return (
    <>
      {/* 1. Terminal Intro Sequence (only on `/` when not completed and not in Plain view) */}
      {!introComplete && !plainView && (
        <TerminalIntro
          isRepeatVisit={isRepeatVisit}
          soundMuted={soundMuted}
          onComplete={onIntroComplete}
          onMountDiagnostic={onIntroMountDiagnostic}
        />
      )}

      {/* 2. Three.js 3D Scene (lazy-loaded after first paint; unmounted completely when Plain view is active) */}
      {!plainView && sceneReadyAfterPaint && (
        <Suspense fallback={null}>
          <LazyDeltaScene
            reducedMotion={reducedMotion}
            scrollMetricsRef={scrollMetricsRef}
            onDebugStatsChange={onDebugStatsChange}
          />
        </Suspense>
      )}

      {/* 3. Native-Scrolled Sections (HTML hero text is in the DOM immediately on first paint) */}
      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        {/* Section 1: Home (Existing Hero) */}
        <section
          id={homeSection.id}
          aria-label={homeSection.navLabel}
          className="flex min-h-[100svh] w-full flex-col justify-between px-4 pt-20 pb-10 sm:px-10 md:px-20"
        >
          <div className="mt-4 mb-auto md:my-auto w-full max-w-7xl mx-auto">
            {/* Solid/near-solid dark layer constrained to left column on >=768px so the Δ lattice never overlaps */}
            <div className="max-w-sm md:max-w-[44%] lg:max-w-xl bg-[#0B0D10]/94 pr-4 sm:pr-6 py-3">
              <p className="mb-2 font-data-mono text-xs tracking-widest text-[#9A968E]">
                {homeSection.kicker}
              </p>
              <p
                data-testid="hero-role-label"
                className="mb-3 font-data-mono text-xs tracking-widest text-[#4FD1D9]"
              >
                {SITE_CONFIG.identity.mark} {SITE_CONFIG.hero.roleLabel}
              </p>

              <h1
                data-testid="hero-main-title"
                className={`font-display-serif text-[clamp(2.65rem,6.5vw,6.2rem)] font-normal leading-[0.94] tracking-tight text-[#E8E4DA] transition-opacity duration-500 ${
                  introComplete || plainView ? 'opacity-100' : 'opacity-95'
                }`}
              >
                {SITE_CONFIG.identity.owner}
              </h1>
            </div>
          </div>

          <div className="w-full max-w-7xl mx-auto flex items-center justify-between border-t border-[#262C36]/70 pt-4 font-data-mono text-xs text-[#9A968E] bg-[#0B0D10]/90">
            <span>
              {plainView
                ? SITE_CONFIG.hero.plainViewPromptText
                : SITE_CONFIG.hero.scrollPromptText}
            </span>
            {rightStatusText && (
              <span data-testid="hero-right-status">{rightStatusText}</span>
            )}
          </div>
        </section>

        {/* Sections 2–6: Background, Skills, Projects / CTFs, Writeups, Connect */}
        <PortfolioSections
          reducedMotion={reducedMotion}
          plainView={plainView}
          onScrollToTop={onScrollToTop}
        />
      </main>
    </>
  );
}

/**
 * Inner routed shell sharing the persistent top Navbar, Lenis smooth scroll loop,
 * and single-source-of-truth scroll progress state.
 *
 * DEPLOY PHASE NOTE:
 * The hosting provider must be configured to serve `index.html` for unknown paths
 * (SPA fallback) so direct loads of `/writeups` and `/writeups/:slug` work in production.
 */
function AppShell() {
  const reducedMotion = usePrefersReducedMotion();
  const location = useLocation();
  const currentRoute = resolveRoute(location.pathname);

  // Track how many times the app root renders for the ?debug=1 diagnostics overlay
  const rootRenderCountRef = useRef<number>(0);
  rootRenderCountRef.current += 1;

  // Detect repeat visit via localStorage (wrapped in try/catch inside hasVisitedBefore)
  const [isRepeatVisit] = useState<boolean>(() => hasVisitedBefore());

  // Plain view state: persisted in localStorage inside try/catch;
  // defaults to true if prefers-reduced-motion is set or navigator.connection?.saveData is true
  const [plainView, setPlainView] = useState<boolean>(() =>
    getInitialPlainView(
      typeof window !== 'undefined' &&
        Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
      typeof window !== 'undefined' ? window.localStorage : null,
      isSaveDataEnabled(),
    ),
  );

  // Optional synthesised sound mute state: persisted in localStorage inside try/catch
  const [soundMuted, setSoundMuted] = useState<boolean>(() =>
    getInitialSoundMuted(),
  );

  // Skip intro immediately if ?intro=0, ?autostart=1, prefers-reduced-motion, saveData/Plain view,
  // or initial entry is on a /writeups route. Stored in both a ref/module flag and a single state flip.
  const introFinishedRef = useRef<boolean>(isIntroFinishedInSession());
  const [introComplete, setIntroComplete] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const rm = Boolean(
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    );
    const pv = getInitialPlainView(rm, window.localStorage, isSaveDataEnabled());
    const skip = shouldSkipIntroOnLoad({
      pathname: window.location.pathname,
      search: window.location.search,
      prefersReducedMotion: rm,
      plainView: pv,
    });
    if (skip) {
      introFinishedRef.current = true;
      markIntroFinishedInSession();
      return true;
    }
    return false;
  });

  // Direct DOM refs for the ?debug=1 overlay so 0.5s FPS samples never trigger React re-renders
  const appRootRef = useRef<HTMLDivElement | null>(null);

  // Stable callback with empty dependency array — flips intro state at most once per session
  const handleIntroComplete = useCallback(() => {
    if (introFinishedRef.current) return;
    introFinishedRef.current = true;
    markIntroFinishedInSession();
    if (appRootRef.current) {
      appRootRef.current.setAttribute('data-intro-state', 'resolved');
    }
    setIntroComplete(true);
  }, []);

  const [pageProgress, setPageProgress] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<SectionId>('home');

  const lastPageProgressRef = useRef<number>(0);
  const lastActiveSectionRef = useRef<SectionId>('home');

  const lenisActive = !(reducedMotion || plainView);

  // Keep FPS, tier, particle counts, and DPR in refs — NEVER in React state that re-renders AppShell
  const debugStatsRef = useRef<SceneDebugStats>((() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { deviceMemory?: number })
        : undefined;
    const startTier = resolveStartingQualityTier({
      viewportWidth: w,
      hardwareConcurrency: nav?.hardwareConcurrency,
      deviceMemory: nav?.deviceMemory,
    });
    const prof = resolveQualityTierProfile({
      tier: startTier,
      viewportWidth: w,
      devicePixelRatio: dpr,
    });
    return {
      tier: prof.tier,
      fps: 60,
      particleCount: prof.particleCount,
      ambientParticleCount: prof.ambientField ? prof.ambientParticleCount : 0,
      pixelRatio: prof.pixelRatio,
    };
  })());

  // Direct DOM refs for the ?debug=1 overlay so 0.5s FPS samples never trigger React re-renders
  const debugTierSpanRef = useRef<HTMLSpanElement | null>(null);
  const debugFpsSpanRef = useRef<HTMLSpanElement | null>(null);
  const debugParticlesSpanRef = useRef<HTMLSpanElement | null>(null);
  const debugParticlesSubSpanRef = useRef<HTMLSpanElement | null>(null);
  const debugDprSpanRef = useRef<HTMLSpanElement | null>(null);
  const debugLenisSpanRef = useRef<HTMLSpanElement | null>(null);
  const debugIntroMountsSpanRef = useRef<HTMLSpanElement | null>(null);
  const debugRootRendersSpanRef = useRef<HTMLSpanElement | null>(null);

  const plainViewRef = useRef<boolean>(plainView);
  plainViewRef.current = plainView;

  const syncDebugHudDom = useCallback(() => {
    const stats = debugStatsRef.current;
    const isPlain = plainViewRef.current;
    const tierLabel = isPlain ? 'plain' : stats.tier;
    const totalParticles = isPlain
      ? 0
      : stats.particleCount + stats.ambientParticleCount;

    if (appRootRef.current) {
      appRootRef.current.setAttribute('data-quality-tier', tierLabel);
    }
    if (debugTierSpanRef.current) {
      debugTierSpanRef.current.textContent = tierLabel;
    }
    if (debugFpsSpanRef.current) {
      debugFpsSpanRef.current.textContent = String(isPlain ? 0 : stats.fps);
    }
    if (debugParticlesSpanRef.current) {
      debugParticlesSpanRef.current.textContent = String(totalParticles);
    }
    if (debugParticlesSubSpanRef.current) {
      debugParticlesSubSpanRef.current.textContent = isPlain
        ? ''
        : ` (${stats.particleCount}+${stats.ambientParticleCount})`;
    }
    if (debugDprSpanRef.current) {
      debugDprSpanRef.current.textContent = String(
        isPlain ? 1 : stats.pixelRatio,
      );
    }
    if (debugIntroMountsSpanRef.current) {
      debugIntroMountsSpanRef.current.textContent = String(getIntroMountCount());
    }
    if (debugRootRendersSpanRef.current) {
      debugRootRendersSpanRef.current.textContent = String(
        rootRenderCountRef.current,
      );
    }
  }, []);

  const handleDebugStatsChange = useCallback(
    (stats: SceneDebugStats) => {
      debugStatsRef.current = stats;
      syncDebugHudDom();
    },
    [syncDebugHudDom],
  );

  const handleIntroMountDiagnostic = useCallback(
    (mounts: number) => {
      if (debugIntroMountsSpanRef.current) {
        debugIntroMountsSpanRef.current.textContent = String(mounts);
      }
    },
    [],
  );

  const isDebugOverlayEnabled =
    new URLSearchParams(location.search).get('debug') === '1';

  const lenisRef = useRef<Lenis | null>(null);
  const scrollMetricsRef = useRef<ScrollMetrics>(
    computeScrollMetrics({
      scrollY: 0,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
      documentScrollHeight: 4800,
    }),
  );

  // Single source of truth updater for both the 3D scene and the "depth %" HUD.
  // Only updates React state when the rounded percentage or activeSection actually changes.
  const applyScrollPosition = useCallback(
    (scrollPx: number) => {
      if (typeof window === 'undefined') return;
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight * 2,
      );
      const metrics = computeScrollMetrics({
        scrollY: scrollPx,
        viewportHeight: window.innerHeight,
        documentScrollHeight: docHeight,
      });

      scrollMetricsRef.current = metrics;
      const nextRoundedProgress = Math.round(metrics.pageProgress * 100) / 100;
      if (nextRoundedProgress !== lastPageProgressRef.current) {
        lastPageProgressRef.current = nextRoundedProgress;
        setPageProgress(nextRoundedProgress);
      }

      if (currentRoute.kind !== 'portfolio') {
        if (lastActiveSectionRef.current !== 'writeups') {
          lastActiveSectionRef.current = 'writeups';
          setActiveSection('writeups');
        }
        return;
      }

      // Fix 3: Switch active-section highlight in the nav when a section's heading
      // is about 40% down the viewport (window.innerHeight * 0.40)
      const headingThresholdY =
        window.innerHeight * SITE_CONFIG.performance.activeSectionHeadingViewportRatio;
      let currentId: SectionId = 'home';

      for (const sec of SITE_CONFIG.sections) {
        const secEl = document.getElementById(sec.id);
        if (!secEl) continue;
        const headingEl =
          (secEl.querySelector('h1, h2') as HTMLElement | null) ?? secEl;
        const rect = headingEl.getBoundingClientRect();
        if (rect.top <= headingThresholdY) {
          currentId = sec.id;
        }
      }

      if (currentId !== lastActiveSectionRef.current) {
        lastActiveSectionRef.current = currentId;
        setActiveSection(currentId);
      }
    },
    [currentRoute.kind],
  );

  // Initialise Lenis once at the app root when neither reducedMotion nor Plain view is active.
  // Destroy the instance when switching to Plain view (or reducedMotion) and recreate when switching back.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const disableLenis = reducedMotion || plainView;
    if (disableLenis) {
      lenisRef.current = null;

      const onNativeScroll = () => {
        applyScrollPosition(
          document.documentElement.scrollTop || document.body.scrollTop || 0,
        );
      };
      onNativeScroll();
      window.addEventListener('scroll', onNativeScroll, { passive: true });
      window.addEventListener('resize', onNativeScroll);
      return () => {
        window.removeEventListener('scroll', onNativeScroll);
        window.removeEventListener('resize', onNativeScroll);
      };
    }

    const lenis = new Lenis({
      duration: SITE_CONFIG.lenis.duration,
      easing: SITE_CONFIG.lenis.easing,
      smoothWheel: SITE_CONFIG.lenis.smoothWheel,
      syncTouch: SITE_CONFIG.lenis.syncTouch,
      autoRaf: false,
    });
    lenisRef.current = lenis;

    // Expose scroll metrics strictly from Lenis's scroll event
    lenis.on('scroll', (instance: Lenis) => {
      applyScrollPosition(instance.scroll);
    });

    // Sync initial position
    applyScrollPosition(lenis.scroll);

    let isTabHidden = document.hidden;
    let rafId = 0;

    const raf = (time: number) => {
      if (isTabHidden) return;
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };

    const onVisibilityChange = () => {
      isTabHidden = document.hidden;
      if (isTabHidden) {
        window.cancelAnimationFrame(rafId);
      } else {
        lenis.stop();
        lenis.start();
        rafId = window.requestAnimationFrame(raf);
      }
    };

    let resizeTimerId = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimerId);
      resizeTimerId = window.setTimeout(() => {
        lenis.resize();
        applyScrollPosition(lenis.scroll);
      }, SITE_CONFIG.performance.resizeDebounceMs);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onResize);
    rafId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(resizeTimerId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      lenis.destroy();
      if (lenisRef.current === lenis) {
        lenisRef.current = null;
      }
    };
  }, [reducedMotion, plainView, applyScrollPosition]);

  /**
   * Unified scroll helper using `lenis.scrollTo` with fixed top bar offset.
   * Falls back to direct DOM scrollTop assignment only when Lenis is disabled
   * (Plain view or prefers-reduced-motion).
   */
  const scrollToTarget = useCallback(
    (
      target: number | string | HTMLElement,
      options?: { immediate?: boolean; offset?: number },
    ) => {
      const offset =
        options?.offset ??
        (target === 0 ? 0 : SITE_CONFIG.lenis.headerOffsetPx);
      const immediate = Boolean(options?.immediate);

      const lenis = lenisRef.current;
      if (lenis) {
        lenis.scrollTo(target, { offset, immediate });
        if (immediate && typeof target === 'number') {
          applyScrollPosition(target);
        }
        return;
      }

      // Native fallback when Lenis is not initialised (Plain view or reducedMotion)
      if (typeof document === 'undefined') return;
      let targetTop = 0;
      if (typeof target === 'number') {
        targetTop = target;
      } else {
        const el =
          typeof target === 'string'
            ? (document.querySelector(target) as HTMLElement | null)
            : target;
        if (el) {
          const currentTop =
            document.documentElement.scrollTop || document.body.scrollTop || 0;
          targetTop = Math.max(
            0,
            el.getBoundingClientRect().top + currentTop + offset,
          );
        }
      }
      document.documentElement.scrollTop = targetTop;
      document.body.scrollTop = targetTop;
      applyScrollPosition(targetTop);
    },
    [applyScrollPosition],
  );

  // On route changes (/, /writeups, /writeups/:slug), scroll to top immediately with lenis.scrollTo(0, { immediate: true })
  // or scroll to the requested section hash on `/`
  useEffect(() => {
    if (currentRoute.kind === 'portfolio' && location.hash) {
      const targetSelector = location.hash;
      const timer = window.setTimeout(() => {
        scrollToTarget(targetSelector, {
          offset: SITE_CONFIG.lenis.headerOffsetPx,
        });
      }, 20);
      return () => window.clearTimeout(timer);
    }

    scrollToTarget(0, { immediate: true, offset: 0 });
  }, [location.pathname, location.hash, currentRoute.kind, scrollToTarget]);

  // If user navigates to a write-up page or has ?intro=0, mark intro as complete so returning to `/` is seamless
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (
      (currentRoute.kind !== 'portfolio' || params.get('intro') === '0') &&
      !introComplete
    ) {
      handleIntroComplete();
    }
  }, [currentRoute.kind, location.search, introComplete, handleIntroComplete]);

  // If prefers-reduced-motion becomes true dynamically, skip intro and enable Plain view
  useEffect(() => {
    if (reducedMotion) {
      if (!introComplete) {
        handleIntroComplete();
      }
      setPlainView(true);
    }
  }, [reducedMotion, introComplete, handleIntroComplete]);

  // Keep debug HUD DOM synced whenever plainView or route changes
  useEffect(() => {
    syncDebugHudDom();
  }, [plainView, isDebugOverlayEnabled, syncDebugHudDom]);

  const handleTogglePlainView = useCallback(() => {
    setPlainView((prev) => {
      const next = !prev;
      savePlainViewPreference(next);
      return next;
    });
  }, []);

  const handleToggleSoundMuted = useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev;
      saveSoundMutedPreference(next);
      return next;
    });
  }, []);

  const handleSelectSection = useCallback(
    (id: SectionId) => {
      if (id === 'home') {
        scrollToTarget(0, { offset: 0 });
      } else {
        scrollToTarget(`#${id}`, {
          offset: SITE_CONFIG.lenis.headerOffsetPx,
        });
      }
      lastActiveSectionRef.current = id;
      setActiveSection(id);
    },
    [scrollToTarget],
  );

  const handleScrollToTop = useCallback(() => {
    scrollToTarget(0, { offset: 0 });
    lastActiveSectionRef.current = 'home';
    setActiveSection('home');
  }, [scrollToTarget]);

  const initialStats = debugStatsRef.current;
  const currentTierLabel = plainView ? 'plain' : initialStats.tier;
  const currentParticleTotal = plainView
    ? 0
    : initialStats.particleCount + initialStats.ambientParticleCount;

  return (
    <div
      ref={appRootRef}
      data-intro-state={introComplete ? 'resolved' : 'intro'}
      data-plain-view={plainView ? 'true' : 'false'}
      data-lenis-active={lenisActive ? 'true' : 'false'}
      data-quality-tier={currentTierLabel}
      data-active-section={activeSection}
      data-scroll-progress={pageProgress.toFixed(2)}
      data-route-kind={currentRoute.kind}
      className="relative min-h-[100svh] bg-[#0B0D10] text-[#E8E4DA]"
    >
      {/* Accessible Skip to content link at the top of the page */}
      <a
        href="#main-content"
        data-testid="skip-to-content"
        onClick={(e) => {
          e.preventDefault();
          const mainEl = document.getElementById('main-content');
          if (mainEl) {
            mainEl.focus({ preventScroll: true });
            scrollToTarget(mainEl, { offset: SITE_CONFIG.lenis.headerOffsetPx });
          }
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:border focus:border-[#4FD1D9] focus:bg-[#0B0D10] focus:px-3 focus:py-1.5 focus:font-data-mono focus:text-xs focus:text-[#4FD1D9]"
      >
        Skip to content
      </a>

      {/* Persistent Slim Top Navigation Bar across both `/` and `/writeups*` */}
      <Navbar
        activeSection={activeSection}
        pageProgress={pageProgress}
        plainView={plainView}
        onTogglePlainView={handleTogglePlainView}
        soundMuted={soundMuted}
        onToggleSoundMuted={handleToggleSoundMuted}
        onSelectSection={handleSelectSection}
      />

      {/* Optional ?debug=1 overlay (updated via DOM refs, never triggers React state re-renders) */}
      {isDebugOverlayEnabled && (
        <aside
          data-testid="debug-hud"
          aria-label="Debug performance overlay"
          className="fixed bottom-3 right-3 z-50 border border-[#262C36] bg-[#0B0D10]/95 px-3 py-2 font-data-mono text-[11px] leading-snug text-[#E8E4DA] pointer-events-none"
        >
          <div>
            tier:{' '}
            <span ref={debugTierSpanRef} className="text-[#4FD1D9]">
              {currentTierLabel}
            </span>
          </div>
          <div>
            fps:{' '}
            <span ref={debugFpsSpanRef} className="text-[#E8E4DA]">
              {plainView ? 0 : initialStats.fps}
            </span>
          </div>
          <div>
            particles:{' '}
            <span ref={debugParticlesSpanRef} className="text-[#E8E4DA]">
              {currentParticleTotal}
            </span>
            <span ref={debugParticlesSubSpanRef} className="text-[#9A968E]">
              {!plainView
                ? ` (${initialStats.particleCount}+${initialStats.ambientParticleCount})`
                : ''}
            </span>
          </div>
          <div>
            pixel ratio:{' '}
            <span ref={debugDprSpanRef} className="text-[#E8E4DA]">
              {plainView ? 1 : initialStats.pixelRatio}
            </span>
          </div>
          <div>
            lenis:{' '}
            <span ref={debugLenisSpanRef} className="text-[#4FD1D9]">
              {lenisActive ? 'on' : 'off'}
            </span>
          </div>
          <div>
            intro mounts:{' '}
            <span
              ref={debugIntroMountsSpanRef}
              data-testid="debug-intro-mounts"
              className="text-[#4FD1D9]"
            >
              {getIntroMountCount()}
            </span>
          </div>
          <div>
            root renders:{' '}
            <span
              ref={debugRootRendersSpanRef}
              data-testid="debug-root-renders"
              className="text-[#E8E4DA]"
            >
              {rootRenderCountRef.current}
            </span>
          </div>
        </aside>
      )}

      {/* Client-side Routes */}
      <Routes>
        <Route
          path="/"
          element={
            <HomeView
              reducedMotion={reducedMotion}
              plainView={plainView}
              introComplete={introComplete}
              isRepeatVisit={isRepeatVisit}
              soundMuted={soundMuted}
              scrollMetricsRef={scrollMetricsRef}
              onIntroComplete={handleIntroComplete}
              onIntroMountDiagnostic={handleIntroMountDiagnostic}
              onScrollToTop={handleScrollToTop}
              onDebugStatsChange={handleDebugStatsChange}
            />
          }
        />
        <Route
          path={SITE_CONFIG.routing.writeupsBasePath}
          element={
            <Suspense
              fallback={
                <div className="min-h-[100svh] bg-[#0B0D10] pt-24 px-6 font-data-mono text-xs text-[#9A968E]" />
              }
            >
              <LazyWriteupsIndexPage plainView={plainView} />
            </Suspense>
          }
        />
        <Route
          path={`${SITE_CONFIG.routing.writeupsBasePath}/:slug`}
          element={
            <Suspense
              fallback={
                <div className="min-h-[100svh] bg-[#0B0D10] pt-24 px-6 font-data-mono text-xs text-[#9A968E]" />
              }
            >
              <LazyWriteupDetailPage
                plainView={plainView}
                onScrollToTarget={(selector) =>
                  scrollToTarget(selector, {
                    offset: SITE_CONFIG.lenis.headerOffsetPx,
                  })
                }
              />
            </Suspense>
          }
        />
      </Routes>
    </div>
  );
}

export default function App() {
  // DEPLOY PHASE NOTE: Hosting provider must serve `index.html` for unknown paths (SPA fallback).
  return (
    <BrowserRouter basename={SITE_CONFIG.routing.basePath}>
      <AppShell />
    </BrowserRouter>
  );
}
