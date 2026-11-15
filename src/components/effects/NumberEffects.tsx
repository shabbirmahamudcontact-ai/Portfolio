import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

/* -------------------------------------------------------------------------- */
/* 1. AnimatedCounter: Eased count-up when scrolled into view                 */
/* -------------------------------------------------------------------------- */
interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  suffix = '',
  durationMs = 1350,
  className = '',
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(prefersReducedMotion ? value : 0);

  const isDecimal = !Number.isInteger(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }
    if (!inView) return;

    let rafId = 0;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = value * eased;
      setDisplayValue(isDecimal ? Number(current.toFixed(1)) : Math.round(current));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [inView, value, durationMs, prefersReducedMotion, isDecimal]);

  return (
    <span ref={ref} className={`tabular-nums inline-flex items-baseline ${className}`}>
      <span>{isDecimal ? displayValue.toFixed(1) : displayValue}</span>
      {suffix && <span className="text-[#C6A24B] ml-0.5">{suffix}</span>}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. OdometerNumber: Rolling digit reels with fixed tabular-nums column      */
/* -------------------------------------------------------------------------- */
interface OdometerDigitProps {
  digit: string;
  active: boolean;
  delayIndex: number;
  reducedMotion: boolean;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function OdometerDigit({ digit, active, delayIndex, reducedMotion }: OdometerDigitProps) {
  const numeric = Number(digit);
  if (Number.isNaN(numeric)) {
    return <span className="inline-block">{digit}</span>;
  }

  return (
    <span
      className="inline-block overflow-hidden h-[1.12em] leading-[1.12em] align-top tabular-nums"
      style={{ width: '0.62em' }}
      aria-hidden="true"
    >
      <motion.span
        initial={reducedMotion ? false : { y: '0%' }}
        animate={{ y: active || reducedMotion ? `${-numeric * 10}%` : '0%' }}
        transition={{
          duration: reducedMotion ? 0 : 1.05 + delayIndex * 0.12,
          delay: reducedMotion ? 0 : delayIndex * 0.06,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="flex flex-col items-center will-change-transform"
      >
        {DIGITS.map((d) => (
          <span key={d} className="h-[1.12em] leading-[1.12em] block text-center">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

interface OdometerNumberProps {
  value: number;
  suffix?: string;
  className?: string;
}

export function OdometerNumber({ value, suffix = '', className = '' }: OdometerNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const prefersReducedMotion = Boolean(useReducedMotion());
  const chars = String(value).split('');

  return (
    <span
      ref={ref}
      aria-label={`${value}${suffix}`}
      className={`tabular-nums inline-flex items-baseline ${className}`}
    >
      <span className="sr-only">
        {value}
        {suffix}
      </span>
      {chars.map((ch, idx) => (
        <OdometerDigit
          key={`${idx}-${ch}`}
          digit={ch}
          active={inView}
          delayIndex={idx}
          reducedMotion={prefersReducedMotion}
        />
      ))}
      {suffix && <span className="text-[#C6A24B] ml-0.5">{suffix}</span>}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. ProgressRing: Self-drawing SVG circular progress indicator              */
/* -------------------------------------------------------------------------- */
interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
}

export function ProgressRing({
  percentage,
  size = 64,
  strokeWidth = 4,
  accentColor = '#C6A24B',
}: ProgressRingProps) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const prefersReducedMotion = useReducedMotion();

  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E0DDD5"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={prefersReducedMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: inView || prefersReducedMotion ? targetOffset : circumference }}
          transition={{ duration: prefersReducedMotion ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute text-xs font-bold font-mono-tabular text-[#181A18]">
        {clamped}%
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. ProgressBar: Self-drawing linear progress bar                           */
/* -------------------------------------------------------------------------- */
interface ProgressBarProps {
  percentage: number;
  className?: string;
}

export function ProgressBar({ percentage, className = '' }: ProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const prefersReducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percentage));

  return (
    <div
      ref={ref}
      className={`h-1.5 w-full rounded-full bg-[#EFECE6] overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: inView || prefersReducedMotion ? clamped / 100 : 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 1.0, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: 'left center' }}
        className="h-full w-full rounded-full bg-gradient-to-r from-[#1B5E4A] to-[#C6A24B]"
      />
    </div>
  );
}
