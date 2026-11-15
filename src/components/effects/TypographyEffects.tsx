import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'motion/react';

/* -------------------------------------------------------------------------- */
/* 1. KineticHeroHeadline: Character mask reveal + mouse proximity reaction   */
/* -------------------------------------------------------------------------- */
interface KineticHeroHeadlineProps {
  text: string;
  className?: string;
}

export function KineticHeroHeadline({ text, className = '' }: KineticHeroHeadlineProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const charRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const prefersReducedMotion = useReducedMotion();

  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches) return;

    const el = containerRef.current;
    if (!el) return;

    let rafId = 0;
    let pointerX = -9999;
    let pointerY = -9999;
    let inside = false;

    const updateLetters = () => {
      rafId = 0;
      for (const span of charRefs.current) {
        if (!span) continue;
        if (!inside) {
          span.style.transform = 'translate3d(0px, 0px, 0px)';
          span.style.fontVariationSettings = '';
          span.style.color = '';
          continue;
        }
        const rect = span.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = cx - pointerX;
        const dy = cy - pointerY;
        const dist = Math.hypot(dx, dy);
        const radius = 125;

        if (dist < radius && dist > 0.01) {
          const factor = (1 - dist / radius) ** 1.4;
          const pushX = (dx / dist) * factor * 4.5;
          const pushY = (dy / dist) * factor * 5.5 - factor * 2.5;
          const weight = Math.round(700 + factor * 100);
          span.style.transform = `translate3d(${pushX.toFixed(2)}px, ${pushY.toFixed(2)}px, 0px)`;
          span.style.fontVariationSettings = `"wght" ${weight}`;
          if (factor > 0.48) {
            span.style.color = '#1B5E4A';
          } else {
            span.style.color = '';
          }
        } else {
          span.style.transform = 'translate3d(0px, 0px, 0px)';
          span.style.fontVariationSettings = '';
          span.style.color = '';
        }
      }
    };

    const scheduleUpdate = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateLetters);
      }
    };

    const onMove = (e: MouseEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      inside = true;
      scheduleUpdate();
    };

    const onLeave = () => {
      inside = false;
      scheduleUpdate();
    };

    el.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion, text]);

  let charCounter = 0;
  charRefs.current = [];

  return (
    <h1
      ref={containerRef}
      className={className}
      style={{ textWrap: 'balance' }}
      aria-label={text}
    >
      {words.map((word, wordIdx) => (
        <span key={`${word}-${wordIdx}`} className="inline-block whitespace-nowrap mr-[0.26em] last:mr-0">
          {Array.from(word).map((ch, letterIdx) => {
            const globalIndex = charCounter++;
            return (
              <span key={`${wordIdx}-${letterIdx}`} className="inline-block overflow-hidden align-bottom pb-[0.06em] -mb-[0.06em]">
                <motion.span
                  ref={(node) => {
                    charRefs.current[globalIndex] = node;
                  }}
                  initial={prefersReducedMotion ? false : { y: '110%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.55,
                    delay: prefersReducedMotion ? 0 : Math.min(globalIndex * 0.015, 0.55),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="inline-block transition-[transform,color] duration-150 ease-out will-change-transform"
                >
                  {ch}
                </motion.span>
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. ScrollWordReveal: Scroll-linked paragraph word-by-word reveal           */
/* -------------------------------------------------------------------------- */
interface ScrollWordProps {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
}

function ScrollWord({ word, progress, range }: ScrollWordProps) {
  const opacity = useTransform(progress, range, [0.24, 1]);
  return (
    <span className="inline-block mr-[0.26em] relative">
      <motion.span style={{ opacity }} className="inline-block text-[#181A18]">
        {word}
      </motion.span>
    </span>
  );
}

interface ScrollWordRevealProps {
  text: string;
  className?: string;
}

export function ScrollWordReveal({ text, className = '' }: ScrollWordRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 88%', 'end 52%'],
  });

  const paragraphs = useMemo(
    () =>
      text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    [text]
  );

  const totalWords = useMemo(
    () => paragraphs.reduce((acc, p) => acc + p.split(/\s+/).filter(Boolean).length, 0),
    [paragraphs]
  );

  if (prefersReducedMotion || totalWords === 0) {
    return (
      <div className={className}>
        {paragraphs.map((p, idx) => (
          <p key={idx} className="mb-4 last:mb-0">
            {p}
          </p>
        ))}
      </div>
    );
  }

  let runningIndex = 0;

  return (
    <div ref={containerRef} className={className}>
      {paragraphs.map((paragraph, pIdx) => {
        const words = paragraph.split(/\s+/).filter(Boolean);
        return (
          <p key={pIdx} className="mb-4 last:mb-0">
            {words.map((word, wIdx) => {
              const start = runningIndex / Math.max(totalWords, 1);
              const end = Math.min(1, (runningIndex + 1.2) / Math.max(totalWords, 1));
              runningIndex += 1;
              return (
                <ScrollWord
                  key={`${pIdx}-${wIdx}`}
                  word={word}
                  progress={scrollYProgress}
                  range={[start, end]}
                />
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. ScrollFillOutlineText: Large outlined text that fills on scroll         */
/* -------------------------------------------------------------------------- */
interface ScrollFillOutlineTextProps {
  text: string;
  className?: string;
}

export function ScrollFillOutlineText({ text, className = '' }: ScrollFillOutlineTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 90%', 'center 42%'],
  });

  const clipInset = useTransform(scrollYProgress, [0, 1], ['inset(0 100% 0 0)', 'inset(0 0% 0 0)']);

  return (
    <div ref={ref} className={`relative select-none overflow-hidden ${className}`}>
      <p
        className="outlined-display-text font-display font-extrabold tracking-tight leading-[1.02] text-3xl sm:text-5xl lg:text-6xl uppercase"
        aria-hidden="true"
      >
        {text}
      </p>
      <motion.p
        style={prefersReducedMotion ? undefined : { clipPath: clipInset }}
        className="absolute inset-0 font-display font-extrabold tracking-tight leading-[1.02] text-3xl sm:text-5xl lg:text-6xl uppercase text-[#181A18]"
      >
        {text}
      </motion.p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. VelocityMarquee: Scroll-velocity-reactive horizontal marquee            */
/* -------------------------------------------------------------------------- */
interface VelocityMarqueeProps {
  items: string[];
  baseVelocity?: number;
  className?: string;
}

export function VelocityMarquee({
  items,
  baseVelocity = -1.6,
  className = '',
}: VelocityMarqueeProps) {
  const prefersReducedMotion = useReducedMotion();
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 350,
  });

  const velocityFactor = useTransform(smoothVelocity, [-2500, 0, 2500], [-3.2, 0, 3.2], {
    clamp: true,
  });
  const skewX = useTransform(smoothVelocity, [-2500, 0, 2500], [-4.5, 0, 4.5], {
    clamp: true,
  });

  const directionRef = useRef(1);

  useAnimationFrame((_time, delta) => {
    if (prefersReducedMotion || items.length === 0) return;
    const vf = velocityFactor.get();
    if (vf < -0.1) directionRef.current = -1;
    else if (vf > 0.1) directionRef.current = 1;

    let moveBy = directionRef.current * baseVelocity * (delta / 1000);
    moveBy += directionRef.current * moveBy * Math.abs(vf);

    let next = baseX.get() + moveBy;
    if (next <= -50) next += 50;
    if (next > 0) next -= 50;
    baseX.set(next);
  });

  const xPercent = useTransform(baseX, (v) => `${v}%`);
  const cleanedItems = useMemo(() => items.filter(Boolean), [items]);
  if (cleanedItems.length === 0) return null;

  return (
    <div
      className={`overflow-hidden border-y border-[#E0DDD5] bg-[#FFFFFF] py-4 select-none ${className}`}
      aria-label="Core capabilities and services marquee"
    >
      <motion.div
        style={prefersReducedMotion ? undefined : { x: xPercent, skewX }}
        className="flex w-max items-center will-change-transform"
      >
        {[0, 1].map((dup) => (
          <div key={dup} className="flex items-center shrink-0">
            {cleanedItems.map((item, idx) => (
              <span
                key={`${dup}-${idx}-${item}`}
                className="inline-flex items-center gap-6 px-5 text-xs sm:text-sm font-semibold tracking-wider uppercase text-[#181A18] whitespace-nowrap"
              >
                <span>{item}</span>
                <span className="text-[#C6A24B]" aria-hidden="true">
                  ·
                </span>
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. AnimatedSectionTitle: Line-by-line mask slide + drawing gold underline  */
/* -------------------------------------------------------------------------- */
interface AnimatedSectionTitleProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  className?: string;
}

export function AnimatedSectionTitle({
  eyebrow,
  title,
  subtitle,
  className = '',
}: AnimatedSectionTitleProps) {
  const prefersReducedMotion = useReducedMotion();
  const lines = useMemo(
    () =>
      title
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    [title]
  );

  return (
    <div className={className}>
      {eyebrow && (
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-xs font-semibold tracking-wide text-[#1B5E4A] mb-3"
        >
          {eyebrow}
        </motion.p>
      )}

      <h2
        className="text-3xl sm:text-4xl font-bold tracking-tight text-[#181A18] leading-[1.12]"
        style={{ textWrap: 'balance' }}
      >
        {lines.map((line, idx) => (
          <span key={idx} className="block overflow-hidden pb-[0.06em] -mb-[0.06em]">
            <motion.span
              initial={prefersReducedMotion ? false : { y: '105%', opacity: 0 }}
              whileInView={{ y: '0%', opacity: 1 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.6,
                delay: prefersReducedMotion ? 0 : idx * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="block"
            >
              {line}
            </motion.span>
          </span>
        ))}
      </h2>

      {/* Thin champagne-gold underline drawing in */}
      <motion.div
        initial={prefersReducedMotion ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.7,
          delay: prefersReducedMotion ? 0 : 0.14,
          ease: [0.16, 1, 0.3, 1],
        }}
        style={{ transformOrigin: 'left center' }}
        className="mt-4 h-[1.5px] w-20 bg-[#C6A24B]"
        aria-hidden="true"
      />

      {subtitle && <div className="mt-4">{subtitle}</div>}
    </div>
  );
}
