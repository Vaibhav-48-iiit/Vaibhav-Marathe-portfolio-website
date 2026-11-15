import { useEffect, useState, useCallback, useRef } from 'react';
import { SITE_CONFIG } from './config';
import { TERMINAL_LINES } from './terminalLines';
import { markVisited } from './particleMath';
import { playTerminalKeyClick } from './soundEngine';

interface TerminalIntroProps {
  isRepeatVisit: boolean;
  soundMuted?: boolean;
  onComplete: () => void;
}

/**
 * TerminalIntro
 * Renders a minimal recon-style terminal on a dark screen (#0B0D10),
 * types the lines from `src/terminalLines.ts`, clears the terminal,
 * and resolves into the hero view.
 *
 * - First visit: ~8 seconds total duration
 * - Repeat visit: ~2 seconds total duration
 * - Visible "Skip" button works at any moment
 */
export function TerminalIntro({
  isRepeatVisit,
  soundMuted = true,
  onComplete,
}: TerminalIntroProps) {
  const totalDurationMs = isRepeatVisit
    ? SITE_CONFIG.timings.repeatVisitDurationMs
    : SITE_CONFIG.timings.firstVisitDurationMs;

  const typingBudgetMs = Math.max(600, totalDurationMs - SITE_CONFIG.timings.clearHoldMs);
  const totalChars = TERMINAL_LINES.reduce((acc, line) => acc + line.text.length, 0);

  const [revealedChars, setRevealedChars] = useState<number>(0);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const completedRef = useRef<boolean>(false);
  const lastClickedCharRef = useRef<number>(0);
  const soundMutedRef = useRef<boolean>(soundMuted);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    markVisited();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const startTime = performance.now();
    let rafId = 0;
    let clearTimerId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / typingBudgetMs);
      const nextChars = Math.floor(progress * totalChars);
      if (nextChars > lastClickedCharRef.current) {
        lastClickedCharRef.current = nextChars;
        playTerminalKeyClick(soundMutedRef.current);
      }
      setRevealedChars(nextChars);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setIsClearing(true);
        clearTimerId = window.setTimeout(() => {
          finishIntro();
        }, SITE_CONFIG.timings.clearHoldMs);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(clearTimerId);
    };
  }, [typingBudgetMs, totalChars, finishIntro]);

  // Allow Escape key to skip at any time
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishIntro();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finishIntro]);

  // Slice lines according to current character budget
  let remaining = revealedChars;
  const visibleLines = TERMINAL_LINES.map((line) => {
    if (remaining <= 0) return { ...line, visibleText: '', isActive: false };
    const take = Math.min(line.text.length, remaining);
    remaining -= take;
    const isActive = take > 0 && take < line.text.length;
    return {
      ...line,
      visibleText: line.text.slice(0, take),
      isActive,
    };
  }).filter((line) => line.visibleText.length > 0);

  return (
    <div
      role="region"
      aria-label="Reconnaissance terminal intro"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0B0D10] px-6 py-8 sm:px-12 sm:py-10 font-data-mono text-[#E8E4DA]"
    >
      {/* Top bar: subtle session header and always-visible Skip control */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between border-b border-[#262C36] pb-4">
        <div className="flex items-center gap-3 text-xs tracking-wider text-[#9A968E]">
          <span className="text-[#4FD1D9]">{SITE_CONFIG.identity.mark}</span>
          <span>tty0 · passive-recon</span>
          <span aria-hidden="true">·</span>
          <span>{isRepeatVisit ? 'cached-session (2s)' : 'initial-handshake (8s)'}</span>
        </div>

        <button
          type="button"
          onClick={finishIntro}
          className="cursor-pointer rounded border border-[#262C36] bg-[#0B0D10] px-4 py-2 text-xs font-medium tracking-wider text-[#E8E4DA] transition-colors duration-150 hover:border-[#4FD1D9] hover:text-[#4FD1D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FD1D9] min-h-[40px]"
        >
          Skip
        </button>
      </div>

      {/* Center terminal output viewport */}
      <div className="mx-auto my-auto w-full max-w-3xl">
        <div
          className={`transition-opacity duration-300 ${
            isClearing ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="mb-3 text-xs text-[#9A968E]">
            session: vaibhav@lab-node-01 ~
          </div>

          <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed">
            {visibleLines.map((line) => {
              let textColorClass = 'text-[#E8E4DA]';
              if (line.tone === 'command') {
                textColorClass = 'text-[#4FD1D9]';
              } else if (line.tone === 'warning' || line.tone === 'granted') {
                // Rare second colour (#E8A33D amber) reserved strictly for warnings and access granted
                textColorClass = 'text-[#E8A33D]';
              }

              return (
                <div key={line.id} className={`break-words ${textColorClass}`}>
                  <span>{line.visibleText}</span>
                  {line.isActive && (
                    <span
                      aria-hidden="true"
                      className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-[#4FD1D9]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between text-xs text-[#9A968E] mb-2">
          <span>resolving identity</span>
          <span>
            {Math.min(100, Math.round((revealedChars / Math.max(1, totalChars)) * 100))}%
          </span>
        </div>
        <div className="h-px w-full bg-[#262C36] overflow-hidden">
          <div
            className="h-full bg-[#4FD1D9] transition-transform duration-75 origin-left"
            style={{
              transform: `scaleX(${Math.min(1, revealedChars / Math.max(1, totalChars))})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
