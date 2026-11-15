import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SITE_CONFIG, type SectionId } from './config';

interface NavbarProps {
  activeSection: SectionId;
  pageProgress: number;
  plainView: boolean;
  onTogglePlainView: () => void;
  soundMuted?: boolean;
  onToggleSoundMuted?: () => void;
  onSelectSection: (id: SectionId) => void;
}

/**
 * Persistent slim top navigation bar.
 * - Left: "Δ vaibhav.marathe" + whole-page "depth %" HUD
 * - Centre (desktop >= 768px) / collapsible menu (< 768px mobile): section links with active section highlight
 * - Right (always reachable from 360px mobile to desktop): Resume, GitHub, LinkedIn, optional Sound toggle, and Plain view toggle
 * - Enforces >= 44px tap targets on mobile and desktop while fitting cleanly at 360px, 375px, 390px, 414px, 768px, 990px, and 1280px.
 */
export function Navbar({
  activeSection,
  pageProgress,
  plainView,
  onTogglePlainView,
  soundMuted = true,
  onToggleSoundMuted,
  onSelectSection,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isOnWriteupRoute = location.pathname.startsWith(
    SITE_CONFIG.routing.writeupsBasePath,
  );

  const handleSectionNavigation = (id: SectionId) => {
    setMobileMenuOpen(false);
    if (isOnWriteupRoute) {
      if (id === 'writeups') {
        navigate(SITE_CONFIG.routing.writeupsBasePath);
        return;
      }
      if (id === 'home') {
        navigate('/');
        return;
      }
      navigate(`/#${id}`);
      return;
    }
    onSelectSection(id);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-[#262C36]/90 bg-[#0B0D10]/95 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] font-data-mono text-xs text-[#E8E4DA]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-1.5 gap-y-1 px-2 py-0.5 sm:px-4 md:px-5 lg:px-8">
        {/* Left: Brand mark + whole-page depth % HUD */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <a
            href={isOnWriteupRoute ? '/' : '#home'}
            onClick={(e) => {
              e.preventDefault();
              handleSectionNavigation('home');
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[#E8E4DA] transition-colors hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] whitespace-nowrap"
          >
            <span className="text-[#4FD1D9]" aria-hidden="true">
              {SITE_CONFIG.identity.mark}
            </span>
            <span className="hidden sm:inline md:text-[11px] lg:text-xs tracking-wider">
              {SITE_CONFIG.identity.handle}
            </span>
          </a>

          <span
            aria-label="Page scroll depth"
            className="text-[11px] text-[#9A968E] whitespace-nowrap"
          >
            depth {Math.round(pageProgress * 100)}%
          </span>
        </div>

        {/* Centre: Desktop section navigation links (visible >= 768px, hidden < 768px) */}
        <nav
          aria-label="Portfolio sections"
          className="hidden md:flex flex-wrap items-center gap-x-2.5 gap-y-1 lg:gap-x-4 xl:gap-x-5 text-[11px] lg:text-xs"
        >
          {SITE_CONFIG.sections.map((sec) => {
            const isActive = isOnWriteupRoute
              ? sec.id === 'writeups'
              : activeSection === sec.id;

            // On write-up pages, "Writeups" links directly to /writeups
            if (isOnWriteupRoute && sec.id === 'writeups') {
              return (
                <Link
                  key={sec.id}
                  to={SITE_CONFIG.routing.writeupsBasePath}
                  aria-current="page"
                  onClick={() => setMobileMenuOpen(false)}
                  className="relative inline-flex min-h-[44px] items-center px-0.5 font-medium text-[#4FD1D9] transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                >
                  {sec.navLabel}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1.5 left-0 right-0 h-[1.5px] bg-[#4FD1D9]"
                  />
                </Link>
              );
            }

            const targetHref = isOnWriteupRoute
              ? sec.id === 'home'
                ? '/'
                : `/#${sec.id}`
              : `#${sec.id}`;

            return (
              <a
                key={sec.id}
                href={targetHref}
                aria-current={isActive ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  handleSectionNavigation(sec.id);
                }}
                className={`relative inline-flex min-h-[44px] items-center px-0.5 transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] ${
                  isActive
                    ? 'text-[#4FD1D9] font-medium'
                    : 'text-[#9A968E] hover:text-[#E8E4DA]'
                }`}
              >
                {sec.navLabel}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1.5 left-0 right-0 h-[1.5px] bg-[#4FD1D9]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right: External links + Plain view toggle + Mobile section menu button (< 768px only) */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 lg:gap-2 shrink-0">
          <a
            href={SITE_CONFIG.externalLinks.resume}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center px-1 text-[11px] lg:text-xs text-[#E8E4DA] transition-colors hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] whitespace-nowrap"
          >
            Resume
          </a>
          <a
            href={SITE_CONFIG.externalLinks.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center px-1 text-[11px] lg:text-xs text-[#E8E4DA] transition-colors hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] whitespace-nowrap"
          >
            GitHub
          </a>
          <a
            href={SITE_CONFIG.externalLinks.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center px-1 text-[11px] lg:text-xs text-[#E8E4DA] transition-colors hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] whitespace-nowrap"
          >
            LinkedIn
          </a>

          {SITE_CONFIG.sound.SOUND_ENABLED && onToggleSoundMuted && (
            <button
              type="button"
              data-testid="sound-toggle-button"
              aria-pressed={!soundMuted}
              onClick={onToggleSoundMuted}
              className={`cursor-pointer inline-flex min-h-[44px] items-center rounded border px-1.5 text-[11px] sm:px-2 lg:text-xs transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] ${
                !soundMuted
                  ? 'border-[#4FD1D9] bg-[#4FD1D9]/15 text-[#4FD1D9]'
                  : 'border-[#262C36] bg-[#0B0D10] text-[#9A968E] hover:border-[#4FD1D9] hover:text-[#E8E4DA]'
              }`}
            >
              {soundMuted ? 'Sound off' : 'Sound on'}
            </button>
          )}

          <button
            type="button"
            aria-pressed={plainView}
            onClick={onTogglePlainView}
            className={`cursor-pointer inline-flex min-h-[44px] items-center rounded border px-1.5 text-[11px] sm:px-2 lg:text-xs transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] ${
              plainView
                ? 'border-[#4FD1D9] bg-[#4FD1D9]/15 text-[#4FD1D9]'
                : 'border-[#262C36] bg-[#0B0D10] text-[#9A968E] hover:border-[#4FD1D9] hover:text-[#E8E4DA]'
            }`}
          >
            Plain view
          </button>

          {/* Mobile section menu toggle (only visible below 768px) */}
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-sections-menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden cursor-pointer inline-flex min-h-[44px] items-center rounded border border-[#262C36] bg-[#0B0D10] px-1.5 text-[11px] sm:px-2 sm:text-xs text-[#E8E4DA] transition-colors hover:border-[#4FD1D9] hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] whitespace-nowrap"
          >
            {mobileMenuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>

      {/* Collapsible mobile section links drawer (< 768px only) */}
      {mobileMenuOpen && (
        <nav
          id="mobile-sections-menu"
          data-lenis-prevent
          aria-label="Mobile sections navigation"
          className="md:hidden max-h-[75svh] overflow-y-auto border-t border-[#262C36] bg-[#0B0D10] px-4 py-3"
        >
          <ul className="flex flex-col gap-1">
            {SITE_CONFIG.sections.map((sec) => {
              const isActive = isOnWriteupRoute
                ? sec.id === 'writeups'
                : activeSection === sec.id;

              if (isOnWriteupRoute && sec.id === 'writeups') {
                return (
                  <li key={sec.id}>
                    <Link
                      to={SITE_CONFIG.routing.writeupsBasePath}
                      aria-current="page"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex min-h-[44px] items-center justify-between rounded px-2.5 py-2 text-xs font-medium text-[#4FD1D9] bg-[#4FD1D9]/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9]"
                    >
                      <span>{sec.navLabel}</span>
                      <span className="text-[11px] text-[#9A968E]">{sec.kicker}</span>
                    </Link>
                  </li>
                );
              }

              const targetHref = isOnWriteupRoute
                ? sec.id === 'home'
                  ? '/'
                  : `/#${sec.id}`
                : `#${sec.id}`;

              return (
                <li key={sec.id}>
                  <a
                    href={targetHref}
                    aria-current={isActive ? 'location' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSectionNavigation(sec.id);
                    }}
                    className={`flex min-h-[44px] items-center justify-between rounded px-2.5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] ${
                      isActive
                        ? 'text-[#4FD1D9] font-medium bg-[#4FD1D9]/10'
                        : 'text-[#E8E4DA] hover:text-[#4FD1D9]'
                    }`}
                  >
                    <span>{sec.navLabel}</span>
                    <span className="text-[11px] text-[#9A968E]">{sec.kicker}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
