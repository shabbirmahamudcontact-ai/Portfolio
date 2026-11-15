import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export function CustomCursor() {
  const prefersReducedMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');
  const [hoverInteractive, setHoverInteractive] = useState(false);

  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion || typeof window === 'undefined') {
      setEnabled(false);
      return;
    }
    const mq = window.matchMedia('(pointer: fine)');
    const sync = () => setEnabled(mq.matches && window.innerWidth >= 1024);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!enabled) return;

    let targetX = -100;
    let targetY = -100;
    let currentX = -100;
    let currentY = -100;
    let rafId = 0;

    const tick = () => {
      currentX += (targetX - currentX) * 0.22;
      currentY += (targetY - currentY) * 0.22;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0) translate(-50%, -50%)`;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) setVisible(true);

      const target = e.target as HTMLElement | null;
      const labelled = target?.closest('[data-cursor]') as HTMLElement | null;
      if (labelled) {
        const nextLabel = labelled.getAttribute('data-cursor') || '';
        setLabel(nextLabel);
        setHoverInteractive(true);
        return;
      }

      const clickable = target?.closest('a, button');
      setLabel('');
      setHoverInteractive(Boolean(clickable));
    };

    const onMouseLeave = () => {
      setVisible(false);
      setLabel('');
      setHoverInteractive(false);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.cancelAnimationFrame(rafId);
    };
  }, [enabled, visible]);

  if (!enabled) return null;

  const isExpanded = Boolean(label);

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      className={`fixed top-0 left-0 z-[9999] pointer-events-none transition-[width,height,background-color,border-color,opacity] duration-200 ease-out flex items-center justify-center rounded-full ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${
        isExpanded
          ? 'w-16 h-16 bg-[#C6A24B] text-[#181A18] border border-[#181A18]/20 shadow-md'
          : hoverInteractive
            ? 'w-8 h-8 bg-[#C6A24B]/18 border border-[#C6A24B]'
            : 'w-4 h-4 bg-transparent border border-[#181A18]/55'
      }`}
    >
      {label && (
        <span className="text-[11px] font-bold tracking-wide uppercase leading-none text-[#181A18]">
          {label}
        </span>
      )}
    </div>
  );
}
