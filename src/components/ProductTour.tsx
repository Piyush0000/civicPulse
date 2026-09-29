"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, SkipForward, EyeOff } from "lucide-react";

/* ── Tour step definition ─────────────────────────────────────────── */

export type TourStep = {
  /** CSS selector for the element to spotlight */
  target: string;
  /** Coach-mark title */
  title: string;
  /** Coach-mark description (supports line breaks) */
  description: string;
  /** Preferred tooltip placement relative to target */
  placement?: "top" | "bottom" | "left" | "right";
  /** Optional: a callback fired when this step becomes active */
  onEnter?: () => void;
};

const LS_KEY = "civicpulse_tour_dismissed_v2";

/* ── Main component ───────────────────────────────────────────────── */

export default function ProductTour({ steps, tourId = "main" }: { steps: TourStep[]; tourId?: string }) {
  const key = `${LS_KEY}_${tourId}`;
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [tooltipPlacement, setTooltipPlacement] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const [transitioning, setTransitioning] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  // Check localStorage on mount and listen to manual triggers
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStart = () => {
      setStep(0);
      setActive(true);
    };
    window.addEventListener("start-tour", onStart);

    if (!localStorage.getItem(key)) {
      // Small delay so the page has time to render its elements
      const t = setTimeout(() => setActive(true), 1200);
      return () => {
        clearTimeout(t);
        window.removeEventListener("start-tour", onStart);
      };
    }

    return () => window.removeEventListener("start-tour", onStart);
  }, [key]);

  // Measure target element and position tooltip
  const measure = useCallback(() => {
    if (!active || step >= steps.length) return;
    const s = steps[step];
    const el = document.querySelector(s.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    
    // Skip if element is not visible (e.g., mobile nav drawer is closed)
    if (r.width === 0 && r.height === 0) {
      if (step < steps.length - 1) {
        setStep((prev) => prev + 1);
      } else {
        setActive(false);
      }
      return;
    }
    
    setRect(r);

    // Scroll element into view if needed
    const inView = r.top >= 0 && r.bottom <= window.innerHeight;
    if (!inView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Re-measure after scroll
      requestAnimationFrame(() => {
        const r2 = el.getBoundingClientRect();
        setRect(r2);
      });
    }
  }, [active, step, steps]);

  // Determine placement and compute tooltip position after rect changes
  useLayoutEffect(() => {
    if (!rect || !tooltipRef.current) return;
    const tt = tooltipRef.current;
    const ttRect = tt.getBoundingClientRect();
    const pad = 16;
    const gap = 12;
    const preferred = steps[step]?.placement || "bottom";

    // Try placements in order of preference
    const placements: Array<"top" | "bottom" | "left" | "right"> = [preferred];
    (["bottom", "right", "top", "left"] as const).forEach((p) => {
      if (!placements.includes(p)) placements.push(p);
    });

    let chosen: "top" | "bottom" | "left" | "right" = preferred;
    let pos = { top: 0, left: 0 };

    for (const p of placements) {
      let t = 0, l = 0;
      if (p === "bottom") {
        t = rect.bottom + gap;
        l = rect.left + rect.width / 2 - ttRect.width / 2;
      } else if (p === "top") {
        t = rect.top - gap - ttRect.height;
        l = rect.left + rect.width / 2 - ttRect.width / 2;
      } else if (p === "right") {
        t = rect.top + rect.height / 2 - ttRect.height / 2;
        l = rect.right + gap;
      } else {
        t = rect.top + rect.height / 2 - ttRect.height / 2;
        l = rect.left - gap - ttRect.width;
      }
      // Clamp to viewport
      l = Math.max(pad, Math.min(window.innerWidth - ttRect.width - pad, l));
      t = Math.max(pad, Math.min(window.innerHeight - ttRect.height - pad, t));

      const fits =
        t >= pad &&
        t + ttRect.height <= window.innerHeight - pad &&
        l >= pad &&
        l + ttRect.width <= window.innerWidth - pad;

      pos = { top: t, left: l };
      chosen = p;
      if (fits) break;
    }

    setTooltipPlacement(chosen);
    setTooltipStyle({ top: pos.top, left: pos.left, position: "fixed" });
  }, [rect, step, steps]);

  // Observe layout changes (resize, scroll)
  useEffect(() => {
    if (!active) return;
    rafRef.current = requestAnimationFrame(measure);
    const onLayout = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, measure]);

  // Fire onEnter callback
  useEffect(() => {
    if (active && step < steps.length) steps[step].onEnter?.();
  }, [active, step, steps]);

  const dismiss = useCallback(() => {
    setActive(false);
  }, []);

  const dismissForever = useCallback(() => {
    localStorage.setItem(key, "1");
    setActive(false);
  }, [key]);

  const next = useCallback(() => {
    if (step >= steps.length - 1) {
      localStorage.setItem(key, "1");
      setActive(false);
      return;
    }
    setTransitioning(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setTransitioning(false);
    }, 200);
  }, [step, steps.length, key]);

  const prev = useCallback(() => {
    if (step > 0) {
      setTransitioning(true);
      setTimeout(() => {
        setStep((s) => s - 1);
        setTransitioning(false);
      }, 200);
    }
  }, [step]);

  if (!active || step >= steps.length || typeof window === "undefined") return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  // Arrow indicator based on placement
  const arrowClass = {
    top: "after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-[#111a2b]",
    bottom: "after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-b-[#111a2b]",
    left: "after:absolute after:left-full after:top-1/2 after:-translate-y-1/2 after:border-8 after:border-transparent after:border-l-[#111a2b]",
    right: "after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-8 after:border-transparent after:border-r-[#111a2b]",
  }[tooltipPlacement];

  return createPortal(
    <div className="product-tour" style={{ position: "fixed", inset: 0, zIndex: 99999 }}>
      <svg
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        onClick={dismiss}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx="12"
                fill="black"
                style={{ transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)" }}
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.72)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: "auto", cursor: "default" }}
          onClick={dismiss}
        />
      </svg>

      {/* Spotlight ring around target */}
      {rect && (
        <div
          className="animate-pulse"
          style={{
            position: "fixed",
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 12,
            boxShadow: "0 0 0 2px var(--color-accent), 0 0 24px var(--color-accent)",
            opacity: 0.5,
            pointerEvents: "none",
            transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      )}

      {/* Coach-mark tooltip */}
      <div
        ref={tooltipRef}
        className={arrowClass}
        style={{
          ...tooltipStyle,
          zIndex: 100000,
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "scale(0.95) translateY(4px)" : "scale(1) translateY(0)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
          maxWidth: 360,
          minWidth: 280,
        }}
      >
        <div className="rounded-2xl border border-line-2 bg-panel-2 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_30px_rgba(34,211,238,0.08)]">
          {/* Header */}
          <div className="mb-2 flex items-start justify-between">
            <h3 className="text-base font-semibold leading-tight text-ink">
              {current.title}
            </h3>
            <button
              onClick={dismiss}
              className="-mr-1 -mt-1 p-1 text-faint hover:text-mute transition-colors"
              aria-label="Close tour"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <p className="mb-4 text-[13px] leading-relaxed text-mute">
            {current.description}
          </p>

          {/* Progress bar */}
          <div className="mb-4 flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-sm transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-line"}`}
              />
            ))}
          </div>

          {/* Progress text */}
          <div className="mb-3 text-[11px] font-medium text-faint tabular-nums">
            Step {step + 1} of {steps.length}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="rounded-lg border border-line-2 px-3.5 py-1.5 text-xs font-medium text-mute hover:bg-panel-3 hover:text-ink transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-[#04121a] hover:bg-[#67e8f9] transition-colors shadow-[0_0_15px_rgba(34,211,238,0.2)]"
            >
              {isLast ? "Finish" : "Next"} <ChevronRight size={14} />
            </button>
            <div className="flex-1" />
            {!isLast && (
              <button
                onClick={dismiss}
                title="Skip tour"
                className="flex items-center gap-1 p-1 text-[11px] text-faint hover:text-mute transition-colors"
              >
                <SkipForward size={12} /> Skip
              </button>
            )}
            <button
              onClick={dismissForever}
              title="Don't show again"
              className="flex items-center gap-1 p-1 text-[11px] text-faint hover:text-mute transition-colors"
            >
              <EyeOff size={12} /> Hide
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
